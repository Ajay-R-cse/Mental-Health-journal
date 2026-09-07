import { db } from '../database/db.js';
import { ActivityRecord } from '../models/index.js';

export class ActivityRepository {
  async findByUserId(userId: string, startDate?: string, endDate?: string): Promise<ActivityRecord[]> {
    let records = db.activities.filter((a) => a.user_id === userId);

    if (startDate) {
      records = records.filter((a) => a.activity_date >= startDate);
    }
    if (endDate) {
      records = records.filter((a) => a.activity_date <= endDate);
    }

    return records.sort((a, b) => b.activity_date.localeCompare(a.activity_date));
  }

  async findById(id: string, userId: string): Promise<ActivityRecord | null> {
    const record = db.activities.find((a) => a.id === id && a.user_id === userId);
    return record || null;
  }

  async create(record: ActivityRecord): Promise<ActivityRecord> {
    db.activities.push(record);
    db.save();
    return record;
  }

  async update(id: string, userId: string, updates: Partial<ActivityRecord>): Promise<ActivityRecord | null> {
    const index = db.activities.findIndex((a) => a.id === id && a.user_id === userId);
    if (index === -1) return null;

    db.activities[index] = {
      ...db.activities[index],
      ...updates,
    };
    db.save();
    return db.activities[index];
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const index = db.activities.findIndex((a) => a.id === id && a.user_id === userId);
    if (index === -1) return false;

    db.activities.splice(index, 1);
    db.save();
    return true;
  }
}

export const activityRepository = new ActivityRepository();
