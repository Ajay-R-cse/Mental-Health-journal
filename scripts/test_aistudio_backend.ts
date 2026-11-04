import http from 'http';
import app from '../backend/app.js';
import fs from 'fs';
import path from 'path';

async function runAIStudioBackendTests() {
  console.log('=== TESTING GOOGLE AI STUDIO FULL-STACK EXPRESS BACKEND ===\n');
  let failures = 0;
  let passes = 0;

  function assert(condition: boolean, testName: string, errorDetail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passes++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (errorDetail) console.error(`       Detail: ${errorDetail}`);
      failures++;
    }
  }

  // 1. Verify Firebase Configuration
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(
      config.projectId === 'the-fusion-4ghtt',
      'Firebase configuration contains verified projectId: the-fusion-4ghtt',
      `Got ${config.projectId}`
    );
    assert(
      config.firestoreDatabaseId === 'ai-studio-30b514ff-b076-49a1-b93d-dd135f1636ba',
      'Firebase configuration contains verified firestoreDatabaseId: ai-studio-30b514ff-b076-49a1-b93d-dd135f1636ba',
      `Got ${config.firestoreDatabaseId}`
    );
  } catch (err: any) {
    assert(false, 'Firebase configuration file is present and valid JSON', err?.message);
  }

  // 2. Start ephemeral HTTP server with the Express app
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Ephemeral test server running at ${baseUrl}\n`);

  try {
    // Test 1: GET /health
    const resHealth1 = await fetch(`${baseUrl}/health`);
    const dataHealth1 = await resHealth1.json();
    assert(
      resHealth1.status === 200 && dataHealth1.status === 'ok',
      'GET /health returns 200 OK with status: ok'
    );

    // Test 2: GET /api/health
    const resHealth2 = await fetch(`${baseUrl}/api/health`);
    const dataHealth2 = await resHealth2.json();
    assert(
      resHealth2.status === 200 && dataHealth2.status === 'ok',
      'GET /api/health returns 200 OK with status: ok'
    );

    // Test 3: POST /api/nlp/analyze
    const resNlp = await fetch(`${baseUrl}/api/nlp/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'I had a tranquil walk in nature and felt deeply peaceful.' }),
    });
    const dataNlp = await resNlp.json();
    assert(
      resNlp.status === 200 && dataNlp.success && dataNlp.result?.sentiment === 'Positive',
      'POST /api/nlp/analyze returns 200 OK with Positive sentiment analysis'
    );

    // Test 4: GET /api/nlp/info
    const resNlpInfo = await fetch(`${baseUrl}/api/nlp/info`);
    const dataNlpInfo = await resNlpInfo.json();
    assert(
      resNlpInfo.status === 200 && dataNlpInfo.success && Array.isArray(dataNlpInfo.architecture?.support),
      'GET /api/nlp/info returns 200 OK with architecture metadata'
    );

    // Test 5: POST /api/ai/journal-insights empty input guard
    const resAiInvalid = await fetch(`${baseUrl}/api/ai/journal-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journalText: '' }),
    });
    const dataAiInvalid = await resAiInvalid.json();
    assert(
      resAiInvalid.status === 400 && dataAiInvalid.error.includes('required'),
      'POST /api/ai/journal-insights validates empty input with 400 Bad Request'
    );

    // Test 6: POST /api/ai/journal-insights short check-in fast path
    const resAiShort = await fetch(`${baseUrl}/api/ai/journal-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journalText: 'Feeling calm today.', manualMood: 'Calm' }),
    });
    const dataAiShort = await resAiShort.json();
    assert(
      resAiShort.status === 200 && dataAiShort.summary && dataAiShort.reflectionPrompt,
      'POST /api/ai/journal-insights handles short check-ins gracefully with structured insights'
    );

    // Test 7: POST /api/ai/weekly-reflection fallback / structure check
    const resReflect = await fetch(`${baseUrl}/api/ai/weekly-reflection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journals: [
          { date: '2026-11-01', text: 'Had a restful weekend walk.' },
        ],
        sleepRecords: [{ date: '2026-11-01', hours: 8.0 }],
        activities: [{ date: '2026-11-01', name: 'Walking' }],
      }),
    });
    const dataReflect = await resReflect.json();
    assert(
      resReflect.status === 200 && (dataReflect.overallTrend || dataReflect.commonThemes),
      'POST /api/ai/weekly-reflection returns 200 OK with structured reflection'
    );

    // Test 8: Nonexistent API route 404 handler
    const res404 = await fetch(`${baseUrl}/api/nonexistent-route-endpoint`);
    assert(
      res404.status === 404,
      'Nonexistent API route returns clean 404 JSON response'
    );

    // Test 9: CORS Headers
    const resCors = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://ais-dev-eaylqam3b4pqyvceot5dyf-805459357790.asia-southeast1.run.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const allowOrigin = resCors.headers.get('access-control-allow-origin');
    assert(
      allowOrigin !== null,
      'CORS headers are properly configured on Express app'
    );

  } finally {
    server.close();
  }

  console.log(`\n=== SUITE COMPLETE: ${passes} PASSED, ${failures} FAILED ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

runAIStudioBackendTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
