import { journalRepository } from '../repositories/JournalRepository.js';
import { sleepRepository } from '../repositories/SleepRepository.js';
import { activityRepository } from '../repositories/ActivityRepository.js';
import { moodRepository } from '../repositories/MoodRepository.js';
import { insightService } from './InsightService.js';
import { MoodType, SentimentType } from '../models/index.js';

const MOOD_TO_NUMBER: Record<MoodType, number> = {
  'Very Happy': 5,
  'Happy': 4,
  'Neutral': 3,
  'Sad': 2,
  'Very Sad': 1,
};

const NUMBER_TO_MOOD: Record<number, MoodType> = {
  5: 'Very Happy',
  4: 'Happy',
  3: 'Neutral',
  2: 'Sad',
  1: 'Very Sad',
};

export class DashboardService {
  async getSummary(userId: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const journals = await journalRepository.findByUserId(userId);
    const sleeps = await sleepRepository.findByUserId(userId);
    const activities = await activityRepository.findByUserId(userId);
    const moods = await moodRepository.findByUserId(userId);
    const insights = await insightService.getInsights(userId);

    // Latest journal
    const latestJournal = journals.length > 0 ? journals[0] : null;

    // Today's mood (from today's mood record or latest journal today)
    const todayMoodRecord = moods.find((m) => m.date === todayStr);
    const todayMood = todayMoodRecord?.mood || (latestJournal?.entry_date === todayStr ? latestJournal.mood : (moods[0]?.mood || 'Neutral'));

    // Today's sleep
    const todaySleepRecord = sleeps.find((s) => s.sleep_date === todayStr);
    const todaySleep = todaySleepRecord ? todaySleepRecord.sleep_hours : (latestJournal?.entry_date === todayStr && latestJournal.sleep_hours ? latestJournal.sleep_hours : (sleeps[0]?.sleep_hours || 0));

    // Today's activities
    const todayActivities = activities.filter((a) => a.activity_date === todayStr).map((a) => a.activity_name);
    if (todayActivities.length === 0 && latestJournal?.entry_date === todayStr && latestJournal.activities) {
      todayActivities.push(...latestJournal.activities);
    }

    // Current sentiment
    const currentSentiment = latestJournal ? latestJournal.sentiment : 'Neutral';
    const currentSentimentScore = latestJournal ? latestJournal.sentiment_score : 0;

    // Sleep average (last 7 days)
    const now = Date.now();
    const last7DaysSleep = sleeps.filter((s) => now - new Date(s.sleep_date).getTime() <= 7 * 86400000);
    const avgSleep = last7DaysSleep.length > 0
      ? Number((last7DaysSleep.reduce((acc, s) => acc + s.sleep_hours, 0) / last7DaysSleep.length).toFixed(1))
      : 0;

    // Recent 5 entries
    const recentEntries = journals.slice(0, 5);

    // Streak
    let streak = 0;
    let checkDate = new Date();
    for (let i = 0; i < 30; i++) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (journals.some((j) => j.entry_date === dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      todayMood,
      todaySleep,
      todayActivities: Array.from(new Set(todayActivities)),
      currentSentiment,
      currentSentimentScore,
      avgSleep,
      latestJournal,
      recentEntries,
      insights,
      streak,
      totalEntries: journals.length,
    };
  }

  async getTrends(userId: string, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const journals = await journalRepository.findByUserId(userId, { startDate: cutoffStr });
    const sleeps = await sleepRepository.findByUserId(userId, cutoffStr);
    const moods = await moodRepository.findByUserId(userId, cutoffStr);
    const activities = await activityRepository.findByUserId(userId, cutoffStr);

    // Generate continuous date array for the requested timeframe
    const dateList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateList.push(d.toISOString().split('T')[0]);
    }

    // Daily trends map
    const moodTrend = dateList.map((date) => {
      const foundJournal = journals.find((j) => j.entry_date === date);
      const foundMood = moods.find((m) => m.date === date);
      const moodVal = foundMood?.mood || foundJournal?.mood;
      return {
        date,
        displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        mood: moodVal || null,
        score: moodVal ? MOOD_TO_NUMBER[moodVal] : null,
      };
    });

    const sentimentTrend = dateList.map((date) => {
      const found = journals.find((j) => j.entry_date === date);
      return {
        date,
        displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sentiment: found?.sentiment || null,
        score: found?.sentiment_score !== undefined ? found.sentiment_score : null,
      };
    });

    const sleepTrend = dateList.map((date) => {
      const found = sleeps.find((s) => s.sleep_date === date);
      const foundJournal = journals.find((j) => j.entry_date === date);
      const hours = found ? found.sleep_hours : (foundJournal?.sleep_hours || null);
      return {
        date,
        displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours,
      };
    });

    // Mood vs Sleep correlation points
    const moodVsSleep = dateList
      .map((date) => {
        const j = journals.find((x) => x.entry_date === date);
        const s = sleeps.find((x) => x.sleep_date === date);
        const m = moods.find((x) => x.date === date);
        const moodName = m?.mood || j?.mood;
        const sleepHours = s?.sleep_hours || j?.sleep_hours;

        if (moodName && sleepHours) {
          return {
            date,
            mood: moodName,
            moodScore: MOOD_TO_NUMBER[moodName],
            sleepHours,
          };
        }
        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Activity distribution
    const activityCounts: Record<string, number> = {};
    for (const act of activities) {
      activityCounts[act.activity_name] = (activityCounts[act.activity_name] || 0) + 1;
    }
    // Also include activities from journals
    for (const j of journals) {
      if (j.activities) {
        for (const a of j.activities) {
          if (!activities.some((x) => x.activity_date === j.entry_date && x.activity_name === a)) {
            activityCounts[a] = (activityCounts[a] || 0) + 1;
          }
        }
      }
    }

    const activityDistribution = Object.entries(activityCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Weekly Summary calculations
    const posCount = journals.filter((j) => j.sentiment === 'Positive').length;
    const neuCount = journals.filter((j) => j.sentiment === 'Neutral').length;
    const negCount = journals.filter((j) => j.sentiment === 'Negative').length;

    const moodNumbers = journals.map((j) => MOOD_TO_NUMBER[j.mood]).filter(Boolean);
    const avgMoodScore = moodNumbers.length > 0
      ? Math.round(moodNumbers.reduce((a, b) => a + b, 0) / moodNumbers.length)
      : 3;
    const avgMoodName = NUMBER_TO_MOOD[avgMoodScore] || 'Neutral';

    const recordedSleeps = sleeps.map((s) => s.sleep_hours);
    const avgSleepVal = recordedSleeps.length > 0
      ? Number((recordedSleeps.reduce((a, b) => a + b, 0) / recordedSleeps.length).toFixed(1))
      : 0;

    const topActivity = activityDistribution.length > 0 ? activityDistribution[0].name : 'None recorded';

    return {
      timeframeDays: days,
      moodTrend,
      sentimentTrend,
      sleepTrend,
      moodVsSleep,
      activityDistribution,
      summary: {
        totalEntries: journals.length,
        positiveEntries: posCount,
        neutralEntries: neuCount,
        negativeEntries: negCount,
        averageMood: avgMoodName,
        averageSleep: avgSleepVal,
        mostFrequentActivity: topActivity,
      },
    };
  }
}

export const dashboardService = new DashboardService();
