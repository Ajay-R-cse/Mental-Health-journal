import { INLPAnalyzer } from './INLPAnalyzer.js';
import { SentimentAnalysisResult } from '../models/index.js';

const POSITIVE_LEXICON: Record<string, number> = {
  // High positive
  wonderful: 0.9,
  fantastic: 0.9,
  excellent: 0.85,
  great: 0.8,
  joy: 0.85,
  joyful: 0.85,
  happy: 0.8,
  happiness: 0.8,
  amazing: 0.85,
  awesome: 0.85,
  love: 0.85,
  loved: 0.8,
  loving: 0.8,
  peaceful: 0.8,
  calm: 0.75,
  serene: 0.8,
  grateful: 0.85,
  gratitude: 0.85,
  blessed: 0.8,
  energized: 0.75,
  relaxed: 0.75,
  accomplished: 0.8,
  proud: 0.75,
  excited: 0.8,
  content: 0.7,
  optimistic: 0.75,
  productive: 0.75,
  refreshed: 0.75,
  satisfied: 0.7,
  confident: 0.75,
  hopeful: 0.75,
  inspired: 0.8,
  mindful: 0.7,
  // Moderate positive
  good: 0.5,
  nice: 0.5,
  fine: 0.35,
  better: 0.5,
  well: 0.45,
  pleasant: 0.6,
  enjoy: 0.6,
  enjoyed: 0.6,
  fun: 0.65,
  helpful: 0.55,
  kind: 0.6,
  friendly: 0.6,
  warm: 0.5,
  healthy: 0.65,
  clear: 0.4,
  balanced: 0.65,
  uplifting: 0.7,
  comfort: 0.6,
  comfortable: 0.6,
  cheer: 0.65,
  cheerful: 0.7,
};

const NEGATIVE_LEXICON: Record<string, number> = {
  // High negative
  terrible: -0.9,
  horrible: -0.9,
  awful: -0.85,
  depressed: -0.85,
  hopeless: -0.9,
  devastated: -0.9,
  miserable: -0.85,
  worthless: -0.9,
  dreadful: -0.85,
  panic: -0.85,
  panicked: -0.85,
  despair: -0.9,
  agony: -0.85,
  heartbroken: -0.85,
  furious: -0.8,
  hate: -0.8,
  hated: -0.8,
  // Moderate negative
  sad: -0.7,
  unhappy: -0.7,
  anxious: -0.75,
  anxiety: -0.75,
  stressed: -0.7,
  stressful: -0.7,
  overwhelmed: -0.75,
  exhausted: -0.75,
  tired: -0.55,
  fatigued: -0.6,
  drained: -0.65,
  lonely: -0.7,
  angry: -0.75,
  frustrated: -0.7,
  frustrating: -0.7,
  irritated: -0.6,
  worried: -0.65,
  worry: -0.65,
  nervous: -0.6,
  guilty: -0.7,
  regret: -0.65,
  bad: -0.6,
  poor: -0.5,
  hurts: -0.65,
  hurt: -0.65,
  pain: -0.7,
  painful: -0.7,
  disappointed: -0.7,
  gloomy: -0.65,
  down: -0.5,
  rough: -0.55,
  struggling: -0.7,
  failed: -0.7,
  failure: -0.75,
  burnout: -0.8,
  sick: -0.6,
  restless: -0.55,
  bored: -0.4,
  confused: -0.45,
  unmotivated: -0.65,
};

const INTENSIFIERS: Record<string, number> = {
  very: 1.4,
  extremely: 1.6,
  really: 1.3,
  super: 1.35,
  totally: 1.3,
  completely: 1.35,
  absolutely: 1.4,
  immensely: 1.5,
  deeply: 1.35,
  incredibly: 1.5,
  exceptionally: 1.5,
  slightly: 0.6,
  somewhat: 0.7,
  bit: 0.8,
  barely: 0.5,
  hardly: 0.5,
};

const NEGATIONS = new Set([
  'not', 'no', 'never', 'neither', 'nor', "didn't", 'didnt', "wasn't", 'wasnt',
  "isn't", 'isnt', "aren't", 'arent', "won't", 'wont', "can't", 'cant',
  "couldn't", 'couldnt', "don't", 'dont', "haven't", 'havent', "hadn't", 'hadnt',
  'without', 'barely', 'hardly'
]);

export class LexiconNLPAnalyzer implements INLPAnalyzer {
  readonly name = 'VADER-Lexicon Analyzer';
  readonly description = 'Rule-based valence and contextual NLP sentiment analysis engine';

  async analyze(text: string): Promise<SentimentAnalysisResult> {
    if (!text || text.trim() === '') {
      return {
        sentiment: 'Neutral',
        sentiment_score: 0,
        normalized_score: 0.5,
        word_count: 0,
        positive_words: [],
        negative_words: [],
        provider: this.name,
      };
    }

    // Clean and split words
    const rawTokens = text.toLowerCase().match(/[a-z']+|[!?]+/g) || [];
    const tokens = rawTokens.filter((t) => t.length > 0);
    const wordCount = tokens.filter((t) => /^[a-z']+/i.test(t)).length;

    let totalScore = 0;
    let scoredWordsCount = 0;
    const positiveWordsFound: string[] = [];
    const negativeWordsFound: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let wordValence = 0;

      if (POSITIVE_LEXICON[token] !== undefined) {
        wordValence = POSITIVE_LEXICON[token];
        positiveWordsFound.push(token);
      } else if (NEGATIVE_LEXICON[token] !== undefined) {
        wordValence = NEGATIVE_LEXICON[token];
        negativeWordsFound.push(token);
      }

      if (wordValence !== 0) {
        // Check 3 tokens before for negation and intensifiers
        let isNegated = false;
        let intensityModifier = 1.0;

        for (let j = Math.max(0, i - 3); j < i; j++) {
          const prev = tokens[j];
          if (NEGATIONS.has(prev)) {
            isNegated = !isNegated;
          }
          if (INTENSIFIERS[prev]) {
            intensityModifier *= INTENSIFIERS[prev];
          }
        }

        if (isNegated) {
          // Negate and slightly dampen
          wordValence = -wordValence * 0.75;
        } else {
          wordValence *= intensityModifier;
        }

        // Check if next token is exclamation mark
        if (i + 1 < tokens.length && tokens[i + 1].includes('!')) {
          wordValence *= 1.25;
        }

        totalScore += wordValence;
        scoredWordsCount++;
      }
    }

    // Normalized compound score: -1 to +1 (standard VADER compound approximation)
    let compoundScore = 0;
    if (scoredWordsCount > 0) {
      const alpha = 15;
      compoundScore = totalScore / Math.sqrt(totalScore * totalScore + alpha);
      // Cap between -1 and 1
      compoundScore = Math.max(-1, Math.min(1, compoundScore));
    }

    // Convert to 0.00 to 1.00 format (like 0.84 for positive)
    const normalizedScore = Number(((compoundScore + 1) / 2).toFixed(2));
    const roundedScore = Number(compoundScore.toFixed(2));

    let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
    if (compoundScore >= 0.15) {
      sentiment = 'Positive';
    } else if (compoundScore <= -0.15) {
      sentiment = 'Negative';
    } else {
      sentiment = 'Neutral';
    }

    return {
      sentiment,
      sentiment_score: roundedScore,
      normalized_score: normalizedScore,
      word_count: wordCount,
      positive_words: Array.from(new Set(positiveWordsFound)),
      negative_words: Array.from(new Set(negativeWordsFound)),
      provider: this.name,
    };
  }
}
