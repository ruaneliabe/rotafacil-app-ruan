import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cardapioWebWebhook from './api/webhook-cardapio-web';
import syncCardapioWeb from './api/sync-cardapio-web';
import seedFlowTest, { seedFlowTestOrders } from './api/seed-flow-test';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/seed-flow-test', async (req, res) => {
    await seedFlowTest(req, res);
  });

  app.all('/api/webhook/cardapio-web/:storeId', async (req, res) => {
    req.query.storeId = req.params.storeId;
    await cardapioWebWebhook(req, res);
  });

  app.all('/api/webhook-cardapio-web', async (req, res) => {
    await cardapioWebWebhook(req, res);
  });

  app.all('/api/sync-cardapio-web', async (req, res) => {
    await syncCardapioWeb(req, res);
  });

  app.all('/api/cardapio-web/sync', async (req, res) => {
    await syncCardapioWeb(req, res);
  });

  // Older builds may still attempt these endpoints. They no longer perform any
  // Firestore scan/write; return success so a stale browser tab cannot create a 404 loop.
  app.all('/api/reconcile-cardapio-web-couriers', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
  });
  app.all('/api/reconcile-cardapio-web-completed', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
  });

  if (process.env.NODE_ENV === 'production') {
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

  // Temporary, idempotent pilot seed: creates exactly six TESTE orders once.
  seedFlowTestOrders()
    .then((result) => console.log(`[flow-test-seed] ${result.alreadyCreated ? 'already present' : 'created'}: ${result.count} orders`))
    .catch((error) => console.error('[flow-test-seed] failed:', error));
}

startServer().catch((error) => {
  console.error('Failed to start Rota Facil server:', error);
  process.exit(1);
});
