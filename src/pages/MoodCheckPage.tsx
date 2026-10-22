import React, { useState, useEffect } from 'react';
import { CameraMoodCheckCard } from '../components/moodcheck/CameraMoodCheckCard';
import { VoiceMoodCheckCard } from '../components/moodcheck/VoiceMoodCheckCard';
import { api } from '../services/api';
import {
  CameraAnalysisResult,
  VoiceAnalysisResult,
  MoodType,
  SentimentType,
  MoodCheckRecord,
  ActiveTab,
} from '../types';
import {
  Sparkles,
  Shield,
  Smile,
  BookOpen,
  Camera,
  Mic,
  Save,
  CheckCircle2,
  Trash2,
  Clock,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface MoodCheckPageProps {
  onNavigate?: (tab: ActiveTab) => void;
}

export const MoodCheckPage: React.FC<MoodCheckPageProps> = ({ onNavigate }) => {
  // Multimodal optional states
  const [manualMood, setManualMood] = useState<MoodType | null>('Happy');
  const [cameraResult, setCameraResult] = useState<CameraAnalysisResult | null>(null);
  const [cameraUserFeedback, setCameraUserFeedback] = useState<string | null>(null);
  const [voiceResult, setVoiceResult] = useState<VoiceAnalysisResult | null>(null);
  const [journalSentiment, setJournalSentiment] = useState<SentimentType | null>(null);
  const [customJournalNote, setCustomJournalNote] = useState<string>('');
  const [analyzingText, setAnalyzingText] = useState<boolean>(false);

  // History state
  const [savedChecks, setSavedChecks] = useState<MoodCheckRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing mood checks & recent journal sentiment on mount
  useEffect(() => {
    loadRecentChecks();
    loadLatestJournalSentiment();
  }, []);

  const loadRecentChecks = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.getMoodChecks(20);
      setSavedChecks(res.records);
    } catch (err) {
      console.error('Failed to load mood checks:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadLatestJournalSentiment = async () => {
    try {
      const res = await api.getJournals();
      if (res.entries && res.entries.length > 0) {
        setJournalSentiment(res.entries[0].sentiment);
      }
    } catch (err) {
      console.error('Failed to fetch latest journal sentiment:', err);
    }
  };

  const handleAnalyzeReflectionText = async () => {
    if (!customJournalNote.trim()) return;
    setAnalyzingText(true);
    try {
      const res = await api.analyzeText(customJournalNote);
      setJournalSentiment(res.result.sentiment);
    } catch (err) {
      console.error('Text sentiment analysis failed:', err);
    } finally {
      setAnalyzingText(false);
    }
  };

  // Generate simple, non-clinical wellness summary synthesized from all available signals
  const generateWellnessSummary = (): string => {
    const signals: string[] = [];

    if (manualMood) {
      signals.push(`you personally described your feeling as "${manualMood}"`);
    }
    if (journalSentiment) {
      signals.push(`your reflection sentiment is "${journalSentiment}"`);
    }
    if (cameraResult) {
      signals.push(`the camera detected a "${cameraResult.estimatedExpression}"`);
    }
    if (voiceResult) {
      signals.push(`your vocal acoustic pattern was "${voiceResult.estimatedVocalState}"`);
    }

    if (signals.length === 0) {
      return 'Choose one or more optional signals above to view a gentle wellness reflection.';
    }

    // Gentle observational tone avoiding any clinical diagnosis
    if (
      journalSentiment === 'Positive' &&
      (cameraResult?.estimatedExpression.includes('Neutral') ||
        cameraResult?.estimatedExpression.includes('resting') ||
        voiceResult?.estimatedVocalState.includes('Calm') ||
        voiceResult?.estimatedVocalState.includes('Steady'))
    ) {
      return 'Your journal sentiment is positive, while the camera and voice observations are more neutral or steady. These signals may not always agree, and that is completely normal. Consider choosing the mood that best matches how you personally feel.';
    }

    if (manualMood === 'Sad' || manualMood === 'Very Sad' || journalSentiment === 'Negative') {
      return 'Some signals suggest you might be experiencing a heavy or challenging moment. Please be kind and gentle with yourself today. Taking a quiet break or engaging in a restful breathing exercise might offer comfort.';
    }

    if (
      manualMood === 'Very Happy' ||
      manualMood === 'Happy' ||
      cameraResult?.estimatedExpression.includes('Positive') ||
      cameraResult?.estimatedExpression.includes('upward')
    ) {
      return 'Your recorded signals reflect an uplifted, pleasant state of mind. Savor these moments of lightness and celebrate whatever brought you peace today.';
    }

    return `You have checked ${signals.length} signal${signals.length > 1 ? 's' : ''}. Visible and vocal expressions naturally fluctuate based on tiredness, lighting, and environment. Always trust your inner lived experience most.`;
  };

  const handleSaveMoodCheck = async () => {
    setSaving(true);
    setSaveSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload: {
        manualMood?: string;
        cameraEstimate?: string;
        cameraConfidence?: number;
        voiceEstimate?: string;
        voiceConfidence?: number;
        journalSentiment?: string;
        date?: string;
      } = {
        date: new Date().toISOString().split('T')[0],
      };

      if (manualMood) payload.manualMood = manualMood;
      if (cameraResult) {
        payload.cameraEstimate = cameraResult.estimatedExpression;
        payload.cameraConfidence = cameraResult.confidence;
      }
      if (voiceResult) {
        payload.voiceEstimate = voiceResult.estimatedVocalState;
        payload.voiceConfidence = voiceResult.confidence;
      }
      if (journalSentiment) {
        payload.journalSentiment = journalSentiment;
      }

      const res = await api.saveMoodCheck(payload);
      setSavedChecks((prev) => [res.record, ...prev]);
      setSaveSuccessMessage('Multimodal Mood Check securely recorded in Firestore.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save mood check record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCheck = async (id: string) => {
    try {
      await api.deleteMoodCheck(id);
      setSavedChecks((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete mood check:', err);
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">
      {/* 1. Page Header & Privacy First Announcement */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Multimodal Self-Reflection</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white mt-1">
              Mood Check
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Optionally explore your feelings through manual input, camera expression estimates, voice analysis, and journal sentiment.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-800 dark:text-teal-200">
            <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="font-semibold">Privacy First • 100% Optional</span>
          </div>
        </div>

        {/* Mandatory Prominent Privacy Notice */}
        <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Privacy Notice Before Analysis
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                Camera and microphone analysis is optional. Your camera and microphone are used only when you choose to start an analysis. Raw images, video, and audio are not saved by default.
              </p>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/50 shrink-0">
            This is an AI estimate, not a medical diagnosis.
          </div>
        </div>
      </div>

      {/* 2. Four Modality Selection Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Modality A: Manual Mood Selection */}
        <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                1. Manual Mood Selection
              </h3>
              <p className="text-xs text-slate-500">
                Choose how you personally feel right now.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            {(
              [
                { label: 'Very Happy', emoji: '😄' },
                { label: 'Happy', emoji: '😊' },
                { label: 'Neutral', emoji: '😐' },
                { label: 'Sad', emoji: '😔' },
                { label: 'Very Sad', emoji: '😢' },
              ] as Array<{ label: MoodType; emoji: string }>
            ).map((item) => {
              const isSelected = manualMood === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setManualMood(item.label)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-100 shadow-xs'
                      : 'bg-slate-50 dark:bg-[#0e1424] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-2xl mb-1">{item.emoji}</span>
                  <span className="text-xs font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modality B: Journal Sentiment Analysis */}
        <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                  2. Journal Sentiment
                </h3>
                <p className="text-xs text-slate-500">
                  Reflect in writing or use your recent journal tone.
                </p>
              </div>
            </div>

            {journalSentiment && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  journalSentiment === 'Positive'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : journalSentiment === 'Negative'
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {journalSentiment}
              </span>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <textarea
              value={customJournalNote}
              onChange={(e) => setCustomJournalNote(e.target.value)}
              placeholder="Quick reflection: Today was calm and productive... (optional)"
              rows={2}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e1424] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Evaluated with Stanford CoreNLP / Lexicon Pipeline
              </span>
              <button
                type="button"
                onClick={handleAnalyzeReflectionText}
                disabled={analyzingText || !customJournalNote.trim()}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
              >
                {analyzingText ? 'Analyzing...' : 'Analyze Tone'}
              </button>
            </div>
          </div>
        </div>

        {/* Modality C: Camera Expression Analysis */}
        <CameraMoodCheckCard
          onResult={(res, feedback, overrideMood) => {
            setCameraResult(res);
            if (feedback) setCameraUserFeedback(feedback);
            if (overrideMood) setManualMood(overrideMood);
          }}
          selectedManualMood={manualMood || undefined}
          onSelectManualMood={(mood) => setManualMood(mood)}
        />

        {/* Modality D: Voice Mood Analysis */}
        <VoiceMoodCheckCard
          onResult={(res) => setVoiceResult(res)}
          onClear={() => setVoiceResult(null)}
        />
      </div>

      {/* 3. Combined Results Comparison Dashboard */}
      <div className="bg-gradient-to-br from-slate-900 via-[#131b2e] to-[#0f172a] text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <span className="text-[11px] font-bold text-teal-400 tracking-wider uppercase">
              Combined Modality Snapshot
            </span>
            <h3 className="text-xl sm:text-2xl font-bold font-serif text-white mt-1">
              Multi-Signal Wellness Synthesis
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Compare your manual mood, journal sentiment, camera estimate, and voice signals side-by-side.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveMoodCheck}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white shadow-sm transition-all cursor-pointer self-start sm:self-auto"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Mood Check to Firestore'}</span>
          </button>
        </div>

        {/* Notification Banners */}
        {saveSuccessMessage && (
          <div className="bg-teal-950/80 border border-teal-500/50 rounded-xl p-3 text-xs text-teal-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 4 Discrete Signal Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile 1: Manual Mood */}
          <div className="bg-[#19233c] border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
              <Smile className="w-3.5 h-3.5" />
              <span>Manual Mood</span>
            </div>
            <p className="text-lg font-bold text-white">
              {manualMood || <span className="text-slate-500 text-sm font-normal">Not selected</span>}
            </p>
            <p className="text-[11px] text-slate-400">User's direct lived experience</p>
          </div>

          {/* Tile 2: Journal Sentiment */}
          <div className="bg-[#19233c] border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Journal Sentiment</span>
            </div>
            <p className="text-lg font-bold text-white">
              {journalSentiment || <span className="text-slate-500 text-sm font-normal">No entry yet</span>}
            </p>
            <p className="text-[11px] text-slate-400">Natural language reflection</p>
          </div>

          {/* Tile 3: Camera Estimate */}
          <div className="bg-[#19233c] border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-teal-400 font-semibold">
              <Camera className="w-3.5 h-3.5" />
              <span>Visible Facial Cue</span>
            </div>
            <p className="text-sm font-bold text-white">
              {cameraResult ? (
                <span>
                  {cameraResult.estimatedExpression}
                  <span className="text-[11px] text-teal-300 ml-1 font-normal block">
                    (Signal: {cameraResult.signalQuality || 'Moderate'})
                  </span>
                </span>
              ) : (
                <span className="text-slate-500 text-sm font-normal">Optional / Skipped</span>
              )}
            </p>
            <p className="text-[11px] text-slate-400">Physical 2D image gradients</p>
          </div>

          {/* Tile 4: Voice Estimate */}
          <div className="bg-[#19233c] border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Acoustics</span>
            </div>
            <p className="text-sm font-bold text-white">
              {voiceResult ? (
                <span>
                  {voiceResult.estimatedVocalState}
                  <span className="text-[11px] text-indigo-300 ml-1 font-normal block">
                    (Audio: {voiceResult.signalQuality || 'Moderate'})
                  </span>
                </span>
              ) : (
                <span className="text-slate-500 text-sm font-normal">Optional / Skipped</span>
              )}
            </p>
            <p className="text-[11px] text-slate-400">Physical audio waveform</p>
          </div>
        </div>

        {/* Wellness Summary */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Wellness Reflection</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {generateWellnessSummary()}
          </p>
          <div className="pt-2 flex items-center gap-2 text-[11px] text-amber-300/80 border-t border-slate-700/40">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Never combined into a medical diagnosis. For personal mindfulness and self-reflection only.</span>
          </div>
        </div>
      </div>

      {/* 4. Saved Mood Checks History */}
      <div className="bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#202b48] rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                Saved Mood Check Records
              </h3>
              <p className="text-xs text-slate-500">
                Firestore collection: <code className="text-purple-600 dark:text-purple-400 font-mono">moodChecks</code>
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            {savedChecks.length} record{savedChecks.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadingHistory ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Loading your mood check history...
          </div>
        ) : savedChecks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-600 dark:text-slate-300">No saved mood checks yet.</p>
            <p>Complete any combination above and tap "Save Mood Check" to log your first record.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {savedChecks.map((record) => (
              <div
                key={record.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {record.date}
                    </span>
                    {record.manualMood && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-medium text-[11px]">
                        Manual: {record.manualMood}
                      </span>
                    )}
                    {record.journalSentiment && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 font-medium text-[11px]">
                        Sentiment: {record.journalSentiment}
                      </span>
                    )}
                    {record.cameraEstimate && (
                      <span className="px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 font-medium text-[11px]">
                        Camera: {record.cameraEstimate}
                      </span>
                    )}
                    {record.voiceEstimate && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 font-medium text-[11px]">
                        Voice: {record.voiceEstimate}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Logged at {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Securely isolated to your user ID
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteCheck(record.id)}
                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors self-end sm:self-center cursor-pointer"
                  title="Delete record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
