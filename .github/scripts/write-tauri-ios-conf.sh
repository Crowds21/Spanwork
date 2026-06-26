#!/usr/bin/env bash
set -euo pipefail

: "${APPLE_DEVELOPMENT_TEAM:?APPLE_DEVELOPMENT_TEAM is required}"

cat > apps/spanwork/src-tauri/tauri.ios.conf.json <<EOF
{
  "identifier": "com.spanwork.app",
  "bundle": {
    "iOS": {
      "developmentTeam": "${APPLE_DEVELOPMENT_TEAM}"
    }
  }
}
EOF
