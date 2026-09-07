import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { MoodType, ActiveTab } from '../types';
import {
  Save,
  Tag,
  Shuffle,
  Cpu,
  Sprout,
  CheckCircle2,
  AlertCircle,
  Moon,
  Activity as ActivityIcon,
} from 'lucide-react';

interface JournalPageProps {
  initialDate?: string;
  onNavigate: (tab: ActiveTab) => void;
  onEntrySaved?: () => void;
}

const MINDFUL_PROMPTS = [
  'What is one thing that went exceptionally well today?',
  'What is something that made you smile or brought you calm today?',
  'What is a challenge you handled better than you expected?',
  'What are you feeling most grateful for right now?',
  'What is a kind thought you can give to yourself today?',
  'What brought you clarity, focus, or quiet peace today?',
  'What is a small choice today that protected your mental energy?',
];

const PRESET_TAGS = [
  'grateful',
  'calm',
  'productive',
  'anxious',
  'inspired',
  'tired',
  'hopeful',
  'stressed',
];

interface MoodOption {
  type: MoodType;
  label: string;
  emoji: string;
}

const MOOD_CARDS: MoodOption[] = [
  { type: 'Very Sad', label: 'Down', emoji: '😫' },
  { type: 'Sad', label: 'Low', emoji: '😟' },
  { type: 'Neutral', label: 'Neutral', emoji: '😐' },
  { type: 'Happy', label: 'Good', emoji: '😊' },
  { type: 'Very Happy', label: 'Radiant', emoji: '✨' },
];

export const JournalPage: React.FC<JournalPageProps> = ({
  initialDate,
  onNavigate,
  onEntrySaved,
}) => {
  // Today formatted as in Screenshot 49 e.g. "Thu, Aug 6, 2026"
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const [date] = useState<string>(initialDate || new Date().toISOString().split('T')[0]);
  const [mood, setMood] = useState<MoodType>('Happy');
  const [selectedTags, setSelectedTags] = useState<string[]>(['grateful', 'calm']);
  const [sleepHours, setSleepHours] = useState<number | ''>(7.5);
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['Mindful Breathing']);
  const [promptIndex, setPromptIndex] = useState<number>(0);
  const [journalText, setJournalText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // AFINN Lexicon Client-side live calculation for instant feedback
  const sentimentAnalysis = useMemo(() => {
    if (!journalText.trim()) {
      return {
        score: 0,
        emoji: '😐',
        title: 'Balanced & Calm',
        subtitle: 'Your entry reflects a steady, grounded, and neutral state of mind.',
        triggers: [] as { word: string; weight: number }[],
        tip: 'A neutral mind is a great foundation for mindfulness and clear thinking.',
      };
    }

    const afinnDictionary: Record<string, number> = {
      grateful: 3,
      gratitude: 3,
      calm: 2,
      peaceful: 3,
      peace: 2,
      happy: 3,
      happiness: 3,
      joy: 3,
      joyful: 4,
      radiant: 4,
      productive: 2,
      inspired: 3,
      hopeful: 2,
      hope: 2,
      love: 3,
      loved: 3,
      wonderful: 4,
      great: 3,
      good: 2,
      awesome: 4,
      excellent: 4,
      relaxed: 3,
      blessed: 3,
      smile: 2,
      clarity: 2,
      thriving: 3,
      anxious: -3,
      anxiety: -3,
      stressed: -3,
      stress: -3,
      tired: -2,
      exhausted: -3,
      down: -2,
      sad: -2,
      sadness: -3,
      terrible: -3,
      awful: -3,
      bad: -2,
      frustrated: -3,
      angry: -3,
      overwhelmed: -3,
      lonely: -3,
      fear: -3,
      hurt: -3,
      struggling: -2,
    };

    const words = journalText.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    let score = 0;
    const triggers: { word: string; weight: number }[] = [];

    words.forEach((w) => {
      if (afinnDictionary[w] !== undefined) {
        score += afinnDictionary[w];
        if (!triggers.some((t) => t.word === w)) {
          triggers.push({ word: w, weight: afinnDictionary[w] });
        }
      }
    });

    // Clamp score between -10 and +10
    const clampedScore = Math.max(-10, Math.min(10, score));

    let emoji = '😐';
    let title = 'Balanced & Calm';
    let subtitle = 'Your entry reflects a steady, grounded, and neutral state of mind.';
    let tip = 'A neutral mind is a great foundation for mindfulness and clear thinking.';

    if (clampedScore >= 3) {
      emoji = '✨';
      title = 'Radiant & Uplifted';
      subtitle = 'Your reflection radiates positive energy, gratitude, and mental clarity.';
      tip = 'Anchor this moment of peace by appreciating what made you feel fulfilled today.';
    } else if (clampedScore >= 1) {
      emoji = '😊';
      title = 'Good & Optimistic';
      subtitle = 'Your writing reflects constructive optimism and positive well-being.';
      tip = 'Carry this calm forward into tomorrow by celebrating your daily progress.';
    } else if (clampedScore <= -3) {
      emoji = '😫';
      title = 'Heavy & Stressed';
      subtitle = 'Your entry reflects emotional tension or exhaustion. Remember to breathe.';
      tip = 'Be exceptionally gentle with yourself today. Try the 4-7-8 breathing exercise in Relaxation.';
    } else if (clampedScore < 0) {
      emoji = '😟';
      title = 'Reflective & Low';
      subtitle = 'Your thoughts carry a reflective, subdued tone. It is okay to not feel 100%.';
      tip = 'Writing down your worries is a powerful first step in releasing them.';
    }

    return {
      score: clampedScore,
      emoji,
      title,
      subtitle,
      triggers,
      tip,
    };
  }, [journalText]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleShufflePrompt = () => {
    setPromptIndex((prev) => (prev + 1) % MINDFUL_PROMPTS.length);
  };

  const toggleActivity = (activity: string) => {
    if (selectedActivities.includes(activity)) {
      setSelectedActivities(selectedActivities.filter((a) => a !== activity));
    } else {
      setSelectedActivities([...selectedActivities, activity]);
    }
  };

  const PRESET_ACTIVITIES = ['Walking', 'Mindful Breathing', 'Yoga', 'Reading', 'Meditation', 'Hydration'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalText.trim()) {
      setErrorNotice('Please write a brief reflection before saving.');
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      await api.createJournal({
        journal_text: journalText,
        mood,
        sleep_hours: sleepHours !== '' ? Number(sleepHours) : undefined,
        activities: selectedActivities,
        tags: selectedTags,
        entry_date: date,
      });

      setSuccessNotice('Journal entry saved to Firestore & analyzed with NLP successfully!');
      if (onEntrySaved) onEntrySaved();

      setTimeout(() => {
        onNavigate('history');
      }, 1000);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to save entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert sentiment score (-10 to +10) into percentage 0% to 100% for the gradient meter
  const meterPercentage = Math.round(((sentimentAnalysis.score + 10) / 20) * 100);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {errorNotice && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* 2-Column Grid matching Screenshot 49 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Journal Entry Card */}
        <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg flex flex-col justify-between space-y-5 transition-colors duration-200">
          {/* Header row: Feeling right now + Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                How are you feeling right now?
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formattedToday}</span>
          </div>

          {/* 5 Mood cards in a row */}
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
            {MOOD_CARDS.map((card) => {
              const isSelected = mood === card.type;
              return (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => setMood(card.type)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer min-h-[76px] ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-[#291e47] border-purple-500 dark:border-[#7c3aed] ring-2 ring-purple-400/50 dark:ring-[#7c3aed]/50 text-purple-900 dark:text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-[#182035] border-slate-200 dark:border-[#283556] hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-2xl mb-1">{card.emoji}</span>
                  <span
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-purple-700 dark:text-[#c084fc]' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {card.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Emotion & Focus Tags */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Tag className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Emotion & Focus Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 dark:bg-[#06b6d4] text-white font-semibold shadow-sm'
                        : 'bg-slate-100 dark:bg-[#182035] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#283556] hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Banner with Shuffle button */}
          <div className="bg-slate-50 dark:bg-[#182035] p-3.5 rounded-xl border border-slate-200 dark:border-[#283556] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <span className="text-base">💡</span>
              <span className="font-medium leading-snug">{MINDFUL_PROMPTS[promptIndex]}</span>
            </div>
            <button
              type="button"
              onClick={handleShufflePrompt}
              className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-[#202945] rounded-lg transition-colors cursor-pointer flex-shrink-0"
              title="Shuffle prompt"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sleep & Mindful Activities Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-[#182035]/60 p-3 rounded-xl border border-slate-200 dark:border-[#283556]">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Sleep Last Night (Hours)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="7.5"
                  className="w-24 p-2 bg-white dark:bg-[#0e1322] border border-slate-200 dark:border-[#242f4e] rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">hours</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                <ActivityIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Mindful Activities</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ACTIVITIES.slice(0, 4).map((act) => {
                  const isSelected = selectedActivities.includes(act);
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() => toggleActivity(act)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-white dark:bg-[#0e1322] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#242f4e] hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {act}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <textarea
              rows={7}
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Write down your thoughts, emotions, reflection, or daily experiences..."
              className="w-full p-4 bg-white dark:bg-[#0e1322] border border-slate-200 dark:border-[#242f4e] rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent leading-relaxed resize-none"
            />
          </div>

          {/* Full-width Save Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving...' : 'Save Journal Entry'}</span>
          </button>
        </div>

        {/* Right Column: Live Sentiment & Sentiment Engine */}
        <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg flex flex-col justify-between space-y-6 transition-colors duration-200">
          {/* Top row: Engine title + Lexicon badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Live Sentiment & Sentiment Engine
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#182035] border border-slate-200 dark:border-[#283556] px-2.5 py-1 rounded-full">
              AFINN Lexicon Engine
            </span>
          </div>

          {/* Big Center Emoji & Status Title */}
          <div className="flex flex-col items-center text-center py-3">
            <span className="text-6xl sm:text-7xl select-none mb-3 animate-bounce-short">
              {sentimentAnalysis.emoji}
            </span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {sentimentAnalysis.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
              {sentimentAnalysis.subtitle}
            </p>
          </div>

          {/* Sentiment Score Box */}
          <div className="bg-slate-50 dark:bg-[#0e1322] p-4 rounded-xl border border-slate-200 dark:border-[#242f4e] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Sentiment Score (-10 to +10)</span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-cyan-100 dark:bg-[#083344] text-cyan-800 dark:text-[#22d3ee] border border-cyan-300 dark:border-[#0e7490]">
                SCORE: {sentimentAnalysis.score > 0 ? `+${sentimentAnalysis.score.toFixed(1)}` : sentimentAnalysis.score.toFixed(1)}
              </span>
            </div>

            {/* Gradient horizontal score bar */}
            <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-cyan-400 to-emerald-500 overflow-hidden">
              {/* Score indicator marker */}
              <div
                className="absolute top-0 bottom-0 w-3 bg-white rounded-full shadow-md -ml-1.5 transition-all duration-300"
                style={{ left: `${meterPercentage}%` }}
              />
            </div>

            {/* Key Emotional Triggers */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#1f2842] text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Key Emotional Triggers Detected: </span>
              {sentimentAnalysis.triggers.length > 0 ? (
                <div className="inline-flex flex-wrap gap-1.5 ml-1.5">
                  {sentimentAnalysis.triggers.map((t) => (
                    <span
                      key={t.word}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                        t.weight > 0
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40'
                          : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/40'
                      }`}
                    >
                      {t.weight > 0 ? `+${t.word}` : `-${t.word}`}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 italic">No strong sentiment words detected yet.</span>
              )}
            </div>
          </div>

          {/* AI Reflection Tip */}
          <div className="bg-slate-50 dark:bg-[#182035] p-4 rounded-xl border border-slate-200 dark:border-[#283556] space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              <span>💡</span>
              <span>AI Reflection Tip</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
              "{sentimentAnalysis.tip}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
