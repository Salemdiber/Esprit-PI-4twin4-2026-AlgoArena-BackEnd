import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { OnboardingService, SolutionInput } from './onboarding.service';

@Controller()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('onboarding-test')
  async onboardingTest() {
    const candidates = [
      join(process.cwd(), 'challenges.json'),
      join(__dirname, '..', '..', 'challenges.json'),
      join(__dirname, '..', '..', '..', 'challenges.json'),
    ];

    for (const file of candidates) {
      try {
        if (!fs.existsSync(file)) continue;
        const buf: Buffer = await fs.promises.readFile(file);

        // Try UTF-8 first (strip BOM if present)
        const tryUtf8 = (b: Buffer) => {
          let s = b.toString('utf8');
          if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
          return s;
        };

        const tryDecoders = [
          { name: 'utf8', fn: () => tryUtf8(buf) },
          { name: 'utf16le', fn: () => buf.toString('utf16le') },
          { name: 'latin1', fn: () => buf.toString('latin1') },
        ];

        for (const dec of tryDecoders) {
          try {
            const raw = dec.fn();
            const data = JSON.parse(raw);
            return { success: true, problems: data, path: file, encoding: dec.name };
          } catch (err) {
            // try next decoder
          }
        }

        // If we reach here, parsing failed for all attempted encodings
        const snippet = buf.slice(0, 64).toString('hex');
        // eslint-disable-next-line no-console
        console.error('OnboardingController: failed to parse JSON for', file, 'sampleHex:', snippet);
        return { success: false, problems: [], error: 'Failed to parse JSON (encoding mismatch)', path: file, sampleHex: snippet };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('OnboardingController read error for', file, e?.message || e);
        return { success: false, problems: [], error: String(e?.message || e), path: file };
      }
    }

    return { success: true, problems: [] };
  }

  // ── POST /classify ──────────────────────────────────────────────────────────
  @Post('classify')
  @HttpCode(200)
  async classify(
    @Body() body: { solutions: SolutionInput[]; totalSeconds: number },
  ) {
    const { solutions = [], totalSeconds = 900 } = body;
    const result = await this.onboardingService.classifySolutions(solutions, totalSeconds);
    return result;
  }
}
