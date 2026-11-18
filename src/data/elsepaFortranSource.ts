/**
 * ELSEPA 2021 Fortran Package (elsepa-2020)
 * F. Salvat, A. Jablonski, C. J. Powell
 * Comput. Phys. Commun. 261 (2021) 107704.
 *
 * Licensed under Creative Commons Attribution-NonCommercial 3.0 Unported (CC BY-NC 3.0).
 * See fortran/ELSEPA-LICENSE.txt for terms and attribution.
 */

export const OFFICIAL_ELSEPA_FORTRAN_SOURCE = `ELSEPA 2021 (Package elsepa-2020)
DIRAC PARTIAL-WAVE CALCULATION OF ELASTIC SCATTERING OF ELECTRONS AND POSITRONS
BY ATOMS, POSITIVE IONS AND MOLECULES

Authors: Francesc Salvat, Aleksander Jablonski, Cedric J. Powell
Reference: Computer Physics Communications 261 (2021) 107704
License: Creative Commons Attribution-NonCommercial 3.0 Unported (CC BY-NC 3.0)
Attribution: See fortran/ELSEPA-LICENSE.txt

Package Structure (Fortran 90):
  - fortran/radial.f: RADIAL package for solving Dirac and Schrodinger radial equations
    (F. Salvat and J. M. Fernandez-Varea, Comput. Phys. Commun. 240 (2019) 165-177).
    Contains module CONSTANTS.
  - fortran/elsepa2020.f: Core Dirac partial-wave scattering engine and potential models.
  - fortran/elscata.f: Atomic and ionic calculation program ELSCATA.
  - fortran/elscatm.f: Molecular calculation program ELSCATM.
  - fortran/ELSEPA-LICENSE.txt: CC BY-NC 3.0 license and attribution terms.
  - data/z_001.den ... z_103.den: Dirac-Fock electron density tables.
  - data/z_001.dfs ... z_103.dfs: Dirac-Fock screening function tables.

Notice: At the authors' request, the earlier (2005) version of ELSEPA is no longer distributed.
`;

export const RENDER_DOCKERFILE_CONTENT = `# Multi-stage Dockerfile for ELSEPA Physics Workbench on Render.com
FROM node:20-slim AS builder

# Install gfortran, gcc, and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gfortran \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests and install npm packages
COPY package.json ./
RUN npm install

# Copy application source code
COPY . .

# Compile official Salvat ELSEPA 2021 Fortran binaries (elscata for atoms, elscatm for molecules)
RUN gfortran -O2 -I/app/fortran -o /app/elsepa_exec fortran/elscata.f && \
    gfortran -O2 -I/app/fortran -o /app/elscatm_exec fortran/elscatm.f

# Build Vite frontend and bundle Express server
RUN npm run build

# Production runtime image
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    gfortran \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/fortran ./fortran
COPY --from=builder /app/data ./data
COPY --from=builder /app/elsepa_exec* ./

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/server.cjs"]
`;

export const RENDER_YAML_CONTENT = `# Render.com Blueprint Configuration (render.yaml)
services:
  - type: web
    name: elsepa-physics-workbench
    env: docker
    dockerfilePath: Dockerfile
    plan: free
    region: oregon
    envVars:
      - key: PORT
        value: 3000
      - key: NODE_ENV
        value: production
`;
