#!/usr/bin/env bash
#
# Build both apps for production and install their runtime dependencies.
# Run this from the repository root (locally or on the server).
#
# Result:
#   api/  -> source + production node_modules (run: node src/server.js)
#   web/  -> dist/web (built SSR bundle) + production node_modules
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building API"
cd "$ROOT_DIR/api"
npm ci --omit=dev

echo "==> Building Web (Angular SSR)"
cd "$ROOT_DIR/web"
npm ci
npm run build
# Prune dev dependencies after the build; the SSR server only needs prod deps.
npm prune --omit=dev

echo "==> Build complete."
echo "    API: $ROOT_DIR/api   (node src/server.js)"
echo "    Web: $ROOT_DIR/web   (node dist/web/server/server.mjs)"
