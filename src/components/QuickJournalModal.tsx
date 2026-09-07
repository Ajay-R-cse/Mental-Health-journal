import React, { useState } from 'react';
import { api } from '../services/api';
import { MoodType } from '../types';
import { MoodSelector } from './MoodSelector';
import { X, Sparkles, Save, CheckCircle2 } from 'lucide-react';

interface QuickJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const QuickJournalModal: React.FC<QuickJournalModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mood, setMood] = useState<MoodType>('Happy');
  const [text, setText] = useState<string>('');
  const [sleep, setSleep] = useState<string>('7.5');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Please write a short thought or reflection.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createJournal({
        journal_text: text.trim(),
        mood,
        sleep_hours: sleep ? parseFloat(sleep) : undefined,
        activities: ['DailyReflection'],
      });
      setText('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save reflection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#13192b] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-[#242f4e] animate-in fade-in zoom-in-95 space-y-4 transition-colors duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1f2842] pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Quick Journal Reflection</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Capture a moment or mood check-in</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">How are you feeling right now?</label>
            <MoodSelector selectedMood={mood} onSelectMood={(m) => setMood(m)} size="sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Your Thoughts:</label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's happening in your day right now?"
              className="w-full text-xs p-3 border border-slate-200 dark:border-[#242f4e] rounded-xl focus:outline-teal-500 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sleep (hrs):</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                className="w-16 text-center text-xs border border-slate-200 dark:border-[#242f4e] rounded-lg py-1 bg-slate-50 dark:bg-[#0e1322] text-slate-900 dark:text-slate-100 font-semibold"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#182035] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
