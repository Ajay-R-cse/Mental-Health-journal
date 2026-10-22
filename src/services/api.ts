import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { firestoreService } from './firestoreService';
import { aiService } from './aiService';
import {
  User,
  JournalEntry,
  SleepRecord,
  ActivityRecord,
  InsightRecord,
  MoodRecord,
  MoodCheckRecord,
  SentimentAnalysisResult,
  DashboardSummary,
  DashboardTrends,
  MoodType,
} from '../types';

class ApiClient {
  // ================= Password Reset =================
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    await sendPasswordResetEmail(auth, email.trim());
    return {
      success: true,
      message: 'Password reset link dispatched to your email address.',
    };
  }

  // ================= Journals =================
  async getJournals(filters?: {
    mood?: string;
    sentiment?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{ success: boolean; entries: JournalEntry[] }> {
    const entries = await firestoreService.getJournals(filters);
    return { success: true, entries };
  }

  async getJournal(id: string): Promise<{ success: boolean; entry: JournalEntry }> {
    const entry = await firestoreService.getJournal(id);
    if (!entry) throw new Error('Journal entry not found.');
    return { success: true, entry };
  }

  async createJournal(data: {
    journal_text: string;
    mood: MoodType;
    sleep_hours?: number;
    activities?: string[];
    tags?: string[];
    entry_date?: string;
  }): Promise<{ success: boolean; entry: JournalEntry }> {
    const entry = await firestoreService.createJournal(data);
    return { success: true, entry };
  }

  async updateJournal(
    id: string,
    data: Partial<{
      journal_text: string;
      mood: MoodType;
      sleep_hours?: number;
      activities?: string[];
      tags?: string[];
      entry_date?: string;
    }>
  ): Promise<{ success: boolean; entry: JournalEntry }> {
    const entry = await firestoreService.updateJournal(id, data);
    return { success: true, entry };
  }

  async deleteJournal(id: string): Promise<{ success: boolean; message: string }> {
    await firestoreService.deleteJournal(id);
    return { success: true, message: 'Journal entry deleted successfully.' };
  }

  // ================= Moods =================
  async getMoods(startDate?: string, endDate?: string): Promise<{ success: boolean; moods: MoodRecord[] }> {
    const moods = await firestoreService.getMoods(startDate, endDate);
    return { success: true, moods };
  }

  async recordMood(mood: MoodType, date?: string): Promise<{ success: boolean; mood: MoodRecord }> {
    const record = await firestoreService.recordMood(mood, date);
    return { success: true, mood: record };
  }

  async getMoodTrends(days = 7): Promise<{ success: boolean; moodTrend: DashboardTrends['moodTrend'] }> {
    const trends = await firestoreService.getDashboardTrends(days);
    return { success: true, moodTrend: trends.moodTrend };
  }

  // ================= Sleep =================
  async getSleepRecords(startDate?: string, endDate?: string): Promise<{ success: boolean; sleepRecords: SleepRecord[] }> {
    const sleepRecords = await firestoreService.getSleepRecords(startDate, endDate);
    return { success: true, sleepRecords };
  }

  async recordSleep(data: {
    sleep_hours: number;
    sleep_date?: string;
    notes?: string;
    journal_entry_id?: string;
  }): Promise<{ success: boolean; sleep: SleepRecord }> {
    const sleep = await firestoreService.recordSleep(data);
    return { success: true, sleep };
  }

  async updateSleep(id: string, data: Partial<SleepRecord>): Promise<{ success: boolean; sleep: SleepRecord }> {
    const sleep = await firestoreService.updateSleep(id, data);
    return { success: true, sleep };
  }

  async deleteSleep(id: string): Promise<{ success: boolean; message: string }> {
    await firestoreService.deleteSleep(id);
    return { success: true, message: 'Sleep record deleted.' };
  }

  async getSleepAverages(): Promise<{
    success: boolean;
    averages: { today: number; weeklyAvg: number; monthlyAvg: number; totalRecords: number };
  }> {
    const averages = await firestoreService.getSleepAverages();
    return { success: true, averages };
  }

  // ================= Activities =================
  async getActivities(startDate?: string, endDate?: string): Promise<{ success: boolean; activities: ActivityRecord[] }> {
    const activities = await firestoreService.getActivities(startDate, endDate);
    return { success: true, activities };
  }

  async recordActivity(data: {
    activity_name: string;
    duration?: number;
    activity_date?: string;
    journal_entry_id?: string;
  }): Promise<{ success: boolean; activity: ActivityRecord }> {
    const activity = await firestoreService.recordActivity(data);
    return { success: true, activity };
  }

  async updateActivity(id: string, data: Partial<ActivityRecord>): Promise<{ success: boolean; activity: ActivityRecord }> {
    const activity = await firestoreService.updateActivity(id, data);
    return { success: true, activity };
  }

  async deleteActivity(id: string): Promise<{ success: boolean; message: string }> {
    await firestoreService.deleteActivity(id);
    return { success: true, message: 'Activity record deleted.' };
  }

  async getActivityFrequencies(days = 30): Promise<{
    success: boolean;
    frequencies: Array<{ name: string; count: number; totalMinutes: number }>;
  }> {
    const frequencies = await firestoreService.getActivityFrequencies(days);
    return { success: true, frequencies };
  }

  // ================= NLP Sentiment Analysis =================
  async analyzeText(text: string): Promise<{ success: boolean; result: SentimentAnalysisResult }> {
    const nlp = await firestoreService.analyzeTextWithNLP(text);
    const score = nlp.sentimentScore;
    const normalizedScore = nlp.normalizedScore !== undefined
      ? nlp.normalizedScore
      : Number(Math.max(0, Math.min(1, (score + 1) / 2)).toFixed(2));

    const positiveSet = new Set(['grateful', 'happy', 'calm', 'peaceful', 'joy', 'excited', 'inspired', 'content', 'relief', 'good', 'glad', 'love', 'blessed']);
    const negativeSet = new Set(['sad', 'anxious', 'stressed', 'tired', 'down', 'exhausted', 'bad', 'frustrated', 'worried', 'angry', 'terrible', 'upset', 'disappointed']);

    return {
      success: true,
      result: {
        sentiment: nlp.sentiment,
        sentiment_score: score,
        normalized_score: normalizedScore,
        word_count: nlp.wordCount ?? text.split(/\s+/).filter(Boolean).length,
        positive_words: nlp.positiveWords ?? (nlp.emotionalKeywords || []).filter((k) => positiveSet.has(k)),
        negative_words: nlp.negativeWords ?? (nlp.emotionalKeywords || []).filter((k) => negativeSet.has(k)),
        provider: nlp.provider,
      },
    };
  }

  // ================= Insights =================
  async getInsights(): Promise<{ success: boolean; insights: InsightRecord[] }> {
    const insights = await firestoreService.getInsights();
    return { success: true, insights };
  }

  async refreshInsights(): Promise<{ success: boolean; insights: InsightRecord[] }> {
    const insights = await firestoreService.refreshInsights();
    return { success: true, insights };
  }

  // ================= Dashboard =================
  async getDashboardSummary(): Promise<{ success: boolean; summary: DashboardSummary }> {
    const summary = await firestoreService.getDashboardSummary();
    return { success: true, summary };
  }

  async getDashboardTrends(days = 7): Promise<{ success: boolean; trends: DashboardTrends }> {
    const trends = await firestoreService.getDashboardTrends(days);
    return { success: true, trends };
  }

  // ================= Multimodal Mood Checks =================
  async saveMoodCheck(data: {
    manualMood?: string;
    cameraEstimate?: string;
    cameraConfidence?: number;
    voiceEstimate?: string;
    voiceConfidence?: number;
    journalSentiment?: string;
    journalEntryId?: string;
    date?: string;
  }): Promise<{ success: boolean; record: MoodCheckRecord }> {
    const record = await firestoreService.saveMoodCheck(data);
    return { success: true, record };
  }

  async getMoodChecks(limitCount = 30): Promise<{ success: boolean; records: MoodCheckRecord[] }> {
    const records = await firestoreService.getMoodChecks(limitCount);
    return { success: true, records };
  }

  async deleteMoodCheck(id: string): Promise<{ success: boolean }> {
    await firestoreService.deleteMoodCheck(id);
    return { success: true };
  }

  // ================= AI Journal Insights & Reflection =================
  async generateJournalInsights(params: {
    journalText: string;
    manualMood?: string;
    journalSentiment?: string;
  }) {
    return aiService.generateJournalInsights(params);
  }

  async getSavedJournalInsight(journalEntryId: string) {
    return aiService.getSavedJournalInsight(journalEntryId);
  }

  async saveJournalInsight(journalEntryId: string, insights: any) {
    return aiService.saveJournalInsight(journalEntryId, insights);
  }

  async generateWeeklyReflection(data?: any) {
    const input = data || (await aiService.gatherUserWeeklyData());
    return aiService.generateWeeklyReflection(input);
  }
}

export const api = new ApiClient();
