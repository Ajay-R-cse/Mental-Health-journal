import React, { useState, useEffect, useRef } from 'react';
import { Wind, Play, Pause, Volume2, VolumeX, Sparkles, RefreshCw, CheckCircle2, Heart } from 'lucide-react';
import { audioSynth } from '../utils/audioSynth';

export const RelaxationPage: React.FC = () => {
  // Breathing state
  const [breathingActive, setBreathingActive] = useState<boolean>(false);
  const [technique, setTechnique] = useState<'478' | 'box'>('478');
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Rest'>('Inhale');
  const [breathCount, setBreathCount] = useState<number>(4);
  const [completedCycles, setCompletedCycles] = useState<number>(0);

  // Audio ambient soundscape state
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(0.5);

  // Grounding technique check marks
  const [groundingStep, setGroundingStep] = useState<number>(0);

  const timerRef = useRef<any>(null);

  // Breathing loop
  useEffect(() => {
    if (!breathingActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      setBreathPhase('Inhale');
      setBreathCount(technique === '478' ? 4 : 4);
      return;
    }

    let phase: 'Inhale' | 'Hold' | 'Exhale' | 'Rest' = 'Inhale';
    let remaining = technique === '478' ? 4 : 4;
    setBreathPhase(phase);
    setBreathCount(remaining);

    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (technique === '478') {
          if (phase === 'Inhale') {
            phase = 'Hold';
            remaining = 7;
          } else if (phase === 'Hold') {
            phase = 'Exhale';
            remaining = 8;
          } else {
            phase = 'Inhale';
            remaining = 4;
            setCompletedCycles((c) => c + 1);
          }
        } else {
          // Box breathing: 4 - 4 - 4 - 4
          if (phase === 'Inhale') {
            phase = 'Hold';
            remaining = 4;
          } else if (phase === 'Hold') {
            phase = 'Exhale';
            remaining = 4;
          } else if (phase === 'Exhale') {
            phase = 'Rest';
            remaining = 4;
          } else {
            phase = 'Inhale';
            remaining = 4;
            setCompletedCycles((c) => c + 1);
          }
        }
        setBreathPhase(phase);
      }
      setBreathCount(remaining);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [breathingActive, technique]);

  const handleSoundToggle = (soundType: 'rain' | 'waves' | 'bell' | 'whitenoise') => {
    if (activeSound === soundType) {
      audioSynth.stop();
      setActiveSound(null);
    } else {
      audioSynth.play(soundType, volume);
      setActiveSound(soundType);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioSynth.setVolume(newVol);
  };

  useEffect(() => {
    return () => {
      audioSynth.stop();
    };
  }, []);

  // Circle scaling & color based on breathing phase
  const getCircleScale = () => {
    if (!breathingActive) return 'scale-100';
    if (breathPhase === 'Inhale') return 'scale-125 transition-transform duration-4000 ease-out';
    if (breathPhase === 'Hold') return 'scale-125';
    if (breathPhase === 'Exhale') return 'scale-90 transition-transform duration-8000 ease-in';
    return 'scale-90';
  };

  const getPhaseColor = () => {
    switch (breathPhase) {
      case 'Inhale':
        return 'text-cyan-400 border-cyan-400/40 bg-cyan-500/10 shadow-cyan-500/20';
      case 'Hold':
        return 'text-purple-400 border-purple-400/40 bg-purple-500/10 shadow-purple-500/20';
      case 'Exhale':
        return 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10 shadow-emerald-500/20';
      case 'Rest':
        return 'text-slate-400 border-slate-400/40 bg-slate-500/10 shadow-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 2 Main columns: Breathing Circle and Ambient Audio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Interactive Breathing Circle */}
        <div className="bg-[#13192b] dark:bg-[#13192b] p-6 rounded-2xl border border-[#242f4e] shadow-lg flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white tracking-tight">Mindful Breathing Guide</h2>
            </div>
            <div className="flex items-center gap-1.5 bg-[#0e1322] p-1 rounded-xl border border-[#242f4e]">
              <button
                onClick={() => {
                  setTechnique('478');
                  setBreathingActive(false);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  technique === '478'
                    ? 'bg-[#7c3aed] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                4-7-8 Calm
              </button>
              <button
                onClick={() => {
                  setTechnique('box');
                  setBreathingActive(false);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  technique === 'box'
                    ? 'bg-[#7c3aed] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Box Focus
              </button>
            </div>
          </div>

          {/* Animated Breath Visualizer */}
          <div className="my-8 relative flex items-center justify-center">
            {/* Outer pulsating ring */}
            <div
              className={`w-60 h-60 sm:w-64 sm:h-64 rounded-full border-2 flex items-center justify-center shadow-2xl transition-all ${getCircleScale()} ${getPhaseColor()}`}
            >
              {/* Inner Circle */}
              <div className="w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-[#182035] border border-[#2e3b5e] flex flex-col items-center justify-center p-4">
                <span className="text-xs uppercase tracking-widest font-bold text-slate-400">
                  {breathingActive ? breathPhase : 'Ready'}
                </span>
                <span className="text-4xl sm:text-5xl font-extrabold text-white my-1 font-mono">
                  {breathingActive ? breathCount : '—'}
                </span>
                <span className="text-[11px] text-slate-400 max-w-[130px] leading-tight">
                  {breathingActive
                    ? breathPhase === 'Inhale'
                      ? 'Slowly fill your lungs'
                      : breathPhase === 'Hold'
                      ? 'Gently keep the breath'
                      : breathPhase === 'Exhale'
                      ? 'Release tension fully'
                      : 'Rest and reset'
                    : 'Press Start to begin'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-[#1e263d]">
            <div className="text-left">
              <span className="text-xs text-slate-400">Completed: </span>
              <span className="text-sm font-bold text-purple-300">{completedCycles} cycles</span>
            </div>

            <button
              onClick={() => setBreathingActive(!breathingActive)}
              className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                breathingActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
              }`}
            >
              {breathingActive ? (
                <>
                  <Pause className="w-4 h-4" /> Pause Breathing
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Start Exercise
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Soothing Ambient Audio Engine */}
        <div className="bg-[#13192b] dark:bg-[#13192b] p-6 rounded-2xl border border-[#242f4e] shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Soothing Soundscapes</h2>
              </div>
              {activeSound && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Playing Audio
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              Synthesized natural psychoacoustic frequencies generated directly in your browser to settle anxious minds and facilitate deep reflection.
            </p>

            {/* Soundscape Track Tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'waves', label: 'Ocean Waves', desc: 'Rhythmic deep tide loop', icon: '🌊' },
                { id: 'rain', label: 'Gentle Rain', desc: 'Pink noise rainfall', icon: '🌧️' },
                { id: 'bell', label: 'Tibetan Bowl', desc: '432Hz harmonic chime', icon: '🔔' },
                { id: 'whitenoise', label: 'Deep Focus', desc: 'Muffled calming hum', icon: '🍃' },
              ].map((sound) => {
                const isSelected = activeSound === sound.id;
                return (
                  <button
                    key={sound.id}
                    onClick={() => handleSoundToggle(sound.id as any)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[96px] ${
                      isSelected
                        ? 'bg-[#1e233d] border-[#7c3aed] ring-2 ring-[#7c3aed]/40'
                        : 'bg-[#182035] border-[#283556] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{sound.icon}</span>
                      {isSelected ? (
                        <Pause className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Play className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{sound.label}</h4>
                      <p className="text-[10px] text-slate-400">{sound.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Volume Slider */}
          <div className="pt-4 mt-6 border-t border-[#1e263d] flex items-center gap-3">
            {volume === 0 ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-purple-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-purple-500 h-1.5 bg-[#0e1322] rounded-lg cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-mono w-10 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom: 5-4-3-2-1 Grounding Technique */}
      <div className="bg-[#13192b] dark:bg-[#13192b] p-6 rounded-2xl border border-[#242f4e] shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-white tracking-tight">5-4-3-2-1 Sensory Grounding</h2>
          </div>
          <span className="text-xs text-slate-400">Overcoming mental overwhelm</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
          {[
            { count: '5', label: 'See', text: 'Notice 5 things you can visually see right around you.' },
            { count: '4', label: 'Feel', text: 'Feel 4 physical sensations (e.g. feet on floor, sweater on arms).' },
            { count: '3', label: 'Hear', text: 'Listen for 3 distinct ambient sounds in your surroundings.' },
            { count: '2', label: 'Smell', text: 'Identify 2 scents or take two deep gentle breaths.' },
            { count: '1', label: 'Taste', text: 'Savor 1 taste or recall a soothing flavor.' },
          ].map((step, idx) => (
            <div
              key={step.count}
              onClick={() => setGroundingStep(idx)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                groundingStep === idx
                  ? 'bg-[#1b233c] border-cyan-500 ring-1 ring-cyan-500/50'
                  : 'bg-[#182035] border-[#283556] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-black text-cyan-400 font-mono">{step.count}</span>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {step.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
