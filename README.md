# KeyChaos

**Professional password generator for MSP helpdesk teams.**
Self-hostable · Docker · React + Node.js · v1.5.0

---

## What it does

KeyChaos generates secure, ready-to-share passwords through a web UI. It runs entirely in your own infrastructure — no cloud dependency for generation. Passwords are optionally shared via a PwdPush integration (server-side proxy, token never reaches the browser).

Three generation modes:

| Mode | Format | Example |
|---|---|---|
| **SmartPass** | Adjective + Noun + Symbol + Digits | `BoldFalcon#47` |
| **Random** | Configurable character pool | `Xk9!mQr2...` |
| **Passphrase** | Word list, configurable separator | `Correct-Horse-Battery` |

---

## Architecture

```
Browser (React + Vite)
  │
  │  POST /api/generate/smartpass   ← SmartPass only
  │  POST /api/pwdpush/push
  │  GET  /api/health
  │
Express (Node.js, port 3000)
  ├── server/index.js               main server, middleware, rate limiting
  ├── server/routes/generate.js     SmartPass API endpoint
  ├── server/routes/pwdpush.js      PwdPush proxy
  ├── server/lib/smartpass.js       word lists + generation logic (never sent to browser)
  ├── server/logger.js              pino structured logger
  └── server/middleware/logger.js   IP extraction, health-check suppression
  │
  └──▶ PwdPush API (eu.pwpush.com or self-hosted)
```

### Key design decisions

- **SmartPass generation is server-side only.** Word lists and generation logic live in `server/lib/smartpass.js` and are never bundled into the frontend. The browser calls `POST /api/generate/smartpass` and receives finished passwords.
- **Random and Passphrase generation are client-side.** `src/engine/passwordEngine.ts` runs in the browser — no round-trip required.
- **PwdPush token is server-side only.** The browser never sees it. The backend proxies the push and returns only the shareable URL.
- **No user accounts, no database, no persistent state.**

---

## File structure

```
/
├── src/                            Frontend (React + TypeScript)
│   ├── App.tsx                     Main UI — all three modes, PwdPush flow
│   ├── index.css                   Design tokens (MD3 colour roles, light + dark)
│   ├── components/ui.tsx           MD3 primitives: buttons, segmented, switch
│   ├── hooks/useTheme.ts           System / light / dark preference
│   ├── engine/
│   │   ├── passwordEngine.ts       Random + Passphrase generator (client-side)
│   │   └── engine.test.ts          Vitest suite (36 tests)
│   └── lib/
│       ├── api.ts                  Typed client for the backend API
│       └── smartpass.ts            Algorithm only — used by unit tests,
│                                   NOT imported by App.tsx (not in bundle)
│
├── server/                         Backend (Node.js, CommonJS)
│   ├── index.js                    Express app, security middleware, startup
│   ├── logger.js                   Pino instance + rate-limit threshold tracker
│   ├── lib/
│   │   └── smartpass.js            Word lists, generation, pepper logic
│   ├── middleware/
│   │   └── logger.js               requestLogger — IP extraction, health-check filter
│   └── routes/
│       ├── generate.js             POST /api/generate/smartpass
│       └── pwdpush.js              POST /api/pwdpush/push, GET /api/pwdpush/test
│
├── Dockerfile                      Multi-stage build (builder + runtime, non-root)
├── docker-compose.yml              Production stack definition
└── .github/workflows/
    └── docker-build.yml            CI: builds linux/amd64, pushes to GHCR
```

---

## Interface

Material Design 3 with a muted earth-tone palette, light and dark (follows the OS, or pick with the theme button in the top bar). Built for speed:

- Everything used day to day is on one screen — no menus or dialogs.
- Results regenerate as soon as you change any option.
- Click a password (or press `1`–`5`) to copy it; **Copy all** copies the whole batch, one per line.
- Press `G` to generate a fresh batch.
- PwdPush expiry and view limit sit next to the generator; each result has its own **Share via PwdPush** button.

Fonts (Roboto, Roboto Mono) are bundled locally, so the strict `default-src 'self'` CSP needs no exceptions.

---

## SmartPass — how it works

**Format:** `[Adjective][Noun][Symbol][Digits]`

- Adjective drawn from a curated 149-entry list (max 8 chars, positive/neutral connotation)
- Noun drawn from a curated 164-entry list (max 9 chars, concrete/visualisable)
- Symbol from `['#', '@', '!', '*', '+', '=', '-']`
- Digits: 2, 3, or 4 digits — blocked strings excluded (69, 420, 666, all-same-digit, etc.)
- Specific adjective+noun combinations are blocked (BLOCKED_PAIRS) to prevent offensive concatenations

**Pepper (optional, recommended):**
When `SMARTPASS_PEPPER` is set, the symbol and digit selection is replaced by an HMAC-SHA256 derivation:
```
HMAC(pepper, adj+noun+nonce)[0]      → symbol index
HMAC(pepper, adj+noun+nonce)[1..N]   → digits
```
`nonce` is 32 fresh CSPRNG bytes per password, so the suffix is never a fixed function of the word pair. Password length is identical.

All selection (words, symbols, digits) uses a CSPRNG — `crypto.randomInt` on the server, `crypto.getRandomValues` in the browser.

**Entropy display:** `✦ N bits (pepper active)` in green / `⚠ N bits (no pepper)` in amber.

---

## API

### `POST /api/generate/smartpass`
```json
// Request
{ "digitCount": 2, "symbolSet": "safe", "count": 3 }

// Response
{ "passwords": ["BoldFalcon#47", "..."], "entropy_bits": 24.4, "pepper_active": true }
```

Validates `digitCount` ∈ {2,3,4}, `symbolSet` ∈ {"safe","none"}, `count` ∈ {1,3,5}.

### `POST /api/pwdpush/push`
```json
// Request
{ "payload": "...", "ttl": 6, "maxViews": 5, "deletable": true }

// Response
{ "pushUrl": "https://eu.pwpush.com/p/...", "expiresAt": "...", "viewsRemaining": 5 }
```

TTL enum: `6` = 1 day, `12` = 1 week, `15` = 1 month. Supports PwdPush API v2 (default) and v1/OSS.

### `GET /api/health`
```json
{ "status": "ok", "version": "1.5.0" }
```

---

## Security

| Mechanism | Detail |
|---|---|
| Helmet | CSP, HSTS (1yr), X-Frame-Options, noSniff |
| Same-origin CORS | API routes reject requests with a foreign `Origin` header |
| Rate limiting | 20 req/min + 200 req/hr per IP (configurable) |
| Reverse proxy trust | `app.set('trust proxy', 1)` controlled by `TRUST_PROXY` env var |
| API token isolation | `PWD_PUSH_TOKEN` read server-side, never sent to browser |
| SmartPass isolation | Word lists + generation code never bundled into frontend JS |
| Pepper | `SMARTPASS_PEPPER` — HMAC-SHA256 with per-password nonce, never logged, never in API responses |
| CSPRNG | All generation uses `crypto.randomInt` / `crypto.getRandomValues` — never `Math.random()` |
| Log IP source | `req.ip` (respects `trust proxy`) — clients can't spoof logged IPs via `X-Forwarded-For` |
| Build context | `.dockerignore` keeps `.env`, `.git` and local artefacts out of the image |
| Non-root container | `keychaos` user in Docker runtime stage |

---

## Structured logging (pino)

Every server-side event emits one JSON line to stdout. Fields: `ts` (ISO 8601), `event`, `ip`, and event-specific fields. **Passwords, tokens, PwdPush URLs, and the pepper are never logged.**

| Event | Triggered by |
|---|---|
| `startup` | Server start — includes `version`, `port`, `trust_proxy` |
| `startup_warning` | `SMARTPASS_PEPPER` unset at startup |
| `health_check` | External probe of `/api/health` (Docker's own checker suppressed) |
| `generate` | Successful `POST /api/generate/smartpass` — includes `mode`, `count`, `ip` |
| `pwdpush` | Successful push — includes `ip`, `ttl`, `maxViews` (no URL) |
| `pwdpush_error` | Any PwdPush failure — includes `ip`, `status_code`, `reason` |
| `rate_limit_hit` | Request blocked by rate limiter |
| `rate_limit_threshold` | Same IP has hit the limiter 3× in 1 hour |
| `invalid_params` | Validation failure on any API endpoint |

Logs route to the systemd journal in Docker:
```bash
journalctl -t keychaos -f
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Listen port inside the container |
| `NODE_ENV` | `production` | Node environment |
| `TRUST_PROXY` | `true` | Enable `trust proxy 1` for Pangolin/Traefik |
| `SMARTPASS_PEPPER` | *(empty)* | HMAC secret for SmartPass suffix derivation |
| `PWD_PUSH_URL` | `https://pwpush.com` | PwdPush base URL |
| `PWD_PUSH_TOKEN` | *(empty)* | PwdPush Bearer token |
| `PWD_PUSH_VERSION` | `v2` | API version: `v2` (pwpush.com/Pro) or `v1` (OSS self-hosted) |
| `RATE_LIMIT_PER_MIN` | `20` | Max API requests per IP per minute |
| `RATE_LIMIT_PER_HOUR` | `200` | Max API requests per IP per hour |

---

## Docker deployment (Portainer stack)

```yaml
services:
  keychaos:
    image: ghcr.io/happytree92/keychaos:latest
    container_name: keychaos
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      # Generate: openssl rand -base64 32
      # Never commit this value.
      SMARTPASS_PEPPER: ""
      PWD_PUSH_URL: "https://eu.pwpush.com"
      PWD_PUSH_VERSION: "v2"
      PWD_PUSH_TOKEN: ""
      TRUST_PROXY: "true"
      RATE_LIMIT_PER_MIN: "20"
      RATE_LIMIT_PER_HOUR: "200"
    logging:
      driver: journald
      options:
        tag: keychaos
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      start_period: 15s
      retries: 3
```

The image is built automatically by GitHub Actions on every push to `main` and pushed to `ghcr.io/happytree92/keychaos:latest` (linux/amd64).

---

## Local development

```bash
# Install dependencies
npm install

# Run the Vite dev server (frontend only, no backend)
npm run dev

# Run the Express backend
npm run server

# Run unit tests (36 tests — PasswordEngine + SmartPass algorithm)
npm test

# Production build
npm run build
```

---

## Testing

36 Vitest unit tests in `src/engine/engine.test.ts`:

- **PasswordEngine** — length clamping, character pool composition, entropy calculation, passphrase word count/separator/casing, batch generation, strength labels
- **SmartPass algorithm** — word list integrity (count, max length, no cross-list duplicates, no within-list duplicates), blocked pair format, generation format correctness, blocked number rejection, batch, entropy scaling

The SmartPass tests import from `src/lib/smartpass.ts` (the algorithm only, no pepper). The server's `server/lib/smartpass.js` is the production copy with the full word lists and pepper logic.

---

## CI/CD

`.github/workflows/docker-build.yml` — triggers on push to `main` and `workflow_dispatch`:

1. Checks out code
2. Builds `linux/amd64` image (multi-stage Dockerfile)
3. Pushes to GHCR with tags: `latest`, `sha-<commit>`, `main`
4. Uses GitHub Actions layer cache

Container registry: `ghcr.io/happytree92/keychaos`

---

## Reverse proxy (Pangolin / Traefik)

KeyChaos is designed to run behind Pangolin. Set `TRUST_PROXY=true` (the default) so Express reads real client IPs from `X-Forwarded-For` for correct rate limiting and logging. The server binds to `0.0.0.0:3000` — only expose it through your reverse proxy, not directly to the internet.

---

## What's not implemented (future scope)

- User authentication (Basic Auth was removed in v1.3.0 in favour of reverse-proxy-level auth)
- Audit log persistence (logs go to journal only, no database)
- Admin UI or usage statistics
- Custom wordlist upload
- Mobile app / browser extension
- Multi-tenant / per-team rate limiting
