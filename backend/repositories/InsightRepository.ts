import { db } from '../database/db.js';
import { InsightRecord } from '../models/index.js';

export class InsightRepository {
  async findByUserId(userId: string): Promise<InsightRecord[]> {
    return db.insights
      .filter((i) => i.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async create(record: InsightRecord): Promise<InsightRecord> {
    db.insights.push(record);
    db.save();
    return record;
  }

  async replaceForUser(userId: string, newInsights: InsightRecord[]): Promise<InsightRecord[]> {
    // Filter out old insights for this user
    for (let i = db.insights.length - 1; i >= 0; i--) {
      if (db.insights[i].user_id === userId) {
        db.insights.splice(i, 1);
      }
    }
    db.insights.push(...newInsights);
    db.save();
    return newInsights;
  }
}

export const insightRepository = new InsightRepository();
