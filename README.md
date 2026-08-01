<img width="1920" height="958" alt="Annotation 2026-07-27 074951" src="https://github.com/user-attachments/assets/19cee028-1294-4378-bfc2-282db1220cb3" />


# Electron Scattering Simulator (ELSEPA Physics Workbench)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://web.dev/progressive-web-apps/)

An interactive, high-precision physics simulation platform and GUI for **ELSEPA** (Elastic Scattering of Electrons and Positrons by Atoms) using Dirac partial-wave calculations. This workbench enables atomic and molecular electron/positron scattering modeling, energy spectrum sweeps, comparative dataset visualization, and native Fortran execution.

---

## 👨‍🔬 Authors & Research Attribution

* **Principal Research & Physics Direction**: Professor Dr. Md. Mahabub Hossain (Faculty, Department of Electronics and Communication Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU)
* **Co-Researcher**: Pankaj Bhowmik (Faculty, Department of Computer Science and Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU)
* **Software Architecture & Development**: Golam Kuadir Khan Prince (Undergraduate Student, Department of Electrical and Electronic Engineering, Hajee Mohammad Danesh Science and Technology University - HSTU / HSTU Research Society)
* **Research Group**: **HSTU Research Society** (Hajee Mohammad Danesh Science and Technology University - HSTU)

### 📚 Core Physics Engine Attribution
This platform provides a visual interface and backend execution server for the **ELSEPA** Fortran code developed by:
* **F. Salvat** (Universitat de Barcelona, Spain)
* **A. Jablonski** (Institute of Physical Chemistry, Polish Academy of Sciences)
* **F. Powell** (National Institute of Standards and Technology - NIST)

---

## 🌟 Key Features & Functional Scope

### 1. ⚛️ Atomic Workbench
* **Dirac Partial-Wave Scattering**: Solves the radial Dirac equation for elastic scattering of electrons ($e^-$) and positrons ($e^+$) off neutral or ionized atoms across $10\text{ eV}$ to $1\text{ GeV}$.
* **Complete Quantum Observables**:
  * **DCS ($\frac{d\sigma}{d\Omega}$)**: Differential Cross Section in $\text{cm}^2/\text{sr}$ vs. scattering angle $\theta$ ($0^\circ \le \theta \le 180^\circ$).
  * **Spin Polarization / Sherman Function $S(\theta)$**: Measures spin-orbit interaction asymmetry.
  * **Spin Rotation Parameters**: $T(\theta)$ and $U(\theta)$ asymmetry functions.
  * **Integrated Cross Sections**: Total elastic ($\sigma_{\text{el}}$), total inelastic/absorption ($\sigma_{\text{in}}$), momentum transfer ($\sigma_{\text{tr}}$), and total scattering cross section ($\sigma_{\text{tot}}$).
* **Nuclear Charge Distributions**:
  * Point Nucleus
  * Uniform Sphere
  * Fermi 2-parameter charge distribution
  * Helm's Model
* **Atomic Screening & Exchange Potentials**:
  * **Electrostatic Screening**: Thomas-Fermi-Dirac, Dirac-Fock, or Molière screening functions.
  * **Electron Exchange**: Furness-McCarthy, Riley-Truhlar, or Local Density Approximation (LDA).
  * **Correlation-Polarization**: Buckingham or LDA correlation models.
  * **Absorption Potential**: Inelastic channel absorption models (Boucher/Salvat imaginary potential).

### 2. 🧪 Molecular Mode (ELSCATM)
* **Independent Atom Model (IAM)**: Constructs polyatomic molecular scattering amplitudes via coherent addition of atomic scattering amplitudes $f_i(\theta)$ and $g_i(\theta)$.
* ** Debye-Waller Thermal Corrections**: Accounts for molecular vibrational motion and bond length fluctuations.
* **Orientational Averaging**: Computes isotropic molecular cross sections $\left\langle \frac{d\sigma_{\text{mol}}}{d\Omega} \right\rangle$.
* **Pre-configured Polyatomic Benchmarks**: $H_2O$, $CO_2$, $CH_4$, $SF_6$, $N_2$, $O_2$, $CF_4$, and custom molecular geometry inputs.

### 3. 📈 Energy Spectrum Sweep
* **Multi-Energy Batch Simulation**: Automatically computes cross sections across energy ranges ($10\text{ eV}$ to $1\text{ MeV}$) using logarithmic or linear spacing.
* **3D Heatmaps & Contour Diagrams**: Visualizes DCS surface curves as a function of energy ($E$) and angle ($\theta$).
* **Cross-Section Energy Dependence**: Plots $\sigma_{\text{el}}(E)$, $\sigma_{\text{tr}}(E)$, and $\sigma_{\text{tot}}(E)$ on log-log scales to identify Ramsauer-Townsend minima and high-energy asymptotic scaling.

### 4. 📊 Saved Runs & Comparative Analysis
* **Local Persistence**: Save simulation runs with full parameter metadata to browser storage (`localStorage` / IndexedDB).
* **Overlay Comparison**: Overlay up to 8 distinct simulation runs on logarithmic or linear axes.
* **Percentage Difference & Residue Plotting**: Quantify discrepancies between different screening potentials, nuclear models, or projectile types ($e^-$ vs. $e^+$).
* **Clone to Workbench**: Instantly restore any saved run's parameters into the active form for tweaking.

### 5. 📂 Experimental Dataset Integration
* **Data File Support**: Upload `.dat`, `.csv`, or `.txt` experimental cross-section measurements.
* **Column Mapping Wizard**: Automatically map angle ($\theta$) and DCS ($\frac{d\sigma}{d\Omega}$) columns with units conversion.
* **Overlay on Theory**: Plot experimental data points with error bars directly against ELSEPA Dirac theoretical curves.

### 6. 🚀 Hybrid Execution Engine (Native gfortran + Dirac Fallback)
* **Native gfortran Server**: Spawns compiled `elsepa_exec` and `elsepa_exec` Fortran binaries on Linux/Cloud Run environments.
* **TypeScript Dirac Solver Fallback**: Includes a standalone client-side / Node.js Dirac partial-wave solver for seamless offline or fallback operation.

### 7. 📱 Progressive Web App (PWA) & Dark/Light Theming
* **Installable App**: Fully PWA-compliant with `manifest.json` and `sw.js` Service Worker.
* **Offline Caching**: Launches instantly offline.
* **Theme System**: Smooth toggle between Light and Dark physics lab aesthetics with preference saving.

---

## 🛠️ Tech Stack & Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │           React 18 + Vite Frontend           │
                       │   (Tailwind CSS, Recharts, Lucide Icons)     │
                       └──────────────────────┬───────────────────────┘
                                              │
                                       HTTP / REST API
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │            Express.js Server (Port 3000)     │
                       │               (Node.js / TypeScript)         │
                       └──────────────┬────────────────┬──────────────┘
                                      │                │
            gfortran available?      YES               NO
            ───────────────────► ┌────▼─────────────┐ ┌▼─────────────┐
                                 │ Linux Executable │ │ TypeScript   │
                                 │ (elsepa_exec)    │ │ Dirac Engine │
                                 └──────────────────┘ └──────────────┘
```

| Layer | Technology / Library |
| :--- | :--- |
| **Frontend Framework** | React 18 with TypeScript & Vite |
| **Styling** | Tailwind CSS v4, Lucide React Icons |
| **Data Visualization** | Recharts (Logarithmic & Linear axes, Responsive Containers) |
| **Backend Server** | Express.js running on Node.js (bundled with esbuild) |
| **Physics Solver** | Fortran 90 (`elsepa.f`) compiled with `gfortran` + TS Fallback |
| **Persistence** | Browser `localStorage` / IndexedDB for saved runs |
| **PWA Services** | Service Worker (`sw.js`), Web App Manifest (`manifest.json`) |

---

## 📁 Repository Directory Structure

```
├── .env.example              # Environment variables template
├── Dockerfile                # Production multi-stage Docker build with gfortran
├── assets/                   # Applet metadata
├── data/                     # Atomic density & phase shift tables
├── fortran/                  # ELSEPA Fortran 90 source code (elsepa.f)
├── elsepa_exec               # Compiled Linux executable for ELSEPA
├── elscatm_exec              # Compiled Linux executable for ELSCATM
├── index.html                # Main entry HTML with PWA tags & SW registration
├── metadata.json             # AI Studio app metadata
├── package.json              # NPM dependencies and scripts
├── public/
│   ├── favicon.svg           # Quantum scattering vector logo
│   ├── manifest.json         # PWA Manifest specification
│   └── sw.js                 # PWA Service Worker for offline caching
├── server.ts                 # Express REST API server & Fortran process manager
├── src/
│   ├── App.tsx               # Root React component & state manager
│   ├── main.tsx              # React mounting entry point
│   ├── types.ts              # Global TypeScript interfaces for physics params
│   └── components/
│       ├── Header.tsx        # Top navigation, PWA installer, preset selector & theme toggle
│       ├── InputGuiForm.tsx  # Parameter input panel with Periodic Table Modal
│       ├── ResultsDashboard.tsx # Plots, Sherman function, phase shifts, CSV/PDF export
│       ├── MolecularWorkbench.tsx # ELSCATM IAM polyatomic molecule scattering
│       ├── EnergySweepViewer.tsx  # Multi-energy spectrum sweep & heatmap generator
│       ├── SavedRunsManager.tsx   # Saved run comparison, residue plot & overlay
│       ├── DatasetUploader.tsx    # Custom experimental dataset upload & curve overlay
│       ├── FortranDeployManager.tsx # Fortran source code inspector & compilation status
│       └── PeriodicTableModal.tsx # Interactive periodic table Z=1 to Z=103
└── vite.config.ts            # Vite bundler configuration
```

---

## 💻 Local Setup & Installation

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* *(Optional)* **gfortran**: GNU Fortran compiler (for native Fortran execution)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/electron-scattering-simulator.git
cd electron-scattering-simulator
npm install
```

### 2. Compile Fortran Executables (Optional for Native Fortran Mode)
If `gfortran` is installed on your system, compile the Fortran source code:
```bash
gfortran -O3 fortran/elsepa.f -o elsepa_exec
gfortran -O3 fortran/elscatm.f -o elscatm_exec
```

### 3. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 🐳 Docker Deployment

The project includes a production-ready `Dockerfile` that automatically installs `gfortran`, compiles the Fortran source code, builds the React frontend, and packages the Express backend.

```bash
# Build Docker image
docker build -t elsepa-simulator .

# Run container on port 3000
docker run -p 3000:3000 elsepa-simulator
```

---

## 📡 API Reference

### `POST /api/simulate-fortran`
Runs an atomic scattering calculation using native `elsepa_exec` or the Dirac fallback engine.

* **Request Body**:
```json
{
  "Z": 79,
  "EV": 100000,
  "ISPEL": 1,
  "IEX": 1,
  "INUC": 2,
  "IEVT": 1
}
```
* **Response**: JSON containing angles, DCS, Sherman function $S(\theta)$, spin parameters $U(\theta)$, $T(\theta)$, total elastic, inelastic, and transport cross sections.

### `GET /api/fortran-status`
Checks if `gfortran` compiler and `elsepa_exec` binaries are available on the server host.

---

### UI typography
<img width="1536" height="1024" alt="Electron scattering" src="https://github.com/user-attachments/assets/0da55e78-4019-4b29-87ab-89836808e4ef" />


## 📜 License

This project is open-source under the **MIT License**. The underlying ELSEPA Fortran code remains the property of F. Salvat et al. (University of Barcelona / NIST).

---

<p center="align">
  <strong>Electron Scattering Simulator</strong> • Developed by HSTU Research Society
</p>