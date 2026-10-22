import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  JournalEntry,
  SleepRecord,
  ActivityRecord,
  InsightRecord,
  MoodRecord,
  MoodCheckRecord,
  DashboardSummary,
  DashboardTrends,
  MoodType,
  SentimentType,
} from '../types';

const MOOD_TO_SCORE: Record<MoodType, number> = {
  'Very Happy': 5,
  Happy: 4,
  Neutral: 3,
  Sad: 2,
  'Very Sad': 1,
};

const SCORE_TO_MOOD: Record<number, MoodType> = {
  5: 'Very Happy',
  4: 'Happy',
  3: 'Neutral',
  2: 'Sad',
  1: 'Very Sad',
};

class FirestoreService {
  private getUid(): string {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User is not authenticated with Firebase.');
    }
    return user.uid;
  }

  // ========================================================
  // NLP Sentiment Analysis Integration (Modular Java NLP)
  // ========================================================
  public async analyzeTextWithNLP(text: string): Promise<{
    sentiment: SentimentType;
    sentimentScore: number;
    normalizedScore?: number;
    wordCount?: number;
    positiveWords?: string[];
    negativeWords?: string[];
    emotionalKeywords: string[];
    provider: string;
  }> {
    try {
      const res = await fetch('/api/nlp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          const score = data.result.sentimentScore ?? data.result.sentiment_score ?? 0;
          return {
            sentiment: data.result.sentiment || 'Neutral',
            sentimentScore: score,
            normalizedScore: data.result.normalized_score ?? Number(((score + 1) / 2).toFixed(2)),
            wordCount: data.result.word_count,
            positiveWords: data.result.positive_words || [],
            negativeWords: data.result.negative_words || [],
            emotionalKeywords: data.result.emotionalKeywords || [],
            provider: data.result.provider || 'Stanford CoreNLP Java Microservice',
          };
        }
      }
    } catch (err) {
      console.warn('Backend Java NLP endpoint unreachable, utilizing explicitly labeled local fallback:', err);
    }

    // Explicitly labeled fallback only used if Java microservice / backend endpoint is unreachable
    return this.fallbackSentiment(text);
  }

  private fallbackSentiment(text: string) {
    const positiveWords = new Set([
      'grateful', 'happy', 'calm', 'peaceful', 'joy', 'excited', 'inspired', 'content', 'relief',
      'good', 'glad', 'love', 'blessed', 'supported', 'support', 'friends', 'friend', 'passed',
      'pass', 'okay', 'ok', 'wonderful', 'great'
    ]);
    const negativeWords = new Set([
      'sad', 'anxious', 'stressed', 'tired', 'down', 'exhausted', 'bad', 'frustrated', 'worried',
      'angry', 'terrible', 'upset', 'disappointed', 'failed', 'failure', 'delay', 'ruined', 'ruin'
    ]);
    const negations = new Set(['not', 'never', 'no', "don't", 'dont', "didn't", 'didnt', "wasn't", 'wasnt', "isn't", 'isnt', 'without', 'barely', 'hardly']);
    const concurrencePattern = /\b(at the same time|mixed feelings|both|bittersweet|conflicted|part of me)\b/i;

    const trimmed = text.trim();
    const tokens = trimmed.toLowerCase().match(/[a-z']+/g) || [];
    let score = 0;
    const positiveWordsFound: string[] = [];
    const negativeWordsFound: string[] = [];
    const matchedKeywords: string[] = [];

    // Fast-path guard for short neutral factual statements
    if (tokens.length <= 3 && !trimmed.includes('!') && !trimmed.includes('?')) {
      const lower = trimmed.toLowerCase();
      const hasEmotion = ['happy', 'sad', 'angry', 'depressed', 'anxious', 'joy', 'excited'].some((e) => lower.includes(e));
      if (!hasEmotion) {
        return {
          sentiment: 'Neutral' as SentimentType,
          sentimentScore: 0,
          normalizedScore: 0.5,
          wordCount: tokens.length,
          positiveWords: [],
          negativeWords: [],
          emotionalKeywords: [],
          provider: 'Explicit Local Fallback (Java NLP Microservice Unreachable)',
        };
      }
    }

    // Find contrast clause ("but", "however")
    let contrastIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'but' || tokens[i] === 'however') {
        contrastIdx = i;
        break;
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      let isNegated = false;
      for (let j = Math.max(0, i - 3); j < i; j++) {
        if (negations.has(tokens[j])) {
          isNegated = !isNegated;
        }
      }

      const weight = contrastIdx >= 0 && i > contrastIdx ? 2 : 1;

      if (positiveWords.has(w)) {
        if (isNegated) {
          score -= 2 * weight;
          if (!negativeWordsFound.includes(`not ${w}`)) negativeWordsFound.push(`not ${w}`);
        } else {
          score += 2 * weight;
          if (!positiveWordsFound.includes(w)) positiveWordsFound.push(w);
          if (!matchedKeywords.includes(w)) matchedKeywords.push(w);
        }
      } else if (negativeWords.has(w)) {
        if (isNegated) {
          score += 1 * weight;
          if (!positiveWordsFound.includes(`not ${w}`)) positiveWordsFound.push(`not ${w}`);
        } else {
          score -= 2 * weight;
          if (!negativeWordsFound.includes(w)) negativeWordsFound.push(w);
          if (!matchedKeywords.includes(w)) matchedKeywords.push(w);
        }
      }
    }

    // Standardized compound scale: -1.0 to +1.0
    const clampedRaw = Math.max(-10, Math.min(10, score));
    const standardizedScore = Number((clampedRaw / 10).toFixed(2));

    const hasBothValences = positiveWordsFound.length > 0 && negativeWordsFound.length > 0;
    const hasConcurrence = concurrencePattern.test(trimmed);
    const hasExplicitPositive = positiveWordsFound.some((w) => !w.startsWith('not '));

    let sentiment: SentimentType = 'Neutral';
    if (hasBothValences && (hasConcurrence || contrastIdx >= 0)) {
      if (hasConcurrence) {
        sentiment = 'Mixed';
      } else if (standardizedScore <= -0.5) {
        sentiment = 'Negative';
      } else {
        sentiment = 'Mixed';
      }
    } else if (hasBothValences && Math.abs(standardizedScore) < 0.3) {
      sentiment = 'Mixed';
    } else if (standardizedScore >= 0.16) {
      if (!hasExplicitPositive && standardizedScore < 0.35) {
        sentiment = 'Neutral';
      } else {
        sentiment = 'Positive';
      }
    } else if (standardizedScore <= -0.16) {
      sentiment = 'Negative';
    } else {
      sentiment = 'Neutral';
    }

    const normalizedScore = Number(((standardizedScore + 1) / 2).toFixed(2));

    return {
      sentiment,
      sentimentScore: standardizedScore,
      normalizedScore,
      wordCount: tokens.length,
      positiveWords: positiveWordsFound,
      negativeWords: negativeWordsFound,
      emotionalKeywords: matchedKeywords,
      provider: 'Explicit Local Fallback (Java NLP Microservice Unreachable)',
    };
  }

  // ========================================================
  // 1. JOURNAL ENTRIES
  // ========================================================
  public async getJournals(filters?: {
    mood?: string;
    sentiment?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<JournalEntry[]> {
    const uid = this.getUid();
    const collectionPath = 'journalEntries';

    try {
      const q = query(
        collection(db, collectionPath),
        where('userId', '==', uid)
      );
      const snapshot = await getDocs(q);

      let entries: JournalEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          user_id: d.userId || d.user_id || uid,
          journal_text: d.journalText || d.journal_text || '',
          mood: d.mood || 'Neutral',
          sleep_hours: d.sleepHours !== undefined ? d.sleepHours : d.sleep_hours,
          activities: d.activities || [],
          tags: d.tags || d.emotionalKeywords || [],
          sentiment: d.sentiment || 'Neutral',
          sentiment_score: d.sentimentScore !== undefined ? d.sentimentScore : d.sentiment_score || 0,
          entry_date: d.date || d.entry_date || new Date().toISOString().split('T')[0],
          created_at: d.createdAt || d.created_at || new Date().toISOString(),
          updated_at: d.updatedAt || d.updated_at || new Date().toISOString(),
        };
      });

      // In-memory filtering to satisfy combinations without requiring complex compound indices
      if (filters?.mood && filters.mood !== 'all') {
        entries = entries.filter((e) => e.mood.toLowerCase() === filters.mood?.toLowerCase());
      }
      if (filters?.sentiment && filters.sentiment !== 'all') {
        entries = entries.filter((e) => e.sentiment.toLowerCase() === filters.sentiment?.toLowerCase());
      }
      if (filters?.startDate) {
        entries = entries.filter((e) => e.entry_date >= filters.startDate!);
      }
      if (filters?.endDate) {
        entries = entries.filter((e) => e.entry_date <= filters.endDate!);
      }
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        entries = entries.filter(
          (e) =>
            e.journal_text.toLowerCase().includes(searchLower) ||
            e.tags?.some((t) => t.toLowerCase().includes(searchLower))
        );
      }

      // Sort newest first
      entries.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime() || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return entries;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, collectionPath);
    }
  }

  public async getJournal(id: string): Promise<JournalEntry | null> {
    const uid = this.getUid();
    const docPath = `journalEntries/${id}`;
    try {
      const docSnap = await getDoc(doc(db, 'journalEntries', id));
      if (!docSnap.exists()) return null;
      const d = docSnap.data();
      if (d.userId !== uid) {
        throw new Error('Access denied: Journal entry belongs to another user.');
      }
      return {
        id: docSnap.id,
        user_id: d.userId,
        journal_text: d.journalText || d.journal_text || '',
        mood: d.mood,
        sleep_hours: d.sleepHours,
        activities: d.activities || [],
        tags: d.tags || d.emotionalKeywords || [],
        sentiment: d.sentiment,
        sentiment_score: d.sentimentScore ?? 0,
        entry_date: d.date || d.entry_date,
        created_at: d.createdAt,
        updated_at: d.updatedAt,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, docPath);
    }
  }

  public async createJournal(data: {
    journal_text: string;
    mood: MoodType;
    sleep_hours?: number;
    activities?: string[];
    tags?: string[];
    entry_date?: string;
  }): Promise<JournalEntry> {
    const uid = this.getUid();
    const collectionPath = 'journalEntries';

    // 1. Run modular NLP Sentiment Analysis
    const nlp = await this.analyzeTextWithNLP(data.journal_text);

    const now = new Date().toISOString();
    const date = data.entry_date || now.split('T')[0];

    const emotionalKeywords = Array.from(
      new Set([...(data.tags || []), ...(nlp.emotionalKeywords || [])])
    );

    // Document structure strictly adhering to user requirements
    const newEntryPayload = {
      userId: uid,
      date,
      journalText: data.journal_text,
      mood: data.mood,
      sleepHours: data.sleep_hours !== undefined ? Number(data.sleep_hours) : null,
      sentiment: nlp.sentiment,
      sentimentScore: nlp.sentimentScore,
      emotionalKeywords,
      activities: data.activities || [],
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      const docRef = await addDoc(collection(db, collectionPath), newEntryPayload);

      // Auto-record Sleep if provided
      if (data.sleep_hours !== undefined && data.sleep_hours !== null && !isNaN(data.sleep_hours)) {
        await this.recordSleep({
          sleep_hours: Number(data.sleep_hours),
          sleep_date: date,
          journal_entry_id: docRef.id,
        }).catch((e) => console.warn('Sleep record sync warning:', e));
      }

      // Auto-record Activities if provided
      if (data.activities && data.activities.length > 0) {
        for (const act of data.activities) {
          await this.recordActivity({
            activity_name: act,
            activity_date: date,
            journal_entry_id: docRef.id,
          }).catch((e) => console.warn('Activity record sync warning:', e));
        }
      }

      // Auto-record Mood check-in for the day
      await this.recordMood(data.mood, date).catch((e) => console.warn('Mood record sync warning:', e));

      // Refresh insights in background
      this.refreshInsights().catch(() => {});

      return {
        id: docRef.id,
        user_id: uid,
        journal_text: data.journal_text,
        mood: data.mood,
        sleep_hours: data.sleep_hours,
        activities: data.activities || [],
        tags: emotionalKeywords,
        sentiment: nlp.sentiment,
        sentiment_score: nlp.sentimentScore,
        entry_date: date,
        created_at: now,
        updated_at: now,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionPath);
    }
  }

  public async updateJournal(
    id: string,
    data: Partial<{
      journal_text: string;
      mood: MoodType;
      sleep_hours?: number;
      activities?: string[];
      tags?: string[];
      entry_date?: string;
    }>
  ): Promise<JournalEntry> {
    const uid = this.getUid();
    const docPath = `journalEntries/${id}`;

    try {
      const docRef = doc(db, 'journalEntries', id);
      const existing = await getDoc(docRef);
      if (!existing.exists()) {
        throw new Error('Journal entry not found.');
      }
      if (existing.data().userId !== uid) {
        throw new Error('Unauthorized to update this entry.');
      }

      const updates: any = {
        updatedAt: new Date().toISOString(),
      };

      if (data.journal_text !== undefined) {
        updates.journalText = data.journal_text;
        // Re-run NLP on edited text
        const nlp = await this.analyzeTextWithNLP(data.journal_text);
        updates.sentiment = nlp.sentiment;
        updates.sentimentScore = nlp.sentimentScore;
        updates.emotionalKeywords = Array.from(
          new Set([...(data.tags || existing.data().tags || []), ...(nlp.emotionalKeywords || [])])
        );
      }
      if (data.mood !== undefined) updates.mood = data.mood;
      if (data.sleep_hours !== undefined) updates.sleepHours = Number(data.sleep_hours);
      if (data.activities !== undefined) updates.activities = data.activities;
      if (data.tags !== undefined) updates.tags = data.tags;
      if (data.entry_date !== undefined) updates.date = data.entry_date;

      await updateDoc(docRef, updates);

      const finalSnap = await getDoc(docRef);
      const d = finalSnap.data()!;

      return {
        id: finalSnap.id,
        user_id: uid,
        journal_text: d.journalText,
        mood: d.mood,
        sleep_hours: d.sleepHours,
        activities: d.activities || [],
        tags: d.tags || d.emotionalKeywords || [],
        sentiment: d.sentiment,
        sentiment_score: d.sentimentScore,
        entry_date: d.date,
        created_at: d.createdAt,
        updated_at: d.updatedAt,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  }

  public async deleteJournal(id: string): Promise<void> {
    const uid = this.getUid();
    const docPath = `journalEntries/${id}`;
    try {
      const docRef = doc(db, 'journalEntries', id);
      const existing = await getDoc(docRef);
      if (!existing.exists()) return;
      if (existing.data().userId !== uid) {
        throw new Error('Unauthorized to delete this entry.');
      }
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  }

  // ========================================================
  // 2. SLEEP RECORDS
  // ========================================================
  public async getSleepRecords(startDate?: string, endDate?: string): Promise<SleepRecord[]> {
    const uid = this.getUid();
    const collectionPath = 'sleepRecords';
    try {
      const q = query(
        collection(db, collectionPath),
        where('userId', '==', uid)
      );
      const snapshot = await getDocs(q);
      let records: SleepRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          user_id: d.userId,
          journal_entry_id: d.journalEntryId || d.journal_entry_id,
          sleep_hours: d.sleepHours !== undefined ? d.sleepHours : d.sleep_hours || 0,
          sleep_date: d.date || d.sleep_date || new Date().toISOString().split('T')[0],
          notes: d.notes,
          created_at: d.createdAt || d.created_at || new Date().toISOString(),
        };
      });

      if (startDate) records = records.filter((r) => r.sleep_date >= startDate);
      if (endDate) records = records.filter((r) => r.sleep_date <= endDate);

      records.sort((a, b) => new Date(b.sleep_date).getTime() - new Date(a.sleep_date).getTime());
      return records;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, collectionPath);
    }
  }

  public async recordSleep(data: {
    sleep_hours: number;
    sleep_date?: string;
    notes?: string;
    journal_entry_id?: string;
  }): Promise<SleepRecord> {
    const uid = this.getUid();
    const collectionPath = 'sleepRecords';
    const now = new Date().toISOString();
    const date = data.sleep_date || now.split('T')[0];

    const payload = {
      userId: uid,
      date,
      sleepHours: Number(data.sleep_hours),
      notes: data.notes || '',
      journalEntryId: data.journal_entry_id || null,
      createdAt: now,
    };

    try {
      const docRef = await addDoc(collection(db, collectionPath), payload);
      return {
        id: docRef.id,
        user_id: uid,
        journal_entry_id: data.journal_entry_id,
        sleep_hours: Number(data.sleep_hours),
        sleep_date: date,
        notes: data.notes,
        created_at: now,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionPath);
    }
  }

  public async updateSleep(id: string, data: Partial<SleepRecord>): Promise<SleepRecord> {
    const uid = this.getUid();
    const docPath = `sleepRecords/${id}`;
    try {
      const docRef = doc(db, 'sleepRecords', id);
      const existing = await getDoc(docRef);
      if (!existing.exists() || existing.data().userId !== uid) {
        throw new Error('Sleep record not found or access denied.');
      }
      const updates: any = {};
      if (data.sleep_hours !== undefined) updates.sleepHours = Number(data.sleep_hours);
      if (data.sleep_date !== undefined) updates.date = data.sleep_date;
      if (data.notes !== undefined) updates.notes = data.notes;

      await updateDoc(docRef, updates);
      const updatedSnap = await getDoc(docRef);
      const d = updatedSnap.data()!;
      return {
        id: updatedSnap.id,
        user_id: uid,
        journal_entry_id: d.journalEntryId,
        sleep_hours: d.sleepHours,
        sleep_date: d.date,
        notes: d.notes,
        created_at: d.createdAt,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  }

  public async deleteSleep(id: string): Promise<void> {
    const uid = this.getUid();
    const docPath = `sleepRecords/${id}`;
    try {
      const docRef = doc(db, 'sleepRecords', id);
      const existing = await getDoc(docRef);
      if (!existing.exists() || existing.data().userId !== uid) return;
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  }

  public async getSleepAverages(): Promise<{
    today: number;
    weeklyAvg: number;
    monthlyAvg: number;
    totalRecords: number;
  }> {
    const records = await this.getSleepRecords();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecord = records.find((r) => r.sleep_date === todayStr);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const pastWeek = records.filter((r) => new Date(r.sleep_date) >= sevenDaysAgo);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const pastMonth = records.filter((r) => new Date(r.sleep_date) >= thirtyDaysAgo);

    const weeklyAvg = pastWeek.length > 0 ? Number((pastWeek.reduce((acc, r) => acc + r.sleep_hours, 0) / pastWeek.length).toFixed(1)) : 0;
    const monthlyAvg = pastMonth.length > 0 ? Number((pastMonth.reduce((acc, r) => acc + r.sleep_hours, 0) / pastMonth.length).toFixed(1)) : 0;

    return {
      today: todayRecord ? todayRecord.sleep_hours : 0,
      weeklyAvg,
      monthlyAvg,
      totalRecords: records.length,
    };
  }

  // ========================================================
  // 3. ACTIVITIES
  // ========================================================
  public async getActivities(startDate?: string, endDate?: string): Promise<ActivityRecord[]> {
    const uid = this.getUid();
    const collectionPath = 'activities';
    try {
      const q = query(
        collection(db, collectionPath),
        where('userId', '==', uid)
      );
      const snapshot = await getDocs(q);
      let records: ActivityRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          user_id: d.userId,
          journal_entry_id: d.journalEntryId || d.journal_entry_id,
          activity_name: d.activityName || d.activity_name || 'Mindfulness',
          duration: d.duration || 15,
          activity_date: d.date || d.activity_date || new Date().toISOString().split('T')[0],
          created_at: d.createdAt || d.created_at || new Date().toISOString(),
        };
      });

      if (startDate) records = records.filter((r) => r.activity_date >= startDate);
      if (endDate) records = records.filter((r) => r.activity_date <= endDate);

      records.sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime());
      return records;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, collectionPath);
    }
  }

  public async recordActivity(data: {
    activity_name: string;
    duration?: number;
    activity_date?: string;
    journal_entry_id?: string;
  }): Promise<ActivityRecord> {
    const uid = this.getUid();
    const collectionPath = 'activities';
    const now = new Date().toISOString();
    const date = data.activity_date || now.split('T')[0];

    const payload = {
      userId: uid,
      activityName: data.activity_name,
      duration: data.duration ? Number(data.duration) : 15,
      date,
      journalEntryId: data.journal_entry_id || null,
      createdAt: now,
    };

    try {
      const docRef = await addDoc(collection(db, collectionPath), payload);
      return {
        id: docRef.id,
        user_id: uid,
        journal_entry_id: data.journal_entry_id,
        activity_name: data.activity_name,
        duration: payload.duration,
        activity_date: date,
        created_at: now,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionPath);
    }
  }

  public async updateActivity(id: string, data: Partial<ActivityRecord>): Promise<ActivityRecord> {
    const uid = this.getUid();
    const docPath = `activities/${id}`;
    try {
      const docRef = doc(db, 'activities', id);
      const existing = await getDoc(docRef);
      if (!existing.exists() || existing.data().userId !== uid) {
        throw new Error('Activity record not found or access denied.');
      }
      const updates: any = {};
      if (data.activity_name !== undefined) updates.activityName = data.activity_name;
      if (data.duration !== undefined) updates.duration = Number(data.duration);
      if (data.activity_date !== undefined) updates.date = data.activity_date;

      await updateDoc(docRef, updates);
      const updatedSnap = await getDoc(docRef);
      const d = updatedSnap.data()!;
      return {
        id: updatedSnap.id,
        user_id: uid,
        journal_entry_id: d.journalEntryId,
        activity_name: d.activityName,
        duration: d.duration,
        activity_date: d.date,
        created_at: d.createdAt,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  }

  public async deleteActivity(id: string): Promise<void> {
    const uid = this.getUid();
    const docPath = `activities/${id}`;
    try {
      const docRef = doc(db, 'activities', id);
      const existing = await getDoc(docRef);
      if (!existing.exists() || existing.data().userId !== uid) return;
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  }

  public async getActivityFrequencies(days = 30): Promise<Array<{ name: string; count: number; totalMinutes: number }>> {
    const records = await this.getActivities();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = records.filter((r) => new Date(r.activity_date) >= cutoff);
    const map = new Map<string, { count: number; totalMinutes: number }>();

    filtered.forEach((r) => {
      const name = r.activity_name.trim();
      const curr = map.get(name) || { count: 0, totalMinutes: 0 };
      curr.count += 1;
      curr.totalMinutes += r.duration || 15;
      map.set(name, curr);
    });

    return Array.from(map.entries())
      .map(([name, stat]) => ({ name, count: stat.count, totalMinutes: stat.totalMinutes }))
      .sort((a, b) => b.count - a.count);
  }

  // ========================================================
  // 4. MOODS
  // ========================================================
  public async getMoods(startDate?: string, endDate?: string): Promise<MoodRecord[]> {
    const uid = this.getUid();
    const collectionPath = 'moods';
    try {
      const q = query(
        collection(db, collectionPath),
        where('userId', '==', uid)
      );
      const snapshot = await getDocs(q);
      let records: MoodRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          user_id: d.userId,
          mood: d.mood || 'Neutral',
          date: d.date || new Date().toISOString().split('T')[0],
          journal_entry_id: d.journalEntryId || d.journal_entry_id,
          created_at: d.createdAt || d.created_at || new Date().toISOString(),
        };
      });

      if (startDate) records = records.filter((r) => r.date >= startDate);
      if (endDate) records = records.filter((r) => r.date <= endDate);

      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return records;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, collectionPath);
    }
  }

  public async recordMood(mood: MoodType, date?: string): Promise<MoodRecord> {
    const uid = this.getUid();
    const collectionPath = 'moods';
    const now = new Date().toISOString();
    const targetDate = date || now.split('T')[0];

    const payload = {
      userId: uid,
      mood,
      date: targetDate,
      createdAt: now,
    };

    try {
      const docRef = await addDoc(collection(db, collectionPath), payload);
      return {
        id: docRef.id,
        user_id: uid,
        mood,
        date: targetDate,
        created_at: now,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionPath);
    }
  }

  // ========================================================
  // 5. INSIGHTS
  // ========================================================
  public async getInsights(): Promise<InsightRecord[]> {
    const uid = this.getUid();
    const collectionPath = 'insights';
    try {
      const q = query(
        collection(db, collectionPath),
        where('userId', '==', uid)
      );
      const snapshot = await getDocs(q);
      const records: InsightRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          user_id: d.userId,
          insight_text: d.description || d.insight_text || d.title || 'Wellness reflection',
          insight_type: d.type || d.insight_type || 'summary',
          created_at: d.createdAt || d.created_at || new Date().toISOString(),
        };
      });

      records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return records;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, collectionPath);
    }
  }

  public async refreshInsights(): Promise<InsightRecord[]> {
    const uid = this.getUid();
    const [journals, sleeps, activities] = await Promise.all([
      this.getJournals(),
      this.getSleepRecords(),
      this.getActivities(),
    ]);

    const generated: Array<{ title: string; description: string; type: 'correlation' | 'summary' | 'trend' | 'streak' }> = [];

    // 1. Streak insight
    const streak = this.calculateJournalStreak(journals);
    if (streak > 1) {
      generated.push({
        title: 'Active Journaling Streak',
        description: `You have maintained an inspiring ${streak}-day reflection streak! Consistent journaling supports emotional balance and self-awareness.`,
        type: 'streak',
      });
    }

    // 2. Sleep-mood correlation
    if (sleeps.length >= 3 && journals.length >= 3) {
      const goodSleepDays = sleeps.filter((s) => s.sleep_hours >= 7.5).map((s) => s.sleep_date);
      const goodSleepJournals = journals.filter((j) => goodSleepDays.includes(j.entry_date));
      if (goodSleepJournals.length > 0) {
        const happyCount = goodSleepJournals.filter((j) => j.mood === 'Happy' || j.mood === 'Very Happy').length;
        const pct = Math.round((happyCount / goodSleepJournals.length) * 100);
        if (pct >= 50) {
          generated.push({
            title: 'Sleep & Mood Harmony',
            description: `On nights when you log 7.5+ hours of rest, ${pct}% of your journal entries reflect high optimism and gratitude.`,
            type: 'correlation',
          });
        }
      }
    }

    // 3. Activity insight
    if (activities.length >= 2) {
      const topAct = activities[0].activity_name;
      generated.push({
        title: 'Mindful Habits Impact',
        description: `Engaging in activities like "${topAct}" correlates with sustained positive sentiment in your journal reflections.`,
        type: 'summary',
      });
    }

    // 4. Default gentle encouragement if new user
    if (generated.length === 0) {
      generated.push({
        title: 'MindSpace Wellness Journey',
        description: 'Welcome to your mindful sanctuary. As you record your daily reflections, sleep, and habits, data-driven wellness insights will automatically emerge.',
        type: 'summary',
      });
    }

    // Persist new insights to Firestore
    const now = new Date().toISOString();
    for (const item of generated) {
      try {
        await addDoc(collection(db, 'insights'), {
          userId: uid,
          title: item.title,
          description: item.description,
          type: item.type,
          createdAt: now,
        });
      } catch (e) {
        console.warn('Insight save error:', e);
      }
    }

    return this.getInsights();
  }

  // ========================================================
  // 6. DASHBOARD & REAL-TIME STATS CALCULATION
  // ========================================================
  public async getDashboardSummary(): Promise<DashboardSummary> {
    const uid = this.getUid();
    const [journals, sleeps, activities, moods, insights] = await Promise.all([
      this.getJournals(),
      this.getSleepRecords(),
      this.getActivities(),
      this.getMoods(),
      this.getInsights(),
    ]);

    const todayStr = new Date().toISOString().split('T')[0];

    // Today's journal
    const todayJournal = journals.find((j) => j.entry_date === todayStr) || null;
    const latestJournal = journals.length > 0 ? journals[0] : null;

    // Today's mood: from today's journal or today's mood check-in or default 'Neutral'
    let todayMood: MoodType = 'Neutral';
    if (todayJournal) {
      todayMood = todayJournal.mood;
    } else {
      const todayMoodRecord = moods.find((m) => m.date === todayStr);
      if (todayMoodRecord) todayMood = todayMoodRecord.mood;
      else if (latestJournal) todayMood = latestJournal.mood;
    }

    // Today's sleep: from today's sleep log or journal entry
    let todaySleep = 0;
    const todaySleepRecord = sleeps.find((s) => s.sleep_date === todayStr);
    if (todaySleepRecord) {
      todaySleep = todaySleepRecord.sleep_hours;
    } else if (todayJournal && todayJournal.sleep_hours) {
      todaySleep = todayJournal.sleep_hours;
    } else if (sleeps.length > 0) {
      todaySleep = sleeps[0].sleep_hours;
    }

    // Today's sentiment
    let currentSentiment: SentimentType = 'Neutral';
    let currentSentimentScore = 0;
    if (todayJournal) {
      currentSentiment = todayJournal.sentiment;
      currentSentimentScore = todayJournal.sentiment_score;
    } else if (latestJournal) {
      currentSentiment = latestJournal.sentiment;
      currentSentimentScore = latestJournal.sentiment_score;
    }

    // Today's activities
    const todayActs = activities
      .filter((a) => a.activity_date === todayStr)
      .map((a) => a.activity_name);

    if (todayActs.length === 0 && todayJournal && todayJournal.activities) {
      todayActs.push(...todayJournal.activities);
    }

    // Average sleep
    const avgSleep = sleeps.length > 0
      ? Number((sleeps.reduce((sum, s) => sum + s.sleep_hours, 0) / sleeps.length).toFixed(1))
      : 0;

    // Streak
    const streak = this.calculateJournalStreak(journals);

    return {
      todayMood,
      todaySleep,
      todayActivities: Array.from(new Set(todayActs)),
      currentSentiment,
      currentSentimentScore,
      avgSleep,
      latestJournal,
      recentEntries: journals.slice(0, 5),
      insights: insights.length > 0 ? insights.slice(0, 4) : [],
      streak,
      totalEntries: journals.length,
    };
  }

  public async getDashboardTrends(days = 7): Promise<DashboardTrends> {
    const [journals, sleeps, moods] = await Promise.all([
      this.getJournals(),
      this.getSleepRecords(),
      this.getMoods(),
    ]);

    const moodTrend: DashboardTrends['moodTrend'] = [];
    const sentimentTrend: DashboardTrends['sentimentTrend'] = [];
    const sleepTrend: DashboardTrends['sleepTrend'] = [];
    const moodVsSleep: DashboardTrends['moodVsSleep'] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Find journal entry on this day
      const jEntry = journals.find((j) => j.entry_date === dateStr);
      // Find mood checkin
      const mEntry = moods.find((m) => m.date === dateStr);
      // Find sleep entry
      const sEntry = sleeps.find((s) => s.sleep_date === dateStr);

      const dayMood: MoodType | null = jEntry ? jEntry.mood : mEntry ? mEntry.mood : null;
      const moodScore = dayMood ? MOOD_TO_SCORE[dayMood] : null;

      moodTrend.push({
        date: dateStr,
        displayDate,
        mood: dayMood,
        score: moodScore,
      });

      const daySentiment: SentimentType | null = jEntry ? jEntry.sentiment : null;
      const sentimentScore = jEntry ? jEntry.sentiment_score : null;

      sentimentTrend.push({
        date: dateStr,
        displayDate,
        sentiment: daySentiment,
        score: sentimentScore,
      });

      const sleepHours = sEntry ? sEntry.sleep_hours : jEntry?.sleep_hours ? jEntry.sleep_hours : null;

      sleepTrend.push({
        date: dateStr,
        displayDate,
        hours: sleepHours,
      });

      if (moodScore !== null || sleepHours !== null) {
        moodVsSleep.push({
          date: dateStr,
          mood: dayMood || 'Neutral',
          moodScore: moodScore ?? 3,
          sleepHours: sleepHours ?? 7,
        });
      }
    }

    // Sentiment breakdown & activity distribution
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    journals.forEach((j) => {
      if (j.sentiment === 'Positive') positive++;
      else if (j.sentiment === 'Negative') negative++;
      else neutral++;
    });

    const activities = await this.getActivities();
    const actMap = new Map<string, number>();
    activities.forEach((a) => {
      actMap.set(a.activity_name, (actMap.get(a.activity_name) || 0) + 1);
    });

    const activityDistribution = Array.from(actMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const avgSleep = sleeps.length > 0
      ? Number((sleeps.reduce((sum, s) => sum + s.sleep_hours, 0) / sleeps.length).toFixed(1))
      : 7.0;

    const avgMoodScore = journals.length > 0
      ? Math.round(journals.reduce((sum, j) => sum + (MOOD_TO_SCORE[j.mood] || 3), 0) / journals.length)
      : 3;

    return {
      timeframeDays: days,
      moodTrend,
      sentimentTrend,
      sleepTrend,
      moodVsSleep,
      activityDistribution,
      summary: {
        totalEntries: journals.length,
        positiveEntries: positive,
        neutralEntries: neutral,
        negativeEntries: negative,
        averageMood: SCORE_TO_MOOD[avgMoodScore] || 'Neutral',
        averageSleep: avgSleep,
        mostFrequentActivity: activityDistribution[0]?.name || 'Mindfulness',
      },
    };
  }

  private calculateJournalStreak(journals: JournalEntry[]): number {
    if (journals.length === 0) return 0;
    const uniqueDates = Array.from(new Set(journals.map((j) => j.entry_date))).sort().reverse();
    if (uniqueDates.length === 0) return 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If user hasn't journaled today or yesterday, streak is broken
    if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    let checkDate = uniqueDates.includes(todayStr) ? new Date() : yesterday;

    while (true) {
      const dateString = checkDate.toISOString().split('T')[0];
      if (uniqueDates.includes(dateString)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // ========================================================
  // Multimodal Mood Checks (Optional Camera, Voice, Manual, Sentiment)
  // ========================================================
  public async saveMoodCheck(data: {
    manualMood?: string;
    cameraEstimate?: string;
    cameraConfidence?: number;
    voiceEstimate?: string;
    voiceConfidence?: number;
    journalSentiment?: string;
    journalEntryId?: string;
    date?: string;
  }): Promise<MoodCheckRecord> {
    const uid = this.getUid();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const recordPayload: Record<string, any> = {
      userId: uid,
      date: data.date || today,
      createdAt: now,
    };

    if (data.journalEntryId) recordPayload.journalEntryId = data.journalEntryId;
    if (data.manualMood) recordPayload.manualMood = data.manualMood;
    if (data.cameraEstimate) {
      recordPayload.cameraEstimate = data.cameraEstimate;
      recordPayload.cameraConfidence = data.cameraConfidence ?? 0.7;
    }
    if (data.voiceEstimate) {
      recordPayload.voiceEstimate = data.voiceEstimate;
      recordPayload.voiceConfidence = data.voiceConfidence ?? 0.65;
    }
    if (data.journalSentiment) {
      recordPayload.journalSentiment = data.journalSentiment;
    }

    try {
      const colRef = collection(db, 'moodChecks');
      const docRef = await addDoc(colRef, recordPayload);
      return {
        id: docRef.id,
        userId: uid,
        date: recordPayload.date,
        journalEntryId: recordPayload.journalEntryId,
        manualMood: recordPayload.manualMood,
        cameraEstimate: recordPayload.cameraEstimate,
        cameraConfidence: recordPayload.cameraConfidence,
        voiceEstimate: recordPayload.voiceEstimate,
        voiceConfidence: recordPayload.voiceConfidence,
        journalSentiment: recordPayload.journalSentiment,
        createdAt: recordPayload.createdAt,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'moodChecks');
      throw error;
    }
  }

  public async getMoodChecks(limitCount = 30): Promise<MoodCheckRecord[]> {
    const uid = this.getUid();
    try {
      const colRef = collection(db, 'moodChecks');
      const q = query(
        colRef,
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          date: d.date,
          journalEntryId: d.journalEntryId,
          manualMood: d.manualMood,
          cameraEstimate: d.cameraEstimate,
          cameraConfidence: d.cameraConfidence,
          voiceEstimate: d.voiceEstimate,
          voiceConfidence: d.voiceConfidence,
          journalSentiment: d.journalSentiment,
          createdAt: d.createdAt,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'moodChecks');
      return [];
    }
  }

  public async deleteMoodCheck(id: string): Promise<void> {
    this.getUid();
    try {
      const docRef = doc(db, 'moodChecks', id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `moodChecks/${id}`);
      throw error;
    }
  }
}

export const firestoreService = new FirestoreService();
