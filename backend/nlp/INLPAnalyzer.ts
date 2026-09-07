import { SentimentAnalysisResult } from '../models/index.js';

export interface INLPAnalyzer {
  readonly name: string;
  readonly description: string;
  analyze(text: string): Promise<SentimentAnalysisResult>;
}
