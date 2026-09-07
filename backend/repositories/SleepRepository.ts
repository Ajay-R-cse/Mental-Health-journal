import { db } from '../database/db.js';
import { SleepRecord } from '../models/index.js';

export class SleepRepository {
  async findByUserId(userId: string, startDate?: string, endDate?: string): Promise<SleepRecord[]> {
    let records = db.sleep_records.filter((s) => s.user_id === userId);

    if (startDate) {
      records = records.filter((s) => s.sleep_date >= startDate);
    }
    if (endDate) {
      records = records.filter((s) => s.sleep_date <= endDate);
    }

    return records.sort((a, b) => b.sleep_date.localeCompare(a.sleep_date));
  }

  async findById(id: string, userId: string): Promise<SleepRecord | null> {
    const record = db.sleep_records.find((s) => s.id === id && s.user_id === userId);
    return record || null;
  }

  async findByDate(userId: string, date: string): Promise<SleepRecord | null> {
    const record = db.sleep_records.find((s) => s.user_id === userId && s.sleep_date === date);
    return record || null;
  }

  async create(record: SleepRecord): Promise<SleepRecord> {
    // If a record exists for this date, update it
    const existingIdx = db.sleep_records.findIndex(
      (s) => s.user_id === record.user_id && s.sleep_date === record.sleep_date
    );

    if (existingIdx !== -1) {
      db.sleep_records[existingIdx] = {
        ...db.sleep_records[existingIdx],
        sleep_hours: record.sleep_hours,
        notes: record.notes || db.sleep_records[existingIdx].notes,
      };
      db.save();
      return db.sleep_records[existingIdx];
    }

    db.sleep_records.push(record);
    db.save();
    return record;
  }

  async update(id: string, userId: string, updates: Partial<SleepRecord>): Promise<SleepRecord | null> {
    const index = db.sleep_records.findIndex((s) => s.id === id && s.user_id === userId);
    if (index === -1) return null;

    db.sleep_records[index] = {
      ...db.sleep_records[index],
      ...updates,
    };
    db.save();
    return db.sleep_records[index];
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const index = db.sleep_records.findIndex((s) => s.id === id && s.user_id === userId);
    if (index === -1) return false;

    db.sleep_records.splice(index, 1);
    db.save();
    return true;
  }
}

export const sleepRepository = new SleepRepository();
