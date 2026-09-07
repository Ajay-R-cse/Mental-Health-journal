import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SleepRecord, DashboardTrends } from '../types';
import { SleepTrendChart } from '../components/charts/SleepTrendChart';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  Moon,
  Calendar,
  Clock,
  Trash2,
  CheckCircle2,
  Info,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const SleepTrackingPage: React.FC = () => {
  const [sleepHours, setSleepHours] = useState<string>('7.5');
  const [sleepDate, setSleepDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Statistics
  const [averages, setAverages] = useState<{ today: number; weeklyAvg: number; monthlyAvg: number; totalRecords: number }>({
    today: 0,
    weeklyAvg: 0,
    monthlyAvg: 0,
    totalRecords: 0,
  });
  const [sleepTrend, setSleepTrend] = useState<DashboardTrends['sleepTrend']>([]);
  const [sleepList, setSleepList] = useState<SleepRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recordToDelete, setRecordToDelete] = useState<SleepRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [avgRes, trendsRes, listRes] = await Promise.all([
        api.getSleepAverages(),
        api.getDashboardTrends(14),
        api.getSleepRecords(),
      ]);
      setAverages(avgRes.averages);
      setSleepTrend(trendsRes.trends.sleepTrend);
      setSleepList(listRes.sleepRecords);
    } catch (err) {
      console.error('Failed to load sleep data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = parseFloat(sleepHours);
    if (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 24) {
      alert('Please enter a valid sleep duration between 0 and 24 hours.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await api.recordSleep({
        sleep_hours: hoursNum,
        sleep_date: sleepDate,
        notes: notes.trim() || undefined,
      });
      setSuccessMsg(`Logged ${hoursNum} hours of sleep for ${sleepDate}.`);
      setNotes('');
      loadData();
    } catch (err: any) {
      console.error('Failed to record sleep:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await api.deleteSleep(recordToDelete.id);
      setRecordToDelete(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete sleep record:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-300 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white tracking-tight">
          Sleep Hygiene & Duration Tracker
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monitor your nightly sleep duration, uncover consistency patterns, and observe how rest impacts your emotional well-being.
        </p>
      </div>

      {/* Reassuring notice */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Informational Sleep Log</p>
          <p className="mt-0.5 text-indigo-700 dark:text-indigo-300 leading-relaxed">
            This module provides personal self-reflection metrics. It is not an official medical polysomnography device or diagnostic instrument.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Today's Recorded Sleep</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">
              {averages.today > 0 ? averages.today : '--'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">hours</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">Most recent night</span>
        </div>

        <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">7-Day Weekly Average</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{averages.weeklyAvg}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">hours / night</span>
          </div>
          <span className="text-[11px] text-teal-600 dark:text-teal-400 mt-1 block font-medium">
            {averages.weeklyAvg >= 7 ? '✓ Within healthy 7-9h guideline' : 'Slightly below recommended 7-9h'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">30-Day Monthly Average</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{averages.monthlyAvg}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">hours / night</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">Based on {averages.totalRecords} logs</span>
        </div>
      </div>

      {/* Log Sleep Form */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
        <form onSubmit={handleRecordSleep} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Log Sleep Duration</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Record how many hours you rested</p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <input
                type="date"
                value={sleepDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSleepDate(e.target.value)}
                aria-label="Sleep log date"
                className="text-xs border border-slate-200 dark:border-[#242f4e] rounded-lg px-2.5 py-1.5 focus:outline-indigo-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Sleep Hours:</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{sleepHours} Hours</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="14"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-[#242f4e] rounded-lg cursor-pointer"
              />
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="w-20 text-center text-xs font-semibold border border-slate-200 dark:border-[#242f4e] rounded-lg py-1.5 focus:outline-indigo-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Sleep Notes (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Drank chamomile tea, felt rested, woke up at 7am..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-200 dark:border-[#242f4e] rounded-xl px-3.5 py-2.5 focus:outline-indigo-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Sleep Record'}
            </button>
          </div>
        </form>
      </div>

      {/* Sleep Trend Chart */}
      <SleepTrendChart data={sleepTrend} averageSleep={averages.weeklyAvg || 7.5} />

      {/* Sleep Logs History Table */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Recorded Sleep History</h3>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">{sleepList.length} logs recorded</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading sleep records...</div>
        ) : sleepList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">No sleep logs recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1e263d]">
            {sleepList.map((rec) => (
              <div
                key={rec.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-[#182035] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        {rec.sleep_hours} Hours
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {new Date(rec.sleep_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {rec.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 italic">{rec.notes}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setRecordToDelete(rec)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!recordToDelete}
        title="Delete Sleep Log"
        message="Are you sure you want to delete this sleep log?"
        onConfirm={handleDelete}
        onCancel={() => setRecordToDelete(null)}
      />
    </div>
  );
};
