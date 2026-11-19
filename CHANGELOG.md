# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-19

### Added
* Engine switched from ELSEPA 2005 to official ELSEPA 2021 (package elsepa-2020 with RADIAL wave library; F. Salvat, A. Jablonski, C. J. Powell, Comput. Phys. Commun. 261 (2021) 107704) at the request of the ELSEPA authors under CC BY-NC 3.0.
* Electron Density editor tab: visual interactive editor for radial electron densities, providing interactive curve manipulation, normalization to $Z - q$, ionization and electron addition, radial scaling, smoothing, truncation, automated computation of metrics ($N$, $\langle r \rangle$, $R_{50}$, $R_{90}$), and direct export to ELSEPA `.den` format or injection into the atomic workbench.
* Documented build-time extension in `wasm/patch-elsepa.mjs` ensuring all workbench inputs are editable and passed to ELSEPA:
  * Atomic weight override keyword `ATWGHT` (g/mol).
  * Nuclear radius parameter keyword `NUCRAD` ($R_1$, fm).
  * Nuclear skin thickness parameter keyword `NUCSKN` ($R_2$, fm).
  * Full support for negative ions (anions, $q < 0$, $\text{NELEC} > Z$).
  * Polarization cutoff radius parameter mapped to `VPOLB`.
* Custom energy grid configuration:
  * Logarithmic range mode ($E_{\min}$, $E_{\max}$, point count).
  * Arbitrary custom energy lists with decimal and exponential notation support.
  * Server-side array validation rejecting invalid grids with HTTP 400.
* User-supplied electron densities (`MELEC 5`):
  * Support for external radial density tables in `.den`, `.dat`, `.txt`, and `.csv` formats up to 999 points.
  * Automated trapezoidal normalization verification with 1% tolerance checks.
  * Isolated per-run working directories on the server and fresh in-memory file systems in WebAssembly.
* Custom angular grid interpolation and partial cross section integration over user-specified angular ranges.
* Calculation cancellation button allowing users to abort long-running simulations (e.g., slow-converging ion plus polarization calculations).
* Automated test suites in `wasm/`:
  * `wasm/features.test.ts`: custom energy grids and custom density parsing.
  * `wasm/density.test.ts`: electron density editor operations and integration.
  * `wasm/overrides.test.ts`: nuclear parameter overrides and negative ion support.
  * `wasm/browser.test.ts`: headless Chrome test for browser-only execution and offline PWA service worker caching.
* GitHub Actions parity workflow enhancements:
  * 60-minute timeout for comprehensive parity checking.
  * WebAssembly vs native gfortran benchmark step reported to GitHub Step Summary.
  * Browser test integration on CI runners.
* Project website on GitHub Pages (`site/`, published to the orphan `gh-pages` branch).
* CI/CD: `ci.yml` (type check, build on Node 20 and 22, Docker build, engine suite when engine files change, single required "CI result" check), `pages.yml`, and `release.yml` (static web bundle attached to each release, Docker image published to GHCR); Dependabot.
* `CITATION.cff`, `.github/FUNDING.yml` (Patreon sponsor button).
* Community health files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, pull request template, and GitHub issue forms (`bug_report.yml`, `feature_request.yml`, `physics_result.yml`, `config.yml`).

### Changed
* Reference tables in `validations/` regenerated using official ELSEPA 2021.
* Zenodo metadata (`.zenodo.json`) updated for release 2.0.0 and CC BY-NC 3.0 engine licensing.
* `Documentation.md` moved to `docs/Documentation.md`.
* npm is the package manager: `package-lock.json` committed, CI and Docker use `npm ci`.
* The service worker and web manifest use relative paths, so the app also works when served from a sub-path.

### Removed
* ELSEPA 2005 sources and data (replaced by ELSEPA 2021 at the authors' request).
* The duplicate licence file: `LICENSE` now holds the MIT licence and the ELSEPA CC BY-NC 3.0 notice.
* Leftover Google AI Studio files (`assets/.aistudio`, `metadata.json`) and the unused `bun.lock`.

### Security
* Server-side source code editing endpoints locked behind `requireSourceEditing` middleware and disabled by default (`ENABLE_SOURCE_EDITING=true` required).
* API and static routes are rate-limited per client IP (`express-rate-limit`).
* The project website's figure viewer only opens the site's own figures.

### Dependencies
* Express 5, Vite 8 (with esbuild 0.28, @vitejs/plugin-react 6), TypeScript 7 (previous compiler defaults kept in `tsconfig.json`), plus minor and patch updates.
* GitHub Actions: actions/setup-node 7, actions/upload-artifact 7, docker/build-push-action 7, docker/metadata-action 6, dorny/paths-filter 4.

## [1.2.0] - 2026-10-29

### Added
* In-browser execution of official ELSEPA Fortran compiled to WebAssembly via `f2c` and Emscripten, executing in isolated module Web Workers.
* Native `gfortran` server execution mode via `server.ts` and `server/fortranRunner.ts`.
* Comprehensive output parsing reading all ELSEPA quantities: differential cross sections, Sherman function $S(\theta)$, spin-rotation functions $T(\theta)$ and $U(\theta)$, scattering amplitudes $f(\theta)$ and $g(\theta)$, elastic and transport cross sections, absorption cross sections, interaction potentials, and complex phase shifts.
* Automated parity test suite (`wasm/parity.test.ts`) comparing WebAssembly, native `gfortran`, and reference tables across 20 test cases.
* Performance benchmark suite (`wasm/benchmark.ts`) measuring WebAssembly execution speed against native compilation.
* Zenodo release archiving configuration (`.zenodo.json`).
* Technical architecture figures for publication.

### Changed
* Guaranteed authentic calculation: eliminated silent fallback to TypeScript approximation; real ELSEPA is always executed unless TS approximation is explicitly requested for demo purposes.
* Plotted differential cross sections and spin functions on true continuous angular axes from $0^\circ$ to $180^\circ$.
* Clarified licensing boundaries in repository documentation, explicitly separating the MIT application license from the CC BY-NC 3.0 ELSEPA code.

### Fixed
* Corrected column positions for ELSCATA input keywords and fixed polarization model option mapping.
* Updated parity test comparison logic to handle D-notation exponents and evaluate near-zero Sherman values using absolute tolerances.
* Added credentials transmission to PWA manifest requests.

## [1.1.1] - 2026-07-29

### Added
* In-app Physics Guide tab providing theoretical foundations of Dirac relativistic scattering, coupled radial differential equations, and partial-wave phase shifts.
* Reference validation datasets (tables T4 to T9) covering atomic and molecular test benchmarks.
* Visual identity assets, SVG icons, and Open Graph metadata.

### Changed
* Documentation overhauled with KaTeX mathematical equation rendering and system architecture diagrams.
* Typography and layout responsiveness improvements across workbench panels.

## [1.0] - 2026-07-24

### Added
* Initial release of the Electron Scattering Simulator.
* Atomic scattering workbench (ELSCATA) supporting elements $Z = 1$ to $103$ with periodic table selection.
* Relativistic Dirac partial-wave scattering calculations for electron ($e^-$) and positron ($e^+$) projectiles.
* Configurable physical models: nuclear charge distribution, electron density, exchange potentials, correlation-polarization, and absorption.
* Results dashboard featuring logarithmic/linear differential cross section (DCS) plots, Sherman function plots, and polar scattering diagrams.
* Computation of total elastic, first transport, and second transport cross sections.
* Molecular scattering workbench (ELSCATM) using the independent-atom model with presets ($H_2O$, $CO_2$, $CH_4$, $N_2$, $C_6H_6$, $UF_6$) and 3D coordinate editing.
* Energy spectrum sweep viewer with log-spaced energy distribution.
* Saved run manager with `localStorage` persistence, run cloning, and JSON export/import.
* Experimental dataset upload (`.dat`, `.csv`, `.txt`) with curve overlay.
* Progressive Web App (PWA) installation support and offline caching via service worker.
* Light and dark UI theme support.
* CSV and JSON export for simulation results and input decks.
