package com.wellness.nlp.service;

import com.wellness.nlp.model.SentimentResponse;
import edu.stanford.nlp.ling.CoreAnnotations;
import edu.stanford.nlp.neural.rnn.RNNCoreAnnotations;
import edu.stanford.nlp.pipeline.CoreDocument;
import edu.stanford.nlp.pipeline.CoreSentence;
import edu.stanford.nlp.pipeline.StanfordCoreNLP;
import edu.stanford.nlp.sentiment.SentimentCoreAnnotations;
import edu.stanford.nlp.trees.Tree;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
public class CoreNlpSentimentService {

    private static final Logger log = LoggerFactory.getLogger(CoreNlpSentimentService.class);
    private static final String PROVIDER_NAME = "Stanford CoreNLP Java Microservice";

    @Value("${nlp.stanford.annotators:tokenize,ssplit,parse,sentiment}")
    private String annotators;

    private StanfordCoreNLP pipeline;

    @PostConstruct
    public void initialize() {
        log.info("Initializing Stanford CoreNLP pipeline with annotators: {}", annotators);
        Properties props = new Properties();
        props.setProperty("annotators", annotators);
        // Optimize parser for memory/speed while preserving sentiment accuracy
        props.setProperty("parse.model", "edu/stanford/nlp/models/lexparser/englishPCFG.ser.gz");
        this.pipeline = new StanfordCoreNLP(props);
        log.info("Stanford CoreNLP pipeline initialized successfully.");
    }

    /**
     * Analyze text sentiment using Stanford CoreNLP Recursive Neural Network (RNN)
     * sentiment models over parse trees.
     *
     * Stanford CoreNLP sentiment classes:
     * 0: Very Negative
     * 1: Negative
     * 2: Neutral
     * 3: Positive
     * 4: Very Positive
     */
    private static final Set<String> NEGATION_TOKENS = Set.of(
            "not", "never", "no", "n't", "neither", "nor", "barely", "hardly",
            "without", "cant", "can't", "wont", "won't", "dont", "don't",
            "didnt", "didn't", "wasnt", "wasn't", "isnt", "isn't", "arent", "aren't",
            "couldnt", "couldn't", "havent", "haven't", "hadnt", "hadn't"
    );

    private static final Set<String> INTENSIFIER_TOKENS = Set.of(
            "very", "extremely", "really", "super", "totally", "completely",
            "absolutely", "immensely", "deeply", "incredibly", "exceptionally", "still"
    );

    private static final java.util.regex.Pattern SARCASM_PATTERN = java.util.regex.Pattern.compile(
            "(?i)\\b(oh\\s+great|just\\s+great|just\\s+wonderful|yeah\\s+right|thanks\\s+a\\s+lot|as\\s+if)\\b"
    );

    private static final java.util.regex.Pattern CONTRAST_PATTERN = java.util.regex.Pattern.compile(
            "(?i)\\b(but|however|yet|nevertheless|although|even\\s+though)\\b"
    );

    private static final java.util.regex.Pattern CONCURRENCE_PATTERN = java.util.regex.Pattern.compile(
            "(?i)\\b(at the same time|mixed feelings|both|bittersweet|conflicted|part of me)\\b"
    );

    private static final java.util.regex.Pattern TEMPORAL_CESSATION_PATTERN = java.util.regex.Pattern.compile(
            "(?i)\\b(anymore|no longer|not anymore)\\b"
    );

    private static final java.util.regex.Pattern TEMPORAL_CONTINUATION_PATTERN = java.util.regex.Pattern.compile(
            "(?i)\\b(still|yet|ongoing)\\b"
    );

    /**
     * Analyze text sentiment using Stanford CoreNLP Recursive Neural Network (RNN)
     * sentiment models over parse trees, enriched with contextual linguistic rules:
     * - Preserves sentence context and compositional parse tree semantics
     * - Strict negation handling (e.g. "not happy" is never classified as positive)
     * - Contrastive clause weighting (e.g. "passed exam, but feel disappointed")
     * - Sarcasm and ambiguous language detection
     * - Short context and neutral factual statement detection without manufactured confidence
     */
    public SentimentResponse analyzeSentiment(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new SentimentResponse("Neutral", 0.0, PROVIDER_NAME, Collections.emptyList());
        }

        String trimmed = text.trim();
        String[] words = trimmed.split("\\s+");

        // Fast-path guard: Very short factual entries without sentiment indicators
        if (words.length <= 3 && !trimmed.contains("!") && !trimmed.contains("?")) {
            String lower = trimmed.toLowerCase();
            boolean hasEmotionalMarker = lower.contains("happy") || lower.contains("sad") ||
                    lower.contains("depressed") || lower.contains("anxious") ||
                    lower.contains("joy") || lower.contains("terrible") ||
                    lower.contains("excited") || lower.contains("angry");
            if (!hasEmotionalMarker) {
                return new SentimentResponse("Neutral", 0.0, PROVIDER_NAME, Collections.emptyList());
            }
        }

        CoreDocument document = new CoreDocument(trimmed);
        pipeline.annotate(document);

        List<CoreSentence> sentences = document.sentences();
        if (sentences == null || sentences.isEmpty()) {
            return new SentimentResponse("Neutral", 0.0, PROVIDER_NAME, Collections.emptyList());
        }

        double weightedClassSum = 0.0;
        double totalSentenceWeight = 0.0;
        List<String> emotionalKeywords = new ArrayList<>();
        int positiveSignals = 0;
        int negativeSignals = 0;

        Set<String> positiveMarkers = Set.of(
                "calm", "productive", "peaceful", "happy", "grateful", "joy",
                "excited", "inspired", "energized", "relaxed", "serene", "accomplished",
                "content", "better", "clear", "great", "wonderful", "good", "excellent",
                "relieved", "blessed", "glad", "supported", "support", "friends", "friend",
                "passed", "pass", "okay", "ok"
        );
        Set<String> negativeMarkers = Set.of(
                "anxious", "stressed", "sad", "tired", "depressed", "overwhelmed",
                "exhausted", "down", "frustrated", "frustrating", "worried", "angry", "terrible",
                "bad", "lonely", "difficult", "hurt", "hopeless", "disappointed", "dreadful",
                "delay", "delayed", "ruined", "ruin"
        );

        boolean hasSarcasticCue = SARCASM_PATTERN.matcher(trimmed).find();
        boolean hasTemporalCessation = TEMPORAL_CESSATION_PATTERN.matcher(trimmed).find();

        for (CoreSentence sentence : sentences) {
            String sentenceText = sentence.text();
            Tree sentimentTree = sentence.coreMap().get(SentimentCoreAnnotations.SentimentAnnotatedTree.class);
            int predictedClass = 2; // Default to neutral (0: V.Neg, 1: Neg, 2: Neu, 3: Pos, 4: V.Pos)
            if (sentimentTree != null) {
                predictedClass = RNNCoreAnnotations.getPredictedClass(sentimentTree);
            }

            // Inspect CoreNLP sentence sentiment label
            String sentenceSentiment = sentence.sentiment();
            if ("Very positive".equalsIgnoreCase(sentenceSentiment)) {
                predictedClass = Math.max(predictedClass, 4);
            } else if ("Positive".equalsIgnoreCase(sentenceSentiment)) {
                predictedClass = Math.max(predictedClass, 3);
            } else if ("Very negative".equalsIgnoreCase(sentenceSentiment)) {
                predictedClass = Math.min(predictedClass, 0);
            } else if ("Negative".equalsIgnoreCase(sentenceSentiment)) {
                predictedClass = Math.min(predictedClass, 1);
            }

            // Handle contrastive conjunctions within sentence ("passed exam, but feel disappointed")
            boolean hasContrast = CONTRAST_PATTERN.matcher(sentenceText).find();
            int contrastIndex = -1;
            List<String> tokens = sentence.tokensAsStrings();

            for (int i = 0; i < tokens.size(); i++) {
                String tokenLower = tokens.get(i).toLowerCase();
                if (tokenLower.equals("but") || tokenLower.equals("however") || tokenLower.equals("yet")) {
                    contrastIndex = i;
                    break;
                }
            }

            // Check for negation, intensifiers, and clause positioning
            for (int i = 0; i < tokens.size(); i++) {
                String token = tokens.get(i).toLowerCase();

                // Check 3 tokens prior for negation
                boolean isNegated = false;
                boolean isIntensified = false;
                for (int j = Math.max(0, i - 3); j < i; j++) {
                    String prior = tokens.get(j).toLowerCase();
                    if (NEGATION_TOKENS.contains(prior)) {
                        isNegated = !isNegated;
                    }
                    if (INTENSIFIER_TOKENS.contains(prior)) {
                        isIntensified = true;
                    }
                }

                boolean inPostContrastClause = (contrastIndex >= 0 && i > contrastIndex);
                int weightMultiplier = inPostContrastClause ? 2 : 1;

                if (positiveMarkers.contains(token)) {
                    if (isNegated) {
                        // "not happy", "never calm" -> Negation of positive expresses negative/dissatisfied state
                        negativeSignals += (hasTemporalCessation ? 3 : 2) * weightMultiplier;
                        // Do NOT add to emotionalKeywords as a positive word!
                    } else if (hasSarcasticCue) {
                        // Sarcasm flips positive marker to negative
                        negativeSignals += weightMultiplier;
                    } else {
                        emotionalKeywords.add(token);
                        positiveSignals += (isIntensified ? 2 : 1) * weightMultiplier;
                    }
                } else if (negativeMarkers.contains(token)) {
                    if (isNegated) {
                        // "not sad", "not worried", "no stress" -> Negation of negative expresses absence of negative emotion (mild relief/equanimity)
                        // It does not constitute active joyful or strongly positive affect unless paired with explicit positive tokens
                        positiveSignals += 1;
                        emotionalKeywords.add("absence of " + token);
                    } else {
                        emotionalKeywords.add(token);
                        negativeSignals += (isIntensified ? 2 : 1) * weightMultiplier;
                    }
                }
            }

            // If a sentence has a contrastive clause ("..., but feel disappointed"),
            // ensure the contrastive clause dominates the sentence classification
            if (hasContrast && contrastIndex >= 0) {
                // If negative signals appeared after 'but', pull predicted class down
                if (negativeSignals > positiveSignals && predictedClass >= 2) {
                    predictedClass = 1;
                }
            }

            // If negation flipped the sentiment completely ("I am not happy")
            if (negativeSignals > 0 && positiveSignals == 0 && predictedClass >= 2) {
                predictedClass = 1;
            }

            // Sentence weight based on emotional salience (emotional sentences have higher weight than factual ones)
            double salienceWeight = 1.0 + Math.abs(predictedClass - 2.0) * 1.5;
            weightedClassSum += predictedClass * salienceWeight;
            totalSentenceWeight += salienceWeight;
        }

        double avgClass = totalSentenceWeight > 0 ? (weightedClassSum / totalSentenceWeight) : 2.0;

        // Contextual adjustment from verified negation & token signals
        if (negativeSignals > positiveSignals && avgClass > 1.8) {
            avgClass = Math.max(0.5, avgClass - 0.5 * Math.min(3, negativeSignals - positiveSignals));
        } else if (positiveSignals > negativeSignals && avgClass < 2.2) {
            avgClass = Math.min(3.5, avgClass + 0.5 * Math.min(3, positiveSignals - negativeSignals));
        }

        // Convert 0..4 scale to normalized score (-1.0 to +1.0)
        // 0 -> -1.0, 1 -> -0.5, 2 -> 0.0, 3 -> +0.5, 4 -> +1.0
        double rawScore = (avgClass - 2.0) / 2.0;
        // Bounded strictly between -1.0 and +1.0
        rawScore = Math.max(-1.0, Math.min(1.0, rawScore));
        double roundedScore = BigDecimal.valueOf(rawScore)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        // Neutral / uncertain / mixed boundaries (avoids manufactured false polarity)
        boolean hasBothValences = positiveSignals > 0 && negativeSignals > 0;
        boolean hasConcurrence = CONCURRENCE_PATTERN.matcher(trimmed).find();
        boolean hasExplicitPositive = emotionalKeywords.stream().anyMatch(positiveMarkers::contains);

        String sentimentLabel;
        if (hasBothValences && (hasConcurrence || (hasContrast && roundedScore > -0.5))) {
            sentimentLabel = "Mixed";
        } else if (roundedScore >= 0.18) {
            if (!hasExplicitPositive && roundedScore < 0.35) {
                sentimentLabel = "Neutral";
            } else {
                sentimentLabel = "Positive";
            }
        } else if (roundedScore <= -0.18) {
            sentimentLabel = "Negative";
        } else {
            sentimentLabel = "Neutral";
            // For neutral classification with minimal signal, ground score close to zero
            if (positiveSignals == 0 && negativeSignals == 0) {
                roundedScore = 0.0;
            }
        }

        // Deduplicate keywords
        List<String> distinctKeywords = new ArrayList<>(new LinkedHashSet<>(emotionalKeywords));

        log.debug("Analyzed text: avgClass={}, score={}, sentiment={}, keywords={}",
                avgClass, roundedScore, sentimentLabel, distinctKeywords);

        return new SentimentResponse(sentimentLabel, roundedScore, PROVIDER_NAME, distinctKeywords);
    }
}
