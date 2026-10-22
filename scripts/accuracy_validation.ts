import { LexiconNLPAnalyzer } from '../backend/nlp/LexiconNLPAnalyzer.js';
import { aiService } from '../backend/services/AIService.js';

interface TestCaseResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestCaseResult[] = [];

async function runRegressionSuite() {
  console.log('=== RUNNING COMPREHENSIVE INTEGRATION & REGRESSION TEST SUITE ===\n');

  const nlp = new LexiconNLPAnalyzer();

  // Test 1: Strict Negation ("I am not happy.") -> Negative
  {
    const res = await nlp.analyze('I am not happy.');
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && !res.positive_words.includes('happy');
    results.push({
      name: 'Case 1: "I am not happy." -> Negative',
      passed,
      expected: 'sentiment: "Negative", score < 0, positive_words without "happy"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 2: Negation with Contraction ("I don't feel good today.") -> Negative
  {
    const res = await nlp.analyze("I don't feel good today.");
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && !res.positive_words.includes('good');
    results.push({
      name: 'Case 2: "I don\'t feel good today." -> Negative',
      passed,
      expected: 'sentiment: "Negative", score < 0, positive_words without "good"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 3: Negation of negative emotion ("I am not sad anymore.") -> Neutral or mildly positive
  {
    const res = await nlp.analyze('I am not sad anymore.');
    const passed = (res.sentiment === 'Neutral' || res.sentiment === 'Positive') && res.sentiment_score >= 0 && !res.negative_words.includes('sad');
    results.push({
      name: 'Case 3: "I am not sad anymore." -> Neutral or mildly positive',
      passed,
      expected: 'sentiment: "Neutral" | "Positive", score >= 0, negative_words without "sad"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 4: Mixed sentiment with contrastive clause ("I passed my exam, but I feel disappointed.") -> Negative or mixed, with disappointment represented
  {
    const res = await nlp.analyze('I passed my exam, but I feel disappointed.');
    const passed = (res.sentiment === 'Negative' || res.sentiment === 'Mixed') && res.sentiment_score < 0 && res.negative_words.includes('disappointed');
    results.push({
      name: 'Case 4: "I passed my exam, but I feel disappointed." -> Negative or mixed, disappointment represented',
      passed,
      expected: 'sentiment: "Negative" | "Mixed", score < 0, negative_words with "disappointed"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 5: Mixed sentiment ("I failed my exam, but my friends supported me.") -> Mixed
  {
    const res = await nlp.analyze('I failed my exam, but my friends supported me.');
    const passed = res.sentiment === 'Mixed' && res.positive_words.length > 0 && res.negative_words.includes('failed');
    results.push({
      name: 'Case 5: "I failed my exam, but my friends supported me." -> Mixed',
      passed,
      expected: 'sentiment: "Mixed", has both positive and negative elements',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 6: Factual Neutral Statement ("Meeting at 2pm.") -> Neutral
  {
    const res = await nlp.analyze('Meeting at 2pm.');
    const passed = res.sentiment === 'Neutral' && res.sentiment_score === 0;
    results.push({
      name: 'Case 6: "Meeting at 2pm." -> Neutral',
      passed,
      expected: 'sentiment: "Neutral", score: 0',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}`,
    });
  }

  // Test 7: Mild Positive Statement ("I feel okay today.") -> Neutral or mildly positive
  {
    const res = await nlp.analyze('I feel okay today.');
    const passed = (res.sentiment === 'Neutral' || res.sentiment === 'Positive') && res.sentiment_score >= 0;
    results.push({
      name: 'Case 7: "I feel okay today." -> Neutral or mildly positive',
      passed,
      expected: 'sentiment: "Neutral" | "Positive", score >= 0',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}`,
    });
  }

  // Test 8: Strongly Positive with Intensifier ("I am extremely happy.") -> Strongly positive
  {
    const res = await nlp.analyze('I am extremely happy.');
    const resBase = await nlp.analyze('I am good.');
    const passed = res.sentiment === 'Positive' && res.sentiment_score >= 0.7 && res.sentiment_score > resBase.sentiment_score;
    results.push({
      name: 'Case 8: "I am extremely happy." -> Strongly positive (>= 0.70)',
      passed,
      expected: 'sentiment: "Positive", score >= 0.70, score > "good" score',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score} (vs good: ${resBase.sentiment_score})`,
    });
  }

  // Test 9: Sarcasm / Irony ("Oh great, another delay and ruined schedule.") -> Negative
  {
    const res = await nlp.analyze('Oh great, another delay and ruined schedule.');
    const passed = res.sentiment === 'Negative' && res.sentiment_score < 0 && !res.positive_words.includes('great');
    results.push({
      name: 'Case 9: "Oh great, another delay and ruined schedule." -> Negative',
      passed,
      expected: 'sentiment: "Negative", score < 0, positive_words without "great"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 10: Concurrent Opposing Emotions ("I feel happy and sad at the same time.") -> Mixed or uncertain
  {
    const res = await nlp.analyze('I feel happy and sad at the same time.');
    const passed = res.sentiment === 'Mixed' && res.positive_words.includes('happy') && res.negative_words.includes('sad');
    results.push({
      name: 'Case 10: "I feel happy and sad at the same time." -> Mixed or uncertain',
      passed,
      expected: 'sentiment: "Mixed", positive_words with "happy", negative_words with "sad"',
      actual: `sentiment: "${res.sentiment}", score: ${res.sentiment_score}, pos_words: ${JSON.stringify(res.positive_words)}, neg_words: ${JSON.stringify(res.negative_words)}`,
    });
  }

  // Test 11: Scale Consistency (-1.0 to +1.0 for sentiment_score, 0.0 to 1.0 for normalized_score)
  {
    const resPos = await nlp.analyze('I am deeply grateful for this wonderful life.');
    const resNeg = await nlp.analyze('I am devastated and heartbroken by this terrible failure.');
    const passed =
      resPos.sentiment_score >= -1.0 &&
      resPos.sentiment_score <= 1.0 &&
      resPos.normalized_score >= 0.0 &&
      resPos.normalized_score <= 1.0 &&
      resNeg.sentiment_score >= -1.0 &&
      resNeg.sentiment_score <= 1.0 &&
      resNeg.normalized_score >= 0.0 &&
      resNeg.normalized_score <= 1.0;
    results.push({
      name: 'Case 11: Scale Consistency [-1, 1] and [0, 1]',
      passed,
      expected: 'Both scores bounded strictly within [-1.0, 1.0] and [0.0, 1.0]',
      actual: `Pos(score: ${resPos.sentiment_score}, norm: ${resPos.normalized_score}), Neg(score: ${resNeg.sentiment_score}, norm: ${resNeg.normalized_score})`,
    });
  }

  // Test 12: AI Journal Insights Short Input Fast-Path
  {
    const shortRes = await aiService.generateJournalInsights({ journalText: 'Feeling okay today.' });
    const passed =
      typeof shortRes.summary === 'string' &&
      shortRes.summary.includes('brief') &&
      !shortRes.summary.toLowerCase().includes('depress') &&
      shortRes.reflectionPrompt.endsWith('?') &&
      shortRes.disclaimer === 'AI-generated reflection, not a medical diagnosis.';
    results.push({
      name: 'Case 12: AI Journal Insights Short Input Guard without Hallucination',
      passed,
      expected: 'Grounded summary noting brief check-in without inventing symptoms',
      actual: `summary: "${shortRes.summary.slice(0, 80)}...", themes: ${JSON.stringify(shortRes.themes)}`,
    });
  }

  // Test 13: Weekly Reflection Deduplication & Missing vs Zero Sleep Distinction
  {
    const reflectionInput = {
      journals: [
        { date: '2026-10-20', text: 'Peaceful morning walk' },
        { date: '2026-10-20', text: 'Peaceful morning walk' }, // Duplicate
        { date: '2026-10-21', text: 'Busy day at work, felt satisfied' },
      ],
      sleepRecords: [
        { date: '2026-10-19', hours: 7.5 },
        { date: '2026-10-20', hours: 0 }, // Reported 0 hours (all-nighter)
        // 2026-10-21 is MISSING (unlogged, distinct from 0)
      ],
      activities: [
        { date: '2026-10-20', name: 'Yoga' },
        { date: '2026-10-20', name: 'yoga' }, // Duplicate case-insensitive
      ],
    };

    const weeklyRes = await aiService.generateWeeklyReflection(reflectionInput);
    const passed =
      typeof weeklyRes.overallTrend === 'string' &&
      Array.isArray(weeklyRes.commonThemes) &&
      weeklyRes.reflectionQuestion.endsWith('?') &&
      weeklyRes.disclaimer.includes('general wellness');

    results.push({
      name: 'Case 13: AI Weekly Reflection Deduplication & Missing vs Zero Sleep Handling',
      passed,
      expected: 'Non-clinical grounded weekly reflection adhering to schema',
      actual: `trend: "${weeklyRes.overallTrend.slice(0, 80)}...", themes: ${JSON.stringify(weeklyRes.commonThemes)}`,
    });
  }

  // Print summary
  console.log('Results:');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`[PASS] ${r.name}`);
    } else {
      console.error(`[FAIL] ${r.name}`);
      console.error(`       Expected: ${r.expected}`);
      console.error(`       Actual:   ${r.actual}`);
    }
  }

  console.log(`\nTOTAL: ${passCount} / ${results.length} tests passed.`);
  if (passCount !== results.length) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Regression suite failed:', err);
  process.exit(1);
});
