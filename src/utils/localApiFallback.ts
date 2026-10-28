/// <reference types="vite/client" />
import { runDiracPartialWaveSimulation, runEnergySweep } from '../physics/elsepaPhysicsEngine';
import { runFallbackMolecularSimulation } from '../physics/molecularFallback';
import { runElsepaWasmAtomic, runElsepaWasmMolecular, runElsepaWasmEnergySweep } from '../physics/elsepaWasm';
import { parseUploadedDataset } from './datasetParser';
import { RENDER_DOCKERFILE_CONTENT, RENDER_YAML_CONTENT } from '../data/elsepaFortranSource';
import { UploadedDataset } from '../types';

// When the app is served as a static site (e.g. Vercel) there is no Express
// backend, so /api/* requests 404 or return the SPA's HTML. This shim detects
// that and answers those requests in the browser. Simulations run the official
// ELSEPA Fortran compiled to WebAssembly (public/elsepa, built by wasm/build.sh);
// the approximate TypeScript engine is only used when explicitly selected.
//
// The same in-browser Fortran engine is used when a backend exists but has no
// compiled ELSEPA binary (no gfortran), since that backend would otherwise
// silently answer with the TypeScript approximation.

// Loaded lazily so the ~250 KB of Fortran source only downloads when viewed.
const fortranSources = import.meta.glob('../../fortran/*.f', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;
const tsEngineSource = import.meta.glob('../physics/elsepaPhysicsEngine.ts', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;

const localDatasets: UploadedDataset[] = [];
const COMPUTE_ROUTES = new Set(['/api/simulate', '/api/simulate-molecule', '/api/batch-simulate', '/api/energy-sweep']);

const wantsTypeScript = (params: any) => params?.forceEngine === 'typescript' || params?.forceEngine === 'ts';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const serverOnly = () =>
  jsonResponse(
    { error: 'This feature needs the local Node server (npm run dev). The browser-only build cannot edit or compile source files.' },
    503
  );

function isBackendResponse(res: Response): boolean {
  return (res.headers.get('content-type') || '').includes('application/json');
}

async function readJsonBody(init?: RequestInit): Promise<any> {
  if (typeof init?.body !== 'string') return {};
  return JSON.parse(init.body);
}

async function handleLocally(pathname: string, search: string, method: string, init?: RequestInit): Promise<Response> {
  try {
    if (method === 'GET' && pathname === '/api/fortran-status') {
      return jsonResponse({
        hasGFortran: true,
        hasElsepaBinary: true,
        versionInfo: 'Official ELSEPA Fortran (Salvat, Jablonski & Powell) compiled to WebAssembly, running in this browser.',
        gfortranPath: 'WebAssembly (f2c + Emscripten)',
      });
    }

    if (method === 'GET' && pathname === '/api/datasets') {
      return jsonResponse(localDatasets);
    }

    if (method === 'POST' && pathname === '/api/simulate') {
      const params = await readJsonBody(init);
      if (!params || !params.z || !params.energyEv) {
        return jsonResponse({ error: 'Missing required simulation parameters (z, energyEv)' }, 400);
      }
      return jsonResponse(wantsTypeScript(params) ? runDiracPartialWaveSimulation(params) : await runElsepaWasmAtomic(params));
    }

    if (method === 'POST' && pathname === '/api/simulate-molecule') {
      const params = await readJsonBody(init);
      if (!params || !params.atoms || params.atoms.length === 0 || !params.energyEv) {
        return jsonResponse({ error: 'Missing required molecular simulation parameters (atoms, energyEv)' }, 400);
      }
      return jsonResponse(
        wantsTypeScript(params) ? runFallbackMolecularSimulation(params, performance.now(), '') : await runElsepaWasmMolecular(params)
      );
    }

    if (method === 'POST' && pathname === '/api/batch-simulate') {
      const { items } = await readJsonBody(init);
      if (!items || !Array.isArray(items)) {
        return jsonResponse({ error: 'Invalid batch items array' }, 400);
      }
      const results: any[] = [];
      for (const item of items) {
        if (item.type === 'molecular' && item.molecularParams) {
          const p = item.molecularParams;
          results.push({
            type: 'molecular',
            result: wantsTypeScript(p) ? runFallbackMolecularSimulation(p, performance.now(), '') : await runElsepaWasmMolecular(p),
          });
        } else if (item.atomicParams) {
          const p = item.atomicParams;
          results.push({ type: 'atomic', result: wantsTypeScript(p) ? runDiracPartialWaveSimulation(p) : await runElsepaWasmAtomic(p) });
        }
      }
      return jsonResponse({ success: true, count: results.length, results });
    }

    if (method === 'POST' && pathname === '/api/energy-sweep') {
      const { params, energies } = await readJsonBody(init);
      if (!params || !energies || !Array.isArray(energies)) {
        return jsonResponse({ error: 'Invalid parameters or energy array' }, 400);
      }
      return jsonResponse(wantsTypeScript(params) ? runEnergySweep(params, energies) : await runElsepaWasmEnergySweep(params, energies));
    }

    if (method === 'POST' && pathname === '/api/upload-dataset') {
      const form = init?.body instanceof FormData ? init.body : null;
      const file = form?.get('datasetFile');
      if (!(file instanceof File)) {
        return jsonResponse({ error: 'No file uploaded' }, 400);
      }
      if (file.size > 5 * 1024 * 1024) {
        return jsonResponse({ error: 'File too large (5 MB max)' }, 400);
      }
      const datasetType = (form!.get('datasetType') as UploadedDataset['type']) || 'dcs-comparison';
      const dataset = parseUploadedDataset(await file.text(), file.name, file.size, datasetType);
      localDatasets.unshift(dataset);
      return jsonResponse({ success: true, dataset });
    }

    if (method === 'GET' && pathname === '/api/render-files') {
      const loadElsepa = fortranSources['../../fortran/elsepa.f'];
      return jsonResponse({
        dockerfile: RENDER_DOCKERFILE_CONTENT,
        renderYaml: RENDER_YAML_CONTENT,
        fortranSource: loadElsepa ? await loadElsepa() : '',
      });
    }

    if (method === 'GET' && pathname === '/api/fortran-source/files') {
      const files = await Promise.all(
        Object.entries(fortranSources).map(async ([key, load]) => {
          const content = await load();
          return {
            name: key.split('/').pop()!,
            lineCount: content.split('\n').length,
            sizeBytes: new Blob([content]).size,
            modified: false,
          };
        })
      );
      return jsonResponse({ files });
    }

    if (method === 'GET' && pathname === '/api/fortran-source/content') {
      const filename = new URLSearchParams(search).get('filename') || 'elsepa.f';
      const load = fortranSources[`../../fortran/${filename.split('/').pop()}`];
      if (!load) return jsonResponse({ error: `Fortran file ${filename} does not exist` }, 500);
      return jsonResponse({ name: filename, content: await load(), modified: false });
    }

    if (method === 'GET' && pathname === '/api/ts-source/content') {
      const load = Object.values(tsEngineSource)[0];
      return jsonResponse({ name: 'elsepaPhysicsEngine.ts', content: load ? await load() : '', modified: false });
    }

    if (pathname.startsWith('/api/fortran-source/') || pathname.startsWith('/api/ts-source/')) {
      return serverOnly();
    }

    return jsonResponse({ error: `Unknown API route ${pathname}` }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'In-browser computation failed' }, 500);
  }
}

type BackendState = 'none' | 'no-fortran' | 'fortran';

export function installLocalApiFallback(): void {
  const nativeFetch = window.fetch.bind(window);

  // Probed once: is there an Express backend, and can it run the real Fortran?
  let backendState: Promise<BackendState> | null = null;
  const probeBackend = () =>
    (backendState ??= nativeFetch('/api/fortran-status')
      .then(async (res): Promise<BackendState> => {
        if (!isBackendResponse(res)) return 'none';
        const status = await res.json();
        return status?.hasElsepaBinary ? 'fortran' : 'no-fortran';
      })
      .catch((): BackendState => 'none')
      .then((state) => {
        if (state !== 'fortran') {
          console.info(
            state === 'none'
              ? '[ELSEPA] No backend server detected; running ELSEPA (WebAssembly) in the browser.'
              : '[ELSEPA] Backend has no compiled ELSEPA binary; running ELSEPA (WebAssembly) in the browser.'
          );
        }
        return state;
      }));

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return nativeFetch(input, init);
    }

    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const state = await probeBackend();

    const runInBrowser =
      state === 'none' || (state === 'no-fortran' && (COMPUTE_ROUTES.has(url.pathname) || url.pathname === '/api/fortran-status'));

    return runInBrowser ? handleLocally(url.pathname, url.search, method, init) : nativeFetch(input, init);
  };
}
