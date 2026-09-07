import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';

interface SentimentBreakdownChartProps {
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}

export const SentimentBreakdownChart: React.FC<SentimentBreakdownChartProps> = ({
  positiveCount,
  neutralCount,
  negativeCount,
}) => {
  const total = positiveCount + neutralCount + negativeCount;

  const chartData = [
    { name: 'Positive', count: positiveCount, color: '#10b981', fill: '#10b981' },
    { name: 'Neutral', count: neutralCount, color: '#94a3b8', fill: '#94a3b8' },
    { name: 'Negative', count: negativeCount, color: '#f43f5e', fill: '#f43f5e' },
  ];

  return (
    <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs flex flex-col justify-between transition-colors duration-200">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sentiment Distribution</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{total} total entries</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automated NLP sentiment classifications</p>
      </div>

      <div className="h-44 w-full my-3">
        {total === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            No journal entries to analyze
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-slate-300">
                          {item.count} entries ({pct}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown Legend Pills */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
        <div className="bg-emerald-50/70 rounded-lg py-1.5 px-2">
          <p className="text-[11px] font-medium text-emerald-800">Positive</p>
          <p className="text-sm font-bold text-emerald-700">{positiveCount}</p>
        </div>
        <div className="bg-slate-50 rounded-lg py-1.5 px-2">
          <p className="text-[11px] font-medium text-slate-700">Neutral</p>
          <p className="text-sm font-bold text-slate-700">{neutralCount}</p>
        </div>
        <div className="bg-rose-50/70 rounded-lg py-1.5 px-2">
          <p className="text-[11px] font-medium text-rose-800">Negative</p>
          <p className="text-sm font-bold text-rose-700">{negativeCount}</p>
        </div>
      </div>
    </div>
  );
};
