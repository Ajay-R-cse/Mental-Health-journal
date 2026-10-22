import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AIJournalInsight,
  AIJournalInsightsRequest,
  AIJournalInsightsResponse,
  AIWeeklyReflection,
  AIWeeklyReflectionRequest,
  AIWeeklyReflectionResponse,
} from '../types';
import { firestoreService } from './firestoreService';

export class AIService {
  private getUid(): string {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User is not authenticated with Firebase.');
    }
    return user.uid;
  }

  /**
   * Generates AI wellness insights for a journal entry via backend server-side Gemini API
   */
  async generateJournalInsights(
    params: AIJournalInsightsRequest
  ): Promise<AIJournalInsightsResponse> {
    if (!params.journalText || !params.journalText.trim()) {
      throw new Error('Please write a journal entry before generating insights.');
    }

    const token = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/ai/journal-insights', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        journalText: params.journalText.trim(),
        manualMood: params.manualMood,
        journalSentiment: params.journalSentiment,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to generate AI insights';
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // use default
      }
      throw new Error(errorMessage);
    }

    const result: AIJournalInsightsResponse = await response.json();
    return result;
  }

  /**
   * Saves an AI Journal Insight to Firestore collection /aiInsights/{insightId}
   */
  async saveJournalInsight(
    journalEntryId: string,
    insights: AIJournalInsightsResponse
  ): Promise<AIJournalInsight> {
    const userId = this.getUid();
    const now = new Date().toISOString();

    const insightData: Omit<AIJournalInsight, 'id'> = {
      userId,
      journalEntryId,
      summary: insights.summary,
      themes: insights.themes,
      emotionalTone: insights.emotionalTone,
      positiveMoments: insights.positiveMoments,
      reflectionPrompt: insights.reflectionPrompt,
      suggestedNextStep: insights.suggestedNextStep,
      disclaimer: insights.disclaimer || 'AI-generated reflection, not a medical diagnosis.',
      createdAt: now,
    };

    try {
      const colRef = collection(db, 'aiInsights');
      const docRef = await addDoc(colRef, insightData);

      return {
        id: docRef.id,
        ...insightData,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'aiInsights');
      throw err;
    }
  }

  /**
   * Retrieves any saved AI insight for a given journal entry
   */
  async getSavedJournalInsight(journalEntryId: string): Promise<AIJournalInsight | null> {
    const user = auth.currentUser;
    if (!user || !journalEntryId) return null;

    try {
      const colRef = collection(db, 'aiInsights');
      const q = query(
        colRef,
        where('userId', '==', user.uid),
        where('journalEntryId', '==', journalEntryId),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const docSnapshot = snapshot.docs[0];
      const data = docSnapshot.data();

      return {
        id: docSnapshot.id,
        userId: data.userId,
        journalEntryId: data.journalEntryId,
        summary: data.summary,
        themes: data.themes || [],
        emotionalTone: data.emotionalTone || 'Mostly neutral',
        positiveMoments: data.positiveMoments || [],
        reflectionPrompt: data.reflectionPrompt || '',
        suggestedNextStep: data.suggestedNextStep || '',
        disclaimer: data.disclaimer || 'AI-generated reflection, not a medical diagnosis.',
        createdAt: data.createdAt || new Date().toISOString(),
      };
    } catch (err) {
      console.warn('Could not fetch saved journal insight:', err);
      return null;
    }
  }

  /**
   * Generates a weekly wellness reflection via the server-side Gemini API
   */
  async generateWeeklyReflection(
    params: AIWeeklyReflectionRequest
  ): Promise<AIWeeklyReflectionResponse> {
    const token = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/ai/weekly-reflection', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to generate weekly reflection';
      try {
        const errorData = await response.json();
        if (errorData?.error) errorMessage = errorData.error;
      } catch {
        // default message
      }
      throw new Error(errorMessage);
    }

    const result: AIWeeklyReflectionResponse = await response.json();
    return result;
  }

  /**
   * Gathers recent user journals, sleep records, and activities from Firestore
   * to provide strictly verified, deduplicated user-authored data within the 7-day window.
   */
  async gatherUserWeeklyData(): Promise<AIWeeklyReflectionRequest> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const startDateStr = sevenDaysAgo.toISOString().split('T')[0];

    const [rawJournals, rawSleeps, rawActivities] = await Promise.all([
      firestoreService.getJournals({ startDate: startDateStr, endDate: todayStr }),
      firestoreService.getSleepRecords(startDateStr, todayStr),
      firestoreService.getActivities(startDateStr, todayStr),
    ]);

    // 1. Deduplicate journal entries by ID and unique text
    const seenJournalKeys = new Set<string>();
    const deduplicatedJournals: AIWeeklyReflectionRequest['journals'] = [];

    for (const j of rawJournals) {
      const key = `${j.entry_date}::${j.journal_text.trim()}`;
      if (!seenJournalKeys.has(key)) {
        seenJournalKeys.add(key);
        deduplicatedJournals.push({
          date: j.entry_date,
          text: j.journal_text,
          mood: j.mood,
          sentiment: j.sentiment,
        });
      }
    }

    // 2. Deduplicate sleep records by date, keeping verified entries and preserving null vs 0
    const sleepByDate = new Map<string, number | null>();
    for (const s of rawSleeps) {
      const date = s.sleep_date;
      if (!sleepByDate.has(date)) {
        if (s.sleep_hours !== undefined && s.sleep_hours !== null && !isNaN(Number(s.sleep_hours))) {
          sleepByDate.set(date, Number(s.sleep_hours));
        } else {
          sleepByDate.set(date, null);
        }
      }
    }

    const deduplicatedSleep: Array<{ date: string; hours: number }> = [];
    sleepByDate.forEach((hours, date) => {
      // Only include records where hours were explicitly recorded (distinguishing missing from zero)
      if (hours !== null) {
        deduplicatedSleep.push({ date, hours });
      }
    });

    // 3. Deduplicate activities by date + normalized name
    const seenActivityKeys = new Set<string>();
    const deduplicatedActivities: Array<{ date: string; name: string }> = [];

    for (const a of rawActivities) {
      const key = `${a.activity_date}::${a.activity_name.trim().toLowerCase()}`;
      if (!seenActivityKeys.has(key)) {
        seenActivityKeys.add(key);
        deduplicatedActivities.push({
          date: a.activity_date,
          name: a.activity_name.trim(),
        });
      }
    }

    return {
      journals: deduplicatedJournals.slice(0, 10),
      sleepRecords: deduplicatedSleep.slice(0, 7),
      activities: deduplicatedActivities.slice(0, 14),
    };
  }
}

export const aiService = new AIService();
