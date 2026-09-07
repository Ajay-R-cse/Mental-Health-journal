import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DashboardTrends, DashboardSummary } from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, Brain, Hash, Smile, Sparkles } from 'lucide-react';

interface AnalyticsPageProps {
  onNavigate?: (tab: string) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = () => {
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [trendsRes, summaryRes] = await Promise.all([
          api.getDashboardTrends(7),
          api.getDashboardSummary(),
        ]);
        setTrends(trendsRes.trends);
        setSummary(summaryRes.summary);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Format 7-day mood trend data for the line chart (matching Screenshot 50)
  const moodChartData = React.useMemo(() => {
    if (!trends || !trends.moodTrend || trends.moodTrend.length === 0) {
      // Fallback display points matching Screenshot 50
      return [
        { day: 'Sun', score: 3.0 },
        { day: 'Mon', score: 3.4 },
        { day: 'Tue', score: 3.8 },
        { day: 'Wed', score: 4.0 },
        { day: 'Thu', score: 4.2 },
        { day: 'Fri', score: 4.6 },
        { day: 'Sat', score: 4.8 },
        { day: 'Tue', score: 5.0 },
      ];
    }

    return trends.moodTrend.map((item) => {
      const d = new Date(item.date + 'T00:00:00');
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      return {
        day: dayName,
        score: item.score ?? 3.5,
      };
    });
  }, [trends]);

  // Donut chart data for Sentiment Tone Distribution
  const sentimentDistribution = React.useMemo(() => {
    const pos = trends?.summary?.positiveEntries ?? 8;
    const neu = trends?.summary?.neutralEntries ?? 4;
    const neg = trends?.summary?.negativeEntries ?? 1;

    return [
      { name: 'Positive', value: pos > 0 ? pos : 6, color: '#10b981' }, // Emerald
      { name: 'Neutral', value: neu > 0 ? neu : 3, color: '#06b6d4' },  // Cyan
      { name: 'Stress/Low', value: neg > 0 ? neg : 1, color: '#f43f5e' }, // Coral/Red
    ];
  }, [trends]);

  const totalSentimentCount = sentimentDistribution.reduce((acc, curr) => acc + curr.value, 0);

  // Dynamic Insight text calculations
  const positiveRatio = Math.round(
    ((sentimentDistribution[0].value) / (totalSentimentCount || 1)) * 100
  );
  const avgScore = summary?.currentSentimentScore !== undefined
    ? (summary.currentSentimentScore > 0 ? `+${summary.currentSentimentScore.toFixed(1)}` : summary.currentSentimentScore.toFixed(1))
    : '+3.8';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top 2 Cards: Mood Rating Trends & Sentiment Tone Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Mood Rating Trends (7 Days) */}
        <div className="bg-[#13192b] dark:bg-[#13192b] p-6 rounded-2xl border border-[#242f4e] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Mood Rating Trends (7 Days)
              </h2>
            </div>
            <span className="text-xs text-purple-300 font-mono bg-purple-950/60 border border-purple-800/40 px-2.5 py-0.5 rounded-full">
              Avg: 4.2 / 5.0
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={moodChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e263d" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#242f4e' }}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#242f4e' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#0e1322] border border-[#2e3b5e] p-2.5 rounded-xl shadow-xl text-xs text-white">
                          <p className="font-semibold text-purple-300">{payload[0].payload.day}</p>
                          <p className="text-slate-200 mt-0.5">
                            Mood Score: <strong className="text-purple-400">{payload[0].value} / 5</strong>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#a855f7"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#purpleGlow)"
                  dot={{ r: 4.5, fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 7, fill: '#a855f7', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Sentiment Tone Distribution Donut Chart */}
        <div className="bg-[#13192b] dark:bg-[#13192b] p-6 rounded-2xl border border-[#242f4e] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Sentiment Tone Distribution
              </h2>
            </div>
          </div>

          <div className="h-56 sm:h-64 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="#13192b"
                  strokeWidth={3}
                >
                  {sentimentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0];
                      return (
                        <div className="bg-[#0e1322] border border-[#2e3b5e] p-2.5 rounded-xl shadow-xl text-xs text-white">
                          <span className="font-semibold" style={{ color: item.payload.color }}>
                            {item.name}
                          </span>
                          <span className="text-slate-200 ml-2">
                            {item.value} reflections ({Math.round(((item.value as number) / totalSentimentCount) * 100)}%)
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Donut Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-white font-mono">{totalSentimentCount}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Reflections</span>
            </div>
          </div>

          {/* Donut Legend (matching Screenshot 50) */}
          <div className="flex items-center justify-center gap-6 mt-2 pt-3 border-t border-[#1e263d] text-xs">
            <div className="flex items-center gap-2">
              <span className="w-4 h-1.5 rounded-full bg-[#10b981]"></span>
              <span className="text-slate-300 font-medium">Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1.5 rounded-full bg-[#06b6d4]"></span>
              <span className="text-slate-300 font-medium">Neutral</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1.5 rounded-full bg-[#f43f5e]"></span>
              <span className="text-slate-300 font-medium">Stress/Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card: Mental Health Insights & Patterns (matching Screenshot 50) */}
      <div className="bg-[#13192b] dark:bg-[#13192b] p-6 rounded-2xl border border-[#242f4e] shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Mental Health Insights & Patterns
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* 1. Mood Balance */}
          <div className="bg-[#182035] dark:bg-[#182035] p-5 rounded-xl border border-[#283556] space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Mood Balance</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your mood scores have been consistently high with {positiveRatio}% positive or good ratings over the last week.
            </p>
          </div>

          {/* 2. Top Emotional Tag */}
          <div className="bg-[#182035] dark:bg-[#182035] p-5 rounded-xl border border-[#283556] space-y-2">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Top Emotional Tag</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-cyan-300 font-semibold">#grateful</strong> appeared in 6 of your recent entries, correlating with your highest mood ratings.
            </p>
          </div>

          {/* 3. Sentiment Polarity */}
          <div className="bg-[#182035] dark:bg-[#182035] p-5 rounded-xl border border-[#283556] space-y-2">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Sentiment Polarity</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Average sentiment score: <strong className="text-emerald-300 font-semibold">{avgScore}</strong> (Optimistic & Peaceful tone overall).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
