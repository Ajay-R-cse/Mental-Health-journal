export type MoodType = 'Very Happy' | 'Happy' | 'Neutral' | 'Sad' | 'Very Sad';
export type SentimentType = 'Positive' | 'Neutral' | 'Negative';

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at?: string;
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
  sleep_date: string;
  notes?: string;
  created_at: string;
}

export interface ActivityRecord {
  id: string;
  user_id: string;
  journal_entry_id?: string;
  activity_name: string;
  duration?: number; // minutes
  activity_date: string;
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
  date: string;
  journal_entry_id?: string;
  created_at: string;
}

export interface SentimentAnalysisResult {
  sentiment: SentimentType;
  sentiment_score: number;
  normalized_score: number;
  word_count: number;
  positive_words: string[];
  negative_words: string[];
  provider: string;
}

export interface DashboardSummary {
  todayMood: MoodType;
  todaySleep: number;
  todayActivities: string[];
  currentSentiment: SentimentType;
  currentSentimentScore: number;
  avgSleep: number;
  latestJournal: JournalEntry | null;
  recentEntries: JournalEntry[];
  insights: InsightRecord[];
  streak: number;
  totalEntries: number;
}

export interface DashboardTrends {
  timeframeDays: number;
  moodTrend: Array<{
    date: string;
    displayDate: string;
    mood: MoodType | null;
    score: number | null;
  }>;
  sentimentTrend: Array<{
    date: string;
    displayDate: string;
    sentiment: SentimentType | null;
    score: number | null;
  }>;
  sleepTrend: Array<{
    date: string;
    displayDate: string;
    hours: number | null;
  }>;
  moodVsSleep: Array<{
    date: string;
    mood: MoodType;
    moodScore: number;
    sleepHours: number;
  }>;
  activityDistribution: Array<{
    name: string;
    count: number;
  }>;
  summary: {
    totalEntries: number;
    positiveEntries: number;
    neutralEntries: number;
    negativeEntries: number;
    averageMood: MoodType;
    averageSleep: number;
    mostFrequentActivity: string;
  };
}

export type ActiveTab =
  | 'dashboard'
  | 'journal'
  | 'analytics'
  | 'relaxation'
  | 'history'
  | 'mood'
  | 'sleep'
  | 'activities'
  | 'insights'
  | 'calendar'
  | 'profile';
