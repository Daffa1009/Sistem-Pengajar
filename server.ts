import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  try {
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
        console.log('API extract-pdf called');
        if (!req.file) {
          console.error('No file in request');
          return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Extracting text from PDF:', req.file.originalname);
        const dataBuffer = req.file.buffer;
        
        console.log('Using pdf-parse to extract text...');
        // pdf-parse from require should be the function
        const data = await pdf(dataBuffer);
        console.log('PDF extraction successful, pages:', data.numpages);

        res.json({ 
          text: data.text,
          info: data.info,
          numpages: data.numpages
        });
      } catch (error: any) {
        console.error('PDF extraction error:', error);
        res.status(500).json({ 
          error: 'Failed to parse PDF', 
          details: error.message 
        });
      }
    });

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
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
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error('Fatal crash on startServer:', err);
  process.exit(1);
});
