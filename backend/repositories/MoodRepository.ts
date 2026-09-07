import { db } from '../database/db.js';
import { MoodRecord, MoodType } from '../models/index.js';

export class MoodRepository {
  async findByUserId(userId: string, startDate?: string, endDate?: string): Promise<MoodRecord[]> {
    let records = db.mood_records.filter((m) => m.user_id === userId);

    if (startDate) {
      records = records.filter((m) => m.date >= startDate);
    }
    if (endDate) {
      records = records.filter((m) => m.date <= endDate);
    }

    return records.sort((a, b) => b.date.localeCompare(a.date));
  }

  async findByDate(userId: string, date: string): Promise<MoodRecord | null> {
    const record = db.mood_records.find((m) => m.user_id === userId && m.date === date);
    return record || null;
  }

  async recordMood(userId: string, mood: MoodType, date: string, journalEntryId?: string): Promise<MoodRecord> {
    const existingIdx = db.mood_records.findIndex((m) => m.user_id === userId && m.date === date);

    if (existingIdx !== -1) {
      db.mood_records[existingIdx].mood = mood;
      if (journalEntryId) {
        db.mood_records[existingIdx].journal_entry_id = journalEntryId;
      }
      db.save();
      return db.mood_records[existingIdx];
    }

    const newRecord: MoodRecord = {
      id: `mood-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      mood,
      date,
      journal_entry_id: journalEntryId,
      created_at: new Date().toISOString(),
    };

    db.mood_records.push(newRecord);
    db.save();
    return newRecord;
  }
}

export const moodRepository = new MoodRepository();
