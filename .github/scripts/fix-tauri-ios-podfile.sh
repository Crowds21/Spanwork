#!/usr/bin/env bash
set -euo pipefail

APPLE_DIR="${TAURI_APPLE_DIR:-apps/spanwork/src-tauri/gen/apple}"
PODFILE="${APPLE_DIR}/Podfile"
PROJECT_FILE="${APPLE_DIR}/spanwork.xcodeproj/project.pbxproj"

if [[ ! -f "${PODFILE}" ]]; then
  echo "Podfile not found at ${PODFILE}" >&2
  exit 1
fi

if [[ ! -f "${PROJECT_FILE}" ]]; then
  echo "Xcode project file not found at ${PROJECT_FILE}" >&2
  exit 1
fi

if ! grep -Eq "target ['\"]spanwork_macOS['\"] do" "${PODFILE}"; then
  echo "Podfile does not contain a spanwork_macOS target; no changes needed."
  exit 0
fi

if grep -q "spanwork_macOS" "${PROJECT_FILE}"; then
  echo "Xcode project contains spanwork_macOS; keeping Podfile unchanged."
  exit 0
fi

node - "${PODFILE}" <<'NODE'
const fs = require('fs');

const podfile = process.argv[2];
const lines = fs.readFileSync(podfile, 'utf8').split(/(?<=\n)/);
const output = [];
let skipDepth = 0;
let removed = false;

for (const line of lines) {
  if (skipDepth > 0) {
    skipDepth += (line.match(/\bdo\b/g) || []).length;
    skipDepth -= /^\s*end\b/.test(line) ? 1 : 0;
    continue;
  }

  if (/^\s*target\s+['"]spanwork_macOS['"]\s+do\b/.test(line)) {
    removed = true;
    skipDepth = (line.match(/\bdo\b/g) || []).length - (/^\s*end\b/.test(line) ? 1 : 0);
    continue;
  }

  output.push(line);
}

if (!removed) {
  console.error(`Unable to remove spanwork_macOS target from ${podfile}`);
  process.exit(1);
}

fs.writeFileSync(podfile, output.join(''));
NODE

echo "Removed spanwork_macOS target from ${PODFILE}; generated Xcode project only contains spanwork_iOS."
