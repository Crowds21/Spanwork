#!/usr/bin/env bash
set -euo pipefail

preferred="${1:-26}"
selected=""

shopt -s nullglob
candidates=("/Applications/Xcode_${preferred}"*.app)
shopt -u nullglob

if [[ "${#candidates[@]}" -gt 0 ]]; then
  selected="$(printf '%s\n' "${candidates[@]}" | sort -r | head -n 1)"
fi

if [[ -z "${selected}" && -d "/Applications/Xcode.app" ]]; then
  selected="/Applications/Xcode.app"
fi

if [[ -z "${selected}" ]]; then
  echo "No Xcode installation found under /Applications" >&2
  exit 1
fi

sudo xcode-select -s "${selected}/Contents/Developer"
echo "DEVELOPER_DIR=${selected}/Contents/Developer" >> "${GITHUB_ENV}"
xcodebuild -version
