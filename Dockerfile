# Multi-stage Dockerfile for ELSEPA Physics Workbench on Render.com
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
