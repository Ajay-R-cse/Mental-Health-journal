import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

interface SleepTrendChartProps {
  data: Array<{
    date: string;
    displayDate: string;
    hours: number | null;
  }>;
  averageSleep?: number;
}

export const SleepTrendChart: React.FC<SleepTrendChartProps> = ({ data, averageSleep = 7.5 }) => {
  return (
    <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sleep Duration Patterns</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Logged hours per night</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
            <span>Recorded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-indigo-400"></span>
            <span>7.5h Target</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            No sleep logs recorded yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="displayDate"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                domain={[0, 12]}
                ticks={[0, 3, 6, 9, 12]}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit="h"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg space-y-1">
                        <p className="text-slate-400">{item.displayDate}</p>
                        <p className="font-semibold text-indigo-300">
                          {item.hours !== null ? `${item.hours} hours` : 'Not recorded'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={7.5} stroke="#818cf8" strokeDasharray="4 4" />
              <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
