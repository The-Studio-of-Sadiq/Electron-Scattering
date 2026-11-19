# Security Policy

## Supported Versions

The following table indicates the support status for security updates across releases of the Electron Scattering Simulator:

| Version | Supported |
| :--- | :--- |
| 2.0.x | Yes |
| < 2.0 | No |

Users and deployers are strongly encouraged to upgrade to the latest 2.0.x release to ensure all security patches and physics engine improvements are active.

## Reporting a Vulnerability

If you discover a security vulnerability in this project:

1. **Do not open a public GitHub issue.** Public disclosure exposes users before a remediation can be provided.
2. Submit your report securely using **GitHub Private Vulnerability Reporting**:
   * Navigate to the repository's main page on GitHub.
   * Click on the **Security** tab.
   * Under "Reporting", click **Report a vulnerability**.
   * Provide a detailed summary, proof of concept, and steps to reproduce.

### Response Timeline

* Maintainers will acknowledge receipt of your vulnerability report within **7 days**.
* A status update indicating whether the report is accepted, rejected, or requires additional clarification will be provided within 14 days.
* Security patches will be released in an expedited patch release, accompanied by an advisory.

## Security Architecture and Scope Notes

When assessing potential vulnerabilities or deploying this application, keep the following architectural factors in mind:

### 1. Browser-Only Execution (Client-Side Sandboxing)

In the standard distribution and on static hosting platforms (such as GitHub Pages), all calculations run entirely client-side:
* ELSEPA calculations execute inside WebAssembly (`public/elsepa/elsepa.wasm`) managed within dedicated module Web Workers (`src/physics/elsepaWasm.worker.ts`).
* The WebAssembly execution environment runs in an isolated in-memory file system with no direct access to the host system, disk storage, or external networks.
* Saved simulations are stored locally in the user's browser `localStorage`.

### 2. Optional Express Backend and Source-Editing Endpoints

When running the optional Express server (`server.ts`):
* Source code modification endpoints (`/api/fortran-source/*` and `/api/ts-source/*`) allow recompiling and executing Fortran files on the host machine using `gfortran`.
* **These endpoints are protected by default**: `server.ts` enforces the `requireSourceEditing` middleware, which checks that `process.env.ENABLE_SOURCE_EDITING === 'true'`. When disabled (the default), all write requests are rejected with `HTTP 403 Forbidden`.
* **Important**: `ENABLE_SOURCE_EDITING=true` must **only** be enabled in trusted, single-user local development environments. It must **never** be enabled on publicly accessible, multi-tenant, or shared network servers.

### 3. Uploaded Dataset and File Parsing

* The application supports uploading external electron density files (`.den`, `.dat`, `.txt`, `.csv`) and experimental comparison datasets.
* Uploads to the Express server are restricted by `multer` memory storage with a strict 5 MB file size limit and file extension allowlists (`.dat`, `.txt`, `.csv`, `.in`, `.out`).
* Files are parsed in-memory using strict numerical parsers (`src/utils/datasetParser.ts` and `src/physics/densityFile.ts`), validating line counts, number formats, positivity, and radial grid monotonicity before passing data to calculation routines.
