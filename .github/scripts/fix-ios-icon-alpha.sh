#!/usr/bin/env bash
set -euo pipefail

ICONSET="${TAURI_IOS_APPICONSET:-apps/spanwork/src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset}"

if [[ ! -d "${ICONSET}" ]]; then
  echo "iOS AppIcon set not found at ${ICONSET}" >&2
  exit 1
fi

has_alpha() {
  local file="$1"
  sips -g hasAlpha "$file" 2>/dev/null | grep -q "hasAlpha: yes"
}

remove_alpha_with_pngcrush() {
  local file="$1"

  if command -v xcrun >/dev/null 2>&1 && xcrun --find pngcrush >/dev/null 2>&1; then
    xcrun pngcrush -q -ow -rem alla "$file" >/dev/null 2>&1 || return 1
  elif command -v pngcrush >/dev/null 2>&1; then
    pngcrush -q -ow -rem alla "$file" >/dev/null 2>&1 || return 1
  else
    return 1
  fi
}

remove_alpha_with_jpeg_roundtrip() {
  local file="$1"
  local tmp_jpeg="${RUNNER_TEMP:-/tmp}/$(basename "$file").jpg"
  local tmp_png="${RUNNER_TEMP:-/tmp}/$(basename "$file").png"

  sips -s format jpeg "$file" --out "$tmp_jpeg" >/dev/null
  sips -s format png "$tmp_jpeg" --out "$tmp_png" >/dev/null
  mv "$tmp_png" "$file"
  rm -f "$tmp_jpeg"
}

fixed=0

while IFS= read -r -d '' icon; do
  if ! has_alpha "$icon"; then
    continue
  fi

  remove_alpha_with_pngcrush "$icon" || true

  if has_alpha "$icon"; then
    remove_alpha_with_jpeg_roundtrip "$icon"
  fi

  if has_alpha "$icon"; then
    echo "Failed to remove alpha channel from ${icon}" >&2
    exit 1
  fi

  fixed=$((fixed + 1))
  echo "Removed alpha channel from ${icon}"
done < <(find "${ICONSET}" -name '*.png' -print0)

echo "iOS AppIcon alpha cleanup complete; fixed ${fixed} file(s)."
