import type * as FaceApiTypes from '@vladmandic/face-api';
import { ExpressionCategory, ExpressionScores } from '../types';

export interface ExpressionInferenceResult {
  success: boolean;
  faceDetected: boolean;
  dominantExpression: ExpressionCategory | null;
  confidence: number; // Dominant model output score (0.0 - 1.0)
  scores: ExpressionScores;
  faceBox?: { x: number; y: number; width: number; height: number };
  modelName: string;
  error?: string;
}

export type ModelLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

let faceapiModule: typeof FaceApiTypes | null = null;

async function getFaceApi(): Promise<typeof FaceApiTypes | null> {
  if (faceapiModule) return faceapiModule;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  try {
    const mod = await import('@vladmandic/face-api/dist/face-api.esm.js');
    faceapiModule = (mod as any).default || mod;
    return faceapiModule;
  } catch (err) {
    console.warn('[ExpressionModelService] Failed to load face-api browser bundle:', err);
    return null;
  }
}

class ExpressionModelService {
  private loadStatus: ModelLoadStatus = 'idle';
  private loadError: string | null = null;
  private loadPromise: Promise<boolean> | null = null;
  private readonly modelBaseUrl = '/models';
  public readonly modelName = 'FaceExpressionNet (MobileNetV1/Separable FER)';

  /**
   * Returns current status of the model loader.
   */
  getStatus(): { status: ModelLoadStatus; error: string | null } {
    return {
      status: this.loadStatus,
      error: this.loadError,
    };
  }

  /**
   * Initializes and loads the local models from the public /models directory.
   * Singleton pattern ensures models are loaded only once and reused across sessions.
   */
  async loadModels(): Promise<boolean> {
    if (this.loadStatus === 'loaded') {
      return true;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    const faceapi = await getFaceApi();
    if (!faceapi) {
      this.loadStatus = 'error';
      this.loadError = 'Browser DOM environment is required for TensorFlow.js WebGL/Canvas inference.';
      return false;
    }

    this.loadStatus = 'loading';
    this.loadError = null;

    this.loadPromise = (async () => {
      try {
        console.log('[ExpressionModelService] Loading face detection and expression models from:', this.modelBaseUrl);

        // Load both tiny face detector and face expression net in parallel
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(this.modelBaseUrl),
          faceapi.nets.faceExpressionNet.loadFromUri(this.modelBaseUrl),
        ]);

        this.loadStatus = 'loaded';
        this.loadError = null;
        console.log('[ExpressionModelService] Models initialized successfully.');
        return true;
      } catch (err: any) {
        this.loadStatus = 'error';
        this.loadError = err?.message || 'Failed to load local model files.';
        console.error('[ExpressionModelService] Error loading models:', err);
        return false;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Classifies facial expression from an HTMLImageElement, HTMLCanvasElement, or HTMLVideoElement.
   * Runs local client-side neural inference via WebGL/WASM/CPU.
   */
  async classify(
    input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ): Promise<ExpressionInferenceResult> {
    const emptyScores: ExpressionScores = {
      neutral: 0,
      happy: 0,
      sad: 0,
      angry: 0,
      fearful: 0,
      disgusted: 0,
      surprised: 0,
    };

    const isReady = await this.loadModels();
    const faceapi = await getFaceApi();
    if (!isReady || !faceapi) {
      return {
        success: false,
        faceDetected: false,
        dominantExpression: null,
        confidence: 0,
        scores: emptyScores,
        modelName: this.modelName,
        error: this.loadError || 'Model is not loaded.',
      };
    }

    try {
      // 1. Detect single face using TinyFaceDetector
      const detectorOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.35,
      });

      const detection = await faceapi
        .detectSingleFace(input, detectorOptions)
        .withFaceExpressions();

      if (!detection) {
        return {
          success: true,
          faceDetected: false,
          dominantExpression: null,
          confidence: 0,
          scores: emptyScores,
          modelName: this.modelName,
        };
      }

      // 2. Extract expression scores mapping
      const rawExpressions = detection.expressions as unknown as Record<string, number>;
      const scores: ExpressionScores = {
        neutral: Number((rawExpressions.neutral || 0).toFixed(4)),
        happy: Number((rawExpressions.happy || 0).toFixed(4)),
        sad: Number((rawExpressions.sad || 0).toFixed(4)),
        angry: Number((rawExpressions.angry || 0).toFixed(4)),
        fearful: Number((rawExpressions.fearful || 0).toFixed(4)),
        disgusted: Number((rawExpressions.disgusted || 0).toFixed(4)),
        surprised: Number((rawExpressions.surprised || 0).toFixed(4)),
      };

      // 3. Find dominant expression category
      let dominant: ExpressionCategory = 'neutral';
      let maxScore = -1;

      for (const [expr, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          dominant = expr as ExpressionCategory;
        }
      }

      const box = detection.detection.box;

      return {
        success: true,
        faceDetected: true,
        dominantExpression: dominant,
        confidence: Number(maxScore.toFixed(3)),
        scores,
        faceBox: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        modelName: this.modelName,
      };
    } catch (inferErr: any) {
      console.error('[ExpressionModelService] Inference failed:', inferErr);
      return {
        success: false,
        faceDetected: false,
        dominantExpression: null,
        confidence: 0,
        scores: emptyScores,
        modelName: this.modelName,
        error: inferErr?.message || 'Face expression inference failed.',
      };
    }
  }

  /**
   * Helper to format expression category to a respectful, non-clinical user-facing label.
   */
  formatCategoryLabel(category: ExpressionCategory | null): string {
    switch (category) {
      case 'happy':
        return 'Smiling / Pleasant visual expression';
      case 'sad':
        return 'Subdued / Downcast visual expression';
      case 'surprised':
        return 'Surprised / Wide visual expression';
      case 'angry':
        return 'Firm / Intense visual expression';
      case 'fearful':
        return 'Tense / Apprehensive visual expression';
      case 'disgusted':
        return 'Aversive / Wrinkled visual expression';
      case 'neutral':
        return 'Neutral / Steady visual expression';
      default:
        return 'Unable to estimate reliably';
    }
  }
}

export const expressionModelService = new ExpressionModelService();
