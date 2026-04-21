import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs/promises';
import * as path from 'path';

type FindingSeverity = 'low' | 'medium' | 'high';
type CacheEntry<T> = { at: number; payload: T };

@Injectable()
export class AiAgentsService {
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly cacheTtlMs = 60 * 1000;
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Challenge') private readonly challengeModel: Model<any>,
    @InjectModel('Battle') private readonly battleModel: Model<any>,
    @InjectModel('CommunityPost') private readonly communityPostModel: Model<any>,
  ) {}

  private getBackendRoot(): string {
    return process.cwd();
  }

  private getFrontendRoot(): string {
    if (process.env.FRONTEND_ROOT) return process.env.FRONTEND_ROOT;
    return path.resolve(this.getBackendRoot(), '..', '..', 'new front', 'Esprit-PI-4twin4-2026-AlgoArena-FrontEnd');
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async listFiles(root: string, allowedExtensions: Set<string>, maxFiles = 4000): Promise<string[]> {
    const out: string[] = [];

    const walk = async (dir: string) => {
      if (out.length >= maxFiles) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (out.length >= maxFiles) break;
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage') {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExtensions.has(ext)) {
          out.push(fullPath);
        }
      }
    };

    await walk(root);
    return out;
  }

  private countCommentsTree(comments: any[]): number {
    if (!Array.isArray(comments)) return 0;
    return comments.reduce((acc, c) => acc + 1 + this.countCommentsTree(c?.replies || []), 0);
  }

  private makeRunId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private severityWeight(severity: FindingSeverity): number {
    if (severity === 'high') return 3;
    if (severity === 'medium') return 2;
    return 1;
  }

  private getCached<T>(key: string, forceRefresh = false): T | null {
    if (this.isDev || forceRefresh) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.payload as T;
  }

  private setCached<T>(key: string, payload: T): T {
    if (this.isDev) return payload;
    this.cache.set(key, { at: Date.now(), payload });
    return payload;
  }

  async getAnalyticsInsights(options?: { activityDays?: number; communityDays?: number; forceRefresh?: boolean }) {
    const activityDays = Math.max(1, Math.min(30, Number(options?.activityDays || 7)));
    const communityDays = Math.max(1, Math.min(90, Number(options?.communityDays || 30)));
    const forceRefresh = Boolean(options?.forceRefresh);
    const startedAt = Date.now();
    const cacheKey = `analytics-insights:${activityDays}:${communityDays}`;
    const cached = this.getCached<any>(cacheKey, forceRefresh);
    if (cached) return cached;

    const sinceCommunity = this.daysAgo(communityDays);
    const sinceActivity = this.daysAgo(activityDays);

    const [
      totalUsers,
      activeUsers7d,
      totalChallenges,
      publishedChallenges,
      challengesWithProgress,
      totalBattles,
      completedBattles,
      communityPosts30d,
      communityPosts,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ updatedAt: { $gte: sinceActivity }, status: true }),
      this.challengeModel.countDocuments(),
      this.challengeModel.countDocuments({ status: 'published' }),
      this.userModel.countDocuments({ challengeProgress: { $exists: true, $ne: [] } }),
      this.battleModel.countDocuments(),
      this.battleModel.countDocuments({ battleStatus: 'COMPLETED' }),
      this.communityPostModel.countDocuments({ createdAt: { $gte: sinceCommunity } }),
      this.communityPostModel.find({}, { comments: 1, createdAt: 1 }).lean().exec(),
    ]);

    let totalCommunityComments = 0;
    for (const post of communityPosts) {
      totalCommunityComments += this.countCommentsTree(post?.comments || []);
    }

    const challengeProgressAgg = await this.userModel.aggregate([
      { $unwind: '$challengeProgress' },
      {
        $group: {
          _id: null,
          totalProgressRecords: { $sum: 1 },
          solvedRecords: {
            $sum: {
              $cond: [{ $eq: ['$challengeProgress.status', 'SOLVED'] }, 1, 0],
            },
          },
          abandonedRecords: {
            $sum: {
              $cond: [{ $eq: ['$challengeProgress.attemptStatus', 'abandoned'] }, 1, 0],
            },
          },
          incompleteAttempts: { $sum: { $ifNull: ['$challengeProgress.incompleteAttemptCount', 0] } },
        },
      },
    ]);

    const progress = challengeProgressAgg?.[0] || {
      totalProgressRecords: 0,
      solvedRecords: 0,
      abandonedRecords: 0,
      incompleteAttempts: 0,
    };

    const solveRate = progress.totalProgressRecords > 0
      ? Number(((progress.solvedRecords / progress.totalProgressRecords) * 100).toFixed(2))
      : 0;

    const dropRate = progress.totalProgressRecords > 0
      ? Number(((progress.abandonedRecords / progress.totalProgressRecords) * 100).toFixed(2))
      : 0;

    const battleCompletionRate = totalBattles > 0
      ? Number(((completedBattles / totalBattles) * 100).toFixed(2))
      : 0;

    const engagementRate = totalUsers > 0
      ? Number(((activeUsers7d / totalUsers) * 100).toFixed(2))
      : 0;

    const recommendations: string[] = [];
    if (engagementRate < 35) {
      recommendations.push('Low weekly engagement: add targeted re-engagement notifications and daily streak incentives.');
    }
    if (dropRate > 25) {
      recommendations.push('High challenge drop-off: add progressive hints and clearer expected output examples.');
    }
    if (battleCompletionRate < 60) {
      recommendations.push('Battle completion is low: shorten default rounds/time and show quick-rematch CTA.');
    }
    if (totalCommunityComments < Math.max(10, communityPosts30d)) {
      recommendations.push('Community interaction is shallow: prompt first-comment nudges and highlight unanswered posts.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Core KPIs look healthy: run A/B tests on challenge onboarding to unlock additional growth.');
    }

    return this.setCached(cacheKey, {
      runId: this.makeRunId('analytics'),
      durationMs: Date.now() - startedAt,
      params: { activityDays, communityDays },
      metrics: {
        users: {
          totalUsers,
          activeUsers7d,
          engagementRate,
        },
        challenges: {
          totalChallenges,
          publishedChallenges,
          usersWithChallengeProgress: challengesWithProgress,
          solveRate,
          dropRate,
          incompleteAttempts: Number(progress.incompleteAttempts || 0),
        },
        battles: {
          totalBattles,
          completedBattles,
          battleCompletionRate,
        },
        community: {
          postsLast30Days: communityPosts30d,
          totalComments: totalCommunityComments,
        },
      },
      productActions: recommendations,
      generatedAt: new Date().toISOString(),
    });
  }

  private maskSecret(input: string): string {
    if (!input) return '';
    if (input.length <= 6) return '***';
    return `${input.slice(0, 2)}***${input.slice(-2)}`;
  }

  async runSecurityScan(options?: {
    minSeverity?: FindingSeverity;
    limit?: number;
    category?: string;
    forceRefresh?: boolean;
  }) {
    const minSeverity = (options?.minSeverity || 'low') as FindingSeverity;
    const findingsLimit = Math.max(1, Math.min(500, Number(options?.limit || 200)));
    const categoryFilter = String(options?.category || '').trim().toLowerCase();
    const forceRefresh = Boolean(options?.forceRefresh);
    const startedAt = Date.now();
    const cacheKey = `security-scan:${minSeverity}:${findingsLimit}:${categoryFilter || 'all'}`;
    const cached = this.getCached<any>(cacheKey, forceRefresh);
    if (cached) return cached;

    const backendRoot = this.getBackendRoot();
    const frontendRoot = this.getFrontendRoot();
    const findings: Array<{
      severity: FindingSeverity;
      category: string;
      file: string;
      line?: number;
      sample?: string;
      message: string;
      recommendation: string;
    }> = [];

    const envFiles = [
      path.join(backendRoot, '.env'),
      path.join(frontendRoot, '.env'),
    ];

    for (const envFile of envFiles) {
      try {
        const content = await fs.readFile(envFile, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const [rawKey, ...rest] = trimmed.split('=');
          const key = rawKey.trim();
          const value = rest.join('=').trim();
          const lowered = key.toLowerCase();

          if (/(secret|token|password|key)/i.test(key) && value) {
            if (value.length < 12) {
              findings.push({
                severity: 'high',
                category: 'env-weak-secret',
                file: envFile,
                message: `${key} appears too short (${this.maskSecret(value)}).`,
                recommendation: 'Use a random secret with at least 32 characters.',
              });
            }
            if (/^(123456|password|admin|test|changeme)$/i.test(value)) {
              findings.push({
                severity: 'high',
                category: 'env-default-secret',
                file: envFile,
                message: `${key} uses a weak/default-like value.`,
                recommendation: 'Replace with a strong, unique value and rotate immediately.',
              });
            }
          }

          if (lowered.includes('jwt') && lowered.includes('secret') && !value) {
            findings.push({
              severity: 'high',
              category: 'env-missing-jwt-secret',
              file: envFile,
              message: `${key} is empty.`,
              recommendation: 'Set a strong JWT secret before production deployment.',
            });
          }
        }
      } catch {
        findings.push({
          severity: 'medium',
          category: 'env-missing-file',
          file: envFile,
          message: 'Env file not found or unreadable.',
          recommendation: 'Ensure environment variables are managed securely (vault/secret manager).',
        });
      }
    }

    const scanRoots = [path.join(backendRoot, 'src'), path.join(frontendRoot, 'src')];

    let scannedFiles = 0;
    for (const root of scanRoots) {
      const files = await this.listFiles(root, new Set(['.ts', '.tsx', '.js', '.jsx']), 3000);
      for (const file of files) {
        scannedFiles += 1;
        let content = '';
        try {
          content = await fs.readFile(file, 'utf-8');
        } catch {
          continue;
        }
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          const lineNo = i + 1;
          const normalized = line.trim();
          if (!normalized || normalized.startsWith('//') || normalized.startsWith('*')) continue;

          // Avoid self-reporting rule definitions inside this scanner.
          if (file.endsWith(path.join('ai-agents', 'ai-agents.service.ts'))) {
            if (line.includes('dangerouslySetInnerHTML') || line.includes('eval\\s*\\(')) continue;
          }

          if (/\beval\s*\(/.test(line)) {
            findings.push({
              severity: 'high',
              category: 'unsafe-eval',
              file,
              line: lineNo,
              sample: normalized.slice(0, 180),
              message: 'Use of eval() detected.',
              recommendation: 'Remove eval and use safe parsing/execution alternatives.',
            });
          }

          if (/dangerouslySetInnerHTML/.test(line)) {
            findings.push({
              severity: 'high',
              category: 'unsafe-html-render',
              file,
              line: lineNo,
              sample: normalized.slice(0, 180),
              message: 'dangerouslySetInnerHTML detected.',
              recommendation: 'Sanitize HTML before rendering or avoid raw HTML rendering.',
            });
          }

          const insecureUrl = line.match(/["'`](http:\/\/[^"'`\s]+)["'`]/i)?.[1] || '';
          if (insecureUrl && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(insecureUrl)) {
            findings.push({
              severity: 'medium',
              category: 'insecure-http',
              file,
              line: lineNo,
              sample: insecureUrl,
              message: 'Insecure HTTP URL detected.',
              recommendation: 'Prefer HTTPS endpoints in production.',
            });
          }

          if (/localStorage\.setItem\(/.test(line) && /(token|secret|password|jwt|auth)/i.test(line)) {
            findings.push({
              severity: 'medium',
              category: 'sensitive-storage',
              file,
              line: lineNo,
              sample: normalized.slice(0, 180),
              message: 'Potential sensitive data stored in localStorage.',
              recommendation: 'Store sensitive auth data in HttpOnly secure cookies when possible.',
            });
          }
        }
      }
    }

    const filtered = findings.filter((item) => {
      if (categoryFilter && !item.category.toLowerCase().includes(categoryFilter)) return false;
      return this.severityWeight(item.severity) >= this.severityWeight(minSeverity);
    });

    const severityScore = filtered.reduce((acc, f) => {
      if (f.severity === 'high') return acc + 5;
      if (f.severity === 'medium') return acc + 2;
      return acc + 1;
    }, 0);

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (severityScore >= 20) riskLevel = 'high';
    else if (severityScore >= 8) riskLevel = 'medium';

    const deduped = filtered.filter((f, idx, arr) => {
      const key = `${f.category}|${f.file}|${f.line || 0}|${f.sample || ''}`;
      return arr.findIndex((x) => `${x.category}|${x.file}|${x.line || 0}|${x.sample || ''}` === key) === idx;
    }).slice(0, findingsLimit);

    return this.setCached(cacheKey, {
      runId: this.makeRunId('security'),
      durationMs: Date.now() - startedAt,
      filesScanned: scannedFiles,
      params: { minSeverity, limit: findingsLimit, category: categoryFilter || 'all' },
      riskLevel,
      findingsCount: deduped.length,
      findings: deduped,
      generatedAt: new Date().toISOString(),
    });
  }

  private toI18nKey(filePath: string, index: number): string {
    const normalized = filePath
      .replace(/\\/g, '/')
      .replace(/^.*\/src\//, '')
      .replace(/\.(jsx|tsx|js|ts)$/i, '')
      .split('/')
      .map((p) => p.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean)
      .map((p) => p.charAt(0).toLowerCase() + p.slice(1))
      .join('.');
    return `${normalized}.text${index}`;
  }

  async scanI18nHardcodedTexts(
    limit = 150,
    options?: { minConfidence?: number; pathContains?: string; forceRefresh?: boolean },
  ) {
    const minConfidence = Math.max(0, Math.min(1, Number(options?.minConfidence ?? 0)));
    const pathContains = String(options?.pathContains || '').trim().toLowerCase();
    const forceRefresh = Boolean(options?.forceRefresh);
    const startedAt = Date.now();
    const cacheKey = `i18n-scan:${limit}:${minConfidence}:${pathContains || 'all'}`;
    const cached = this.getCached<any>(cacheKey, forceRefresh);
    if (cached) return cached;

    const frontendRoot = this.getFrontendRoot();
    const srcRoot = path.join(frontendRoot, 'src');
    const files = await this.listFiles(srcRoot, new Set(['.jsx', '.tsx']), 3000);
    let scannedFiles = 0;
    const findings: Array<{
      file: string;
      text: string;
      suggestedKey: string;
      suggestion: {
        en: string;
        fr: string;
      };
      confidence: number;
    }> = [];

    const jsxTextRegex = />([^<>{\n]*[A-Za-zÀ-ÿ][^<>{\n]*)</g;
    const attrRegex = /\b(placeholder|label|title|aria-label)\s*=\s*"([^"{][^"]*[A-Za-zÀ-ÿ][^"]*)"/g;
    const noisyPatterns = [
      /^[<>=|&?:!()[\]{}0-9+\-*/.,'"` ]+$/,
      /[{}]/,
      /(=>|&&|\|\||===|!==|\bNumber\(|\bMath\.)/,
      /^\d+\s*\?\s*['"]/,
      /^O\([^)]+\)$/i,
      /^(JavaScript|Python|C\+\+|TypeScript)$/i,
    ];
    const isNoisy = (text: string) => noisyPatterns.some((p) => p.test(text));

    for (const file of files) {
      if (findings.length >= limit) break;
      scannedFiles += 1;
      let content = '';
      try {
        content = await fs.readFile(file, 'utf-8');
      } catch {
        continue;
      }

      let localIndex = 1;
      let match: RegExpExecArray | null = null;
      while ((match = jsxTextRegex.exec(content)) !== null && findings.length < limit) {
        const text = String(match[1] || '').trim();
        if (!text) continue;
        if (text.length < 3) continue;
        if (/^\W+$/.test(text)) continue;
        if (isNoisy(text)) continue;
        if (text.includes('t(') || text.includes('{{') || text.includes('}}')) continue;
        findings.push({
          file,
          text,
          suggestedKey: this.toI18nKey(file, localIndex++),
          suggestion: { en: text, fr: text },
          confidence: text.length > 8 ? 0.85 : 0.65,
        });
      }

      while ((match = attrRegex.exec(content)) !== null && findings.length < limit) {
        const text = String(match[2] || '').trim();
        if (!text) continue;
        if (text.length < 3) continue;
        if (isNoisy(text)) continue;
        if (text.includes('t(') || text.includes('{{') || text.includes('}}')) continue;
        findings.push({
          file,
          text,
          suggestedKey: this.toI18nKey(file, localIndex++),
          suggestion: { en: text, fr: text },
          confidence: text.length > 8 ? 0.9 : 0.7,
        });
      }
    }

    const filteredFindings = findings.filter((item) => {
      if (item.confidence < minConfidence) return false;
      if (pathContains && !item.file.toLowerCase().includes(pathContains)) return false;
      return true;
    });

    const groupedByFile = filteredFindings.reduce<Record<string, number>>((acc, item) => {
      acc[item.file] = (acc[item.file] || 0) + 1;
      return acc;
    }, {});

    return this.setCached(cacheKey, {
      runId: this.makeRunId('i18n'),
      durationMs: Date.now() - startedAt,
      filesScanned: scannedFiles,
      params: { limit, minConfidence, pathContains: pathContains || 'all' },
      totalFindings: filteredFindings.length,
      findings: filteredFindings.slice(0, limit),
      topFiles: Object.entries(groupedByFile)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([file, count]) => ({ file, count })),
      note: 'Auto-detected strings should be reviewed before applying.',
      generatedAt: new Date().toISOString(),
    });
  }

  private async buildLocalExecutiveBrief(i18nLimit = 120, forceRefresh = false) {
    const cacheKey = `executive-brief:${i18nLimit}:local`;
    const cached = this.getCached<any>(cacheKey, forceRefresh);
    if (cached) return cached;

    const [analytics, security, i18n] = await Promise.all([
      this.getAnalyticsInsights(),
      this.runSecurityScan(),
      this.scanI18nHardcodedTexts(i18nLimit),
    ]);

    const priorities: Array<{
      priority: 'P0' | 'P1' | 'P2';
      title: string;
      why: string;
      owner: 'Platform' | 'Security' | 'Frontend' | 'Product';
      etaDays: number;
    }> = [];

    if ((security?.riskLevel || 'low') === 'high') {
      priorities.push({
        priority: 'P0',
        title: 'Reduce high-risk security exposure',
        why: `${security.findingsCount || 0} findings detected with high overall risk.`,
        owner: 'Security',
        etaDays: 2,
      });
    }

    const engagementRate = Number(analytics?.metrics?.users?.engagementRate || 0);
    const battleCompletionRate = Number(analytics?.metrics?.battles?.battleCompletionRate || 0);
    if (engagementRate < 35 || battleCompletionRate < 60) {
      priorities.push({
        priority: 'P1',
        title: 'Lift engagement and battle completion',
        why: `Engagement ${engagementRate}% / battle completion ${battleCompletionRate}% indicate product friction.`,
        owner: 'Product',
        etaDays: 5,
      });
    }

    if ((i18n?.totalFindings || 0) > 0) {
      priorities.push({
        priority: 'P2',
        title: 'Complete i18n normalization backlog',
        why: `${i18n.totalFindings} hardcoded text candidates still pending translation keys.`,
        owner: 'Frontend',
        etaDays: 7,
      });
    }

    if (priorities.length === 0) {
      priorities.push({
        priority: 'P2',
        title: 'System stable, optimize experiments',
        why: 'No critical issue detected; focus on A/B tests and conversion improvements.',
        owner: 'Platform',
        etaDays: 7,
      });
    }

    const deliveryScore = Math.max(
      0,
      Math.min(
        100,
        100
          - (security?.riskLevel === 'high' ? 35 : security?.riskLevel === 'medium' ? 15 : 5)
          - Math.max(0, 35 - engagementRate) * 0.6
          - Math.min(20, (i18n?.totalFindings || 0) * 0.15),
      ),
    );

    return this.setCached(cacheKey, {
      aiAgent: 'executive-copilot',
      status: deliveryScore >= 75 ? 'healthy' : deliveryScore >= 50 ? 'watch' : 'critical',
      deliveryScore: Number(deliveryScore.toFixed(1)),
      summary: {
        securityRisk: security?.riskLevel || 'low',
        engagementRate,
        i18nBacklog: i18n?.totalFindings || 0,
      },
      priorities,
      generatedAt: new Date().toISOString(),
    });
  }

  private async callLlmProvider(
    provider: string,
    payload: { brief: any; analytics: any; security: any; i18n: any },
  ): Promise<{ providerUsed: string; narrative: string } | null> {
    const prompt = [
      'You are an enterprise AI operations copilot.',
      'Turn the JSON below into a concise executive brief with:',
      '1) One-paragraph summary',
      '2) Top 3 priorities with P0/P1/P2 labels',
      '3) Next 7 days action plan',
      'Reply in French.',
      JSON.stringify(payload),
    ].join('\n\n');

    const normalized = String(provider || 'auto').toLowerCase();
    const candidates = normalized === 'auto' ? ['grok', 'openai', 'groq', 'openrouter'] : [normalized];

    for (const candidate of candidates) {
      try {
        if (candidate === 'grok' && process.env.XAI_API_KEY) {
          const res = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.XAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.XAI_MODEL || 'grok-3-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2,
            }),
          });
          const json: any = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) return { providerUsed: 'grok', narrative: String(content) };
        }

        if (candidate === 'openai' && process.env.OPENAI_API_KEY) {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2,
            }),
          });
          const json: any = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) return { providerUsed: 'openai', narrative: String(content) };
        }

        if (candidate === 'groq' && process.env.GROQ_API_KEY) {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2,
            }),
          });
          const json: any = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) return { providerUsed: 'groq', narrative: String(content) };
        }

        if (candidate === 'openrouter' && process.env.OPENROUTER_API_KEY) {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2,
            }),
          });
          const json: any = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) return { providerUsed: 'openrouter', narrative: String(content) };
        }
      } catch {
        // Try next provider candidate
      }
    }
    return null;
  }

  async getExecutiveBrief(i18nLimit = 120, provider = 'auto', forceRefresh = false) {
    const localBrief = await this.buildLocalExecutiveBrief(i18nLimit, forceRefresh);
    const cacheKey = `executive-brief:${i18nLimit}:${provider}`;
    const cached = this.getCached<any>(cacheKey, forceRefresh);
    if (cached) return cached;

    const [analytics, security, i18n] = await Promise.all([
      this.getAnalyticsInsights(),
      this.runSecurityScan(),
      this.scanI18nHardcodedTexts(i18nLimit),
    ]);

    const llm = await this.callLlmProvider(provider, {
      brief: localBrief,
      analytics,
      security,
      i18n,
    });

    return this.setCached(cacheKey, {
      ...localBrief,
      providerRequested: provider,
      providerUsed: llm?.providerUsed || 'local-rules',
      narrative:
        llm?.narrative ||
        "Aucun provider IA externe n'est configuré. Résumé généré en mode local avec règles internes.",
    });
  }
}

