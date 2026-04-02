#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
#  KeyChaos — push.sh
#  Usage:  ./push.sh "optional commit message"
#  Default message includes timestamp if none provided.
#  GitHub Actions handles Docker build automatically.
# ─────────────────────────────────────────────────────
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
MSG="${1:-"chore: update $(date '+%Y-%m-%d %H:%M')"}"

echo "🌿 Branch: $BRANCH"
echo "📦 Staging all changes..."
git add .

if git diff --cached --quiet; then
  echo "✅ Nothing to commit — working tree clean."
else
  echo "💬 Committing: \"$MSG\""
  git commit -m "$MSG"
fi

echo "🚀 Pushing to GitHub..."
git push origin "$BRANCH"

echo ""
echo "✅ Push complete. GitHub Actions is now building the Docker image."
echo "   → https://github.com/happytree92/KeyChaos/actions"
