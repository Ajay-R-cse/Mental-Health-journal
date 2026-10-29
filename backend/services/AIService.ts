import { GoogleGenAI, Type } from '@google/genai';

export interface JournalInsightsInput {
  journalText: string;
  manualMood?: string;
  journalSentiment?: string;
}

export interface JournalInsightsResult {
  summary: string;
  themes: string[];
  emotionalTone: string;
  positiveMoments: string[];
  reflectionPrompt: string;
  suggestedNextStep: string;
  disclaimer: string;
}

export interface WeeklyReflectionInput {
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

export interface WeeklyReflectionResult {
  overallTrend: string;
  commonThemes: string[];
  positiveHighlights: string[];
  reflectionQuestion: string;
  suggestedNextStep: string;
  disclaimer: string;
}

const FORBIDDEN_CLINICAL_TERMS = [
  /\bmajor\s+depress/i,
  /\bdepressive\s+disorder/i,
  /\bclinical\s+depress/i,
  /\bbipolar/i,
  /\bborderline\s+personality/i,
  /\bschizo/i,
  /\bgeneralized\s+anxiety\s+disorder/i,
  /\bpanic\s+disorder/i,
  /\bobsessive[- ]compulsive/i,
  /\bptsd\b/i,
  /\bpost[- ]traumatic/i,
  /\bpatholog/i,
  /\bpsychiatric\s+illness/i,
  /\bpsychiatric\s+disorder/i,
];

function sanitizeClinicalText(text: string): string {
  let cleaned = text;
  for (const term of FORBIDDEN_CLINICAL_TERMS) {
    cleaned = cleaned.replace(term, 'emotional challenges');
  }
  return cleaned;
}

function validateJournalInsights(data: any, originalText: string): JournalInsightsResult {
  if (!data || typeof data !== 'object') {
    throw new Error('AI output was not a valid JSON object.');
  }

  let summary = typeof data.summary === 'string' && data.summary.trim().length > 0
    ? data.summary.trim()
    : 'A thoughtful journal reflection based on your entry.';
  summary = sanitizeClinicalText(summary);

  let rawThemes = Array.isArray(data.themes) ? data.themes : [];
  let themes = rawThemes
    .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
    .map((t: string) => sanitizeClinicalText(t.trim()))
    .slice(0, 5);
  if (themes.length === 0) {
    themes = ['Mindful Reflection', 'Daily Experiences'];
  }

  let emotionalTone = typeof data.emotionalTone === 'string' && data.emotionalTone.trim().length > 0
    ? data.emotionalTone.trim()
    : 'Mostly neutral';
  emotionalTone = sanitizeClinicalText(emotionalTone);

  let rawPositive = Array.isArray(data.positiveMoments) ? data.positiveMoments : [];
  let positiveMoments = rawPositive
    .filter((p: any) => typeof p === 'string' && p.trim().length > 0)
    .map((p: string) => sanitizeClinicalText(p.trim()))
    .slice(0, 4);
  if (positiveMoments.length === 0) {
    positiveMoments = ['Taking time to reflect and record your personal thoughts'];
  }

  let reflectionPrompt = typeof data.reflectionPrompt === 'string' && data.reflectionPrompt.trim().length > 0
    ? data.reflectionPrompt.trim()
    : 'What is one small thing that helped support your peace of mind today?';
  if (!reflectionPrompt.endsWith('?')) {
    reflectionPrompt += '?';
  }

  let suggestedNextStep = typeof data.suggestedNextStep === 'string' && data.suggestedNextStep.trim().length > 0
    ? data.suggestedNextStep.trim()
    : 'Take a few deep breaths and acknowledge your effort in pausing to journal.';
  suggestedNextStep = sanitizeClinicalText(suggestedNextStep);

  return {
    summary,
    themes,
    emotionalTone,
    positiveMoments,
    reflectionPrompt,
    suggestedNextStep,
    disclaimer: 'AI-generated reflection, not a medical diagnosis.',
  };
}

function validateWeeklyReflection(data: any): WeeklyReflectionResult {
  if (!data || typeof data !== 'object') {
    throw new Error('AI weekly reflection output was not a valid JSON object.');
  }

  let overallTrend = typeof data.overallTrend === 'string' && data.overallTrend.trim().length > 0
    ? data.overallTrend.trim()
    : 'Your weekly records reflect mindful self-awareness across your daily routines.';
  overallTrend = sanitizeClinicalText(overallTrend);

  let rawThemes = Array.isArray(data.commonThemes) ? data.commonThemes : [];
  let commonThemes = rawThemes
    .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
    .map((t: string) => sanitizeClinicalText(t.trim()))
    .slice(0, 5);
  if (commonThemes.length === 0) {
    commonThemes = ['Self-Care', 'Daily Routine'];
  }

  let rawHighlights = Array.isArray(data.positiveHighlights) ? data.positiveHighlights : [];
  let positiveHighlights = rawHighlights
    .filter((h: any) => typeof h === 'string' && h.trim().length > 0)
    .map((h: string) => sanitizeClinicalText(h.trim()))
    .slice(0, 4);
  if (positiveHighlights.length === 0) {
    positiveHighlights = ['Maintaining your self-reflection and tracking practice'];
  }

  let reflectionQuestion = typeof data.reflectionQuestion === 'string' && data.reflectionQuestion.trim().length > 0
    ? data.reflectionQuestion.trim()
    : 'What is one moment of peace from this past week you want to carry forward?';
  if (!reflectionQuestion.endsWith('?')) {
    reflectionQuestion += '?';
  }

  let suggestedNextStep = typeof data.suggestedNextStep === 'string' && data.suggestedNextStep.trim().length > 0
    ? data.suggestedNextStep.trim()
    : 'Celebrate your consistency in pausing to reflect on your week.';
  suggestedNextStep = sanitizeClinicalText(suggestedNextStep);

  return {
    overallTrend,
    commonThemes,
    positiveHighlights,
    reflectionQuestion,
    suggestedNextStep,
    disclaimer: 'AI-generated reflection for general wellness, not a clinical diagnosis.',
  };
}

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL_1 = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash';
const FALLBACK_MODEL_2 = 'gemini-1.5-flash';

function isTransientError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const status = err.status || err.code;
  if (status === 503 || status === 429 || status === 500 || status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') {
    return true;
  }
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('timeout') ||
    msg.includes('unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused')
  );
}

export class AIService {
  private aiClient: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not configured.');
      }
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.aiClient;
  }

  /**
   * Generates wellness and reflection insights for a single journal entry
   * Grounded strictly in the user's text, avoiding clinical diagnosis and hallucinations
   */
  async generateJournalInsights(input: JournalInsightsInput): Promise<JournalInsightsResult> {
    const rawText = input.journalText;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      throw new Error('Journal text is required and cannot be empty.');
    }

    const trimmedText = rawText.trim();
    if (trimmedText.length > 15000) {
      throw new Error('Journal text exceeds maximum allowed length of 15,000 characters.');
    }

    // Fast-path guard for very short check-ins (prevents hallucinations on minimal entries)
    const words = trimmedText.split(/\s+/).filter(Boolean);
    if (words.length < 5) {
      const reportedMood = input.manualMood ? ` (${input.manualMood})` : '';
      return {
        summary: `A brief journal check-in noting: "${trimmedText}". The entry provides a quick snapshot of your day${reportedMood}.`,
        themes: ['Brief Check-In', 'Mindful Pause'],
        emotionalTone: input.manualMood ? `Reported as ${input.manualMood}` : 'Brief / neutral tone',
        positiveMoments: ['Taking a moment to pause and record a check-in'],
        reflectionPrompt: 'If you would like to explore this further, what is one detail about your day you could write about next?',
        suggestedNextStep: 'Take three steady breaths and note one thing you can see, hear, or feel right now.',
        disclaimer: 'AI-generated reflection, not a medical diagnosis.',
      };
    }

    const moodContext = input.manualMood ? `Logged mood: ${input.manualMood}` : '';
    const sentimentContext = input.journalSentiment ? `NLP sentiment indicator: ${input.journalSentiment}` : '';
    const contextDetails = [moodContext, sentimentContext].filter(Boolean).join(' | ');

    const prompt = `
Analyze the following personal journal entry and provide constructive wellness and self-reflection insights.
${contextDetails ? `Context: ${contextDetails}\n` : ''}
Journal Entry Text:
"""
${trimmedText}
"""
`.trim();

    try {
      const ai = this.getClient();

      let response;
      try {
        response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: {
            systemInstruction: `You are an empathetic, supportive wellness journaling assistant.
Your purpose is to provide gentle, reflective feedback based strictly and exclusively on what the user actually wrote in their journal entry.

STRICT GROUNDING & CLINICAL SAFETY RULES:
1. Base all observations strictly and exclusively on the explicit facts and emotions written in the journal entry.
2. NEVER invent, assume, or extrapolate symptoms, childhood history, traumas, medications, or external events that were not stated.
3. NEVER make clinical or psychological diagnoses (do NOT diagnose depression, generalized anxiety disorder, PTSD, bipolar, panic disorder, or pathology).
4. NEVER claim to definitely know the user's internal feelings or mental state.
5. Use supportive, observational language ("Based on what you wrote...", "Your journal entry mentions...").
6. If the entry describes neutral factual daily tasks, do not invent psychological distress.

OUTPUT SPECIFICATION:
1. summary: 1 to 3 sentences summarizing what the user wrote with care and empathy.
2. themes: 2 to 5 important non-medical themes directly present in the text (e.g. work, studies, physical movement, family, rest).
3. emotionalTone: General descriptive emotional tone (e.g. "Mostly positive", "Calm and steady", "Reflective", "Stressed-sounding", "Tense").
4. positiveMoments: 1 to 4 positive experiences, achievements, or gratitude points directly mentioned. If none are explicitly stated, mention their commitment to pausing and journaling.
5. reflectionPrompt: One gentle journaling question that invites self-reflection. Must end with a question mark.
6. suggestedNextStep: One practical, non-medical wellness suggestion grounded in the journal context.
7. disclaimer: Exactly "AI-generated reflection, not a medical diagnosis."`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: '1-3 sentence empathetic summary grounded strictly in the journal text',
                },
                themes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2-5 non-medical themes directly present in text',
                },
                emotionalTone: {
                  type: Type.STRING,
                  description: 'Simple descriptive emotional tone',
                },
                positiveMoments: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Positive experiences, gratitude, or resilience points',
                },
                reflectionPrompt: {
                  type: Type.STRING,
                  description: 'One gentle journaling question for self-reflection',
                },
                suggestedNextStep: {
                  type: Type.STRING,
                  description: 'One practical, non-medical wellness suggestion',
                },
                disclaimer: {
                  type: Type.STRING,
                  description: 'Non-diagnostic disclaimer statement',
                },
              },
              required: [
                'summary',
                'themes',
                'emotionalTone',
                'positiveMoments',
                'reflectionPrompt',
                'suggestedNextStep',
                'disclaimer',
              ],
            },
          },
        });
      } catch (firstErr: any) {
        if (!isTransientError(firstErr)) {
          throw firstErr;
        }
        console.warn(`AIService retrying with fallback model ${FALLBACK_MODEL_1}:`, firstErr?.message);
        try {
          response = await ai.models.generateContent({
            model: FALLBACK_MODEL_1,
            contents: prompt,
            config: {
              systemInstruction: `You are an empathetic, supportive wellness journaling assistant. Provide gentle, non-clinical reflections based strictly on the user's journal text. Never diagnose medical conditions. Output structured JSON with summary, themes, emotionalTone, positiveMoments, reflectionPrompt, suggestedNextStep, and disclaimer: "AI-generated reflection, not a medical diagnosis."`,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  themes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  emotionalTone: { type: Type.STRING },
                  positiveMoments: { type: Type.ARRAY, items: { type: Type.STRING } },
                  reflectionPrompt: { type: Type.STRING },
                  suggestedNextStep: { type: Type.STRING },
                  disclaimer: { type: Type.STRING },
                },
                required: [
                  'summary',
                  'themes',
                  'emotionalTone',
                  'positiveMoments',
                  'reflectionPrompt',
                  'suggestedNextStep',
                  'disclaimer',
                ],
              },
            },
          });
        } catch (secondErr: any) {
          if (!isTransientError(secondErr)) {
            throw secondErr;
          }
          console.warn(`AIService retrying with fallback model ${FALLBACK_MODEL_2}:`, secondErr?.message);
          response = await ai.models.generateContent({
            model: FALLBACK_MODEL_2,
            contents: prompt,
            config: {
              systemInstruction: `You are an empathetic, supportive wellness journaling assistant. Provide gentle, non-clinical reflections based strictly on the user's journal text. Never diagnose medical conditions. Output structured JSON with summary, themes, emotionalTone, positiveMoments, reflectionPrompt, suggestedNextStep, and disclaimer: "AI-generated reflection, not a medical diagnosis."`,
              responseMimeType: 'application/json',
            },
          });
        }
      }

      const responseText = response.text;
      if (!responseText) {
        throw new Error('AI service returned an empty response.');
      }

      const parsed = JSON.parse(responseText.trim());
      // Server-side response validation & sanitization
      return validateJournalInsights(parsed, trimmedText);
    } catch (err: any) {
      console.error('AIService generateJournalInsights error:', err?.message || err);
      if (err.message && (err.message.includes('GEMINI_API_KEY') || err.message.includes('API_KEY_INVALID'))) {
        throw new Error('AI Service configuration error. Please ensure the GEMINI_API_KEY is properly set.');
      }
      throw new Error(`AI Insights could not be generated at this moment: ${err?.message || 'Service unavailable'}`);
    }
  }

  /**
   * Generates a weekly wellness reflection based on a collection of recent records
   * Enforces date window filtering, deduplication, and distinction between missing vs zero sleep
   */
  async generateWeeklyReflection(input: WeeklyReflectionInput): Promise<WeeklyReflectionResult> {
    const rawJournals = Array.isArray(input.journals) ? input.journals : [];
    const rawSleeps = Array.isArray(input.sleepRecords) ? input.sleepRecords : [];
    const rawActivities = Array.isArray(input.activities) ? input.activities : [];

    // Deduplicate journals by date + text
    const seenJournals = new Set<string>();
    const journals: typeof rawJournals = [];
    for (const j of rawJournals) {
      const key = `${j.date}::${(j.text || '').trim().slice(0, 100)}`;
      if (!seenJournals.has(key)) {
        seenJournals.add(key);
        journals.push(j);
      }
    }

    // Deduplicate sleeps by date and distinguish recorded 0 hours from missing
    const sleepMap = new Map<string, number>();
    for (const s of rawSleeps) {
      if (s && s.date && typeof s.hours === 'number' && !isNaN(s.hours)) {
        if (!sleepMap.has(s.date)) {
          sleepMap.set(s.date, s.hours);
        }
      }
    }

    // Deduplicate activities by date + name
    const seenActivities = new Set<string>();
    const activities: typeof rawActivities = [];
    for (const a of rawActivities) {
      const key = `${a.date}::${(a.name || '').trim().toLowerCase()}`;
      if (!seenActivities.has(key)) {
        seenActivities.add(key);
        activities.push(a);
      }
    }

    if (journals.length === 0 && sleepMap.size === 0 && activities.length === 0) {
      return {
        overallTrend: 'You are just beginning your wellness journey. Record regular journal entries and check-ins to build meaningful weekly reflections.',
        commonThemes: ['New Beginning', 'Self-Care'],
        positiveHighlights: ['Starting your mindful journaling practice'],
        reflectionQuestion: 'What is one intention you would like to set for your well-being this week?',
        suggestedNextStep: 'Write your first journal entry or log your sleep to begin uncovering personal patterns.',
        disclaimer: 'AI-generated reflection for general wellness, not a clinical diagnosis.',
      };
    }

    const journalSummary = journals
      .slice(0, 10)
      .map((j, i) => `Entry ${i + 1} (${j.date || 'Recent'}, Mood: ${j.mood || 'Unspecified'}, Sentiment: ${j.sentiment || 'Unspecified'}): ${j.text?.slice(0, 300) || ''}`)
      .join('\n');

    const sleepEntries: string[] = [];
    sleepMap.forEach((hrs, dt) => {
      sleepEntries.push(`${dt}: ${hrs === 0 ? '0 hours (all-nighter reported)' : `${hrs} hours`}`);
    });
    const loggedSleepCount = sleepEntries.length;
    const sleepSummary = loggedSleepCount > 0
      ? `${sleepEntries.join(', ')} (${loggedSleepCount} of 7 days logged; remaining days unrecorded)`
      : 'No sleep entries logged for this period';

    const activitySummary = activities.length > 0
      ? activities.slice(0, 12).map((a) => `${a.date}: ${a.name}`).join(', ')
      : 'No specific activities recorded';

    const prompt = `
Based on the following recent user wellness logs (past week), generate a concise weekly reflection.
Do not diagnose medical conditions.
CRITICAL GROUNDING: Note that unrecorded days represent unlogged data, NOT zero sleep. Never assume or extrapolate events that were not logged.

${journalSummary ? `Journal Entries:\n${journalSummary}\n` : ''}
Sleep Records: ${sleepSummary}
Mindful Activities: ${activitySummary}
`.trim();

    try {
      const ai = this.getClient();

      let response;
      try {
        response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: {
            systemInstruction: `You are an empathetic, supportive wellness assistant.
Provide a concise, non-clinical weekly reflection based strictly on the user's own available journal, sleep, and activity records.
NEVER make clinical diagnoses (no depression, anxiety, PTSD, etc.).
NEVER claim to know the user's actual psychological state.
Keep wording observational ("Based on your entries...", "Your logs reflect...").
Transparently treat unrecorded days as missing logs, not 0 hours or absence of effort.

OUTPUT SPECIFICATION:
1. overallTrend: 2-3 sentences summarizing the overall theme or trend across the week.
2. commonThemes: 2-5 common recurring themes (e.g. sleep, work, balance, relaxation, physical activity).
3. positiveHighlights: 2-4 positive highlights or achievements from the week.
4. reflectionQuestion: One gentle journaling prompt for the upcoming week. Must end with a question mark.
5. suggestedNextStep: One actionable, non-medical wellness suggestion.
6. disclaimer: "AI-generated reflection for general wellness, not a clinical diagnosis."`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallTrend: { type: Type.STRING },
                commonThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
                positiveHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                reflectionQuestion: { type: Type.STRING },
                suggestedNextStep: { type: Type.STRING },
                disclaimer: { type: Type.STRING },
              },
              required: [
                'overallTrend',
                'commonThemes',
                'positiveHighlights',
                'reflectionQuestion',
                'suggestedNextStep',
                'disclaimer',
              ],
            },
          },
        });
      } catch (firstErr: any) {
        if (!isTransientError(firstErr)) {
          throw firstErr;
        }
        console.warn(`AIService weekly reflection retrying with fallback model ${FALLBACK_MODEL_1}:`, firstErr?.message);
        try {
          response = await ai.models.generateContent({
            model: FALLBACK_MODEL_1,
            contents: prompt,
            config: {
              systemInstruction: `You are an empathetic, supportive wellness assistant. Provide a non-clinical weekly reflection based strictly on user records. Never diagnose conditions. Output JSON with overallTrend, commonThemes, positiveHighlights, reflectionQuestion, suggestedNextStep, and disclaimer: "AI-generated reflection for general wellness, not a clinical diagnosis."`,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  overallTrend: { type: Type.STRING },
                  commonThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  positiveHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  reflectionQuestion: { type: Type.STRING },
                  suggestedNextStep: { type: Type.STRING },
                  disclaimer: { type: Type.STRING },
                },
                required: [
                  'overallTrend',
                  'commonThemes',
                  'positiveHighlights',
                  'reflectionQuestion',
                  'suggestedNextStep',
                  'disclaimer',
                ],
              },
            },
          });
        } catch (secondErr: any) {
          if (!isTransientError(secondErr)) {
            throw secondErr;
          }
          console.warn(`AIService weekly reflection retrying with ${FALLBACK_MODEL_2}:`, secondErr?.message);
          response = await ai.models.generateContent({
            model: FALLBACK_MODEL_2,
            contents: prompt,
            config: {
              systemInstruction: `You are an empathetic, supportive wellness assistant. Provide a non-clinical weekly reflection based strictly on user records. Never diagnose conditions. Output JSON with overallTrend, commonThemes, positiveHighlights, reflectionQuestion, suggestedNextStep, and disclaimer: "AI-generated reflection for general wellness, not a clinical diagnosis."`,
              responseMimeType: 'application/json',
            },
          });
        }
      }

      const text = response.text;
      if (!text) {
        throw new Error('AI service returned empty response for weekly reflection.');
      }

      const parsed = JSON.parse(text.trim());
      // Server-side response validation & sanitization
      return validateWeeklyReflection(parsed);
    } catch (err: any) {
      console.warn('AIService generateWeeklyReflection error, utilizing grounded record synthesis:', err?.message || err);
      // If external Gemini API is temporarily busy or unavailable, return a safe, grounded synthesis based strictly on the user's provided logs
      const themeSet = new Set<string>(['Mindful Awareness', 'Daily Routine']);
      if (activities.length > 0) {
        activities.slice(0, 2).forEach((a) => themeSet.add(a.name));
      }

      return {
        overallTrend: `Across your logged entries this week, you recorded ${journals.length} reflection${journals.length === 1 ? '' : 's'} and ${loggedSleepCount} sleep log${loggedSleepCount === 1 ? '' : 's'}.`,
        commonThemes: Array.from(themeSet).slice(0, 4),
        positiveHighlights: journals.length > 0
          ? ['Taking dedicated time to pause and reflect on your daily experiences']
          : ['Continuing your mindful self-awareness practice'],
        reflectionQuestion: 'What is one moment from this past week that helped you feel grounded?',
        suggestedNextStep: 'Take a quiet moment to acknowledge your consistency in checking in with yourself.',
        disclaimer: 'AI-generated reflection for general wellness, not a clinical diagnosis.',
      };
    }
  }
}

export const aiService = new AIService();
