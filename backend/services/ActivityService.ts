import { activityRepository } from '../repositories/ActivityRepository.js';
import { ActivityRecord } from '../models/index.js';

export class ActivityService {
  async getActivities(userId: string, startDate?: string, endDate?: string): Promise<ActivityRecord[]> {
    return activityRepository.findByUserId(userId, startDate, endDate);
  }

  async recordActivity(userId: string, data: { activity_name: string; duration?: number; activity_date?: string; journal_entry_id?: string }): Promise<ActivityRecord> {
    const activityDate = data.activity_date || new Date().toISOString().split('T')[0];
    const record: ActivityRecord = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      journal_entry_id: data.journal_entry_id,
      activity_name: data.activity_name.trim(),
      duration: data.duration !== undefined ? Number(data.duration) : 30,
      activity_date: activityDate,
      created_at: new Date().toISOString(),
    };

    return activityRepository.create(record);
  }

  async updateActivity(id: string, userId: string, updates: Partial<ActivityRecord>): Promise<ActivityRecord | null> {
    return activityRepository.update(id, userId, updates);
  }

  async deleteActivity(id: string, userId: string): Promise<boolean> {
    return activityRepository.delete(id, userId);
  }

  async getActivityFrequencies(userId: string, days = 30): Promise<{ name: string; count: number; totalMinutes: number }[]> {
    const now = Date.now();
    const records = await activityRepository.findByUserId(userId);
    const filtered = records.filter((r) => now - new Date(r.activity_date).getTime() <= days * 86400000);

    const counts: Record<string, { count: number; totalMinutes: number }> = {};
    for (const item of filtered) {
      const name = item.activity_name;
      if (!counts[name]) {
        counts[name] = { count: 0, totalMinutes: 0 };
      }
      counts[name].count += 1;
      counts[name].totalMinutes += item.duration || 30;
    }

    return Object.entries(counts)
      .map(([name, val]) => ({ name, count: val.count, totalMinutes: val.totalMinutes }))
      .sort((a, b) => b.count - a.count);
  }
}

export const activityService = new ActivityService();
