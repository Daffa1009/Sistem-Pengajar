import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Multer setup for memory storage
  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });

  // API Route for PDF extraction
  app.post('/api/extract-pdf', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const dataBuffer = req.file.buffer;
      const data = await pdf(dataBuffer);

      // Return excerpt if too large, but Gemini 1.5 Flash can handle huge context.
      // However, we should limit to reasonable size for initial extraction response.
      res.json({ 
        text: data.text,
        info: data.info,
        numpages: data.numpages
      });
    } catch (error) {
      console.error('PDF extraction error:', error);
      res.status(500).json({ error: 'Failed to parse PDF' });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
