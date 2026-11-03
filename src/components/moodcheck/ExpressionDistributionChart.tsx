import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  ArrowUpDown,
  Sparkles,
  Info,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { ExpressionScores, ExpressionCategory } from '../../types';

export interface ExpressionDistributionChartProps {
  scores: ExpressionScores;
  dominantExpression?: ExpressionCategory | null;
  dominantConfidence?: number;
  modelName?: string;
  className?: string;
  compact?: boolean;
}

interface CategoryConfig {
  key: ExpressionCategory;
  label: string;
  description: string;
  colorClass: string;
  barColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'happy',
    label: 'Happy',
    description: 'Upward lip corners & cheek elevation',
    colorClass: 'emerald',
    barColor: 'bg-emerald-500 dark:bg-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800/50',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    key: 'neutral',
    label: 'Neutral',
    description: 'Resting brow & level mouth alignment',
    colorClass: 'blue',
    barColor: 'bg-blue-500 dark:bg-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  {
    key: 'sad',
    label: 'Sad',
    description: 'Subdued downward mouth angle & inner brow raise',
    colorClass: 'indigo',
    barColor: 'bg-indigo-500 dark:bg-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderColor: 'border-indigo-200 dark:border-indigo-800/50',
    textColor: 'text-indigo-700 dark:text-indigo-300',
  },
  {
    key: 'surprised',
    label: 'Surprised',
    description: 'Widened eyes & raised arched eyebrows',
    colorClass: 'amber',
    barColor: 'bg-amber-500 dark:bg-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  {
    key: 'fearful',
    label: 'Fearful',
    description: 'Elevated brow tension with tightened eyelids',
    colorClass: 'violet',
    barColor: 'bg-violet-500 dark:bg-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    borderColor: 'border-violet-200 dark:border-violet-800/50',
    textColor: 'text-violet-700 dark:text-violet-300',
  },
  {
    key: 'disgusted',
    label: 'Disgusted',
    description: 'Nose wrinkle & raised upper lip curvature',
    colorClass: 'teal',
    barColor: 'bg-teal-500 dark:bg-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    borderColor: 'border-teal-200 dark:border-teal-800/50',
    textColor: 'text-teal-700 dark:text-teal-300',
  },
  {
    key: 'angry',
    label: 'Angry',
    description: 'Drawn-together furrowed brows & compressed lips',
    colorClass: 'rose',
    barColor: 'bg-rose-500 dark:bg-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800/50',
    textColor: 'text-rose-700 dark:text-rose-300',
  },
];

export const ExpressionDistributionChart: React.FC<ExpressionDistributionChartProps> = ({
  scores,
  dominantExpression,
  dominantConfidence,
  modelName = 'FaceExpressionNet',
  className = '',
  compact = false,
}) => {
  const [sortByScore, setSortByScore] = useState<boolean>(true);
  const [hoveredKey, setHoveredKey] = useState<ExpressionCategory | null>(null);

  // Compute items with percentages and sort order
  const chartItems = useMemo(() => {
    const items = CATEGORY_CONFIGS.map((config) => {
      const rawScore = scores[config.key] ?? 0;
      const percentage = Math.max(0, Math.min(100, rawScore * 100));
      const isDominant = dominantExpression === config.key;

      return {
        ...config,
        rawScore,
        percentage,
        isDominant,
      };
    });

    if (sortByScore) {
      return [...items].sort((a, b) => b.rawScore - a.rawScore);
    }
    return items;
  }, [scores, dominantExpression, sortByScore]);

  // Determine top expression if not explicitly provided
  const topItem = useMemo(() => {
    return chartItems.reduce((max, item) => (item.rawScore > max.rawScore ? item : max), chartItems[0]);
  }, [chartItems]);

  const dominantName = dominantExpression
    ? dominantExpression.charAt(0).toUpperCase() + dominantExpression.slice(1)
    : topItem.label;

  const topPercent = dominantConfidence !== undefined
    ? (dominantConfidence * 100).toFixed(1)
    : topItem.percentage.toFixed(1);

  // Confidence tier estimation
  const confidenceTier = useMemo(() => {
    const val = Number(topPercent);
    if (val >= 60) return { label: 'Clear signal', badgeClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/40' };
    if (val >= 35) return { label: 'Moderate signal', badgeClass: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/40' };
    return { label: 'Diffuse / Mixed signal', badgeClass: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/40' };
  }, [topPercent]);

  return (
    <div
      className={`bg-white dark:bg-[#13192b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs transition-colors duration-200 ${className}`}
    >
      {/* Header with Title and Sorting Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Expression Distribution</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                7 Classes
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Real-time neural confidence distribution &bull; {modelName}
            </p>
          </div>
        </div>

        {/* Sort Toggle Button */}
        <button
          type="button"
          onClick={() => setSortByScore((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer w-fit"
          title="Toggle sort order between rank by score and natural category order"
        >
          <ArrowUpDown className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          <span>{sortByScore ? 'Sorted by Score' : 'Natural Order'}</span>
        </button>
      </div>

      {/* Dominant Highlight Banner */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
              Dominant Visual Pattern
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {dominantName} ({topPercent}%)
            </span>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${confidenceTier.badgeClass}`}
        >
          {confidenceTier.label}
        </span>
      </div>

      {/* Horizontal Bar Chart Rows */}
      <div className="space-y-2.5 pt-1">
        {chartItems.map((item) => {
          const isHovered = hoveredKey === item.key;

          return (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 ${
                item.isDominant
                  ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/50'
                  : isHovered
                  ? 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40'
                  : 'bg-transparent border border-transparent'
              }`}
            >
              {/* Category Label and Value */}
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`font-semibold truncate ${
                      item.isDominant
                        ? 'text-purple-900 dark:text-purple-200 text-xs sm:text-sm'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </span>

                  {item.isDominant && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Dominant</span>
                    </span>
                  )}

                  {!compact && (
                    <span className="hidden md:inline text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      &bull; {item.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono font-bold ${
                      item.isDominant
                        ? 'text-purple-700 dark:text-purple-300 text-xs sm:text-sm'
                        : 'text-slate-600 dark:text-slate-400 text-xs'
                    }`}
                  >
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    ({item.rawScore.toFixed(3)})
                  </span>
                </div>
              </div>

              {/* Bar Meter Track and Fill */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 sm:h-2.5 rounded-full overflow-hidden p-0.5 relative">
                {/* 25%, 50%, 75% tick indicators */}
                <div className="absolute inset-0 flex justify-between pointer-events-none px-0.5 opacity-25">
                  <span className="w-px h-full bg-slate-400" style={{ left: '25%' }} />
                  <span className="w-px h-full bg-slate-400" style={{ left: '50%' }} />
                  <span className="w-px h-full bg-slate-400" style={{ left: '75%' }} />
                </div>

                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    item.isDominant
                      ? 'bg-purple-600 dark:bg-purple-400 shadow-sm'
                      : item.barColor
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(item.percentage > 0 ? 3 : 0, item.percentage))}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis Scale Markers */}
      <div className="flex justify-between items-center px-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-mono">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>

      {/* Non-Diagnostic Ethical Note */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <p>
          These scores indicate visual 2D pattern activation produced by the local neural model. They describe physical features in the camera image and do not measure or determine your internal feelings.
        </p>
      </div>
    </div>
  );
};
