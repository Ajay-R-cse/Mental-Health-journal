import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Brain,
  Smile,
  Star,
  MessageSquareQuote,
  Sprout,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { aiService } from '../services/aiService';
import { AIJournalInsightsResponse, MoodType } from '../types';

interface AIJournalInsightsCardProps {
  journalText: string;
  manualMood?: MoodType | string;
  journalSentiment?: string;
  journalEntryId?: string;
  autoLoadSaved?: boolean;
  onInsightsGenerated?: (insights: AIJournalInsightsResponse) => void;
  onTriggerAnalysis?: () => void;
}

export const AIJournalInsightsCard: React.FC<AIJournalInsightsCardProps> = ({
  journalText,
  manualMood,
  journalSentiment,
  journalEntryId,
  autoLoadSaved = true,
  onInsightsGenerated,
  onTriggerAnalysis,
}) => {
  const [insights, setInsights] = useState<AIJournalInsightsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingSaved, setLoadingSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // If a journalEntryId is provided, check if an insight was already stored for it
  useEffect(() => {
    let isMounted = true;
    if (journalEntryId && autoLoadSaved) {
      setLoadingSaved(true);
      aiService
        .getSavedJournalInsight(journalEntryId)
        .then((saved) => {
          if (isMounted && saved) {
            setInsights({
              summary: saved.summary,
              themes: saved.themes,
              emotionalTone: saved.emotionalTone,
              positiveMoments: saved.positiveMoments,
              reflectionPrompt: saved.reflectionPrompt,
              suggestedNextStep: saved.suggestedNextStep,
              disclaimer: saved.disclaimer,
            });
          }
        })
        .catch((err) => console.warn('Could not retrieve saved insight:', err))
        .finally(() => {
          if (isMounted) setLoadingSaved(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [journalEntryId, autoLoadSaved]);

  const handleGenerate = async () => {
    if (!journalText || !journalText.trim()) {
      setError('Please write your journal thoughts first before generating AI reflections.');
      return;
    }

    if (onTriggerAnalysis) {
      onTriggerAnalysis();
    }

    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const generated = await aiService.generateJournalInsights({
        journalText: journalText.trim(),
        manualMood: manualMood ? String(manualMood) : undefined,
        journalSentiment: journalSentiment ? String(journalSentiment) : undefined,
      });

      setInsights(generated);
      if (onInsightsGenerated) {
        onInsightsGenerated(generated);
      }

      // If tied to an existing saved journal entry, persist to Firestore
      if (journalEntryId) {
        try {
          await aiService.saveJournalInsight(journalEntryId, generated);
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 4000);
        } catch (saveErr) {
          console.warn('Could not persist insight to Firestore:', saveErr);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to generate reflection. Please verify connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-label="AI Journal Insights"
      className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg transition-colors duration-200 space-y-6"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-[#1e263d]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-[#291e47] border border-purple-200 dark:border-[#7c3aed]/40 text-purple-600 dark:text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                AI Journal Insights
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-[#2e1d52] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-[#5b21b6]">
                Gemini AI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reflective, supportive wellness analysis generated strictly from your journal writing.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || loadingSaved}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              loading || loadingSaved
                ? 'bg-purple-300 dark:bg-purple-900/50 text-white cursor-not-allowed'
                : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>
              {loading
                ? 'Reflecting on your entry...'
                : insights
                ? 'Regenerate Insights'
                : 'Generate AI Insights'}
            </span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <span className="font-semibold">Generation Notice: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* State 1: Loading initial saved entry */}
      {loadingSaved && !insights && (
        <div className="py-8 text-center space-y-2">
          <div className="w-6 h-6 mx-auto border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 dark:text-slate-500">Checking for previously saved insights...</p>
        </div>
      )}

      {/* State 2: Empty / Ready State */}
      {!insights && !loading && !loadingSaved && (
        <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-[#222c47] bg-slate-50/50 dark:bg-[#0e1322]/40 text-center space-y-2.5">
          <div className="w-10 h-10 mx-auto rounded-full bg-purple-50 dark:bg-[#201736] flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Discover Meaningful Journal Patterns
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Click <strong className="text-purple-600 dark:text-purple-400">Generate AI Insights</strong> to receive a structured summary, main themes, emotional tone reflection, positive moments, a gentle question, and a mindful next step.
            </p>
          </div>
        </div>
      )}

      {/* State 3: Active Loading Indicator */}
      {loading && (
        <div className="py-10 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              Synthesizing Your Wellness Reflection
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Examining journal themes, positive highlights, and supportive questions...
            </p>
          </div>
        </div>
      )}

      {/* State 4: Generated Insights Cards */}
      {insights && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: ✨ AI Summary */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] flex flex-col justify-between space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <span>AI Summary</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {insights.summary}
              </p>
            </div>

            {/* Card 2: 🧠 Main Themes */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] flex flex-col justify-between space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                <Brain className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                <span>Main Themes</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {insights.themes && insights.themes.length > 0 ? (
                  insights.themes.map((theme, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
                      <span>{theme}</span>
                    </li>
                  ))
                ) : (
                  <li className="italic text-slate-400">Personal Reflection</li>
                )}
              </ul>
            </div>

            {/* Card 3: 😊 Emotional Tone */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] flex flex-col justify-between space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <Smile className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Emotional Tone</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#182035] border border-slate-200/80 dark:border-[#242f4e]">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {insights.emotionalTone}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Descriptive reflection based on your journal words
                </p>
              </div>
            </div>

            {/* Card 4: 🌟 Positive Moments */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] flex flex-col justify-between space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Star className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Positive Moments</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {insights.positiveMoments && insights.positiveMoments.length > 0 ? (
                  insights.positiveMoments.map((moment, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span className="leading-snug">{moment}</span>
                    </li>
                  ))
                ) : (
                  <li className="italic text-slate-400">Recorded self-reflection</li>
                )}
              </ul>
            </div>

            {/* Card 5: 💭 Reflection Question */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] flex flex-col justify-between space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <MessageSquareQuote className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>Reflection Question</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                "{insights.reflectionPrompt}"
              </p>
            </div>

            {/* Card 6: 🌱 Suggested Next Step */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] flex flex-col justify-between space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                <Sprout className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <span>Suggested Next Step</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {insights.suggestedNextStep}
              </p>
            </div>
          </div>

          {/* Mandatory Disclaimer Footer */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0e1322] border border-slate-200 dark:border-[#1e263d] flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>
              {insights.disclaimer ||
                'AI-generated reflection for general wellness and journaling. It is not a medical diagnosis.'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
