import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { MoodType } from '../../types';

interface MoodTrendChartProps {
  data: Array<{
    date: string;
    displayDate: string;
    mood: MoodType | null;
    score: number | null;
  }>;
  timeframe: number;
  onTimeframeChange?: (days: number) => void;
}

const MOOD_NAMES: Record<number, string> = {
  5: '😄 Very Happy',
  4: '😊 Happy',
  3: '😐 Neutral',
  2: '😔 Sad',
  1: '😢 Very Sad',
};

export const MoodTrendChart: React.FC<MoodTrendChartProps> = ({
  data,
  timeframe,
  onTimeframeChange,
}) => {
  return (
    <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mood Evolution</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Recorded daily emotional valence patterns</p>
        </div>

        {onTimeframeChange && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#182035] p-1 rounded-lg self-start sm:self-auto">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => onTimeframeChange(days)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  timeframe === days
                    ? 'bg-white dark:bg-[#202b48] text-teal-700 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            No mood history logged for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="displayDate"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tickFormatter={(val) => {
                  const map: Record<number, string> = { 5: 'V.Happy', 4: 'Happy', 3: 'Neutral', 2: 'Sad', 1: 'V.Sad' };
                  return map[val] || '';
                }}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs space-y-1">
                        <p className="text-slate-400">{item.displayDate}</p>
                        <p className="font-semibold text-teal-300">
                          {item.score ? MOOD_NAMES[item.score] : 'No record'}
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
                stroke="#0d9488"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#moodGradient)"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
