import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { InsightRecord } from '../types';
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Activity,
  Award,
  CheckCircle2,
} from 'lucide-react';

export const InsightsPage: React.FC = () => {
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const res = await api.getInsights();
      setInsights(res.insights);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setNotice(null);
    try {
      const res = await api.refreshInsights();
      setInsights(res.insights);
      setNotice('Insights recalculated against your latest journal, sleep, and mood records!');
    } catch (err) {
      console.error('Failed to refresh insights:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const getInsightIcon = (type: InsightRecord['insight_type']) => {
    switch (type) {
      case 'correlation':
        return <Activity className="w-5 h-5 text-teal-600" />;
      case 'streak':
        return <Award className="w-5 h-5 text-amber-500" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-indigo-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-300 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white tracking-tight">
            Personal Well-Being Insights
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Data-driven lifestyle observations synthesized from your journal reflections, moods, and sleep habits.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Recalculating...' : 'Recalculate Insights'}</span>
        </button>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Reassurance Disclaimer Card */}
      <div className="bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/40 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-xs text-teal-900 dark:text-teal-200">
        <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-teal-950 dark:text-teal-100">Observational Notice</p>
          <p className="mt-1 text-teal-800 dark:text-teal-300 leading-relaxed">
            The insights presented here represent descriptive observations derived solely from the entries and timestamps you have recorded. They are not medical diagnoses, mental health evaluations, or substitutes for consultation with licensed healthcare practitioners.
          </p>
        </div>
      </div>

      {/* Insights Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Synthesizing well-being observations...</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="bg-white dark:bg-[#13192b] p-12 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs text-center space-y-3 transition-colors duration-200">
            <Lightbulb className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">No Insights Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Continue writing daily journals and tracking sleep/activities for a few days to enable personalized pattern detection.
            </p>
          </div>
        ) : (
          insights.map((ins) => (
            <div
              key={ins.id}
              className="bg-white dark:bg-[#13192b] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs flex items-start gap-4 hover:border-teal-300 dark:hover:border-teal-500 transition-colors duration-200"
            >
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0e1322] border border-slate-100 dark:border-[#1e263d] flex-shrink-0">
                {getInsightIcon(ins.insight_type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-teal-700 dark:text-teal-400">
                    {ins.insight_type} insight
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(ins.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                  {ins.insight_text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
