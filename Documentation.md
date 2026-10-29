# Electron Scattering Simulator (ELSEPA Physics Workbench)
## Comprehensive Technical & Architectural Documentation (v1.2.0)

---

### Table of Contents
1. [Executive Overview & Vision](#1-executive-overview--vision)
2. [Authorship, Affiliations & Research Attribution](#2-authorship-affiliations--research-attribution)
3. [Core Feature Modules & User Interface](#3-core-feature-modules--user-interface)
   - [3.1 Atomic Physics Workbench](#31-atomic-physics-workbench)
   - [3.2 Molecular Mode (ELSCATM)](#32-molecular-mode-elscatm)
   - [3.3 Energy Spectrum Sweep Viewer](#33-energy-spectrum-sweep-viewer)
   - [3.4 Saved Runs & Comparison Engine](#34-saved-runs--comparison-engine)
   - [3.5 Experimental Dataset Upload & Curve Overlay](#35-experimental-dataset-upload--curve-overlay)
   - [3.6 Fortran Source Code & Deployment Tab](#36-fortran-source-code--deployment-tab)
   - [3.7 Physics Guide & Dirac Theory](#37-physics-guide--dirac-theory)
4. [Relativistic Dirac Scattering Theory & Mathematical Physics](#4-relativistic-dirac-scattering-theory--mathematical-physics)
   - [4.1 Coupled Radial Dirac System](#41-coupled-radial-dirac-system)
   - [4.2 Partial-Wave Phase Shifts & Scattering Amplitudes](#42-partial-wave-phase-shifts--scattering-amplitudes)
   - [4.3 Interaction Potentials V(r)](#43-interaction-potentials-vr)
   - [4.4 Physical Observables & Cross Sections](#44-physical-observables--cross-sections)
   - [4.5 Molecular Independent Atom Model (IAM) & Interference](#45-molecular-independent-atom-model-iam--interference)
5. [System Architecture & Execution Engines](#5-system-architecture--execution-engines)
   - [5.1 ELSEPA Compiled to WebAssembly (Primary Engine)](#51-elsepa-compiled-to-webassembly-primary-engine)
   - [5.2 Optional Native gfortran Server](#52-optional-native-gfortran-server)
   - [5.3 TS Approximation (Opt-in Demo Model)](#53-ts-approximation-opt-in-demo-model)
   - [5.4 REST API Endpoints](#54-rest-api-endpoints)
   - [5.5 React + Vite Frontend State Architecture](#55-react--vite-frontend-state-architecture)
6. [Data Models & TypeScript Interface Specifications](#6-data-models--typescript-interface-specifications)
7. [Visual Identity, Branding, PWA & SVG Asset Suite](#7-visual-identity-branding-pwa--svg-asset-suite)
8. [Docker Containerization & Cloud Deployment Guide](#8-docker-containerization--cloud-deployment-guide)
9. [Validation & Testing](#9-validation--testing)
10. [Complete Codebase Directory Map & File Inventory](#10-complete-codebase-directory-map--file-inventory)
11. [Academic References & Literature Citations](#11-academic-references--literature-citations)

---

### 1. Executive Overview & Vision

The **Electron Scattering Simulator (ELSEPA Physics Workbench)** is a web application for relativistic (Dirac partial-wave) calculations of elastic electron ($e^-$) and positron ($e^+$) scattering by atoms and molecules.

All physics results come from the **ELSEPA** (Elastic Scattering of Electrons and Positrons by Atoms) Fortran 77 package of Francesc Salvat, Aleksander Jablonski, and Cedric J. Powell: the programs **ELSCATA** (atoms) and **ELSCATM** (molecules). The ELSEPA physics routines are used unmodified; only file I/O was adapted. The Fortran is compiled to **WebAssembly** and runs inside the user's browser, so the application can be served from any static host and used offline as an installable Progressive Web App. An optional Node/Express server runs the same Fortran natively with `gfortran`.

The application adds an input form, interactive plotting, energy sweeps, a molecular geometry editor, saved-run comparison, and overlay of experimental datasets.

---

### 2. Authorship, Affiliations & Research Attribution

This software platform and research interface was developed by researchers and software architects at **Hajee Mohammad Danesh Science and Technology University (HSTU)** and the **HSTU Research Society**:

* **Software Architecture & Full-Stack Development**:
  * **Golam Kuadir Khan Prince** (Undergraduate Student, Department of Electrical and Electronic Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU / HSTU Research Society)
* **Principal Research & Physics Direction**:
  * **Professor Dr. Md. Mahabub Hossain** (Faculty, Department of Electronics and Communication Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU)
* **Co-Researcher**:
  * **Pankaj Bhowmik** (Faculty, Department of Computer Science and Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU)
* **Research Group & Institution**:
  * **HSTU Research Society**, Dinajpur 5200, Bangladesh.

#### Core Physics Engine Attribution
* **Original Fortran 77 Code (ELSEPA / ELSCATA / ELSCATM)**:
  * **Francesc Salvat** (Facultat de Física, Universitat de Barcelona, Spain)
  * **Aleksander Jablonski** (Institute of Physical Chemistry, Polish Academy of Sciences, Warsaw, Poland)
  * **Cedric J. Powell** (National Institute of Standards and Technology - NIST, Gaithersburg, MD, USA)
  * Published in: *Computer Physics Communications* 165, 157–190 (2005).

---

### 3. Core Feature Modules & User Interface

#### 3.1 Atomic Physics Workbench
* **Interactive Parameter Configuration** (`src/components/InputGuiForm.tsx`; mapped to ELSCATA keywords by `buildAtomicInput` in `src/physics/elsepaFortranIO.ts`):
  * **Target Element Selector**: neutral free atoms, $Z = 1$ to $Z = 103$, chosen from a periodic table (`NELEC = Z`, no muffin-tin).
  * **Projectile Selection**: Electron ($e^-$) or Positron ($e^+$).
  * **Kinetic Energy**: direct input in eV, keV or MeV, with presets from 10 eV to 1 MeV. ELSEPA rejects energies below 10 eV.
  * **Nuclear Charge Models**: Point Charge, Uniform Sphere, or Fermi distribution (`MNUCL` 1/2/3). ELSEPA uses its own built-in nuclear parameters.
  * **Electron Density**: Dirac–Fock (`MELEC 4`, always).
  * **Exchange Potentials ($e^-$)**: None, Furness–McCarthy, Riley–Truhlar, or Thomas–Fermi (`MEXCH` 0/1/3/2; the Thomas–Fermi option is labelled "Free Electron Gas" in the UI).
  * **Correlation–Polarization**: None or Buckingham (`MCPOL` 0/1), with a user-set dipole polarizability; the cutoff parameter is left to ELSEPA's default.
  * **Absorption**: None or the LDA absorption potential (`MABS` 1) with adjustable strength.
  * High-energy factorization is enabled (`IHEF 2`).
  * The mass number, Fermi $c$/$t$, cutoff radius and angle-grid fields are kept in the parameter object but are **not** passed to ELSEPA; results are reported on ELSEPA's own fixed angular grid (about 606 angles from $0^\circ$ to $180^\circ$).
* **Results Dashboard** (`src/components/ResultsDashboard.tsx`):
  * **Differential Cross Section (DCS)** plot: logarithmic and linear scales for $d\sigma/d\Omega$ ($\text{cm}^2/\text{sr}$, $a_0^2/\text{sr}$) vs. scattering angle $\theta$.
  * **Sherman Function $S(\theta)$**.
  * **Cross Section Summary**: Total Elastic ($\sigma_{\text{el}}$), 1st Transport ($\sigma_1$), and 2nd Transport ($\sigma_2$) cross sections.
  * **Scattering amplitudes, interaction potentials and phase shifts** read from ELSEPA's output files.
  * **Polar Scattering Diagram** (`PolarPlot.tsx`).
  * The generated ELSCATA input deck, and CSV/JSON export.
  * The spin-rotation functions $T(\theta)$, $U(\theta)$ and the absorption cross section are not read from ELSEPA's output; their fields hold fixed placeholder values.

#### 3.2 Molecular Mode (ELSCATM)
* **Molecular Target Builder** (`src/components/MolecularWorkbench.tsx`):
  * Presets: $H_2O$, $CO_2$, $CH_4$, $N_2$, $C_6H_6$, $UF_6$.
  * Editable atom list (add, remove, edit $Z$ and Cartesian coordinates in Å).
  * Projectile, exchange (None / Furness–McCarthy / Riley–Truhlar), Buckingham polarization and LDA absorption options.
* **Calculation**: runs ELSEPA's ELSCATM program, which uses the independent-atom model (Section 4.5) and reports coherent and incoherent DCS and integrated cross sections. No Debye–Waller (thermal vibration) correction is applied.

#### 3.3 Energy Spectrum Sweep Viewer
* `src/components/EnergySweepViewer.tsx` runs ELSEPA for the current atomic parameters at 16 fixed energies from 10 eV to 1 MeV (10, 20, 50 … 500 keV, 1 MeV).
* Plots $\sigma_{\text{el}}(E)$, $\sigma_1(E)$ and $\sigma_2(E)$ on a log–log chart.

#### 3.4 Saved Runs & Comparison Engine
* `src/components/SavedRunsManager.tsx`, `src/utils/localStorage.ts`:
  * Saves full parameters and results in browser `localStorage`; JSON export and import.
  * Overlays up to 6 saved runs, or shows the percentage difference between 2 runs.
  * Batch runs over a list of $Z$ values or a list of energies.
  * "Clone to Workbench" restores a saved run's parameters into the input form.

#### 3.5 Experimental Dataset Upload & Curve Overlay
* `src/components/DatasetUploadPanel.tsx`, `src/utils/datasetParser.ts`:
  * Upload of `.dat`, `.csv` or `.txt` files up to 5 MB.
  * The first two numeric columns of each line are read as angle (degrees) and DCS.
  * The selected dataset is overlaid as points on the computed DCS curve in the Results Dashboard.

#### 3.6 Fortran Source Code & Deployment Tab
* `src/components/RenderDeploymentModal.tsx`:
  * **Source Code Viewer**: the ELSEPA Fortran 77 sources (`elsepa.f`, `elscata.f`, `elscatm.f`, `getpath.f`) and the TS Approximation source. With the Node server running, sources can be edited and reset; saving triggers recompilation with `gfortran`. The browser-only build is read-only.
  * **Engine Status**: reports whether `gfortran` and a compiled ELSEPA binary are available on the server, or that ELSEPA is running as WebAssembly in the browser.
  * **Deployment files**: the `Dockerfile` and `render.yaml` used for container deployment (Section 8).

#### 3.7 Physics Guide & Dirac Theory
* `src/components/PhysicsGuide.tsx`: an in-app guide covering the radial Dirac equations, interaction potentials, partial-wave phase shifts, observables, molecular IAM theory, and literature citations.

---

### 4. Relativistic Dirac Scattering Theory & Mathematical Physics

This section summarizes the theory implemented by ELSEPA (Salvat, Jablonski & Powell, 2005). The application itself does not re-implement it; it prepares ELSEPA input and displays ELSEPA output.

#### 4.1 Coupled Radial Dirac System
The interaction of a projectile of rest mass $m_e$ and kinetic energy $E$ with a central potential $V(r)$ is governed by the Dirac equation:

$$\left[ c \boldsymbol{\alpha} \cdot \mathbf{p} + \beta m_e c^2 + V(r) \right] \Psi = (E + m_e c^2) \Psi$$

For a spherically symmetric potential, separating radial and angular variables with spherical spinors yields two coupled first-order equations for the large and small radial functions $g_\kappa(r)$ and $f_\kappa(r)$:

$$\frac{dg_\kappa}{dr} = -\frac{\kappa}{r} g_\kappa(r) + \frac{E + 2 m_e c^2 - V(r)}{\hbar c} f_\kappa(r)$$

$$\frac{df_\kappa}{dr} = \frac{\kappa}{r} f_\kappa(r) - \frac{E - V(r)}{\hbar c} g_\kappa(r)$$

Here $\kappa$ is the relativistic angular momentum quantum number:
* $\kappa = l$ for $j = l - 1/2$
* $\kappa = -(l+1)$ for $j = l + 1/2$

#### 4.2 Partial-Wave Phase Shifts & Scattering Amplitudes
Beyond the range of the (screened) potential, the radial function takes the free-wave form

$$g_\kappa(r) \xrightarrow[r \to \infty]{} A_\kappa \left[ \cos\delta_\kappa \, j_l(kr) - \sin\delta_\kappa \, n_l(kr) \right]$$

and matching the numerical solution to this form determines the phase shift $\delta_\kappa$ (for potentials with a Coulomb tail, Coulomb functions are used instead).

The direct amplitude $f(\theta)$ and spin-flip amplitude $g(\theta)$ are obtained from the phase shifts:

$$f(\theta) = \frac{1}{2ik} \sum_{l=0}^\infty \left[ (l+1)\left(e^{2i\delta_{\kappa=-l-1}} - 1\right) + l\left(e^{2i\delta_{\kappa=l}} - 1\right) \right] P_l(\cos\theta)$$

$$g(\theta) = \frac{1}{2ik} \sum_{l=1}^\infty \left[ e^{2i\delta_{\kappa=l}} - e^{2i\delta_{\kappa=-l-1}} \right] P_l^1(\cos\theta)$$

where $P_l(\cos\theta)$ are Legendre polynomials and $P_l^1(\cos\theta)$ are associated Legendre functions.

#### 4.3 Interaction Potentials V(r)
The optical-model potential is

$$V(r) = V_{\text{st}}(r) + V_{\text{ex}}(r) + V_{\text{cp}}(r) - i W_{\text{abs}}(r)$$

1. **Static Electrostatic Potential $V_{\text{st}}(r)$** ($Z_0 = -1$ for electrons, $+1$ for positrons), from the nuclear charge distribution and the electron density $\rho_e(r)$; for a point nucleus:
   $$V_{\text{st}}(r) = Z_0 e \left[ \frac{Z e}{r} - 4\pi e \int_0^\infty \rho_e(r') \frac{r'^2}{r_>} dr' \right], \qquad r_> = \max(r, r')$$

2. **Furness–McCarthy Local Exchange $V_{\text{ex}}(r)$** (electrons only):
   $$V_{\text{ex}}^{\text{FM}}(r) = \frac{1}{2} \left[ E - V_{\text{st}}(r) \right] - \frac{1}{2} \left[ \left(E - V_{\text{st}}(r)\right)^2 + 4\pi a_0 e^4 \rho_e(r) \right]^{1/2}$$

3. **Buckingham Correlation–Polarization $V_{\text{cp}}(r)$**:
   $$V_{\text{cp}}^{\text{B}}(r) = -\frac{\alpha_d e^2}{2 (r^2 + d^2)^2}$$
   where $\alpha_d$ is the dipole polarizability and $d$ a cutoff parameter. ELSEPA's alternative LDA option (not exposed in the UI) joins this long-range form to a local-density correlation potential at short distances.

4. **Absorption Potential $W_{\text{abs}}(r)$**: ELSEPA's LDA absorption potential, describing loss of flux to inelastic channels, scaled by the user-set strength parameter.

#### 4.4 Physical Observables & Cross Sections
* **Differential Cross Section (DCS)**:
  $$\frac{d\sigma}{d\Omega}(\theta) = |f(\theta)|^2 + |g(\theta)|^2$$

* **Sherman Function $S(\theta)$**:
  $$S(\theta) = i \frac{f(\theta)g^*(\theta) - f^*(\theta)g(\theta)}{|f(\theta)|^2 + |g(\theta)|^2} = -\frac{2 \,\text{Im}[f(\theta)g^*(\theta)]}{\frac{d\sigma}{d\Omega}(\theta)}$$

* **Total Elastic Cross Section $\sigma_{\text{el}}$**:
  $$\sigma_{\text{el}} = 2\pi \int_0^\pi \frac{d\sigma}{d\Omega}(\theta) \sin\theta \, d\theta$$

* **First & Second Transport Cross Sections ($\sigma_1, \sigma_2$)**:
  $$\sigma_1 = 2\pi \int_0^\pi \frac{d\sigma}{d\Omega}(\theta) (1 - \cos\theta) \sin\theta \, d\theta$$
  $$\sigma_2 = 3\pi \int_0^\pi \frac{d\sigma}{d\Omega}(\theta) \sin^3\theta \, d\theta$$

#### 4.5 Molecular Independent Atom Model (IAM) & Interference
For a molecule of $N$ atoms at positions $\mathbf{r}_i$, ELSCATM adds the atomic amplitudes coherently and averages over molecular orientations:

$$\left(\frac{d\sigma}{d\Omega}\right)_{\text{mol}}(\theta) = \sum_{i=1}^N \left(\frac{d\sigma}{d\Omega}\right)_i + \sum_{i \neq j}^N \left[ f_i(\theta)f_j^*(\theta) + g_i(\theta)g_j^*(\theta) \right] \frac{\sin(q R_{ij})}{q R_{ij}}$$

where $q = 2k \sin(\theta/2)$ is the momentum transfer and $R_{ij} = |\mathbf{r}_i - \mathbf{r}_j|$.

---

### 5. System Architecture & Execution Engines

The frontend always calls the same `/api/*` routes. `src/utils/localApiFallback.ts` wraps `fetch` and decides where each compute request (`/api/simulate`, `/api/simulate-molecule`, `/api/batch-simulate`, `/api/energy-sweep`) runs:

```
                    ┌──────────────────────────────────────┐
                    │  React + Vite frontend (browser/PWA) │
                    └──────────────────┬───────────────────┘
                                       │ fetch('/api/...')
                    ┌──────────────────▼───────────────────┐
                    │   src/utils/localApiFallback.ts      │
                    └───────┬──────────────────────┬───────┘
     backend has ELSEPA     │                      │  no backend, or backend
     binary                 ▼                      ▼  without ELSEPA binary
   ┌─────────────────────────────┐  HTTP 5xx  ┌─────────────────────────────┐
   │ Optional Express server     │ ─────────► │ ELSEPA WebAssembly          │
   │ server.ts (port 3000)       │            │ (f2c + Emscripten)          │
   │ server/fortranRunner.ts     │            │ module Web Worker           │
   │ native gfortran ELSEPA      │            │ public/elsepa/elsepa.*      │
   └─────────────────────────────┘            └─────────────────────────────┘

   "TS Approximation" selected in the header → simplified TypeScript model
   (src/physics/elsepaPhysicsEngine.ts, molecularFallback.ts), not ELSEPA
```

#### 5.1 ELSEPA Compiled to WebAssembly (Primary Engine)
* **Build** (`wasm/build.sh`, only needed when the Fortran changes; the output is committed): the Fortran 77 sources are translated to C with netlib `f2c` and compiled with Emscripten to `public/elsepa/elsepa.js`, `elsepa.wasm`, and `elsepa.data` (the packaged atomic data files from `data/`). `wasm/f77fix.py` moves DATA statements that precede specification statements, which `f2c` (strict Fortran 77) requires; this reorders non-executable statements only.
* **Execution** (`src/physics/elsepaWasm.ts`, `src/physics/elsepaWasm.worker.ts`): ELSEPA runs in a module Web Worker. Each run uses a fresh module instance: the input deck from `src/physics/elsepaFortranIO.ts` is supplied as standard input, and the output files ELSEPA writes (`dcs_*.dat`, `scatamp.dat`, `scfield.dat`, `dpwa.dat`) are parsed back into `SimulationResult` / `MolecularSimulationResult` objects.
* **Routing** (`src/utils/localApiFallback.ts`): compute routes run in the browser when there is no backend (static hosting), when the backend reports no compiled ELSEPA binary, or when the backend's native run returns HTTP 5xx.
* **Offline**: the service worker (`public/sw.js`) precaches the app shell and the three ELSEPA WebAssembly files.

#### 5.2 Optional Native gfortran Server
* `server.ts` (Express, port 3000) and `server/fortranRunner.ts`.
* If `gfortran` is installed, compiles `fortran/elscata.f` + `fortran/elsepa.f` into `elsepa_exec` and `fortran/elscatm.f` + `fortran/elsepa.f` into `elscatm_exec` on first use.
* Runs the binary with Node's `child_process.execSync`, writing the input deck to a temporary run directory and setting `ELSEPA_DATA` to `data/`; the output files are parsed with the same code as the WebAssembly engine.
* `/api/energy-sweep` runs native ELSEPA once per energy (`runOfficialEnergySweep`).
* The server never substitutes the TypeScript model for ELSEPA: if the binary is missing or a run fails, it returns HTTP 500 with an error message, and the browser then uses the WebAssembly engine.

#### 5.3 TS Approximation (Opt-in Demo Model)
* `src/physics/elsepaPhysicsEngine.ts` (atoms) and `src/physics/molecularFallback.ts` (molecules).
* This is **not** a Dirac solver: it uses ad hoc approximate phase shifts, and the molecular model uses hard-coded cross sections. It exists only for qualitative demonstrations.
* Used only when the user selects "TS Approximation" in the header (`forceEngine: 'typescript'`). Results are then shown with an "Approximate result" banner.

#### 5.4 REST API Endpoints
Served by `server.ts`. Without a backend, `localApiFallback.ts` answers the compute routes, `/api/fortran-status`, `/api/datasets` and `/api/upload-dataset` in the browser; source editing needs the server.
* `GET /api/fortran-status`: `gfortran` version/path and whether an ELSEPA binary is available.
* `POST /api/simulate`: atomic ELSCATA run (`ElsepaInputParams` → `SimulationResult`).
* `POST /api/simulate-molecule`: molecular ELSCATM run (`MolecularInputParams` → `MolecularSimulationResult`).
* `POST /api/batch-simulate`: list of atomic and/or molecular runs.
* `POST /api/energy-sweep`: `{ params, energies }` → `EnergySweepPoint[]`, one native ELSEPA run per energy.
* `POST /api/upload-dataset`, `GET /api/datasets`: experimental dataset upload (5 MB limit) and listing.
* `GET /api/render-files`: `Dockerfile` and `render.yaml` contents.
* `GET /api/fortran-source/files`, `GET /api/fortran-source/content`, `POST /api/fortran-source/save`, `POST /api/fortran-source/reset`: view, edit and reset the Fortran sources (saving recompiles).
* `GET /api/ts-source/content`, `POST /api/ts-source/save`, `POST /api/ts-source/reset`: the same for the TS Approximation source.

#### 5.5 React + Vite Frontend State Architecture
* Built with **React 19**, **TypeScript ~5.8**, **Vite 6**, **Tailwind CSS 4**, **Recharts 3** and **KaTeX**.
* `src/App.tsx` holds the application state (active tab, parameters, results, engine preference, datasets, saved runs) and passes it to the tab components; light/dark theme preference is saved in the browser.

---

### 6. Data Models & TypeScript Interface Specifications

Core data contracts defined in `src/types.ts` (abridged):

```typescript
export type NuclearModel = 'point' | 'uniform' | 'fermi';
export type ExchangeModel = 'none' | 'furness-mccarthy' | 'riley-truhlar' | 'free-electron-gas';
export type PolarizationModel = 'none' | 'buckingham';
export type AbsorptionModel = 'none' | 'staszewska-lda';

export interface ElsepaInputParams {
  z: number;                   // Atomic number Z (1..103)
  projectile: -1 | 1;          // -1 electron, +1 positron
  energyEv: number;            // Kinetic energy in eV (ELSEPA requires >= 10 eV)
  massNumber: number;          // not passed to ELSEPA
  nuclearModel: NuclearModel;
  fermiC?: number; fermiT?: number; // not passed to ELSEPA
  densityModel: 'dirac-fock' | 'thomas-fermi' | 'custom-file'; // UI always uses 'dirac-fock'
  exchangeModel: ExchangeModel;
  polarizationModel: PolarizationModel;
  polarizability: number;      // alpha_d in a0^3 (converted to cm^3 for ELSEPA)
  cutoffRadius: number;        // not passed to ELSEPA (ELSEPA default used)
  absorptionModel: AbsorptionModel;
  absorptionStrength?: number;
  minAngle: number; maxAngle: number; angleStep: number; // not passed; ELSEPA's own grid is used
}

export interface ScatteringDataPoint {
  angleDeg: number; angleRad: number;
  dcsAu: number;               // a0^2/sr
  dcsCm2: number;              // cm^2/sr
  dcsAngstrom2: number;        // Angstrom^2/sr
  shermanS: number;            // Sherman function S(theta)
  spinT: number; spinU: number; // placeholders (not read from ELSEPA output)
  reF: number; imF: number; reG: number; imG: number; // amplitudes f, g
}

export interface SimulationResult {
  params: ElsepaInputParams;
  element: ElementData;
  scatteringData: ScatteringDataPoint[];
  potentialProfile: PotentialPoint[];
  phaseShifts: PhaseShiftPoint[];
  summary: {
    sigmaElAu: number; sigmaElCm2: number;
    sigma1Au: number; sigma1Cm2: number;
    sigma2Au: number;
    sigmaAbsAu: number;        // placeholder (not read from ELSEPA output)
    computationTimeMs: number;
    engineUsed: 'salvat-official-fortran' | 'fortran-native' | 'typescript-dirac-solver';
    // ... plus k, gamma, beta, maxL
  };
  elsepaInputFileText: string; // the ELSCATA input deck that was run
}
```

`MolecularInputParams`, `MolecularSimulationResult` (coherent and incoherent DCS and cross sections), `EnergySweepPoint`, `UploadedDataset` and `SavedSimulationRun` are defined in the same file.

---

### 7. Visual Identity, Branding, PWA & SVG Asset Suite

The website features a custom vector logo design depicting an incoming electron trajectory ($e^-$), central atomic nucleus target, polar scattering lobe, and code symbol (`</>`).

#### Vector Asset Inventory (`/public/` & `/src/components/`):
* `src/components/Logo.tsx`: React component rendering the brand logo and text headers.
* `public/favicon.svg`: Primary vector favicon for web browser tabs.
* `public/favicon-16x16.svg` & `favicon-32x32.svg`: Small favicons.
* `public/pwa-192x192.svg` & `pwa-512x512.svg`: App icons for PWA installation.
* `public/og-image.svg`: 1200x630 Open Graph social sharing card.
* `public/logo-brand.svg`, `logo-dark.svg`, `logo-monochrome-black.svg`, `logo-monochrome-blue.svg`, `logo-monochrome-white.svg`: Brand, dark-mode and monochrome variations.

---

### 8. Docker Containerization & Cloud Deployment Guide

**Static hosting (no server):** `npm run build` writes the frontend to `dist/`. Serving `dist/` from any static host gives the full application, with all calculations running in the browser via WebAssembly.

**Container with native ELSEPA:** the multi-stage `Dockerfile` (base image `node:20-slim`):
1. Builder stage: installs `gfortran`, `gcc`, `g++` and `make`; runs `npm install`; compiles the ELSEPA executables
   ```bash
   gfortran -O2 -I/app/fortran -o /app/elsepa_exec  fortran/elscata.f fortran/elsepa.f
   gfortran -O2 -I/app/fortran -o /app/elscatm_exec fortran/elscatm.f fortran/elsepa.f
   ```
   and runs `npm run build`.
2. Runtime stage: installs `gfortran`, copies `dist/`, `node_modules/`, `fortran/`, `data/` and the compiled binaries, sets `ELSEPA_DATA=/app/data`, exposes port 3000 and runs `node dist/server.cjs`.

`render.yaml` is a Render.com blueprint that builds this Dockerfile.

```bash
docker build -t elsepa-simulator .
docker run -p 3000:3000 elsepa-simulator
```

---

### 9. Validation & Testing

**Parity test (`wasm/parity.test.ts`).** Thirteen cases covering H, Cu, Au, Hg and H₂O; electrons and positrons; energies from 100 eV to 100 keV; Furness–McCarthy exchange, Buckingham and LDA correlation–polarization, and LDA absorption. The inputs include decks built by the application's own `buildAtomicInput` and the official CPC example inputs `elscata.in` and `h2o.in` (`wasm/tests/`). For each case, every number in every `dcs_*.dat` file is compared between the WebAssembly build, native `gfortran` ELSEPA, and the reference outputs in `validations/` (relative tolerance $10^{-5}$, matching the 6 significant digits ELSEPA prints; absolute tolerance $10^{-9}$ for the Sherman function). In the latest CI run all 34 comparisons were identical (maximum relative difference 0).

**Server test (`wasm/server.test.ts`).** Checks that the server's atomic, molecular and energy-sweep paths run native ELSEPA, that failures produce errors rather than approximate results, and that the TypeScript model is used only when explicitly requested.

Both tests run in GitHub Actions (`.github/workflows/elsepa-parity.yml`) on changes to the Fortran, physics, data, WebAssembly, validation or server files.

**Reproducing locally:**
```bash
# WebAssembly vs validations/ (no gfortran needed)
npx tsx wasm/parity.test.ts

# Including the native gfortran comparison
mkdir -p native
gfortran -O2 -Ifortran -o native/elscata fortran/elscata.f fortran/elsepa.f
gfortran -O2 -Ifortran -o native/elscatm fortran/elscatm.f fortran/elsepa.f
NATIVE_ELSCATA=$PWD/native/elscata NATIVE_ELSCATM=$PWD/native/elscatm npx tsx wasm/parity.test.ts

# Server engine test (needs gfortran on PATH)
npx tsx wasm/server.test.ts
```

---

### 10. Complete Codebase Directory Map & File Inventory

```
├── .env.example                       # Environment variable template
├── .github/workflows/elsepa-parity.yml # CI: WASM / native / reference parity + server test
├── Documentation.md                    # This document
├── Dockerfile                          # Multi-stage Docker build (node:20-slim + gfortran)
├── LICENSE                             # MIT license
├── README.md                           # Quickstart README
├── render.yaml                         # Render.com blueprint
├── index.html                          # Entry HTML with PWA tags & SW registration
├── metadata.json                       # Applet metadata
├── package.json                        # Dependencies and scripts (version 1.2.0)
├── server.ts                           # Optional Express server & API routes
├── vite.config.ts                      # Vite build configuration
│
├── data/                               # ELSEPA atomic data (z_NNN.den, z_NNN.dfs)
│
├── fortran/                            # Official ELSEPA Fortran 77 sources
│   ├── elsepa.f                        # ELSEPA physics subroutines
│   ├── elscata.f                       # ELSCATA main program (atoms)
│   ├── elscatm.f                       # ELSCATM main program (molecules)
│   └── getpath.f                       # Data-path helper (ELSEPA_DATA env var)
│
├── wasm/                               # WebAssembly build & tests
│   ├── build.sh                        # Fortran → f2c → Emscripten build script
│   ├── f77fix.py                       # DATA-statement reordering for f2c
│   ├── parity.test.ts                  # WASM / native / reference parity test
│   ├── server.test.ts                  # Server engine test
│   └── tests/                          # Official CPC example inputs
│
├── validations/                        # Reference ELSEPA output tables
│
├── public/                             # Static Web Assets & PWA Icons
│   ├── elsepa/                         # Compiled ELSEPA: elsepa.js, elsepa.wasm, elsepa.data
│   ├── favicon.svg, favicon-16x16.svg, favicon-32x32.svg
│   ├── pwa-192x192.svg, pwa-512x512.svg
│   ├── og-image.svg
│   ├── logo-*.svg                      # Brand logo variants
│   ├── manifest.json                   # Web App PWA Manifest
│   └── sw.js                           # Service worker (precaches app + ELSEPA WASM)
│
├── server/
│   └── fortranRunner.ts                # gfortran compilation, native execution, output parsing
│
└── src/                                # Frontend React Application Source
    ├── App.tsx                         # Main component & application state
    ├── main.tsx                        # React DOM entry point
    ├── index.css                       # Global Tailwind CSS styles
    ├── types.ts                        # Shared TypeScript type definitions
    │
    ├── components/
    │   ├── Header.tsx                  # Navigation, engine toggle, theme, PWA install
    │   ├── InputGuiForm.tsx            # Atomic parameter form
    │   ├── PeriodicTableModal.tsx      # Periodic table (Z=1 to Z=103)
    │   ├── ResultsDashboard.tsx        # DCS/Sherman plots, metrics, export
    │   ├── PolarPlot.tsx               # Polar scattering diagram
    │   ├── MolecularWorkbench.tsx      # Molecule builder & ELSCATM results
    │   ├── EnergySweepViewer.tsx       # Energy sweep chart
    │   ├── SavedRunsManager.tsx        # Saved runs, overlay, % difference, batch
    │   ├── DatasetUploadPanel.tsx      # Experimental dataset upload
    │   ├── RenderDeploymentModal.tsx   # Fortran source viewer & deployment files
    │   ├── PhysicsGuide.tsx            # In-app physics guide
    │   ├── LaTeX.tsx                   # KaTeX rendering helpers
    │   └── Logo.tsx                    # SVG brand logo component
    │
    ├── data/
    │   ├── elements.ts                 # Periodic table data (Z=1 to Z=103)
    │   └── elsepaFortranSource.ts      # Fortran source excerpt, Dockerfile / render.yaml templates
    │
    ├── physics/
    │   ├── elsepaFortranIO.ts          # ELSEPA input decks & output parsing
    │   ├── elsepaWasm.ts               # WebAssembly engine client
    │   ├── elsepaWasm.worker.ts        # Web Worker running ELSEPA WASM
    │   ├── elsepaPhysicsEngine.ts      # TS Approximation, atoms (demo only)
    │   └── molecularFallback.ts        # TS Approximation, molecules (demo only)
    │
    └── utils/
        ├── localApiFallback.ts         # /api/* routing to in-browser ELSEPA
        ├── datasetParser.ts            # Experimental dataset parser
        └── localStorage.ts             # Saved-run persistence
```

---

### 11. Academic References & Literature Citations

1. **Salvat, F., Jablonski, A., & Powell, C. J. (2005)**. ELSEPA—Dirac partial-wave calculation of elastic scattering of electrons and positrons by atoms, positive ions and molecules. *Computer Physics Communications*, 165(2), 157-190.
2. **Jablonski, A., Salvat, F., & Powell, C. J. (2004)**. *NIST Electron Elastic-Scattering Cross-Section Database (SRD 64)*, Version 3.1. National Institute of Standards and Technology, Gaithersburg, MD.
3. **Salvat, F. (2015)**. *PENELOPE-2014: A code system for Monte Carlo simulation of electron and photon transport*. OECD Nuclear Energy Agency, Boulogne-Billancourt, France.
4. **Furness, J. B., & McCarthy, I. E. (1973)**. Semiphenomenological local optical model for electron-atom scattering. *Journal of Physics B: Atomic and Molecular Physics*, 6(11), 2280.
5. **Riley, M. E., & Truhlar, D. G. (1975)**. Approximations for the exchange potential in electron scattering. *The Journal of Chemical Physics*, 63(5), 2182-2191.
6. **Perdew, J. P., & Zunger, A. (1981)**. Self-interaction correction to density-functional approximations for many-electron systems. *Physical Review B*, 23(10), 5048.

---
*Maintained by Golam Kuadir Khan Prince, Prof. Dr. Md. Mahabub Hossain, Pankaj Bhowmik, and the HSTU Research Society.*
