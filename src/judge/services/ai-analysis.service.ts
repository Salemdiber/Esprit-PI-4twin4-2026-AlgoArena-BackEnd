import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AIAnalysisService {
  private readonly logger = new Logger(AIAnalysisService.name);
  private openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async quickCodeCheck(userCode: string, language: string, challengeTitle: string, challengeDescription: string): Promise<{ hasSyntaxError: boolean; errorLine: number | null; errorMessage: string | null }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a syntax checker. Check for syntax errors (missing brackets, colons, unclosed strings). ALSO verify that at least one valid function is defined taking the correct number of arguments for the challenge. If there is no function or the signature expects a wrong number of arguments, flag hasSyntaxError=true with a helpful message. Respond ONLY with JSON format: { "hasSyntaxError": boolean, "errorLine": number | null, "errorMessage": string | null }.' },
          { role: 'user', content: `Challenge: ${challengeTitle}\nDescription: ${challengeDescription}\nLanguage: ${language}\n\nCode:\n${userCode}` }
        ],
        temperature: 0,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0].message.content;
      return JSON.parse(content || '{}') as { hasSyntaxError: boolean; errorLine: number | null; errorMessage: string | null };
    } catch (e) {
      this.logger.error(`AI quickCodeCheck failed: ${e.message}`);
      return { hasSyntaxError: false, errorLine: null, errorMessage: null };
    }
  }

  async analyzeResults(userCode: string, language: string, challengeTitle: string, challengeDescription: string, testResults: any[]): Promise<string> {
    const allPassed = testResults.every((r: any) => r.passed);
    try {
      const prompt = allPassed 
        ? `The user's code passed all test cases for "${challengeTitle}". Language: ${language}.\n\nCongratulate them briefly and offer an optional optimization tip (under 2 sentences).`
        : `The user's code failed some tests for "${challengeTitle}". Language: ${language}.\nCode:\n${userCode}\n\nResults:\n${JSON.stringify(testResults)}\n\nExplain the bug clearly. Reference line numbers if possible. Give a hint without giving the full solution (under 150 words).`;

      const completion = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an AI coding assistant. Give short, concise, and helpful feedback.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 250,
      });

      return completion.choices[0].message.content || 'AI analysis temporarily unavailable.';
    } catch (e) {
      this.logger.error(`AI analyzeResults failed: ${e.message}`);
      return 'AI analysis temporarily unavailable.';
    }
  }

  async generateHint(challengeTitle: string, challengeDescription: string, hintLevel: number): Promise<string> {
    try {
      let instructions = '';
      if (hintLevel === 1) instructions = 'Give only a general direction for solving the challenge.';
      else if (hintLevel === 2) instructions = 'Suggest a specific technique or data structure to solve it.';
      else instructions = 'Explain a detailed step-by-step approach without writing the actual code.';

      const completion = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a technical hint generator. Be concise and do not write complete code blocks.' },
          { role: 'user', content: `Challenge: ${challengeTitle}\nDescription: ${challengeDescription}\n\n${instructions}` }
        ],
        temperature: 0.5,
        max_tokens: 250,
      });

      return completion.choices[0].message.content || 'Hints temporarily unavailable.';
    } catch (e) {
      this.logger.error(`AI generateHint failed: ${e.message}`);
      return 'Hints temporarily unavailable.';
    }
  }

  async analyzeSubmissionDetails(
    userCode: string,
    language: string,
    challengeTitle: string,
    challengeDescription: string,
    testResults: any[],
  ): Promise<{
    timeComplexity: string;
    spaceComplexity: string;
    aiDetection: 'MANUAL' | 'AI_SUSPECTED';
    recommendations: string[];
    codeQualityScore?: number;
    codeQualityNotes?: string[];
  }> {
    const fallback = this.estimateSubmissionDetails(userCode);
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are an advanced code judge. Return strict JSON only with keys: timeComplexity, spaceComplexity, aiDetection, recommendations, codeQualityScore, codeQualityNotes. aiDetection must be MANUAL or AI_SUSPECTED. recommendations must be an array of short strings. codeQualityScore must be an integer 0-100 (readability, correctness hygiene, edge-cases, structure). codeQualityNotes must be an array of short strings.',
          },
          {
            role: 'user',
            content: `Challenge: ${challengeTitle}\nDescription: ${challengeDescription}\nLanguage: ${language}\nCode:\n${userCode}\nResults:${JSON.stringify(testResults)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 220,
        response_format: { type: 'json_object' },
      });
      const raw = completion.choices[0].message.content;
      const parsed = JSON.parse(raw || '{}') as any;
      const parsedTime = parsed?.timeComplexity;
      const parsedSpace = parsed?.spaceComplexity;
      const safeTime = !parsedTime || parsedTime === 'Unknown' ? fallback.timeComplexity : parsedTime;
      const safeSpace = !parsedSpace || parsedSpace === 'Unknown' ? fallback.spaceComplexity : parsedSpace;
      const qualityScore = Number.isFinite(Number(parsed?.codeQualityScore))
        ? Math.max(0, Math.min(100, Math.round(Number(parsed.codeQualityScore))))
        : fallback.codeQualityScore;
      const qualityNotes = Array.isArray(parsed?.codeQualityNotes) && parsed.codeQualityNotes.length
        ? parsed.codeQualityNotes.slice(0, 5).map((item: any) => String(item))
        : fallback.codeQualityNotes;
      return {
        timeComplexity: safeTime,
        spaceComplexity: safeSpace,
        aiDetection: parsed?.aiDetection === 'AI_SUSPECTED' ? 'AI_SUSPECTED' : 'MANUAL',
        recommendations: Array.isArray(parsed?.recommendations) && parsed.recommendations.length
          ? parsed.recommendations.slice(0, 5).map((item: any) => String(item))
          : fallback.recommendations,
        codeQualityScore: qualityScore,
        codeQualityNotes: qualityNotes,
      };
    } catch (e) {
      this.logger.error(`AI analyzeSubmissionDetails failed: ${e.message}`);
      return fallback;
    }
  }

  private estimateSubmissionDetails(userCode: string): {
    timeComplexity: string;
    spaceComplexity: string;
    aiDetection: 'MANUAL' | 'AI_SUSPECTED';
    recommendations: string[];
    codeQualityScore: number;
    codeQualityNotes: string[];
  } {
    const loopCount = (userCode.match(/\b(for|while)\b/g) || []).length;
    const usesCollections = /\b(Map|Set|dict|{}\s*$|\[\])\b/.test(userCode);
    const timeComplexity = loopCount >= 2 ? 'O(n^2)' : loopCount === 1 ? 'O(n)' : 'O(1)';
    const spaceComplexity = usesCollections ? 'O(n)' : 'O(1)';
    return {
      timeComplexity,
      spaceComplexity,
      aiDetection: 'MANUAL',
      recommendations: ['Consider documenting edge-case handling to improve clarity.'],
      codeQualityScore: 65,
      codeQualityNotes: ['Improve naming and add brief comments for tricky parts.'],
    };
  }
}
