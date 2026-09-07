import { Router, Request, Response } from 'express';
import { nlpService } from '../nlp/NLPService.js';

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

export default router;
