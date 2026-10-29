# Implementation Plan: Browser-Based Facial Expression Classifier

## 1. User Intent & Clarifications
- **Primary Objective**: Replace the landmark-only heuristic notice ("Unable to estimate reliably") with a genuine, browser-compatible machine-learning facial-expression classification model.
- **Inference Runtime & Assets**: Selected **TensorFlow.js with local public model files** (`/public/models/`). Model weights and manifests will be hosted directly within the application's static assets for 100% offline, private, zero-latency inference.
- **Expression Classes**: Standard 7 basic facial expression categories (`neutral`, `happy`, `sad`, `surprised`, `fearful`, `disgusted`, `angry`), accompanied by raw model output scores clearly labeled as model scores (not emotional diagnoses).
- **Core Constraints**:
  - Local inference only; zero image uploads or server transmissions.
  - No biometric identification, facial recognition, or permanent storage of frames.
  - Explicit disclaimer: *"Facial expressions do not reliably reveal a person's internal emotional state. This result is an uncertain visual estimate, not a diagnosis or a definitive statement about how you feel."*
  - Never use pathological or clinical labels such as "depressed", "mentally ill", or "emotionally unstable".
  - Graceful degradation with clear loading, error, and no-face states.

---

## 2. Domain Design & Aesthetic System
- **Domain Native Language**: Mental wellness & self-reflection companion. Clean, calm, non-judgmental typography, avoiding alarming clinical diagnostics.
- **Visual Presentation**:
  - **Model Loading State**: Subtle inline progress indicator with quiet status typography when downloading/initializing local model shards.
  - **Expression Classification Display**: Shows the dominant visible facial-expression category with an explicit "Visual Expression Estimate" qualifier.
  - **Raw Model Scores Breakdown**: Clean, unboxed horizontal meter bars showing relative model scores across the 7 categories without pseudo-scientific certainty claims.
  - **No-Pill Discipline**: Status indicators and metric labels presented as clean inline typography with subtle separators (`·`) rather than heavy candy badges.
  - **Contrast & Accessibility**: WCAG AA compliant colors, dark-mode compatible using existing slate/purple design tokens.

---

## 3. Architecture & Dependency Plan

### Dependencies
- `@vladmandic/face-api`: Modern, TypeScript-native fork of face-api.js supporting TensorFlow.js in modern bundlers (Vite + React 19).
- Model files placed in `/public/models/`:
  - `face_expression_model-weights_manifest.json` (~2 KB)
  - `face_expression_model-shard1` (~329 KB)
  - `tiny_face_detector_model-weights_manifest.json` (~2 KB)
  - `tiny_face_detector_model-shard1` (~190 KB)
  - Total asset size: < 530 KB. Permissively licensed under MIT.

### Architectural Workflow
1. **Model Loader Service (`src/services/expressionModelService.ts`)**:
   - Singleton pattern ensuring models load exactly once.
   - Reusable across sessions; cached in browser memory.
   - Exposes `loadExpressionModels()`, `classifyFaceExpression(imageSource)`, and status flags (`isLoaded`, `isLoading`, `loadError`).
2. **Analysis Pipeline Integration (`src/utils/cameraMoodAnalyzer.ts`)**:
   - Combines existing fast anthropometric landmark detection with ML expression inference.
   - When ML model is loaded and face is located, crops face ROI and feeds it to `faceExpressionNet`.
   - Returns structured `CameraAnalysisResult` containing genuine `expressionCategory`, `modelScores` (all 7 classes), `dominantScore`, and `classifierModelName`.
3. **Component UI Layer (`src/components/moodcheck/CameraMoodCheckCard.tsx`)**:
   - Manages explicit camera permissions and hardware lifecycle (stopping tracks immediately after capture).
   - Renders fresh inference results with raw model score breakdowns.
   - Guarantees immediate cleanup on retake or file replacement.

---

## 4. Proposed File Changes

### New Files
- `public/models/face_expression_model-weights_manifest.json`: Model manifest defining layer architecture and tensor shapes for FER.
- `public/models/face_expression_model-shard1`: Binary weights shard for the 7-class expression net.
- `public/models/tiny_face_detector_model-weights_manifest.json`: Manifest for the lightweight face detector.
- `public/models/tiny_face_detector_model-shard1`: Binary weights shard for the face detector.
- `src/services/expressionModelService.ts`: Dedicated service managing TensorFlow.js / face-api model loading, caching, tensor preprocessing, inference, and error handling.

### Modified Files
- `package.json`: Install `@vladmandic/face-api`.
- `src/types/index.ts`: Update `CameraAnalysisResult` to include `modelScores` (record of 7 expression scores), `dominantExpression`, and model load metadata.
- `src/utils/cameraMoodAnalyzer.ts`: Integrate `expressionModelService` into the analysis pipeline.
- `src/components/moodcheck/CameraMoodCheckCard.tsx`: Add model loading progress banner, model score breakdown visualization, and updated expression display cards.
- `scripts/accuracy_validation.ts`: Add test cases validating ML model initialization, 7-class output mapping, score bounding, and error recovery.

---

## 5. Testing & Verification Plan

1. **Model Loading Verification**: Verify `/public/models/*` assets load without 404s or MIME type errors in Vite.
2. **Inference Execution**:
   - Run inference on test images (smiling, neutral, frowning, surprised).
   - Confirm dominant class corresponds to visual cues with independent scores across images.
3. **Edge Case & Error Handling**:
   - No face detected: Decisive fallback reporting "No face detected" with zero fabricated scores.
   - Corrupted / small image: Inconclusive status with informative guidance.
   - Model offline / loading error: Graceful fallback reporting model initialization state without crashing.
4. **Regression & Safety**:
   - Confirm sentiment analysis regression tests (Cases 1–14, 23–24) continue to pass 100%.
   - Confirm camera hardware tracks stop immediately after snapshot capture.
   - Verify `tsc --noEmit` and `npm run build` compile cleanly without bundle errors.
