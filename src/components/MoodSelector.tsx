import React from 'react';
import { MoodType } from '../types';
import { SmilePlus, Smile, Meh, Frown, HeartCrack } from 'lucide-react';

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
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    activeRing: 'ring-2 ring-emerald-500 bg-emerald-100/70 border-emerald-400',
  },
  {
    type: 'Happy',
    label: 'Happy',
    emoji: '😊',
    icon: Smile,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    activeRing: 'ring-2 ring-teal-500 bg-teal-100/70 border-teal-400',
  },
  {
    type: 'Neutral',
    label: 'Neutral',
    emoji: '😐',
    icon: Meh,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    activeRing: 'ring-2 ring-slate-400 bg-slate-100 border-slate-400',
  },
  {
    type: 'Sad',
    label: 'Sad',
    emoji: '😔',
    icon: Frown,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    activeRing: 'ring-2 ring-sky-500 bg-sky-100/70 border-sky-400',
  },
  {
    type: 'Very Sad',
    label: 'Very Sad',
    emoji: '😢',
    icon: HeartCrack,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    activeRing: 'ring-2 ring-rose-500 bg-rose-100/70 border-rose-400',
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
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full">
      {MOOD_OPTIONS.map((opt) => {
        const isSelected = selectedMood === opt.type;
        const Icon = opt.icon;

        return (
          <button
            key={opt.type}
            type="button"
            disabled={disabled}
            onClick={() => onSelectMood(opt.type)}
            className={`flex flex-col items-center justify-center rounded-xl border transition-all duration-200 ${
              size === 'sm' ? 'p-2 min-h-[58px]' : size === 'lg' ? 'p-4 min-h-[90px]' : 'p-3 min-h-[76px]'
            } ${
              isSelected
                ? `${opt.activeRing} shadow-sm font-semibold`
                : `${opt.bgColor} ${opt.borderColor} hover:bg-white hover:border-slate-300 text-slate-700`
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-1">
              <span className={size === 'sm' ? 'text-lg' : 'text-xl sm:text-2xl'}>{opt.emoji}</span>
            </div>
            <span
              className={`mt-1 text-xs font-medium whitespace-nowrap ${
                isSelected ? opt.color : 'text-slate-600'
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
