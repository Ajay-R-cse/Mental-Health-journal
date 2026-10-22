import { CameraAnalysisResult, CameraExpressionType } from '../types';

/**
 * Local in-browser camera expression analyzer.
 * 
 * Strict Privacy & Wellness Rules:
 * - 100% Client-side processing inside the browser canvas.
 * - Zero biometric identification or face recognition.
 * - Raw video and frames are never saved, persisted, or uploaded to any server.
 * - Classifies only broad observable expression categories.
 * - Always accompanied by medical disclaimers.
 */

export interface FrameAnalysisData {
  brightness: number;
  contrast: number;
  symmetry: number;
  lowerFaceCurvature: number; // smile / pleasant indicator
  upperFaceTension: number;   // brow furrow / concerned indicator
  eyeRegionEnergy: number;    // openness vs drooping
}

export function analyzeCanvasFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): CameraAnalysisResult {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas context could not be initialized.');
  }

  // Set canvas to manageable resolution for local raster analysis
  const width = 320;
  const height = 240;
  canvas.width = width;
  canvas.height = height;

  // Draw current video frame to canvas
  ctx.drawImage(video, 0, 0, width, height);

  // Extract pixel data for mathematical optical analysis
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let totalLuminance = 0;
  let luminanceVariance = 0;
  const grayscale = new Float32Array(width * height);

  // 1. Grayscale & overall lighting computation
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const pixelIdx = i / 4;
    grayscale[pixelIdx] = lum;
    totalLuminance += lum;
  }
  const meanLum = totalLuminance / (width * height);

  for (let i = 0; i < grayscale.length; i++) {
    luminanceVariance += Math.pow(grayscale[i] - meanLum, 2);
  }
  const contrast = Math.sqrt(luminanceVariance / grayscale.length);

  // 2. Structural zone partitioning (Center 60% of frame where face sits)
  const xStart = Math.floor(width * 0.2);
  const xEnd = Math.floor(width * 0.8);
  const yStart = Math.floor(height * 0.15);
  const yEnd = Math.floor(height * 0.85);

  const regionW = xEnd - xStart;
  const regionH = yEnd - yStart;

  // Upper face: Eyebrows / forehead (y: 15% - 40%)
  // Mid face: Eyes & bridge of nose (y: 40% - 60%)
  // Lower face: Mouth & jawline (y: 60% - 85%)
  let upperGradient = 0;
  let lowerGradient = 0;
  let leftVsRightDiff = 0;
  let samplesCount = 0;

  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
      const idx = y * width + x;
      const current = grayscale[idx];

      // Horizontal edge detection
      const right = x + 2 < xEnd ? grayscale[y * width + (x + 2)] : current;
      // Vertical edge detection
      const bottom = y + 2 < yEnd ? grayscale[(y + 2) * width + x] : current;

      const grad = Math.abs(current - right) + Math.abs(current - bottom);

      const relY = (y - yStart) / regionH;
      if (relY < 0.35) {
        upperGradient += grad;
      } else if (relY > 0.6) {
        lowerGradient += grad;
      }

      // Check bilateral symmetry across center axis
      const mirrorX = xEnd - (x - xStart);
      if (mirrorX >= xStart && mirrorX < xEnd) {
        const mirrorIdx = y * width + mirrorX;
        leftVsRightDiff += Math.abs(current - grayscale[mirrorIdx]);
      }
      samplesCount++;
    }
  }

  const normUpper = upperGradient / Math.max(1, samplesCount * 0.35);
  const normLower = lowerGradient / Math.max(1, samplesCount * 0.4);
  const symmetry = Math.max(0, 1 - leftVsRightDiff / Math.max(1, samplesCount * 40));

  // Determine environmental lighting and contrast quality
  const lightingQuality =
    meanLum < 45 ? 'Dim / Low light' : meanLum > 205 ? 'High glare' : 'Evenly lit';

  let estimatedExpression: CameraExpressionType = 'Unable to estimate reliably';
  let signalQuality: 'Clear' | 'Moderate' | 'Low' | 'Insufficient' = 'Moderate';
  let isReliable = false;
  let reliabilityReason = '';
  // Signal clarity is based strictly on physical illumination and contrast, NOT an emotion probability
  let signalClarityScore = Math.max(0.2, Math.min(0.75, (contrast / 65) * 0.7));

  const mouthActivityRatio = normLower / (normUpper + 0.001);

  // 1. Environmental lighting & image quality guards
  if (meanLum < 45) {
    estimatedExpression = 'Unable to estimate reliably';
    signalQuality = 'Insufficient';
    reliabilityReason = 'Environment lighting is too dim for the camera sensor to distinguish facial landmarks.';
    signalClarityScore = 0.25;
  } else if (meanLum > 205) {
    estimatedExpression = 'Unable to estimate reliably';
    signalQuality = 'Insufficient';
    reliabilityReason = 'Strong lighting glare washes out facial edge definitions.';
    signalClarityScore = 0.3;
  } else if (contrast < 26) {
    estimatedExpression = 'Unable to estimate reliably';
    signalQuality = 'Low';
    reliabilityReason = 'Insufficient frame contrast to distinguish facial features from the background.';
    signalClarityScore = 0.35;
  }
  // 2. Cautious observable physical cues (never presented as definitive emotions)
  else if (mouthActivityRatio > 1.35 && contrast > 34) {
    estimatedExpression = 'Visible upward mouth curvature';
    signalQuality = 'Moderate';
    reliabilityReason = 'Observable upward lower-face curvature detected. Note: Smiling or mouth curvature does not necessarily reflect internal happiness.';
    signalClarityScore = Math.min(0.7, 0.45 + (mouthActivityRatio - 1.35) * 0.1);
  } else if (normUpper > 24 && normUpper > normLower * 1.2) {
    estimatedExpression = 'Visible brow tension pattern';
    signalQuality = 'Moderate';
    reliabilityReason = 'Observable forehead/brow gradient detected. Note: May indicate screen squinting, focus, or room lighting rather than stress.';
    signalClarityScore = Math.min(0.68, 0.45 + (normUpper - 24) * 0.01);
  } else if (Math.abs(normUpper - normLower) < 4.5 && symmetry > 0.6) {
    estimatedExpression = 'Subtle resting facial alignment';
    signalQuality = 'Moderate';
    reliabilityReason = 'Observable resting facial posture with symmetrical edge distribution.';
    signalClarityScore = Math.min(0.65, 0.45 + symmetry * 0.15);
  } else {
    estimatedExpression = 'Unable to estimate reliably';
    signalQuality = 'Low';
    reliabilityReason = 'Facial gradients are ambiguous or subtle. A single 2D camera frame cannot reliably discern expression patterns.';
    signalClarityScore = 0.4;
  }

  return {
    estimatedExpression,
    confidence: Number(signalClarityScore.toFixed(2)),
    signalQuality,
    isReliable,
    reliabilityReason,
    observableMetrics: {
      smileLikelihood: Number(Math.min(1, Math.max(0, (mouthActivityRatio - 0.7) / 1.5)).toFixed(2)),
      openEyeScore: Number(Math.min(1, Math.max(0, contrast / 50)).toFixed(2)),
      browTensionScore: Number(Math.min(1, Math.max(0, normUpper / 30)).toFixed(2)),
      symmetryScore: Number(symmetry.toFixed(2)),
      lightingQuality,
    },
    disclaimer:
      'Visible expression cues describe 2D image gradients and cannot determine your actual feelings or mental state. Self-reported mood is the only reliable record.',
  };
}
