import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './src/server/app.ts';
import { isSupabaseConfigured } from './src/server/supabase-repo.ts';

async function startServer() {
  // Initialize local relational SQLite database on startup only if not using Supabase
  if (!isSupabaseConfigured()) {
    const store = await import('./src/server/store.ts');
    store.getSqliteDb();
  }

  const app = createApiApp();
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(
      `SMK Prima Unggul server running on http://0.0.0.0:${port} (backend: ${
        isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'SQLite Relational DB'
      })`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
