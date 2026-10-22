/**
 * Firebase Cloud Function: Journal Sentiment NLP Pipeline
 *
 * Architecture:
 * Cloud Firestore (onDocumentCreated) -> Firebase Cloud Function -> Java NLP Microservice (Stanford CoreNLP / Apache OpenNLP) -> Update Cloud Firestore
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

initializeApp();
const db = getFirestore();

const JAVA_NLP_SERVICE_URL = process.env.JAVA_NLP_SERVICE_URL || 'http://localhost:8080';

export const processJournalSentiment = onDocumentCreated('journalEntries/{entryId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  // Avoid infinite loops if sentiment has already been processed and persisted
  if (data.sentiment && data.sentimentScore !== undefined && data.nlpProcessed) {
    return;
  }

  const journalText = data.journalText || data.journal_text || '';
  if (!journalText.trim()) return;

  try {
    let nlpResult;

    try {
      // 1. Dispatch journal reflection to Java NLP Microservice (Stanford CoreNLP)
      const response = await fetch(`${JAVA_NLP_SERVICE_URL}/api/nlp/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: journalText }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        nlpResult = await response.json();
      } else {
        console.warn(`Java NLP service returned non-200 status (${response.status}). Using explicitly labeled fallback.`);
        nlpResult = fallbackSentimentAnalysis(journalText);
      }
    } catch (fetchErr) {
      console.warn(`Java NLP microservice at ${JAVA_NLP_SERVICE_URL} is unreachable: ${fetchErr.message}. Using explicitly labeled fallback.`);
      nlpResult = fallbackSentimentAnalysis(journalText);
    }

    // 2. Persist sentiment analysis results back into Firestore document
    await snapshot.ref.update({
      sentiment: nlpResult.sentiment,
      sentimentScore: nlpResult.sentimentScore,
      emotionalKeywords: nlpResult.emotionalKeywords || [],
      nlpProcessed: true,
      nlpProvider: nlpResult.provider,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in processJournalSentiment pipeline:', error);
  }
});

function fallbackSentimentAnalysis(text) {
  // Explicitly labeled fallback only used when the external Java Stanford CoreNLP microservice is offline
  const positiveTerms = ['grateful', 'happy', 'calm', 'peaceful', 'joy', 'excited', 'inspired', 'content', 'relief', 'good'];
  const negativeTerms = ['sad', 'anxious', 'stressed', 'tired', 'down', 'exhausted', 'bad', 'frustrated', 'worried', 'angry'];

  const lower = text.toLowerCase();
  let score = 0;
  const keywords = [];

  positiveTerms.forEach((word) => {
    if (lower.includes(word)) {
      score += 1;
      keywords.push(word);
    }
  });

  negativeTerms.forEach((word) => {
    if (lower.includes(word)) {
      score -= 1;
      keywords.push(word);
    }
  });

  const classification = score > 0 ? 'Positive' : score < 0 ? 'Negative' : 'Neutral';
  return {
    sentiment: classification,
    sentimentScore: Math.max(-1.0, Math.min(1.0, score * 0.2)),
    emotionalKeywords: keywords,
    provider: 'Explicit Local Fallback (Java NLP Microservice Unreachable)',
  };
}
