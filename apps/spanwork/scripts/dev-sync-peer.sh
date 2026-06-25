#!/usr/bin/env bash
# 本地第二实例：独立 data 目录 + 独立同步端口，用于与主 dev 实例互测 mDNS / FLM。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export SPANWORK_SYNC_PORT="${SPANWORK_SYNC_PORT:-38473}"
export SPANWORK_VITE_PORT="${SPANWORK_VITE_PORT:-1422}"

echo "Spanwork Peer B — sync port ${SPANWORK_SYNC_PORT}, vite ${SPANWORK_VITE_PORT}"
echo "Data dir: ~/Library/Application Support/com.spanwork.dev-peer/"

VITE_PID=""
cleanup() {
  if [[ -n "${VITE_PID}" ]] && kill -0 "${VITE_PID}" 2>/dev/null; then
    kill "${VITE_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

SPANWORK_VITE_PORT="${SPANWORK_VITE_PORT}" pnpm exec vite --port "${SPANWORK_VITE_PORT}" --strictPort &
VITE_PID=$!

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${SPANWORK_VITE_PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

SPANWORK_SYNC_PORT="${SPANWORK_SYNC_PORT}" \
  pnpm exec tauri dev \
    --config src-tauri/tauri.dev-peer.conf.json \
    --no-dev-server-wait
