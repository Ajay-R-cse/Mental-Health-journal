import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';

export function createExpressApp() {
  const app = express();

  // Production-ready CORS configuration
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root health endpoints
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'mindspace-api', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'mindspace-api', timestamp: new Date().toISOString() });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // 404 handler for API routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl || req.url}` });
      return;
    }
    next();
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
}

const app = createExpressApp();
export default app;
