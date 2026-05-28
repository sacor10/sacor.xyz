#!/bin/bash
set -euo pipefail

# Installs dependencies for Claude Code on the web, where the container is
# cloned fresh each session with an empty node_modules. Locally these already
# exist, so this is a no-op outside the remote environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Main app: required for `npm run lint`, `npm run build`, the React frontend,
# the Netlify functions, and the ffmpeg.wasm dependencies.
echo "Installing root dependencies..."
npm install

# Downloader microservices: auxiliary, only used by their local `node --test`
# suites (the deployed site runs on Netlify functions, not these). Skip the
# youtube-dl-exec binary download — it hits GitHub on install (slow / rate
# limited) and isn't needed to install deps or run the tests. Best-effort so the
# main app is never blocked by a service install hiccup.
for svc in services/instagram-downloader services/x-downloader; do
  if [ -f "$svc/package.json" ]; then
    echo "Installing $svc dependencies (best-effort)..."
    YOUTUBE_DL_SKIP_DOWNLOAD=true npm --prefix "$svc" install \
      || echo "warn: $svc dependency install failed; skipping"
  fi
done

echo "Dependency setup complete."
