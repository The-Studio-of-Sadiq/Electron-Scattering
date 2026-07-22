/**
 * ELSEPA Standard Fortran Source Code Excerpt & Template
 * F. Salvat, A. Jablonski, F. Powell (Computer Physics Communications)
 */

export const OFFICIAL_ELSEPA_FORTRAN_SOURCE = `C  *********************************************************************
C                       SUBROUTINE ELSEPA
C  *********************************************************************
C                              F. Salvat, A. Jablonski and C.J. Powell
C                              September 27, 2004
C  Computer Physics Communications (ELSEPA Package)
C
      INCLUDE 'getpath.f'
C
      SUBROUTINE ELSEPA(IELEC,EV,IZ,NELEC,MNUCL,MELEC,MUFIN,RMUF,
     1  MEXCH,MCPOL,VPOLA,VPOLB,MABS,VABSA,VABSD,IHEF,IW)
C
C  Input arguments:
C    IELEC ..... electron-positron flag;
C                =-1 for electrons,
C                =+1 for positrons.
C    EV ........ projectile's kinetic energy (in eV).
C    IZ ........ atomic number of the target atom or ion.
C    NELEC ..... number of bound atomic electrons.
C    MNUCL ..... nuclear charge density model:
C                  1 --> point nucleus (P)
C                  2 --> uniform distribution (U)
C                  3 --> Fermi distribution (F)
C                  4 --> Helm's uniform-uniform distribution (Uu)
C    MELEC ..... electron density model:
C                  1 --> TFM analytical density
C                  2 --> TFD analytical density
C                  3 --> DHFS analytical density
C                  4 --> DF numerical density, read from 'z_zzz.den'
C                  5 --> density read from file 'density.usr'
C    MUFIN ..... Aggregation effects:
C                  0 --> free atom
C                  1 --> muffin-tin model
C    MEXCH ..... exchange correction for electrons:
C                  0 --> no exchange
C                  1 --> Furness-McCarthy (FM)
C                  2 --> Riley-Truhlar (RT)
C                  3 --> Local density approximation (LDA)
C    MCPOL ..... correlation-polarization potential:
C                  0 --> no polarization
C                  1 --> Buckingham potential
C                  2 --> LDA correlation-polarization
C    MABS ...... absorption potential:
C                  0 --> no absorption
C                  1 --> LDA absorption model
C
C  Official ELSEPA source files included in repository:
C    - fortran/elsepa.f (6,785 lines - Dirac partial-wave analysis)
C    - fortran/elscata.f (416 lines - Analytical atomic scattering factors)
C    - fortran/elscatm.f (529 lines - Muffin-tin & molecule scattering)
C    - fortran/getpath.f (11 lines - Environment path resolver)
C    - data/z_001.den through z_103.den (Dirac-Fock electron density tables)
C    - data/z_001.dfs through z_103.dfs (Dirac-Fock screening function tables)
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

# Compile official Salvat ELSEPA Fortran binaries (elscata for atoms, elscatm for molecules)
RUN gfortran -O2 -I/app/fortran -o /app/elsepa_exec fortran/elscata.f fortran/elsepa.f && \
    gfortran -O2 -I/app/fortran -o /app/elscatm_exec fortran/elscatm.f fortran/elsepa.f

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
ENV ELSEPA_DATA=/app/data

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
      - key: ELSEPA_DATA
        value: /app/data
`;
