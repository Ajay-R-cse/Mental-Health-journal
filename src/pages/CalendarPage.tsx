import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { JournalEntry, MoodRecord, SleepRecord, ActivityRecord, ActiveTab, MoodType } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  PenLine,
  Moon,
  Activity,
  Smile,
  Calendar as CalendarIcon,
  PlusCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface CalendarPageProps {
  onNavigate: (tab: ActiveTab) => void;
}

const MOOD_EMOJIS: Record<MoodType, string> = {
  'Very Happy': '😄',
  Happy: '😊',
  Neutral: '😐',
  Sad: '😔',
  'Very Sad': '😢',
};

export const CalendarPage: React.FC<CalendarPageProps> = ({ onNavigate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [moods, setMoods] = useState<MoodRecord[]>([]);
  const [sleeps, setSleeps] = useState<SleepRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [selectedDayStr, setSelectedDayStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<boolean>(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadData = async () => {
    setLoading(true);
    try {
      const [jRes, mRes, sRes, aRes] = await Promise.all([
        api.getJournals(),
        api.getMoods(),
        api.getSleepRecords(),
        api.getActivities(),
      ]);
      setJournals(jRes.entries);
      setMoods(mRes.moods);
      setSleeps(sRes.sleepRecords);
      setActivities(aRes.activities);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calendar grid calculations
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingArray = Array.from({ length: firstDayIndex }, (_, i) => i);

  const getDayDateString = (day: number) => {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  };

  // Records for currently selected date
  const dayJournals = journals.filter((j) => j.entry_date === selectedDayStr);
  const dayMood = moods.find((m) => m.date === selectedDayStr);
  const daySleep = sleeps.find((s) => s.sleep_date === selectedDayStr);
  const dayActivities = activities.filter((a) => a.activity_date === selectedDayStr);

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in duration-300 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 tracking-tight">
          Wellness Calendar View
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore your daily journaling activity, moods, sleep, and habits across the calendar month.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Header Month / Nav */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-bold text-slate-800">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Month Days */}
          <div className="grid grid-cols-7 gap-1.5">
            {paddingArray.map((p) => (
              <div key={`pad-${p}`} className="h-20 sm:h-24 bg-slate-50/40 rounded-xl"></div>
            ))}

            {daysArray.map((day) => {
              const dateStr = getDayDateString(day);
              const isSelected = selectedDayStr === dateStr;
              const hasJournal = journals.some((j) => j.entry_date === dateStr);
              const hasMood = moods.some((m) => m.date === dateStr);
              const hasSleep = sleeps.some((s) => s.sleep_date === dateStr);
              const hasActivity = activities.some((a) => a.activity_date === dateStr);

              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDayStr(dateStr)}
                  className={`h-20 sm:h-24 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500/20 shadow-xs'
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-teal-600 text-white' : 'text-slate-700'
                      }`}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Indicator Pills / Badges */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {hasJournal && (
                      <span className="text-[10px]" title="Journal written">
                        📝
                      </span>
                    )}
                    {hasMood && (
                      <span className="text-[10px]" title="Mood recorded">
                        😊
                      </span>
                    )}
                    {hasSleep && (
                      <span className="text-[10px]" title="Sleep recorded">
                        💤
                      </span>
                    )}
                    {hasActivity && (
                      <span className="text-[10px]" title="Activity recorded">
                        🏃
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Indicators:</span>
            <div className="flex items-center gap-3">
              <span>📝 Journal</span>
              <span>😊 Mood</span>
              <span>💤 Sleep</span>
              <span>🏃 Activity</span>
            </div>
          </div>
        </div>

        {/* Selected Date Detail Panel (1 Col) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                Selected Day Overview
              </span>
              <h3 className="text-base font-bold text-slate-800 font-serif mt-0.5">
                {new Date(selectedDayStr + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
            </div>

            {/* Mood status */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smile className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-semibold text-slate-700">Mood:</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {dayMood ? `${MOOD_EMOJIS[dayMood.mood]} ${dayMood.mood}` : 'Not logged'}
              </span>
            </div>

            {/* Sleep status */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-700">Sleep Duration:</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {daySleep ? `${daySleep.sleep_hours} Hours` : 'Not logged'}
              </span>
            </div>

            {/* Activities status */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-semibold text-slate-700">Activities Logged:</span>
              </div>
              {dayActivities.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {dayActivities.map((act) => (
                    <span
                      key={act.id}
                      className="px-2 py-0.5 bg-teal-100/70 text-teal-800 text-[11px] font-medium rounded-md"
                    >
                      {act.activity_name} {act.duration ? `(${act.duration}m)` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">No activities recorded</span>
              )}
            </div>

            {/* Journal Entries on this day */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Journal Entries ({dayJournals.length}):</h4>
              {dayJournals.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dayJournals.map((j) => (
                    <div key={j.id} className="p-3 rounded-xl bg-slate-50 text-xs text-slate-700 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-teal-700">{j.sentiment} reflection</span>
                        <span className="text-slate-400">
                          {new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-slate-600 leading-relaxed">{j.journal_text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No journal reflection on this date.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('journal')}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <PenLine className="w-4 h-4" />
              <span>Write Entry for Today</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
