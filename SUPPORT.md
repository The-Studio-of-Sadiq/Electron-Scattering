# Support and Help

Welcome to the Electron Scattering Simulator support guide. If you encounter issues, have questions about the underlying ELSEPA Dirac scattering theory, or need help setting up the application, please use the resources outlined below.

## Where to Get Help

### 1. Comprehensive Project Documentation
Before filing an issue, check the comprehensive documentation:
* [README.md](README.md): Quick start guide, feature overviews, execution engine architecture, local development commands, and licensing information.
* [docs/Documentation.md](docs/Documentation.md): In-depth technical documentation covering the relativistic Dirac equation, coupled radial systems, partial-wave phase shifts, interaction potentials, REST API endpoints, and full validation results.
* In-App Physics Guide: Click the "Physics Guide" tab in the application for an interactive overview of physical equations and parameter definitions.

### 2. GitHub Wiki
Visit the [GitHub Repository Wiki](https://github.com/The-Studio-of-Sadiq/Electron-Scattering/wiki) for community guides, extended parameter tutorials, and reference benchmarks.

### 3. GitHub Issues
If your question or problem is not addressed by the documentation, choose the appropriate GitHub issue template:
* **Bug Report**: For unexpected runtime errors, UI defects, browser incompatibility, or server failures.
* **Physics Result Question / Discrepancy**: For questions regarding numerical output, cross section values, Sherman functions, or comparison with native ELSEPA / NIST SRD 64 data.
* **Feature Request**: For proposing additions to the UI, new molecular geometry presets, or additional physical models.

## Information to Include When Requesting Help

To help maintainers and the community diagnose and resolve your issue efficiently, please include:

1. **Execution Environment**:
   * Mode: Browser-only WebAssembly (client-side) vs. Express server with native `gfortran`.
   * Operating system and version (e.g., Windows 11, Ubuntu 24.04, macOS 14).
   * Web browser and version (e.g., Chrome 120, Firefox 125, Safari 17).
   * Node.js version (if running the server locally).

2. **Simulation Parameters**:
   * Projectile: Electron ($e^-$) or Positron ($e^+$).
   * Target: Element atomic number ($Z$) and ion charge ($q$), or molecular composition and Cartesian coordinates.
   * Kinetic energy (eV, keV, or MeV).
   * Selected physical models: nuclear charge distribution, electron density model, exchange potential, correlation-polarization, and absorption potential.
   * Or attach the exported ELSCATA input deck (`.in` file) or saved run JSON export.

3. **Observed vs. Expected Behavior**:
   * What happened vs. what you expected to happen according to ELSEPA documentation or experimental data.

4. **Logs and Error Traces**:
   * Browser Developer Tools console output (press `F12` -> Console tab).
   * Terminal output from `npm run dev` or `npm run build` if relevant.
