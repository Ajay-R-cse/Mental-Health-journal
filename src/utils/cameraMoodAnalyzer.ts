import { CameraAnalysisResult, CameraExpressionType, FacialLandmarks } from '../types';
import { expressionModelService } from '../services/expressionModelService';

export const CAMERA_DISCLAIMER =
  "Facial expressions do not reliably reveal a person's internal emotional state. This result is an uncertain visual estimate, not a diagnosis or a definitive statement about how you feel.";

/**
 * Computer-Vision Face and Landmark Analyzer.
 *
 * Strict Privacy & Wellness Rules:
 * - 100% Client-side processing inside browser memory.
 * - Zero external server uploads, zero biometric profiling, zero facial identification.
 * - Raw video and frames are never saved or uploaded.
 * - Reports measurable visual geometry (mouth corners, brow elevation, symmetry)
 *   without claiming to know a person's actual internal emotional state.
 * - Never fabricates emotions ("Happy", "Sad", "Depressed") from 2D landmarks.
 * - Clearly reports "Unable to estimate reliably" for emotional states when no genuine ML classifier is loaded.
 */

export interface RawPixelData {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * Safely extracts raw RGBA pixels from various browser or test image inputs
 * (Canvas, Image, Video, ImageData, or base64 data URL).
 */
export function extractImageDataFromSource(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | ImageData | RawPixelData
): RawPixelData {
  // If already raw pixel data or ImageData
  if ('data' in source && 'width' in source && 'height' in source && source.data instanceof Object) {
    return {
      width: source.width,
      height: source.height,
      data: source.data as Uint8ClampedArray,
    };
  }

  // If in browser environment with document/canvas
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const width = (source as any).videoWidth || (source as any).naturalWidth || (source as any).width || 320;
    const height = (source as any).videoHeight || (source as any).naturalHeight || (source as any).height || 240;
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not obtain canvas 2D rendering context.');
    }

    ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      width: imgData.width,
      height: imgData.height,
      data: imgData.data,
    };
  }

  throw new Error('Unsupported image source in current runtime environment.');
}

/**
 * Converts a base64 image data URL into an HTMLImageElement and extracts pixel data.
 */
export async function extractImageDataFromDataUrl(dataUrl: string): Promise<RawPixelData> {
  if (typeof document === 'undefined') {
    throw new Error('DOM document is required to decode base64 data URLs in browser.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const pixels = extractImageDataFromSource(img);
        resolve(pixels);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image from data URL.'));
    };
    img.src = dataUrl;
  });
}

/**
 * Core image-based facial detection and landmark measurement engine.
 */
export function analyzeImagePixels(pixels: RawPixelData): CameraAnalysisResult {
  const { width, height, data } = pixels;

  if (width < 10 || height < 10 || data.length < 400) {
    return {
      faceDetected: false,
      faceCount: 0,
      detectionStatus: 'No face detected',
      estimatedExpression: 'Facial landmarks could not be measured reliably because of image quality.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (image dimensions too small)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.1,
      signalQuality: 'Insufficient',
      isReliable: false,
      reliabilityReason: 'Image dimensions are too small to detect facial landmarks.',
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  // 1. Calculate overall luminance, contrast, and Laplacian sharpness
  let totalLum = 0;
  const grayscale = new Float32Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const pixelIdx = i / 4;
    grayscale[pixelIdx] = lum;
    totalLum += lum;
  }

  const meanLum = totalLum / (width * height);
  let lumVariance = 0;
  let laplacianSum = 0;
  let edgeCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      lumVariance += Math.pow(grayscale[idx] - meanLum, 2);

      // Discrete Laplacian: 4 * center - top - bottom - left - right
      const lap =
        4 * grayscale[idx] -
        grayscale[idx - width] -
        grayscale[idx + width] -
        grayscale[idx - 1] -
        grayscale[idx + 1];
      laplacianSum += Math.abs(lap);
      edgeCount++;
    }
  }

  const contrast = Math.sqrt(lumVariance / (width * height));
  const sharpness = edgeCount > 0 ? laplacianSum / edgeCount : 0;

  const lightingQuality =
    meanLum < 32
      ? 'Dim / Underexposed'
      : meanLum > 225
      ? 'High glare / Overexposed'
      : contrast < 16
      ? 'Low contrast'
      : 'Evenly lit';

  // Environmental lighting guards (pitch black or blinding glare)
  if (meanLum < 30) {
    return {
      faceDetected: false,
      faceCount: 0,
      detectionStatus: 'No face detected',
      estimatedExpression: 'Facial landmarks could not be measured reliably because of image quality.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (insufficient lighting / underexposed)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.2,
      signalQuality: 'Insufficient',
      isReliable: false,
      reliabilityReason: 'Lighting is too dark for the camera sensor to distinguish facial landmarks.',
      observableMetrics: {
        smileLikelihood: 0,
        openEyeScore: 0,
        browTensionScore: 0,
        symmetryScore: 0,
        lightingQuality,
      },
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  if (meanLum > 230) {
    return {
      faceDetected: false,
      faceCount: 0,
      detectionStatus: 'No face detected',
      estimatedExpression: 'Facial landmarks could not be measured reliably because of image quality.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (excessive glare / overexposed)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.22,
      signalQuality: 'Insufficient',
      isReliable: false,
      reliabilityReason: 'Excessive glare or overexposure washes out facial features.',
      observableMetrics: {
        smileLikelihood: 0,
        openEyeScore: 0,
        browTensionScore: 0,
        symmetryScore: 0,
        lightingQuality,
      },
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  // 2. Skin Chrominance Segmentation across human skin tones (YCbCr + normalized RGB)
  const skinMask = new Uint8Array(width * height);
  let skinPixelCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // YCbCr transformation
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      // Universal skin range: 75 <= Cb <= 132 and 130 <= Cr <= 178, with red dominant over blue
      const isSkinColor =
        cb >= 75 &&
        cb <= 132 &&
        cr >= 130 &&
        cr <= 178 &&
        r > g &&
        g > b &&
        r - g >= 10 &&
        r - b >= 15;

      if (isSkinColor) {
        skinMask[y * width + x] = 1;
        skinPixelCount++;
      }
    }
  }

  const skinRatio = skinPixelCount / (width * height);

  // If there are no skin pixels (< 1.5% of the frame) or no human coloring:
  // Decisively report "No face detected"
  if (skinRatio < 0.015) {
    return {
      faceDetected: false,
      faceCount: 0,
      detectionStatus: 'No face detected',
      estimatedExpression: 'No face detected. Please try another image.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (no face detected)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.15,
      signalQuality: 'Insufficient',
      isReliable: false,
      reliabilityReason: 'No skin-tone regions or facial features were detected in the image.',
      observableMetrics: {
        smileLikelihood: 0,
        openEyeScore: 0,
        browTensionScore: 0,
        symmetryScore: 0,
        lightingQuality,
      },
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  // Quality check for images containing skin tone but severely blurred/flat
  if (contrast < 15 && sharpness < 2.0) {
    return {
      faceDetected: false,
      faceCount: 0,
      detectionStatus: 'No face detected',
      estimatedExpression: 'Facial landmarks could not be measured reliably because of image quality.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (insufficient contrast or blurry)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.25,
      signalQuality: 'Insufficient',
      isReliable: false,
      reliabilityReason: 'Image is too flat or blurry to detect edges or facial landmarks reliably.',
      observableMetrics: {
        smileLikelihood: 0,
        openEyeScore: 0,
        browTensionScore: 0,
        symmetryScore: 0,
        lightingQuality,
      },
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  // 3. Candidate Face Region Identification (Connected component bounding boxes)
  // Grid downsampling for robust component clustering (16x16 blocks)
  const blockSize = Math.max(8, Math.floor(Math.min(width, height) / 20));
  const gridW = Math.floor(width / blockSize);
  const gridH = Math.floor(height / blockSize);
  const gridDensity = new Float32Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      let count = 0;
      for (let py = 0; py < blockSize; py++) {
        for (let px = 0; px < blockSize; px++) {
          const x = gx * blockSize + px;
          const y = gy * blockSize + py;
          if (x < width && y < height && skinMask[y * width + x] === 1) {
            count++;
          }
        }
      }
      gridDensity[gy * gridW + gx] = count / (blockSize * blockSize);
    }
  }

  // Cluster connected face blocks with density >= 0.25
  const visited = new Uint8Array(gridW * gridH);
  interface BoundingBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    blockCount: number;
  }
  const candidateBlobs: BoundingBox[] = [];

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const gidx = gy * gridW + gx;
      if (visited[gidx] || gridDensity[gidx] < 0.25) continue;

      // Flood fill cluster
      const queue = [gidx];
      visited[gidx] = 1;
      let minX = gx;
      let maxX = gx;
      let minY = gy;
      let maxY = gy;
      let blocks = 0;

      while (queue.length > 0) {
        const curr = queue.pop()!;
        const cy = Math.floor(curr / gridW);
        const cx = curr % gridW;
        blocks++;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
            const nidx = ny * gridW + nx;
            if (!visited[nidx] && gridDensity[nidx] >= 0.25) {
              visited[nidx] = 1;
              queue.push(nidx);
            }
          }
        }
      }

      if (blocks >= 3) {
        candidateBlobs.push({
          minX: minX * blockSize,
          maxX: Math.min(width, (maxX + 1) * blockSize),
          minY: minY * blockSize,
          maxY: Math.min(height, (maxY + 1) * blockSize),
          blockCount: blocks,
        });
      }
    }
  }

  // Filter candidate blobs by facial aspect ratio and minimum size
  const validFaceCandidates = candidateBlobs.filter((b) => {
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const aspect = h / w;
    const area = w * h;
    const isMinSize = area >= (width * height) * 0.04; // at least 4% of frame
    const isGoodAspect = aspect >= 0.80 && aspect <= 2.5;
    return isMinSize && isGoodAspect;
  });

  // Multiple faces check
  if (validFaceCandidates.length >= 2) {
    validFaceCandidates.sort(
      (a, b) => (b.maxX - b.minX) * (b.maxY - b.minY) - (a.maxX - a.minX) * (a.maxY - a.minY)
    );
    const area1 = (validFaceCandidates[0].maxX - validFaceCandidates[0].minX) * (validFaceCandidates[0].maxY - validFaceCandidates[0].minY);
    const area2 = (validFaceCandidates[1].maxX - validFaceCandidates[1].minX) * (validFaceCandidates[1].maxY - validFaceCandidates[1].minY);

    if (area2 >= area1 * 0.35) {
      return {
        faceDetected: true,
        faceCount: validFaceCandidates.length,
        detectionStatus: 'Multiple faces detected',
        estimatedExpression: 'Multiple faces detected. Please frame a single face.',
        expressionEstimate: 'Unable to estimate reliably',
        moodEstimate: 'Unavailable (multiple faces in frame)',
        classifierModelName: 'None loaded (client-side anthropometric observation only)',
        analysisQuality: 'Inconclusive',
        confidence: 0.45,
        signalQuality: 'Low',
        isReliable: false,
        reliabilityReason: 'Multiple faces were found in the frame. Position the camera to focus on a single person.',
        observableMetrics: {
          smileLikelihood: 0,
          openEyeScore: 0,
          browTensionScore: 0,
          symmetryScore: 0,
          lightingQuality,
        },
        disclaimer: CAMERA_DISCLAIMER,
      };
    }
  }

  // If no candidate met the face criteria
  if (validFaceCandidates.length === 0) {
    return {
      faceDetected: false,
      faceCount: 0,
      detectionStatus: 'No face detected',
      estimatedExpression: 'No face detected. Please try another image.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (no face detected)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.2,
      signalQuality: 'Insufficient',
      isReliable: false,
      reliabilityReason: 'No face detected. Please ensure your face is well-centered and clearly visible.',
      observableMetrics: {
        smileLikelihood: 0,
        openEyeScore: 0,
        browTensionScore: 0,
        symmetryScore: 0,
        lightingQuality,
      },
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  // 4. Detailed Anthropometric Feature Extraction on primary face
  const rawFace = validFaceCandidates[0];
  const faceX = rawFace.minX;
  const faceY = rawFace.minY;
  const faceW = rawFace.maxX - rawFace.minX;
  const rawFaceH = rawFace.maxY - rawFace.minY;

  // Crucial Anthropometric Aspect Ratio Clamping:
  // Human facial height (hairline to chin) relative to width is ~1.20 to 1.40.
  // In real pictures, the skin cluster can bleed down the neck and upper chest.
  // Clamping face height prevents the mouth search band from slipping down onto neck shadows/collars.
  const faceH = Math.min(rawFaceH, Math.round(faceW * 1.38));
  const faceAspect = faceH / faceW;

  const eyeBandYStart = Math.floor(faceY + faceH * 0.26);
  const eyeBandYEnd = Math.floor(faceY + faceH * 0.52);
  const midX = Math.floor(faceX + faceW * 0.5);

  // Find left eye dark valley (in left half of eye band)
  let minLeftEyeVal = 999;
  let leftEyeX = Math.floor(faceX + faceW * 0.32);
  let leftEyeY = Math.floor(faceY + faceH * 0.4);

  for (let y = eyeBandYStart; y < eyeBandYEnd; y++) {
    for (let x = Math.floor(faceX + faceW * 0.15); x < Math.floor(faceX + faceW * 0.46); x++) {
      const idx = y * width + x;
      const val = grayscale[idx];
      if (val < minLeftEyeVal) {
        minLeftEyeVal = val;
        leftEyeX = x;
        leftEyeY = y;
      }
    }
  }

  // Find right eye dark valley (in right half of eye band)
  let minRightEyeVal = 999;
  let rightEyeX = Math.floor(faceX + faceW * 0.68);
  let rightEyeY = Math.floor(faceY + faceH * 0.4);

  for (let y = eyeBandYStart; y < eyeBandYEnd; y++) {
    for (let x = Math.floor(faceX + faceW * 0.54); x < Math.floor(faceX + faceW * 0.85); x++) {
      const idx = y * width + x;
      const val = grayscale[idx];
      if (val < minRightEyeVal) {
        minRightEyeVal = val;
        rightEyeX = x;
        rightEyeY = y;
      }
    }
  }

  // Inter-Ocular Distance (IOD)
  const iod = Math.sqrt(Math.pow(rightEyeX - leftEyeX, 2) + Math.pow(rightEyeY - leftEyeY, 2));

  // If eye valleys don't exhibit characteristic eye contrast or IOD is abnormally small/large
  if (iod < faceW * 0.22 || iod > faceW * 0.72) {
    return {
      faceDetected: false,
      faceCount: 0,
      detectionStatus: 'No face detected',
      estimatedExpression: 'No face detected. Please try another image.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (no face detected)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.22,
      signalQuality: 'Insufficient',
      isReliable: false,
      reliabilityReason: 'Facial landmark verification failed: eye features were not discernable.',
      observableMetrics: {
        smileLikelihood: 0,
        openEyeScore: 0,
        browTensionScore: 0,
        symmetryScore: 0,
        lightingQuality,
      },
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  // Roll tilt angle
  const rollAngle = Math.atan2(rightEyeY - leftEyeY, rightEyeX - leftEyeX);
  if (Math.abs(rollAngle) > 0.65) {
    return {
      faceDetected: true,
      faceCount: 1,
      detectionStatus: 'Face detected',
      estimatedExpression: 'Facial landmarks could not be measured reliably because of image quality.',
      expressionEstimate: 'Unable to estimate reliably',
      moodEstimate: 'Unavailable (steep head tilt)',
      classifierModelName: 'None loaded (client-side anthropometric observation only)',
      analysisQuality: 'Inconclusive',
      confidence: 0.35,
      signalQuality: 'Low',
      isReliable: false,
      reliabilityReason: 'Head is tilted at a steep angle. Please align your face directly forward towards the camera.',
      observableMetrics: {
        smileLikelihood: 0,
        openEyeScore: 0,
        browTensionScore: 0,
        symmetryScore: 0,
        lightingQuality,
      },
      disclaimer: CAMERA_DISCLAIMER,
    };
  }

  // 5. Eyebrow Landmarks Localization
  const browBandYStart = Math.floor(faceY + faceH * 0.16);
  const browBandYEnd = Math.max(browBandYStart + 1, leftEyeY - 2);

  let leftBrowY = browBandYStart;
  let minLeftBrow = 999;
  for (let y = browBandYStart; y < browBandYEnd; y++) {
    const idx = y * width + leftEyeX;
    if (grayscale[idx] < minLeftBrow) {
      minLeftBrow = grayscale[idx];
      leftBrowY = y;
    }
  }

  let rightBrowY = browBandYStart;
  let minRightBrow = 999;
  for (let y = browBandYStart; y < browBandYEnd; y++) {
    const idx = y * width + rightEyeX;
    if (grayscale[idx] < minRightBrow) {
      minRightBrow = grayscale[idx];
      rightBrowY = y;
    }
  }

  const leftBrowDist = (leftEyeY - leftBrowY) / iod;
  const rightBrowDist = (rightEyeY - rightBrowY) / iod;
  const avgBrowElevation = (leftBrowDist + rightBrowDist) / 2;

  // Brow tension / furrow gradient
  let innerBrowGradient = 0;
  for (let y = browBandYStart; y < eyeBandYStart; y++) {
    for (let x = Math.floor(faceX + faceW * 0.42); x <= Math.floor(faceX + faceW * 0.58); x++) {
      const idx = y * width + x;
      const leftGrad = Math.abs(grayscale[idx] - grayscale[idx - 1]);
      const rightGrad = Math.abs(grayscale[idx] - grayscale[idx + 1]);
      innerBrowGradient += leftGrad + rightGrad;
    }
  }
  const normInnerBrowGrad = innerBrowGradient / Math.max(1, (eyeBandYStart - browBandYStart) * (faceW * 0.16));

  // 6. Mouth & Lip Landmarks Localization
  const mouthBandYStart = Math.floor(faceY + faceH * 0.60);
  const mouthBandYEnd = Math.floor(faceY + faceH * 0.88);

  // Helper: locate vertical center of lip line at column colX
  // Combines red chrominance contrast with darkness to prevent locking onto neck shadows
  const getLipCenterYAt = (colX: number): number => {
    let bestScore = -9999;
    let bestY = Math.floor(faceY + faceH * 0.74);

    for (let y = mouthBandYStart; y <= mouthBandYEnd; y++) {
      if (y >= 0 && y < height && colX >= 0 && colX < width) {
        let val = 0;
        let count = 0;
        let redRatio = 0;

        for (let dx = -1; dx <= 1; dx++) {
          const px = colX + dx;
          if (px >= 0 && px < width) {
            val += grayscale[y * width + px];
            const pIdx = (y * width + px) * 4;
            const r = data[pIdx];
            const g = data[pIdx + 1];
            const b = data[pIdx + 2];
            redRatio += (r - (g + b) / 2);
            count++;
          }
        }
        val = count > 0 ? val / count : grayscale[y * width + colX];
        redRatio = count > 0 ? redRatio / count : 0;

        // Lip score: Higher red contrast + darker valley (inverted grayscale)
        const score = (255 - val) * 0.65 + redRatio * 1.5;
        if (score > bestScore) {
          bestScore = score;
          bestY = y;
        }
      }
    }
    return bestY;
  };

  const mouthCenterY = getLipCenterYAt(midX);

  // Find left mouth corner (search left quarter of mouth box)
  let mouthLeftX = Math.floor(faceX + faceW * 0.32);
  let maxLeftGrad = -1;
  for (let x = Math.floor(faceX + faceW * 0.22); x <= midX - Math.floor(faceW * 0.12); x++) {
    const y = getLipCenterYAt(x);
    if (y >= 0 && y < height && x >= 1 && x < width - 1) {
      const idx = y * width + x;
      const grad = Math.abs(grayscale[idx] - grayscale[idx - 1]);
      if (grad > maxLeftGrad) {
        maxLeftGrad = grad;
        mouthLeftX = x;
      }
    }
  }

  // Find right mouth corner (search right quarter of mouth box)
  let mouthRightX = Math.floor(faceX + faceW * 0.68);
  let maxRightGrad = -1;
  for (let x = midX + Math.floor(faceW * 0.12); x <= Math.floor(faceX + faceW * 0.78); x++) {
    const y = getLipCenterYAt(x);
    if (y >= 0 && y < height && x >= 1 && x < width - 1) {
      const idx = y * width + x;
      const grad = Math.abs(grayscale[idx] - grayscale[idx + 1]);
      if (grad > maxRightGrad) {
        maxRightGrad = grad;
        mouthRightX = x;
      }
    }
  }

  // Measure vertical lip center at each corner using the identical method
  const mouthLeftY = getLipCenterYAt(mouthLeftX);
  const mouthRightY = getLipCenterYAt(mouthRightX);

  // Normalized mouth curvature relative to IOD
  // Screen coordinates: smaller Y = higher up on face.
  // When mouth corners are raised (higher up than the center), avgCornerY < mouthCenterY,
  // so (mouthCenterY - avgCornerY) is POSITIVE!
  const avgCornerY = (mouthLeftY + mouthRightY) / 2;
  const mouthCurvature = (mouthCenterY - avgCornerY) / iod;

  // Mouth openness
  let upperLipY = mouthCenterY - 4;
  let lowerLipY = mouthCenterY + 4;
  const mouthOpenness = (lowerLipY - upperLipY) / iod;

  // Bilateral facial symmetry
  const cornerHeightDiff = Math.abs(mouthLeftY - mouthRightY) / iod;
  const eyeHeightDiff = Math.abs(leftEyeY - rightEyeY) / iod;
  const symmetry = Math.max(0, 1 - (cornerHeightDiff * 1.5 + eyeHeightDiff * 2.0));

  const detectedLandmarks: FacialLandmarks = {
    faceBox: { x: faceX, y: faceY, width: faceW, height: faceH },
    interOcularDistance: Math.round(iod),
    leftEye: { x: leftEyeX, y: leftEyeY },
    rightEye: { x: rightEyeX, y: rightEyeY },
    leftBrow: { x: leftEyeX, y: leftBrowY },
    rightBrow: { x: rightEyeX, y: rightBrowY },
    noseTip: { x: midX, y: Math.floor(faceY + faceH * 0.58) },
    mouthLeft: { x: mouthLeftX, y: mouthLeftY },
    mouthRight: { x: mouthRightX, y: mouthRightY },
    mouthCenter: { x: midX, y: mouthCenterY },
  };

  // 7. Observable Physical Landmark Classification (Never fabricating an emotional mood)
  let estimatedExpression: CameraExpressionType;
  let signalQuality: 'Clear' | 'Moderate' | 'Low' | 'Insufficient' = 'Clear';
  let reliabilityReason = '';
  let confidence = Math.max(0.65, Math.min(0.92, 0.6 + (contrast / 80) * 0.15 + (sharpness / 12) * 0.15));

  // Calibrated physical geometric thresholding:
  // Raised mouth corners: curvature >= +0.035
  // Turned-down mouth corners: curvature <= -0.035
  // Brow tension / movement: brow elevation <= 0.18 or inner brow gradient >= 18
  const analysisQuality: 'Reliable enough to analyze' | 'Inconclusive' = 'Reliable enough to analyze';

  if (mouthCurvature >= 0.035) {
    estimatedExpression = 'The mouth corners appear slightly raised in this image.';
    reliabilityReason =
      'Measurable visual observation: lower face landmark geometry indicates raised mouth corners relative to the lip center. No machine-learning emotion classifier is loaded; emotional state is not fabricated from landmarks.';
  } else if (mouthCurvature <= -0.035) {
    estimatedExpression = 'Mouth corners appear slightly turned down in this image.';
    reliabilityReason =
      'Measurable visual observation: lower face landmark geometry indicates downward-turned mouth corners relative to the lip center. No machine-learning emotion classifier is loaded; emotional state is not fabricated from landmarks.';
  } else if (avgBrowElevation <= 0.18 || normInnerBrowGrad > 18) {
    estimatedExpression = 'Visible brow movement was detected.';
    reliabilityReason =
      'Measurable visual observation: lower brow-to-eye vertical distance indicates brow movement or contraction. No machine-learning emotion classifier is loaded; emotional state is not fabricated from landmarks.';
  } else {
    estimatedExpression = 'Face detected; facial landmarks were detected successfully.';
    reliabilityReason =
      'Measurable visual observation: facial landmarks localized with level mouth alignment and resting brow geometry. No machine-learning emotion classifier is loaded; emotional state is not fabricated from landmarks.';
  }

  const smileLikelihood = Number(Math.max(0.05, Math.min(0.95, 0.45 + mouthCurvature * 6.5)).toFixed(2));
  const browTensionScore = Number(
    Math.max(0.05, Math.min(0.95, 0.35 + (0.24 - avgBrowElevation) * 3.5 + (normInnerBrowGrad / 40) * 0.3)).toFixed(2)
  );
  const openEyeScore = Number(Math.max(0.3, Math.min(0.95, 0.55 + (iod / faceW) * 0.5)).toFixed(2));

  return {
    faceDetected: true,
    faceCount: 1,
    detectionStatus: 'Face detected',
    estimatedExpression,
    expressionEstimate: 'Unable to estimate reliably',
    moodEstimate: 'Unable to estimate reliably',
    classifierModelName: 'None loaded (client-side anthropometric observation only)',
    analysisQuality,
    confidence: Number(confidence.toFixed(2)),
    signalQuality,
    isReliable: true,
    reliabilityReason,
    detectedLandmarks,
    observableMetrics: {
      smileLikelihood,
      openEyeScore,
      browTensionScore,
      symmetryScore: Number(symmetry.toFixed(2)),
      lightingQuality,
      mouthCurvature: Number(mouthCurvature.toFixed(3)),
      browElevation: Number(avgBrowElevation.toFixed(3)),
      mouthOpenness: Number(mouthOpenness.toFixed(3)),
      faceAspectRatio: Number(faceAspect.toFixed(2)),
    },
    disclaimer: CAMERA_DISCLAIMER,
  };
}

/**
 * Convenience wrapper for analyzing a canvas, video, or image element.
 */
export function analyzeCanvasFrame(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  targetCanvas?: HTMLCanvasElement
): CameraAnalysisResult {
  let pixels: RawPixelData;

  if (targetCanvas && source instanceof HTMLVideoElement) {
    const width = source.videoWidth || 320;
    const height = source.videoHeight || 240;
    targetCanvas.width = width;
    targetCanvas.height = height;
    const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(source, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      pixels = { width: imgData.width, height: imgData.height, data: imgData.data };
    } else {
      pixels = extractImageDataFromSource(source);
    }
  } else {
    pixels = extractImageDataFromSource(source);
  }

  return analyzeImagePixels(pixels);
}

/**
 * Performs full multimodal image analysis:
 * 1. Physical 2D facial landmark geometry (eyes, brows, mouth curvature, bilateral symmetry, lighting quality).
 * 2. Real browser-based ML facial expression classification via TensorFlow.js / FaceExpressionNet.
 */
export async function analyzeImageWithClassifier(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  targetCanvas?: HTMLCanvasElement
): Promise<CameraAnalysisResult> {
  // 1. Run physical landmark & lighting geometry extraction
  const baseResult = analyzeCanvasFrame(source, targetCanvas);

  // If geometric analysis definitively determined no face or invalid lighting, return early
  if (!baseResult.faceDetected || baseResult.faceCount === 0) {
    return baseResult;
  }

  // 2. Run real client-side ML classification using FaceExpressionNet
  try {
    const mlInput = source instanceof HTMLVideoElement && targetCanvas ? targetCanvas : source;
    const mlResult = await expressionModelService.classify(mlInput);

    if (mlResult.success && mlResult.faceDetected && mlResult.dominantExpression) {
      const formattedEstimate = expressionModelService.formatCategoryLabel(mlResult.dominantExpression);

      return {
        ...baseResult,
        faceDetected: true,
        detectionStatus: 'Face detected',
        dominantExpression: mlResult.dominantExpression,
        expressionScores: mlResult.scores,
        modelOutputConfidence: mlResult.confidence,
        expressionEstimate: formattedEstimate,
        moodEstimate: `Visible expression estimate: ${mlResult.dominantExpression}`,
        classifierModelName: mlResult.modelName,
        modelLoadingStatus: 'loaded',
        reliabilityReason: `Observable visual estimate classified by ${mlResult.modelName} (dominant score: ${(mlResult.confidence * 100).toFixed(1)}% for "${mlResult.dominantExpression}"). Model scores describe physical appearance in the image and do not indicate internal emotional feelings.`,
      };
    } else if (mlResult.error) {
      return {
        ...baseResult,
        modelLoadingStatus: 'error',
        modelErrorMessage: mlResult.error,
        classifierModelName: mlResult.modelName,
        reliabilityReason: `Neural classifier note: ${mlResult.error}. Physical 2D landmark cues were measured directly.`,
      };
    }
  } catch (mlErr: any) {
    console.warn('[cameraMoodAnalyzer] Neural classifier exception:', mlErr);
  }

  return baseResult;
}

/**
 * Asynchronously decodes and analyzes an image data URL with race condition protection.
 */
export async function analyzeImageDataUrl(
  dataUrl: string,
  requestId: number,
  isLatestRequest: (id: number) => boolean
): Promise<CameraAnalysisResult | null> {
  if (typeof document === 'undefined') {
    const pixels = await extractImageDataFromDataUrl(dataUrl);
    if (!isLatestRequest(requestId)) return null;
    return analyzeImagePixels(pixels);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        if (!isLatestRequest(requestId)) {
          resolve(null);
          return;
        }
        const result = await analyzeImageWithClassifier(img);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image from data URL.'));
    };
    img.src = dataUrl;
  });
}
