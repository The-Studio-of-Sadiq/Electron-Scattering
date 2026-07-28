# Electron Scattering Simulator (ELSEPA Physics Workbench)
## Comprehensive Technical & Architectural Documentation

---

### Table of Contents
1. [Executive Overview & Vision](#1-executive-overview--vision)
2. [Authorship, Affiliations & Research Attribution](#2-authorship-affiliations--research-attribution)
3. [Core Feature Modules & User Interface](#3-core-feature-modules--user-interface)
   - [3.1 Atomic Physics Workbench](#31-atomic-physics-workbench)
   - [3.2 Molecular Mode (IAM & MIFS)](#32-molecular-mode-iam--mifs)
   - [3.3 Energy Spectrum Sweep Viewer](#33-energy-spectrum-sweep-viewer)
   - [3.4 Saved Runs & Comparison Engine](#34-saved-runs--comparison-engine)
   - [3.5 Experimental Dataset Upload & Curve Overlay](#35-experimental-dataset-upload--curve-overlay)
   - [3.6 Fortran Source Code & Cloud Deployment Modal](#36-fortran-source-code--cloud-deployment-modal)
   - [3.7 Physics Guide & Dirac Theory](#37-physics-guide--dirac-theory)
4. [Relativistic Dirac Scattering Theory & Mathematical Physics](#4-relativistic-dirac-scattering-theory--mathematical-physics)
   - [4.1 Coupled Radial Dirac System](#41-coupled-radial-dirac-system)
   - [4.2 Partial-Wave Phase Shifts & Scattering Amplitudes](#42-partial-wave-phase-shifts--scattering-amplitudes)
   - [4.3 Interaction Potentials V(r)](#43-interaction-potentials-vr)
   - [4.4 Physical Observables & Cross Sections](#44-physical-observables--cross-sections)
   - [4.5 Molecular Independent Atom Model (IAM) & Interference](#45-molecular-independent-atom-model-iam--interference)
5. [System Architecture & Hybrid Execution Engine](#5-system-architecture--hybrid-execution-engine)
   - [5.1 Native gfortran Binary Subprocess Execution](#51-native-gfortran-binary-subprocess-execution)
   - [5.2 Web-Assembly / Client-Side Fallback Physics Engine](#52-web-assembly--client-side-fallback-physics-engine)
   - [5.3 Express Server REST API Endpoints](#53-express-server-rest-api-endpoints)
   - [5.4 React + Vite Frontend State Architecture](#54-react--vite-frontend-state-architecture)
6. [Data Models & TypeScript Interface Specifications](#6-data-models--typescript-interface-specifications)
7. [Visual Identity, Branding, PWA & SVG Asset Suite](#7-visual-identity-branding-pwa--svg-asset-suite)
8. [Docker Containerization & Cloud Deployment Guide](#8-docker-containerization--cloud-deployment-guide)
9. [Complete Codebase Directory Map & File Inventory](#9-complete-codebase-directory-map--file-inventory)
10. [Academic References & Literature Citations](#10-academic-references--literature-citations)

---

### 1. Executive Overview & Vision

The **Electron Scattering Simulator (ELSEPA Physics Workbench)** is a web application designed for high-precision relativistic quantum mechanical simulations of elastic electron ($e^-$) and positron ($e^+$) scattering off target atoms and molecules across kinetic energies ranging from **10 eV to 1,000,000,000 eV (1 GeV)**.

Powered by the benchmark **ELSEPA** (Elastic Scattering of Electrons and Positrons by Atoms) Fortran 90 package developed by Francesc Salvat, Aleksander Jablonski, and Cedric J. Powell, this application brings research-grade atomic collision physics to modern web browsers with an intuitive user interface, interactive plotting, energy spectrum sweeps, molecular geometry modeling, dataset overlays, and instant cloud deployment capabilities.

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
* **Original FORTRAN 90 Code (ELSEPA / ELSCATA / ELSCATM)**:
  * **Francesc Salvat** (Facultat de Física, Universitat de Barcelona, Spain)
  * **Aleksander Jablonski** (Institute of Physical Chemistry, Polish Academy of Sciences, Warsaw, Poland)
  * **Cedric J. Powell** (National Institute of Standards and Technology - NIST, Gaithersburg, MD, USA)
  * Published in: *Computer Physics Communications* 165, 157–190 (2005).

---

### 3. Core Feature Modules & User Interface

#### 3.1 Atomic Physics Workbench

* **Interactive Parameter Configuration**:
  * **Target Element Selector**: Full periodic table support ($Z = 1$ to $Z = 103$), with preset atomic properties (Hydrogen, Argon, Gold, Uranium, Xenon, Lead, etc.).
  
  * **Projectile Selection**: Electron ($e^-$, $Q=-1$) vs. Positron ($e^+$, $Q=+1$).
  
  * **Kinetic Energy Slider & Direct Input**: Continuous range from $10\ \mathrm{eV}$ to $10^9\ \mathrm{eV}$ with exponential and logarithmic scaling.
  
  * **Nuclear Charge Models**: Point Charge, Uniform Charged Sphere ($R_N = 1.07 A^{1/3}\ \mathrm{fm}$), and 2-Parameter Fermi Distribution.
  
  * **Exchange Potentials ($e^-$)**: Furness–McCarthy, Riley–Truhlar, or None.
  
  * **Correlation-Polarization Models**: Buckingham Dipole + LDA, Padé Approximation, or Disabled.

* **Results Dashboard**:
  * **Differential Cross Section (DCS) Plot**: Logarithmic and linear scales for $d\sigma/d\Omega$ ($\mathrm{cm}^2/\mathrm{sr}$) vs. scattering angle $\theta$ ($0^\circ$ to $180^\circ$).
  
  * **Sherman Function $S(\theta)$ (Spin Polarization Asymmetry)**: Polarized scattering function displaying Mott minima and spin-flip asymmetries.
  
  * **Transport & Total Cross Section Summary Metrics**: Total Elastic ($\sigma_{\mathrm{el}}$), 1st Transport ($\sigma_{\mathrm{tr1}}$), and 2nd Transport ($\sigma_{\mathrm{tr2}}$) cross sections with unit conversions ($\mathrm{cm}^2$ and $\mathrm{\AA}^2$).
  
  * **Polar Scattering Intensity Diagram**: $2\pi$ polar lobe viewer displaying directional scattering lobes.

#### 3.2 Molecular Mode (IAM & MIFS)
* **Molecular Target Builder**:
  * Pre-built geometry configurations for key molecules: $H_2O$, $CO_2$, $CH_4$, $SF_6$, $C_6H_6$, $NH_3$, $O_2$, $N_2$.
  * Custom 3D atomic coordinate editor with Bond Length ($R_{ij}$) matrix calculator.
* **Independent Atom Model (IAM)**:
  * Calculates molecular differential cross section using coherent phase-summation of component atoms weighted by interatomic structure factors $\frac{\sin(q R_{ij})}{q R_{ij}}$.
  * **MIFS Reduction Factor**: Accounts for intra-molecular screening at low energies ($E < 100$ eV).

#### 3.3 Energy Spectrum Sweep Viewer
* **Automated Energy Sweeps**:
  * Generates cross-sectional energy dependence curves across selected decade ranges ($10 \text{ eV} \to 1 \text{ MeV}$).
  * Computes $\sigma_{\text{el}}(E)$, $\sigma_{\text{tr1}}(E)$, and $\sigma_{\text{tr2}}(E)$ as a function of incident energy $E$.
  * Displays Ramsauer-Townsend resonance dips and relativistic high-energy asymptotic behaviors.

#### 3.4 Saved Runs & Comparison Engine
* **Local Run Storage & History**:
  * Saves simulation parameter snapshots and raw angular data arrays directly into browser LocalStorage.
  * Multi-run overlay comparison charts allowing simultaneous visualization of different elements, energies, or potentials.
  * One-click "Clone to Workbench" to restore historical parameters.

#### 3.5 Experimental Dataset Upload & Curve Overlay
* **CSV / TXT Data Importer**:
  * Drag-and-drop or manual file upload for experimental elastic scattering measurements.
  * Automatic parsing of angular columns ($\theta$) and experimental cross sections with error bars.
  * Direct overlay comparison between experimental data and Dirac ELSEPA theoretical curves.

#### 3.6 Fortran Source Code & Cloud Deployment Modal
* **Source Code Viewer**: Complete embedded viewing of official `elsepa.f`, `elscata.f`, and `elscatm.f` Fortran 90 sources.
* **Server Status Monitor**: Real-time probe of server `gfortran` compiler presence, version, and process status.
* **Dockerfile & Render.com One-Click Blueprint**: Multi-stage Docker containerization script for automated Cloud Run or Render host builds.

#### 3.7 Physics Guide & Dirac Theory
* **Comprehensive Educational Knowledge Base**:
  * In-app textbook covering coupled radial Dirac equations, boundary conditions, interaction potentials, and partial wave phase shifts.
  * Dedicated interactive sections for Dirac solver mechanics, electrostatic potentials, observables, molecular IAM theory, and literature citations.

---

### 4. Relativistic Dirac Scattering Theory & Mathematical Physics

#### 4.1 Coupled Radial Dirac System
The interaction of a fast lepton of rest mass $m_e$ and kinetic energy $E$ with a central atomic potential $V(r)$ is governed by the relativistic Dirac equation:

$$\left[ c \boldsymbol{\alpha} \cdot \mathbf{p} + \beta m_e c^2 + V(r) \right] \Psi = (E + m_e c^2) \Psi$$

For a spherically symmetric potential $V(r)$, separating radial and angular variables using relativistic spherical spinors yields two coupled first-order linear differential equations for the large radial component $g_\kappa(r)$ and small radial component $f_\kappa(r)$:

$$\frac{dg_\kappa}{dr} = -\frac{\kappa}{r} g_\kappa(r) + \frac{E + m_e c^2 - V(r)}{\hbar c} f_\kappa(r)$$

$$\frac{df_\kappa}{dr} = \frac{\kappa}{r} f_\kappa(r) - \frac{E - m_e c^2 - V(r)}{\hbar c} g_\kappa(r)$$

Here $\kappa$ is the relativistic angular momentum quantum number:
* $\kappa = l$ for spin alignment $j = l - 1/2$
* $\kappa = -(l+1)$ for spin alignment $j = l + 1/2$

#### 4.2 Partial-Wave Phase Shifts & Scattering Amplitudes
At large distances $r \to \infty$ where $V(r) \to 0$, the numerical radial wave $g_\kappa(r)$ approaches the free spherical Bessel $j_l(kr)$ and Neumann $n_l(kr)$ functions:

$$g_\kappa(r) \xrightarrow[r \to \infty]{} A_\kappa \left[ \cos\delta_\kappa \, j_l(kr) - \sin\delta_\kappa \, n_l(kr) \right]$$

Matching numerical integration at two outer boundary points determines the exact relativistic phase shift $\delta_\kappa$.

The direct amplitude $f(\theta)$ and spin-flip amplitude $g(\theta)$ are compiled from partial wave phase shifts:

$$f(\theta) = \frac{1}{2ik} \sum_{l=0}^\infty \left[ (l+1)\left(e^{2i\delta_{\kappa=-l-1}} - 1\right) + l\left(e^{2i\delta_{\kappa=l}} - 1\right) \right] P_l(\cos\theta)$$

$$g(\theta) = \frac{1}{2ik} \sum_{l=1}^\infty \left[ e^{2i\delta_{\kappa=l}} - e^{2i\delta_{\kappa=-l-1}} \right] P_l^1(\cos\theta)$$

Where $P_l(\cos\theta)$ are Legendre polynomials and $P_l^1(\cos\theta)$ are associated Legendre functions.

#### 4.3 Interaction Potentials V(r)
The total effective interaction potential is modeled as:

$$V(r) = V_{\text{stat}}(r) + V_{\text{ex}}(r) + V_{\text{pol}}(r) + i W_{\text{abs}}(r)$$

1. **Static Electrostatic Potential $V_{\text{stat}}(r)$**:
   Calculated from the nuclear charge density $\rho_N(r)$ and electronic density $\rho_e(r)$:
   $$V_{\text{stat}}(r) = Z_1 e \left[ \frac{Z_2 e}{r} - 4\pi \int_0^\infty \rho_e(r') \frac{r'}{r_>} dr' \right]$$

2. **Furness-McCarthy Local Exchange $V_{\text{ex}}(r)$** (Electrons only):
   $$V_{\text{ex}}^{\text{FM}}(r) = \frac{1}{2} \left[ (E - V_{\text{stat}}) - \sqrt{(E - V_{\text{stat}})^2 + 2\pi e^4 \rho_e(r)} \right]$$

3. **Buckingham Correlation-Polarization $V_{\text{pol}}(r)$**:
   $$V_{\text{pol}}(r) = -\frac{\alpha_d e^2}{2 (r^2 + r_c^2)^2}$$
   Joined smoothly at short distances to the Perdew-Zunger local density correlation potential $V_{\text{corr}}(r)$.

#### 4.4 Physical Observables & Cross Sections

* **Differential Cross Section (DCS)**:  
  $\displaystyle \frac{d\sigma}{d\Omega}(\theta) = |f(\theta)|^2 + |g(\theta)|^2$

* **Sherman Function $S(\theta)$ (Mott Polarization Asymmetry)**:  
  $\displaystyle S(\theta) = i \frac{f(\theta)g^*(\theta) - f^*(\theta)g(\theta)}{|f(\theta)|^2 + |g(\theta)|^2}
  = \frac{2\,\mathrm{Im}\!\left[f(\theta)g^*(\theta)\right]}{\frac{d\sigma}{d\Omega}(\theta)}$

* **Total Elastic Cross Section $\sigma_{\mathrm{el}}$**:  
  $\displaystyle \sigma_{\mathrm{el}} = 2\pi \int_0^\pi \frac{d\sigma}{d\Omega}(\theta)\,\sin\theta\, d\theta$

* **First & Second Transport Cross Sections ($\sigma_{\mathrm{tr1}}, \sigma_{\mathrm{tr2}}$)**:  
  $\displaystyle \sigma_{\mathrm{tr1}} = 2\pi \int_0^\pi \frac{d\sigma}{d\Omega}(\theta)\,(1 - \cos\theta)\,\sin\theta\, d\theta$  
  
  $\displaystyle \sigma_{\mathrm{tr2}} = 3\pi \int_0^\pi \frac{d\sigma}{d\Omega}(\theta)\,\sin^3\theta\, d\theta$

#### 4.5 Molecular Independent Atom Model (IAM) & Interference

For a molecule containing $N$ atoms with positions $\mathbf{r}_i$, the molecular cross section includes atomic factors and interatomic interference terms:

$$
\left(\frac{d\sigma}{d\Omega}\right)_{\mathrm{mol}}(\theta)
= \sum_{i=1}^{N} \left(\frac{d\sigma}{d\Omega}\right)_i
+ \sum_{i \ne j}^{N}
\left[ f_i(\theta) f_j^*(\theta) + g_i(\theta) g_j^*(\theta) \right]
\frac{\sin(q R_{ij})}{q R_{ij}}
$$

Where $q = 2k \sin(\theta/2)$ is the magnitude of the momentum transfer vector, and $R_{ij} = |\mathbf{r}_i - \mathbf{r}_j|$.

---

### 5. System Architecture & Hybrid Execution Engine

The platform operates a robust **hybrid physics architecture** ensuring seamless simulation performance both online and offline:

```
                          ┌───────────────────────────┐
                          │   React + Vite Frontend   │
                          └─────────────┬─────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
            ┌─────────────────────────┐   ┌──────────────────────────┐
            │ Native Node.js Express  │   │ Client-Side TS Engine    │
            │ REST API (/api/simulate)│   │ (Dirac Partial-Wave Web) │
            └────────────┬────────────┘   └──────────────────────────┘
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
   ┌──────────────────┐    ┌──────────────────┐
   │ gfortran Binary  │    │ Built-in Fallback│
   │ (/elsepa_exec)   │    │ Dirac Solver     │
   └──────────────────┘    └──────────────────┘
```

#### 5.1 Native gfortran Binary Subprocess Execution
* Located in `/server/fortranRunner.ts`.
* Dynamically detects whether `gfortran` is installed on the host container.
* On first run, compiles `fortran/elscata.f` and `fortran/elsepa.f` into `/elsepa_exec`.
* Spawns binary execution via Node.js `child_process.execSync` with custom input files (`INPFILE.INP`) generated on the fly.
* Parses tabular Fortran output (`3COL.OUT`, `DSIGMA.OUT`) back into structured JSON response payloads.

#### 5.2 Web-Assembly / Client-Side Fallback Physics Engine
* Located in `/src/physics/elsepaPhysicsEngine.ts`.
* Executes directly in browser or client environments when native Fortran binary compilation is unavailable.
* Performs analytical Molière and Dirac partial-wave approximations to construct smooth $d\sigma/d\Omega$ curves and Sherman functions $S(\theta)$.

#### 5.3 Express Server REST API Endpoints
* `GET /api/fortran-status`: Checks `gfortran` version, installation path, and binary readiness.
* `POST /api/simulate/atomic`: Runs native atomic Dirac simulation using `elsepa_exec`.
* `POST /api/simulate/molecular`: Runs molecular IAM simulation across multi-atom geometries.
* `POST /api/sweep`: Computes energy-dependent cross-sectional curves across logarithmic ranges.

#### 5.4 React + Vite Frontend State Architecture
* Built with **React 18**, **TypeScript**, **Tailwind CSS**, and **Recharts**.
* Utilizes reactive hooks for state preservation, responsive charts, dark/light theme toggling, and offline PWA service worker caching (`sw.js`).

---

### 6. Data Models & TypeScript Interface Specifications

Core data contracts defined in `/src/types.ts`:

```typescript
export interface ElsepaInputParams {
  z: number;                   // Atomic number Z (1..103)
  projectile: -1 | 1;          // -1 for electron (e-), +1 for positron (e+)
  energyEv: number;            // Incident kinetic energy in eV
  nuclearModel: 'point' | 'uniform' | 'fermi'; // Nuclear charge model
  exchangeModel: 'furness-mccarthy' | 'riley-truhlar' | 'none'; // Exchange potential
  polarizationModel: 'buckingham' | 'pade' | 'none'; // Polarization potential
  muf: number;                 // Mesh upper limit factor
}

export interface ScatteringDataPoint {
  thetaDeg: number;            // Scattering angle theta in degrees
  dcsCm2Sr: number;            // Differential cross section (cm^2/sr)
  dcsAngstrom2Sr: number;      // Differential cross section (Angstrom^2/sr)
  shermanS: number;            // Sherman function S(theta)
}

export interface SimulationResult {
  params: ElsepaInputParams;
  data: ScatteringDataPoint[];
  totalElasticCm2: number;
  totalTransport1Cm2: number;
  totalTransport2Cm2: number;
  executionEngine: 'gfortran-native' | 'typescript-dirac-fallback';
  executionTimeMs: number;
}
```

---

### 7. Visual Identity, Branding, PWA & SVG Asset Suite

The website features a custom vector logo design depicting an incoming electron trajectory ($e^-$), central atomic nucleus target, polar scattering lobe, and code symbol (`</>`).

#### Vector Asset Inventory (`/public/` & `/src/components/`):
* `src/components/Logo.tsx`: Interactive React component rendering responsive brand logo and text headers.
* `public/favicon.svg`: Primary vector favicon for web browser tabs.
* `public/favicon-16x16.svg` & `favicon-32x32.svg`: Optimized high-contrast small favicons.
* `public/pwa-192x192.svg` & `pwa-512x512.svg`: Scalable vector app icons for mobile/desktop PWA installation.
* `public/og-image.svg`: 1200x630 resolution Open Graph social sharing card for GitHub, LinkedIn, and Twitter previews.
* `public/logo-brand.svg`, `logo-dark.svg`, `logo-monochrome-black.svg`, `logo-monochrome-blue.svg`, `logo-monochrome-white.svg`: Full monochrome and dark mode branding variations.

---

### 8. Docker Containerization & Cloud Deployment Guide

The project includes a multi-stage `Dockerfile` configured for Google Cloud Run and Render.com deployments:

```dockerfile
# Multi-stage Dockerfile for ELSEPA Physics Workbench
FROM node:20-slim AS builder
WORKDIR /app

# Install gfortran compiler and build tools
RUN apt-get update && apt-get install -y \
    gfortran \
    gcc \
    make \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Compile Fortran ELSEPA binaries
RUN gfortran -O2 -I/app/fortran -o /app/elsepa_exec fortran/elscata.f fortran/elsepa.f

EXPOSE 3000
CMD ["npm", "start"]
```

---

### 9. Complete Codebase Directory Map & File Inventory

```
├── .env.example                       # Environment variable template
├── .gitignore                          # Git ignore rules
├── Documentation.md                    # Complete comprehensive technical & physics documentation
├── Dockerfile                          # Production multi-stage Docker container build script
├── README.md                           # Quickstart README file
├── index.html                          # Entry HTML document with structured JSON-LD metadata
├── metadata.json                       # Applet metadata (Name, Description, Capabilities)
├── package.json                        # Node.js dependencies and script definitions
├── server.ts                           # Express backend server entry point & API routes
├── vite.config.ts                      # Vite build & proxy configuration
│
├── fortran/                            # Official Fortran 90 ELSEPA physics source files
│   ├── elsepa.f                        # Core Dirac partial-wave scattering engine routines
│   ├── elscata.f                       # Atomic scattering main driver program
│   └── elscatm.f                       # Molecular scattering driver program
│
├── public/                             # Static Web Assets & PWA Icons
│   ├── favicon.svg                     # Primary vector favicon
│   ├── favicon-16x16.svg               # Small 16x16 crisp favicon
│   ├── favicon-32x32.svg               # Standard 32x32 crisp favicon
│   ├── pwa-192x192.svg                 # 192x192 PWA app icon
│   ├── pwa-512x512.svg                 # 512x512 PWA app icon
│   ├── og-image.svg                    # 1200x630 Open Graph preview banner
│   ├── logo-brand.svg                  # High-res vector brand logo
│   ├── logo-dark.svg                   # Dark-mode optimized logo variant
│   ├── logo-monochrome-black.svg       # Solid black logo version
│   ├── logo-monochrome-blue.svg        # Deep blue logo version
│   ├── logo-monochrome-white.svg       # Solid white on dark logo version
│   ├── manifest.json                   # Web App PWA Manifest
│   └── sw.js                           # Offline PWA service worker script
│
├── server/                             # Express Server Modules
│   └── fortranRunner.ts                # Fortran subprocess execution & output parsing engine
│
└── src/                                # Frontend React Application Source
    ├── App.tsx                         # Main React application component & layout shell
    ├── main.tsx                        # React DOM client entry point
    ├── index.css                       # Global Tailwind CSS styles
    ├── types.ts                        # Shared TypeScript type definitions
    │
    ├── components/                     # React UI Components
    │   ├── Header.tsx                  # Top navigation bar, theme toggle & PWA installer
    │   ├── InputGuiForm.tsx            # Atomic simulation parameters input GUI
    │   ├── ResultsDashboard.tsx        # Interactive DCS chart & cross section metrics
    │   ├── PolarPlot.tsx               # 2P Polar differential scattering lobe visualizer
    │   ├── MolecularWorkbench.tsx      # Molecular 3D target builder & IAM calculator
    │   ├── EnergySweepViewer.tsx       # Energy-dependent cross section spectrum sweeper
    │   ├── SavedRunsManager.tsx        # LocalStorage run comparison & overlay manager
    │   ├── DatasetUploadPanel.tsx      # Experimental CSV dataset uploader & curve overlay
    │   ├── RenderDeploymentModal.tsx   # Fortran source code viewer & Render deployment modal
    │   ├── PhysicsGuide.tsx            # In-app Dirac physics theory textbook & guide
    │   └── Logo.tsx                    # Interactive SVG brand logo component
    │
    ├── data/                           # Atomic & Physics Datasets
    │   ├── elements.ts                 # Periodic table atomic data (Z=1 to Z=103)
    │   └── elsepaFortranSource.ts      # Embedded Fortran source code strings & Docker templates
    │
    ├── physics/                        # Client-Side Physics Fallback Engine
    │   └── elsepaPhysicsEngine.ts      # TypeScript Dirac partial-wave simulation engine
    │
    └── utils/                          # Helper Utilities
        ├── localStorage.ts             # Browser LocalStorage history persistence
        └── parseCsv.ts                 # CSV experimental data parser
```

---

### 10. Academic References & Literature Citations

1. **Salvat, F., Jablonski, A., & Powell, C. J. (2005)**. ELSEPA—Dirac partial-wave program for calculation of elastic scattering of electrons and positrons by atoms. *Computer Physics Communications*, 165(2), 157-190.
2. **Jablonski, A., Salvat, F., & Powell, C. J. (2004)**. *NIST Electron Elastic-Scattering Cross-Section Database (SRD 64)*, Version 3.1. National Institute of Standards and Technology, Gaithersburg, MD.
3. **Salvat, F. (2015)**. *PENELOPE-2014: A code system for Monte Carlo simulation of electron and photon transport*. OECD Nuclear Energy Agency, Boulogne-Billancourt, France.
4. **Furness, J. B., & McCarthy, I. E. (1973)**. Semiphenomenological local optical model for electron-atom scattering. *Journal of Physics B: Atomic and Molecular Physics*, 6(11), 2280.
5. **Riley, M. E., & Truhlar, D. G. (1975)**. Approximations for the exchange potential in electron scattering. *The Journal of Chemical Physics*, 63(5), 2182-2191.
6. **Perdew, J. P., & Zunger, A. (1981)**. Self-interaction correction to density-functional approximations for many-electron systems. *Physical Review B*, 23(10), 5048.

---
*Maintained by Golam Kuadir Khan Prince, Prof. Dr. Md. Mahabub Hossain, Pankaj Bhowmik, and the HSTU Research Society.*
