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
} from 'lucide-react';
import { CameraAnalysisResult, MoodType, MoodCheckRecord } from '../../types';
import { analyzeCanvasFrame } from '../../utils/cameraMoodAnalyzer';
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
  // 'consented' = user explicitly clicked "Allow Camera & Capture"
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
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Sync prop manual mood if changed externally
  useEffect(() => {
    if (selectedManualMood) {
      setLocalManualMood(selectedManualMood);
    }
  }, [selectedManualMood]);

  // Clean up all video tracks on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
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
    setConsentStatus('consented');
    setPermissionError(null);
    setAnalyzing(true);
    setStatusMessage('Requesting camera access...');

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported or unavailable in this browser environment.');
      }

      // Explicitly invoke getUserMedia directly from the user click interaction
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (!isMountedRef.current) {
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

      if (videoEl && canvasEl) {
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

        // Extract and analyze visible expression metrics locally in-browser
        const result = analyzeCanvasFrame(videoEl, canvasEl);
        setAnalysisResult(result);
        setUserMatchFeedback(null);
        setStatusMessage('Visible expression estimated.');

        if (onResult) {
          onResult(result);
        }
      }
    } catch (err: any) {
      console.warn('Camera permission or device error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Camera access was denied by your browser. You can continue journal analysis without camera input, or grant camera permission in your browser site settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('No camera device was detected on your system. Your journal analysis continues without camera input.');
      } else {
        setPermissionError(err.message || 'Unable to access camera device. Please try again.');
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

  const handleSkipConsent = () => {
    stopCamera();
    setConsentStatus('skipped');
    if (onSkip) {
      onSkip();
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
        cameraEstimate: analysisResult.estimatedExpression,
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

  const handleRemoveImage = () => {
    setCapturedImage(null);
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
                The app would like to access your camera to capture <strong>a single photo frame</strong> to estimate visible facial cues (such as smile likelihood, eye openness, and symmetry).
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
                Visible Expression Disclaimer
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-snug">
                Facial expressions do not reliably determine real emotional feelings. This estimation is purely supplemental; your own self-reported mood is always authoritative.
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
    (analysisResult.confidence < 0.65 ||
      analysisResult.estimatedExpression === 'Mixed/uncertain' ||
      analysisResult.estimatedExpression === 'Unable to estimate reliably' ||
      !analysisResult.isReliable);

  return (
    <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 transition-colors duration-200">
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
            About Camera Visible Expression Estimation
          </p>
          <p className="text-purple-800 dark:text-purple-300 text-[11.5px] leading-relaxed">
            Your camera is used only to observe 2D physical facial gradients on your local screen. Facial appearance does not indicate real emotional feelings. Your own self-reported mood is always the true and authoritative record.
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
                onClick={handleAllowAndCapture}
                className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[11px] font-medium hover:bg-purple-700 cursor-pointer"
              >
                Try Again
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
              className="w-full h-full object-contain transform -scale-x-100"
            />
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] text-emerald-300 font-medium flex items-center gap-1.5 border border-emerald-500/30 z-20 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Captured Frame Analyzed</span>
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
                Click "Allow Camera & Capture" to capture one frame for visible expression estimation.
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

      {/* Action Toolbar / Controls */}
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
        ) : !analysisResult && !capturedImage ? (
          <>
            <button
              type="button"
              onClick={handleAllowAndCapture}
              disabled={analyzing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white shadow-xs transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Allow Camera & Capture</span>
            </button>
            <button
              type="button"
              onClick={handleSkipConsent}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Skip Camera
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleAllowAndCapture}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retake or Retry</span>
            </button>

            {capturedImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={analyzing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 transition-all cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Remove Image</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveToRecords}
              disabled={isSaving || savedSuccess}
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

      {/* Analysis Result Card */}
      {analysisResult && (
        <div className="bg-slate-50 dark:bg-[#1a233c] border border-slate-200 dark:border-[#2d3b64] rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
          {/* Captured Image Preview Bar */}
          {capturedImage && (
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#13192b] rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
              <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-300 dark:border-slate-700 shrink-0">
                <img
                  src={capturedImage}
                  alt="Analyzed camera frame thumbnail"
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  Analyzed Camera Frame
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Client memory only &bull; Never uploaded or stored on servers
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

          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                Visible Expression Observation
              </span>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                Observable cue:{' '}
                <span className="text-purple-600 dark:text-purple-400">
                  {analysisResult.estimatedExpression}
                </span>
              </h4>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
                <span>Signal Quality: {analysisResult.signalQuality || 'Moderate'}</span>
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                  (frame clarity: {Math.round(analysisResult.confidence * 100)}%)
                </span>
                {isUncertain && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40">
                    Uncertain
                  </span>
                )}
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shrink-0">
              Visible Cue Only
            </div>
          </div>

          {/* Uncertainty Notice / Reliability Reason */}
          {analysisResult.reliabilityReason && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Observation Note</p>
                <p className="text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {analysisResult.reliabilityReason}
                </p>
              </div>
            </div>
          )}

          {/* Observable metrics breakdown */}
          {analysisResult.observableMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Lighting Quality</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {analysisResult.observableMetrics.lightingQuality}
                </span>
              </div>
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Smile Curvature</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {Math.round(analysisResult.observableMetrics.smileLikelihood * 100)}%
                </span>
              </div>
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Eye Openness</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {Math.round(analysisResult.observableMetrics.openEyeScore * 100)}%
                </span>
              </div>
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Symmetry</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {Math.round(analysisResult.observableMetrics.symmetryScore * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* User Feedback: Does this match how you feel? */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <HelpCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Does this visible expression match how you feel inside?</span>
            </div>
            <div className="flex items-center gap-2">
              {(['Yes', 'Somewhat', 'No'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleFeedbackSelect(option)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    userMatchFeedback === option
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-[#13192b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Mood Correction / Selection */}
          <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Manual Mood Correction (your own selection is always authoritative):
              </p>
              {localManualMood && (
                <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                  Current: {localManualMood}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['Very Happy', 'Happy', 'Neutral', 'Sad', 'Very Sad'] as MoodType[]).map((mood) => {
                const emojis: Record<MoodType, string> = {
                  'Very Happy': '😄 Very Happy',
                  Happy: '😊 Happy',
                  Neutral: '😐 Neutral',
                  Sad: '😔 Sad',
                  'Very Sad': '😢 Very Sad',
                };
                const isPicked = localManualMood === mood;
                return (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => handleManualMoodPick(mood)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isPicked
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white dark:bg-[#13192b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {emojis[mood]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
