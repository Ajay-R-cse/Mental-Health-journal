import http from 'http';
import app from '../backend/app.js';
import handler from '../api/index.js';
import catchAllHandler from '../api/[...all].js';

async function runTests() {
  console.log('=== TESTING VERCEL SERVERLESS FUNCTIONS & EXPRESS APP ===');
  let failures = 0;

  // 1. Verify export contract
  if (typeof handler !== 'function') {
    console.error('[FAIL] api/index.ts does not export a function handler');
    failures++;
  } else {
    console.log('[PASS] api/index.ts exports a valid serverless function handler');
  }

  if (typeof catchAllHandler !== 'function') {
    console.error('[FAIL] api/[...all].ts does not export a function handler');
    failures++;
  } else {
    console.log('[PASS] api/[...all].ts exports a valid serverless function handler');
  }

  // 2. Start an ephemeral HTTP server using the exact serverless app
  const server = http.createServer((req, res) => {
    // Mimic Vercel serverless invocation
    if (req.url === '/api' || req.url === '/api/') {
      return handler(req as any, res as any);
    }
    return catchAllHandler(req as any, res as any);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Ephemeral test server running at ${baseUrl}`);

  try {
    // Test 1: GET /health
    const resHealth1 = await fetch(`${baseUrl}/health`);
    const dataHealth1 = await resHealth1.json();
    if (resHealth1.status === 200 && dataHealth1.status === 'ok') {
      console.log('[PASS] GET /health returns 200 OK with status: ok');
    } else {
      console.error('[FAIL] GET /health failed:', resHealth1.status, dataHealth1);
      failures++;
    }

    // Test 2: GET /api/health
    const resHealth2 = await fetch(`${baseUrl}/api/health`);
    const dataHealth2 = await resHealth2.json();
    if (resHealth2.status === 200 && dataHealth2.status === 'ok') {
      console.log('[PASS] GET /api/health returns 200 OK with status: ok');
    } else {
      console.error('[FAIL] GET /api/health failed:', resHealth2.status, dataHealth2);
      failures++;
    }

    // Test 3: POST /api/nlp/analyze
    const resNlp = await fetch(`${baseUrl}/api/nlp/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'I felt calm, peaceful, and accomplished after my morning meditation.' }),
    });
    const dataNlp = await resNlp.json();
    if (resNlp.status === 200 && dataNlp.success && dataNlp.result?.sentiment === 'Positive') {
      console.log('[PASS] POST /api/nlp/analyze returns 200 OK with Positive sentiment analysis');
    } else {
      console.error('[FAIL] POST /api/nlp/analyze failed:', resNlp.status, dataNlp);
      failures++;
    }

    // Test 4: POST /api/ai/journal-insights input validation guard
    const resAiInvalid = await fetch(`${baseUrl}/api/ai/journal-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journalText: '' }),
    });
    const dataAiInvalid = await resAiInvalid.json();
    if (resAiInvalid.status === 400 && dataAiInvalid.error) {
      console.log('[PASS] POST /api/ai/journal-insights correctly validates empty input with 400');
    } else {
      console.error('[FAIL] POST /api/ai/journal-insights empty input validation failed:', resAiInvalid.status, dataAiInvalid);
      failures++;
    }

    // Test 5: POST /api/ai/weekly-reflection fallback / structure check
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
    if (resReflect.status === 200 && (dataReflect.overallTrend || dataReflect.commonThemes)) {
      console.log('[PASS] POST /api/ai/weekly-reflection returns 200 OK with reflection payload');
    } else {
      console.error('[FAIL] POST /api/ai/weekly-reflection failed:', resReflect.status, dataReflect);
      failures++;
    }

    // Test 6: 404 handler for nonexistent API route
    const res404 = await fetch(`${baseUrl}/api/nonexistent-route-check`);
    if (res404.status === 404) {
      console.log('[PASS] Nonexistent API route returns 404 cleanly');
    } else {
      console.error('[FAIL] Nonexistent API route returned:', res404.status);
      failures++;
    }

    // Test 7: CORS headers check
    const resCors = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://my-vercel-deployment.vercel.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const allowOrigin = resCors.headers.get('access-control-allow-origin');
    if (allowOrigin === 'https://my-vercel-deployment.vercel.app' || allowOrigin === '*') {
      console.log('[PASS] CORS preflight headers correctly configured');
    } else {
      console.warn('[WARN] CORS headers:', allowOrigin);
    }

  } finally {
    server.close();
  }

  if (failures === 0) {
    console.log('=== ALL SERVERLESS ENTRYPOINT TESTS PASSED ===');
    process.exit(0);
  } else {
    console.error(`=== ${failures} TESTS FAILED ===`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
