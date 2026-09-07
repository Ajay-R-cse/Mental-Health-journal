import { journalRepository, JournalFilters } from '../repositories/JournalRepository.js';
import { sleepRepository } from '../repositories/SleepRepository.js';
import { activityRepository } from '../repositories/ActivityRepository.js';
import { moodRepository } from '../repositories/MoodRepository.js';
import { nlpService } from '../nlp/NLPService.js';
import { insightService } from './InsightService.js';
import { JournalEntry, MoodType } from '../models/index.js';

export interface CreateJournalDTO {
  journal_text: string;
  mood: MoodType;
  sleep_hours?: number;
  activities?: string[];
  tags?: string[];
  entry_date?: string;
}

export class JournalService {
  async getEntries(userId: string, filters?: JournalFilters): Promise<JournalEntry[]> {
    return journalRepository.findByUserId(userId, filters);
  }

  async getEntryById(id: string, userId: string): Promise<JournalEntry | null> {
    return journalRepository.findById(id, userId);
  }

  async createEntry(userId: string, data: CreateJournalDTO): Promise<JournalEntry> {
    const entryDate = data.entry_date || new Date().toISOString().split('T')[0];

    // 1. Run NLP Sentiment Analysis automatically
    const nlpResult = await nlpService.analyzeJournal(data.journal_text);

    const entryId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const newEntry: JournalEntry = {
      id: entryId,
      user_id: userId,
      journal_text: data.journal_text,
      mood: data.mood,
      sleep_hours: data.sleep_hours !== undefined ? Number(data.sleep_hours) : undefined,
      activities: data.activities || [],
      tags: data.tags || [],
      sentiment: nlpResult.sentiment,
      sentiment_score: nlpResult.sentiment_score,
      entry_date: entryDate,
      created_at: now,
      updated_at: now,
    };

    const saved = await journalRepository.create(newEntry);

    // 2. Synchronize Mood Record
    await moodRepository.recordMood(userId, data.mood, entryDate, entryId);

    // 3. Synchronize Sleep Record if provided
    if (data.sleep_hours !== undefined && data.sleep_hours > 0) {
      await sleepRepository.create({
        id: `sleep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        user_id: userId,
        journal_entry_id: entryId,
        sleep_hours: Number(data.sleep_hours),
        sleep_date: entryDate,
        notes: `Recorded with journal entry (${data.mood})`,
        created_at: now,
      });
    }

    // 4. Synchronize Activity Records if provided
    if (data.activities && data.activities.length > 0) {
      for (const actName of data.activities) {
        await activityRepository.create({
          id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          user_id: userId,
          journal_entry_id: entryId,
          activity_name: actName,
          duration: 30, // standard default session
          activity_date: entryDate,
          created_at: now,
        });
      }
    }

    // 5. Trigger automated well-being insight recalculation based on real recorded data
    await insightService.generateInsightsForUser(userId);

    return saved;
  }

  async updateEntry(id: string, userId: string, data: Partial<CreateJournalDTO>): Promise<JournalEntry | null> {
    const existing = await journalRepository.findById(id, userId);
    if (!existing) return null;

    let sentiment = existing.sentiment;
    let sentimentScore = existing.sentiment_score;

    // If text changed, rerun NLP analysis
    if (data.journal_text && data.journal_text !== existing.journal_text) {
      const nlpResult = await nlpService.analyzeJournal(data.journal_text);
      sentiment = nlpResult.sentiment;
      sentimentScore = nlpResult.sentiment_score;
    }

    const updates: Partial<JournalEntry> = {
      ...(data.journal_text !== undefined && { journal_text: data.journal_text }),
      ...(data.mood !== undefined && { mood: data.mood }),
      ...(data.sleep_hours !== undefined && { sleep_hours: Number(data.sleep_hours) }),
      ...(data.activities !== undefined && { activities: data.activities }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.entry_date !== undefined && { entry_date: data.entry_date }),
      sentiment,
      sentiment_score: sentimentScore,
      updated_at: new Date().toISOString(),
    };

    const updated = await journalRepository.update(id, userId, updates);

    // Update sleep if changed
    if (data.sleep_hours !== undefined) {
      await sleepRepository.create({
        id: `sleep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        user_id: userId,
        journal_entry_id: id,
        sleep_hours: Number(data.sleep_hours),
        sleep_date: updated?.entry_date || existing.entry_date,
        notes: `Updated from journal (${updated?.mood || existing.mood})`,
        created_at: new Date().toISOString(),
      });
    }

    // Recalculate insights
    await insightService.generateInsightsForUser(userId);

    return updated;
  }

  async deleteEntry(id: string, userId: string): Promise<boolean> {
    const success = await journalRepository.delete(id, userId);
    if (success) {
      await insightService.generateInsightsForUser(userId);
    }
    return success;
  }
}

export const journalService = new JournalService();
