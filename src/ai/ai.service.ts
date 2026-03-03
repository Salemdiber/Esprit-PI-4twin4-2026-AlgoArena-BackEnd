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
}

@Injectable()
export class AiService {
    private readonly groq: Groq;
    private readonly logger = new Logger(AiService.name);
    private readonly MODEL = 'llama-3.1-8b-instant';

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
        const userPrompt = dto.description;

        try {
            const response = await this.groq.chat.completions.create({
                model: this.MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 4096,
                top_p: 0.9,
            });

            const content = response.choices?.[0]?.message?.content;
            if (!content) {
                throw new HttpException(
                    'AI returned an empty response. Please try again.',
                    HttpStatus.BAD_GATEWAY,
                );
            }

            return this.parseAndValidate(content, dto.testCases);
        } catch (error) {
            // Handle Groq-specific errors
            if (error?.status === 429) {
                throw new HttpException(
                    'AI rate limit exceeded. Please wait a moment and try again.',
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }
            if (error instanceof HttpException) throw error;

            this.logger.error('Groq API error', error?.message || error);
            throw new HttpException(
                'Failed to generate challenge. Please try again.',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    private buildSystemPrompt(dto: GenerateChallengeDto): string {
        return `You are an expert coding challenge designer for the AlgoArena competitive programming platform.

Generate a structured coding challenge based on the user's request.

Return STRICTLY valid JSON in this EXACT format (no markdown, no explanations, no extra text):

{
  "title": "string — concise, descriptive challenge title",
  "description": "string — clear and professional problem statement with context",
  "constraints": ["string array — input constraints and limits"],
  "examples": [
    {
      "input": "string — example input",
      "output": "string — expected output",
      "explanation": "string — step-by-step explanation"
    }
  ],
  "testCases": [
    {
      "input": "string — test input",
      "output": "string — expected output"
    }
  ]
}

RULES:
- Difficulty level: ${dto.difficulty}
- Topic/category: ${dto.topic}
- Generate EXACTLY ${dto.testCases} test cases
- Include 2-3 examples with detailed explanations
- Include edge cases in test cases
- Ensure logical correctness of all inputs/outputs
- Constraints should be specific (e.g., "1 <= n <= 10^5")
- Description must be clear enough for a competitive programmer
- Do NOT wrap in markdown code blocks
- Do NOT include any text outside the JSON object
- Return ONLY the JSON object`;
    }

    private parseAndValidate(raw: string, expectedTestCases: number): GeneratedChallenge {
        // Strip markdown fences if AI accidentally adds them
        let cleaned = raw.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        let parsed: any;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            this.logger.warn('AI returned invalid JSON', cleaned.substring(0, 200));
            throw new HttpException(
                'AI returned malformed output. Please try again.',
                HttpStatus.BAD_GATEWAY,
            );
        }

        // Validate required fields
        const required = ['title', 'description', 'constraints', 'examples', 'testCases'];
        for (const field of required) {
            if (!parsed[field]) {
                throw new HttpException(
                    `AI output is missing required field: ${field}. Please try again.`,
                    HttpStatus.BAD_GATEWAY,
                );
            }
        }

        if (!Array.isArray(parsed.constraints)) {
            throw new HttpException('AI output has invalid constraints format.', HttpStatus.BAD_GATEWAY);
        }
        if (!Array.isArray(parsed.examples) || parsed.examples.length === 0) {
            throw new HttpException('AI output has no examples.', HttpStatus.BAD_GATEWAY);
        }
        if (!Array.isArray(parsed.testCases) || parsed.testCases.length === 0) {
            throw new HttpException('AI output has no test cases.', HttpStatus.BAD_GATEWAY);
        }

        // Validate each example (input+output required, explanation defaults to '')
        for (const ex of parsed.examples) {
            if (!ex.input || !ex.output) {
                throw new HttpException(
                    'AI output has incomplete examples (missing input/output).',
                    HttpStatus.BAD_GATEWAY,
                );
            }
            if (!ex.explanation) ex.explanation = '';
        }

        // Validate each test case
        for (const tc of parsed.testCases) {
            if (tc.input === undefined || tc.output === undefined) {
                throw new HttpException(
                    'AI output has incomplete test cases (missing input/output).',
                    HttpStatus.BAD_GATEWAY,
                );
            }
        }

        // Warn (but don't reject) if count doesn't match
        if (parsed.testCases.length !== expectedTestCases) {
            this.logger.warn(
                `AI generated ${parsed.testCases.length} test cases, expected ${expectedTestCases}`,
            );
        }

        return {
            title: String(parsed.title),
            description: String(parsed.description),
            constraints: parsed.constraints.map(String),
            examples: parsed.examples.map((e: any) => ({
                input: String(e.input),
                output: String(e.output),
                explanation: String(e.explanation),
            })),
            testCases: parsed.testCases.map((t: any) => ({
                input: String(t.input),
                output: String(t.output),
            })),
        };
    }
}
