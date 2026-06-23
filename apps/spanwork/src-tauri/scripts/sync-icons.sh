#!/usr/bin/env bash
# Sync SpanWorkIcon Exports → Tauri standard icon layout (desktop / iOS / Android).
# Source deliverable: icons/SpanWorkIcon Exports/ (design export, not referenced in tauri.conf.json)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONS="$ROOT/icons"
EXPORTS="$ICONS/SpanWorkIcon Exports"
MASTER="$ICONS/app-icon.png"
IOS="$ICONS/ios"
XCODE_ICONSET="$ROOT/gen/apple/Assets.xcassets/AppIcon.appiconset"

if [[ ! -d "$EXPORTS" ]]; then
  echo "error: missing export folder: $EXPORTS" >&2
  exit 1
fi

SRC_1024="$EXPORTS/SpanWorkIcon-iOS-Default-1024x1024@1x.png"
if [[ ! -f "$SRC_1024" ]]; then
  echo "error: missing 1024 master: $SRC_1024" >&2
  exit 1
fi

echo "→ Updating master app-icon.png"
cp "$SRC_1024" "$MASTER"

echo "→ Generating desktop / Android / Windows assets via tauri icon"
(
  cd "$ROOT/.."
  pnpm tauri icon src-tauri/icons/app-icon.png -o src-tauri/icons
)

echo "→ Mapping iOS export sizes to icons/ios/ (Tauri + Xcode naming)"
mkdir -p "$IOS"

copy_export() {
  local export_name="$1"
  local dest_name="$2"
  cp "$EXPORTS/$export_name" "$IOS/$dest_name"
}

copy_export "SpanWorkIcon-iOS-Default-1024x1024@1x.png" "AppIcon-512@2x.png"
copy_export "SpanWorkIcon-iOS-Default-20x20@2x.png" "AppIcon-20x20@2x.png"
copy_export "SpanWorkIcon-iOS-Default-20x20@2x.png" "AppIcon-20x20@2x-1.png"
copy_export "SpanWorkIcon-iOS-Default-20x20@3x.png" "AppIcon-20x20@3x.png"
copy_export "SpanWorkIcon-iOS-Default-29x29@2x.png" "AppIcon-29x29@2x.png"
copy_export "SpanWorkIcon-iOS-Default-29x29@2x.png" "AppIcon-29x29@2x-1.png"
copy_export "SpanWorkIcon-iOS-Default-29x29@3x.png" "AppIcon-29x29@3x.png"
copy_export "SpanWorkIcon-iOS-Default-40x40@2x.png" "AppIcon-40x40@2x.png"
copy_export "SpanWorkIcon-iOS-Default-40x40@2x.png" "AppIcon-40x40@2x-1.png"
copy_export "SpanWorkIcon-iOS-Default-40x40@3x.png" "AppIcon-40x40@3x.png"
copy_export "SpanWorkIcon-iOS-Default-60x60@2x.png" "AppIcon-60x60@2x.png"
copy_export "SpanWorkIcon-iOS-Default-60x60@3x.png" "AppIcon-60x60@3x.png"
copy_export "SpanWorkIcon-iOS-Default-76x76@2x.png" "AppIcon-76x76@2x.png"
copy_export "SpanWorkIcon-iOS-Default-83.5x83.5@2x.png" "AppIcon-83.5x83.5@2x.png"

# 1x iPad / notification sizes not in export bundle — resize from master
resize_icon() {
  local px="$1"
  local dest="$2"
  sips -z "$px" "$px" "$MASTER" --out "$IOS/$dest" >/dev/null
}

resize_icon 20 "AppIcon-20x20@1x.png"
resize_icon 29 "AppIcon-29x29@1x.png"
resize_icon 40 "AppIcon-40x40@1x.png"
resize_icon 76 "AppIcon-76x76@1x.png"

if [[ -d "$XCODE_ICONSET" ]]; then
  echo "→ Syncing icons/ios/ → gen/apple/Assets.xcassets/AppIcon.appiconset/"
  cp "$IOS"/*.png "$XCODE_ICONSET"/
else
  echo "→ Skip Xcode iconset sync (gen/apple not initialized)"
fi

echo "✓ Icons synced"
