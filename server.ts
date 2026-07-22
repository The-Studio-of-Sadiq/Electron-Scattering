import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import multer from 'multer';
import {
  runDiracPartialWaveSimulation,
  runEnergySweep,
} from './src/physics/elsepaPhysicsEngine';
import {
  ensureFortranBinaryCompiled,
  runOfficialFortranSimulation,
} from './server/fortranRunner';
import { ElsepaInputParams, UploadedDataset } from './src/types';
import {
  OFFICIAL_ELSEPA_FORTRAN_SOURCE,
  RENDER_DOCKERFILE_CONTENT,
  RENDER_YAML_CONTENT,
} from './src/data/elsepaFortranSource';

const app = express();
const PORT = 3000;

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure Multer for secure in-memory file uploads with limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.dat', '.txt', '.csv', '.in', '.out'];
    if (allowed.includes(ext) || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .dat, .txt, .csv, and .in files allowed.'));
    }
  },
});

// In-memory store for uploaded datasets
const uploadedDatasetsStore: UploadedDataset[] = [];

// API 1: Check Fortran Environment Status
app.get('/api/fortran-status', (_req: Request, res: Response) => {
  let hasGFortran = false;
  let gfortranPath = '';
  let versionInfo = '';

  try {
    const output = execSync('gfortran --version', { encoding: 'utf-8', timeout: 2000 });
    hasGFortran = true;
    versionInfo = output.split('\n')[0] || 'gfortran detected';
    gfortranPath = execSync('which gfortran', { encoding: 'utf-8', timeout: 2000 }).trim();
  } catch (err) {
    hasGFortran = false;
    versionInfo = 'gfortran not found in system PATH. Fallback to TypeScript Dirac partial-wave physics engine.';
  }

  const binaryPath = ensureFortranBinaryCompiled();
  const hasElsepaBinary = !!binaryPath;

  res.json({
    hasGFortran,
    hasElsepaBinary,
    versionInfo,
    gfortranPath,
  });
});

// API 2: Run ELSEPA Simulation
app.post('/api/simulate', (req: Request, res: Response) => {
  try {
    const params: ElsepaInputParams = req.body;
    if (!params || !params.z || !params.energyEv) {
      res.status(400).json({ error: 'Missing required simulation parameters (z, energyEv)' });
      return;
    }

    // Run official Salvat Fortran simulation if gfortran/binary is present, or fallback
    const result = runOfficialFortranSimulation(params);
    res.json(result);
  } catch (err: any) {
    console.error('Simulation error:', err);
    res.status(500).json({ error: err.message || 'Simulation execution failed' });
  }
});

// API 3: Run Energy Spectrum Sweep
app.post('/api/energy-sweep', (req: Request, res: Response) => {
  try {
    const { params, energies } = req.body;
    if (!params || !energies || !Array.isArray(energies)) {
      res.status(400).json({ error: 'Invalid parameters or energy array' });
      return;
    }

    const sweepResults = runEnergySweep(params, energies);
    res.json(sweepResults);
  } catch (err: any) {
    console.error('Energy sweep error:', err);
    res.status(500).json({ error: err.message || 'Energy sweep failed' });
  }
});

// API 4: Secure File Upload Endpoint
app.post('/api/upload-dataset', upload.single('datasetFile'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const datasetType = (req.body.datasetType as any) || 'dcs-comparison';

    // Parse data points line by line
    const lines = fileContent.split('\n');
    const parsedData: Array<{ x: number; y: number; label?: string }> = [];
    const headerLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('#') || line.startsWith('C') || line.startsWith('!')) {
        headerLines.push(line);
        continue;
      }

      // Split by space, comma, or tab
      const tokens = line.split(/[\s,\t]+/).filter(Boolean);
      if (tokens.length >= 2) {
        const x = parseFloat(tokens[0]);
        const y = parseFloat(tokens[1]);
        if (!isNaN(x) && !isNaN(y)) {
          parsedData.push({ x, y, label: tokens[2] || undefined });
        }
      }
    }

    const dataset: UploadedDataset = {
      id: `ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      filename: req.file.originalname,
      originalName: req.file.originalname,
      uploadDate: new Date().toISOString(),
      sizeBytes: req.file.size,
      type: datasetType,
      dataPointsCount: parsedData.length,
      parsedData,
      headerText: headerLines.join('\n') || 'Uploaded numeric dataset',
    };

    uploadedDatasetsStore.unshift(dataset);
    res.json({ success: true, dataset });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// API 5: List Uploaded Datasets
app.get('/api/datasets', (_req: Request, res: Response) => {
  res.json(uploadedDatasetsStore);
});

// API 6: Export Render.com Deployment Package & Fortran Files
app.get('/api/render-files', (_req: Request, res: Response) => {
  let fortranSource = OFFICIAL_ELSEPA_FORTRAN_SOURCE;
  try {
    const elsepaPath = path.join(process.cwd(), 'fortran', 'elsepa.f');
    if (fs.existsSync(elsepaPath)) {
      fortranSource = fs.readFileSync(elsepaPath, 'utf-8');
    }
  } catch (err) {
    console.error('Error reading elsepa.f:', err);
  }

  res.json({
    dockerfile: RENDER_DOCKERFILE_CONTENT,
    renderYaml: RENDER_YAML_CONTENT,
    fortranSource,
  });
});

// Vite Middleware Integration
async function startServer() {
  ensureFortranBinaryCompiled();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ELSEPA Physics Workbench running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
