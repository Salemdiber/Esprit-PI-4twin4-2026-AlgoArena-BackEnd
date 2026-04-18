import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GenerateChallengeDto } from './dto/generate-challenge.dto';
import { DockerExecutionService } from '../judge/services/docker-execution.service';

// ── Response shape — UNCHANGED, matches existing API contract ───────────────
export interface GeneratedChallenge {
    title: string;
    description: string;
    constraints: string[];
    examples: { input: string; output: string; explanation: string }[];
    testCases: { input: string; output: string }[];
    starterCode?: { javascript: string };
    referenceSolution: string;
}

@Injectable()
export class AiService {
    private readonly groq: Groq;
    private readonly logger = new Logger(AiService.name);

    // Challenge generation model — other AI features use their own models untouched
    private readonly GENERATION_MODEL = 'openai/gpt-oss-120b';
    private readonly MAX_ATTEMPTS = 3;

    constructor(
        private readonly config: ConfigService,
        private readonly dockerExecutionService: DockerExecutionService,
    ) {
        const apiKey = this.config.get<string>('GROQ_API_KEY');
        if (!apiKey) {
            this.logger.error('GROQ_API_KEY is not set in environment variables');
            throw new Error('GROQ_API_KEY is missing');
        }
        this.groq = new Groq({ apiKey });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC — Challenge Generation (the ONLY method being changed)
    // ═══════════════════════════════════════════════════════════════════════════

    async generateChallenge(dto: GenerateChallengeDto): Promise<GeneratedChallenge> {
        const systemPrompt = this.buildChallengeSystemPrompt();
        const baseUserPrompt =
            `Generate a "${dto.difficulty}" level "${dto.topic}" coding challenge. ${dto.description}`;
        let currentUserPrompt = baseUserPrompt;

        const errors: Array<{ attempt: number; error: string }> = [];

        for (let attempt = 1; attempt <= this.MAX_ATTEMPTS; attempt++) {
            try {
                this.logger.log(`[ChallengeGen] Attempt ${attempt}/${this.MAX_ATTEMPTS}`);

                // ── Step 1: Call Groq ────────────────────────────────────────
                const completion = await this.groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: currentUserPrompt },
                    ],
                    model: this.GENERATION_MODEL,
                    temperature: 0.2,
                    max_completion_tokens: 4096,
                    top_p: 0.9,
                    stream: false,
                });

                const rawContent = completion.choices?.[0]?.message?.content;
                if (!rawContent) {
                    throw new Error('EMPTY_RESPONSE: Model returned no content');
                }
                this.logger.debug(`[ChallengeGen] Raw response length: ${rawContent.length}`);

                // ── Step 2: Extract & Parse JSON ─────────────────────────────
                const parsed = this.extractJSON(rawContent);

                // ── Step 3: Schema Validation ────────────────────────────────
                this.validateSchema(parsed);

                // ── Step 4: Duplicate Test Case Check ────────────────────────
                this.checkDuplicateTestCases(parsed.testCases);

                // ── Step 5: Context-Aware Edge Case Validation ───────────────
                this.validateEdgeCases(parsed.testCases, parsed.description);

                // ── Step 6: Execute Reference Solution & Verify All Tests ────
                const verification = await this.verifyTestCases(
                    parsed.referenceSolution,
                    parsed.testCases,
                );
                if (!verification.valid) {
                    throw new Error(
                        'TEST_VERIFICATION_FAILED:\n' + verification.errors.join('\n'),
                    );
                }

                this.logger.log(
                    `[ChallengeGen] ✅ All validation passed on attempt ${attempt}`,
                );

                // ── Step 7: Map to GeneratedChallenge response shape ─────────
                return this.mapToGeneratedChallenge(parsed);

            } catch (error: any) {
                // Rate-limit is non-retriable — bubble immediately
                if (error?.status === 429) {
                    throw new HttpException(
                        'AI rate limit exceeded. Please wait a moment and try again.',
                        HttpStatus.TOO_MANY_REQUESTS,
                    );
                }

                const errorMsg = error?.message || String(error);
                this.logger.warn(
                    `[ChallengeGen] Attempt ${attempt} failed: ${errorMsg}`,
                );
                errors.push({ attempt, error: errorMsg });

                if (attempt < this.MAX_ATTEMPTS) {
                    // Inject failure context so the model can self-correct
                    currentUserPrompt =
                        baseUserPrompt +
                        '\n\nWARNING: Your previous attempt (attempt ' + attempt + ') failed.\n' +
                        'Reason: ' + errorMsg + '\n' +
                        'You MUST fix this issue. Generate the ENTIRE challenge again from scratch.\n' +
                        'Make sure your referenceSolution is valid JavaScript and all expectedOutputs are correct.';
                }
            }
        }

        // All attempts exhausted — return error, NEVER return unvalidated data
        const summary = errors
            .map((e) => `  Attempt ${e.attempt}: ${e.error}`)
            .join('\n');
        this.logger.error(
            `[ChallengeGen] All ${this.MAX_ATTEMPTS} attempts failed:\n${summary}`,
        );
        throw new HttpException(
            `AI challenge generation failed after ${this.MAX_ATTEMPTS} attempts. Please try again.`,
            HttpStatus.BAD_GATEWAY,
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — System Prompt (Challenge Generation Only)
    // ═══════════════════════════════════════════════════════════════════════════

    private buildChallengeSystemPrompt(): string {
        return `You are an expert competitive programming problem designer.

Generate a complete coding challenge as a single valid JSON object.

ABSOLUTE RULES:
1. Return ONLY raw JSON. No markdown. No code fences. No triple backtick json. No explanation outside the JSON.
2. The referenceSolution must be a COMPLETE, SELF-CONTAINED JavaScript function that:
   - Is named "solve"
   - Takes a single parameter (the input)
   - Returns the correct output
   - Handles ALL edge cases relevant to THIS specific problem
   - Uses NO external imports or dependencies
3. For EVERY test case, mentally execute your reference solution step by step against the input. The expectedOutput MUST be exactly what your function returns.
4. Edge cases must be RELEVANT to the problem type:
   - String problems: empty string "", single character "a", all same characters "aaaa", full string is answer
   - Array problems: empty array [], single element [1], all duplicates, sorted/reverse sorted
   - Number problems: zero, negative numbers, very large numbers, minimum/maximum boundaries
   - Do NOT force irrelevant edge cases (e.g., don't add negative numbers to a string problem)
5. Test case inputs and expectedOutputs must be valid JSON values (strings, numbers, arrays, objects, booleans, null)
6. The referenceSolution string must NOT contain backticks, template literals, or characters that would break JSON string escaping. Use regular string concatenation or single/double quotes only.

REQUIRED JSON STRUCTURE:
{
  "title": "string",
  "description": "string (clear, unambiguous problem statement with examples in the description)",
  "difficulty": "easy" | "medium" | "hard",
  "constraints": ["string (explicit size/value bounds)"],
  "examples": [
    {
      "input": "readable representation of input",
      "output": "readable representation of output",
      "explanation": "step-by-step explanation"
    }
  ],
  "testCases": [
    {
      "input": valid_JSON_value,
      "expectedOutput": valid_JSON_value
    }
  ],
  "hints": ["string"],
  "starterCode": { "javascript": "function solve(input) { // your code here }" },
  "referenceSolution": "function solve(input) { ... return result; }"
}

MINIMUM REQUIREMENTS:
- At least 5 test cases total
- At least 2 must be edge cases relevant to the problem domain
- At least 1 example with explanation
- referenceSolution must be executable JavaScript

VERIFY BEFORE RESPONDING:
- Run your referenceSolution mentally against EVERY test case
- Confirm each expectedOutput matches exactly
- If ANY mismatch exists, fix it before responding`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Step 2: Safe JSON Extraction
    // ═══════════════════════════════════════════════════════════════════════════

    private extractJSON(raw: string): any {
        let cleaned = raw.trim();

        // Strip markdown code fences if the model wraps its response
        const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            cleaned = fenceMatch[1].trim();
        }

        // Locate the actual JSON object boundaries
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            throw new Error('NO_JSON_FOUND: Could not locate a JSON object in AI response');
        }

        cleaned = cleaned.substring(firstBrace, lastBrace + 1);

        try {
            return JSON.parse(cleaned);
        } catch (e: any) {
            throw new Error('MALFORMED_JSON: ' + e.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Step 3: Schema Validation
    // ═══════════════════════════════════════════════════════════════════════════

    private validateSchema(data: any): void {
        const requiredStrings = ['title', 'description', 'difficulty', 'referenceSolution'];
        for (const field of requiredStrings) {
            if (typeof data[field] !== 'string' || data[field].trim() === '') {
                throw new Error('SCHEMA_INVALID: missing or empty field "' + field + '"');
            }
        }

        if (!['easy', 'medium', 'hard'].includes(data.difficulty.toLowerCase())) {
            throw new Error(
                'SCHEMA_INVALID: difficulty must be easy/medium/hard, got "' + data.difficulty + '"',
            );
        }

        if (!Array.isArray(data.constraints) || data.constraints.length === 0) {
            throw new Error('SCHEMA_INVALID: constraints must be a non-empty array');
        }

        if (!Array.isArray(data.examples) || data.examples.length < 1) {
            throw new Error('SCHEMA_INVALID: need at least 1 example');
        }

        if (!Array.isArray(data.testCases) || data.testCases.length < 3) {
            throw new Error(
                'SCHEMA_INVALID: need at least 3 test cases, got ' +
                    (data.testCases?.length ?? 0),
            );
        }

        for (let i = 0; i < data.testCases.length; i++) {
            const tc = data.testCases[i];
            if (!tc.hasOwnProperty('input') || !tc.hasOwnProperty('expectedOutput')) {
                throw new Error(
                    'SCHEMA_INVALID: testCase[' + i + '] missing input or expectedOutput',
                );
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Step 4: Duplicate Test Case Check
    // ═══════════════════════════════════════════════════════════════════════════

    private checkDuplicateTestCases(testCases: Array<{ input: any }>): void {
        const seen = new Set<string>();
        for (let i = 0; i < testCases.length; i++) {
            const key = JSON.stringify(testCases[i].input);
            if (seen.has(key)) {
                throw new Error(
                    'DUPLICATE_TEST_CASE: testCase[' + i + '] has duplicate input',
                );
            }
            seen.add(key);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Step 5: Context-Aware Edge Case Validation
    // ═══════════════════════════════════════════════════════════════════════════

    private validateEdgeCases(
        testCases: Array<{ input: any; expectedOutput: any }>,
        problemDescription: string,
    ): void {
        const inputs = testCases.map((tc) => tc.input);
        let hasEdgeCase = false;

        const hasStringInputs = inputs.some((i) => typeof i === 'string');
        const hasArrayInputs = inputs.some((i) => Array.isArray(i));
        const hasNumberInputs = inputs.some((i) => typeof i === 'number');

        if (hasStringInputs) {
            // String problems: empty string, single char, all same chars
            hasEdgeCase = inputs.some(
                (i) =>
                    typeof i === 'string' &&
                    (i.length === 0 ||
                        i.length === 1 ||
                        new Set(i.split('')).size === 1),
            );
        } else if (hasArrayInputs) {
            // Array problems: empty array, single element, all duplicates
            hasEdgeCase = inputs.some(
                (i) =>
                    Array.isArray(i) &&
                    (i.length === 0 ||
                        i.length === 1 ||
                        new Set(i.map((x) => JSON.stringify(x))).size === 1),
            );
        } else if (hasNumberInputs) {
            // Number problems: zero, negative, one
            hasEdgeCase = inputs.some(
                (i) =>
                    typeof i === 'number' && (i === 0 || i < 0 || i === 1),
            );
        } else {
            // Unknown / complex input type — skip enforcement entirely
            hasEdgeCase = true;
        }

        if (!hasEdgeCase) {
            // Warn but do NOT reject — avoids false rejections on valid challenges
            this.logger.warn(
                '[ChallengeGen] EDGE_CASE_WARNING: No obvious edge case detected in test cases. ' +
                    'Challenge will be accepted but consider adding edge cases manually.',
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Step 6: Test Case Verification via Docker Execution
    // ═══════════════════════════════════════════════════════════════════════════

    private async verifyTestCases(
        referenceSolution: string,
        testCases: Array<{ input: any; expectedOutput: any }>,
    ): Promise<{ valid: boolean; errors: string[] }> {
        this.logger.log(
            `[ChallengeGen] Verifying ${testCases.length} test cases via Docker execution...`,
        );

        // Format test cases for DockerExecutionService.executeCode():
        //   - input: must be a STRING that the input parser can parse into typed args
        //     JSON.stringify gives us "[1,2,3]" / "42" / "\"hello\"" — the parser handles all of these
        //   - expectedOutput: native value for the existing comparison logic
        const dockerTestCases = testCases.map((tc) => ({
            input: JSON.stringify(tc.input),
            expectedOutput: tc.expectedOutput,
        }));

        try {
            const executionResult = await this.dockerExecutionService.executeCode(
                referenceSolution,
                'javascript' as any,
                dockerTestCases,
                {
                    challengeTitle: 'AI Validation',
                    challengeDescription: 'Verifying AI-generated test cases against reference solution',
                },
            );

            // Global execution error (e.g. Docker connection failure, syntax error)
            if (executionResult.error) {
                return {
                    valid: false,
                    errors: [
                        `Execution error: ${executionResult.error.type} — ${executionResult.error.message}`,
                    ],
                };
            }

            // Per-test-case validation
            const errors: string[] = [];
            for (let i = 0; i < executionResult.results.length; i++) {
                const r = executionResult.results[i];
                if (!r.passed) {
                    if (r.error) {
                        errors.push(
                            'testCase[' + i + ']: Runtime error — ' + r.error,
                        );
                    } else {
                        errors.push(
                            'testCase[' + i + ']: Output mismatch — ' +
                                'input=' + JSON.stringify(testCases[i].input) + ', ' +
                                'expected=' + JSON.stringify(testCases[i].expectedOutput) + ', ' +
                                'actual=' + JSON.stringify(r.got ?? r.output),
                        );
                    }
                }
            }

            if (errors.length > 0) {
                this.logger.warn(
                    `[ChallengeGen] ${errors.length}/${testCases.length} test cases failed verification`,
                );
            } else {
                this.logger.log(
                    `[ChallengeGen] All ${testCases.length} test cases verified ✅`,
                );
            }

            return { valid: errors.length === 0, errors };
        } catch (err: any) {
            return {
                valid: false,
                errors: ['Docker execution exception: ' + err.message],
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Step 7: Map AI Output → GeneratedChallenge (API contract)
    // ═══════════════════════════════════════════════════════════════════════════

    private mapToGeneratedChallenge(parsed: any): GeneratedChallenge {
        // Convert examples — ensure all values are strings
        const examples = (parsed.examples || []).map((ex: any) => ({
            input:
                typeof ex.input === 'string'
                    ? ex.input
                    : JSON.stringify(ex.input),
            output:
                typeof ex.output === 'string'
                    ? ex.output
                    : JSON.stringify(ex.output),
            explanation: String(ex.explanation || ''),
        }));

        // Convert test cases — AI uses "expectedOutput", API contract uses "output"
        // All values serialized to strings for consistent DB storage
        const testCases = (parsed.testCases || []).map((tc: any) => ({
            input:
                typeof tc.input === 'string'
                    ? tc.input
                    : JSON.stringify(tc.input),
            output:
                typeof tc.expectedOutput === 'string'
                    ? tc.expectedOutput
                    : JSON.stringify(tc.expectedOutput),
        }));

        // Starter code
        let starterJs: string;
        if (
            parsed.starterCode &&
            typeof parsed.starterCode === 'object' &&
            parsed.starterCode.javascript
        ) {
            starterJs = String(parsed.starterCode.javascript);
        } else {
            starterJs =
                '// ' + parsed.title + '\nfunction solve(input) {\n  // Write your code here\n}\n';
        }

        // Constraints — tolerate string or array from AI
        const constraints = (
            Array.isArray(parsed.constraints)
                ? parsed.constraints
                : [parsed.constraints]
        ).map((c: any) => String(c));

        return {
            title: String(parsed.title),
            description: String(parsed.description),
            constraints,
            examples,
            testCases,
            starterCode: { javascript: starterJs },
            referenceSolution: parsed.referenceSolution,
        };
    }
}
