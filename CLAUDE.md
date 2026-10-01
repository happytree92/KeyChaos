# KeyChaos — working guidelines

## How to approach work here
- Bring new ideas and creative ways to implement features, but ship only sound,
  double-checked code that follows established best practices. Verify before
  pushing: `npx vitest run`, `npm run build`, `npm audit`, and exercise changed
  API routes against a running server (`node server/index.js`).
- Changes go through a pull request, never straight to `main` (merging to
  `main` builds and publishes the Docker image). A separate Claude reviewer
  session reviews each PR; address its `[blocking]` findings before merge.
  **Follow the `review-loop` skill (`.claude/skills/review-loop/SKILL.md`)** —
  it covers finding or creating the reviewer session, requesting reviews, and
  handling findings. Only the repo owner merges, and changes to the review
  process itself need the owner's explicit sign-off.

## Front-end design direction
- **Material Design 3** principles: tonal surfaces instead of heavy shadows,
  segmented buttons, filled/tonal/outlined button hierarchy, MD switches,
  snackbars, clear state layers and visible focus rings.
- **Muted earth-tone palette** (moss, umber, clay, sand, ochre). Light and dark
  schemes, both defined as tokens in `src/index.css` — never hard-code colours
  in components.
- **Functional, not flashy.** No glows, gradients, bouncy animation or
  decorative chrome. The layout is built for clean, fast use: the common path
  (pick mode → generate → copy/share) must take as few clicks as possible.
- **Nothing more than one layer deep** except settings. Every control a user
  needs for day-to-day work is visible on the main screen — no hiding in menus,
  dialogs or collapsed panels unless there is a clear reason.
- Accessible by default: real labels, `role`/`aria-*` on custom controls,
  keyboard operable, WCAG AA contrast in both themes.
- CSP is strict (`default-src 'self'`): fonts, icons and scripts must be
  bundled locally — no CDNs or Google Fonts links.

## Security invariants (do not regress)
- All randomness from a CSPRNG (`crypto.randomInt` server-side,
  `crypto.getRandomValues` with rejection sampling in the browser). Never
  `Math.random()` for anything secret.
- SmartPass word lists and pepper logic stay server-side only
  (`server/lib/smartpass.js`); never import them into the frontend bundle.
- Never log or return passwords, PwdPush URLs, tokens or the pepper.
- `PWD_PUSH_TOKEN` never reaches the browser.

## Housekeeping
- Version lives in three places: `package.json` (+ lockfile), `server/index.js`
  `VERSION`, and the fallback in `src/App.tsx`. Keep them in sync and update
  `README.md`.
- The container's npm 10 crashes on this lockfile (`edgesOut` arborist bug);
  use `npx -y npm@11 install …` for dependency changes.
