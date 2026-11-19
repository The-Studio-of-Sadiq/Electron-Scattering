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
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy application source code
COPY . .

# Apply build-time patch and compile ELSEPA Fortran binaries (elscata for atoms, elscatm for molecules)
RUN node wasm/patch-elsepa.mjs fortran /tmp/patched-fortran && \
    gfortran -O2 -I/tmp/patched-fortran -o /app/elsepa_exec /tmp/patched-fortran/elscata.f && \
    gfortran -O2 -I/tmp/patched-fortran -o /app/elscatm_exec /tmp/patched-fortran/elscatm.f && \
    rm -rf /tmp/patched-fortran

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
COPY --from=builder /app/elsepa_exec /app/elscatm_exec ./

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/server.cjs"]
