import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { firestoreService } from './firestoreService';
import {
  User,
  JournalEntry,
  SleepRecord,
  ActivityRecord,
  InsightRecord,
  MoodRecord,
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
    return {
      success: true,
      result: {
        sentiment: nlp.sentiment,
        sentiment_score: nlp.sentimentScore,
        normalized_score: (nlp.sentimentScore + 10) / 20,
        word_count: text.split(/\s+/).filter(Boolean).length,
        positive_words: nlp.emotionalKeywords.filter((k) => ['grateful', 'happy', 'calm', 'peaceful', 'joy', 'excited', 'inspired', 'content', 'relief', 'good', 'glad', 'love', 'blessed'].includes(k)),
        negative_words: nlp.emotionalKeywords.filter((k) => ['sad', 'anxious', 'stressed', 'tired', 'down', 'exhausted', 'bad', 'frustrated', 'worried', 'angry', 'terrible', 'upset'].includes(k)),
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
}

export const api = new ApiClient();
