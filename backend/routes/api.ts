import { Router, Request, Response } from 'express';
import { nlpService } from '../nlp/NLPService.js';
import { aiService } from '../services/AIService.js';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Modular NLP Sentiment Analysis Endpoint
 * Interfaces with Java NLP (Stanford CoreNLP / Apache OpenNLP) or the modular pipeline
 */
router.post('/nlp/analyze', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string') {
      res.status(400).json({ error: 'Text field is required for NLP sentiment analysis' });
      return;
    }

    const result = await nlpService.analyzeJournal(text);

    // Map to standardized schema required by the architecture
    const emotionalKeywords = [
      ...(result.positive_words || []),
      ...(result.negative_words || []),
    ];

    res.json({
      success: true,
      result: {
        sentiment: result.sentiment,
        sentimentScore: result.sentiment_score,
        sentiment_score: result.sentiment_score,
        normalized_score: result.normalized_score,
        word_count: result.word_count,
        positive_words: result.positive_words,
        negative_words: result.negative_words,
        emotionalKeywords,
        provider: result.provider,
        disclaimer: 'NLP sentiment analysis is informational and evaluates general well-being language. It does not formulate medical or psychological diagnoses.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'NLP analysis failed' });
  }
});

/**
 * Information on the active Java NLP / OpenNLP pipeline
 */
router.get('/nlp/info', (_req: Request, res: Response) => {
  res.json({
    success: true,
    info: nlpService.getAnalyzerInfo(),
    architecture: {
      flow: 'Frontend -> Firebase Auth -> Cloud Firestore -> Cloud Function -> Java NLP Service -> Cloud Firestore -> Dashboard',
      support: ['Stanford CoreNLP', 'Apache OpenNLP', 'Valence Pipeline'],
    },
    disclaimer: 'Sentiment analysis is informational only and does not diagnose depression, anxiety, or mental health conditions.',
  });
});

/**
 * AI Journal Insights Endpoint
 * Uses Google Gemini (gemini-3.8-flash) server-side via @google/genai
 * Stateless: Receives journal text directly from request body and returns structured insights.
 */
router.post('/ai/journal-insights', async (req: Request, res: Response) => {
  try {
    const { journalText, manualMood, journalSentiment } = req.body;

    if (!journalText || typeof journalText !== 'string' || journalText.trim().length === 0) {
      res.status(400).json({ error: 'journalText is required and cannot be empty.' });
      return;
    }

    if (journalText.trim().length > 15000) {
      res.status(400).json({ error: 'journalText exceeds the maximum length of 15,000 characters.' });
      return;
    }

    const insights = await aiService.generateJournalInsights({
      journalText,
      manualMood: typeof manualMood === 'string' ? manualMood : undefined,
      journalSentiment: typeof journalSentiment === 'string' ? journalSentiment : undefined,
    });

    res.json(insights);
  } catch (err: any) {
    console.error('API /ai/journal-insights error:', err?.message || err);
    res.status(500).json({
      error: err.message || 'Failed to generate AI journal insights. Please try again.',
    });
  }
});

/**
 * AI Weekly Reflection Endpoint
 * Stateless: Receives recent journals, sleep records, and activities directly from request body and returns reflection.
 */
router.post('/ai/weekly-reflection', async (req: Request, res: Response) => {
  try {
    const { journals, sleepRecords, activities } = req.body;

    const reflection = await aiService.generateWeeklyReflection({
      journals: Array.isArray(journals) ? journals : [],
      sleepRecords: Array.isArray(sleepRecords) ? sleepRecords : [],
      activities: Array.isArray(activities) ? activities : [],
    });

    res.json(reflection);
  } catch (err: any) {
    console.error('API /ai/weekly-reflection error:', err?.message || err);
    res.status(500).json({
      error: err.message || 'Failed to generate AI weekly reflection. Please try again.',
    });
  }
});

export default router;
