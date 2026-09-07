import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { DashboardSummary, DashboardTrends, ActiveTab, MoodType } from '../types';
import { MoodTrendChart } from '../components/charts/MoodTrendChart';
import { SentimentBreakdownChart } from '../components/charts/SentimentBreakdownChart';
import { SleepTrendChart } from '../components/charts/SleepTrendChart';
import { MoodVsSleepChart } from '../components/charts/MoodVsSleepChart';
import { ActivityFrequencyChart } from '../components/charts/ActivityFrequencyChart';
import {
  Smile,
  Moon,
  Sparkles,
  Activity,
  Flame,
  PenLine,
  ArrowRight,
  Lightbulb,
  Clock,
  Calendar as CalendarIcon,
  RefreshCw,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenJournalWithDate?: (dateStr: string) => void;
}

const MOOD_EMOJIS: Record<MoodType, string> = {
  'Very Happy': '😄',
  Happy: '😊',
  Neutral: '😐',
  Sad: '😔',
  'Very Sad': '😢',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [timeframe, setTimeframe] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadDashboardData = async (days = timeframe, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [sumRes, trendRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getDashboardTrends(days),
      ]);
      setSummary(sumRes.summary);
      setTrends(trendRes.trends);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData(timeframe);
  }, [timeframe]);

  if (loading && !summary) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Gathering your mindful wellness space...</p>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 rounded-3xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-teal-200 text-xs font-medium tracking-wide uppercase">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{todayStr}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight mt-2 text-white">
            Welcome back, {user?.name?.split(' ')[0] || 'Friend'}
          </h1>
          <p className="text-sm text-teal-100/90 mt-2 leading-relaxed">
            Take a mindful pause today. Reflect on your emotions, your sleep, and the little moments that shape your peace of mind.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('journal')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-teal-900 hover:bg-teal-50 text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <PenLine className="w-4 h-4 text-teal-700" />
              <span>Write Daily Reflection</span>
            </button>
            <button
              onClick={() => onNavigate('history')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-500/30 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              <span>View Past Entries</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-300" />
            </button>
            <button
              onClick={() => loadDashboardData(timeframe, true)}
              disabled={refreshing}
              className="p-2.5 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-500/30 text-teal-200 rounded-xl transition-colors cursor-pointer"
              title="Refresh statistics"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Decorative ambient background ring */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"></div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Today's Mood */}
        <div
          onClick={() => onNavigate('mood')}
          className="bg-white dark:bg-[#13192b] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs hover:border-teal-400 dark:hover:border-teal-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Today's Mood</span>
            <Smile className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl">{summary ? MOOD_EMOJIS[summary.todayMood] : '😊'}</span>
            <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-white truncate">
              {summary?.todayMood || 'Neutral'}
            </span>
          </div>
          <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-2 font-medium">Log or update &rarr;</p>
        </div>

        {/* 2. Today's Sleep */}
        <div
          onClick={() => onNavigate('sleep')}
          className="bg-white dark:bg-[#13192b] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Recorded Sleep</span>
            <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-800 dark:text-white">
              {summary?.todaySleep !== undefined && summary.todaySleep > 0 ? summary.todaySleep : '--'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">hours</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Weekly avg: <strong className="text-slate-700 dark:text-slate-200">{summary?.avgSleep || 0}h</strong>
          </p>
        </div>

        {/* 3. Current Sentiment */}
        <div className="bg-white dark:bg-[#13192b] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">NLP Sentiment</span>
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                summary?.currentSentiment === 'Positive'
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : summary?.currentSentiment === 'Negative'
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                  : 'bg-slate-100 dark:bg-[#182035] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#242f4e]'
              }`}
            >
              {summary?.currentSentiment || 'Neutral'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            Score: <strong className="text-slate-600 dark:text-slate-300">{summary?.currentSentimentScore?.toFixed(2) || '0.00'}</strong>
          </p>
        </div>

        {/* 4. Reflection Streak */}
        <div className="bg-white dark:bg-[#13192b] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Journal Streak</span>
            <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-800 dark:text-white">{summary?.streak || 0}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">consecutive days</span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 font-medium">Consistency builds insight</p>
        </div>

        {/* 5. Activities Logged */}
        <div
          onClick={() => onNavigate('activities')}
          className="col-span-2 lg:col-span-1 bg-white dark:bg-[#13192b] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs hover:border-teal-400 dark:hover:border-teal-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Today's Habits</span>
            <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-wrap gap-1">
            {summary?.todayActivities && summary.todayActivities.length > 0 ? (
              summary.todayActivities.slice(0, 2).map((act, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40 text-[11px] font-medium rounded-md"
                >
                  {act}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">No activity logged yet</span>
            )}
            {summary?.todayActivities && summary.todayActivities.length > 2 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 self-center">
                +{summary.todayActivities.length - 2} more
              </span>
            )}
          </div>
          <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-2 font-medium">Manage activities &rarr;</p>
        </div>
      </div>

      {/* Primary Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mood Trend Chart (Takes 2 columns) */}
        <div className="lg:col-span-2">
          <MoodTrendChart
            data={trends?.moodTrend || []}
            timeframe={timeframe}
            onTimeframeChange={(d) => setTimeframe(d)}
          />
        </div>

        {/* Sentiment Distribution */}
        <div className="lg:col-span-1">
          <SentimentBreakdownChart
            positiveCount={trends?.summary.positiveEntries || 0}
            neutralCount={trends?.summary.neutralEntries || 0}
            negativeCount={trends?.summary.negativeEntries || 0}
          />
        </div>
      </div>

      {/* Sleep & Correlation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SleepTrendChart data={trends?.sleepTrend || []} averageSleep={summary?.avgSleep || 7.5} />
        <MoodVsSleepChart data={trends?.moodVsSleep || []} />
      </div>

      {/* Activity Distribution & Well-Being Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ActivityFrequencyChart data={trends?.activityDistribution || []} />
        </div>

        {/* General Well-being Insights Card */}
        <div className="lg:col-span-2 bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs flex flex-col justify-between transition-colors duration-200">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Well-being Observations</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Data-driven personal reflections</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('insights')}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 transition-colors"
              >
                View all &rarr;
              </button>
            </div>

            <div className="space-y-2.5 mt-4">
              {summary?.insights && summary.insights.length > 0 ? (
                summary.insights.slice(0, 3).map((ins) => (
                  <div
                    key={ins.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0e1322] border border-slate-100 dark:border-[#1e263d] flex items-start gap-3"
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0"></span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{ins.insight_text}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  Record 2 or more daily journals to start discovering personalized lifestyle patterns.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1e263d] flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span>Non-diagnostic observations based on your recorded journals</span>
            <span className="text-teal-700 dark:text-teal-400 font-medium">Updated automatically</span>
          </div>
        </div>
      </div>

      {/* Recent Journal Entries Table / Cards */}
      <div className="bg-white dark:bg-[#13192b] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Recent Journal Entries</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your latest captured reflections</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Browse All ({summary?.totalEntries || 0})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {summary?.recentEntries && summary.recentEntries.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-[#1e263d]">
            {summary.recentEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onNavigate('history')}
                className="py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#182035] rounded-xl px-2 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">
                      {new Date(entry.entry_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#182035] text-slate-700 dark:text-slate-300 font-medium">
                      {MOOD_EMOJIS[entry.mood]} {entry.mood}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                        entry.sentiment === 'Positive'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                          : entry.sentiment === 'Negative'
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                          : 'bg-slate-100 dark:bg-[#182035] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#242f4e]'
                      }`}
                    >
                      {entry.sentiment} ({entry.sentiment_score > 0 ? `+${entry.sentiment_score}` : entry.sentiment_score})
                    </span>
                    {entry.sleep_hours && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-medium flex items-center gap-1">
                        <Moon className="w-3 h-3" /> {entry.sleep_hours}h sleep
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {entry.journal_text}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400 dark:text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400 dark:text-slate-500">No journal entries written yet.</p>
            <button
              onClick={() => onNavigate('journal')}
              className="mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Write First Reflection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
