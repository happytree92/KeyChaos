KeyChaos — Docker/Web Build Plan
Self‑Hostable Password & Passphrase Generator (Container Edition)

1. Project Overview

App Name: KeyChaos
Version: 1.2 (Docker/Web)
Purpose: Provide a secure, self‑hostable web interface for generating professional‑grade passwords and passphrases, with PwdPush integration and strong security defaults.
Target Audience: MSP helpdesk teams, IT admins, and end users accessing the tool via an authenticated internal web deployment.
Core Problem Solved: Enables organizations to run KeyChaos in their own environment with strict access controls, while preserving the full “generate → share” workflow.

2. Core Features (Docker/Web Edition)

- Responsive web UI (React + TypeScript, Vite build)
- Passphrase generator using curated dictionary
- Password generator with configurable rules
- Formula engine with per‑segment control
- Entropy display (log2 calculation)
- One‑click copy to clipboard (browser‑safe)
- PwdPush API integration via backend proxy
- Mandatory authentication by default (Basic Auth)
- No persistent user accounts (stateless)
- Configurable via environment variables
- Dockerized deployment with optional nginx reverse proxy

3. Tech Stack

Web UI:
- React + TypeScript
- Tailwind CSS
- Vite
- Shared password engine module (TypeScript)

Backend / Container:
- Node.js + Express
- Docker + docker-compose
- Optional nginx reverse proxy for TLS

Cross‑Cutting:
- PwdPush integration via server-side proxy
- Basic Auth
- Environment variable configuration

4. System Architecture (Docker/Web)

React UI (Vite build)
↓
Express backend
- Basic Auth
- PwdPush proxy
- Healthcheck
↓
PwdPush API (HTTPS)

5. API Design (Web Edition)

POST /api/pwdpush/push
Body: { payload, ttl, maxViews, deletable, note }
Server-side call to PwdPush (v1 or v2)
Returns { pushUrl }

GET /api/health
Returns { status: "ok", version: "1.2.0" }

Reason for proxy:
- Avoids exposing API tokens to browser
- Avoids CORS issues
- Allows unified handling of PwdPush v1/v2 differences

6. Deployment & Security

Authentication (Mandatory):
- Basic Auth enabled by default
- KC_AUTH_USER and KC_AUTH_PASS required
- KC_AUTH_DISABLED=true explicitly required to disable (not recommended)

Environment Variables:
PWD_PUSH_URL          Base URL for PwdPush
PWD_PUSH_TOKEN        API token (server-side only)
KC_AUTH_USER          Basic Auth username
KC_AUTH_PASS          Basic Auth password
KC_AUTH_DISABLED      Disable auth (false by default)

Docker:
- Single container running Express + static UI
- Optional nginx sidecar for TLS termination
- Example nginx config included (HTTPS + Basic Auth)

7. Development Phases (Docker/Web Only)

Phase A — Web Extraction (Week 1)
- Extract React UI
- Build standalone Vite output
- Implement password engine + entropy calculator

Phase B — Backend & Security (Week 2)
- Build Express server
- Basic Auth middleware
- PwdPush proxy endpoints
- Environment variable config
- Healthcheck endpoint

Phase C — Containerization (Week 3)
- Dockerfile
- docker-compose.yml
- Optional nginx reverse proxy config
- Startup warnings for insecure deployments

Phase D — Testing & Release (Week 4)
- Local Docker testing
- Security validation
- Documentation
- Publish container image

8. Risks & Considerations (Docker/Web)

Security:
- Auth must remain enabled by default
- TLS required for production
- API token must never be exposed to browser
- Custom dictionaries must be validated

PwdPush API Version Split:
- v2 for pwpush.com and Pro edition
- v1 for OSS self-hosted
- Backend proxy must support both

Deployment Variability:
- Some MSPs run behind reverse proxies
- Provide clear nginx examples
- HTTP deployments are unsupported

9. Deliverable

Docker image containing:
- Static Vite-built UI
- Express backend with Basic Auth
- PwdPush proxy
- Healthcheck endpoint

Ready for internal registry or Docker Hub.