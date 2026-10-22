import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MoodType } from '../types';
import { SmilePlus, Smile, Meh, Frown, HeartCrack } from 'lucide-react';
import { FloatingReactions } from './FloatingReactions';

interface MoodOption {
  type: MoodType;
  label: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  activeRing: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  {
    type: 'Very Happy',
    label: 'Very Happy',
    emoji: '😄',
    icon: SmilePlus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800/60',
    activeRing: 'ring-2 ring-emerald-500 bg-emerald-100/80 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-500',
  },
  {
    type: 'Happy',
    label: 'Happy',
    emoji: '😊',
    icon: Smile,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    borderColor: 'border-teal-200 dark:border-teal-800/60',
    activeRing: 'ring-2 ring-teal-500 bg-teal-100/80 dark:bg-teal-950/70 border-teal-400 dark:border-teal-500',
  },
  {
    type: 'Neutral',
    label: 'Neutral',
    emoji: '😐',
    icon: Meh,
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-50 dark:bg-slate-900/50',
    borderColor: 'border-slate-200 dark:border-slate-700/60',
    activeRing: 'ring-2 ring-slate-400 dark:ring-slate-400 bg-slate-100 dark:bg-slate-800/80 border-slate-400 dark:border-slate-500',
  },
  {
    type: 'Sad',
    label: 'Sad',
    emoji: '😔',
    icon: Frown,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-200 dark:border-sky-800/60',
    activeRing: 'ring-2 ring-sky-500 bg-sky-100/80 dark:bg-sky-950/70 border-sky-400 dark:border-sky-500',
  },
  {
    type: 'Very Sad',
    label: 'Very Sad',
    emoji: '😢',
    icon: HeartCrack,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800/60',
    activeRing: 'ring-2 ring-rose-500 bg-rose-100/80 dark:bg-rose-950/70 border-rose-400 dark:border-rose-500',
  },
];

interface MoodSelectorProps {
  selectedMood: MoodType | null;
  onSelectMood: (mood: MoodType) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const MoodSelector: React.FC<MoodSelectorProps> = ({
  selectedMood,
  onSelectMood,
  size = 'md',
  disabled = false,
}) => {
  // Track reaction trigger counts per mood option
  const [reactionTriggers, setReactionTriggers] = useState<Record<string, number>>({});

  const handleSelect = (mood: MoodType) => {
    if (disabled) return;
    onSelectMood(mood);
    setReactionTriggers((prev) => ({
      ...prev,
      [mood]: (prev[mood] || 0) + 1,
    }));
  };

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full">
      {MOOD_OPTIONS.map((opt) => {
        const isSelected = selectedMood === opt.type;

        return (
          <div key={opt.type} className="relative flex justify-center">
            <motion.button
              id={`mood-selector-opt-${opt.type.toLowerCase().replace(/\s+/g, '-')}`}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(opt.type)}
              whileHover={disabled ? undefined : { scale: 1.05 }}
              whileTap={disabled ? undefined : { scale: 0.92 }}
              transition={{
                type: 'spring',
                stiffness: 450,
                damping: 22,
                mass: 0.8,
              }}
              className={`relative flex flex-col items-center justify-center rounded-xl border transition-colors duration-200 w-full overflow-visible select-none ${
                size === 'sm'
                  ? 'p-2 min-h-[58px]'
                  : size === 'lg'
                  ? 'p-4 min-h-[90px]'
                  : 'p-3 min-h-[76px]'
              } ${
                isSelected
                  ? 'border-transparent shadow-sm font-semibold'
                  : `${opt.bgColor} ${opt.borderColor} hover:bg-white dark:hover:bg-[#1a233c] hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300`
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* AnimatePresence for smooth active ring/border entrance and exit */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    layoutId="activeMoodHighlight"
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{
                      type: 'spring',
                      stiffness: 480,
                      damping: 26,
                    }}
                    className={`absolute inset-0 rounded-xl pointer-events-none ${opt.activeRing}`}
                  />
                )}
              </AnimatePresence>

              {/* Floating emoji burst reactions on active click */}
              <FloatingReactions
                trigger={reactionTriggers[opt.type] || 0}
                emoji={opt.emoji}
              />

              {/* Button content */}
              <div className="relative z-10 flex items-center justify-center">
                <span className={size === 'sm' ? 'text-lg' : 'text-xl sm:text-2xl'}>
                  {opt.emoji}
                </span>
              </div>
              <span
                className={`relative z-10 mt-1 text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
                  isSelected ? opt.color : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {opt.label}
              </span>
            </motion.button>
          </div>
        );
      })}
    </div>
  );
};

