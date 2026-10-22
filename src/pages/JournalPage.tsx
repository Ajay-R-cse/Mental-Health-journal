import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import {
  MoodType,
  ActiveTab,
  AIJournalInsightsResponse,
  SentimentAnalysisResult,
  SentimentType,
} from '../types';
import { AIJournalInsightsCard } from '../components/AIJournalInsightsCard';
import { CameraMoodCheckCard } from '../components/moodcheck/CameraMoodCheckCard';
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
  Sparkles,
  ArrowRight,
  BookOpen,
  Camera,
  Layers,
  Check,
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
  const [debouncedJournalText, setDebouncedJournalText] = useState<string>('');

  // Submission & Analysis state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [latestInsights, setLatestInsights] = useState<AIJournalInsightsResponse | null>(null);
  const [coreNlpResult, setCoreNlpResult] = useState<SentimentAnalysisResult | null>(null);
  const [coreNlpLoading, setCoreNlpLoading] = useState<boolean>(false);
  const [savedJournalId, setSavedJournalId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Multimodal Camera Assessment section visibility
  const [showCameraAnalysis, setShowCameraAnalysis] = useState<boolean>(false);

  const analysisSectionRef = useRef<HTMLDivElement | null>(null);

  // Debounce journalText specifically for sentiment calculation to prevent UI input lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedJournalText(journalText);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [journalText]);

  // AFINN Lexicon Client-side live calculation using debounced text for smooth typing
  const sentimentAnalysis = useMemo(() => {
    if (!debouncedJournalText.trim()) {
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
      supported: 3,
      support: 3,
      friends: 2,
      friend: 2,
      passed: 2,
      pass: 2,
      okay: 1,
      ok: 1,
      delay: -2,
      delayed: -2,
      ruined: -3,
      ruin: -3,
      disappointed: -3,
    };

    const tokens = debouncedJournalText.toLowerCase().match(/[a-z']+/g) || [];
    const negations = new Set(['not', 'never', 'no', "don't", 'dont', "didn't", 'didnt', "wasn't", 'wasnt', "isn't", 'isnt', 'without', 'barely', 'hardly']);
    let score = 0;
    const triggers: { word: string; weight: number }[] = [];

    // Find contrast clause ("but", "however")
    let contrastIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'but' || tokens[i] === 'however') {
        contrastIdx = i;
        break;
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      if (afinnDictionary[w] !== undefined) {
        let isNegated = false;
        for (let j = Math.max(0, i - 3); j < i; j++) {
          if (negations.has(tokens[j])) {
            isNegated = !isNegated;
          }
        }

        const clauseWeight = contrastIdx >= 0 && i > contrastIdx ? 1.8 : 1.0;
        let wordWeight = afinnDictionary[w];

        if (isNegated) {
          if (wordWeight > 0) {
            wordWeight = -wordWeight * 0.85;
          } else {
            // Absence of negative emotion represents equanimity / mild relief rather than exuberant positive emotion
            wordWeight = -wordWeight * 0.25;
          }
          const displayLabel = `not ${w}`;
          if (!triggers.some((t) => t.word === displayLabel)) {
            triggers.push({ word: displayLabel, weight: wordWeight });
          }
        } else {
          if (!triggers.some((t) => t.word === w)) {
            triggers.push({ word: w, weight: wordWeight });
          }
        }

        score += wordWeight * clauseWeight;
      }
    }

    const clampedScore = Math.max(-10, Math.min(10, Math.round(score)));

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
  }, [debouncedJournalText]);

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

  const PRESET_ACTIVITIES = [
    'Walking',
    'Mindful Breathing',
    'Yoga',
    'Reading',
    'Meditation',
    'Hydration',
  ];

  // Common submission & analysis workflow
  const handleAnalyzeAndSubmit = async (runFullAnalysis = true) => {
    if (!journalText.trim()) {
      setErrorNotice('Please write a brief reflection before submitting for analysis.');
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    // If full analysis requested, display the optional camera analysis consent card
    if (runFullAnalysis) {
      setShowCameraAnalysis(true);
    }

    try {
      // 1. Create journal entry in Firestore
      const res = await api.createJournal({
        journal_text: journalText,
        mood,
        sleep_hours: sleepHours !== '' ? Number(sleepHours) : undefined,
        activities: selectedActivities,
        tags: selectedTags,
        entry_date: date,
      });

      const entryId = res?.entry?.id;
      if (entryId) {
        setSavedJournalId(entryId);
      }

      // 2. Perform Stanford CoreNLP Sentiment Analysis
      setCoreNlpLoading(true);
      try {
        const nlpRes = await api.analyzeText(journalText);
        if (nlpRes?.result) {
          setCoreNlpResult(nlpRes.result);
        }
      } catch (nlpErr) {
        console.warn('NLP analysis fallback triggered:', nlpErr);
      } finally {
        setCoreNlpLoading(false);
      }

      // 3. Save AI insight if already generated
      if (latestInsights && entryId) {
        try {
          await api.saveJournalInsight(entryId, latestInsights);
        } catch (saveErr) {
          console.warn('Could not save AI insight with journal entry:', saveErr);
        }
      }

      setSuccessNotice('Journal entry saved to Firestore & analyzed with Stanford CoreNLP!');
      if (onEntrySaved) onEntrySaved();

      // Smooth scroll down to analysis cards
      setTimeout(() => {
        analysisSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 350);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to save and analyze entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Called when user clicks "Generate AI Insights" inside the AI insights card
  const handleTriggerAnalysisFromInsights = () => {
    setShowCameraAnalysis(true);
  };

  const meterPercentage = Math.round(((sentimentAnalysis.score + 10) / 20) * 100);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Success Banner */}
      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <span>View in History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorNotice && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* 2-Column Grid */}
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
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {formattedToday}
            </span>
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
                      isSelected
                        ? 'text-purple-700 dark:text-[#c084fc]'
                        : 'text-slate-500 dark:text-slate-400'
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
              className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-[#202945] rounded-lg transition-colors cursor-pointer shrink-0"
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
                  onChange={(e) =>
                    setSleepHours(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
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

          {/* Action Buttons: "Analyze Journal" (triggers NLP + Gemini + Camera) & "Save Journal Entry" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleAnalyzeAndSubmit(true)}
              disabled={isSubmitting}
              className="py-3 px-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-purple-200 shrink-0" />
              <span>{isSubmitting ? 'Submitting & Analyzing...' : 'Analyze Journal'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAnalyzeAndSubmit(false)}
              disabled={isSubmitting}
              className="py-3 px-4 bg-slate-100 dark:bg-[#182035] hover:bg-slate-200 dark:hover:bg-[#202945] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#283556] font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>Save Journal Entry</span>
            </button>
          </div>
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
            <span className="text-6xl sm:text-7xl select-none mb-3">
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
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Sentiment Score (-10 to +10)
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-cyan-100 dark:bg-[#083344] text-cyan-800 dark:text-[#22d3ee] border border-cyan-300 dark:border-[#0e7490]">
                SCORE:{' '}
                {sentimentAnalysis.score > 0
                  ? `+${sentimentAnalysis.score.toFixed(1)}`
                  : sentimentAnalysis.score.toFixed(1)}
              </span>
            </div>

            {/* Gradient horizontal score bar */}
            <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-cyan-400 to-emerald-500 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 w-3 bg-white rounded-full shadow-md -ml-1.5 transition-all duration-300"
                style={{ left: `${meterPercentage}%` }}
              />
            </div>

            {/* Key Emotional Triggers */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#1f2842] text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                Key Emotional Triggers Detected:{' '}
              </span>
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
                <span className="text-slate-400 dark:text-slate-500 italic">
                  No strong sentiment words detected yet.
                </span>
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

      {/* Post-Submission / Analysis Results Section */}
      <div ref={analysisSectionRef} className="space-y-6 pt-2">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Journal Analysis & Multimodal Expression Review
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Synchronized NLP + AI + Visible Expression
          </span>
        </div>

        {/* 1. Stanford CoreNLP Sentiment Result (Backend Java / Modular NLP) */}
        {coreNlpResult && (
          <div className="bg-white dark:bg-[#13192b] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#1e263d]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 text-cyan-600 dark:text-cyan-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Stanford CoreNLP Sentiment Analysis
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Engineered NLP linguistic sentiment classification
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#182035] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#283556]">
                  {coreNlpResult.provider}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    coreNlpResult.sentiment === 'Positive'
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50'
                      : coreNlpResult.sentiment === 'Negative'
                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/50'
                      : coreNlpResult.sentiment === 'Mixed'
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {coreNlpResult.sentiment} Sentiment
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-[#0e1322] p-3 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block uppercase">Sentiment Score</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  {coreNlpResult.sentiment_score > 0
                    ? `+${coreNlpResult.sentiment_score.toFixed(1)}`
                    : coreNlpResult.sentiment_score.toFixed(1)}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0e1322] p-3 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block uppercase">Normalized Score</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  {Math.round(coreNlpResult.normalized_score * 100)}%
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0e1322] p-3 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block uppercase">Word Count</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  {coreNlpResult.word_count} words
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0e1322] p-3 rounded-xl border border-slate-100 dark:border-[#232f50]">
                <span className="text-[10px] text-slate-400 block uppercase">Classification</span>
                <span className="text-base font-bold text-cyan-600 dark:text-cyan-400">
                  {coreNlpResult.sentiment}
                </span>
              </div>
            </div>

            {/* Keyword tags */}
            {(coreNlpResult.positive_words.length > 0 || coreNlpResult.negative_words.length > 0) && (
              <div className="pt-2 text-xs flex flex-wrap items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Extracted Keywords:</span>
                {coreNlpResult.positive_words.map((w) => (
                  <span
                    key={w}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40"
                  >
                    +{w}
                  </span>
                ))}
                {coreNlpResult.negative_words.map((w) => (
                  <span
                    key={w}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40"
                  >
                    -{w}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Gemini AI Journal Insights Section */}
        <AIJournalInsightsCard
          journalText={journalText}
          manualMood={mood}
          journalSentiment={coreNlpResult?.sentiment || sentimentAnalysis.title}
          journalEntryId={savedJournalId || undefined}
          onInsightsGenerated={(ins) => setLatestInsights(ins)}
          onTriggerAnalysis={handleTriggerAnalysisFromInsights}
        />

        {/* 3. Camera Expression Estimate Card (requires explicit in-app user consent) */}
        {showCameraAnalysis && (
          <CameraMoodCheckCard
            journalEntryId={savedJournalId || undefined}
            journalSentiment={coreNlpResult?.sentiment || sentimentAnalysis.title}
            selectedManualMood={mood}
            onSelectManualMood={(m) => setMood(m)}
            title="Camera Expression Estimate"
            subtitle="Optional visible facial expression estimation processed entirely inside your browser canvas."
          />
        )}

        {/* Navigation bottom bar when entry has been submitted */}
        {savedJournalId && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#13192b] border border-slate-200 dark:border-[#242f4e] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                Reflection saved. All analysis signals are stored in your private Firestore records.
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#7c3aed] hover:bg-[#6d28d9] text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Go to Journal History</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setJournalText('');
                  setSuccessNotice(null);
                  setErrorNotice(null);
                  setCoreNlpResult(null);
                  setSavedJournalId(null);
                  setShowCameraAnalysis(false);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Write Another Entry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
