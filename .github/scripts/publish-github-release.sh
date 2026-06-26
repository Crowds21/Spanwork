#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_TAG:?RELEASE_TAG is required}"
: "${RELEASE_TITLE:?RELEASE_TITLE is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${PRERELEASE:?PRERELEASE is required}"

shopt -s nullglob

mapfile -d '' assets < <(
  find release-assets -type f \( -name '*.dmg' -o -name '*.msi' -o -name '*.exe' -o -name '*.ipa' \) -print0 \
    | sort -z
)

if [[ "${#assets[@]}" -eq 0 ]]; then
  echo "No release assets were downloaded." >&2
  exit 1
fi

notes="Automated Spanwork release ${RELEASE_TAG} from commit ${GITHUB_SHA}."

prerelease_flag=()
if [[ "${PRERELEASE}" == "true" ]]; then
  prerelease_flag=(--prerelease)
else
  prerelease_flag=(--latest)
fi

if gh release view "${RELEASE_TAG}" >/dev/null 2>&1; then
  gh release edit "${RELEASE_TAG}" \
    --title "${RELEASE_TITLE}" \
    --notes "${notes}" \
    "${prerelease_flag[@]}"
  gh release upload "${RELEASE_TAG}" "${assets[@]}" --clobber
else
  gh release create "${RELEASE_TAG}" "${assets[@]}" \
    --target "${GITHUB_SHA}" \
    --title "${RELEASE_TITLE}" \
    --notes "${notes}" \
    "${prerelease_flag[@]}"
fi

echo "Published GitHub Release ${RELEASE_TAG}"
