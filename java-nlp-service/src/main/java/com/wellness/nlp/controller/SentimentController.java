package com.wellness.nlp.controller;

import com.wellness.nlp.model.SentimentRequest;
import com.wellness.nlp.model.SentimentResponse;
import com.wellness.nlp.service.CoreNlpSentimentService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/nlp")
@CrossOrigin(origins = {
    "http://localhost:3000",
    "http://localhost:5173",
    "https://ais-dev-eaylqam3b4pqyvceot5dyf-805459357790.asia-southeast1.run.app",
    "https://ais-pre-eaylqam3b4pqyvceot5dyf-805459357790.asia-southeast1.run.app"
})
public class SentimentController {

    private static final Logger log = LoggerFactory.getLogger(SentimentController.class);

    private final CoreNlpSentimentService sentimentService;

    public SentimentController(CoreNlpSentimentService sentimentService) {
        this.sentimentService = sentimentService;
    }

    /**
     * POST /api/nlp/sentiment
     *
     * Consumed by Firebase Cloud Function and Backend Adapters.
     * Accepts:
     *   { "text": "Today was calm and productive." }
     *
     * Returns:
     *   {
     *     "sentiment": "Positive",
     *     "sentimentScore": 0.5,
     *     "provider": "Stanford CoreNLP Java Microservice",
     *     "emotionalKeywords": [],
     *     "status": "processed"
     *   }
     */
    @PostMapping("/sentiment")
    public ResponseEntity<SentimentResponse> analyzeSentiment(@Valid @RequestBody SentimentRequest request) {
        log.info("Received sentiment analysis request for text length: {}",
                request.getText() != null ? request.getText().length() : 0);

        SentimentResponse response = sentimentService.analyzeSentiment(request.getText());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/nlp/health
     * Health check endpoint returning standard status schema.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "service", "java-stanford-corenlp"
        ));
    }
}
