import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Sparkles,
  AlertCircle,
  Shield,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Info,
  Check,
  Eye,
  Smile as SmileIcon,
  XCircle,
  Lock,
  Upload,
  Image as ImageIcon,
  UserCheck,
  UserX,
  ScanFace,
} from 'lucide-react';
import { CameraAnalysisResult, MoodType, MoodCheckRecord, ExpressionCategory } from '../../types';
import { analyzeCanvasFrame, analyzeImageWithClassifier, analyzeImageDataUrl } from '../../utils/cameraMoodAnalyzer';
import { expressionModelService } from '../../services/expressionModelService';
import { api } from '../../services/api';

export interface CameraMoodCheckCardProps {
  autoStart?: boolean;
  autoAnalyzeRequestId?: number;
  onResult?: (result: CameraAnalysisResult, userFeedback?: string, manualOverrideMood?: MoodType) => void;
  selectedManualMood?: MoodType;
  onSelectManualMood?: (mood: MoodType) => void;
  journalEntryId?: string;
  journalSentiment?: string;
  onSaveMoodCheck?: (record: MoodCheckRecord) => void;
  onSkip?: () => void;
  title?: string;
  subtitle?: string;
}

export const CameraMoodCheckCard: React.FC<CameraMoodCheckCardProps> = ({
  onResult,
  selectedManualMood,
  onSelectManualMood,
  journalEntryId,
  journalSentiment,
  onSaveMoodCheck,
  onSkip,
  title = 'Camera Expression Estimate',
  subtitle = 'Optional visible facial expression analysis processed entirely in your browser.',
}) => {
  // In-app explicit user consent state:
  // 'pending' = initial state requiring user consent before any camera access
  // 'consented' = user explicitly clicked "Allow Camera & Capture" or selected an image
  // 'skipped' = user chose "Skip Camera Analysis"
  const [consentStatus, setConsentStatus] = useState<'pending' | 'consented' | 'skipped'>('pending');
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CameraAnalysisResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [userMatchFeedback, setUserMatchFeedback] = useState<'Yes' | 'Somewhat' | 'No' | null>(null);
  const [localManualMood, setLocalManualMood] = useState<MoodType | undefined>(selectedManualMood);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const currentRequestIdRef = useRef<number>(0);

  // Sync prop manual mood if changed externally
  useEffect(() => {
    if (selectedManualMood) {
      setLocalManualMood(selectedManualMood);
    }
  }, [selectedManualMood]);

  // Clean up all video tracks on unmount & pre-warm neural model in idle time
  useEffect(() => {
    isMountedRef.current = true;
    expressionModelService.loadModels().catch((err) => {
      console.warn('[CameraMoodCheckCard] Pre-warm model load notice:', err);
    });
    return () => {
      isMountedRef.current = false;
      currentRequestIdRef.current++;
      stopCamera();
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (isMountedRef.current) {
      setStreamActive(false);
      setAnalyzing(false);
    }
  }, []);

  /**
   * Only called when the user explicitly clicks "Allow Camera & Capture"
   * or "Retake or Retry". Never called from useEffect or lifecycle hooks.
   */
  const handleAllowAndCapture = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    // Increment request ID to invalidate any prior asynchronous analyses
    const reqId = ++currentRequestIdRef.current;

    // Clear prior image and analysis immediately so old results never linger
    setCapturedImage(null);
    setAnalysisResult(null);
    setUserMatchFeedback(null);
    setConsentStatus('consented');
    setPermissionError(null);
    setAnalyzing(true);
    setStatusMessage('Requesting camera access...');

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported or unavailable in this browser environment.');
      }

      // Explicitly invoke getUserMedia directly from user click interaction
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (!isMountedRef.current || currentRequestIdRef.current !== reqId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setStreamActive(true);
      setStatusMessage('Camera active, preparing frame capture...');

      // Ensure video element is available
      let videoEl = videoRef.current;
      if (!videoEl) {
        for (let i = 0; i < 12 && !videoEl; i++) {
          await new Promise((r) => setTimeout(r, 50));
          videoEl = videoRef.current;
        }
      }

      if (videoEl) {
        videoEl.srcObject = stream;
        // Wait for video stream to receive first frame and start playback
        await new Promise<void>((resolve) => {
          if (!videoEl || videoEl.readyState >= 2) {
            return resolve();
          }
          const handleLoaded = () => {
            videoEl?.removeEventListener('loadeddata', handleLoaded);
            resolve();
          };
          videoEl.addEventListener('loadeddata', handleLoaded);
          setTimeout(resolve, 800);
        });
        await videoEl.play().catch(() => {});
      }

      setStatusMessage('Capturing frame and estimating visible expression...');

      // Allow 450ms for camera auto-exposure and frame buffer stabilization
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Wait until video element has non-zero dimensions
      let dimensionCheckTries = 0;
      while (videoEl && (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) && dimensionCheckTries < 20) {
        await new Promise((r) => setTimeout(r, 50));
        dimensionCheckTries++;
      }

      let canvasEl = canvasRef.current;
      if (!canvasEl) {
        for (let i = 0; i < 6 && !canvasEl; i++) {
          await new Promise((r) => setTimeout(r, 50));
          canvasEl = canvasRef.current;
        }
      }

      if (videoEl && canvasEl && isMountedRef.current && currentRequestIdRef.current === reqId) {
        const frameWidth = videoEl.videoWidth || 640;
        const frameHeight = videoEl.videoHeight || 480;
        canvasEl.width = frameWidth;
        canvasEl.height = frameHeight;

        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, frameWidth, frameHeight);
          try {
            const dataUrl = canvasEl.toDataURL('image/jpeg', 0.85);
            if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/jpeg') && dataUrl.length > 100) {
              setCapturedImage(dataUrl);
            } else {
              console.warn('[CameraCapture] Generated data URL was invalid or empty.');
            }
          } catch (captureErr) {
            console.error('[CameraCapture] Error converting frame to data URL:', captureErr);
          }
        }

        // Run actual image-based facial landmark & ML expression classification on the captured frame
        setStatusMessage('Running neural expression classification on captured frame...');
        const result = await analyzeImageWithClassifier(canvasEl);

        if (isMountedRef.current && currentRequestIdRef.current === reqId) {
          setAnalysisResult(result);
          setUserMatchFeedback(null);
          setStatusMessage(result.faceDetected ? 'Facial landmarks & expression analyzed.' : 'Analysis complete: no face detected.');

          if (onResult) {
            onResult(result);
          }
        }
      }
    } catch (err: any) {
      console.warn('Camera permission or device error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Camera access was denied by your browser. Note: Previously granted permissions in browser site settings determine whether this prompt appears. You can also select an image file below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('No camera device was detected on your system. You can choose an image file below or continue journal analysis.');
      } else {
        setPermissionError(err.message || 'Unable to access camera device. Please try again or select an image file.');
      }
    } finally {
      // STOP EVERY CAMERA TRACK IMMEDIATELY AFTER CAPTURE
      // Strict rule: Hardware camera never runs in background
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (isMountedRef.current) {
        setStreamActive(false);
        setAnalyzing(false);
      }
      isStartingRef.current = false;
    }
  };

  /**
   * Allows the user to select an image file directly (for testing diverse pictures
   * of smiling, neutral, no-face, multiple faces, or poor lighting).
   */
  const handleImageFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopCamera();
    const reqId = ++currentRequestIdRef.current;

    // Clear previous results immediately
    setCapturedImage(null);
    setAnalysisResult(null);
    setUserMatchFeedback(null);
    setConsentStatus('consented');
    setPermissionError(null);
    setAnalyzing(true);
    setStatusMessage('Reading and analyzing selected image file...');

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl || !isMountedRef.current || currentRequestIdRef.current !== reqId) {
        setAnalyzing(false);
        return;
      }

      setCapturedImage(dataUrl);

      const img = new Image();
      img.onload = async () => {
        if (!isMountedRef.current || currentRequestIdRef.current !== reqId) return;

        try {
          setStatusMessage('Running neural expression classification on selected image...');
          const result = await analyzeImageWithClassifier(img);
          if (!isMountedRef.current || currentRequestIdRef.current !== reqId) return;

          setAnalysisResult(result);
          setAnalyzing(false);
          setStatusMessage(
            result.faceDetected
              ? 'Facial landmarks & expression analyzed from selected image.'
              : 'Analysis complete: no face detected in selected image.'
          );
          if (onResult) {
            onResult(result);
          }
        } catch (analysisErr: any) {
          setAnalyzing(false);
          setPermissionError('Could not analyze the chosen image: ' + (analysisErr.message || 'unknown error'));
        }
      };
      img.onerror = () => {
        if (isMountedRef.current && currentRequestIdRef.current === reqId) {
          setAnalyzing(false);
          setPermissionError('Failed to load selected image into memory.');
        }
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      if (isMountedRef.current && currentRequestIdRef.current === reqId) {
        setAnalyzing(false);
        setPermissionError('Failed to read the selected file.');
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * Explicitly analyzes the currently displayed captured or selected image.
   * Can be invoked via the "Analyze Face" button or re-run on demand.
   */
  const handleAnalyzeFace = async () => {
    if (!capturedImage) return;
    const reqId = ++currentRequestIdRef.current;
    setAnalyzing(true);
    setStatusMessage('Analyzing facial landmarks and estimating mood cues...');
    setPermissionError(null);

    try {
      const result = await analyzeImageDataUrl(
        capturedImage,
        reqId,
        (id) => id === currentRequestIdRef.current
      );

      if (!result || !isMountedRef.current || currentRequestIdRef.current !== reqId) {
        return;
      }

      setAnalysisResult(result);
      setUserMatchFeedback(null);
      setStatusMessage(
        result.faceDetected
          ? 'Facial landmarks analyzed successfully.'
          : 'Analysis complete: no face detected.'
      );

      if (onResult) {
        onResult(result);
      }
    } catch (analysisErr: any) {
      if (isMountedRef.current && currentRequestIdRef.current === reqId) {
        setPermissionError('Could not analyze the image: ' + (analysisErr.message || 'unknown error'));
      }
    } finally {
      if (isMountedRef.current && currentRequestIdRef.current === reqId) {
        setAnalyzing(false);
      }
    }
  };

  const handleSkipConsent = () => {
    stopCamera();
    currentRequestIdRef.current++;
    setConsentStatus('skipped');
    if (onSkip) {
      onSkip();
    }
  };

  const handleRemoveImage = () => {
    // Invalidate any ongoing asynchronous analysis
    currentRequestIdRef.current++;
    stopCamera();
    // Clear image and result immediately
    setCapturedImage(null);
    setAnalysisResult(null);
    setUserMatchFeedback(null);
    setPermissionError(null);
    setStatusMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleManualMoodPick = (mood: MoodType) => {
    setLocalManualMood(mood);
    if (onSelectManualMood) {
      onSelectManualMood(mood);
    }
    if (onResult && analysisResult) {
      onResult(analysisResult, userMatchFeedback || undefined, mood);
    }
  };

  const handleFeedbackSelect = (feedback: 'Yes' | 'Somewhat' | 'No') => {
    setUserMatchFeedback(feedback);
    if (onResult && analysisResult) {
      onResult(analysisResult, feedback, localManualMood);
    }
  };

  const handleSaveToRecords = async () => {
    if (!analysisResult) return;
    setIsSaving(true);
    try {
      const res = await api.saveMoodCheck({
        manualMood: localManualMood,
        cameraEstimate: analysisResult.moodEstimate || analysisResult.estimatedExpression,
        cameraConfidence: analysisResult.confidence,
        journalSentiment: journalSentiment,
        journalEntryId: journalEntryId,
        date: new Date().toISOString().split('T')[0],
      });

      setSavedSuccess(true);
      if (onSaveMoodCheck) {
        onSaveMoodCheck(res.record);
      }
      setTimeout(() => setSavedSuccess(false), 4500);
    } catch (err: any) {
      console.warn('Failed to save camera mood check:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // If user chose to skip camera analysis
  if (consentStatus === 'skipped') {
    return (
      <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-2xl p-5 shadow-xs transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
            <span>
              Camera expression analysis skipped. Your journal reflection, sentiment analysis, and AI insights remain active.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setConsentStatus('pending');
              setPermissionError(null);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 font-semibold transition-all cursor-pointer w-fit"
          >
            Change Mind & Allow Camera
          </button>
        </div>
      </div>
    );
  }

  // 1. IN-APP EXPLICIT CONSENT DIALOG / SECTION
  // Shown when consent is pending and no image/analysis has been performed yet
  if (consentStatus === 'pending' && !capturedImage && !analysisResult && !analyzing) {
    return (
      <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 transition-colors duration-200">
        {/* Hidden File Input for Image Selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileSelect}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                  {title}
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-[#2e1d52] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-[#5b21b6]">
                  Optional
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 w-fit">
            <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            Client-Side Only
          </span>
        </div>

        {/* In-App Consent Notice & Privacy Details */}
        <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/50 rounded-2xl p-4 sm:p-5 space-y-3.5 text-xs text-purple-950 dark:text-purple-200">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h4 className="font-bold text-sm text-purple-950 dark:text-purple-100">
                Camera Access Consent Request
              </h4>
              <p className="text-purple-900/90 dark:text-purple-200/90 leading-relaxed text-[12px]">
                The app would like to access your camera to capture <strong>a single photo frame</strong> to measure observable facial geometry (such as mouth corners, brow elevation, and symmetry).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11.5px]">
            <div className="bg-white/80 dark:bg-[#0e1424]/80 p-3 rounded-xl border border-purple-200/60 dark:border-purple-800/40 space-y-1">
              <span className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Temporary Browser Memory Only
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-snug">
                The captured frame is processed locally on your device canvas. It is <strong>never uploaded, saved to a database, or sent to external AI servers</strong>.
              </p>
            </div>

            <div className="bg-white/80 dark:bg-[#0e1424]/80 p-3 rounded-xl border border-purple-200/60 dark:border-purple-800/40 space-y-1">
              <span className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Measurable Observations Disclaimer
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-snug">
                Facial landmark geometry does not indicate real emotional feelings. This estimation is purely supplemental; your own self-reported mood is always authoritative.
              </p>
            </div>
          </div>
        </div>

        {/* Permission / Device Error Banner */}
        {permissionError && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-semibold">Camera Access Notice</p>
              <p>{permissionError}</p>
            </div>
          </div>
        )}

        {/* Consent Action Buttons */}
        <div className="flex flex-wrap items-center justify-start gap-3 pt-1">
          <button
            type="button"
            onClick={handleAllowAndCapture}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Allow Camera & Capture</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Select Image File</span>
          </button>

          <button
            type="button"
            onClick={handleSkipConsent}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer"
          >
            Skip Camera Analysis
          </button>
        </div>
      </div>
    );
  }

  // 2. ACTIVE / CAPTURED / RESULTS VIEW
  const isUncertain =
    analysisResult &&
    (!analysisResult.faceDetected ||
      analysisResult.confidence < 0.65 ||
      analysisResult.estimatedExpression === 'Unable to estimate reliably' ||
      analysisResult.estimatedExpression === 'No face detected. Please try another image.' ||
      analysisResult.estimatedExpression === 'Multiple faces detected. Please frame a single face.' ||
      analysisResult.estimatedExpression === 'Facial landmarks could not be measured reliably because of image quality.' ||
      !analysisResult.isReliable);

  return (
    <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 transition-colors duration-200">
      {/* Hidden File Input for Image Selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                {title}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-[#2e1d52] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-[#5b21b6]">
                Client-Side Canvas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 w-fit">
          <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          No raw images or video saved
        </span>
      </div>

      {/* Mandatory Transparent Explanation Banner */}
      <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/50 rounded-xl p-3.5 sm:p-4 text-xs text-purple-950 dark:text-purple-200 leading-relaxed flex items-start gap-2.5">
        <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-purple-900 dark:text-purple-100">
            About Camera Facial Geometry Analysis
          </p>
          <p className="text-purple-800 dark:text-purple-300 text-[11.5px] leading-relaxed">
            Your camera is used only to measure 2D physical landmark geometry (such as mouth curvature and brow position) on your local device. Facial appearance does not indicate real emotional feelings. Your own self-reported mood is always the true and authoritative record.
          </p>
        </div>
      </div>

      {/* Permission / Device Error Banner */}
      {permissionError && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-semibold">Camera Access Notice</p>
            <p>{permissionError}</p>
            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={handleSkipConsent}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                Continue without camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-[11px] font-medium hover:bg-slate-200 cursor-pointer"
              >
                Select Image File
              </button>
              <button
                type="button"
                onClick={handleAllowAndCapture}
                className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[11px] font-medium hover:bg-purple-700 cursor-pointer"
              >
                Try Camera Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frame Preview Box */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 aspect-video max-w-md mx-auto flex items-center justify-center shadow-inner">
        {/* Live video element */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            streamActive ? 'block' : 'hidden'
          }`}
        />

        {/* Hidden offscreen canvas for instantaneous raster computation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Analyzing / Active Loading Overlay */}
        {analyzing && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-2.5 z-10">
            <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-white">{statusMessage || 'Capturing frame...'}</p>
              <p className="text-[11px] text-slate-300">Processing locally inside browser memory</p>
            </div>
            {streamActive && (
              <button
                type="button"
                onClick={stopCamera}
                className="mt-2 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CameraOff className="w-3 h-3" />
                <span>Stop Camera</span>
              </button>
            )}
          </div>
        )}

        {/* Captured Frame Display */}
        {!streamActive && capturedImage && !analyzing && (
          <div className="relative w-full h-full flex items-center justify-center bg-black/95">
            <img
              src={capturedImage}
              alt="Captured camera frame for visible expression estimate"
              className="w-full h-full object-contain"
            />
            <div
              className={`absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 border z-20 shadow-sm ${
                analysisResult
                  ? 'text-emerald-300 border-emerald-500/30'
                  : 'text-purple-300 border-purple-500/30'
              }`}
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${analysisResult ? 'text-emerald-400' : 'text-purple-400'}`}
              />
              <span>{analysisResult ? 'Captured Frame Analyzed' : 'Image Captured — Ready to Analyze'}</span>
            </div>
            <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-slate-300 z-20">
              Browser memory only &bull; Not uploaded
            </div>
          </div>
        )}

        {/* Inactive State Display */}
        {!streamActive && !capturedImage && !analyzing && (
          <div className="text-center p-6 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Camera className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">
                Camera is off
              </p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Click "Allow Camera & Capture" to take a frame, or choose an image file for landmark analysis.
              </p>
            </div>
          </div>
        )}

        {/* Active streaming badge */}
        {streamActive && (
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] text-purple-300 font-medium flex items-center gap-1.5 border border-purple-500/30 z-20">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span>Camera Active (Browser-Only)</span>
          </div>
        )}
      </div>

      {/* Action Toolbar / Controls for All States */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {streamActive ? (
          <button
            type="button"
            onClick={stopCamera}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer"
          >
            <CameraOff className="w-4 h-4" />
            <span>Stop Camera</span>
          </button>
        ) : !capturedImage ? (
          /* State 1: No image captured */
          <>
            <button
              type="button"
              onClick={handleAllowAndCapture}
              disabled={analyzing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white shadow-xs transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Allow Camera & Capture</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Choose Image</span>
            </button>
            <button
              type="button"
              onClick={handleSkipConsent}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Skip Camera
            </button>
          </>
        ) : !analysisResult ? (
          /* State 2: Image captured but not yet analyzed */
          <>
            <button
              type="button"
              onClick={handleAnalyzeFace}
              disabled={analyzing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <ScanFace className="w-4 h-4" />
              <span>Analyze Face</span>
            </button>
            <button
              type="button"
              onClick={handleAllowAndCapture}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retake Image</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Change Image</span>
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={analyzing}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 transition-all cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Remove Image</span>
            </button>
          </>
        ) : (
          /* State 4: Analysis completed */
          <>
            <button
              type="button"
              onClick={handleAnalyzeFace}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 transition-all cursor-pointer"
            >
              <ScanFace className="w-3.5 h-3.5" />
              <span>Re-analyze Face</span>
            </button>
            <button
              type="button"
              onClick={handleAllowAndCapture}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retake Image</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Change Image</span>
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={analyzing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 transition-all cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Remove Image</span>
            </button>
            <button
              type="button"
              onClick={handleSaveToRecords}
              disabled={isSaving || savedSuccess || !analysisResult}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white transition-all cursor-pointer shadow-xs"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved to Records</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Estimate to Records'}</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Complete Result Card */}
      {analysisResult && (
        <div className="bg-slate-50 dark:bg-[#1a233c] border border-slate-200 dark:border-[#2d3b64] rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
          {/* Thumbnail & Source Info */}
          {capturedImage && (
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#13192b] rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
              <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-300 dark:border-slate-700 shrink-0">
                <img
                  src={capturedImage}
                  alt="Analyzed camera frame thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  Analyzed Face Image
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Processed locally in browser memory &bull; Never uploaded or stored on servers
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-1 font-medium cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}

          {/* Section 1: Face Detection */}
          <div className="bg-white dark:bg-[#13192b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {analysisResult.faceDetected ? (
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Face Detection
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  analysisResult.faceDetected && analysisResult.faceCount === 1
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40'
                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40'
                }`}
              >
                {analysisResult.detectionStatus ||
                  (analysisResult.faceDetected
                    ? analysisResult.faceCount > 1
                      ? 'Multiple faces detected'
                      : 'Face detected'
                    : 'No face detected')}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {analysisResult.faceDetected
                ? analysisResult.faceCount > 1
                  ? 'Multiple faces detected in the image frame. For accurate measurement, position a single face.'
                  : 'A single human face was localized with anthropometric 2D landmark coordinates.'
                : 'No clear human face or facial landmarks could be distinguished in this frame. Position your face in good lighting and retry.'}
            </p>
          </div>

          {/* Section 2: Expression Estimate */}
          <div className="bg-white dark:bg-[#13192b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Expression Estimate
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                {analysisResult.dominantExpression
                  ? `${analysisResult.dominantExpression.toUpperCase()} (${Math.round((analysisResult.modelOutputConfidence || 0) * 100)}% model score)`
                  : analysisResult.expressionEstimate || 'Unable to estimate reliably'}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Visible expression category:
              </p>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {analysisResult.expressionEstimate || 'Unable to estimate reliably'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Model: {analysisResult.classifierModelName || 'FaceExpressionNet (Separable FER)'} &bull; 100% Client-side browser inference
              </p>
            </div>

            {/* 7-Class Neural Expression Model Scores */}
            {analysisResult.expressionScores ? (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-[11px] uppercase tracking-wider">
                    Model Output Scores (7 Classes)
                  </span>
                  <span className="text-[10px] text-slate-400">Relative model scores</span>
                </div>

                <div className="space-y-1.5">
                  {(
                    [
                      ['neutral', 'Neutral'],
                      ['happy', 'Happy'],
                      ['sad', 'Sad'],
                      ['surprised', 'Surprised'],
                      ['fearful', 'Fearful'],
                      ['disgusted', 'Disgusted'],
                      ['angry', 'Angry'],
                    ] as const
                  ).map(([key, label]) => {
                    const score = analysisResult.expressionScores?.[key] || 0;
                    const percent = Math.round(score * 100);
                    const isDominant = analysisResult.dominantExpression === key;

                    return (
                      <div key={key} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={
                              isDominant
                                ? 'font-bold text-purple-700 dark:text-purple-300'
                                : 'text-slate-600 dark:text-slate-400'
                            }
                          >
                            {label} {isDominant && '(Dominant)'}
                          </span>
                          <span
                            className={
                              isDominant
                                ? 'font-bold text-purple-700 dark:text-purple-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }
                          >
                            {(score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isDominant
                                ? 'bg-purple-600 dark:bg-purple-400'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 pt-1 leading-relaxed">
                  Notice: Model scores reflect visible 2D facial patterns detected in this image frame, not calibrated probabilities or emotional diagnoses. Self-reported mood is your authoritative truth.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {analysisResult.modelErrorMessage
                  ? `Inference note: ${analysisResult.modelErrorMessage}`
                  : 'Facial landmarks localized with observable geometric cues. When neural model classification is loading or inconclusive, no emotional labels are fabricated.'}
              </p>
            )}
          </div>

          {/* Section 3: Visual Observations */}
          <div className="bg-white dark:bg-[#13192b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Visual Observations
                </span>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Physical 2D Observations
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Observable physical cue:
              </p>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                <span
                  className={
                    analysisResult.faceDetected
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }
                >
                  {analysisResult.estimatedExpression}
                </span>
              </h4>
            </div>

            {/* Observable Metrics Breakdown */}
            {analysisResult.observableMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="bg-slate-50 dark:bg-[#0e1322] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                  <span className="text-[10px] text-slate-400 block">Lighting Quality</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {analysisResult.observableMetrics.lightingQuality}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-[#0e1322] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                  <span className="text-[10px] text-slate-400 block">Mouth Curvature</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {analysisResult.observableMetrics.mouthCurvature !== undefined
                      ? analysisResult.observableMetrics.mouthCurvature > 0.035
                        ? `Raised (+${analysisResult.observableMetrics.mouthCurvature})`
                        : analysisResult.observableMetrics.mouthCurvature < -0.035
                        ? `Turned down (${analysisResult.observableMetrics.mouthCurvature})`
                        : `Level (${analysisResult.observableMetrics.mouthCurvature})`
                      : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-[#0e1322] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                  <span className="text-[10px] text-slate-400 block">Brow Elevation</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {analysisResult.observableMetrics.browElevation !== undefined
                      ? `${analysisResult.observableMetrics.browElevation}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-[#0e1322] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                  <span className="text-[10px] text-slate-400 block">Bilateral Symmetry</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {Math.round(analysisResult.observableMetrics.symmetryScore * 100)}%
                  </span>
                </div>
                {analysisResult.detectedLandmarks && (
                  <>
                    <div className="bg-slate-50 dark:bg-[#0e1322] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                      <span className="text-[10px] text-slate-400 block">Inter-Ocular Dist (IOD)</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {analysisResult.detectedLandmarks.interOcularDistance}px
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#0e1322] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                      <span className="text-[10px] text-slate-400 block">Face Aspect Ratio</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {analysisResult.observableMetrics.faceAspectRatio ?? 'N/A'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Analysis Quality */}
          <div className="bg-white dark:bg-[#13192b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Analysis Quality
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  analysisResult.analysisQuality === 'Reliable enough to analyze'
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40'
                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40'
                }`}
              >
                {analysisResult.analysisQuality}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span>Signal Quality: {analysisResult.signalQuality || 'Moderate'}</span>
              <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                (sensor/image clarity: {Math.round(analysisResult.confidence * 100)}%)
              </span>
            </p>
            {analysisResult.reliabilityReason && (
              <p className="text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                {analysisResult.reliabilityReason}
              </p>
            )}
          </div>

          {/* Section 5: Important Explanation */}
          <div className="bg-purple-50/70 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200/80 dark:border-purple-900/50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200">
              <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Important Explanation</span>
            </div>
            <p className="text-xs text-purple-900 dark:text-purple-300 leading-relaxed text-[11.5px]">
              {analysisResult.disclaimer ||
                "Facial expressions do not reliably reveal a person's internal emotional state. This result is an uncertain visual estimate, not a diagnosis or a definitive statement about how you feel."}
            </p>
          </div>

          {/* User Feedback & Self-Report Alignment */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Does this observable physical measurement align with how you feel right now?
            </span>
            <div className="flex gap-2">
              {(['Yes', 'Somewhat', 'No'] as const).map((feedback) => (
                <button
                  key={feedback}
                  type="button"
                  onClick={() => handleFeedbackSelect(feedback)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    userMatchFeedback === feedback
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {feedback}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
