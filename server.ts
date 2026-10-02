import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health Check Endpoint (/api/health)
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'lotradar-sg',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      adapters: {
        dataGovSg: true,
        ltaDataMallKeyConfigured: Boolean(
          process.env.VITE_LTA_DATAMALL_API_KEY || process.env.LTA_DATAMALL_API_KEY
        ),
        uraAccessKeyConfigured: Boolean(
          process.env.VITE_URA_ACCESS_KEY || process.env.URA_ACCESS_KEY
        ),
      },
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
