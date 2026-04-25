import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export class CommunityAiService {
  private readonly logger = new Logger(CommunityAiService.name);
  private readonly apiKey = String(process.env.GROQ_API_KEY || '').trim();
  private readonly model = String(
    process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  ).trim();
  private readonly endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  async complete(
    prompt: string,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {},
  ): Promise<string> {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      throw new BadGatewayException('GROQ prompt is empty');
    }

    if (!this.apiKey) {
      throw new ServiceUnavailableException('GROQ_API_KEY is not configured');
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          ...(options.systemPrompt
            ? [{ role: 'system', content: String(options.systemPrompt) }]
            : []),
          { role: 'user', content: cleanPrompt },
        ],
        max_tokens: options.maxTokens ?? 150,
        temperature: options.temperature ?? 0.2,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const details = payload?.error?.message || `HTTP ${response.status}`;
      this.logger.warn(`GROQ community AI request failed: ${details}`);
      throw new BadGatewayException(`GROQ: ${details}`);
    }

    return String(payload?.choices?.[0]?.message?.content || '').trim();
  }
}
