# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --frozen-lockfile

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Security: run as non-root user
RUN addgroup -S keychaos && adduser -S keychaos -G keychaos

# Copy built output and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./

# Install production deps only
RUN npm ci --frozen-lockfile --omit=dev && \
    npm cache clean --force

# Change ownership to non-root user
RUN chown -R keychaos:keychaos /app
USER keychaos

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
