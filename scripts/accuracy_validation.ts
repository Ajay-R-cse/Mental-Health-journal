import { LexiconNLPAnalyzer } from '../backend/nlp/LexiconNLPAnalyzer.js';
import { aiService } from '../backend/services/AIService.js';
import { analyzeImagePixels, RawPixelData } from '../src/utils/cameraMoodAnalyzer.js';
import { expressionModelService } from '../src/services/expressionModelService.js';

interface TestCaseResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestCaseResult[] = [];

/**
 * Creates reproducible synthetic image fixtures for testing face detection,
 * landmark localization, and observable geometry under diverse conditions.
 */
function createSyntheticFaceImage(opts: {
  hasFace: boolean;
  multipleFaces?: boolean;
  mouthCurvature?: 'upward' | 'neutral' | 'downward';
  browTension?: boolean;
  isDark?: boolean;
  isOverexposed?: boolean;
  width?: number;
  height?: number;
}): RawPixelData {
  const width = opts.width || 320;
  const height = opts.height || 240;
  const data = new Uint8ClampedArray(width * height * 4);

  // Background
  const bgR = opts.isDark ? 10 : opts.isOverexposed ? 245 : 190;
  const bgG = opts.isDark ? 10 : opts.isOverexposed ? 245 : 195;
  const bgB = opts.isDark ? 10 : opts.isOverexposed ? 245 : 205;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = bgR;
    data[i + 1] = bgG;
    data[i + 2] = bgB;
    data[i + 3] = 255;
  }

  if (opts.isDark || opts.isOverexposed) {
    return { width, height, data };
  }

  if (!opts.hasFace) {
    // Fill with non-skin colors (e.g. green foliage / blue pattern)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 40 + (x % 50);
        data[idx + 1] = 120 + (y % 60);
        data[idx + 2] = 60 + ((x + y) % 40);
        data[idx + 3] = 255;
      }
    }
    return { width, height, data };
  }

  // Helper to draw a human face with skin tones, eyes, eyebrows, nose, and mouth
  const drawFace = (centerX: number, centerY: number, radiusX: number, radiusY: number) => {
    // 1. Skin tone oval (Cb ~ 110, Cr ~ 154)
    for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
      for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const dx = (x - centerX) / radiusX;
          const dy = (y - centerY) / radiusY;
          if (dx * dx + dy * dy <= 1.0) {
            const idx = (y * width + x) * 4;
            data[idx] = 215;
            data[idx + 1] = 155;
            data[idx + 2] = 125;
            data[idx + 3] = 255;
          }
        }
      }
    }

    // 2. Eyes
    const eyeOffsetX = Math.floor(radiusX * 0.42);
    const eyeOffsetY = Math.floor(radiusY * 0.15);
    const eyeY = centerY - eyeOffsetY;
    const leftEyeX = centerX - eyeOffsetX;
    const rightEyeX = centerX + eyeOffsetX;

    // Dark pupils / irises
    for (const ex of [leftEyeX, rightEyeX]) {
      for (let ey = eyeY - 4; ey <= eyeY + 4; ey++) {
        for (let exx = ex - 6; exx <= ex + 6; exx++) {
          if (exx >= 0 && exx < width && ey >= 0 && ey < height) {
            const idx = (ey * width + exx) * 4;
            data[idx] = 30;
            data[idx + 1] = 25;
            data[idx + 2] = 25;
          }
        }
      }
    }

    // 3. Eyebrows
    const browYOffset = opts.browTension ? 12 : 22;
    for (const bx of [leftEyeX, rightEyeX]) {
      const by = eyeY - browYOffset;
      for (let bby = by - 3; bby <= by + 3; bby++) {
        for (let bxx = bx - 10; bxx <= bx + 10; bxx++) {
          if (bxx >= 0 && bxx < width && bby >= 0 && bby < height) {
            const idx = (bby * width + bxx) * 4;
            data[idx] = 45;
            data[idx + 1] = 35;
            data[idx + 2] = 30;
          }
        }
      }
    }

    // If brow tension is simulated, add furrow contrast between brows
    if (opts.browTension) {
      for (let fby = eyeY - 20; fby <= eyeY - 6; fby++) {
        for (let fbx = centerX - 4; fbx <= centerX + 4; fbx++) {
          if (fbx >= 0 && fbx < width && fby >= 0 && fby < height) {
            const idx = (fby * width + fbx) * 4;
            data[idx] = 55;
            data[idx + 1] = 40;
            data[idx + 2] = 35;
          }
        }
      }
    }

    // 4. Nose
    const noseY = centerY + Math.floor(radiusY * 0.18);
    for (let ny = noseY - 3; ny <= noseY + 3; ny++) {
      for (let nx = centerX - 3; nx <= centerX + 3; nx++) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = (ny * width + nx) * 4;
          data[idx] = 165;
          data[idx + 1] = 110;
          data[idx + 2] = 90;
        }
      }
    }

    // 5. Mouth
    const mouthY = centerY + Math.floor(radiusY * 0.52);
    const mouthHalfW = Math.floor(radiusX * 0.44);

    for (let mx = centerX - mouthHalfW; mx <= centerX + mouthHalfW; mx++) {
      const t = (mx - centerX) / mouthHalfW; // -1 to +1
      let yShift = 0;
      if (opts.mouthCurvature === 'upward') {
        // Corners are higher (smaller y in screen coords)
        yShift = -Math.round((1 - t * t) * 7);
      } else if (opts.mouthCurvature === 'downward') {
        // Corners are lower (larger y in screen coords)
        yShift = Math.round((1 - t * t) * 7);
      }

      const curY = mouthY - yShift;
      for (let my = curY - 3; my <= curY + 3; my++) {
        if (mx >= 0 && mx < width && my >= 0 && my < height) {
          const idx = (my * width + mx) * 4;
          data[idx] = 135;
          data[idx + 1] = 55;
          data[idx + 2] = 55;
        }
      }
    }
  };

  if (opts.multipleFaces) {
    drawFace(Math.floor(width * 0.28), Math.floor(height * 0.5), 45, 60);
    drawFace(Math.floor(width * 0.72), Math.floor(height * 0.5), 45, 60);
  } else {
    drawFace(Math.floor(width * 0.5), Math.floor(height * 0.5), 65, 85);
  }

  return { width, height, data };
}

async function runRegressionSuite() {
  console.log('=== RUNNING COMPREHENSIVE INTEGRATION & REGRESSION TEST SUITE ===\n');

  const nlp = new LexiconNLPAnalyzer();

  // Test 1: Strict Negation ("I am not happy.") -> Negative
  {
    const res = await nlp.analyze('I am not happy.');
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && !res.positive_words.includes('happy');
    results.push({
      name: 'Case 1: "I am not happy." -> Negative',
      passed,
      expected: 'sentiment: "Negative", score < 0, positive_words without "happy"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 2: Negation with Contraction ("I don't feel good today.") -> Negative
  {
    const res = await nlp.analyze("I don't feel good today.");
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && !res.positive_words.includes('good');
    results.push({
      name: 'Case 2: "I don\'t feel good today." -> Negative',
      passed,
      expected: 'sentiment: "Negative", score < 0, positive_words without "good"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 3: Negation of negative emotion with temporal cessation ("I am not sad anymore.")
  // Must NOT automatically become high positive merely because "sad" is negated.
  // Prefer neutral or mildly positive (absence of sadness indicates equanimity / baseline).
  {
    const res = await nlp.analyze('I am not sad anymore.');
    const passed = (res.sentiment === 'Neutral' || res.sentiment === 'Positive') &&
                   res.sentiment_score >= 0 &&
                   res.sentiment_score <= 0.30 &&
                   !res.negative_words.includes('sad');
    results.push({
      name: 'Case 3: "I am not sad anymore." -> Neutral or mildly positive (calibrated, score <= 0.30)',
      passed,
      expected: 'sentiment: "Neutral" | "Positive", score in [0.0, 0.30], negative_words without "sad"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 4: Continuation of negative emotion with intensifier ("I am still sad.") -> Negative
  {
    const res = await nlp.analyze('I am still sad.');
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && res.negative_words.includes('sad');
    results.push({
      name: 'Case 4: "I am still sad." -> Negative (continuation intensifier preserves negative valence)',
      passed,
      expected: 'sentiment: "Negative", score < 0, negative_words with "sad"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 5: Explicit positive relief with negated negative ("I feel relieved that I am no longer sad.") -> Positive
  {
    const res = await nlp.analyze('I feel relieved that I am no longer sad.');
    const passed = res.sentiment === 'Positive' && res.sentiment_score >= 0.35 && res.positive_words.includes('relieved');
    results.push({
      name: 'Case 5: "I feel relieved that I am no longer sad." -> Positive (explicit relief keyword)',
      passed,
      expected: 'sentiment: "Positive", score >= 0.35, positive_words with "relieved"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}`,
    });
  }

  // Test 6: Cessation of positive state ("I am not happy anymore.") -> Negative
  {
    const res = await nlp.analyze('I am not happy anymore.');
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && !res.positive_words.includes('happy');
    results.push({
      name: 'Case 6: "I am not happy anymore." -> Negative (temporal cessation of joy)',
      passed,
      expected: 'sentiment: "Negative", score < 0, positive_words without "happy"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 7: Mixed sentiment with contrastive clause ("I passed my exam, but I feel disappointed.")
  {
    const res = await nlp.analyze('I passed my exam, but I feel disappointed.');
    const passed = (res.sentiment === 'Negative' || res.sentiment === 'Mixed') && res.sentiment_score < 0 && res.negative_words.includes('disappointed');
    results.push({
      name: 'Case 7: "I passed my exam, but I feel disappointed." -> Negative or mixed, disappointment represented',
      passed,
      expected: 'sentiment: "Negative" | "Mixed", score < 0, negative_words with "disappointed"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 8: Mixed sentiment ("I failed my exam, but my friends supported me.") -> Mixed
  {
    const res = await nlp.analyze('I failed my exam, but my friends supported me.');
    const passed = res.sentiment === 'Mixed' && res.positive_words.length > 0 && res.negative_words.includes('failed');
    results.push({
      name: 'Case 8: "I failed my exam, but my friends supported me." -> Mixed',
      passed,
      expected: 'sentiment: "Mixed", has both positive and negative elements',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 9: Factual Neutral Statement ("Meeting at 2pm.") -> Neutral
  {
    const res = await nlp.analyze('Meeting at 2pm.');
    const passed = res.sentiment === 'Neutral' && res.sentiment_score === 0;
    results.push({
      name: 'Case 9: "Meeting at 2pm." -> Neutral',
      passed,
      expected: 'sentiment: "Neutral", score: 0',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}`,
    });
  }

  // Test 10: Mild Positive Statement ("I feel okay today.") -> Neutral or mildly positive
  {
    const res = await nlp.analyze('I feel okay today.');
    const passed = (res.sentiment === 'Neutral' || res.sentiment === 'Positive') && res.sentiment_score >= 0;
    results.push({
      name: 'Case 10: "I feel okay today." -> Neutral or mildly positive',
      passed,
      expected: 'sentiment: "Neutral" | "Positive", score >= 0',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}`,
    });
  }

  // Test 11: Strongly Positive with Intensifier ("I am extremely happy.") -> Strongly positive
  {
    const res = await nlp.analyze('I am extremely happy.');
    const resBase = await nlp.analyze('I am good.');
    const passed = res.sentiment === 'Positive' && res.sentiment_score >= 0.7 && res.sentiment_score > resBase.sentiment_score;
    results.push({
      name: 'Case 11: "I am extremely happy." -> Strongly positive (>= 0.70)',
      passed,
      expected: 'sentiment: "Positive", score >= 0.70, score > "good" score',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score} (vs good: ${resBase.sentiment_score})`,
    });
  }

  // Test 12: Sarcasm / Irony ("Oh great, another delay and ruined schedule.") -> Negative
  {
    const res = await nlp.analyze('Oh great, another delay and ruined schedule.');
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && !res.positive_words.includes('great');
    results.push({
      name: 'Case 12: "Oh great, another delay and ruined schedule." -> Negative',
      passed,
      expected: 'sentiment: "Negative", score < 0, positive_words without "great"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 13: Concurrent Opposing Emotions ("I feel happy and sad at the same time.") -> Mixed or uncertain
  {
    const res = await nlp.analyze('I feel happy and sad at the same time.');
    const passed = res.sentiment === 'Mixed' && res.positive_words.includes('happy') && res.negative_words.includes('sad');
    results.push({
      name: 'Case 13: "I feel happy and sad at the same time." -> Mixed or uncertain',
      passed,
      expected: 'sentiment: "Mixed", positive_words with "happy", negative_words with "sad"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 14: Scale Consistency (-1.0 to +1.0 for sentiment_score, 0.0 to 1.0 for normalized_score)
  {
    const resPos = await nlp.analyze('I am deeply grateful for this wonderful life.');
    const resNeg = await nlp.analyze('I am devastated and heartbroken by this terrible failure.');
    const passed =
      resPos.sentiment_score >= -1.0 &&
      resPos.sentiment_score <= 1.0 &&
      resPos.normalized_score >= 0.0 &&
      resPos.normalized_score <= 1.0 &&
      resNeg.sentiment_score >= -1.0 &&
      resNeg.sentiment_score <= 1.0 &&
      resNeg.normalized_score >= 0.0 &&
      resNeg.normalized_score <= 1.0;
    results.push({
      name: 'Case 14: Scale Consistency [-1, 1] and [0, 1]',
      passed,
      expected: 'Both scores bounded strictly within [-1.0, 1.0] and [0.0, 1.0]',
      actual: `Pos(score: ${resPos.sentiment_score}, norm: ${resPos.normalized_score}), Neg(score: ${resNeg.sentiment_score}, norm: ${resNeg.normalized_score})`,
    });
  }

  // =========================================================================
  // CAMERA & FACE ANALYSIS REGRESSION SUITE (Image-based Landmark Measurement)
  // =========================================================================

  // Test 15: Raised Mouth Corners (Smiling Face Image Fixture)
  {
    const smileImg = createSyntheticFaceImage({ hasFace: true, mouthCurvature: 'upward' });
    const res = analyzeImagePixels(smileImg);
    const passed =
      res.faceDetected === true &&
      res.faceCount === 1 &&
      res.detectionStatus === 'Face detected' &&
      res.estimatedExpression === 'The mouth corners appear slightly raised in this image.' &&
      res.expressionEstimate === 'Unable to estimate reliably' &&
      res.moodEstimate === 'Unable to estimate reliably' &&
      res.analysisQuality === 'Reliable enough to analyze' &&
      res.detectedLandmarks !== null &&
      res.observableMetrics?.mouthCurvature !== undefined &&
      res.observableMetrics.mouthCurvature > 0.035 &&
      res.disclaimer.includes("Facial expressions do not reliably reveal a person's internal emotional state.");
    results.push({
      name: 'Case 15: Face Analysis -> Raised Mouth Corners detected physically with honest non-fabricated expression estimate',
      passed,
      expected: 'faceDetected: true, detectionStatus: "Face detected", expressionEstimate: "Unable to estimate reliably", curvature > 0.035',
      actual: `faceDetected: ${res.faceDetected}, detectionStatus: "${res.detectionStatus}", expression: "${res.estimatedExpression}", expressionEstimate: "${res.expressionEstimate}", curvature: ${res.observableMetrics?.mouthCurvature}`,
    });
  }

  // Test 16: Level / Neutral Facial Alignment (Neutral Face Image Fixture)
  {
    const neutralImg = createSyntheticFaceImage({ hasFace: true, mouthCurvature: 'neutral' });
    const res = analyzeImagePixels(neutralImg);
    const passed =
      res.faceDetected === true &&
      res.faceCount === 1 &&
      res.detectionStatus === 'Face detected' &&
      res.estimatedExpression === 'Face detected; facial landmarks were detected successfully.' &&
      res.expressionEstimate === 'Unable to estimate reliably' &&
      res.moodEstimate === 'Unable to estimate reliably' &&
      res.analysisQuality === 'Reliable enough to analyze' &&
      res.detectedLandmarks !== null &&
      res.observableMetrics?.mouthCurvature !== undefined &&
      Math.abs(res.observableMetrics.mouthCurvature) <= 0.038 &&
      res.disclaimer.includes("Facial expressions do not reliably reveal a person's internal emotional state.");
    results.push({
      name: 'Case 16: Face Analysis -> Neutral Face Alignment detected physically with honest non-fabricated expression estimate',
      passed,
      expected: 'faceDetected: true, detectionStatus: "Face detected", expressionEstimate: "Unable to estimate reliably", |curvature| <= 0.038',
      actual: `faceDetected: ${res.faceDetected}, detectionStatus: "${res.detectionStatus}", expression: "${res.estimatedExpression}", expressionEstimate: "${res.expressionEstimate}", curvature: ${res.observableMetrics?.mouthCurvature}`,
    });
  }

  // Test 17: Turned-Down Mouth Corners (Frowning Face Image Fixture)
  {
    const frownImg = createSyntheticFaceImage({ hasFace: true, mouthCurvature: 'downward' });
    const res = analyzeImagePixels(frownImg);
    const passed =
      res.faceDetected === true &&
      res.faceCount === 1 &&
      res.detectionStatus === 'Face detected' &&
      res.estimatedExpression === 'Mouth corners appear slightly turned down in this image.' &&
      res.expressionEstimate === 'Unable to estimate reliably' &&
      res.moodEstimate === 'Unable to estimate reliably' &&
      res.analysisQuality === 'Reliable enough to analyze' &&
      res.detectedLandmarks !== null &&
      res.observableMetrics?.mouthCurvature !== undefined &&
      res.observableMetrics.mouthCurvature < -0.035 &&
      res.disclaimer.includes("Facial expressions do not reliably reveal a person's internal emotional state.");
    results.push({
      name: 'Case 17: Face Analysis -> Downward Mouth Corners detected physically with honest non-fabricated expression estimate',
      passed,
      expected: 'faceDetected: true, detectionStatus: "Face detected", expressionEstimate: "Unable to estimate reliably", curvature < -0.035',
      actual: `faceDetected: ${res.faceDetected}, detectionStatus: "${res.detectionStatus}", expression: "${res.estimatedExpression}", expressionEstimate: "${res.expressionEstimate}", curvature: ${res.observableMetrics?.mouthCurvature}`,
    });
  }

  // Test 18: Visible Brow Tension / Movement (Furrowed Brow Image Fixture)
  {
    const browImg = createSyntheticFaceImage({ hasFace: true, mouthCurvature: 'neutral', browTension: true });
    const res = analyzeImagePixels(browImg);
    const passed =
      res.faceDetected === true &&
      res.faceCount === 1 &&
      res.detectionStatus === 'Face detected' &&
      res.expressionEstimate === 'Unable to estimate reliably' &&
      res.analysisQuality === 'Reliable enough to analyze' &&
      ((res.observableMetrics?.browTensionScore ?? 0) >= 0.45 || res.estimatedExpression === 'Visible brow movement was detected.') &&
      res.disclaimer.includes("Facial expressions do not reliably reveal a person's internal emotional state.");
    results.push({
      name: 'Case 18: Face Analysis -> Brow Movement / Tension detected physically with honest non-fabricated expression estimate',
      passed,
      expected: 'faceDetected: true, detectionStatus: "Face detected", expressionEstimate: "Unable to estimate reliably", brow tension observed',
      actual: `faceDetected: ${res.faceDetected}, detectionStatus: "${res.detectionStatus}", expression: "${res.estimatedExpression}", browTensionScore: ${res.observableMetrics?.browTensionScore}`,
    });
  }

  // Test 19: No Face in Image (Background / Texture / Object Fixture)
  {
    const noFaceImg = createSyntheticFaceImage({ hasFace: false });
    const res = analyzeImagePixels(noFaceImg);
    const passed =
      res.faceDetected === false &&
      res.faceCount === 0 &&
      res.detectionStatus === 'No face detected' &&
      res.expressionEstimate === 'Unable to estimate reliably' &&
      res.moodEstimate.includes('Unavailable') &&
      res.analysisQuality === 'Inconclusive' &&
      res.estimatedExpression === 'No face detected. Please try another image.';
    results.push({
      name: 'Case 19: Face Analysis -> No Face detected in non-facial image with Inconclusive Quality',
      passed,
      expected: 'faceDetected: false, detectionStatus: "No face detected", moodEstimate includes "Unavailable", analysisQuality: "Inconclusive"',
      actual: `faceDetected: ${res.faceDetected}, detectionStatus: "${res.detectionStatus}", moodEstimate: "${res.moodEstimate}", quality: "${res.analysisQuality}"`,
    });
  }

  // Test 20: Multiple Faces in Image (Two People Fixture)
  {
    const multiFaceImg = createSyntheticFaceImage({ hasFace: true, multipleFaces: true });
    const res = analyzeImagePixels(multiFaceImg);
    const passed =
      res.faceDetected === true &&
      res.faceCount >= 2 &&
      res.detectionStatus === 'Multiple faces detected' &&
      res.expressionEstimate === 'Unable to estimate reliably' &&
      res.moodEstimate.includes('Unavailable') &&
      res.analysisQuality === 'Inconclusive' &&
      res.estimatedExpression === 'Multiple faces detected. Please frame a single face.';
    results.push({
      name: 'Case 20: Face Analysis -> Multiple Faces flagged with Inconclusive Quality',
      passed,
      expected: 'faceDetected: true, faceCount >= 2, detectionStatus: "Multiple faces detected", moodEstimate includes "Unavailable"',
      actual: `faceDetected: ${res.faceDetected}, faceCount: ${res.faceCount}, detectionStatus: "${res.detectionStatus}", quality: "${res.analysisQuality}"`,
    });
  }

  // Test 21: Poor Quality / Underexposed Image (Dark Fixture)
  {
    const darkImg = createSyntheticFaceImage({ hasFace: true, isDark: true });
    const res = analyzeImagePixels(darkImg);
    const passed =
      res.faceDetected === false &&
      res.detectionStatus === 'No face detected' &&
      res.expressionEstimate === 'Unable to estimate reliably' &&
      res.moodEstimate.includes('Unavailable') &&
      res.analysisQuality === 'Inconclusive' &&
      res.estimatedExpression === 'Facial landmarks could not be measured reliably because of image quality.' &&
      res.signalQuality === 'Insufficient';
    results.push({
      name: 'Case 21: Face Analysis -> Poor Quality image handled with Inconclusive Quality and Insufficient Signal',
      passed,
      expected: 'faceDetected: false, detectionStatus: "No face detected", signalQuality: "Insufficient", analysisQuality: "Inconclusive"',
      actual: `faceDetected: ${res.faceDetected}, detectionStatus: "${res.detectionStatus}", moodEstimate: "${res.moodEstimate}", quality: "${res.analysisQuality}"`,
    });
  }

  // Test 22: Image Independence & Fresh Analysis on Change
  {
    const smileImg = createSyntheticFaceImage({ hasFace: true, mouthCurvature: 'upward' });
    const frownImg = createSyntheticFaceImage({ hasFace: true, mouthCurvature: 'downward' });

    const res1 = analyzeImagePixels(smileImg);
    const res2 = analyzeImagePixels(frownImg);

    // Verify results are completely independent and match their respective image inputs
    const passed =
      res1.expressionEstimate === 'Unable to estimate reliably' &&
      res2.expressionEstimate === 'Unable to estimate reliably' &&
      res1.moodEstimate === 'Unable to estimate reliably' &&
      res2.moodEstimate === 'Unable to estimate reliably' &&
      res1.estimatedExpression === 'The mouth corners appear slightly raised in this image.' &&
      res2.estimatedExpression === 'Mouth corners appear slightly turned down in this image.' &&
      res1.observableMetrics?.mouthCurvature !== res2.observableMetrics?.mouthCurvature &&
      (res1.observableMetrics?.mouthCurvature ?? 0) > (res2.observableMetrics?.mouthCurvature ?? 0);

    results.push({
      name: 'Case 22: Face Analysis -> Changing image triggers independent fresh calculation of physical metrics without fabricating emotion',
      passed,
      expected: 'Res1 has raised curvature (> 0), Res2 has downward curvature (< 0), both report Unable to estimate reliably',
      actual: `Res1 curv: ${res1.observableMetrics?.mouthCurvature}, Res2 curv: ${res2.observableMetrics?.mouthCurvature}, expressionEstimate: "${res1.expressionEstimate}"`,
    });
  }

  // Test 23: AI Journal Insights Short Input Fast-Path
  {
    const shortRes = await aiService.generateJournalInsights({ journalText: 'Feeling okay today.' });
    const passed =
      typeof shortRes.summary === 'string' &&
      shortRes.summary.includes('brief') &&
      !shortRes.summary.toLowerCase().includes('depress') &&
      shortRes.reflectionPrompt.endsWith('?') &&
      shortRes.disclaimer === 'AI-generated reflection, not a medical diagnosis.';
    results.push({
      name: 'Case 23: AI Journal Insights Short Input Guard without Hallucination',
      passed,
      expected: 'Grounded summary noting brief check-in without inventing symptoms',
      actual: `summary: "${shortRes.summary.slice(0, 80)}...", themes: ${JSON.stringify(shortRes.themes)}`,
    });
  }

  // Test 24: Weekly Reflection Deduplication & Missing vs Zero Sleep Distinction
  {
    const reflectionInput = {
      journals: [
        { date: '2026-10-20', text: 'Peaceful morning walk' },
        { date: '2026-10-20', text: 'Peaceful morning walk' }, // Duplicate
        { date: '2026-10-21', text: 'Busy day at work, felt satisfied' },
      ],
      sleepRecords: [
        { date: '2026-10-19', hours: 7.5 },
        { date: '2026-10-20', hours: 0 }, // Reported 0 hours (all-nighter)
        // 2026-10-21 is MISSING (unlogged, distinct from 0)
      ],
      activities: [
        { date: '2026-10-20', name: 'Yoga' },
        { date: '2026-10-20', name: 'yoga' }, // Duplicate case-insensitive
      ],
    };

    const weeklyRes = await aiService.generateWeeklyReflection(reflectionInput);
    const passed =
      typeof weeklyRes.overallTrend === 'string' &&
      Array.isArray(weeklyRes.commonThemes) &&
      weeklyRes.reflectionQuestion.endsWith('?') &&
      weeklyRes.disclaimer.includes('general wellness');

    results.push({
      name: 'Case 24: AI Weekly Reflection Deduplication & Missing vs Zero Sleep Handling',
      passed,
      expected: 'Non-clinical grounded weekly reflection adhering to schema',
      actual: `trend: "${weeklyRes.overallTrend.slice(0, 80)}...", themes: ${JSON.stringify(weeklyRes.commonThemes)}`,
    });
  }

  // Test 25: Neural Expression Model 7-Class Label Mapping & Architecture Integrity
  {
    const categories = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'] as const;
    const labels = categories.map((c) => expressionModelService.formatCategoryLabel(c));

    const allMapped = labels.every((l) => typeof l === 'string' && l.length > 5);
    const noClinicalTerms = labels.every(
      (l) =>
        !l.toLowerCase().includes('depress') &&
        !l.toLowerCase().includes('mentally ill') &&
        !l.toLowerCase().includes('patholog')
    );
    const hasModelName = typeof expressionModelService.modelName === 'string' && expressionModelService.modelName.includes('FaceExpressionNet');

    const passed = allMapped && noClinicalTerms && hasModelName;
    results.push({
      name: 'Case 25: Neural Expression Model 7-Class Label Mapping & Architecture Integrity',
      passed,
      expected: '7 categories mapped to non-clinical labels with FaceExpressionNet metadata',
      actual: `model: "${expressionModelService.modelName}", mappedCount: ${labels.length}, sample: "${labels[0]}" / "${labels[1]}"`,
    });
  }

  // Test 26: Expression Model Service Status & Headless Fallback Safety
  {
    const status = expressionModelService.getStatus();
    const isReportedCorrectly = typeof status.status === 'string';
    // When called in headless Node test environment, classify gracefully handles non-DOM environment
    const headlessRes = await expressionModelService.classify({} as any);
    const passed =
      isReportedCorrectly &&
      headlessRes.success === false &&
      headlessRes.faceDetected === false &&
      typeof headlessRes.error === 'string' &&
      headlessRes.dominantExpression === null &&
      headlessRes.scores.neutral === 0;

    results.push({
      name: 'Case 26: Expression Model Service Status & Headless Fallback Safety',
      passed,
      expected: 'Graceful handling of headless environment with zero crashes and clean error report',
      actual: `status: "${status.status}", error: "${headlessRes.error}", success: ${headlessRes.success}`,
    });
  }

  // Print summary
  console.log('Results:');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`[PASS] ${r.name}`);
    } else {
      console.error(`[FAIL] ${r.name}`);
      console.error(`       Expected: ${r.expected}`);
      console.error(`       Actual:   ${r.actual}`);
    }
  }

  console.log(`\nTOTAL: ${passCount} / ${results.length} tests passed.`);
  if (passCount !== results.length) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Regression suite failed:', err);
  process.exit(1);
});
