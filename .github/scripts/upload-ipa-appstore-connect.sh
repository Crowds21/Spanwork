#!/usr/bin/env bash
set -euo pipefail

: "${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required}"
: "${APPLE_API_ISSUER_ID:?APPLE_API_ISSUER_ID is required}"
: "${APPLE_API_KEY_P8:?APPLE_API_KEY_P8 is required}"

KEY_DIR="${HOME}/.appstoreconnect/private_keys"
KEY_FILE="${KEY_DIR}/AuthKey_${APPLE_API_KEY_ID}.p8"

mkdir -p "${KEY_DIR}"
printf '%s' "${APPLE_API_KEY_P8}" > "${KEY_FILE}"

IPA="$(find apps/spanwork/src-tauri/gen/apple/build -name '*.ipa' -print -quit)"
if [[ -z "${IPA}" ]]; then
  echo "No .ipa found under apps/spanwork/src-tauri/gen/apple/build" >&2
  exit 1
fi

echo "Uploading ${IPA} to App Store Connect..."
xcrun altool --upload-app -f "${IPA}" -t ios \
  --apiKey "${APPLE_API_KEY_ID}" \
  --apiIssuer "${APPLE_API_ISSUER_ID}"

rm -f "${KEY_FILE}"
