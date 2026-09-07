# Java Stanford CoreNLP Sentiment Analysis Microservice (`java-nlp-service`)

This microservice provides enterprise-grade Natural Language Processing (NLP) sentiment analysis for the **Mental Health Journal & Mood Analyzer** application. Built with **Spring Boot 3** and **Stanford CoreNLP 4.5.5**, it analyzes reflection entries using Recursive Neural Network (RNN) sentiment trees over syntactic parse structures.

---

## Architecture Flow

```
+---------------------------+
| User Journal Submission   |
| (React Client Interface)  |
+-------------+-------------+
              |
              v
+---------------------------+
| Cloud Firestore Document  |
| journalEntries/{entryId}  |
+-------------+-------------+
              |
              | (onDocumentCreated)
              v
+------------------------------------+
| Firebase Cloud Function            |
| functions/index.js                 |
+-------------+----------------------+
              |
              | POST /api/nlp/sentiment { "text": "..." }
              v
+------------------------------------+
| Java NLP Microservice              |
| Stanford CoreNLP 4.5.5 (Port 9000) |
+-------------+----------------------+
              |
              | Returns { sentiment, sentimentScore, provider, ... }
              v
+------------------------------------+
| Cloud Firestore Update             |
| nlpProcessed: true, sentiment...   |
+-------------+----------------------+
              |
              v
+------------------------------------+
| Live Dashboard & Trends Sync       |
+------------------------------------+
```

---

## Prerequisites

- **Java Development Kit (JDK)**: Version 17 or higher
- **Apache Maven**: Version 3.8 or higher
- **Memory**: Minimum 2 GB RAM recommended for loading CoreNLP English parser and sentiment models

---

## 1. How to Install Java 17

### Ubuntu / Debian Linux:
```bash
sudo apt update
sudo apt install -y openjdk-17-jdk
# Verify installation
java -version
javac -version
```

### macOS (using Homebrew):
```bash
brew install openjdk@17
# Link JDK to system wrapper
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
# Verify installation
java -version
```

### Windows (using Chocolatey or Winget):
```powershell
winget install EclipseAdoptium.Temurin.17.JDK
# or
choco install openjdk17
```

---

## 2. How to Install Apache Maven

### Ubuntu / Debian Linux:
```bash
sudo apt install -y maven
mvn -version
```

### macOS (using Homebrew):
```bash
brew install maven
mvn -version
```

### Windows:
```powershell
winget install Apache.Maven
# or
choco install maven
```

---

## 3. How to Run the Java NLP Service Locally

Navigate into the `java-nlp-service` directory:
```bash
cd java-nlp-service
```

### Option A: Using Maven (Development Mode)
```bash
mvn spring-boot:run
```
By default, the microservice initializes on port `9000`.

### Option B: Build and Run JAR Package
```bash
# Clean package (downloads Stanford CoreNLP 4.5.5 and models on first run)
mvn clean package -DskipTests

# Run with tuned heap allocation
java -Xmx2048m -jar target/java-nlp-service-1.0.0.jar --server.port=9000
```

### Option C: Using Docker
```bash
docker build -t java-nlp-service .
docker run -p 9000:9000 -e PORT=9000 java-nlp-service
```

---

## 4. How to Test `/api/nlp/sentiment`

Once the service is running, test with `curl` or any API client (Postman/Thunder Client).

### Positive Reflection Test:
```bash
curl -X POST http://localhost:9000/api/nlp/sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "Today was calm and productive."}'
```

**Expected JSON Response:**
```json
{
  "sentiment": "Positive",
  "sentimentScore": 0.5,
  "provider": "Stanford CoreNLP Java Microservice",
  "emotionalKeywords": ["calm", "productive"]
}
```

### Negative Reflection Test:
```bash
curl -X POST http://localhost:9000/api/nlp/sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "I felt overwhelmed, anxious, and exhausted by work today."}'
```

**Expected JSON Response:**
```json
{
  "sentiment": "Negative",
  "sentimentScore": -0.5,
  "provider": "Stanford CoreNLP Java Microservice",
  "emotionalKeywords": ["overwhelmed", "anxious", "exhausted"]
}
```

### Health Check:
```bash
curl -X GET http://localhost:9000/api/nlp/health
```

---

## 5. Configure `JAVA_NLP_SERVICE_URL`

The client application and Cloud Functions check the `JAVA_NLP_SERVICE_URL` environment variable.

### Local Development:
Add to `.env` or export in your shell:
```bash
JAVA_NLP_SERVICE_URL=http://localhost:9000
```

### Production / Remote Cloud Run:
When deployed to Google Cloud Run:
```bash
JAVA_NLP_SERVICE_URL=https://java-nlp-service-<hash>-<region>.a.run.app
```

---

## 6. Connect Firebase Cloud Functions

The Firebase Cloud Function in `/functions/index.js` listens to Firestore document creations:

1. **Configure Environment Variable for Firebase Functions:**
   In Firebase 2nd Gen Functions, define the environment variable in `functions/.env` or via Google Cloud Secret Manager:
   ```bash
   # functions/.env
   JAVA_NLP_SERVICE_URL="https://java-nlp-service-<hash>-<region>.a.run.app"
   ```

2. **Deploy Cloud Functions:**
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

3. **Verify Execution Flow in Logs:**
   ```bash
   firebase functions:log
   ```
   When a user submits a journal entry, you will observe:
   - `onDocumentCreated` triggers on `journalEntries/{entryId}`
   - HTTP POST dispatched to `https://java-nlp-service-.../api/nlp/sentiment`
   - Received JSON response with `provider: "Stanford CoreNLP Java Microservice"`
   - Firestore document updated with `sentiment`, `sentimentScore`, and `nlpProcessed: true`
   - If the Java service is temporarily offline, the entry is labeled with an explicit fallback: `"Explicit Local Fallback (Java NLP Microservice Unreachable)"` so users always know the true pipeline source.

---

## 7. Deploy the Service to Google Cloud Run

Google Cloud Run provides a serverless, autoscaling environment for containerized Java microservices.

### Step 1: Authenticate with Google Cloud
```bash
gcloud auth login
gcloud config set project <YOUR_GCP_PROJECT_ID>
```

### Step 2: Enable Required Cloud APIs
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

### Step 3: Build & Deploy Container Directly from Source
From the `java-nlp-service` directory:
```bash
gcloud run deploy java-nlp-service \
  --source . \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 5 \
  --allow-unauthenticated
```

> **Resource Sizing Note**: Stanford CoreNLP's PCFG parser and sentiment RNN model require sufficient memory. Allocating `--memory 2Gi` and `--cpu 2` guarantees optimal inference latency (<150ms per sentence).

### Step 4: Retrieve Service URL
Once deployed, Cloud Run outputs the Service URL, for example:
```
Service URL: https://java-nlp-service-eaylqam3ba-uc.a.run.app
```

Set this URL in your Cloud Functions and Express server configuration:
```bash
JAVA_NLP_SERVICE_URL=https://java-nlp-service-eaylqam3ba-uc.a.run.app
```
