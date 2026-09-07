package com.wellness.nlp.model;

import jakarta.validation.constraints.NotBlank;

public class SentimentRequest {

    @NotBlank(message = "The 'text' field must not be blank.")
    private String text;

    public SentimentRequest() {
    }

    public SentimentRequest(String text) {
        this.text = text;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}
