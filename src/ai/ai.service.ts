import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GenerateChallengeDto } from './dto/generate-challenge.dto';

export interface GeneratedChallenge {
    title: string;
    description: string;
    constraints: string[];
    examples: { input: string; output: string; explanation: string }[];
    testCases: { input: string; output: string }[];
    starterCode?: { javascript: string };
}

@Injectable()
export class AiService {
    private readonly groq: Groq;
    private readonly logger = new Logger(AiService.name);
    private readonly MODEL = 'llama-3.3-70b-versatile';
    private readonly MAX_RETRIES = 2;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('GROQ_API_KEY');
        if (!apiKey) {
            this.logger.error('GROQ_API_KEY is not set in environment variables');
            throw new Error('GROQ_API_KEY is missing');
        }
        this.groq = new Groq({ apiKey });
    }

    async generateChallenge(dto: GenerateChallengeDto): Promise<GeneratedChallenge> {
        const systemPrompt = this.buildSystemPrompt(dto);
        const userPrompt = `Generate a "${dto.difficulty}" level "${dto.topic}" coding challenge. ${dto.description}`;

        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                this.logger.log(`AI generation attempt ${attempt}/${this.MAX_RETRIES}`);
                const response = await this.groq.chat.completions.create({
                    model: this.MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.4,
                    max_tokens: 2048,
                    top_p: 0.85,
                    stop: null,
                });

                const content = response.choices?.[0]?.message?.content;
                const finishReason = response.choices?.[0]?.finish_reason;

                if (!content) {
                    this.logger.warn(`Attempt ${attempt}: Empty response from AI`);
                    if (attempt < this.MAX_RETRIES) continue;
                    throw new HttpException('AI returned an empty response.', HttpStatus.BAD_GATEWAY);
                }

                if (finishReason === 'length') {
                    this.logger.warn(`Attempt ${attempt}: AI response truncated (finish_reason=length), length=${content.length}. Attempting recovery.`);
                }

                const result = this.parseAndValidate(content, dto.testCases, attempt);
                this.logger.log(`AI generation succeeded on attempt ${attempt}`);
                return result;

            } catch (error) {
                if (error?.status === 429) {
                    throw new HttpException('AI rate limit exceeded. Please wait a moment and try again.', HttpStatus.TOO_MANY_REQUESTS);
                }
                if (error instanceof HttpException) {
                    if (attempt < this.MAX_RETRIES) {
                        this.logger.warn(`Attempt ${attempt} failed with HttpException: ${error.message}. Retrying...`);
                        continue;
                    }
                    throw error;
                }
                this.logger.error(`Attempt ${attempt} Groq API error: ${error?.message || error}`);
                if (attempt >= this.MAX_RETRIES) {
                    throw new HttpException('Failed to generate challenge after retries. Please try again.', HttpStatus.BAD_GATEWAY);
                }
            }
        }

        throw new HttpException('AI generation failed after all retries.', HttpStatus.BAD_GATEWAY);
    }

    private buildSystemPrompt(dto: GenerateChallengeDto): string {
        const tcCount = Math.min(dto.testCases, 5); // cap at 5 for reliability
        return `You are a coding challenge designer for AlgoArena. You MUST output ONLY a JSON object. No markdown. No preamble. No explanation. No code fences.

STRICT RULES:
1. Output ONLY the JSON object — nothing before it, nothing after it
2. NEVER use markdown code blocks (no \`\`\`json)
3. NEVER truncate output — complete ALL arrays fully
4. Keep testCase inputs SHORT (max 50 chars each)
5. Keep starterCode SHORT (max 5 lines)
6. Keep description under 300 chars
7. Generate EXACTLY ${tcCount} test cases — no more
8. Generate exactly 2 examples
9. All JSON strings must be properly escaped

OUTPUT JSON SCHEMA — follow exactly:
{
  "title": "short challenge title",
  "description": "concise problem statement under 300 chars",
  "constraints": ["constraint1", "constraint2", "constraint3"],
  "examples": [
    {"input": "short input", "output": "short output", "explanation": "brief explanation"},
    {"input": "short input", "output": "short output", "explanation": "brief explanation"}
  ],
  "testCases": [
    {"input": "short input", "output": "short output"}
  ],
  "starterCode": {"javascript": "function solution() {\\n  // write your code\\n}"}
}

CONTEXT:
- Difficulty: ${dto.difficulty}
- Topic: ${dto.topic}
- Test cases count: ${tcCount}

Return ONLY the JSON. Not a single character outside the JSON object.`;
    }

    /**
     * Attempt to repair truncated JSON by closing unclosed structures
     */
    private repairJson(raw: string): string {
        let s = raw.trim();

        // Remove trailing comma before any closing brace/bracket
        s = s.replace(/,\s*([}\]])/g, '$1');

        // Count unclosed braces/brackets
        let braces = 0;
        let brackets = 0;
        let inString = false;
        let escape = false;

        for (const ch of s) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') braces++;
            else if (ch === '}') braces--;
            else if (ch === '[') brackets++;
            else if (ch === ']') brackets--;
        }

        // If we're inside a string when truncated, close it
        if (inString) s += '"';

        // Close any open arrays then objects
        for (let i = 0; i < brackets; i++) s += ']';
        for (let i = 0; i < braces; i++) s += '}';

        return s;
    }

    private parseAndValidate(raw: string, expectedTestCases: number, attempt: number): GeneratedChallenge {
        // 1. Strip markdown fences
        let cleaned = raw.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        // 2. Extract just the JSON object (find first { to last })
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1) {
            if (lastBrace > firstBrace) {
                cleaned = cleaned.slice(firstBrace, lastBrace + 1);
            } else {
                // Truncated — try repair
                cleaned = cleaned.slice(firstBrace);
            }
        }

        // 3. Try to parse as-is
        let parsed: any;
        try {
            parsed = JSON.parse(cleaned);
            this.logger.log(`JSON parsed successfully on attempt ${attempt}, length=${raw.length}`);
        } catch (parseErr) {
            // 4. Attempt JSON repair
            this.logger.warn(`Attempt ${attempt}: JSON parse failed (length=${raw.length}). Attempting repair. Error: ${String(parseErr).slice(0, 80)}`);
            const repaired = this.repairJson(cleaned);
            try {
                parsed = JSON.parse(repaired);
                this.logger.warn(`Attempt ${attempt}: JSON repaired successfully after repair`);
            } catch (repairErr) {
                this.logger.error(`Attempt ${attempt}: JSON repair failed. Raw preview: "${raw.slice(0, 200)}..."`);
                throw new HttpException(
                    'AI returned malformed output that could not be repaired. Please try again.',
                    HttpStatus.BAD_GATEWAY,
                );
            }
        }

        // 5. Validate and sanitize fields
        if (!parsed.title || typeof parsed.title !== 'string') {
            this.logger.error(`Attempt ${attempt}: Missing 'title' field`);
            throw new HttpException('AI output missing required field: title.', HttpStatus.BAD_GATEWAY);
        }
        if (!parsed.description || typeof parsed.description !== 'string') {
            this.logger.error(`Attempt ${attempt}: Missing 'description' field`);
            throw new HttpException('AI output missing required field: description.', HttpStatus.BAD_GATEWAY);
        }

        // 6. Safe array coercion
        if (!Array.isArray(parsed.constraints)) parsed.constraints = [];
        if (!Array.isArray(parsed.examples)) parsed.examples = [];
        if (!Array.isArray(parsed.testCases)) parsed.testCases = [];

        // 7. Filter out incomplete examples
        parsed.examples = parsed.examples
            .filter((ex: any) => ex && ex.input && ex.output)
            .slice(0, 3)
            .map((ex: any) => ({
                input: String(ex.input).slice(0, 200),
                output: String(ex.output).slice(0, 200),
                explanation: String(ex.explanation || ''),
            }));

        if (parsed.examples.length === 0) {
            this.logger.warn(`Attempt ${attempt}: No valid examples in AI output — using placeholder`);
            parsed.examples = [{ input: 'example input', output: 'example output', explanation: 'See description for details.' }];
        }

        // 8. Filter out incomplete test cases — enforce strict limit
        const limit = Math.min(expectedTestCases, 5);
        parsed.testCases = parsed.testCases
            .filter((tc: any) => tc && tc.input !== undefined && tc.output !== undefined)
            .slice(0, limit)
            .map((tc: any) => ({
                input: String(tc.input).slice(0, 100),
                output: String(tc.output).slice(0, 100),
            }));

        if (parsed.testCases.length === 0) {
            this.logger.warn(`Attempt ${attempt}: No valid test cases — using placeholder`);
            parsed.testCases = [{ input: '1', output: '1' }];
        } else if (parsed.testCases.length !== expectedTestCases) {
            this.logger.warn(`Attempt ${attempt}: AI generated ${parsed.testCases.length} test cases, expected ${expectedTestCases}`);
        }

        // 9. Handle starterCode gracefully
        let starterJs = '';
        if (parsed.starterCode?.javascript) {
            starterJs = String(parsed.starterCode.javascript).slice(0, 500);
        } else {
            starterJs = `// ${parsed.title}\nfunction solution() {\n  // Write your code here\n}\n`;
        }

        return {
            title: String(parsed.title).slice(0, 120),
            description: String(parsed.description).slice(0, 800),
            constraints: parsed.constraints.map((c: any) => String(c).slice(0, 150)).slice(0, 8),
            examples: parsed.examples,
            testCases: parsed.testCases,
            starterCode: { javascript: starterJs },
        };
    }
}
