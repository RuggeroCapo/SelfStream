#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-vpn}"
EXPOSE_METHOD="${2:-funnel}"
LOCAL_PORT="${SELFSTREAM_LOCAL_PORT:-7000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/start-public.sh [vpn|plain] [funnel|caddy]

Examples:
  ./scripts/start-public.sh
  ./scripts/start-public.sh plain funnel
  ./scripts/start-public.sh vpn caddy

Notes:
  - vpn + funnel: starts gluetun + selfstream-vpn, then enables Tailscale Funnel on localhost:7000
  - plain + funnel: starts selfstream only, then enables Tailscale Funnel on localhost:7000
  - vpn + caddy: starts gluetun + selfstream-vpn + caddy
  - plain + caddy: starts selfstream + caddy

Requirements:
  - For vpn mode, .env must contain valid GLUETUN_* settings.
  - For caddy mode, .env should contain PUBLIC_DOMAIN.
  - For funnel mode, Tailscale must already be installed and authenticated.
EOF
}

if [[ "${MODE}" != "vpn" && "${MODE}" != "plain" ]]; then
  usage
  exit 1
fi

if [[ "${EXPOSE_METHOD}" != "funnel" && "${EXPOSE_METHOD}" != "caddy" ]]; then
  usage
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/compose.yaml" ]]; then
  echo "compose.yaml not found in ${ROOT_DIR}" >&2
  exit 1
fi

run_tailscale() {
  if [[ "${EUID}" -eq 0 ]]; then
    tailscale "$@"
  else
    sudo -n tailscale "$@"
  fi
}

wait_for_local_manifest() {
  local attempts=60
  local delay=2
  local url="http://127.0.0.1:${LOCAL_PORT}/manifest.json"

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${delay}"
  done

  echo "SelfStream did not become ready on ${url}" >&2
  return 1
}

cd "${ROOT_DIR}"

if [[ "${MODE}" == "vpn" ]]; then
  echo "Starting vpn-egress stack..."
  docker compose stop selfstream >/dev/null 2>&1 || true
  docker compose --profile vpn-egress up -d --build gluetun selfstream-vpn
else
  echo "Starting plain local stack..."
  docker compose --profile vpn-egress down >/dev/null 2>&1 || true
  docker compose up -d --build selfstream
fi

wait_for_local_manifest

if [[ "${EXPOSE_METHOD}" == "funnel" ]]; then
  echo "Resetting and enabling Tailscale Funnel..."
  run_tailscale funnel reset >/dev/null 2>&1 || true
  run_tailscale funnel --bg "http://127.0.0.1:${LOCAL_PORT}"
  echo
  run_tailscale funnel status
  echo
  echo "Use the Funnel hostname shown above and append /manifest.json"
else
  echo "Starting public-web stack with Caddy..."
  docker compose --profile public-web up -d caddy
  echo
  if [[ -n "${PUBLIC_DOMAIN:-}" ]]; then
    echo "Public manifest URL:"
    echo "https://${PUBLIC_DOMAIN}/manifest.json"
  else
    echo "Caddy is running, but PUBLIC_DOMAIN is not set in .env." >&2
    echo "Set PUBLIC_DOMAIN=yourname.duckdns.org and restart the script."
  fi
fi
