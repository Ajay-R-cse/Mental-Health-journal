import { INLPAnalyzer } from './INLPAnalyzer.js';
import { StanfordCoreNLPAdapter } from './StanfordCoreNLPAdapter.js';
import { LexiconNLPAnalyzer } from './LexiconNLPAnalyzer.js';
import { SentimentAnalysisResult } from '../models/index.js';

export class NLPService {
  private analyzer: INLPAnalyzer;

  constructor(providerName?: string) {
    const provider = providerName || process.env.NLP_PROVIDER || 'hybrid';
    if (provider === 'lexicon') {
      this.analyzer = new LexiconNLPAnalyzer();
    } else {
      // Defaults to StanfordCoreNLPAdapter (which can bridge to Java Stanford CoreNLP or use the embedded pipeline)
      this.analyzer = new StanfordCoreNLPAdapter();
    }
  }

  public setAnalyzer(analyzer: INLPAnalyzer): void {
    this.analyzer = analyzer;
  }

  public async analyzeJournal(text: string): Promise<SentimentAnalysisResult> {
    return this.analyzer.analyze(text);
  }

  public getAnalyzerInfo(): { name: string; description: string } {
    return {
      name: this.analyzer.name,
      description: this.analyzer.description,
    };
  }
}

export const nlpService = new NLPService();
