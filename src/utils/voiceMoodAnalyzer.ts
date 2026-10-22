import { VoiceAnalysisResult, VoiceStateEstimateType } from '../types';

/**
 * Local in-browser voice acoustic characteristics analyzer.
 *
 * Strict Privacy & Wellness Rules:
 * - 100% Client-side processing using the Web Audio API.
 * - Non-identifying acoustic features only (RMS energy, spectral variance, speech pause ratios).
 * - No speaker identification, no transcription of personal information, no biometric profiles.
 * - Raw audio is stored only in transient memory during recording and can be discarded immediately.
 * - Classifies only broad observable vocal states.
 */

export interface AcousticFeatureSnapshot {
  speakingPace: string;
  volumeVariation: string;
  pitchVariation: string;
  pauseRatio: number;
  vocalEnergy: string;
}

export async function analyzeAudioBuffer(audioBlob: Blob): Promise<VoiceAnalysisResult> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  // Decode audio using offline or standard AudioContext
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = channelData.length;
    const duration = totalSamples / sampleRate;

    // Analyze in 50ms frames
    const frameSize = Math.floor(sampleRate * 0.05);
    const numFrames = Math.floor(totalSamples / frameSize);

    // 1. Duration check: Recordings shorter than 2.5s cannot establish stable cadence or pitch
    if (duration < 2.5) {
      return {
        estimatedVocalState: 'Uncertain: audio duration too short',
        confidence: 0.35,
        signalQuality: 'Insufficient',
        isReliable: false,
        reliabilityReason: 'Audio recording was under 2.5 seconds. Longer speech is required to evaluate stable acoustic rhythm.',
        acousticMetrics: {
          speakingPace: 'Too brief to calculate',
          volumeVariation: 'Too brief to calculate',
          pitchVariation: 'Too brief to calculate',
          pauseRatio: 0,
          vocalEnergy: 'Too brief to calculate',
        },
        disclaimer:
          'Acoustic observations describe physical audio waveforms (pitch modulation, volume dynamics, pauses) and cannot determine your actual feelings or mental state.',
      };
    }

    const frameEnergies: number[] = [];
    const zeroCrossingRates: number[] = [];
    let silentFrames = 0;
    const silenceThreshold = 0.015;

    for (let f = 0; f < numFrames; f++) {
      let sumSquares = 0;
      let zeroCrossings = 0;
      const start = f * frameSize;

      for (let i = start; i < start + frameSize; i++) {
        const sample = channelData[i];
        sumSquares += sample * sample;
        if (i > start && ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0))) {
          zeroCrossings++;
        }
      }

      const rms = Math.sqrt(sumSquares / frameSize);
      frameEnergies.push(rms);
      zeroCrossingRates.push(zeroCrossings / frameSize);

      if (rms < silenceThreshold) {
        silentFrames++;
      }
    }

    const pauseRatio = silentFrames / numFrames;

    // Compute mean energy and variance
    const activeEnergies = frameEnergies.filter((e) => e >= silenceThreshold);
    const meanEnergy = activeEnergies.length > 0
      ? activeEnergies.reduce((a, b) => a + b, 0) / activeEnergies.length
      : 0.005;

    // 2. Low signal quality or excessive silence check
    if (activeEnergies.length < 10 || meanEnergy < 0.018 || pauseRatio > 0.85) {
      return {
        estimatedVocalState: 'Uncertain: low audio signal or noisy',
        confidence: 0.3,
        signalQuality: 'Low',
        isReliable: false,
        reliabilityReason: 'Audio was too quiet, mostly silent, or obscured by background noise. Speak clearly near the microphone.',
        acousticMetrics: {
          speakingPace: 'Low audio level',
          volumeVariation: 'Low audio level',
          pitchVariation: 'Low audio level',
          pauseRatio: Number(pauseRatio.toFixed(2)),
          vocalEnergy: 'Low audio level',
        },
        disclaimer:
          'Acoustic observations describe physical audio waveforms and cannot determine your actual feelings or mental state.',
      };
    }

    let energyVariance = 0;
    for (const e of activeEnergies) {
      energyVariance += Math.pow(e - meanEnergy, 2);
    }
    const energyStdDev = activeEnergies.length > 0 ? Math.sqrt(energyVariance / activeEnergies.length) : 0;

    // Pitch variance proxy via zero-crossing rate fluctuations
    const activeZCR = zeroCrossingRates.filter((_, idx) => frameEnergies[idx] >= silenceThreshold);
    const meanZCR = activeZCR.length > 0 ? activeZCR.reduce((a, b) => a + b, 0) / activeZCR.length : 0.05;
    let zcrVariance = 0;
    for (const z of activeZCR) {
      zcrVariance += Math.pow(z - meanZCR, 2);
    }
    const zcrStdDev = activeZCR.length > 0 ? Math.sqrt(zcrVariance / activeZCR.length) : 0;

    // Speaking rhythm transitions (voice activity bursts per second)
    let transitions = 0;
    let wasActive = false;
    for (const e of frameEnergies) {
      const isActive = e >= silenceThreshold;
      if (isActive && !wasActive) transitions++;
      wasActive = isActive;
    }
    const burstsPerSecond = duration > 0 ? transitions / duration : 1;

    // Objective physical metric descriptions
    const paceDesc =
      burstsPerSecond > 2.7 ? 'Rapid cadence (>2.7 bursts/s)' : burstsPerSecond < 1.3 ? 'Deliberate cadence (<1.3 bursts/s)' : 'Moderate cadence (1.3-2.7 bursts/s)';
    const volumeDesc =
      energyStdDev > 0.038 ? 'High dynamic amplitude range' : energyStdDev < 0.016 ? 'Uniform amplitude range' : 'Moderate dynamic range';
    const pitchDesc =
      zcrStdDev > 0.034 ? 'Wide pitch inflection variance' : zcrStdDev < 0.016 ? 'Steady pitch inflection' : 'Natural pitch inflection';
    const energyDesc =
      meanEnergy > 0.075 ? 'Elevated signal amplitude' : meanEnergy < 0.032 ? 'Low signal amplitude' : 'Balanced signal amplitude';

    // Objective acoustic observation categories (NOT definitive internal emotions)
    let estimatedVocalState: VoiceStateEstimateType = 'Acoustic observation only / balanced';
    let reliabilityReason = '';

    if (meanEnergy < 0.042 && pauseRatio > 0.35 && burstsPerSecond < 1.4) {
      estimatedVocalState = 'Gentle vocal energy with extended pauses';
      reliabilityReason = 'Acoustic observation: low RMS amplitude combined with frequent pauses. Does not infer actual emotional state.';
    } else if (meanEnergy > 0.07 && burstsPerSecond > 2.2 && energyStdDev > 0.03) {
      estimatedVocalState = 'Dynamic modulation with varied pitch';
      reliabilityReason = 'Acoustic observation: higher vocal energy with active syllable cadence. Does not infer actual emotional state.';
    } else if (zcrStdDev > 0.036 && burstsPerSecond > 2.0) {
      estimatedVocalState = 'Elevated pitch variation with rapid pace';
      reliabilityReason = 'Acoustic observation: variable frequency transitions with faster cadence. Does not infer actual emotional state.';
    } else if (pauseRatio >= 0.15 && pauseRatio <= 0.45 && energyStdDev < 0.032) {
      estimatedVocalState = 'Steady amplitude with balanced pace';
      reliabilityReason = 'Acoustic observation: even vocal amplitude and steady speaking cadence.';
    } else {
      estimatedVocalState = 'Acoustic observation only / balanced';
      reliabilityReason = 'Acoustic observation: balanced speech characteristics without extreme variations.';
    }

    // Signal clarity score based strictly on audio signal-to-silence ratio and length, NOT psychological confidence
    const signalClarityScore = Math.min(0.8, Math.max(0.4, (1 - pauseRatio) * 0.5 + Math.min(duration / 10, 0.3)));

    return {
      estimatedVocalState,
      confidence: Number(signalClarityScore.toFixed(2)),
      signalQuality: 'Moderate',
      isReliable: false,
      reliabilityReason,
      acousticMetrics: {
        speakingPace: paceDesc,
        volumeVariation: volumeDesc,
        pitchVariation: pitchDesc,
        pauseRatio: Number(pauseRatio.toFixed(2)),
        vocalEnergy: energyDesc,
      },
      disclaimer:
        'Acoustic observations describe physical audio waveforms (speaking cadence, loudness dynamics, pause frequency) and cannot infer your actual feelings or mental state.',
    };
  } finally {
    if (ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  }
}
