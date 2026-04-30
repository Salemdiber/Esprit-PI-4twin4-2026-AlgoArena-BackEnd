import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Output type returned by the FastAPI complexity model service.
 *
 * `confidence` is the temperature-calibrated probability the user sees on
 * screen (sharpened toward 1.0). `rawConfidence` is the unmodified
 * `predict_proba()` value and is what the gate logic should use — otherwise
 * calibration would mask genuine uncertainty and the safety net would never
 * fire.
 */
export interface MlComplexityPrediction {
  timeComplexity: string;
  spaceComplexity: string;
  label: string;
  confidence: number;
  rawConfidence: number;
  source: 'ml-model';
  modelVersion: string;
  /**
   * Identifier of the deciding component inside the model service:
   * - "rule:<name>" when a deterministic pattern rule fired
   *   (palindrome-expand-around-centers, sieve, ...)
   * - "model" when the trained XGBoost classifier produced the verdict
   * The frontend brands both as "AlgoArena CodeAnalyser"; this field
   * is for telemetry and the explanation tooltip.
   */
  method: string;
  /**
   * Short human-readable justification for the verdict, populated by
   * the rule layer. Empty for plain model predictions.
   */
  reasoning: string;
}

/**
 * Thin HTTP client that proxies submissions to the Python FastAPI
 * service hosting the trained XGBoost complexity model
 * (see Complexity-Model/service/app.py).
 *
 * Configuration:
 *   COMPLEXITY_MODEL_URL  default http://127.0.0.1:8088
 *   COMPLEXITY_MODEL_TIMEOUT_MS  default 4000
 *   COMPLEXITY_MODEL_MIN_CONFIDENCE  default 0.55  (below this, callers
 *     should treat the prediction as low-confidence and may fall back to
 *     the LLM-based estimate.)
 *
 * Failures (network, model not loaded, etc.) are swallowed: the service
 * returns null and the judge pipeline falls back to the existing AI
 * analysis path. We never want a model outage to break grading.
 */
@Injectable()
export class MlComplexityService {
  private readonly logger = new Logger(MlComplexityService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  readonly minConfidence: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('COMPLEXITY_MODEL_URL') ||
      'http://127.0.0.1:8088'
    ).replace(/\/+$/, '');
    this.timeoutMs = Number(
      this.config.get<string>('COMPLEXITY_MODEL_TIMEOUT_MS') || 4000,
    );
    // Threshold is checked against the **raw** model probability, not the
    // calibrated one. The default is intentionally permissive (0.30) so
    // the AlgoArena · CodeAnalyser card is shown for the vast majority of
    // submissions — that is the user-visible value of the model. The
    // safety net only kicks in when the model is genuinely lost (top
    // class < 30%), in which case the LLM is given a chance instead.
    // Operators who prefer a stricter gate can raise this via
    // COMPLEXITY_MODEL_MIN_CONFIDENCE (e.g. 0.60 for cautious display,
    // 0.85 for "only when very confident").
    this.minConfidence = Number(
      this.config.get<string>('COMPLEXITY_MODEL_MIN_CONFIDENCE') || 0.3,
    );
  }

  /**
   * Predict the time-complexity class of a code submission.
   * Returns null if the model service is unreachable or returns an error.
   */
  async predict(
    code: string,
    language: string,
    tags?: string[] | null,
  ): Promise<MlComplexityPrediction | null> {
    if (!code?.trim()) return null;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: (language || 'javascript').toLowerCase(),
          tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        this.logger.warn(
          `complexity model returned HTTP ${res.status}; falling back`,
        );
        return null;
      }

      const data = (await res.json()) as Partial<MlComplexityPrediction> & {
        confidence?: number;
      };

      if (!data?.timeComplexity || !data?.label) {
        this.logger.warn('complexity model returned malformed payload');
        return null;
      }

      return {
        timeComplexity: data.timeComplexity,
        spaceComplexity: data.spaceComplexity || 'O(1)',
        label: data.label,
        confidence: Number.isFinite(data.confidence)
          ? Number(data.confidence)
          : 0,
        // Older versions of the service didn't return rawConfidence; in
        // that case we fall back to the calibrated value so the gate
        // still has *some* signal to act on (slightly more lenient).
        rawConfidence: this.resolveRawConfidence(data),
        source: 'ml-model',
        modelVersion: data.modelVersion || 'AlgoArena · CodeAnalyser v1.0',
        method:
          typeof (data as any).method === 'string' && (data as any).method
            ? (data as any).method
            : 'model',
        reasoning:
          typeof (data as any).reasoning === 'string'
            ? (data as any).reasoning
            : '',
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        this.logger.warn(
          `complexity model timed out after ${this.timeoutMs}ms`,
        );
      } else {
        this.logger.warn(
          `complexity model unreachable: ${err?.message || err}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveRawConfidence(
    data: Partial<MlComplexityPrediction> & { confidence?: number },
  ): number {
    const rawConfidence = (data as any).rawConfidence;
    if (Number.isFinite(rawConfidence)) {
      return Number(rawConfidence);
    }

    const confidence = data.confidence;
    return Number.isFinite(confidence) ? Number(confidence) : 0;
  }
}
