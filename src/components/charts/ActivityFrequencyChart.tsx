import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface ActivityFrequencyChartProps {
  data: Array<{ name: string; count: number }>;
}

export const ActivityFrequencyChart: React.FC<ActivityFrequencyChartProps> = ({ data }) => {
  const topActivities = data.slice(0, 6);

  return (
    <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Frequent Wellness Activities</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Most common lifestyle practices logged</p>
        </div>
      </div>

      <div className="h-56 w-full">
        {topActivities.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            No activities recorded yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topActivities}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs shadow-lg">
                        <span className="font-semibold">{item.name}: </span>
                        <span className="text-teal-300">{item.count} sessions</span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
