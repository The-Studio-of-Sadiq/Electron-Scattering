/// <reference lib="webworker" />
// Runs Salvat's ELSCATA / ELSCATM (compiled to WebAssembly by wasm/build.sh)
// off the main thread. Each run gets a fresh module instance so Fortran COMMON
// state and the virtual file system start clean.

interface RunRequest {
  id: number;
  program: 'atomic' | 'molecular';
  input: string;
}

const base = new URL(`${import.meta.env.BASE_URL}elsepa/`, self.location.origin).href;

interface Assets {
  createElsepa: (opts: Record<string, unknown>) => Promise<any>;
  wasmBinary: ArrayBuffer;
  dataPackage: ArrayBuffer;
}

let assets: Promise<Assets> | null = null;

// Fetch the module, wasm and data tables once; later runs reuse them.
function loadAssets(): Promise<Assets> {
  if (!assets) {
    const fetchBuffer = async (name: string) => {
      const res = await fetch(base + name);
      if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
      return res.arrayBuffer();
    };
    assets = Promise.all([
      import(/* @vite-ignore */ `${base}elsepa.js`),
      fetchBuffer('elsepa.wasm'),
      fetchBuffer('elsepa.data'),
    ]).then(([mod, wasmBinary, dataPackage]) => ({ createElsepa: mod.default, wasmBinary, dataPackage }));
    assets.catch(() => (assets = null));
  }
  return assets;
}

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, program, input } = event.data;
  try {
    const { createElsepa, wasmBinary, dataPackage } = await loadAssets();
    const log: string[] = [];
    let pos = 0;

    const module = await createElsepa({
      wasmBinary,
      getPreloadedPackage: () => dataPackage,
      locateFile: (name: string) => base + name,
      stdin: () => (pos < input.length ? input.charCodeAt(pos++) : null),
      print: (line: string) => log.push(line),
      printErr: (line: string) => log.push(line),
    });

    try {
      module.callMain([program]);
    } catch (err: any) {
      // Fortran STOP exits the runtime; anything else is a real failure.
      if (err?.name !== 'ExitStatus') throw err;
    }

    const files: Record<string, string> = {};
    for (const name of module.FS.readdir('/')) {
      if (name.endsWith('.dat')) files[name] = module.FS.readFile(`/${name}`, { encoding: 'utf8' });
    }
    self.postMessage({ id, files, log: log.join('\n') });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
