<img width="1920" height="958" alt="Annotation 2026-07-27 074951" src="https://github.com/user-attachments/assets/19cee028-1294-4378-bfc2-282db1220cb3" />


# Electron Scattering Simulator (ELSEPA Physics Workbench)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://web.dev/progressive-web-apps/)

A browser-based graphical workbench (v1.2.0) for **ELSEPA** (Elastic Scattering of Electrons and Positrons by Atoms), the Dirac partial-wave code of Salvat, Jablonski and Powell. The official, unmodified ELSEPA Fortran 77 programs **ELSCATA** (atoms) and **ELSCATM** (molecules) are compiled to **WebAssembly** and run directly in the browser, so the app works on any static host and offline as an installable PWA. An optional Node/Express server can run the same Fortran natively with `gfortran`.

---

## 👨‍🔬 Authors & Research Attribution

* **Principal Research & Physics Direction**: Professor Dr. Md. Mahabub Hossain (Faculty, Department of Electronics and Communication Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU)
* **Co-Researcher**: Pankaj Bhowmik (Faculty, Department of Computer Science and Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU)
* **Software Architecture & Development**: Golam Kuadir Khan Prince (Undergraduate Student, Department of Electrical and Electronic Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU / HSTU Research Society)
* **Research Group**: **HSTU Research Society** (Hajee Mohammad Danesh Science and Technology University - HSTU)

### 📚 Core Physics Engine Attribution
All physics results come from the **ELSEPA** Fortran code developed by:
* **F. Salvat** (Universitat de Barcelona, Spain)
* **A. Jablonski** (Institute of Physical Chemistry, Polish Academy of Sciences)
* **C. J. Powell** (National Institute of Standards and Technology - NIST)

F. Salvat, A. Jablonski, C. J. Powell, *Computer Physics Communications* 165 (2005) 157–190.

The physics routines in `fortran/` are used unchanged; only file I/O was adapted (`fortran/getpath.f` resolves the atomic data directory from the `ELSEPA_DATA` environment variable).

---

## 🌟 Key Features & Functional Scope

### 1. ⚛️ Atomic Workbench (ELSCATA)
* **Targets**: atoms and positive ions, $Z = 1$ to $103$, selected from an interactive periodic table, either free or embedded in a solid (muffin-tin model). Projectile: electron ($e^-$) or positron ($e^+$).
* **Energy**: any kinetic energy accepted by ELSEPA ($E \ge 10\text{ eV}$; ELSEPA rejects lower energies), with presets from 10 eV to 1 MeV.
* **Model options exposed in the UI** (mapped onto ELSCATA input keywords in `src/physics/elsepaFortranIO.ts`):
  * **Nuclear charge distribution**: point, uniform sphere, Fermi, or Helm uniform-uniform (ELSEPA uses its own built-in nuclear parameters).
  * **Electron density**: Dirac–Fock (numerical), Dirac–Hartree–Fock–Slater, Thomas–Fermi–Dirac, or Thomas–Fermi–Molière.
  * **Ion charge** $q$ (`NELEC = Z - q`) and the **muffin-tin model** for atoms in solids (neutral atoms only), with an optional muffin-tin radius.
  * **Exchange** (electrons): none, Furness–McCarthy, Riley–Truhlar, or Thomas–Fermi.
  * **Correlation–polarization**: none, Buckingham, or LDA (user-set dipole polarizability, or ELSEPA's tabulated value).
  * **Absorption**: none or the LDA absorption potential, with adjustable strength.
* **Observables read from ELSEPA's output**: DCS ($d\sigma/d\Omega$, $\text{cm}^2/\text{sr}$ and $a_0^2/\text{sr}$) on ELSEPA's own angular grid from $0^\circ$ to $180^\circ$, Sherman function $S(\theta)$, spin-rotation functions $T(\theta)$ and $U(\theta)$ (computed from the amplitudes), scattering amplitudes $f(\theta)$ and $g(\theta)$, total elastic ($\sigma_{\text{el}}$), first ($\sigma_1$) and second ($\sigma_2$) transport cross sections, the absorption cross section, interaction potentials, real or complex phase shifts, and ELSEPA's own warnings (e.g. the angular limit of the DCS for ions).
* **Results dashboard**: log/linear DCS plot, Sherman function, polar scattering diagram, potentials, phase shifts, the generated ELSCATA input deck, and CSV/JSON export.

### 2. 🧪 Molecular Mode (ELSCATM)
* Runs ELSEPA's molecular program ELSCATM (independent-atom model with coherent addition of the atomic amplitudes).
* **Presets**: $H_2O$, $CO_2$, $CH_4$, $N_2$, $C_6H_6$, $UF_6$. Atoms can be added, removed and edited (coordinates in Å).
* Electron/positron, exchange (none / Furness–McCarthy / Riley–Truhlar), Buckingham polarization and LDA absorption options; coherent and incoherent DCS and cross sections, with CSV export.

### 3. 📈 Energy Sweep
* Runs ELSEPA at 16 fixed energies from 10 eV to 1 MeV for the current atomic setup and plots $\sigma_{\text{el}}$, $\sigma_1$ and $\sigma_2$ against energy on log–log axes.

### 4. 📊 Saved Runs & Comparative Analysis
* Save runs with full parameters and results to browser `localStorage`; import/export them as JSON.
* Overlay up to 6 saved runs, or show the percentage difference between 2 runs.
* Batch runs over a list of $Z$ values or a list of energies.
* **Clone to Workbench**: restore a saved run's parameters into the input form.

### 5. 📂 Experimental Dataset Overlay
* Upload `.dat`, `.csv` or `.txt` files (up to 5 MB). The first two numeric columns are read as angle (degrees) and DCS.
* Overlay the uploaded points on the computed ELSEPA DCS curve.

### 6. 🚀 Execution Engines
* **ELSEPA in the browser (default)**: the Fortran is translated with netlib `f2c` and compiled with Emscripten (`wasm/build.sh` → `public/elsepa/elsepa.{js,wasm,data}`). It runs in a module Web Worker with a fresh module instance per run. `src/utils/localApiFallback.ts` intercepts the app's `/api/*` requests and runs them in the browser when there is no backend, when the backend has no compiled ELSEPA binary, or when the backend's native run fails (HTTP 5xx).
* **Native ELSEPA on the optional server**: `server.ts` + `server/fortranRunner.ts` compile `fortran/` with `gfortran` and run it natively. The server never substitutes an approximate model: a missing binary or failed run returns HTTP 500, and the browser then uses WebAssembly.
* **TS Approximation (opt-in demo only)**: `src/physics/elsepaPhysicsEngine.ts` and `src/physics/molecularFallback.ts` are a simplified TypeScript model with approximate phase shifts and hard-coded molecular cross sections. They do **not** solve the Dirac equation and are used only when the user selects "TS Approximation" in the header; results are then marked with an "Approximate result" banner. Use it for qualitative demos only, never for quantitative work.

### 7. 📱 Progressive Web App (PWA) & Dark/Light Theming
* **Installable App**: `manifest.json` and the `sw.js` service worker.
* **Offline use**: the service worker precaches the app shell and the ELSEPA WebAssembly files, so calculations work without a network connection.
* **Theme System**: light and dark themes with saved preference.

---

## 🛠️ Tech Stack & Architecture

```
            ┌──────────────────────────────────────────────────────┐
            │         React 19 + Vite frontend (browser / PWA)     │
            │          fetch('/api/...')  (simulate, sweep, ...)   │
            └──────────────────────────┬───────────────────────────┘
                                       │
                    src/utils/localApiFallback.ts
               (intercepts /api/* calls made by the app)
                                       │
           backend with ELSEPA binary? │
             ┌─────────── YES ─────────┴────────── NO ───────────┐
             ▼                                                    ▼
 ┌──────────────────────────────┐   5xx      ┌──────────────────────────────────┐
 │ Optional Express server :3000│ ─────────► │ ELSEPA → WebAssembly (f2c+emcc)  │
 │ native gfortran ELSEPA       │            │ module Web Worker, in the browser│
 │ (elsepa_exec / elscatm_exec) │            │ public/elsepa/elsepa.{js,wasm}   │
 └──────────────────────────────┘            └──────────────────────────────────┘

 "TS Approximation" (header toggle, opt-in): simplified TypeScript model, not ELSEPA
```

| Layer | Technology / Library |
| :--- | :--- |
| **Frontend Framework** | React 19 with TypeScript ~5.8 & Vite 6 |
| **Styling** | Tailwind CSS v4, Lucide React Icons |
| **Data Visualization** | Recharts 3, KaTeX for equations |
| **Physics Engine** | ELSEPA (Fortran 77), compiled to WebAssembly (f2c + Emscripten); optionally native via `gfortran` |
| **Backend Server (optional)** | Express 4 on Node.js (bundled with esbuild) |
| **Persistence** | Browser `localStorage` for saved runs |
| **PWA Services** | Service Worker (`sw.js`), Web App Manifest (`manifest.json`) |

---

## 📁 Repository Directory Structure

```
├── .github/workflows/
│   └── elsepa-parity.yml     # CI: WASM vs native gfortran vs reference tables
├── Dockerfile                # Multi-stage build (node:20-slim + gfortran)
├── render.yaml               # Render.com blueprint
├── data/                     # ELSEPA atomic data files (z_NNN.den / .dfs)
├── fortran/                  # Official ELSEPA Fortran 77 sources
│   ├── elsepa.f              #   physics subroutines
│   ├── elscata.f             #   ELSCATA main program (atoms)
│   ├── elscatm.f             #   ELSCATM main program (molecules)
│   └── getpath.f             #   data-path helper (ELSEPA_DATA)
├── wasm/
│   ├── build.sh              # Fortran → f2c → Emscripten build
│   ├── f77fix.py             # Moves misplaced DATA statements so f2c accepts the source
│   ├── parity.test.ts        # WASM / native / reference parity test
│   ├── server.test.ts        # Server engine test (native ELSEPA, no silent approximation)
│   └── tests/                # Official CPC example inputs
├── validations/              # Reference ELSEPA output tables
├── public/
│   ├── elsepa/               # Compiled ELSEPA: elsepa.js, elsepa.wasm, elsepa.data
│   ├── manifest.json         # PWA Manifest
│   └── sw.js                 # Service worker (precaches app + WASM)
├── server.ts                 # Optional Express REST API server
├── server/fortranRunner.ts   # gfortran compilation & native ELSEPA execution
├── index.html
├── package.json
├── vite.config.ts
└── src/
    ├── App.tsx               # Root component & state
    ├── types.ts              # Shared TypeScript interfaces
    ├── components/
    │   ├── Header.tsx              # Navigation, engine toggle, PWA install, theme
    │   ├── InputGuiForm.tsx        # Atomic parameter form
    │   ├── PeriodicTableModal.tsx  # Periodic table Z=1 to Z=103
    │   ├── ResultsDashboard.tsx    # Plots, summary metrics, CSV/JSON export
    │   ├── PolarPlot.tsx           # Polar scattering diagram
    │   ├── MolecularWorkbench.tsx  # ELSCATM molecule builder & results
    │   ├── EnergySweepViewer.tsx   # Energy sweep chart
    │   ├── SavedRunsManager.tsx    # Saved runs, overlay, % difference, batch
    │   ├── DatasetUploadPanel.tsx  # Experimental dataset upload
    │   ├── RenderDeploymentModal.tsx # Fortran source viewer & deployment files
    │   └── PhysicsGuide.tsx        # In-app physics guide
    ├── physics/
    │   ├── elsepaFortranIO.ts      # Builds ELSEPA input decks, parses outputs
    │   ├── elsepaWasm.ts           # WASM engine client
    │   ├── elsepaWasm.worker.ts    # Web Worker running ELSEPA WASM
    │   ├── elsepaPhysicsEngine.ts  # TS Approximation (atomic, demo only)
    │   └── molecularFallback.ts    # TS Approximation (molecular, demo only)
    └── utils/
        ├── localApiFallback.ts     # /api/* interception → in-browser ELSEPA
        ├── datasetParser.ts        # Dataset parser
        └── localStorage.ts         # Saved-run persistence
```

---

## 💻 Local Setup & Installation

### Prerequisites
* **Node.js**: v18 or higher (CI uses v22)
* **npm**
* *(Optional)* **gfortran**: only for native execution on the server. The browser engine needs no compiler; the compiled WebAssembly is committed in `public/elsepa/`.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/The-Studio-of-Sadiq/Electron-Scattering.git
cd Electron-Scattering
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000`. This starts the Express server with Vite middleware. If `gfortran` is on the `PATH`, the server compiles `fortran/` into `elsepa_exec` / `elscatm_exec` on first use and runs ELSEPA natively; otherwise calculations run in the browser via WebAssembly.

To run the browser-only version (no backend), use `npx vite` instead.

### 3. Build for Production
```bash
npm run build   # vite build → dist/, plus the bundled server → dist/server.cjs
npm start       # optional: serve dist/ with the Express server
```
For static hosting, deploy the contents of `dist/` to any static host; all calculations then run in the browser.

### 4. Rebuild the WebAssembly (only if the Fortran changes)
```bash
EMSDK=/path/to/emsdk F2C_DIR=/path/to/netlib-f2c bash wasm/build.sh
```

---

## 🐳 Docker Deployment

The `Dockerfile` (based on `node:20-slim`) installs `gfortran`, compiles the ELSEPA executables, builds the frontend and bundles the Express server. `render.yaml` deploys the same image on Render.com.

```bash
docker build -t elsepa-simulator .
docker run -p 3000:3000 elsepa-simulator
```

---

## 🧪 Validation / Testing

`wasm/parity.test.ts` runs 20 cases (H, Cu, Au, Hg and H₂O; electrons and positrons; 100 eV–100 keV; Furness–McCarthy exchange, Buckingham and LDA polarization, LDA absorption; positive ions, the muffin-tin model, the Helm nucleus and the TFM, TFD and DHFS densities; input decks built by the app plus the official CPC `elscata.in` and `h2o.in` examples). It compares every number in every `dcs_*.dat` file produced by the WebAssembly build, native `gfortran` ELSEPA, and (for 13 of the cases) the reference tables in `validations/` (relative tolerance $10^{-5}$; Sherman function absolute tolerance $10^{-9}$).

`wasm/outputs.test.ts` checks that the app reads every quantity ELSEPA computes (absorption cross section, complex phase shifts, $T$ and $U$ consistent with ELSEPA's Sherman function, ELSEPA's warnings) and that every model option in the interface reaches ELSEPA. `wasm/benchmark.ts` times the WebAssembly build against native `gfortran` ELSEPA on the same inputs; CI writes the table to the run summary.

`wasm/server.test.ts` checks that the server runs native ELSEPA (including the energy sweep), returns errors rather than approximations when ELSEPA fails, and uses the TypeScript model only when it is explicitly requested.

Both run in CI (`.github/workflows/elsepa-parity.yml`). To reproduce locally:

```bash
# WASM vs validations/ (no gfortran needed)
npx tsx wasm/parity.test.ts

# Add the native gfortran comparison
mkdir -p native
gfortran -O2 -Ifortran -o native/elscata fortran/elscata.f fortran/elsepa.f
gfortran -O2 -Ifortran -o native/elscatm fortran/elscatm.f fortran/elsepa.f
NATIVE_ELSCATA=$PWD/native/elscata NATIVE_ELSCATM=$PWD/native/elscatm npx tsx wasm/parity.test.ts

# Server engine test (needs gfortran)
npx tsx wasm/server.test.ts
```

---

## 📡 API Reference

These routes are served by the optional Express server. In the browser, `src/utils/localApiFallback.ts` answers the compute routes and `/api/fortran-status` / `/api/datasets` locally when no suitable backend is present.

| Route | Description |
| :--- | :--- |
| `GET /api/fortran-status` | Whether `gfortran` and a compiled ELSEPA binary are available |
| `POST /api/simulate` | Atomic ELSCATA run; body is an `ElsepaInputParams` object (`src/types.ts`) |
| `POST /api/simulate-molecule` | Molecular ELSCATM run; body is a `MolecularInputParams` object |
| `POST /api/batch-simulate` | Several atomic/molecular runs: `{ items: [...] }` |
| `POST /api/energy-sweep` | Native ELSEPA run per energy: `{ params, energies: number[] }` |
| `POST /api/upload-dataset`, `GET /api/datasets` | Upload and list experimental datasets |
| `GET /api/render-files` | Dockerfile and `render.yaml` contents |
| `/api/fortran-source/*`, `/api/ts-source/*` | View, edit and reset the Fortran sources and the TS model (server only) |

Example `POST /api/simulate` body:
```json
{
  "z": 79, "projectile": -1, "energyEv": 1000, "massNumber": 196.97,
  "nuclearModel": "fermi", "densityModel": "dirac-fock",
  "exchangeModel": "furness-mccarthy", "polarizationModel": "none",
  "polarizability": 0, "cutoffRadius": 1.7, "absorptionModel": "none",
  "minAngle": 0, "maxAngle": 180, "angleStep": 1
}
```
The response is a `SimulationResult` (DCS, Sherman function, amplitudes, cross sections, potentials, phase shifts and the generated input deck). If ELSEPA is unavailable or fails, the server returns HTTP 500 with an `error` message.

---

### UI typography
<img width="1536" height="1024" alt="Electron scattering" src="https://github.com/user-attachments/assets/0da55e78-4019-4b29-87ab-89836808e4ef" />


## 📜 License

The code written for this project is open-source under the **MIT License** (see `LICENSE` and `Licence.txt`).

**ELSEPA is not covered by the MIT License.** The ELSEPA Fortran source (2005 version) in `fortran/` and `wasm/`, its atomic data tables in `data/`, and the WebAssembly build in `public/elsepa/` are the work of F. Salvat, A. Jablonski and C. J. Powell ([Comput. Phys. Commun. 165 (2005) 157](https://doi.org/10.1016/j.cpc.2004.09.006)) and remain subject to their authors' Computer Physics Communications Program Library licence: academic and non-profit use only, and publications that use ELSEPA must cite that article. See `Licence.txt` for details.

---

<p align="center">
  <strong>Electron Scattering Simulator</strong> • Developed by HSTU Research Society
</p>
