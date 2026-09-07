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
    public SentimentResponse analyzeSentiment(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new SentimentResponse("Neutral", 0.0, PROVIDER_NAME, Collections.emptyList());
        }

        CoreDocument document = new CoreDocument(text.trim());
        pipeline.annotate(document);

        List<CoreSentence> sentences = document.sentences();
        if (sentences == null || sentences.isEmpty()) {
            return new SentimentResponse("Neutral", 0.0, PROVIDER_NAME, Collections.emptyList());
        }

        double totalClassValue = 0.0;
        List<String> emotionalKeywords = new ArrayList<>();

        for (CoreSentence sentence : sentences) {
            Tree sentimentTree = sentence.coreMap().get(SentimentCoreAnnotations.SentimentAnnotatedTree.class);
            int predictedClass = 2; // Default to neutral
            if (sentimentTree != null) {
                predictedClass = RNNCoreAnnotations.getPredictedClass(sentimentTree);
            }
            totalClassValue += predictedClass;

            // Extract emotional tokens identified during parsing
            extractSentenceKeywords(sentence, predictedClass, emotionalKeywords);
        }

        double avgClass = totalClassValue / sentences.size();

        // Convert 0..4 scale to normalized score (-1.0 to +1.0)
        // 0 -> -1.0, 1 -> -0.5, 2 -> 0.0, 3 -> +0.5, 4 -> +1.0
        double rawScore = (avgClass - 2.0) / 2.0;
        double roundedScore = BigDecimal.valueOf(rawScore)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        String sentimentLabel;
        if (avgClass >= 2.3) {
            sentimentLabel = "Positive";
        } else if (avgClass <= 1.7) {
            sentimentLabel = "Negative";
        } else {
            sentimentLabel = "Neutral";
        }

        // Deduplicate keywords
        List<String> distinctKeywords = new ArrayList<>(new LinkedHashSet<>(emotionalKeywords));

        log.debug("Analyzed text: avgClass={}, score={}, sentiment={}, keywords={}",
                avgClass, roundedScore, sentimentLabel, distinctKeywords);

        return new SentimentResponse(sentimentLabel, roundedScore, PROVIDER_NAME, distinctKeywords);
    }

    private void extractSentenceKeywords(CoreSentence sentence, int predictedClass, List<String> keywords) {
        // Collect distinctive sentiment-bearing tokens for downstream clinical & mood tracking
        Set<String> positiveMarkers = Set.of("calm", "productive", "peaceful", "happy", "grateful", "joy",
                "excited", "inspired", "energized", "relaxed", "serene", "accomplished", "content", "better", "clear");
        Set<String> negativeMarkers = Set.of("anxious", "stressed", "sad", "tired", "depressed", "overwhelmed",
                "exhausted", "down", "frustrated", "worried", "angry", "terrible", "bad", "lonely");

        List<String> tokens = sentence.tokensAsStrings();
        for (String token : tokens) {
            String lower = token.toLowerCase();
            if (predictedClass >= 3 && positiveMarkers.contains(lower)) {
                keywords.add(lower);
            } else if (predictedClass <= 1 && negativeMarkers.contains(lower)) {
                keywords.add(lower);
            }
        }
    }
}
