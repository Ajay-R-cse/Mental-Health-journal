export type MoodType = 'Very Happy' | 'Happy' | 'Neutral' | 'Sad' | 'Very Sad';
export type SentimentType = 'Positive' | 'Neutral' | 'Negative' | 'Mixed';

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

export type CameraExpressionType =
  | 'Visible upward mouth curvature'
  | 'Visible brow tension pattern'
  | 'Subtle resting facial alignment'
  | 'Unable to estimate reliably'
  | 'Positive / pleasant expression'
  | 'Neutral expression'
  | 'Concerned / tense-looking expression'
  | 'Tired-looking expression'
  | 'Mixed/uncertain';

export type VoiceStateEstimateType =
  | 'Steady amplitude with balanced pace'
  | 'Dynamic modulation with varied pitch'
  | 'Gentle vocal energy with extended pauses'
  | 'Elevated pitch variation with rapid pace'
  | 'Acoustic observation only / balanced'
  | 'Uncertain: audio duration too short'
  | 'Uncertain: low audio signal or noisy'
  | 'Calm-sounding'
  | 'Energetic-sounding'
  | 'Tired-sounding'
  | 'Tense-sounding'
  | 'Neutral/uncertain';

export interface CameraAnalysisResult {
  estimatedExpression: CameraExpressionType;
  confidence: number; // Quantitative signal clarity (0.0 - 1.0)
  signalQuality?: 'Clear' | 'Moderate' | 'Low' | 'Insufficient';
  isReliable?: boolean;
  reliabilityReason?: string;
  observableMetrics?: {
    smileLikelihood: number;
    openEyeScore: number;
    browTensionScore: number;
    symmetryScore: number;
    lightingQuality: string;
  };
  disclaimer: string;
}

export interface VoiceAnalysisResult {
  estimatedVocalState: VoiceStateEstimateType;
  confidence: number; // Acoustic signal clarity (0.0 - 1.0)
  signalQuality?: 'Clear' | 'Moderate' | 'Low' | 'Insufficient';
  isReliable?: boolean;
  reliabilityReason?: string;
  acousticMetrics?: {
    speakingPace: string;
    volumeVariation: string;
    pitchVariation: string;
    pauseRatio: number;
    vocalEnergy: string;
  };
  disclaimer: string;
}

export interface MoodCheckRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  journalEntryId?: string;
  manualMood?: MoodType | string;
  cameraEstimate?: string;
  cameraConfidence?: number;
  voiceEstimate?: string;
  voiceConfidence?: number;
  journalSentiment?: SentimentType | string;
  createdAt: string;
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
  | 'mood-check'
  | 'mood'
  | 'sleep'
  | 'activities'
  | 'insights'
  | 'calendar'
  | 'profile';

export interface AIJournalInsight {
  id: string;
  userId: string;
  journalEntryId: string;
  summary: string;
  themes: string[];
  emotionalTone: string;
  positiveMoments: string[];
  reflectionPrompt: string;
  suggestedNextStep: string;
  disclaimer: string;
  createdAt: string;
}

export interface AIJournalInsightsRequest {
  journalText: string;
  manualMood?: string;
  journalSentiment?: string;
}

export interface AIJournalInsightsResponse {
  summary: string;
  themes: string[];
  emotionalTone: string;
  positiveMoments: string[];
  reflectionPrompt: string;
  suggestedNextStep: string;
  disclaimer: string;
}

export interface AIWeeklyReflection {
  id?: string;
  userId?: string;
  overallTrend: string;
  commonThemes: string[];
  positiveHighlights: string[];
  reflectionQuestion: string;
  suggestedNextStep: string;
  disclaimer: string;
  createdAt?: string;
}

export interface AIWeeklyReflectionRequest {
  journals: Array<{
    date: string;
    text: string;
    mood?: string;
    sentiment?: string;
  }>;
  sleepRecords?: Array<{
    date: string;
    hours: number;
  }>;
  activities?: Array<{
    date: string;
    name: string;
  }>;
}

export interface AIWeeklyReflectionResponse {
  overallTrend: string;
  commonThemes: string[];
  positiveHighlights: string[];
  reflectionQuestion: string;
  suggestedNextStep: string;
  disclaimer: string;
}

