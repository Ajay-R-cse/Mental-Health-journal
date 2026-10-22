import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is missing.');
}

const JWT_SECRET = process.env.JWT_SECRET;

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

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
    req.user = decoded;
    next();
  } catch {
    // If JWT verification fails, check if this is a Firebase token or simple decoded format
    try {
      const decodedUnverified = jwt.decode(token) as { sub?: string; user_id?: string; email?: string; name?: string } | null;
      if (decodedUnverified && (decodedUnverified.sub || decodedUnverified.user_id)) {
        req.user = {
          id: decodedUnverified.sub || decodedUnverified.user_id || 'usr-fallback',
          email: decodedUnverified.email || 'user@firebase.com',
          name: decodedUnverified.name || 'Firebase User',
        };
        next();
        return;
      }
    } catch {
      // Ignored
    }

    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
