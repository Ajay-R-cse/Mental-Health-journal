package com.wellness.nlp.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class SentimentResponse {

    private String sentiment;
    private double sentimentScore;
    private String provider = "Stanford CoreNLP Java Microservice";
    private List<String> emotionalKeywords = new ArrayList<>();

    public SentimentResponse() {
    }

    public SentimentResponse(String sentiment, double sentimentScore, String provider, List<String> emotionalKeywords) {
        this.sentiment = sentiment;
        this.sentimentScore = sentimentScore;
        this.provider = provider;
        this.emotionalKeywords = emotionalKeywords != null ? emotionalKeywords : new ArrayList<>();
    }

    public String getSentiment() {
        return sentiment;
    }

    public void setSentiment(String sentiment) {
        this.sentiment = sentiment;
    }

    public double getSentimentScore() {
        return sentimentScore;
    }

    public void setSentimentScore(double sentimentScore) {
        this.sentimentScore = sentimentScore;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public List<String> getEmotionalKeywords() {
        return emotionalKeywords;
    }

    public void setEmotionalKeywords(List<String> emotionalKeywords) {
        this.emotionalKeywords = emotionalKeywords;
    }
}
