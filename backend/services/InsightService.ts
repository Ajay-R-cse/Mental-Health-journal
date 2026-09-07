import { insightRepository } from '../repositories/InsightRepository.js';
import { journalRepository } from '../repositories/JournalRepository.js';
import { sleepRepository } from '../repositories/SleepRepository.js';
import { activityRepository } from '../repositories/ActivityRepository.js';
import { InsightRecord, MoodType } from '../models/index.js';

const MOOD_VALUES: Record<MoodType, number> = {
  'Very Happy': 5,
  'Happy': 4,
  'Neutral': 3,
  'Sad': 2,
  'Very Sad': 1,
};

export class InsightService {
  async getInsights(userId: string): Promise<InsightRecord[]> {
    let insights = await insightRepository.findByUserId(userId);
    if (insights.length === 0) {
      insights = await this.generateInsightsForUser(userId);
    }
    return insights;
  }

  async generateInsightsForUser(userId: string): Promise<InsightRecord[]> {
    const journals = await journalRepository.findByUserId(userId);
    const sleeps = await sleepRepository.findByUserId(userId);
    const activities = await activityRepository.findByUserId(userId);

    const generated: InsightRecord[] = [];
    const now = new Date().toISOString();

    if (journals.length === 0 && sleeps.length === 0) {
      return [
        {
          id: `ins-welcome-${Date.now()}`,
          user_id: userId,
          insight_text: 'Welcome to your mindful journal. Record your first entry to discover personal data-based patterns.',
          insight_type: 'summary',
          created_at: now,
        },
      ];
    }

    // 1. Sleep Duration Pattern
    if (sleeps.length > 0) {
      const recent7Sleeps = sleeps.slice(0, 7);
      const avgSleep7 = (recent7Sleeps.reduce((acc, s) => acc + s.sleep_hours, 0) / recent7Sleeps.length).toFixed(1);
      generated.push({
        id: `ins-sleep-${Date.now()}-1`,
        user_id: userId,
        insight_text: `Your average recorded sleep duration over the last ${recent7Sleeps.length} recorded night(s) was ${avgSleep7} hours.`,
        insight_type: 'summary',
        created_at: now,
      });
    }

    // 2. Activity Correlation with Mood
    if (journals.length >= 3 && activities.length > 0) {
      // Find days with specific activities (e.g. Exercise or Walking)
      const exerciseDates = new Set(
        activities
          .filter((a) => ['exercise', 'walking', 'socializing'].includes(a.activity_name.toLowerCase()))
          .map((a) => a.activity_date)
      );

      const entriesWithActive = journals.filter((j) => exerciseDates.has(j.entry_date) || (j.activities && j.activities.some((act) => ['exercise', 'walking', 'socializing'].includes(act.toLowerCase()))));
      const entriesWithoutActive = journals.filter((j) => !entriesWithActive.includes(j));

      if (entriesWithActive.length > 0) {
        const avgMoodWith = entriesWithActive.reduce((acc, j) => acc + (MOOD_VALUES[j.mood] || 3), 0) / entriesWithActive.length;
        const avgMoodWithout = entriesWithoutActive.length > 0
          ? entriesWithoutActive.reduce((acc, j) => acc + (MOOD_VALUES[j.mood] || 3), 0) / entriesWithoutActive.length
          : avgMoodWith;

        if (avgMoodWith >= avgMoodWithout) {
          generated.push({
            id: `ins-act-${Date.now()}-2`,
            user_id: userId,
            insight_text: 'Your recorded mood was more positive on days when you logged physical activity or social connection.',
            insight_type: 'correlation',
            created_at: now,
          });
        }
      }
    }

    // 3. Weekly Sentiment Trend Comparison
    if (journals.length >= 2) {
      const nowMs = Date.now();
      const thisWeekEntries = journals.filter((j) => (nowMs - new Date(j.entry_date).getTime()) <= 7 * 86400000);
      const prevWeekEntries = journals.filter((j) => {
        const diff = nowMs - new Date(j.entry_date).getTime();
        return diff > 7 * 86400000 && diff <= 14 * 86400000;
      });

      if (thisWeekEntries.length > 0) {
        const thisWeekPos = thisWeekEntries.filter((j) => j.sentiment === 'Positive').length;
        const thisWeekRatio = thisWeekPos / thisWeekEntries.length;

        if (prevWeekEntries.length > 0) {
          const prevWeekPos = prevWeekEntries.filter((j) => j.sentiment === 'Positive').length;
          const prevWeekRatio = prevWeekPos / prevWeekEntries.length;

          if (thisWeekRatio >= prevWeekRatio) {
            generated.push({
              id: `ins-sent-${Date.now()}-3`,
              user_id: userId,
              insight_text: 'You recorded more positive journal sentiment this week compared to previous logged periods.',
              insight_type: 'trend',
              created_at: now,
            });
          }
        } else if (thisWeekRatio >= 0.5) {
          generated.push({
            id: `ins-sent-${Date.now()}-3`,
            user_id: userId,
            insight_text: `Over ${(thisWeekRatio * 100).toFixed(0)}% of your journal entries this week expressed positive reflections.`,
            insight_type: 'trend',
            created_at: now,
          });
        }
      }
    }

    // 4. Streak / Consistency
    if (journals.length >= 1) {
      // Calculate streak
      let streak = 0;
      const today = new Date().toISOString().split('T')[0];
      let checkDate = new Date();

      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasEntry = journals.some((j) => j.entry_date === dateStr);
        if (hasEntry) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i === 0) {
          // If no entry today yet, check yesterday
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      if (streak >= 2) {
        generated.push({
          id: `ins-streak-${Date.now()}-4`,
          user_id: userId,
          insight_text: `You have maintained an active journaling reflection streak of ${streak} consecutive days.`,
          insight_type: 'streak',
          created_at: now,
        });
      }
    }

    // 5. Sleep vs Mood observation
    const sleepMoodPairs = journals
      .filter((j) => j.sleep_hours && j.sleep_hours > 0)
      .map((j) => ({
        hours: j.sleep_hours!,
        moodScore: MOOD_VALUES[j.mood] || 3,
      }));

    if (sleepMoodPairs.length >= 3) {
      const wellRested = sleepMoodPairs.filter((p) => p.hours >= 7.5);
      const lessRested = sleepMoodPairs.filter((p) => p.hours < 7.0);

      if (wellRested.length > 0 && lessRested.length > 0) {
        const avgRestedMood = wellRested.reduce((acc, p) => acc + p.moodScore, 0) / wellRested.length;
        const avgLessMood = lessRested.reduce((acc, p) => acc + p.moodScore, 0) / lessRested.length;

        if (avgRestedMood > avgLessMood) {
          generated.push({
            id: `ins-sleepmood-${Date.now()}-5`,
            user_id: userId,
            insight_text: 'Days with 7.5+ hours of recorded sleep corresponded with higher reported mood scores.',
            insight_type: 'correlation',
            created_at: now,
          });
        }
      }
    }

    // Replace and persist
    return insightRepository.replaceForUser(userId, generated);
  }
}

export const insightService = new InsightService();
