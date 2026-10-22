import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Sparkles, ArrowRight, Camera, Mic, Smile, BookOpen, AlertCircle, Shield } from 'lucide-react';
import { MoodCheckRecord, ActiveTab } from '../../types';
import { api } from '../../services/api';

interface MultimodalMoodInsightsCardProps {
  onNavigate: (tab: ActiveTab) => void;
}

// Normalized 1-5 emotional valence scale for cross-modal comparison
const MANUAL_SCORE: Record<string, number> = {
  'Very Happy': 5,
  Happy: 4,
  Neutral: 3,
  Sad: 2,
  'Very Sad': 1,
};

const SENTIMENT_SCORE: Record<string, number> = {
  Positive: 4.5,
  Neutral: 3.0,
  Negative: 1.5,
};

const CAMERA_SCORE: Record<string, number> = {
  'Positive / pleasant expression': 4.5,
  'Neutral expression': 3.0,
  'Concerned / tense-looking expression': 2.0,
  'Tired-looking expression': 2.0,
  'Mixed/uncertain': 3.0,
};

const VOICE_SCORE: Record<string, number> = {
  'Energetic-sounding': 4.5,
  'Calm-sounding': 4.0,
  'Neutral/uncertain': 3.0,
  'Tired-sounding': 2.0,
  'Tense-sounding': 1.8,
};

export const MultimodalMoodInsightsCard: React.FC<MultimodalMoodInsightsCardProps> = ({
  onNavigate,
}) => {
  const [moodChecks, setMoodChecks] = useState<MoodCheckRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    api
      .getMoodChecks(10)
      .then((res) => {
        if (mounted) {
          setMoodChecks(res.records);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load mood checks for insights:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Format chart data sorted chronologically
  const chartData = [...moodChecks]
    .reverse()
    .slice(-7)
    .map((record, index) => {
      const displayDate = new Date(record.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      return {
        key: record.id || `idx-${index}`,
        displayDate,
        date: record.date,
        manual: record.manualMood ? MANUAL_SCORE[record.manualMood] ?? 3 : null,
        sentiment: record.journalSentiment ? SENTIMENT_SCORE[record.journalSentiment] ?? null : null,
        camera: record.cameraEstimate ? CAMERA_SCORE[record.cameraEstimate] ?? null : null,
        voice: record.voiceEstimate ? VOICE_SCORE[record.voiceEstimate] ?? null : null,
        rawManual: record.manualMood,
        rawSentiment: record.journalSentiment,
        rawCamera: record.cameraEstimate,
        rawVoice: record.voiceEstimate,
      };
    });

  const hasChartData = chartData.length > 0;

  return (
    <div className="bg-white dark:bg-[#13192b] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-[#242f4e] shadow-xs space-y-6 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Multimodal Mood Insights</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            Cross-Signal Alignment & Comparison
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Observational alignment between your manual self-reports, journal tone, and optional camera/voice checks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('mood-check')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>Open Mood Check</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mandatory Clinical Disconnection Note */}
      <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">
            Signals may differ. Facial expression and voice do not always match internal feelings.
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            Visible facial expressions, speaking pace, and ambient acoustics vary widely based on tiredness, lighting, and speaking habits. These estimates are intended for mindful reflection and are not a medical diagnosis.
          </p>
        </div>
      </div>

      {/* Trend Comparison Chart */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Trend Comparison Chart (Manual vs Journal vs Camera vs Voice)
          </span>
          <span className="text-[11px] text-slate-400">Scale: 1 (Very Sad / Low) to 5 (Very Happy / Uplifted)</span>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            Loading multimodal trends...
          </div>
        ) : hasChartData ? (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415525" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#33415525' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-lg border border-slate-700 text-xs space-y-1.5 backdrop-blur-md">
                          <p className="font-semibold text-slate-300 border-b border-slate-700 pb-1">
                            {label} ({item.date})
                          </p>
                          {item.rawManual && (
                            <p className="text-amber-400 flex items-center gap-1.5">
                              <Smile className="w-3 h-3" />
                              <span>Manual Mood: {item.rawManual}</span>
                            </p>
                          )}
                          {item.rawSentiment && (
                            <p className="text-blue-400 flex items-center gap-1.5">
                              <BookOpen className="w-3 h-3" />
                              <span>Journal Sentiment: {item.rawSentiment}</span>
                            </p>
                          )}
                          {item.rawCamera && (
                            <p className="text-teal-400 flex items-center gap-1.5">
                              <Camera className="w-3 h-3" />
                              <span>Camera: {item.rawCamera}</span>
                            </p>
                          )}
                          {item.rawVoice && (
                            <p className="text-indigo-400 flex items-center gap-1.5">
                              <Mic className="w-3 h-3" />
                              <span>Voice: {item.rawVoice}</span>
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="manual"
                  name="Manual Mood"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f59e0b' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="sentiment"
                  name="Journal Sentiment"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#3b82f6' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="camera"
                  name="Camera Expression"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#14b8a6' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="voice"
                  name="Voice Tone"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#818cf8' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center bg-slate-50 dark:bg-[#0e1424] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              No multimodal checks logged yet.
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Run an optional Mood Check with your camera, voice, manual picker, or journal to visualize how your signals align over time.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('mood-check')}
              className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Try Mood Check</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Recent Mood Checks Feed */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 dark:text-white">
            Recent Mood Checks
          </span>
          <button
            type="button"
            onClick={() => onNavigate('mood-check')}
            className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
          >
            Manage Records
          </button>
        </div>

        {moodChecks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {moodChecks.slice(0, 3).map((check) => (
              <div
                key={check.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>{check.date}</span>
                  <span>{new Date(check.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="space-y-1">
                  {check.manualMood && (
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                      <Smile className="w-3 h-3 text-amber-500" />
                      <span>Manual: {check.manualMood}</span>
                    </div>
                  )}
                  {check.journalSentiment && (
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <BookOpen className="w-3 h-3 text-blue-500" />
                      <span>Sentiment: {check.journalSentiment}</span>
                    </div>
                  )}
                  {check.cameraEstimate && (
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <Camera className="w-3 h-3 text-teal-500" />
                      <span>Camera: {check.cameraEstimate}</span>
                    </div>
                  )}
                  {check.voiceEstimate && (
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <Mic className="w-3 h-3 text-indigo-500" />
                      <span>Voice: {check.voiceEstimate}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Your most recent 3 mood checks will appear here for rapid reflection.
          </p>
        )}
      </div>
    </div>
  );
};
