// Browser-only and offline operation test & benchmark.
// Drives a headless Chromium-based browser (Chrome or Edge) through the Chrome DevTools
// Protocol (CDP) using Node's built-in fetch and WebSocket (Node >= 22). No external npm deps.
//
//   npx --yes tsx@4.21.0 wasm/browser.test.ts
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import { spawn, execSync, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { buildAtomicInput } from '../src/physics/elsepaFortranIO';
import { base, read, ROOT, Program } from './harness';
import { ElsepaInputParams } from '../src/types';

const DIST_DIR = path.join(ROOT, 'dist');

let failures = 0;
function logPass(name: string) {
  console.log(`PASS  ${name}`);
}
function logFail(name: string, err: any) {
  failures++;
  console.log(`FAIL  ${name}: ${err?.message || err}`);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function findBrowserExecutable(): string {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  if (process.platform === 'win32') {
    const candidates = [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    for (const bin of ['google-chrome', 'chromium', 'chromium-browser', 'google-chrome-stable']) {
      try {
        const found = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf8' }).trim();
        if (found && fs.existsSync(found)) return found;
      } catch {}
    }
  }
  throw new Error('No Chromium-based browser executable found. Please set CHROME_PATH.');
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function createStaticServer(root: string, port: number): Promise<{ server: http.Server; stop: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      let reqPath = decodeURIComponent(parsedUrl.pathname);
      if (reqPath === '/' || reqPath.endsWith('/')) reqPath += 'index.html';

      // Serve only files inside the build folder.
      let filePath = path.resolve(root, '.' + reqPath);
      if (!filePath.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(filePath)) {
        // Fallback for SPA routing
        filePath = path.join(root, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';

      try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': data.length,
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      } catch (err: any) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(port, '127.0.0.1', () => {
      resolve({
        server,
        stop: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

interface CDPClient {
  send: (method: string, params?: Record<string, any>) => Promise<any>;
  evaluate: <T = any>(expression: string) => Promise<T>;
  close: () => void;
}

function connectCDP(wsUrl: string): Promise<CDPClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let idCounter = 0;
    const pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

    ws.onopen = () => {
      resolve({
        send: (method: string, params: Record<string, any> = {}) => {
          return new Promise((res, rej) => {
            const id = ++idCounter;
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        evaluate: async <T = any>(expression: string, retries = 15): Promise<T> => {
          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              return await new Promise((res, rej) => {
                const id = ++idCounter;
                pending.set(id, {
                  resolve: (val) => {
                    if (val?.exceptionDetails) {
                      rej(new Error(val.exceptionDetails.exception?.description || val.exceptionDetails.text));
                    } else {
                      res(val?.result?.value);
                    }
                  },
                  reject: rej,
                });
                ws.send(
                  JSON.stringify({
                    id,
                    method: 'Runtime.evaluate',
                    params: { expression, awaitPromise: true, returnByValue: true },
                  })
                );
              });
            } catch (err: any) {
              if (
                err?.message &&
                (err.message.includes('Execution context was destroyed') ||
                  err.message.includes('Cannot find context with specified id')) &&
                attempt < retries - 1
              ) {
                await new Promise((r) => setTimeout(r, 200));
                continue;
              }
              throw err;
            }
          }
          throw new Error('evaluate retries exhausted');
        },
        close: () => ws.close(),
      });
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
        else res(msg.result);
      }
    };

    ws.onerror = (err) => reject(err);
  });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`);

async function run() {
  console.log('--- Starting Browser & Offline Parity Test Suite ---');

  // Step (a): Build static site
  if (process.env.SKIP_BUILD !== '1' || !fs.existsSync(DIST_DIR)) {
    console.log('Building static site with vite build...');
    execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.log('SKIP_BUILD=1: Reusing existing dist/ directory.');
  }

  const browserPath = findBrowserExecutable();
  console.log(`Using browser executable: ${browserPath}`);

  const serverPort = await getFreePort();
  const cdpPort = await getFreePort();
  // The service worker's current cache name, so the offline check follows version bumps.
  const cacheName = read('public/sw.js').match(/CACHE_NAME\s*=\s*'([^']+)'/)?.[1];
  assert(cacheName, 'CACHE_NAME not found in public/sw.js');

  const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elsepa-browser-test-'));
  let staticServer: { stop: () => Promise<void> } | null = null;
  let browserProc: ChildProcess | null = null;
  let browserCDP: CDPClient | null = null;
  let pageCDP: CDPClient | null = null;

  try {
    console.log(`Serving dist/ on http://127.0.0.1:${serverPort} (static only, no API server)...`);
    staticServer = await createStaticServer(DIST_DIR, serverPort);

    console.log(`Launching browser with remote debugging on port ${cdpPort}...`);
    browserProc = spawn(browserPath, [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${tmpUserDataDir}`,
      '--no-first-run',
      '--disable-background-networking',
      '--disable-default-apps',
      '--no-default-browser-check',
      'about:blank',
    ]);

    // Wait for CDP endpoint
    let versionData: any = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch {}
    }
    assert(versionData?.webSocketDebuggerUrl, 'Failed to connect to browser CDP within 8 seconds');

    browserCDP = await connectCDP(versionData.webSocketDebuggerUrl);

    // Get the page target and connect to it
    const targetsRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const targets = await targetsRes.json();
    const pageInfo = targets.find((t: any) => t.type === 'page') || targets[0];
    assert(pageInfo?.webSocketDebuggerUrl, 'Failed to get page WebSocket debugger URL');

    pageCDP = await connectCDP(pageInfo.webSocketDebuggerUrl);

    // Enable required CDP domains
    await pageCDP.send('Page.enable');
    await pageCDP.send('Runtime.enable');
    await pageCDP.send('Network.enable');

    // Navigate to the static server URL
    await pageCDP.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` });

    // Wait until page is ready and root is rendered
    await pageCDP.evaluate(`(async () => {
      for (let i = 0; i < 100; i++) {
        if (document.readyState === 'complete' && document.getElementById('root')?.children?.length) {
          return true;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error('Page root element was not rendered within 10s');
    })()`);

    // Step (c): Online browser-only simulation (Au, e-, 1 keV, base params)
    try {
      const result = await pageCDP.evaluate<any>(`(async () => {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(${JSON.stringify(base)}),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error('Simulation failed with HTTP ' + res.status + ': ' + err);
        }
        return await res.json();
      })()`);

      assert(result?.summary?.sigmaElAu, 'SimulationResult missing summary.sigmaElAu');
      const sigElStr = result.summary.sigmaElAu.toPrecision(6);
      assert(
        sigElStr === '8.94335',
        `Expected total elastic cross section 8.94335 a0^2 to 6 sig figures, got ${sigElStr} (${result.summary.sigmaElAu})`
      );
      logPass('browser-only simulation: Au e- 1 keV cross section = 8.94335 a0^2');
    } catch (err: any) {
      logFail('browser-only simulation', err);
    }

    // Step (d): Wait for Service Worker to activate & cache ELSEPA assets, then go offline and test
    try {
      console.log('Waiting for Service Worker activation and ELSEPA asset caching...');
      await pageCDP.evaluate(`(async () => {
        const reg = await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
        }
        const cache = await caches.open(${JSON.stringify(cacheName)});
        for (let i = 0; i < 60; i++) {
          const wasmRes = await cache.match('/elsepa/elsepa.wasm');
          const dataRes = await cache.match('/elsepa/elsepa.data');
          const jsRes = await cache.match('/elsepa/elsepa.js');
          if (wasmRes && dataRes && jsRes) return true;
          await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('ELSEPA assets not found in service worker cache');
      })()`);

      // Emulate offline network conditions and shut down the static server
      await pageCDP.send('Network.emulateNetworkConditions', {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0,
      });
      await staticServer.stop();
      staticServer = null;

      // Reload the page while completely offline
      await pageCDP.send('Page.reload');

      // Wait for the reloaded page to be ready from cache
      await pageCDP.evaluate(`(async () => {
        for (let i = 0; i < 100; i++) {
          if (document.readyState === 'complete' && document.getElementById('root')?.children?.length) {
            return true;
          }
          await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('Offline page reload failed to render application root');
      })()`);

      // Repeat simulation in the offline page
      const offlineResult = await pageCDP.evaluate<any>(`(async () => {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(${JSON.stringify(base)}),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error('Offline simulation failed with HTTP ' + res.status + ': ' + err);
        }
        return await res.json();
      })()`);

      assert(offlineResult?.summary?.sigmaElAu, 'Offline SimulationResult missing summary.sigmaElAu');
      const offlineSigElStr = offlineResult.summary.sigmaElAu.toPrecision(6);
      assert(
        offlineSigElStr === '8.94335',
        `Expected offline total elastic cross section 8.94335 a0^2 to 6 sig figures, got ${offlineSigElStr}`
      );
      logPass('offline simulation: Service Worker cached app and reproduces 8.94335 a0^2');
    } catch (err: any) {
      logFail('offline simulation & service worker caching', err);
    }

    // Step (e): In-browser benchmarks
    try {
      const browserVersionInfo = await browserCDP.send('Browser.getVersion');
      const hwConcurrency = await pageCDP.evaluate<number>('navigator.hardwareConcurrency');

      console.log('\n--- Real Browser Benchmark (WebAssembly) ---');
      console.log(`Browser: ${browserVersionInfo.product} (${browserVersionInfo.userAgent})`);
      console.log(`Platform: ${os.platform()} ${os.release()}, Hardware Concurrency: ${hwConcurrency} threads`);
      console.log(`Median of 3 runs measured around fetch('/api/simulate') in-page.\n`);

      const benchmarkCases: Array<[string, Program, string]> = [
        ['H, e-, 1 keV', 'atomic', buildAtomicInput({ ...base, z: 1, massNumber: 1.008 })],
        ['Au, e-, 1 keV', 'atomic', buildAtomicInput(base)],
        ['Au, e-, 100 keV', 'atomic', buildAtomicInput({ ...base, energyEv: 1e5 })],
        ['Au, e-, 1 keV, Buckingham polarization', 'atomic', buildAtomicInput({ ...base, polarizationModel: 'buckingham', polarizability: 36 })],
        ['Au, e-, 1 keV, LDA absorption', 'atomic', buildAtomicInput({ ...base, absorptionModel: 'staszewska-lda' })],
        ['Hg, e-, 100 eV + 1 keV (official example)', 'atomic', read('wasm/tests/official_hg_lda_abs.in')],
        ['H2O, e-, 100 + 200 eV (official example)', 'molecular', read('wasm/tests/official_h2o.in')],
      ];

      console.log('| Case | Browser WebAssembly |');
      console.log('|---|---|');

      for (const [name, program, input] of benchmarkCases) {
        const timings: number[] = [];
        for (let run = 0; run < 3; run++) {
          const elapsed = await pageCDP.evaluate<number>(`(async () => {
            const t0 = performance.now();
            const res = await fetch('/api/simulate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ program: ${JSON.stringify(program)}, rawInput: ${JSON.stringify(input)} }),
            });
            if (!res.ok) throw new Error('Benchmark fetch failed: ' + res.status);
            await res.json();
            return performance.now() - t0;
          })()`);
          timings.push(elapsed);
        }
        const medTime = median(timings);
        console.log(`| ${name} | ${fmt(medTime)} |`);
      }
      console.log('');
      logPass('browser benchmark completed successfully');
    } catch (err: any) {
      logFail('browser benchmark', err);
    }
  } finally {
    // Step (f): Cleanup
    if (pageCDP) pageCDP.close();
    if (browserCDP) browserCDP.close();
    if (browserProc && browserProc.exitCode === null) {
      const exited = new Promise((r) => browserProc!.once('exit', r));
      browserProc.kill();
      await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
    }
    try {
      await staticServer?.stop();
    } catch {}
    // The browser can hold its profile open briefly after exiting.
    for (let i = 0; i < 10; i++) {
      try {
        fs.rmSync(tmpUserDataDir, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('Unhandled fatal error in browser.test.ts:', err);
  process.exit(1);
});
