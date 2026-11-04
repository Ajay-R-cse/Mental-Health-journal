import app from '../backend/app.js';
import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
