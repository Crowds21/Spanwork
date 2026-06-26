#!/usr/bin/env bash
set -euo pipefail

: "${MARKETING_VERSION:?MARKETING_VERSION is required}"
: "${BUILD_NUMBER:?BUILD_NUMBER is required}"

TAURI_CONF="apps/spanwork/src-tauri/tauri.conf.json"
ROOT_PKG="package.json"
APP_PKG="apps/spanwork/package.json"

node <<EOF
const fs = require('fs');

const marketing = process.env.MARKETING_VERSION;
const buildNumber = process.env.BUILD_NUMBER;

for (const file of ['${TAURI_CONF}', '${ROOT_PKG}', '${APP_PKG}']) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.version = marketing;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}

const tauri = JSON.parse(fs.readFileSync('${TAURI_CONF}', 'utf8'));
tauri.bundle ??= {};
tauri.bundle.iOS ??= {};
tauri.bundle.iOS.bundleVersion = buildNumber;
fs.writeFileSync('${TAURI_CONF}', JSON.stringify(tauri, null, 2) + '\n');

console.log('Patched version to', marketing, 'iOS build', buildNumber);
EOF
