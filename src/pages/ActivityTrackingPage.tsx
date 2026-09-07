import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ActivityRecord } from '../types';
import { ActivityFrequencyChart } from '../components/charts/ActivityFrequencyChart';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  Activity as ActivityIcon,
  Calendar,
  Clock,
  Trash2,
  CheckCircle2,
  Plus,
  Flame,
  TrendingUp,
} from 'lucide-react';

const CATEGORIES = [
  'Exercise',
  'Walking',
  'Studying',
  'Reading',
  'Socializing',
  'Gaming',
  'Hobbies',
  'Resting',
  'Meditation',
  'Cooking',
  'Other',
];

export const ActivityTrackingPage: React.FC = () => {
  const [activityName, setActivityName] = useState<string>('Exercise');
  const [customName, setCustomName] = useState<string>('');
  const [duration, setDuration] = useState<string>('45');
  const [activityDate, setActivityDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [frequencies, setFrequencies] = useState<Array<{ name: string; count: number; totalMinutes: number }>>([]);
  const [activitiesList, setActivitiesList] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activityToDelete, setActivityToDelete] = useState<ActivityRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [freqRes, listRes] = await Promise.all([
        api.getActivityFrequencies(30),
        api.getActivities(),
      ]);
      setFrequencies(freqRes.frequencies);
      setActivitiesList(listRes.activities);
    } catch (err) {
      console.error('Failed to load activity data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = activityName === 'Other' && customName.trim() ? customName.trim() : activityName;
    const durNum = duration ? parseInt(duration, 10) : undefined;

    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await api.recordActivity({
        activity_name: finalName,
        duration: durNum,
        activity_date: activityDate,
      });
      setSuccessMsg(`Recorded '${finalName}' (${durNum ? `${durNum} mins` : 'Completed'})!`);
      setCustomName('');
      loadData();
    } catch (err: any) {
      console.error('Failed to save activity:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activityToDelete) return;
    try {
      await api.deleteActivity(activityToDelete.id);
      setActivityToDelete(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  };

  const totalMinutesAll = activitiesList.reduce((acc, curr) => acc + (curr.duration || 0), 0);

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-300 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white tracking-tight">
          Activities & Lifestyle Tracking
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track habits, hobbies, and physical routines to reveal how daily choices shape mental vitality.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Stat Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Total Sessions Logged</span>
          <span className="text-3xl font-bold text-teal-700 dark:text-teal-400 mt-2 block">{activitiesList.length}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">Active routines</span>
        </div>

        <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Cumulative Active Time</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{Math.round(totalMinutesAll / 60)}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">hours ({totalMinutesAll}m)</span>
          </div>
          <span className="text-[11px] text-teal-600 dark:text-teal-400 mt-1 block font-medium">Dedication to well-being</span>
        </div>

        <div className="bg-white dark:bg-[#13192b] p-5 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Top Lifestyle Habit</span>
          <span className="text-xl font-bold text-slate-800 dark:text-white mt-2 block truncate">
            {frequencies.length > 0 ? frequencies[0].name : 'None yet'}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            {frequencies.length > 0 ? `${frequencies[0].count} sessions logged` : 'Start logging below'}
          </span>
        </div>
      </div>

      {/* Log Activity Form */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
        <form onSubmit={handleRecordActivity} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Log New Activity</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select a category and specify time invested</p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <input
                type="date"
                value={activityDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setActivityDate(e.target.value)}
                aria-label="Activity date"
                className="text-xs border border-slate-200 dark:border-[#242f4e] rounded-lg px-2.5 py-1.5 focus:outline-teal-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Categories Grid */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = activityName === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActivityName(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#182035] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#202b47]'
                  }`}
                >
                  <ActivityIcon className="w-3 h-3" />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {activityName === 'Other' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Custom Activity Name:
              </label>
              <input
                type="text"
                placeholder="e.g. Painting, Guitar, Swimming..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full text-xs border border-slate-200 dark:border-[#242f4e] rounded-xl px-3 py-2 focus:outline-teal-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          )}

          {/* Duration in Minutes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Duration in Minutes:</span>
              <span className="text-teal-600 dark:text-teal-400 font-bold">{duration || 0} Minutes</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full accent-teal-600 h-2 bg-slate-200 dark:bg-[#242f4e] rounded-lg cursor-pointer"
              />
              <input
                type="number"
                min="0"
                max="600"
                step="5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-20 text-center text-xs font-semibold border border-slate-200 dark:border-[#242f4e] rounded-lg py-1.5 focus:outline-teal-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Logging...' : 'Save Activity Record'}
            </button>
          </div>
        </form>
      </div>

      {/* Activity Distribution Chart */}
      <ActivityFrequencyChart data={frequencies} />

      {/* Activity History Logs */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Recorded Activity Logs</h3>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">{activitiesList.length} logs recorded</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading activities...</div>
        ) : activitiesList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">No activities recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1e263d]">
            {activitiesList.map((rec) => (
              <div
                key={rec.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-[#182035] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    <ActivityIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        {rec.activity_name}
                      </span>
                      {rec.duration && (
                        <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/40 px-2 py-0.5 rounded-md">
                          {rec.duration} mins
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {new Date(rec.activity_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActivityToDelete(rec)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Delete Activity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!activityToDelete}
        title="Delete Activity Record"
        message="Are you sure you want to delete this recorded activity?"
        onConfirm={handleDelete}
        onCancel={() => setActivityToDelete(null)}
      />
    </div>
  );
};
