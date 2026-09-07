import { sleepRepository } from '../repositories/SleepRepository.js';
import { SleepRecord } from '../models/index.js';

export class SleepService {
  async getRecords(userId: string, startDate?: string, endDate?: string): Promise<SleepRecord[]> {
    return sleepRepository.findByUserId(userId, startDate, endDate);
  }

  async recordSleep(userId: string, data: { sleep_hours: number; sleep_date?: string; notes?: string; journal_entry_id?: string }): Promise<SleepRecord> {
    const sleepDate = data.sleep_date || new Date().toISOString().split('T')[0];
    const record: SleepRecord = {
      id: `sleep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      journal_entry_id: data.journal_entry_id,
      sleep_hours: Number(data.sleep_hours),
      sleep_date: sleepDate,
      notes: data.notes || '',
      created_at: new Date().toISOString(),
    };

    return sleepRepository.create(record);
  }

  async updateSleep(id: string, userId: string, updates: Partial<SleepRecord>): Promise<SleepRecord | null> {
    return sleepRepository.update(id, userId, updates);
  }

  async deleteSleep(id: string, userId: string): Promise<boolean> {
    return sleepRepository.delete(id, userId);
  }

  async getSleepAverages(userId: string): Promise<{
    today: number;
    weeklyAvg: number;
    monthlyAvg: number;
    totalRecords: number;
  }> {
    const records = await sleepRepository.findByUserId(userId);
    const todayStr = new Date().toISOString().split('T')[0];

    const todayRecord = records.find((r) => r.sleep_date === todayStr);
    const today = todayRecord ? todayRecord.sleep_hours : (records.length > 0 ? records[0].sleep_hours : 0);

    const now = Date.now();
    const last7Days = records.filter((r) => now - new Date(r.sleep_date).getTime() <= 7 * 86400000);
    const last30Days = records.filter((r) => now - new Date(r.sleep_date).getTime() <= 30 * 86400000);

    const weeklyAvg = last7Days.length > 0
      ? Number((last7Days.reduce((acc, r) => acc + r.sleep_hours, 0) / last7Days.length).toFixed(1))
      : 0;

    const monthlyAvg = last30Days.length > 0
      ? Number((last30Days.reduce((acc, r) => acc + r.sleep_hours, 0) / last30Days.length).toFixed(1))
      : 0;

    return {
      today,
      weeklyAvg,
      monthlyAvg,
      totalRecords: records.length,
    };
  }
}

export const sleepService = new SleepService();
