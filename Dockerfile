# ─── Build Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

# ─── Runtime Stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: non-root user
RUN addgroup -S keychaos && adduser -S keychaos -G keychaos

# Copy deps and app source
COPY --from=builder /app/node_modules ./node_modules
COPY server/ ./server/
COPY public/ ./public/
COPY package.json ./

RUN chown -R keychaos:keychaos /app
USER keychaos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

CMD ["node", "server/index.js"]
