import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Sparkles, AlertCircle, ArrowUpRight, ArrowDownRight, Minus, HeartHandshake } from 'lucide-react';
import { MoodType } from '../../types';

export interface MoodIntensityPoint {
  date: string;         // YYYY-MM-DD
  day: string;          // Mon, Tue, etc.
  formattedDate: string;// e.g. "Mon, Sep 21"
  intensity: number;    // 1.0 to 5.0
  mood: MoodType;
  sentiment?: string;
  hasRecord: boolean;   // true if actively logged by user
  notes?: string;
}

interface MoodIntensityLineChartProps {
  data: MoodIntensityPoint[];
  isLoading?: boolean;
}

const MOOD_EMOJI_MAP: Record<MoodType, string> = {
  'Very Happy': '😄',
  'Happy': '😊',
  'Neutral': '😐',
  'Sad': '😔',
  'Very Sad': '😢',
};

const MOOD_LABELS: Record<number, string> = {
  5: 'Radiant',
  4: 'Uplifted',
  3: 'Balanced',
  2: 'Low',
  1: 'Sensitive',
};

export const MoodIntensityLineChart: React.FC<MoodIntensityLineChartProps> = ({
  data,
  isLoading = false,
}) => {
  // Compute summary metrics for emotional well-being
  const { avgIntensity, peakPoint, lowestPoint, trendDirection, trendPercentage } = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        avgIntensity: 4.2,
        peakPoint: null,
        lowestPoint: null,
        trendDirection: 'neutral' as const,
        trendPercentage: 0,
      };
    }

    const intensities = data.map((d) => d.intensity);
    const sum = intensities.reduce((acc, curr) => acc + curr, 0);
    const avg = Number((sum / data.length).toFixed(1));

    let maxVal = -Infinity;
    let minVal = Infinity;
    let peak: MoodIntensityPoint | null = null;
    let lowest: MoodIntensityPoint | null = null;

    data.forEach((p) => {
      if (p.intensity > maxVal) {
        maxVal = p.intensity;
        peak = p;
      }
      if (p.intensity < minVal) {
        minVal = p.intensity;
        lowest = p;
      }
    });

    // Determine 7-day trend (first 3 days vs last 3 days)
    const firstHalf = data.slice(0, 3).map((d) => d.intensity);
    const secondHalf = data.slice(-3).map((d) => d.intensity);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);

    let direction: 'up' | 'down' | 'neutral' = 'neutral';
    const diff = avgSecond - avgFirst;
    const pct = Math.abs(Math.round((diff / (avgFirst || 1)) * 100));

    if (diff > 0.2) direction = 'up';
    else if (diff < -0.2) direction = 'down';

    return {
      avgIntensity: avg,
      peakPoint: peak,
      lowestPoint: lowest,
      trendDirection: direction,
      trendPercentage: pct,
    };
  }, [data]);

  // Determine emotional well-being status based on 7-day average
  const wellBeingStatus = React.useMemo(() => {
    if (avgIntensity >= 4.2) {
      return {
        title: 'Optimal & Flourishing',
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
        desc: 'Consistent positive emotional vitality over the last 7 days.',
      };
    }
    if (avgIntensity >= 3.5) {
      return {
        title: 'Uplifted & Resilient',
        color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60',
        desc: 'Steady positive mood with healthy emotional regulation.',
      };
    }
    if (avgIntensity >= 2.8) {
      return {
        title: 'Balanced Equilibrium',
        color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/60',
        desc: 'Stable neutral baseline with normal daily fluctuations.',
      };
    }
    return {
      title: 'Gentle Care Needed',
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
      desc: 'Mood intensity has dipped; consider relaxation & restful sleep.',
    };
  }, [avgIntensity]);

  return (
    <div
      id="mood-intensity-line-chart-card"
      className="bg-white dark:bg-[#13192b] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-md flex flex-col justify-between transition-colors duration-200"
    >
      {/* Chart Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>7-Day Mood Intensity</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#283556] px-2 py-0.5 rounded-full">
                  Emotional Well-Being
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily emotional valence and intensity trajectory over the past week
              </p>
            </div>
          </div>

          {/* Average Intensity Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/40 text-xs font-semibold text-purple-700 dark:text-purple-300 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>7d Avg: <strong className="font-bold text-purple-800 dark:text-purple-200">{avgIntensity.toFixed(1)}</strong> / 5.0</span>
            </div>

            {trendDirection === 'up' && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-1 rounded-lg">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{trendPercentage}%
              </span>
            )}
            {trendDirection === 'down' && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 px-2 py-1 rounded-lg">
                <ArrowDownRight className="w-3.5 h-3.5" />
                -{trendPercentage}%
              </span>
            )}
            {trendDirection === 'neutral' && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#182035] border border-slate-200 dark:border-[#242f4e] px-2 py-1 rounded-lg">
                <Minus className="w-3.5 h-3.5" />
                Stable
              </span>
            )}
          </div>
        </div>

        {/* Status banner */}
        <div className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-medium mb-3 ${wellBeingStatus.color}`}>
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 shrink-0" />
            <span>
              <strong>{wellBeingStatus.title}:</strong> {wellBeingStatus.desc}
            </span>
          </div>
          <span className="hidden md:inline text-[11px] opacity-80">Baseline: 3.0 Neutral</span>
        </div>
      </div>

      {/* Main Line Chart */}
      <div className="h-64 sm:h-72 w-full pt-1">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Loading 7-day mood intensity data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 12, right: 12, left: -22, bottom: 2 }}
            >
              <defs>
                <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#64748b"
                strokeOpacity={0.15}
              />

              <XAxis
                dataKey="day"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#64748b', strokeOpacity: 0.25 }}
              />

              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#64748b', strokeOpacity: 0.25 }}
                tickFormatter={(val: number) => {
                  return MOOD_LABELS[val] || `${val}`;
                }}
              />

              {/* Baseline Reference Line (Neutral = 3.0) */}
              <ReferenceLine
                y={3}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                label={{
                  value: 'Baseline (3.0)',
                  position: 'insideBottomRight',
                  fill: '#94a3b8',
                  fontSize: 10,
                  opacity: 0.7,
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point: MoodIntensityPoint = payload[0].payload;
                    const emoji = MOOD_EMOJI_MAP[point.mood] || '✨';
                    return (
                      <div className="bg-[#0e1322] border border-[#2e3b5e] p-3 rounded-xl shadow-2xl text-xs text-white min-w-44 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60 mb-2">
                          <span className="font-semibold text-purple-300">
                            {point.formattedDate}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {point.hasRecord ? 'Logged Entry' : 'Estimated'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xl" role="img" aria-label={point.mood}>{emoji}</span>
                          <div>
                            <div className="font-bold text-white text-sm leading-tight flex items-center gap-1.5">
                              <span>{point.mood}</span>
                              <span className="text-purple-400 font-mono text-xs">
                                ({point.intensity.toFixed(1)}/5)
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Valence: {MOOD_LABELS[Math.round(point.intensity)] || 'Normal'}
                            </span>
                          </div>
                        </div>

                        {point.notes && (
                          <p className="text-[11px] text-slate-300 italic pt-1 border-t border-slate-700/40 line-clamp-2">
                            "{point.notes}"
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Line
                type="monotone"
                dataKey="intensity"
                stroke="#8b5cf6"
                strokeWidth={3.5}
                dot={{
                  r: 4.5,
                  fill: '#8b5cf6',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 7,
                  fill: '#a855f7',
                  stroke: '#ffffff',
                  strokeWidth: 2.5,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Summary Indicators */}
      <div className="grid grid-cols-3 gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-[#1e263d] text-center">
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#182035] border border-slate-100 dark:border-[#222c47]">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">
            Peak Day
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
            {peakPoint ? `${peakPoint.day} (${peakPoint.intensity.toFixed(1)})` : 'Sat (4.8)'}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#182035] border border-slate-100 dark:border-[#222c47]">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">
            Lowest Day
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
            {lowestPoint ? `${lowestPoint.day} (${lowestPoint.intensity.toFixed(1)})` : 'Sun (3.0)'}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#182035] border border-slate-100 dark:border-[#222c47]">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">
            Emotional Span
          </span>
          <span className="text-xs font-bold text-purple-700 dark:text-purple-300 mt-0.5 block">
            {peakPoint && lowestPoint
              ? `${(peakPoint.intensity - lowestPoint.intensity).toFixed(1)} pts`
              : '1.8 pts'}
          </span>
        </div>
      </div>
    </div>
  );
};
