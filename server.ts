import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cardapioWebWebhook from './api/webhook-cardapio-web';
import syncCardapioWeb from './api/sync-cardapio-web';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // O servidor reutiliza exatamente os mesmos handlers usados na Vercel.
  // Assim nao existe uma segunda implementacao com tokens, regras ou status divergentes.
  app.all('/api/webhook/cardapio-web/:storeId', async (req, res) => {
    req.query.storeId = req.params.storeId;
    await cardapioWebWebhook(req, res);
  });

  // Compatibilidade temporaria com URLs antigas que enviam storeId/branch por query string.
  app.all('/api/webhook-cardapio-web', async (req, res) => {
    await cardapioWebWebhook(req, res);
  });

  app.all('/api/sync-cardapio-web', async (req, res) => {
    await syncCardapioWeb(req, res);
  });

  if (process.env.NODE_ENV === 'production') {
    // O build gera dist/server.cjs em CommonJS. Usar import.meta.url aqui quebra
    // no Render porque esbuild não preserva esse valor no bundle CJS.
    // O processo do Render inicia na raiz do projeto, então o dist público é estável.
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rota Facil server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start Rota Facil server:', error);
  process.exit(1);
});