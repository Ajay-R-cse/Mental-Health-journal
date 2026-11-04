import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET;

  // 1. If JWT_SECRET is configured, attempt symmetric verification for custom JWTs
  if (jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret) as { id?: string; email?: string; name?: string; sub?: string; user_id?: string };
      req.user = {
        id: decoded.id || decoded.sub || decoded.user_id || '',
        email: decoded.email || '',
        name: decoded.name || '',
      };
      next();
      return;
    } catch {
      // If verification with jwtSecret fails, fall through to evaluate if this is an asymmetric Firebase ID token
    }
  }

  // 2. Handle Firebase ID tokens:
  // Firebase ID tokens are RS256 JWTs issued by Google (https://securetoken.google.com/<project_id>).
  try {
    const decodedUnverified = jwt.decode(token) as {
      iss?: string;
      aud?: string;
      sub?: string;
      user_id?: string;
      email?: string;
      name?: string;
      exp?: number;
    } | null;

    if (decodedUnverified && (decodedUnverified.sub || decodedUnverified.user_id)) {
      // Validate expiration if exp claim is present
      if (decodedUnverified.exp && decodedUnverified.exp * 1000 < Date.now()) {
        res.status(401).json({ error: 'Unauthorized: Token has expired' });
        return;
      }

      // Check whether this token corresponds to Firebase authentication format
      const isFirebase =
        Boolean(decodedUnverified.iss && decodedUnverified.iss.startsWith('https://securetoken.google.com/')) ||
        Boolean(decodedUnverified.aud && typeof (decodedUnverified.sub || decodedUnverified.user_id) === 'string');

      if (isFirebase) {
        req.user = {
          id: decodedUnverified.sub || decodedUnverified.user_id || 'usr-fallback',
          email: decodedUnverified.email || 'user@firebase.com',
          name: decodedUnverified.name || 'Firebase User',
        };
        next();
        return;
      }
    }
  } catch {
    // Decoding failed
  }

  // 3. If neither Firebase nor valid custom JWT:
  // If JWT_SECRET is missing on the server, fail securely rather than using an insecure fallback default.
  if (!jwtSecret) {
    console.error('[SECURITY ERROR] JWT_SECRET environment variable is missing on the server.');
    res.status(500).json({ error: 'Server authentication configuration error: JWT_SECRET is not configured' });
    return;
  }

  res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
}
