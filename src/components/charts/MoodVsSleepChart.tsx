import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { MoodType } from '../../types';

interface MoodVsSleepChartProps {
  data: Array<{
    date: string;
    mood: MoodType;
    moodScore: number;
    sleepHours: number;
  }>;
}

const MOOD_LABELS: Record<number, string> = {
  1: 'Very Sad',
  2: 'Sad',
  3: 'Neutral',
  4: 'Happy',
  5: 'Very Happy',
};

export const MoodVsSleepChart: React.FC<MoodVsSleepChartProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mood vs. Sleep Visualization</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Exploring potential co-occurrences in your recorded days</p>
        </div>
      </div>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            Log both mood and sleep on the same days to visualize patterns
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 15, right: 15, bottom: 10, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="sleepHours"
                name="Sleep Hours"
                domain={[4, 11]}
                unit="h"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="moodScore"
                name="Mood"
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tickFormatter={(val) => MOOD_LABELS[val] || ''}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg space-y-1">
                        <p className="text-slate-400">{item.date}</p>
                        <p className="text-teal-300 font-semibold">Mood: {item.mood}</p>
                        <p className="text-indigo-300">Sleep: {item.sleepHours} hours</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Days" data={data} fill="#0d9488" shape="circle" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400 text-center italic">
        Data points reflect your individual daily entries. For informational pattern discovery only.
      </p>
    </div>
  );
};
