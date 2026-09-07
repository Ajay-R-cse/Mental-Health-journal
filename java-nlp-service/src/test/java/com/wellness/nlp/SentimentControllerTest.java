package com.wellness.nlp;

import com.wellness.nlp.controller.SentimentController;
import com.wellness.nlp.model.SentimentRequest;
import com.wellness.nlp.model.SentimentResponse;
import com.wellness.nlp.service.CoreNlpSentimentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class SentimentControllerTest {

    @Autowired
    private SentimentController sentimentController;

    @Autowired
    private CoreNlpSentimentService sentimentService;

    @Test
    public void testPositiveSentimentEndpoint() {
        SentimentRequest request = new SentimentRequest("Today was calm and productive.");
        ResponseEntity<SentimentResponse> responseEntity = sentimentController.analyzeSentiment(request);

        assertNotNull(responseEntity);
        assertEquals(200, responseEntity.getStatusCode().value());

        SentimentResponse response = responseEntity.getBody();
        assertNotNull(response);
        assertEquals("Positive", response.getSentiment());
        assertTrue(response.getSentimentScore() > 0.0, "Sentiment score should be positive");
        assertEquals("Stanford CoreNLP Java Microservice", response.getProvider());
    }

    @Test
    public void testNegativeSentimentEndpoint() {
        SentimentRequest request = new SentimentRequest("I felt completely overwhelmed, exhausted, and sad today.");
        ResponseEntity<SentimentResponse> responseEntity = sentimentController.analyzeSentiment(request);

        assertNotNull(responseEntity);
        assertEquals(200, responseEntity.getStatusCode().value());

        SentimentResponse response = responseEntity.getBody();
        assertNotNull(response);
        assertEquals("Negative", response.getSentiment());
        assertTrue(response.getSentimentScore() < 0.0, "Sentiment score should be negative");
        assertEquals("Stanford CoreNLP Java Microservice", response.getProvider());
    }
}
