import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Docker from 'dockerode';
import { Model } from 'mongoose';
import { isDeepEqual } from '../utils/comparison.util';
import {
  detectFunctionName,
  SupportedLanguage,
} from '../utils/function-detection.util';
import {
  parseExpectedOutput,
  parseInputArguments,
} from '../utils/input-parser.util';

export interface TestCase {
  input: unknown;
  expectedOutput: unknown;
}

interface PreparedTestCase {
  testCase: number;
  input: unknown;
  args: unknown[];
  expected: unknown;
}

interface ExecutionContext {
  challengeTitle?: string;
  challengeDescription?: string;
  challengeId?: string;
  userId?: string;
}

type ExecutionMode = 'default' | 'linked-list';

interface RawExecutionResult {
  testCase: number;
  input: unknown;
  output: unknown;
  error: string | null;
  executionTimeMs: number;
}

export interface ExecutionResult {
  testCase: number;
  input: unknown;
  expected: unknown;
  output: unknown;
  got: unknown;
  expectedOutput: unknown;
  actualOutput: unknown;
  passed: boolean;
  error: string | null;
  executionTimeMs: number;
  executionTime: string;
}

export interface DockerExecutionResponse {
  results: ExecutionResult[];
  error: { type: string; message: string; line: number | null } | null;
  executionTimeMs: number;
}

@Injectable()
export class DockerExecutionService implements OnModuleInit {
  private readonly logger = new Logger(DockerExecutionService.name);
  private readonly docker = new Docker();
  private readonly sandboxContainerPrefix = 'AlgoArenaSandbox';
  private readonly memoryLimitBytes = 128 * 1024 * 1024;
  private readonly cpuLimitNano = 500_000_000;
  private readonly timeoutMs = 3000;

  constructor(
    @InjectModel('SandboxMetric')
    private readonly sandboxMetricModel: Model<any>,
    private readonly i18n: I18nService,
  ) {}

  private tr(key: string, args?: Record<string, unknown>): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang, args });
  }

  async onModuleInit() {
    const available = await this.isDockerAvailable();
    if (available) {
      this.logger.log('Successfully connected to Docker daemon.');
      return;
    }

    this.logger.warn(
      'Docker daemon is unavailable. Judge sandbox features will return a service-unavailable error until Docker Desktop is running.',
    );
  }

  async executeCode(
    userCode: string,
    language: SupportedLanguage,
    testCases: TestCase[],
    context?: ExecutionContext,
  ): Promise<DockerExecutionResponse> {
    const startedAt = Date.now();
    if (!(await this.isDockerAvailable())) {
      return {
        results: [],
        executionTimeMs: Date.now() - startedAt,
        error: {
          type: 'ServiceUnavailable',
          message: this.tr('docker.unavailable'),
          line: null,
        },
      };
    }

    const functionName = detectFunctionName(userCode, language);
    const executionMode = this.determineExecutionMode(userCode, context);
    const expectedArity = this.detectFunctionArity(
      userCode,
      language,
      functionName || '',
    );
    const coerceNumericScalarsToStrings =
      this.shouldCoerceNumericScalarsToStrings(context, userCode);

    if (!functionName) {
      return {
        results: [],
        executionTimeMs: Date.now() - startedAt,
        error: {
          type: 'SyntaxError',
          message: this.tr('docker.noFunction'),
          line: null,
        },
      };
    }

    const prepared = this.prepareTestCases(
      testCases,
      executionMode,
      expectedArity,
      coerceNumericScalarsToStrings,
    );
    if (prepared.error) {
      return {
        results: [],
        executionTimeMs: Date.now() - startedAt,
        error: prepared.error,
      };
    }

    const image =
      language === 'javascript' ? 'node:18-alpine' : 'python:3.10-alpine';
    const scriptFileName =
      language === 'javascript' ? 'script.js' : 'script.py';
    const scriptContent =
      language === 'javascript'
        ? this.buildJavaScriptScript(
            userCode,
            functionName,
            prepared.data,
            executionMode,
          )
        : this.buildPythonScript(
            userCode,
            functionName,
            prepared.data,
            executionMode,
          );

    let tempDir: string | null = null;
    let container: Docker.Container | null = null;
    let stopStatsSampler: (() => void) | null = null;
    let statsSamplerPromise: Promise<{
      peakCpuPercent: number | null;
      peakMemoryMb: number | null;
      statsSamplesCount: number;
    }> | null = null;
    let samplerMerged = false;
    let snapshotMerged = false;
    let executionSucceeded = false;
    const metricRecord: any = {
      containerName: this.sandboxContainerPrefix,
      containerId: null,
      image,
      status: 'failed',
      startedAt: new Date(startedAt),
      stoppedAt: null,
      durationMs: 0,
      peakCpuPercent: null,
      peakMemoryMb: null,
      statsSamplesCount: 0,
      challengeId: context?.challengeId || null,
      userId: context?.userId || null,
    };

    try {
      await this.ensureImage(image);
      tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), `algoarena-${randomUUID()}-`),
      );
      await fs.writeFile(
        path.join(tempDir, scriptFileName),
        scriptContent,
        'utf8',
      );

      const containerName = `${this.sandboxContainerPrefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
      metricRecord.containerName = containerName;
      container = await this.docker.createContainer({
        Image: image,
        name: containerName,
        Cmd:
          language === 'javascript'
            ? ['node', `/workspace/${scriptFileName}`]
            : ['python', `/workspace/${scriptFileName}`],
        WorkingDir: '/workspace',
        HostConfig: {
          NetworkMode: 'none',
          Memory: this.memoryLimitBytes,
          NanoCpus: this.cpuLimitNano,
          PidsLimit: 64,
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges'],
          ReadonlyRootfs: true,
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=16m',
          },
          Binds: [`${tempDir}:/workspace:ro`],
          AutoRemove: false,
        },
      });

      await container!.start();
      metricRecord.startedAt = new Date();

      const sampling = this.startStatsSampler(container!);
      stopStatsSampler = sampling.stop;
      statsSamplerPromise = sampling.done;

      let timedOut = false;
      const timeoutHandle = setTimeout(async () => {
        timedOut = true;
        try {
          await container?.kill();
        } catch {
          // Ignore kill errors.
        }
      }, this.timeoutMs);

      const waitResult = await container!.wait();
      clearTimeout(timeoutHandle);

      if (stopStatsSampler) stopStatsSampler();
      if (statsSamplerPromise) {
        const sampled = await statsSamplerPromise.catch(() => null);
        if (sampled) {
          metricRecord.peakCpuPercent = sampled.peakCpuPercent;
          metricRecord.peakMemoryMb = sampled.peakMemoryMb;
          metricRecord.statsSamplesCount = Number(
            sampled.statsSamplesCount || 0,
          );
          samplerMerged = true;
        }
      }

      const finalSnapshot = await this.collectContainerStatsSnapshot(
        container!,
      );
      metricRecord.peakCpuPercent = this.maxNullable(
        metricRecord.peakCpuPercent,
        finalSnapshot.cpuPercent,
      );
      metricRecord.peakMemoryMb = this.maxNullable(
        metricRecord.peakMemoryMb,
        finalSnapshot.memoryMb,
      );
      metricRecord.statsSamplesCount =
        Number(metricRecord.statsSamplesCount || 0) +
        (finalSnapshot.hadSample ? 1 : 0);
      snapshotMerged = true;

      try {
        const inspect = await container!.inspect();
        metricRecord.containerId =
          (inspect?.Id || '').slice(0, 12) || metricRecord.containerId;
        metricRecord.image = inspect?.Config?.Image || metricRecord.image;
        if (inspect?.State?.StartedAt)
          metricRecord.startedAt = new Date(inspect.State.StartedAt);
        if (
          inspect?.State?.FinishedAt &&
          inspect.State.FinishedAt !== '0001-01-01T00:00:00Z'
        ) {
          metricRecord.stoppedAt = new Date(inspect.State.FinishedAt);
        }
      } catch {
        // Ignore inspect errors for rapidly exiting containers.
      }

      const logs = (await container!.logs({
        stdout: true,
        stderr: true,
      })) as unknown as Buffer;
      const { stdout, stderr } = this.demultiplexLogs(logs);

      if (timedOut) {
        return {
          results: [],
          executionTimeMs: Date.now() - startedAt,
          error: {
            type: 'TimeoutError',
            message: this.tr('docker.timeout', { ms: this.timeoutMs }),
            line: null,
          },
        };
      }

      if (waitResult.StatusCode !== 0) {
        return {
          results: [],
          executionTimeMs: Date.now() - startedAt,
          error: this.parseRuntimeError(stderr, language),
        };
      }

      const parsed = this.parseExecutionStdout(stdout);
      if (!parsed) {
        return {
          results: [],
          executionTimeMs: Date.now() - startedAt,
          error: {
            type: 'SystemError',
            message: this.tr('docker.unreadableResult'),
            line: null,
          },
        };
      }

      const resultByCase = new Map<number, RawExecutionResult>();
      for (const item of parsed.results) {
        resultByCase.set(item.testCase, item);
      }

      const normalizedResults: ExecutionResult[] = prepared.data.map(
        (testCase) => {
          const raw = resultByCase.get(testCase.testCase);
          if (!raw) {
            return {
              testCase: testCase.testCase,
              input: testCase.input,
              expected: testCase.expected,
              output: null,
              got: null,
              expectedOutput: testCase.expected,
              actualOutput: null,
              passed: false,
              error: this.tr('docker.noResultForCase'),
              executionTimeMs: 0,
              executionTime: '0ms',
            };
          }

          if (raw.error) {
            return {
              testCase: testCase.testCase,
              input: testCase.input,
              expected: testCase.expected,
              output: null,
              got: null,
              expectedOutput: testCase.expected,
              actualOutput: null,
              passed: false,
              error: raw.error,
              executionTimeMs: raw.executionTimeMs || 0,
              executionTime: `${raw.executionTimeMs || 0}ms`,
            };
          }

          const passed = isDeepEqual(raw.output, testCase.expected);
          return {
            testCase: testCase.testCase,
            input: testCase.input,
            expected: testCase.expected,
            output: raw.output,
            got: raw.output,
            expectedOutput: testCase.expected,
            actualOutput: raw.output,
            passed,
            error: null,
            executionTimeMs: raw.executionTimeMs || 0,
            executionTime: `${raw.executionTimeMs || 0}ms`,
          };
        },
      );

      executionSucceeded = true;
      metricRecord.status = 'success';
      return {
        results: normalizedResults,
        executionTimeMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error: any) {
      this.logger.error(
        `Execution pipeline failed: ${error?.message || 'Unknown error'}`,
      );
      return {
        results: [],
        executionTimeMs: Date.now() - startedAt,
        error: {
          type: 'ExecutionError',
          message: error?.message || this.tr('docker.unexpectedFailure'),
          line: null,
        },
      };
    } finally {
      if (stopStatsSampler) {
        stopStatsSampler();
      }
      if (statsSamplerPromise && !samplerMerged) {
        const sampled = await statsSamplerPromise.catch(() => null);
        if (sampled) {
          metricRecord.peakCpuPercent = this.maxNullable(
            metricRecord.peakCpuPercent,
            sampled.peakCpuPercent,
          );
          metricRecord.peakMemoryMb = this.maxNullable(
            metricRecord.peakMemoryMb,
            sampled.peakMemoryMb,
          );
          metricRecord.statsSamplesCount =
            Number(metricRecord.statsSamplesCount || 0) +
            Number(sampled.statsSamplesCount || 0);
        }
      }
      if (container && !snapshotMerged) {
        const finalSnapshot =
          await this.collectContainerStatsSnapshot(container);
        metricRecord.peakCpuPercent = this.maxNullable(
          metricRecord.peakCpuPercent,
          finalSnapshot.cpuPercent,
        );
        metricRecord.peakMemoryMb = this.maxNullable(
          metricRecord.peakMemoryMb,
          finalSnapshot.memoryMb,
        );
        metricRecord.statsSamplesCount =
          Number(metricRecord.statsSamplesCount || 0) +
          (finalSnapshot.hadSample ? 1 : 0);
      }
      if (container) {
        try {
          const inspect = await container.inspect();
          metricRecord.containerId =
            (inspect?.Id || '').slice(0, 12) || metricRecord.containerId;
          metricRecord.image = inspect?.Config?.Image || metricRecord.image;
          if (inspect?.State?.StartedAt)
            metricRecord.startedAt = new Date(inspect.State.StartedAt);
          if (
            inspect?.State?.FinishedAt &&
            inspect.State.FinishedAt !== '0001-01-01T00:00:00Z'
          ) {
            metricRecord.stoppedAt = new Date(inspect.State.FinishedAt);
          }
        } catch {
          // Ignore inspect errors.
        }
      }

      metricRecord.status = executionSucceeded ? 'success' : 'failed';
      metricRecord.stoppedAt = metricRecord.stoppedAt || new Date();
      const startedAtMs = new Date(
        metricRecord.startedAt || Date.now(),
      ).getTime();
      const stoppedAtMs = new Date(
        metricRecord.stoppedAt || Date.now(),
      ).getTime();
      metricRecord.durationMs = Number(Math.max(0, stoppedAtMs - startedAtMs));
      await this.persistSandboxMetric(metricRecord);

      const keepContainers = process.env.JUDGE_KEEP_CONTAINERS === 'true';
      if (container && !keepContainers) {
        try {
          await container.remove({ force: true });
        } catch {
          // Ignore cleanup errors.
        }
      }
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors.
        }
      }
    }
  }

  private prepareTestCases(
    testCases: TestCase[],
    executionMode: ExecutionMode,
    expectedArity: number | null,
    coerceNumericScalarsToStrings: boolean,
  ): {
    data: PreparedTestCase[];
    error: { type: string; message: string; line: number | null } | null;
  } {
    try {
      const prepared = testCases.map((testCase, index) => ({
        testCase: index + 1,
        input: testCase.input,
        args: this.normalizeArgumentsForArity(
          parseInputArguments(testCase.input),
          expectedArity,
          coerceNumericScalarsToStrings,
        ),
        expected: this.normalizeExpectedForMode(
          parseExpectedOutput(testCase.expectedOutput),
          executionMode,
          coerceNumericScalarsToStrings,
        ),
      }));
      return { data: prepared, error: null };
    } catch (error: any) {
      return {
        data: [],
        error: {
          type: 'InputParseError',
          message: error?.message || this.tr('docker.parseTestInput'),
          line: null,
        },
      };
    }
  }

  private normalizeExpectedForMode(
    expected: unknown,
    executionMode: ExecutionMode,
    coerceNumericScalarsToStrings: boolean,
  ): unknown {
    let coercedExpected = expected;
    if (coerceNumericScalarsToStrings) {
      if (typeof expected === 'number' && Number.isFinite(expected)) {
        coercedExpected = String(expected);
      } else if (Array.isArray(expected)) {
        coercedExpected = expected.map((item) =>
          typeof item === 'number' && Number.isFinite(item)
            ? String(item)
            : item,
        );
      }
    }

    if (executionMode !== 'linked-list') return coercedExpected;
    if (coercedExpected === null || coercedExpected === undefined)
      return coercedExpected;
    if (Array.isArray(coercedExpected)) return coercedExpected;
    return [coercedExpected];
  }

  private normalizeArgumentsForArity(
    args: unknown[],
    expectedArity: number | null,
    coerceNumericScalarsToStrings: boolean,
  ): unknown[] {
    const coerce = (value: unknown): unknown => {
      if (!coerceNumericScalarsToStrings) return value;
      if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
      return value;
    };

    const normalizedArgs = args.map((arg) => coerce(arg));
    if (
      !Number.isInteger(expectedArity) ||
      expectedArity === null ||
      expectedArity < 0
    ) {
      return normalizedArgs;
    }
    if (expectedArity === 0) return [];
    if (normalizedArgs.length === expectedArity) return normalizedArgs;
    if (normalizedArgs.length > expectedArity)
      return normalizedArgs.slice(0, expectedArity);
    if (normalizedArgs.length === 0) return new Array(expectedArity).fill(null);

    if (normalizedArgs.length === 1) {
      const only = normalizedArgs[0];
      if (Array.isArray(only) && only.length === expectedArity) {
        return only;
      }
      if (only && typeof only === 'object' && !Array.isArray(only)) {
        const values = Object.values(only as Record<string, unknown>);
        if (values.length >= expectedArity)
          return values.slice(0, expectedArity);
      }
      if (expectedArity === 2) {
        return [only, only];
      }
    }

    const padded = [...normalizedArgs];
    // Always guarantee we provide enough arguments if we know expectedArity
    if (expectedArity !== null && padded.length < expectedArity) {
      if (expectedArity === 2 && padded.length === 1) {
        padded.push(padded[0]); // fallback duplicate
      } else {
        while (padded.length < expectedArity) {
          padded.push(null);
        }
      }
    }
    return padded;
  }

  private shouldCoerceNumericScalarsToStrings(
    context?: ExecutionContext,
    userCode?: string,
  ): boolean {
    const combined =
      `${context?.challengeTitle ?? ''} ${context?.challengeDescription ?? ''}`.toLowerCase();
    const looksLikeStringAdditionChallenge =
      /without conversion/.test(combined) ||
      /strings representing integers/.test(combined) ||
      (/num1/.test(userCode ?? '') &&
        /num2/.test(userCode ?? '') &&
        /\.length/.test(userCode ?? ''));
    return looksLikeStringAdditionChallenge;
  }

  private detectFunctionArity(
    code: string,
    language: SupportedLanguage,
    functionName: string,
  ): number | null {
    if (!functionName) return null;
    const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (language === 'javascript') {
      const patterns = [
        new RegExp(`function\\s+${escaped}\\s*\\(([^)]*)\\)`),
        new RegExp(
          `(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?function\\s*\\(([^)]*)\\)`,
        ),
        new RegExp(
          `(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>`,
        ),
        new RegExp(
          `(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?([A-Za-z_$][\\w$]*)\\s*=>`,
        ),
      ];
      for (const pattern of patterns) {
        const match = code.match(pattern);
        if (!match) continue;
        const raw = (match[1] || '').trim();
        if (!raw) return 0;
        if (!raw.includes(',')) return 1;
        return raw.split(',').length;
      }
    } else {
      const match = code.match(
        new RegExp(`def\\s+${escaped}\\s*\\(([^)]*)\\)`),
      );
      if (match) {
        const raw = (match[1] || '').trim();
        if (!raw) return 0;
        return raw
          .split(',')
          .filter((item) => item && !item.trim().startsWith('*')).length;
      }
    }

    // Fallback: estimate arity from first line resembling function declaration
    const firstLineMatch = code.match(
      language === 'javascript'
        ? /function\s*\w*\s*\(([^)]*)\)/
        : /def\s+\w+\s*\(([^)]*)\)/,
    );
    if (firstLineMatch) {
      const raw = (firstLineMatch[1] || '').trim();
      return raw ? raw.split(',').length : 0;
    }

    return null;
  }

  private determineExecutionMode(
    userCode: string,
    context?: ExecutionContext,
  ): ExecutionMode {
    const combined =
      `${context?.challengeTitle ?? ''} ${context?.challengeDescription ?? ''}`.toLowerCase();
    const hasLinkedListPrompt = /\blinked\s*list\b/.test(combined);
    const usesNextPointer = /\.\s*next\b/.test(userCode);
    const likelyLinkedListFunction = /\breverse(list|linkedlist)\b/i.test(
      userCode,
    );
    return hasLinkedListPrompt || usesNextPointer || likelyLinkedListFunction
      ? 'linked-list'
      : 'default';
  }

  private buildJavaScriptScript(
    userCode: string,
    functionName: string,
    testCases: PreparedTestCase[],
    executionMode: ExecutionMode,
  ): string {
    const encodedCases = Buffer.from(
      JSON.stringify(
        testCases.map((testCase) => ({
          testCase: testCase.testCase,
          input: testCase.input,
          args: testCase.args,
        })),
      ),
      'utf8',
    ).toString('base64');

    return `
${userCode}

const __functionName = "${functionName}";
const __mode = "${executionMode}";
const __testCases = JSON.parse(Buffer.from("${encodedCases}", "base64").toString("utf8"));
const __targetFn = typeof ${functionName} === "function" ? ${functionName} : undefined;

function __isLinkedListNode(value) {
  return Boolean(value) && typeof value === "object" && "next" in value;
}

function __toScalar(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return trimmed;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? trimmed : parsed;
}

function __toLinkedList(value) {
  if (value === null || value === undefined) return null;
  if (__isLinkedListNode(value)) return value;

  let values = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string" && value.includes("->")) {
    values = value.split("->").map((part) => __toScalar(part)).filter((part) => part !== "");
  } else {
    values = [value];
  }

  if (values.length === 0) return null;
  const head = { val: values[0], data: values[0], next: null };
  let current = head;
  for (let i = 1; i < values.length; i += 1) {
    current.next = { val: values[i], data: values[i], next: null };
    current = current.next;
  }
  return head;
}

function __normalizeOutput(value) {
  if (__mode === "linked-list" && __isLinkedListNode(value)) {
    const output = [];
    const visited = new Set();
    let current = value;
    while (current && !visited.has(current) && output.length < 10000) {
      visited.add(current);
      if ("val" in current) output.push(current.val);
      else if ("data" in current) output.push(current.data);
      else output.push(null);
      current = current.next;
    }
    return output;
  }
  return value;
}

(async () => {
  if (typeof __targetFn !== "function") {
    throw new Error("Function '" + __functionName + "' is not defined.");
  }

  const results = [];
  for (const tc of __testCases) {
    const started = Date.now();
    try {
      const args = __mode === "linked-list" ? tc.args.map((arg) => __toLinkedList(arg)) : tc.args;
      const rawOutput = await Promise.resolve(__targetFn(...args));
      const output = __normalizeOutput(rawOutput);
      results.push({
        testCase: tc.testCase,
        input: tc.input,
        output: output,
        error: null,
        executionTimeMs: Date.now() - started
      });
    } catch (error) {
      results.push({
        testCase: tc.testCase,
        input: tc.input,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - started
      });
    }
  }

  console.log(JSON.stringify({ results }));
})().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
`;
  }

  private buildPythonScript(
    userCode: string,
    functionName: string,
    testCases: PreparedTestCase[],
    executionMode: ExecutionMode,
  ): string {
    const encodedCases = Buffer.from(
      JSON.stringify(
        testCases.map((testCase) => ({
          testCase: testCase.testCase,
          input: testCase.input,
          args: testCase.args,
        })),
      ),
      'utf8',
    ).toString('base64');

    return `
import base64
import json
import time
import traceback

${userCode}

FUNCTION_NAME = "${functionName}"
MODE = "${executionMode}"
TEST_CASES = json.loads(base64.b64decode("${encodedCases}").decode("utf-8"))
target_fn = globals().get(FUNCTION_NAME)

class __AlgoArenaNode:
    def __init__(self, value):
        self.val = value
        self.data = value
        self.next = None

def __is_node(value):
    return value is not None and hasattr(value, "next")

def __parse_scalar(token):
    token = str(token).strip()
    if token == "":
        return token
    try:
        return int(token)
    except ValueError:
        try:
            return float(token)
        except ValueError:
            return token.strip("'").strip('"')

def __to_linked_list(value):
    if value is None:
        return None
    if __is_node(value):
        return value

    if isinstance(value, (list, tuple)):
        values = list(value)
    elif isinstance(value, str) and "->" in value:
        values = [__parse_scalar(part) for part in value.split("->") if part.strip() != ""]
    else:
        values = [value]

    if len(values) == 0:
        return None

    head = __AlgoArenaNode(values[0])
    current = head
    for item in values[1:]:
        current.next = __AlgoArenaNode(item)
        current = current.next
    return head

def __normalize_output(value):
    if MODE == "linked-list" and __is_node(value):
        items = []
        visited = set()
        current = value
        while current is not None and id(current) not in visited and len(items) < 10000:
            visited.add(id(current))
            if hasattr(current, "val"):
                items.append(current.val)
            elif hasattr(current, "data"):
                items.append(current.data)
            else:
                items.append(None)
            current = current.next
        return items
    return value

if not callable(target_fn):
    raise NameError(f"Function '{FUNCTION_NAME}' is not defined.")

results = []
for tc in TEST_CASES:
    started = time.perf_counter()
    try:
        args = [__to_linked_list(arg) for arg in tc["args"]] if MODE == "linked-list" else tc["args"]
        raw_output = target_fn(*args)
        output = __normalize_output(raw_output)
        elapsed = int((time.perf_counter() - started) * 1000)
        results.append({
            "testCase": tc["testCase"],
            "input": tc["input"],
            "output": output,
            "error": None,
            "executionTimeMs": elapsed
        })
    except Exception as exc:
        elapsed = int((time.perf_counter() - started) * 1000)
        results.append({
            "testCase": tc["testCase"],
            "input": tc["input"],
            "output": None,
            "error": str(exc),
            "executionTimeMs": elapsed
        })

print(json.dumps({"results": results}, default=str))
`;
  }

  private async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (pullError, stream) => {
          if (pullError || !stream) {
            reject(pullError || new Error(`Unable to pull image ${image}`));
            return;
          }
          this.docker.modem.followProgress(stream, (followError) => {
            if (followError) reject(followError);
            else resolve();
          });
        });
      });
    }
  }

  private demultiplexLogs(logs: Buffer): { stdout: string; stderr: string } {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let offset = 0;

    while (offset + 8 <= logs.length) {
      const streamType = logs.readUInt8(offset);
      const chunkLength = logs.readUInt32BE(offset + 4);
      const chunkStart = offset + 8;
      const chunkEnd = chunkStart + chunkLength;

      if (chunkEnd > logs.length) break;

      const payload = logs.subarray(chunkStart, chunkEnd);
      if (streamType === 1) stdoutChunks.push(payload);
      if (streamType === 2) stderrChunks.push(payload);
      offset = chunkEnd;
    }

    return {
      stdout: Buffer.concat(stdoutChunks).toString('utf8'),
      stderr: Buffer.concat(stderrChunks).toString('utf8'),
    };
  }

  private parseExecutionStdout(
    stdout: string,
  ): { results: RawExecutionResult[] } | null {
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        const payload = JSON.parse(lines[i]) as {
          results?: RawExecutionResult[];
        };
        if (Array.isArray(payload.results)) {
          return { results: payload.results };
        }
      } catch {
        // Try previous line.
      }
    }

    return null;
  }

  private parseRuntimeError(
    stderr: string,
    language: SupportedLanguage,
  ): { type: string; message: string; line: number | null } {
    const output = stderr?.trim() || 'Runtime error';
    let type = 'RuntimeError';
    let message = output;
    let line: number | null = null;

    if (language === 'javascript') {
      const typeMatch = output.match(/([A-Za-z]+Error):/);
      if (typeMatch) type = typeMatch[1];
      const messageMatch = output.match(/(?:[A-Za-z]+Error:\s*)(.+)/);
      if (messageMatch) message = messageMatch[1];
      const lineMatch = output.match(/\/workspace\/script\.js:(\d+):\d+/);
      if (lineMatch) line = Number(lineMatch[1]);
    } else {
      const lines = output.split(/\r?\n/);
      const lastLine = lines[lines.length - 1] || '';
      const typeMatch = lastLine.match(/^([A-Za-z_]\w*):/);
      if (typeMatch) type = typeMatch[1];
      const messageMatch = lastLine.match(/^[A-Za-z_]\w*:\s*(.+)$/);
      if (messageMatch) message = messageMatch[1];
      const lineMatch = output.match(/line\s+(\d+)/);
      if (lineMatch) line = Number(lineMatch[1]);
    }

    return { type, message, line };
  }

  private calculateCpuPercent(stats: any): number {
    const cpuDelta =
      (stats?.cpu_stats?.cpu_usage?.total_usage || 0) -
      (stats?.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta =
      (stats?.cpu_stats?.system_cpu_usage || 0) -
      (stats?.precpu_stats?.system_cpu_usage || 0);
    const onlineCpus = stats?.cpu_stats?.online_cpus || 1;
    if (cpuDelta > 0 && systemDelta > 0) {
      return Number(((cpuDelta / systemDelta) * onlineCpus * 100).toFixed(2));
    }
    return 0;
  }

  private startStatsSampler(container: Docker.Container): {
    stop: () => void;
    done: Promise<{
      peakCpuPercent: number | null;
      peakMemoryMb: number | null;
      statsSamplesCount: number;
    }>;
  } {
    let active = true;
    const done = (async () => {
      let peakCpuPercent: number | null = null;
      let peakMemoryMb: number | null = null;
      let statsSamplesCount = 0;
      while (active) {
        try {
          const stats: any = await container.stats({ stream: false });
          const cpuPercent = this.calculateCpuPercent(stats);
          const memoryUsageBytes = Number(stats?.memory_stats?.usage || 0);
          const memoryMaxUsageBytes = Number(
            stats?.memory_stats?.max_usage || 0,
          );
          const memoryUsageMb =
            Math.max(memoryUsageBytes, memoryMaxUsageBytes) / (1024 * 1024);
          peakCpuPercent = this.maxNullable(
            peakCpuPercent,
            cpuPercent > 0 ? cpuPercent : null,
          );
          peakMemoryMb = this.maxNullable(
            peakMemoryMb,
            memoryUsageMb > 0 ? memoryUsageMb : null,
          );
          if (cpuPercent > 0 || memoryUsageMb > 0) {
            statsSamplesCount += 1;
          }
        } catch {
          // Container may exit before the next sample.
          active = false;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return {
        peakCpuPercent:
          peakCpuPercent != null ? Number(peakCpuPercent.toFixed(2)) : null,
        peakMemoryMb:
          peakMemoryMb != null ? Number(peakMemoryMb.toFixed(2)) : null,
        statsSamplesCount,
      };
    })();

    return {
      stop: () => {
        active = false;
      },
      done,
    };
  }

  private maxNullable(
    current: number | null,
    next: number | null,
  ): number | null {
    if (next == null || Number.isNaN(Number(next))) return current;
    if (current == null || Number.isNaN(Number(current))) return Number(next);
    return Number(Math.max(Number(current), Number(next)).toFixed(2));
  }

  private async collectContainerStatsSnapshot(
    container: Docker.Container,
  ): Promise<{
    cpuPercent: number | null;
    memoryMb: number | null;
    hadSample: boolean;
  }> {
    try {
      const stats: any = await container.stats({ stream: false });
      const cpuPercentRaw = this.calculateCpuPercent(stats);
      const cpuPercent =
        cpuPercentRaw > 0 ? Number(cpuPercentRaw.toFixed(2)) : null;
      const usage = Number(stats?.memory_stats?.usage || 0);
      const maxUsage = Number(stats?.memory_stats?.max_usage || 0);
      const memoryBytes = Math.max(usage, maxUsage);
      const memoryMb =
        memoryBytes > 0
          ? Number((memoryBytes / (1024 * 1024)).toFixed(2))
          : null;
      return {
        cpuPercent,
        memoryMb,
        hadSample: cpuPercent != null || memoryMb != null,
      };
    } catch {
      return { cpuPercent: null, memoryMb: null, hadSample: false };
    }
  }

  private async persistSandboxMetric(metricRecord: any): Promise<void> {
    try {
      const payload = {
        containerName:
          metricRecord.containerName || this.sandboxContainerPrefix,
        containerId: metricRecord.containerId || null,
        image: metricRecord.image || null,
        status: metricRecord.status === 'success' ? 'success' : 'failed',
        startedAt: metricRecord.startedAt || new Date(),
        stoppedAt: metricRecord.stoppedAt || new Date(),
        durationMs: Number(metricRecord.durationMs || 0),
        peakCpuPercent:
          metricRecord.peakCpuPercent == null ||
          Number.isNaN(Number(metricRecord.peakCpuPercent))
            ? null
            : Number(metricRecord.peakCpuPercent),
        peakMemoryMb:
          metricRecord.peakMemoryMb == null ||
          Number.isNaN(Number(metricRecord.peakMemoryMb))
            ? null
            : Number(metricRecord.peakMemoryMb),
        statsSamplesCount: Number(metricRecord.statsSamplesCount || 0),
        challengeId: metricRecord.challengeId || null,
        userId: metricRecord.userId || null,
      };
      await this.sandboxMetricModel.create(payload);
    } catch (error: any) {
      this.logger.warn(
        `Failed to persist sandbox metric: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  private deriveHealth(
    successRate: number | null,
    totalExecutions: number,
  ): 'healthy' | 'degraded' | 'unhealthy' | 'no_data' {
    if (!totalExecutions || successRate === null) return 'no_data';
    if (successRate > 90) return 'healthy';
    if (successRate >= 50) return 'degraded';
    return 'unhealthy';
  }

  private async getLiveSandboxData(): Promise<{
    status: 'executing' | 'starting' | 'idle';
    state: string;
    containerId: string | null;
    image: string | null;
    uptimeMs: number | null;
    runningSince: string | null;
    cpuUsagePercent: number | null;
    memoryUsageBytes: number | null;
    memoryLimitBytes: number | null;
  }> {
    if (!(await this.isDockerAvailable())) {
      return {
        status: 'idle',
        state: 'unreachable',
        containerId: null,
        image: null,
        uptimeMs: null,
        runningSince: null,
        cpuUsagePercent: null,
        memoryUsageBytes: null,
        memoryLimitBytes: null,
      };
    }

    try {
      const containers = await this.docker.listContainers({ all: true });
      const sandboxContainers = containers
        .filter((container) =>
          (container.Names || []).some((name) =>
            name.includes(this.sandboxContainerPrefix),
          ),
        )
        .sort((a, b) => (b.Created || 0) - (a.Created || 0));

      if (sandboxContainers.length === 0) {
        return {
          status: 'idle',
          state: 'not_found',
          containerId: null,
          image: null,
          uptimeMs: null,
          runningSince: null,
          cpuUsagePercent: null,
          memoryUsageBytes: null,
          memoryLimitBytes: null,
        };
      }

      const latest = sandboxContainers[0];
      const container = this.docker.getContainer(latest.Id);
      const inspect = await container.inspect();
      const isRunning = inspect?.State?.Running === true;
      const isStarting = ['created', 'restarting'].includes(
        inspect?.State?.Status,
      );

      let cpuUsagePercent: number | null = null;
      let memoryUsageBytes: number | null = null;
      let memoryLimitBytes: number | null = null;
      if (isRunning) {
        try {
          const stats: any = await container.stats({ stream: false });
          cpuUsagePercent = this.calculateCpuPercent(stats);
          memoryUsageBytes = Number(stats?.memory_stats?.usage || 0);
          memoryLimitBytes = Number(stats?.memory_stats?.limit || 0);
        } catch {
          // Ignore stats failures for rapidly finishing containers.
        }
      }

      return {
        status: isRunning ? 'executing' : isStarting ? 'starting' : 'idle',
        state: inspect?.State?.Status || 'unknown',
        containerId: latest.Id?.slice(0, 12) || null,
        image: latest.Image || inspect?.Config?.Image || null,
        uptimeMs:
          isRunning && inspect?.State?.StartedAt
            ? Date.now() - new Date(inspect.State.StartedAt).getTime()
            : null,
        runningSince: inspect?.State?.StartedAt || null,
        cpuUsagePercent,
        memoryUsageBytes,
        memoryLimitBytes,
      };
    } catch (error: any) {
      this.logger.warn(
        `Live sandbox inspection unavailable: ${error?.message || 'Unknown error'}`,
      );
      return {
        status: 'idle',
        state: 'unreachable',
        containerId: null,
        image: null,
        uptimeMs: null,
        runningSince: null,
        cpuUsagePercent: null,
        memoryUsageBytes: null,
        memoryLimitBytes: null,
      };
    }
  }

  async getSandboxStatus() {
    try {
      const live = await this.getLiveSandboxData();
      const [
        latestMetricRaw,
        totalExecutions,
        successfulExecutions,
        recentMetricsRaw,
        peakAggRaw,
      ] = await Promise.all([
        this.sandboxMetricModel.findOne().sort({ createdAt: -1 }).lean().exec(),
        this.sandboxMetricModel.countDocuments().exec(),
        this.sandboxMetricModel.countDocuments({ status: 'success' }).exec(),
        this.sandboxMetricModel
          .find({ statsSamplesCount: { $gt: 0 } })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()
          .exec(),
        this.sandboxMetricModel
          .aggregate([
            { $match: { statsSamplesCount: { $gt: 0 } } },
            {
              $group: {
                _id: null,
                peakCpuPercent: { $max: '$peakCpuPercent' },
                peakMemoryMb: { $max: '$peakMemoryMb' },
              },
            },
          ])
          .exec(),
      ]);
      const latestMetric: any = latestMetricRaw || null;
      const recentMetrics: any[] = Array.isArray(recentMetricsRaw)
        ? recentMetricsRaw
        : [];
      const peakAgg: any[] = Array.isArray(peakAggRaw) ? peakAggRaw : [];

      const failedExecutions = Math.max(
        0,
        totalExecutions - successfulExecutions,
      );
      const successRate =
        totalExecutions > 0
          ? Number(((successfulExecutions / totalExecutions) * 100).toFixed(2))
          : null;
      const cpuSamples = recentMetrics
        .map((row: any) => Number(row?.peakCpuPercent))
        .filter((value: number) => Number.isFinite(value) && value > 0);
      const memorySamples = recentMetrics
        .map((row: any) => Number(row?.peakMemoryMb))
        .filter((value: number) => Number.isFinite(value) && value > 0);
      const avgCpuPercent =
        cpuSamples.length > 0
          ? Number(
              (
                cpuSamples.reduce(
                  (sum: number, value: number) => sum + value,
                  0,
                ) / cpuSamples.length
              ).toFixed(2),
            )
          : null;
      const avgMemoryMb =
        memorySamples.length > 0
          ? Number(
              (
                memorySamples.reduce(
                  (sum: number, value: number) => sum + value,
                  0,
                ) / memorySamples.length
              ).toFixed(2),
            )
          : null;
      const peakCpuPercent =
        peakAgg?.[0]?.peakCpuPercent != null
          ? Number(peakAgg[0].peakCpuPercent)
          : null;
      const peakMemoryMb =
        peakAgg?.[0]?.peakMemoryMb != null
          ? Number(peakAgg[0].peakMemoryMb)
          : null;

      const health = this.deriveHealth(successRate, totalExecutions);
      const containerId = live.containerId || latestMetric?.containerId || null;
      const image = live.image || latestMetric?.image || null;
      const lastUptimeMs =
        latestMetric?.durationMs != null
          ? Number(latestMetric.durationMs)
          : null;
      const now = new Date();

      return {
        containerName: this.sandboxContainerPrefix,
        status: live.status,
        state: live.state,
        containerId,
        image,
        uptime: live.status === 'executing' ? live.uptimeMs : lastUptimeMs,
        lastUptimeMs,
        runningSince: live.runningSince,
        cpuUsagePercent: live.cpuUsagePercent,
        memoryUsage: live.memoryUsageBytes,
        memoryLimit: live.memoryLimitBytes,
        memoryUsageDisplay:
          live.memoryUsageBytes && live.memoryLimitBytes
            ? `${(live.memoryUsageBytes / (1024 * 1024)).toFixed(1)} MB / ${(live.memoryLimitBytes / (1024 * 1024)).toFixed(1)} MB`
            : avgMemoryMb != null
              ? `${avgMemoryMb.toFixed(1)} MB avg`
              : totalExecutions > 0
                ? 'No samples yet'
                : 'No executions yet',
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate,
        avgCpuPercent,
        peakCpuPercent,
        avgMemoryMb,
        peakMemoryMb,
        lastExecutionAt:
          latestMetric?.stoppedAt || latestMetric?.createdAt || null,
        health,
        healthLabel:
          health === 'healthy'
            ? 'Healthy'
            : health === 'degraded'
              ? 'Degraded'
              : health === 'unhealthy'
                ? 'Unhealthy'
                : 'No Data',
        hasData: totalExecutions > 0,
        lastUpdatedAt: now.toISOString(),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to build sandbox status payload: ${error?.message || 'Unknown error'}`,
      );
      const now = new Date().toISOString();
      return {
        containerName: this.sandboxContainerPrefix,
        status: 'idle',
        state: 'unreachable',
        containerId: null,
        image: null,
        uptime: null,
        lastUptimeMs: null,
        runningSince: null,
        cpuUsagePercent: null,
        memoryUsage: null,
        memoryLimit: null,
        memoryUsageDisplay: 'No executions yet',
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: null,
        avgCpuPercent: null,
        peakCpuPercent: null,
        avgMemoryMb: null,
        peakMemoryMb: null,
        lastExecutionAt: null,
        health: 'no_data',
        healthLabel: 'No Data',
        hasData: false,
        lastUpdatedAt: now,
      };
    }
  }

  private async isDockerAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }
}
