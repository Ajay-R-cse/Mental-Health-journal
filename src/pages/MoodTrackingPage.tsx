import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MoodType, MoodRecord, DashboardTrends } from '../types';
import { MoodSelector } from '../components/MoodSelector';
import { MoodTrendChart } from '../components/charts/MoodTrendChart';
import {
  Smile,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const MOOD_EMOJIS: Record<MoodType, string> = {
  'Very Happy': '😄',
  Happy: '😊',
  Neutral: '😐',
  Sad: '😔',
  'Very Sad': '😢',
};

export const MoodTrackingPage: React.FC = () => {
  const [selectedMood, setSelectedMood] = useState<MoodType>('Happy');
  const [moodDate, setMoodDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // History & Trends
  const [timeframe, setTimeframe] = useState<number>(7);
  const [moodTrend, setMoodTrend] = useState<DashboardTrends['moodTrend']>([]);
  const [recentMoods, setRecentMoods] = useState<MoodRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadMoodData = async (days = timeframe) => {
    setLoading(true);
    try {
      const [trendRes, logsRes] = await Promise.all([
        api.getMoodTrends(days),
        api.getMoods(),
      ]);
      setMoodTrend(trendRes.moodTrend);
      setRecentMoods(logsRes.moods);
    } catch (err) {
      console.error('Failed to load mood trends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMoodData(timeframe);
  }, [timeframe]);

  const handleSaveMood = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);

    try {
      await api.recordMood(selectedMood, moodDate);
      setSuccessMsg(`Your mood '${selectedMood}' has been recorded for ${moodDate}!`);
      loadMoodData(timeframe);
    } catch (err: any) {
      console.error('Failed to save mood:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-300 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white tracking-tight">
          Mood Tracking & Evolution
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Record your daily emotional states and visualize how your feelings develop across weeks and months.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Record Today's Mood Card */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
        <form onSubmit={handleSaveMood} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Check In with Yourself</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">How would you describe your emotional state today?</p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <input
                type="date"
                value={moodDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setMoodDate(e.target.value)}
                aria-label="Mood check-in date"
                className="text-xs border border-slate-200 dark:border-[#242f4e] rounded-lg px-2.5 py-1.5 focus:outline-teal-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <MoodSelector
            selectedMood={selectedMood}
            onSelectMood={(m) => setSelectedMood(m)}
            size="lg"
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Selected: <strong className="text-teal-700 dark:text-teal-400 font-semibold">{selectedMood}</strong>
            </span>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Logging Mood...' : 'Save Mood Check-In'}
            </button>
          </div>
        </form>
      </div>

      {/* Interactive Trend Chart */}
      <MoodTrendChart
        data={moodTrend}
        timeframe={timeframe}
        onTimeframeChange={(d) => setTimeframe(d)}
      />

      {/* Recent Mood Logs History */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Recent Mood Log History</h3>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{recentMoods.length} logged entries</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading mood logs...</div>
        ) : recentMoods.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
            No mood check-ins recorded yet. Select a mood above to begin!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {recentMoods.slice(0, 9).map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0e1322] border border-slate-100 dark:border-[#1e263d] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{MOOD_EMOJIS[m.mood]}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">{m.mood}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {new Date(m.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
