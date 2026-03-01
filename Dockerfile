# ── Build client ──────────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /app
COPY package.json ./
COPY src/client/package.json src/client/
RUN npm install --workspace=src/client --ignore-scripts
COPY src/client/ src/client/
RUN npm run build --workspace=src/client

# ── Build server ──────────────────────────────────────────────
FROM node:22-alpine AS server-build
WORKDIR /app
COPY package.json ./
COPY src/server/package.json src/server/
RUN npm install --workspace=src/server --ignore-scripts
COPY src/server/ src/server/
RUN npm run build --workspace=src/server

# ── Runtime ───────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk add --no-cache git curl bash

# Install GitHub Copilot CLI
RUN npm install -g @anthropic-ai/claude-code || true
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli.gpg 2>/dev/null || true

# Install Copilot CLI via npm (the standalone package)
RUN npm install -g copilot-cli@latest 2>/dev/null || \
    echo "Copilot CLI will need to be configured at runtime"

WORKDIR /app

# Production dependencies only
COPY package.json ./
COPY src/server/package.json src/server/
RUN npm install --workspace=src/server --omit=dev --ignore-scripts

# Copy built artifacts
COPY --from=server-build /app/src/server/dist src/server/dist/
COPY --from=client-build /app/src/client/dist src/client/dist/

# Non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -D appuser && \
    chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/healthz || exit 1

CMD ["node", "src/server/dist/index.js"]
