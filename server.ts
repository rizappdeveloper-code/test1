import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Increase JSON payload limit to handle base64 selfie images
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// API Route: Proxy image conversion to Base64 data URL (handles CORS images)
app.post('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'url string is required' });
    }

    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) {
      return res.json({ dataUrl: trimmed });
    }

    // Standard HTTP image fetch fallback
    const fetchRes = await fetch(trimmed);
    if (fetchRes.ok) {
      const arrBuf = await fetchRes.arrayBuffer();
      const buffer = Buffer.from(arrBuf);
      const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
      const base64 = buffer.toString('base64');
      return res.json({ dataUrl: `data:${mimeType};base64,${base64}` });
    }

    return res.json({ dataUrl: '' });
  } catch (err: any) {
    console.error('Proxy image error:', err);
    return res.json({ dataUrl: '' });
  }
});

async function startServer() {
  // Vite middleware for dev or static serving for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
