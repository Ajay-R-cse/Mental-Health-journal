export type MoodType = 'Very Happy' | 'Happy' | 'Neutral' | 'Sad' | 'Very Sad';
export type SentimentType = 'Positive' | 'Neutral' | 'Negative';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  journal_text: string;
  mood: MoodType;
  sleep_hours?: number;
  activities?: string[];
  tags?: string[];
  sentiment: SentimentType;
  sentiment_score: number;
  entry_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface SleepRecord {
  id: string;
  user_id: string;
  journal_entry_id?: string;
  sleep_hours: number;
  sleep_date: string; // YYYY-MM-DD
  notes?: string;
  created_at: string;
}

export interface ActivityRecord {
  id: string;
  user_id: string;
  journal_entry_id?: string;
  activity_name: string;
  duration?: number; // in minutes
  activity_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface InsightRecord {
  id: string;
  user_id: string;
  insight_text: string;
  insight_type: 'correlation' | 'summary' | 'trend' | 'streak';
  created_at: string;
}

export interface MoodRecord {
  id: string;
  user_id: string;
  mood: MoodType;
  date: string; // YYYY-MM-DD
  journal_entry_id?: string;
  created_at: string;
}

export interface SentimentAnalysisResult {
  sentiment: SentimentType;
  sentiment_score: number; // e.g. -1.0 to 1.0 or 0 to 1
  normalized_score: number; // 0.0 to 1.0
  word_count: number;
  positive_words: string[];
  negative_words: string[];
  provider: string;
}
