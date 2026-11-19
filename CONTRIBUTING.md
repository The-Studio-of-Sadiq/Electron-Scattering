# Contributing to Electron Scattering Simulator

Thank you for your interest in contributing to the Electron Scattering Simulator. This document provides guidelines and instructions for submitting bug reports, proposing features, setting up your local development environment, and submitting pull requests.

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand the community standards and expectations.

## Licensing of Contributions

This repository maintains a strict separation between application code and the core physics engine:

* Application code (React components, TypeScript, Vite configuration, Express server, test harness, and documentation) is licensed under the **MIT License** (see `LICENSE`).
* The official ELSEPA Fortran 90 sources in `fortran/`, atomic data tables in `data/`, and the compiled WebAssembly package in `public/elsepa/` are authored by F. Salvat, A. Jablonski, and C. J. Powell and are licensed under **Creative Commons Attribution-NonCommercial 3.0 Unported (CC BY-NC 3.0)** (see `fortran/ELSEPA-LICENSE.txt`).

By contributing:
* You agree that all application code you submit will be licensed under the MIT License.
* Any contributions touching ELSEPA build tools, patch scripts, or data integration must respect and preserve the CC BY-NC 3.0 license.

## How to Report Bugs and Issues

* Check existing GitHub Issues and Discussions to ensure the issue has not already been reported.
* Open an issue using the **Bug Report** template.
* Include the following details:
  * Application version (for example, 2.0.0 or commit SHA).
  * Operating system and browser name and version.
  * Execution engine used: browser-only WebAssembly, local Express server with gfortran, or TS Approximation.
  * Clear, step-by-step instructions to reproduce the problem.
  * Target configuration: element $Z$ or molecule, kinetic energy, and selected models (nuclear, electron density, exchange, correlation-polarization, absorption).
  * Exported ELSEPA input deck (`.in`) or saved run JSON file.
  * Browser developer console logs or server terminal output.

For discrepancies in calculated cross sections or physics parameters, use the specialized **Physics result question / discrepancy** issue template and cite the comparison benchmark (such as native ELSEPA, NIST SRD 64, or published experiment).

## How to Propose Features

* Submit a proposal using the **Feature Request** template.
* Explain the practical use case, motivation, and scientific context.
* If the feature introduces or modifies physical models, cite the corresponding theoretical framework or literature (e.g., Computer Physics Communications papers).

## Development Setup

### Prerequisites

* **Node.js**: `^20.19.0 || >=22.12.0` (Node 22 LTS or Node 24 recommended).
* **npm**: included with Node.js.
* **Modern Web Browser**: Chrome 87+, Edge 88+, Firefox 114+, or Safari 15+ (requires WebAssembly, Web Workers with `{ type: "module" }`, and Service Workers).
* *(Optional)* **gfortran**: GCC Fortran compiler (required only for running the native backend and executing the full parity test suite).
* *(Optional)* **emsdk** and **f2c**: required only if recompiling the WebAssembly binaries from Fortran sources (see `wasm/build.sh`).

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/The-Studio-of-Sadiq/Electron-Scattering.git
   cd Electron-Scattering
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```
   This starts the Express server with Vite middleware at `http://localhost:3000`. If `gfortran` is installed and found on the system `PATH`, the server can execute ELSEPA natively; otherwise, all runs automatically fall back to WebAssembly in the browser.

4. To run in browser-only mode without the Express backend:
   ```bash
   npx vite
   ```

## Development Workflow and Branch Naming

Use descriptive branch names prefixed by the type of work:

* `feat/` for new features or user interface additions (e.g., `feat/custom-grid`)
* `fix/` for bug fixes and numerical corrections (e.g., `fix/angle-interpolation`)
* `docs/` for documentation updates (e.g., `docs/contributing-guide`)
* `chore/` for dependency updates, build tooling, or repository maintenance (e.g., `chore/ci-parity`)

### Commit Messages

Follow the Conventional Commits specification:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

Common types include:
* `feat`: A new feature or capability.
* `fix`: A bug fix.
* `docs`: Documentation changes only.
* `refactor`: Code change that neither fixes a bug nor adds a feature.
* `test`: Adding or correcting tests.
* `chore`: Maintenance tasks, dependencies, or configuration changes.

Example:
```
feat(density): add radial grid normalization check for custom files
fix(physics): align Sherman function sign convention with ELSCATA output
docs: update parity test reproduction commands in README
```

## Coding Style and Quality Standards

* **TypeScript Strictness**: Code must pass `tsc --noEmit` with zero errors. Do not use `any` unless strictly necessary for third-party boundary interop.
* **Preservation of `fortran/` Sources**: The files in `fortran/` (`elscata.f`, `elscatm.f`, `elsepa2020.f`, `radial.f`, `readme.txt`, `ELSEPA-LICENSE.txt`) are the authors' original, unmodified Fortran 90 distribution. **Never edit files in `fortran/` directly.** Build-time transformations and extensions (such as `ATWGHT`, `NUCRAD`, `NUCSKN`, and negative ion handling) must be applied programmatically via `wasm/patch-elsepa.mjs`.
* **Physics Test Coverage**: Any change affecting input deck generation (`src/physics/elsepaFortranIO.ts`), output parsing, coordinate transformations, or numerical workflows must be verified with tests in the `wasm/` directory.

## Running Tests

All automated test scripts are located in `wasm/` and are executed using `npx tsx`:

1. **Static Type Checking**:
   ```bash
   npm run lint
   ```

2. **Production Build Verification**:
   ```bash
   npm run build
   ```

3. **Feature and Unit Tests**:
   Verifies custom energy grid parsing, logarithmic generation, and user-supplied density validation:
   ```bash
   npx tsx wasm/features.test.ts
   ```

4. **Electron Density Editor Tests**:
   Verifies density normalization, radial scaling, interpolation, and integration:
   ```bash
   npx tsx wasm/density.test.ts
   ```

5. **Overrides and Ion Tests**:
   Tests build-time extensions for nuclear weight overrides, radius parameters, and negative ions:
   ```bash
   npx tsx wasm/overrides.test.ts
   ```

6. **Output Parsing and Model Verification**:
   Verifies reading all quantities computed by ELSEPA (cross sections, phase shifts, spin functions, warnings):
   ```bash
   npx tsx wasm/outputs.test.ts
   ```

7. **Server Engine Tests**:
   Verifies native ELSEPA execution and ensures no silent substitution of the approximate model:
   ```bash
   npx tsx wasm/server.test.ts
   ```

8. **Browser and Offline Tests**:
   Launches headless Chrome to verify WebAssembly execution, Web Worker isolation, and offline PWA service worker operation:
   ```bash
   npx tsx wasm/browser.test.ts
   ```

## Validation and Parity Testing

The parity suite ensures that WebAssembly ELSEPA running in the browser produces identical numerical results to native `gfortran` ELSEPA and the validated reference tables.

### Running Parity Tests Locally

1. Patch and compile the native ELSEPA executables:
   ```bash
   mkdir -p native
   node wasm/patch-elsepa.mjs fortran native/patched
   gfortran -O2 -Inative/patched -o native/elscata native/patched/elscata.f
   gfortran -O2 -Inative/patched -o native/elscatm native/patched/elscatm.f
   ```

2. Run the comparison:
   ```bash
   NATIVE_ELSCATA=$PWD/native/elscata NATIVE_ELSCATM=$PWD/native/elscatm npx tsx wasm/parity.test.ts
   ```

The parity test validates differential cross sections and spin observables against relative tolerance $10^{-5}$ and absolute Sherman tolerance $10^{-9}$.

### Reference Tables Policy

* Reference tables in `validations/` are canonical benchmarks.
* Reference files must **only** be regenerated by the automated `references` job of `.github/workflows/elsepa-parity.yml` via GitHub Actions `workflow_dispatch`.
* Never manually commit modified reference tables from local environments.

### Rebuilding WebAssembly

If build-time patch scripts or Fortran translations are altered, rebuild the WebAssembly binaries:
```bash
EMSDK=/path/to/emsdk F2C_DIR=/path/to/netlib-f2c bash wasm/build.sh
```
Ensure that Emscripten and `f2c` environments are properly configured before execution.

## Pull Request Checklist

Before opening a pull request, ensure that:

- [ ] `npm run lint` passes without errors (`tsc --noEmit`).
- [ ] `npm run build` completes successfully.
- [ ] Relevant test suites in `wasm/*.test.ts` pass locally.
- [ ] The `fortran/` folder remains completely unmodified (`git status fortran/` shows no changes).
- [ ] New features or UI modifications are documented in `README.md` or `docs/Documentation.md`.
- [ ] `CHANGELOG.md` is updated under the appropriate release or unreleased section.
- [ ] Pull request description references the corresponding issue number.
