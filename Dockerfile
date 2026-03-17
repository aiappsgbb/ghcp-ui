# ── Build client ──────────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY src/client/package.json src/client/
RUN npm ci --workspace=src/client --ignore-scripts
COPY src/client/ src/client/
RUN npm run build --workspace=src/client

# ── Build server ──────────────────────────────────────────────
FROM node:22-alpine AS server-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY src/server/package.json src/server/
RUN npm ci --workspace=src/server --ignore-scripts
COPY src/server/ src/server/
RUN npm run build --workspace=src/server

# ── Runtime ───────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk add --no-cache git curl bash

WORKDIR /app

# Production dependencies only (SDK bundles Copilot CLI internally)
COPY package.json package-lock.json ./
COPY src/server/package.json src/server/
RUN npm ci --workspace=src/server --omit=dev --ignore-scripts

# Copy built artifacts
COPY --from=server-build /app/src/server/dist src/server/dist/
COPY --from=client-build /app/src/client/dist src/client/dist/

# Create workspace mount point
RUN mkdir -p /data/workspaces

# Non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -D appuser && \
    chown -R appuser:appgroup /app /data/workspaces
USER appuser

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/healthz || exit 1

CMD ["node", "src/server/dist/index.js"]
