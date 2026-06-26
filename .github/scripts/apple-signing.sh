#!/usr/bin/env bash
set -euo pipefail

: "${APPLE_CERTIFICATE:?APPLE_CERTIFICATE is required}"
: "${APPLE_CERTIFICATE_PASSWORD:?APPLE_CERTIFICATE_PASSWORD is required}"
: "${APPLE_PROVISIONING_PROFILE:?APPLE_PROVISIONING_PROFILE is required}"

KEYCHAIN="${RUNNER_TEMP}/signing.keychain-db"
CERT_PATH="${RUNNER_TEMP}/distribution.p12"
PROFILE_PATH="${RUNNER_TEMP}/profile.mobileprovision"
PROFILE_DIR="${HOME}/Library/MobileDevice/Provisioning Profiles"

security create-keychain -p "" "${KEYCHAIN}"
security set-keychain-settings -lut 21600 "${KEYCHAIN}"
security unlock-keychain -p "" "${KEYCHAIN}"

echo "${APPLE_CERTIFICATE}" | base64 --decode > "${CERT_PATH}"
security import "${CERT_PATH}" \
  -P "${APPLE_CERTIFICATE_PASSWORD}" \
  -A -t cert -f pkcs12 -k "${KEYCHAIN}"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "" "${KEYCHAIN}"
security list-keychain -d user -s "${KEYCHAIN}"

mkdir -p "${PROFILE_DIR}"
echo "${APPLE_PROVISIONING_PROFILE}" | base64 --decode > "${PROFILE_PATH}"

PROFILE_PLIST="${RUNNER_TEMP}/profile.plist"
security cms -D -i "${PROFILE_PATH}" > "${PROFILE_PLIST}"
PROFILE_UUID="$(/usr/libexec/PlistBuddy -c 'Print UUID' "${PROFILE_PLIST}")"
cp "${PROFILE_PATH}" "${PROFILE_DIR}/${PROFILE_UUID}.mobileprovision"

echo "Installed provisioning profile ${PROFILE_UUID}"
