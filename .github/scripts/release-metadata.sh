#!/usr/bin/env bash
# Resolve release tag, marketing version, and channel (beta | release).
# Usage: release-metadata.sh [beta|release]
# For workflow_dispatch, set INPUT_CHANNEL and optionally INPUT_TAG_NAME.

set -euo pipefail

EXPECTED_CHANNEL="${1:-}"

if [[ -n "${EXPECTED_CHANNEL}" ]]; then
  case "${EXPECTED_CHANNEL}" in
    beta | release) ;;
    *)
      echo "Invalid channel: ${EXPECTED_CHANNEL}" >&2
      exit 1
      ;;
  esac
fi

if [[ "${GITHUB_REF_TYPE:-}" == "tag" ]]; then
  RELEASE_TAG="${GITHUB_REF_NAME}"
elif [[ -n "${INPUT_TAG_NAME:-}" ]]; then
  RELEASE_TAG="${INPUT_TAG_NAME}"
else
  PKG_VER="$(node -p "require('./package.json').version")"
  SYNTH_CHANNEL="${EXPECTED_CHANNEL:-${INPUT_CHANNEL:-beta}}"
  if [[ "${SYNTH_CHANNEL}" == "beta" ]]; then
    RELEASE_TAG="v${PKG_VER}-beta.${GITHUB_RUN_NUMBER}"
  else
    RELEASE_TAG="v${PKG_VER}"
  fi
fi

if [[ "${RELEASE_TAG}" != v* ]]; then
  echo "Release tag must start with 'v': ${RELEASE_TAG}" >&2
  exit 1
fi

if [[ "${RELEASE_TAG}" == *"-beta."* ]]; then
  CHANNEL="beta"
  PRERELEASE="true"
else
  CHANNEL="release"
  PRERELEASE="false"
fi

if [[ "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" && -n "${INPUT_CHANNEL:-}" ]]; then
  CHANNEL="${INPUT_CHANNEL}"
  if [[ "${CHANNEL}" == "beta" && "${PRERELEASE}" != "true" && -z "${INPUT_TAG_NAME:-}" ]]; then
    PKG_VER="$(node -p "require('./package.json').version")"
    RELEASE_TAG="v${PKG_VER}-beta.${GITHUB_RUN_NUMBER}"
    PRERELEASE="true"
  fi
  if [[ "${CHANNEL}" == "release" && "${PRERELEASE}" == "true" && -z "${INPUT_TAG_NAME:-}" ]]; then
    echo "workflow_dispatch release channel requires a non-beta tag via INPUT_TAG_NAME" >&2
    exit 1
  fi
  if [[ "${CHANNEL}" == "release" ]]; then
    PRERELEASE="false"
  fi
  if [[ "${CHANNEL}" == "beta" ]]; then
    PRERELEASE="true"
  fi
fi

if [[ -n "${EXPECTED_CHANNEL}" && "${CHANNEL}" != "${EXPECTED_CHANNEL}" ]]; then
  echo "Tag ${RELEASE_TAG} resolves to channel '${CHANNEL}', expected '${EXPECTED_CHANNEL}'. Skipping." >&2
  exit 1
fi

REF="${RELEASE_TAG#v}"
MARKETING="${REF%%-beta.*}"
BUILD_NUMBER="${GITHUB_RUN_NUMBER}"
TITLE="Spanwork v${REF}"
if [[ "${PRERELEASE}" == "true" ]]; then
  TITLE="Spanwork v${REF} (beta)"
fi

{
  echo "channel=${CHANNEL}"
  echo "release_tag=${RELEASE_TAG}"
  echo "marketing_version=${MARKETING}"
  echo "build_number=${BUILD_NUMBER}"
  echo "prerelease=${PRERELEASE}"
  echo "release_title=${TITLE}"
} >> "${GITHUB_OUTPUT}"

echo "Release tag: ${RELEASE_TAG}"
echo "Channel: ${CHANNEL}"
echo "Marketing version: ${MARKETING}"
echo "Build number: ${BUILD_NUMBER}"
