import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Sparkles, Trash2, AlertCircle, Shield, Volume2 } from 'lucide-react';
import { VoiceAnalysisResult } from '../../types';
import { analyzeAudioBuffer } from '../../utils/voiceMoodAnalyzer';

interface VoiceMoodCheckCardProps {
  onResult?: (result: VoiceAnalysisResult) => void;
  onClear?: () => void;
}

export const VoiceMoodCheckCard: React.FC<VoiceMoodCheckCardProps> = ({ onResult, onClear }) => {
  const [recording, setRecording] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VoiceAnalysisResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const MAX_SECONDS = 20;

  // Cleanup stream and object URL on unmount
  useEffect(() => {
    return () => {
      stopRecordingAndCleanStream();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setPermissionError(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAnalysisResult(null);
    setSecondsElapsed(0);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const combinedBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(combinedBlob);
        const url = URL.createObjectURL(combinedBlob);
        setAudioUrl(url);

        // Turn off microphone tracks immediately after recording stops
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setRecording(true);

      // Start 20-second max timer
      timerRef.current = window.setInterval(() => {
        setSecondsElapsed((prev) => {
          if (prev >= MAX_SECONDS - 1) {
            stopRecording();
            return MAX_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission or hardware error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError(
          'Microphone permission was denied. Please enable microphone access in your browser settings to try voice mood analysis.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('No microphone was detected on your device.');
      } else {
        setPermissionError(err.message || 'Could not access microphone.');
      }
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const stopRecordingAndCleanStream = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setRecording(false);
  };

  const handleAnalyzeVoice = async () => {
    if (!audioBlob) return;
    setAnalyzing(true);

    try {
      // Local client-side acoustic feature extraction
      const result = await analyzeAudioBuffer(audioBlob);
      setAnalysisResult(result);
      if (onResult) {
        onResult(result);
      }
    } catch (err) {
      console.error('Voice analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteRecording = () => {
    stopRecordingAndCleanStream();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    audioChunksRef.current = [];
    setAnalysisResult(null);
    setSecondsElapsed(0);
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-3xl p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
              Voice Mood Check
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Optional vocal acoustic analysis evaluating non-identifying speaking patterns.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 w-fit">
          <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Processed locally & ephemeral
        </span>
      </div>

      {/* Clear Privacy Explanation */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-4 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Vocal Privacy Notice</p>
          <p className="text-indigo-800 dark:text-indigo-300 text-[11px]">
            Voice analysis is strictly optional. The microphone records only while you hold or start a session (capped at 20 seconds). No speech recognition is conducted, no personal identity is extracted, and raw audio is not saved or uploaded by default. You can delete the transient recording at any moment.
          </p>
        </div>
      </div>

      {/* Error banner */}
      {permissionError && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p>{permissionError}</p>
        </div>
      )}

      {/* Recording Stage Box */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e1424] p-6 text-center space-y-4">
        {recording ? (
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto animate-pulse">
              <Mic className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Listening & Recording...
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Speak naturally about your day ({MAX_SECONDS - secondsElapsed}s remaining)
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full max-w-xs mx-auto bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full transition-all duration-1000"
                style={{ width: `${(secondsElapsed / MAX_SECONDS) * 100}%` }}
              ></div>
            </div>
          </div>
        ) : audioUrl ? (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Vocal snippet ready ({secondsElapsed}s recorded)
              </p>
              <p className="text-xs text-slate-500">
                Play back your recording or proceed with acoustic analysis.
              </p>
            </div>
            <audio src={audioUrl} controls className="mx-auto h-10 w-full max-w-xs" />
          </div>
        ) : (
          <div className="space-y-2 py-4">
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Mic className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Microphone is idle
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Press "Start Recording" to speak a brief phrase or reflection (up to 20 seconds).
            </p>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!recording && !audioBlob && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Start Recording</span>
          </button>
        )}

        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all cursor-pointer animate-pulse"
          >
            <Square className="w-4 h-4" />
            <span>Stop Recording</span>
          </button>
        )}

        {audioBlob && !recording && (
          <>
            <button
              type="button"
              onClick={handleAnalyzeVoice}
              disabled={analyzing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{analyzing ? 'Analyzing Acoustics...' : 'Analyze Voice'}</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Recording</span>
            </button>
          </>
        )}
      </div>

      {/* Analysis Result Card */}
      {analysisResult && (
        <div className="bg-slate-50 dark:bg-[#1a233c] border border-slate-200 dark:border-[#2d3b64] rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                Acoustic Observation
              </span>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                Acoustic pattern:{' '}
                <span className="text-indigo-600 dark:text-indigo-400">
                  {analysisResult.estimatedVocalState}
                </span>
              </h4>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
                <span>Signal Quality: {analysisResult.signalQuality || 'Moderate'}</span>
                <span className="text-slate-400 text-[11px]">
                  (audio clarity: {Math.round(analysisResult.confidence * 100)}%)
                </span>
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
              Acoustic Profile
            </div>
          </div>

          {analysisResult.reliabilityReason && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                {analysisResult.reliabilityReason}
              </p>
            </div>
          )}

          {/* Non-identifying acoustic breakdown */}
          {analysisResult.acousticMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Speaking Pace</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {analysisResult.acousticMetrics.speakingPace}
                </span>
              </div>
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Volume Modulation</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {analysisResult.acousticMetrics.volumeVariation}
                </span>
              </div>
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Pitch Dynamics</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {analysisResult.acousticMetrics.pitchVariation}
                </span>
              </div>
              <div className="bg-white dark:bg-[#13192b] p-2.5 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block">Vocal Energy</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {analysisResult.acousticMetrics.vocalEnergy}
                </span>
              </div>
            </div>
          )}

          {/* Mandatory Disclaimers */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-medium">
              Voice characteristics can vary because of environment, microphone quality, illness, accent, tiredness, and speaking style. This is only an AI estimate.
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              This is an AI estimate, not a medical diagnosis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
