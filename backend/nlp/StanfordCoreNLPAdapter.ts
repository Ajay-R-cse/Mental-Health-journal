import { INLPAnalyzer } from './INLPAnalyzer.js';
import { LexiconNLPAnalyzer } from './LexiconNLPAnalyzer.js';
import { SentimentAnalysisResult } from '../models/index.js';

/**
 * Stanford CoreNLP / Apache OpenNLP Bridge Adapter
 * 
 * Provides an enterprise adapter implementing the standard INLPAnalyzer interface.
 * Connects to a Stanford CoreNLP / OpenNLP Java microservice endpoint if available,
 * or delegates to the high-precision internal Lexicon engine.
 */
export class StanfordCoreNLPAdapter implements INLPAnalyzer {
  readonly name = 'Stanford CoreNLP Java Adapter';
  readonly description = 'Java Stanford CoreNLP Spring Boot Microservice adapter';
  
  private fallbackAnalyzer = new LexiconNLPAnalyzer();
  private javaNlpUrl = process.env.JAVA_NLP_SERVICE_URL || process.env.STANFORD_CORENLP_URL || 'http://localhost:9000';

  async analyze(text: string): Promise<SentimentAnalysisResult> {
    // Primary: Call the Java Spring Boot Stanford CoreNLP microservice
    try {
      const response = await fetch(`${this.javaNlpUrl}/api/nlp/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(3000), // 3s timeout
      });

      if (response.ok) {
        const data = (await response.json()) as {
          sentiment?: 'Positive' | 'Neutral' | 'Negative';
          sentimentScore?: number;
          provider?: string;
          emotionalKeywords?: string[];
        };

        const sentiment = data.sentiment || 'Neutral';
        const sentimentScore = data.sentimentScore ?? 0;
        const normalizedScore = Number(((sentimentScore + 1) / 2).toFixed(2));
        const words = text.split(/\s+/).filter(Boolean);

        return {
          sentiment,
          sentiment_score: sentimentScore,
          normalized_score: normalizedScore,
          word_count: words.length,
          positive_words: (data.emotionalKeywords || []).filter((w) => ['calm', 'productive', 'peaceful', 'happy', 'grateful', 'joy', 'excited'].includes(w)),
          negative_words: (data.emotionalKeywords || []).filter((w) => ['anxious', 'stressed', 'sad', 'tired', 'down', 'exhausted', 'bad', 'worried'].includes(w)),
          provider: data.provider || 'Stanford CoreNLP Java Microservice',
        };
      }
    } catch {
      // Service unreachable or connection refused: use explicitly labeled fallback
    }

    // Explicitly labeled fallback only when Java microservice is offline
    const res = await this.fallbackAnalyzer.analyze(text);
    return {
      ...res,
      provider: 'Explicit Local Fallback (Java NLP Microservice Unreachable)',
    };
  }
}
