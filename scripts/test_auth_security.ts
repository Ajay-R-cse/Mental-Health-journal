import express, { Request, Response } from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from '../backend/middleware/auth.js';
import { authService } from '../backend/services/AuthService.js';
import { User } from '../backend/models/index.js';

async function runAuthSecurityTests() {
  console.log('=== RUNNING AUTHENTICATION SECURITY & JWT VALIDATION SUITE ===\n');
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

  // Preserve initial environment state
  const originalSecret = process.env.JWT_SECRET;

  try {
    // ----------------------------------------------------
    // TEST 1: AuthService.generateToken fails securely if JWT_SECRET is unset
    // ----------------------------------------------------
    delete process.env.JWT_SECRET;
    const testUser: User = {
      id: 'usr-test-123',
      name: 'Security Test User',
      email: 'test@example.com',
      password_hash: 'hashed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let threwAsExpected = false;
    try {
      authService.generateToken(testUser);
    } catch (err: any) {
      threwAsExpected = err.message.includes('JWT_SECRET environment variable is not configured');
    }
    assert(
      threwAsExpected,
      'AuthService.generateToken() fails securely with explicit error when JWT_SECRET is unset',
      'Should not fall back to any default key'
    );

    // ----------------------------------------------------
    // TEST 2: AuthService.generateToken succeeds when JWT_SECRET is provided
    // ----------------------------------------------------
    const testSecret = 'test-ephemeral-strong-secret-key-32-chars-long!';
    process.env.JWT_SECRET = testSecret;

    const generatedToken = authService.generateToken(testUser);
    assert(
      typeof generatedToken === 'string' && generatedToken.split('.').length === 3,
      'AuthService.generateToken() creates valid 3-segment signed JWT when JWT_SECRET is configured'
    );

    const verified = jwt.verify(generatedToken, testSecret) as any;
    assert(
      verified.id === testUser.id && verified.email === testUser.email,
      'Token signed by AuthService is verifiable using process.env.JWT_SECRET'
    );

    // ----------------------------------------------------
    // TEST 3: Setup Express test app with authMiddleware
    // ----------------------------------------------------
    const app = express();
    app.use(express.json());
    app.get('/protected', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
      res.json({ success: true, user: req.user });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 3A: No Authorization header
      const resNoHeader = await fetch(`${baseUrl}/protected`);
      const bodyNoHeader = await resNoHeader.json();
      assert(
        resNoHeader.status === 401 && bodyNoHeader.error.includes('No token provided'),
        'authMiddleware returns 401 Unauthorized when Authorization header is missing'
      );

      // 3B: Non-Bearer Authorization header
      const resBadScheme = await fetch(`${baseUrl}/protected`, {
        headers: { Authorization: `Basic ${Buffer.from('user:pass').toString('base64')}` },
      });
      const bodyBadScheme = await resBadScheme.json();
      assert(
        resBadScheme.status === 401 && bodyBadScheme.error.includes('No token provided'),
        'authMiddleware returns 401 Unauthorized when Authorization scheme is not Bearer'
      );

      // 3C: Valid custom token with JWT_SECRET set
      const resValidToken = await fetch(`${baseUrl}/protected`, {
        headers: { Authorization: `Bearer ${generatedToken}` },
      });
      const bodyValidToken = await resValidToken.json();
      assert(
        resValidToken.status === 200 && bodyValidToken.user?.id === testUser.id,
        'authMiddleware accepts valid custom JWT token and populates req.user'
      );

      // 3D: Token signed with old/wrong secret is rejected
      const rogueToken = jwt.sign({ id: 'bad-actor', email: 'rogue@fake.com' }, 'wrong-or-old-predictable-key');
      const resRogueToken = await fetch(`${baseUrl}/protected`, {
        headers: { Authorization: `Bearer ${rogueToken}` },
      });
      assert(
        resRogueToken.status === 401,
        'authMiddleware rejects token signed with an invalid/different secret'
      );

      // 3E: If JWT_SECRET is unset and custom token is sent, fails securely with 500 (not fallback 200)
      delete process.env.JWT_SECRET;
      const resUnsetSecret = await fetch(`${baseUrl}/protected`, {
        headers: { Authorization: `Bearer ${rogueToken}` },
      });
      const bodyUnsetSecret = await resUnsetSecret.json();
      assert(
        resUnsetSecret.status === 500 && bodyUnsetSecret.error.includes('JWT_SECRET is not configured'),
        'authMiddleware fails securely with 500 configuration error when JWT_SECRET is unset'
      );

      // 3F: Firebase ID token format handling
      const validFirebaseToken = jwt.sign(
        {
          iss: 'https://securetoken.google.com/test-project-12345',
          aud: 'test-project-12345',
          sub: 'firebase-user-987',
          user_id: 'firebase-user-987',
          email: 'firebase.user@example.com',
          name: 'Firebase Verified User',
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour in future
        },
        'google-simulated-private-key',
        { algorithm: 'HS256' } // Simulated envelope
      );

      const resFirebase = await fetch(`${baseUrl}/protected`, {
        headers: { Authorization: `Bearer ${validFirebaseToken}` },
      });
      const bodyFirebase = await resFirebase.json();
      assert(
        resFirebase.status === 200 && bodyFirebase.user?.id === 'firebase-user-987',
        'authMiddleware recognizes valid Firebase ID token claims without requiring symmetric JWT_SECRET'
      );

      // 3G: Expired Firebase ID token is rejected with 401
      const expiredFirebaseToken = jwt.sign(
        {
          iss: 'https://securetoken.google.com/test-project-12345',
          aud: 'test-project-12345',
          sub: 'expired-user',
          user_id: 'expired-user',
          email: 'expired@example.com',
          exp: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
        },
        'google-simulated-private-key'
      );

      const resExpired = await fetch(`${baseUrl}/protected`, {
        headers: { Authorization: `Bearer ${expiredFirebaseToken}` },
      });
      assert(
        resExpired.status === 401,
        'authMiddleware rejects expired Firebase token with 401 Unauthorized'
      );

    } finally {
      server.close();
    }
  } finally {
    // Restore environment variable
    if (originalSecret) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }

  console.log(`\n=== SUITE COMPLETE: ${passes} PASSED, ${failures} FAILED ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

runAuthSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
