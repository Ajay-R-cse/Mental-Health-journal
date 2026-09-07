import { db } from '../database/db.js';
import { JournalEntry } from '../models/index.js';

export interface JournalFilters {
  mood?: string;
  sentiment?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export class JournalRepository {
  async findByUserId(userId: string, filters?: JournalFilters): Promise<JournalEntry[]> {
    let entries = db.journals.filter((j) => j.user_id === userId);

    if (filters) {
      if (filters.mood && filters.mood !== 'all') {
        entries = entries.filter((j) => j.mood.toLowerCase() === filters.mood?.toLowerCase());
      }
      if (filters.sentiment && filters.sentiment !== 'all') {
        entries = entries.filter((j) => j.sentiment.toLowerCase() === filters.sentiment?.toLowerCase());
      }
      if (filters.startDate) {
        entries = entries.filter((j) => j.entry_date >= filters.startDate!);
      }
      if (filters.endDate) {
        entries = entries.filter((j) => j.entry_date <= filters.endDate!);
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        entries = entries.filter(
          (j) =>
            j.journal_text.toLowerCase().includes(query) ||
            j.tags?.some((t) => t.toLowerCase().includes(query)) ||
            j.activities?.some((a) => a.toLowerCase().includes(query))
        );
      }
    }

    // Sort descending by date, then created_at
    return entries.sort((a, b) => {
      const dateCmp = b.entry_date.localeCompare(a.entry_date);
      if (dateCmp !== 0) return dateCmp;
      return b.created_at.localeCompare(a.created_at);
    });
  }

  async findById(id: string, userId: string): Promise<JournalEntry | null> {
    const entry = db.journals.find((j) => j.id === id && j.user_id === userId);
    return entry || null;
  }

  async findByDate(userId: string, dateStr: string): Promise<JournalEntry | null> {
    const entry = db.journals.find((j) => j.user_id === userId && j.entry_date === dateStr);
    return entry || null;
  }

  async create(entry: JournalEntry): Promise<JournalEntry> {
    db.journals.push(entry);
    db.save();
    return entry;
  }

  async update(id: string, userId: string, updates: Partial<JournalEntry>): Promise<JournalEntry | null> {
    const index = db.journals.findIndex((j) => j.id === id && j.user_id === userId);
    if (index === -1) return null;

    db.journals[index] = {
      ...db.journals[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    db.save();
    return db.journals[index];
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const index = db.journals.findIndex((j) => j.id === id && j.user_id === userId);
    if (index === -1) return false;

    db.journals.splice(index, 1);
    
    // Also remove associated mood, sleep, and activity records linked to this journal entry
    const sleepIdx = db.sleep_records.findIndex((s) => s.journal_entry_id === id);
    if (sleepIdx !== -1) db.sleep_records.splice(sleepIdx, 1);

    const moodIdx = db.mood_records.findIndex((m) => m.journal_entry_id === id);
    if (moodIdx !== -1) db.mood_records.splice(moodIdx, 1);

    for (let i = db.activities.length - 1; i >= 0; i--) {
      if (db.activities[i].journal_entry_id === id) {
        db.activities.splice(i, 1);
      }
    }

    db.save();
    return true;
  }
}

export const journalRepository = new JournalRepository();
