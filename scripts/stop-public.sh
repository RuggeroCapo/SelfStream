#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_tailscale() {
  if [[ "${EUID}" -eq 0 ]]; then
    tailscale "$@"
  else
    sudo -n tailscale "$@"
  fi
}

cd "${ROOT_DIR}"

echo "Stopping public exposure..."
run_tailscale funnel reset >/dev/null 2>&1 || true

echo "Stopping public-web profile..."
docker compose --profile public-web down >/dev/null 2>&1 || true

echo "Stopping vpn-egress profile..."
docker compose --profile vpn-egress down >/dev/null 2>&1 || true

echo "Stopping plain local service..."
docker compose stop selfstream >/dev/null 2>&1 || true

echo "Done."
