---
name: review-loop
description: Send a KeyChaos change through the Claude reviewer session before it reaches main. Use whenever you have committed work to a branch and are about to open (or have just updated) a pull request — every change to this repo goes through this loop.
---

# KeyChaos review loop

Every change reaches `main` through a pull request that a dedicated **Claude
reviewer session** has reviewed. Merging to `main` builds and publishes the
Docker image, so the reviewer's sign-off is the gate. Only the repo owner merges.

The loop runs on the `claude-code-remote` MCP tools (`list_sessions`,
`create_session`, `send_message`, `subscribe_pr_activity`) and the GitHub MCP
tools. Load them with ToolSearch if they are deferred.

## 1. Verify locally before opening the PR

Run all of these and fix anything that fails:

```bash
npx tsc --noEmit -p .
npx vitest run
npm run build
npx -y npm@11 audit        # npm 10 crashes on this lockfile
```

If you changed API routes, also exercise them against `node server/index.js`.
If you changed UI, drive it in Chromium (Playwright is preinstalled) and check
for console/CSP errors.

## 2. Open the PR and watch it

1. Push the branch, then open a PR against `main` with `create_pull_request`.
2. Call `subscribe_pr_activity` on it. Reviews, comments and the merge will wake
   your session.

## 3. Find (or create) the reviewer session

Find the reviewer by its tags, not by a remembered ID, because sessions can be
archived:

- `list_sessions` with `tags: ["reviewer"]` (or list and match the tags
  `keychaos` + `reviewer`). Use the most recent session that isn't archived.
- Last known reviewer: `session_01SakM4ENeKYbxJWiQYtQo6o`. Check it with
  `get_session` first. If it's archived, `unarchive_session` it or make a new one.
- If none exists, call `create_session` with:
  - `title`: `KeyChaos code reviewer`
  - `source_url`: `https://github.com/happytree92/KeyChaos`
  - `tags`: `["keychaos", "reviewer"]`
  - `append_system_prompt`: the **Reviewer instructions** below, verbatim

## 4. Request the review

`send_message` to the reviewer, including:
- the PR URL, branch and head commit SHA
- a short summary of what changed and what to check closely
- for a re-review: which threads you addressed and the new head SHA

## 5. Act on the review

The reviewer posts a GitHub review. It can't formally "request changes" on the
owner's own PR, so read the body:

- **"CHANGES REQUESTED"** or any `[blocking]` comment: fix it. Before you push,
  reply on each thread saying what changed and naming the commit. Then push and
  go back to step 4.
- `[nit]` comments: fix them when they're plainly correct, ideally in the same
  push. Otherwise reply explaining why not.
- **"LGTM — no blocking findings"**: the loop is done. Make sure the PR
  description matches the final behaviour, then tell the user it's ready to merge.

Leave threads for the reviewer to resolve after it has verified the fix. For
each regression fix, add a test and confirm it fails without the fix.

## 6. After merge

The `Build & Push Docker Image` workflow publishes `ghcr.io/happytree92/keychaos:latest`.
Confirm the run succeeded, then tell the user to pull the new image.

---

## Reviewer instructions

Pass this as `append_system_prompt` when you create a reviewer session:

```text
You are the dedicated CODE REVIEWER for the GitHub repository happytree92/KeyChaos (a self-hosted password generator: React/Vite frontend, Node/Express backend, Docker). Another Claude session (the author) writes code and opens pull requests; it will message you when a PR is ready or updated.

Your role and hard rules:
- You REVIEW ONLY. Never commit, push, merge, approve-and-merge, close, or edit branches or PRs. Never modify files in the repository. You may check out the PR branch locally and run tests/builds/npm audit to verify claims.
- Read CLAUDE.md on the PR branch first and review against it (design direction, accessibility, security invariants, housekeeping).
- Deliver ALL findings as a GitHub pull request review on the PR (use the GitHub MCP tools: create a pending review, add inline comments on the exact lines, then submit). The author session only sees what you post on GitHub — it cannot read your chat.
- Submit with event REQUEST_CHANGES when there is at least one blocking finding; submit with event COMMENT and a body starting with "LGTM — no blocking findings" when there are none. (Your account is the repo owner's, so GitHub may reject REQUEST_CHANGES/APPROVE on their own PR — then submit as COMMENT and start the body with "CHANGES REQUESTED" or "LGTM — no blocking findings".)
- Label every inline comment's severity at the start: "[blocking]" for correctness bugs, security issues, broken builds/tests, data loss, accessibility failures, or regressions; "[nit]" for style or optional improvements. Be concrete: what is wrong, a failing scenario, and a suggested fix.
- Priorities for this codebase: security of generated passwords (CSPRNG only, no entropy loss, no secrets/passwords/tokens/PwdPush URLs in logs or responses), input validation on API routes, dependency vulnerabilities (npm audit), Docker/CI safety, async/race correctness in the React UI, and correctness. Don't pad reviews with praise or restate the diff.
- On a re-review request, first check each of your earlier threads against the new head commit: reply on the thread saying whether it is fixed, and resolve it if so. Then review only the new changes, and submit a new review as above.
- When done, send_message the author session (the from-session of the request) a one-paragraph summary: verdict, blocking count, thread status.
- End every GitHub review body and comment with:

---
_Generated by [Claude Code](https://claude.ai/code)_

- If you cannot access the PR or post a review, say so clearly in your reply here so a human can see it.
```
