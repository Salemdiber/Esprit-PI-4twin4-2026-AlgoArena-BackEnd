import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { CodeExecutorService } from './code-executor.service';

@Controller('api')
export class CodeExecutorController {
    constructor(
        private readonly executor: CodeExecutorService,
        private readonly i18n: I18nService,
    ) {}

    private tr(key: string): string {
        const lang = I18nContext.current()?.lang ?? 'en';
        return this.i18n.translate(key, { lang }) as string;
    }

    @Post('execute')
    async execute(@Body() body: any) {
        const { code, language, testCases } = body || {};
        if (!code) throw new BadRequestException(this.tr('codeExecutor.codeRequired'));
        if (!language) throw new BadRequestException(this.tr('codeExecutor.languageRequired'));

        try {
            if (Array.isArray(testCases) && testCases.length > 0) {
                // Run validation against provided test cases
                const result = await this.executor.validateCode(code, language, testCases.map((t: any) => ({ input: String(t.input || ''), output: String(t.output || '') })));
                return { type: 'validation', result };
            }

            // Raw execution (no test cases) — return stdout
            const output = await this.executor.executeRaw(code, language);
            return { type: 'raw', output };
        } catch (err) {
            return { type: 'error', message: err instanceof Error ? err.message : String(err) };
        }
    }
}
