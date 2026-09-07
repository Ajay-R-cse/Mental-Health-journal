import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, JournalEntry, SleepRecord, ActivityRecord, InsightRecord, MoodRecord } from '../models/index.js';

interface DatabaseSchema {
  users: User[];
  journals: JournalEntry[];
  sleep_records: SleepRecord[];
  activities: ActivityRecord[];
  insights: InsightRecord[];
  mood_records: MoodRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

class Database {
  private data: DatabaseSchema = {
    users: [],
    journals: [],
    sleep_records: [],
    activities: [],
    insights: [],
    mood_records: [],
  };

  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.seedInitialData();
        this.save();
      }
      this.initialized = true;
    } catch (err) {
      console.error('Error initializing database:', err);
      this.seedInitialData();
    }
  }

  private seedInitialData() {
    const salt = bcrypt.genSaltSync(10);
    const demoPasswordHash = bcrypt.hashSync('Wellness2026!', salt);

    const demoUser: User = {
      id: 'demo-user-001',
      name: 'Alex Morgan',
      email: 'alex.demo@wellness.com',
      password_hash: demoPasswordHash,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const today = new Date();
    const journals: JournalEntry[] = [];
    const sleepRecords: SleepRecord[] = [];
    const activities: ActivityRecord[] = [];
    const moodRecords: MoodRecord[] = [];

    // Seed 14 days of realistic wellness data
    const sampleDays = [
      {
        daysAgo: 13,
        mood: 'Happy' as const,
        sleep: 7.5,
        acts: ['Exercise', 'Reading'],
        text: 'Started the morning with a crisp 30-minute jog through the park. Feeling centered and ready for the week.',
        sentiment: 'Positive' as const,
        score: 0.78,
      },
      {
        daysAgo: 12,
        mood: 'Very Happy' as const,
        sleep: 8.0,
        acts: ['Exercise', 'Socializing'],
        text: 'Met Sarah and David for coffee after work. We laughed so much and shared our future travel goals. Deeply grateful for good friends.',
        sentiment: 'Positive' as const,
        score: 0.89,
      },
      {
        daysAgo: 11,
        mood: 'Neutral' as const,
        sleep: 6.5,
        acts: ['Studying', 'Resting'],
        text: 'Long study session preparing for the software exam. Feeling slightly drained but satisfied that I reviewed the core modules.',
        sentiment: 'Neutral' as const,
        score: 0.08,
      },
      {
        daysAgo: 10,
        mood: 'Sad' as const,
        sleep: 5.5,
        acts: ['Resting'],
        text: 'Woke up tired and struggled with focus all afternoon. Felt a bit overwhelmed by the upcoming deadline.',
        sentiment: 'Negative' as const,
        score: -0.62,
      },
      {
        daysAgo: 9,
        mood: 'Neutral' as const,
        sleep: 7.0,
        acts: ['Walking', 'Reading'],
        text: 'Took an evening walk without headphones. It helped quiet my thoughts after a noisy workday.',
        sentiment: 'Neutral' as const,
        score: 0.22,
      },
      {
        daysAgo: 8,
        mood: 'Happy' as const,
        sleep: 7.5,
        acts: ['Exercise', 'Hobbies'],
        text: 'Painted watercolor sketches for an hour. Creativity always recharges my mental energy.',
        sentiment: 'Positive' as const,
        score: 0.74,
      },
      {
        daysAgo: 7,
        mood: 'Happy' as const,
        sleep: 8.0,
        acts: ['Socializing', 'Walking'],
        text: 'Weekend farmer market visit with family. Picked up fresh peaches and enjoyed the sunshine.',
        sentiment: 'Positive' as const,
        score: 0.81,
      },
      {
        daysAgo: 6,
        mood: 'Neutral' as const,
        sleep: 7.0,
        acts: ['Studying'],
        text: 'Organized my weekly goals and cleaned my desk workspace. Moderate productivity, feeling steady.',
        sentiment: 'Neutral' as const,
        score: 0.15,
      },
      {
        daysAgo: 5,
        mood: 'Sad' as const,
        sleep: 6.0,
        acts: ['Resting'],
        text: 'Stressed by an unexpected project delay. Tried deep breathing exercises before bed to ease the tension.',
        sentiment: 'Negative' as const,
        score: -0.45,
      },
      {
        daysAgo: 4,
        mood: 'Neutral' as const,
        sleep: 7.2,
        acts: ['Walking', 'Reading'],
        text: 'Finished a chapter on mindfulness and habit loops. Feeling more patient with myself today.',
        sentiment: 'Positive' as const,
        score: 0.35,
      },
      {
        daysAgo: 3,
        mood: 'Happy' as const,
        sleep: 7.8,
        acts: ['Exercise', 'Studying'],
        text: 'Great 40-minute gym workout followed by a focused coding session. Momentum feels natural today.',
        sentiment: 'Positive' as const,
        score: 0.84,
      },
      {
        daysAgo: 2,
        mood: 'Very Happy' as const,
        sleep: 8.2,
        acts: ['Exercise', 'Socializing', 'Hobbies'],
        text: 'Celebrated completing our major milestones! Everyone was in great spirits. Felt deeply energized and thankful.',
        sentiment: 'Positive' as const,
        score: 0.92,
      },
      {
        daysAgo: 1,
        mood: 'Happy' as const,
        sleep: 7.6,
        acts: ['Walking', 'Reading'],
        text: 'A calm Sunday spent reading in the sun. Ready to tackle tomorrow with a clear mind.',
        sentiment: 'Positive' as const,
        score: 0.75,
      },
      {
        daysAgo: 0,
        mood: 'Very Happy' as const,
        sleep: 8.0,
        acts: ['Exercise', 'Studying', 'Socializing'],
        text: 'Today was productive. I completed my assignment and spent some quality time with my friends. Sleep was deep and refreshing.',
        sentiment: 'Positive' as const,
        score: 0.88,
      },
    ];

    sampleDays.forEach((day, index) => {
      const d = new Date(today);
      d.setDate(d.getDate() - day.daysAgo);
      const dateStr = d.toISOString().split('T')[0];
      const entryId = `entry-seed-${index + 1}`;

      journals.push({
        id: entryId,
        user_id: demoUser.id,
        journal_text: day.text,
        mood: day.mood,
        sleep_hours: day.sleep,
        activities: day.acts,
        tags: ['DailyReflection', day.acts[0] || 'Mindfulness'],
        sentiment: day.sentiment,
        sentiment_score: day.score,
        entry_date: dateStr,
        created_at: new Date(d.getTime() + 18 * 3600000).toISOString(),
        updated_at: new Date(d.getTime() + 18 * 3600000).toISOString(),
      });

      sleepRecords.push({
        id: `sleep-seed-${index + 1}`,
        user_id: demoUser.id,
        journal_entry_id: entryId,
        sleep_hours: day.sleep,
        sleep_date: dateStr,
        notes: `Felt ${day.sleep >= 7.5 ? 'well-rested' : 'slightly restless'} in the morning.`,
        created_at: new Date(d.getTime() + 7 * 3600000).toISOString(),
      });

      moodRecords.push({
        id: `mood-seed-${index + 1}`,
        user_id: demoUser.id,
        mood: day.mood,
        date: dateStr,
        journal_entry_id: entryId,
        created_at: new Date(d.getTime() + 12 * 3600000).toISOString(),
      });

      day.acts.forEach((act, actIdx) => {
        activities.push({
          id: `act-seed-${index + 1}-${actIdx}`,
          user_id: demoUser.id,
          journal_entry_id: entryId,
          activity_name: act,
          duration: act === 'Exercise' ? 45 : act === 'Walking' ? 30 : act === 'Studying' ? 90 : 60,
          activity_date: dateStr,
          created_at: new Date(d.getTime() + 14 * 3600000).toISOString(),
        });
      });
    });

    const insights: InsightRecord[] = [
      {
        id: 'ins-001',
        user_id: demoUser.id,
        insight_text: 'Your recorded mood was more positive on days when you logged exercise.',
        insight_type: 'correlation',
        created_at: new Date().toISOString(),
      },
      {
        id: 'ins-002',
        user_id: demoUser.id,
        insight_text: 'Your average sleep duration this week was 7.5 hours.',
        insight_type: 'summary',
        created_at: new Date().toISOString(),
      },
      {
        id: 'ins-003',
        user_id: demoUser.id,
        insight_text: 'You recorded more positive journal sentiment this week than last week.',
        insight_type: 'trend',
        created_at: new Date().toISOString(),
      },
      {
        id: 'ins-004',
        user_id: demoUser.id,
        insight_text: 'You maintained a 7-day consistent reflection streak.',
        insight_type: 'streak',
        created_at: new Date().toISOString(),
      },
    ];

    this.data = {
      users: [demoUser],
      journals,
      sleep_records: sleepRecords,
      activities,
      insights,
      mood_records: moodRecords,
    };
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  public get users() { return this.data.users; }
  public get journals() { return this.data.journals; }
  public get sleep_records() { return this.data.sleep_records; }
  public get activities() { return this.data.activities; }
  public get insights() { return this.data.insights; }
  public get mood_records() { return this.data.mood_records; }
}

export const db = new Database();
