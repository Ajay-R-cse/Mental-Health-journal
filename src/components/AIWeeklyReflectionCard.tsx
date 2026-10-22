import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  Compass,
  Lightbulb,
  CheckCircle,
  HelpCircle,
  Footprints,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { aiService } from '../services/aiService';
import { AIWeeklyReflectionResponse } from '../types';

export const AIWeeklyReflectionCard: React.FC = () => {
  const [reflection, setReflection] = useState<AIWeeklyReflectionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await aiService.gatherUserWeeklyData();
      const result = await aiService.generateWeeklyReflection(data);
      setReflection(result);
    } catch (err: any) {
      console.error('Failed to generate weekly reflection:', err);
      setError(err?.message || 'Unable to generate reflection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg transition-colors duration-200 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-[#1e263d]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/40 text-teal-600 dark:text-teal-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                AI Weekly Reflection
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40">
                Weekly Insights
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Synthesizes your personal journal entries, mood check-ins, sleep, and mindful activities from the past week.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
            loading
              ? 'bg-teal-300 dark:bg-teal-900/50 text-white cursor-not-allowed'
              : 'bg-teal-700 hover:bg-teal-800 text-white'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Reflecting on your week...' : reflection ? 'Regenerate Weekly Reflection' : 'Generate AI Weekly Reflection'}</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
          <div>
            <span className="font-semibold">Notice: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!reflection && !loading && (
        <div className="py-7 px-4 rounded-xl border border-dashed border-slate-200 dark:border-[#222c47] bg-slate-50/50 dark:bg-[#0e1322]/40 text-center space-y-2">
          <div className="w-9 h-9 mx-auto rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Compass className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Weekly Wellness Overview Ready
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Click <strong className="text-teal-600 dark:text-teal-400">Generate AI Weekly Reflection</strong> to compile overall patterns, positive milestones, and a gentle intention for the coming week.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-8 text-center space-y-2.5">
          <div className="w-7 h-7 mx-auto border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Reviewing your weekly journal reflections, sleep hours, and mindfulness activities...
          </p>
        </div>
      )}

      {/* Generated Content */}
      {reflection && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Overall Trend */}
            <div className="md:col-span-2 bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                <Compass className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <span>Overall Journal Trend</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {reflection.overallTrend}
              </p>
            </div>

            {/* 2. Common Themes */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                <Lightbulb className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                <span>Common Themes</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reflection.commonThemes.map((theme, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-50 dark:bg-[#102a3a] text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>

            {/* 3. Positive Highlights */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Positive Highlights</span>
              </div>
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {reflection.positiveHighlights.map((hi, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{hi}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. Reflection Question */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <HelpCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>One Reflection Question</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                "{reflection.reflectionQuestion}"
              </p>
            </div>

            {/* 5. Suggested Next Step */}
            <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <Footprints className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>One Simple Next Step</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                {reflection.suggestedNextStep}
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0e1322] border border-slate-200 dark:border-[#1e263d] flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldAlert className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
            <span>
              {reflection.disclaimer ||
                'AI-generated reflection for general wellness, not a clinical diagnosis.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
