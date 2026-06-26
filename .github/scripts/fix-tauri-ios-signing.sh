#!/usr/bin/env bash
set -euo pipefail

APPLE_DIR="${TAURI_APPLE_DIR:-apps/spanwork/src-tauri/gen/apple}"
PROJECT_FILE="${APPLE_DIR}/spanwork.xcodeproj/project.pbxproj"

: "${IOS_DEVELOPMENT_TEAM:?IOS_DEVELOPMENT_TEAM is required}"
: "${IOS_PROVISIONING_PROFILE_UUID:?IOS_PROVISIONING_PROFILE_UUID is required}"

CODE_SIGN_IDENTITY="${IOS_CODE_SIGN_IDENTITY:-Apple Distribution}"

if [[ ! -f "${PROJECT_FILE}" ]]; then
  echo "Xcode project file not found at ${PROJECT_FILE}" >&2
  exit 1
fi

node - "${PROJECT_FILE}" "${IOS_DEVELOPMENT_TEAM}" "${IOS_PROVISIONING_PROFILE_UUID}" "${CODE_SIGN_IDENTITY}" <<'NODE'
const fs = require('fs');

const [projectFile, teamId, profileUuid, identity] = process.argv.slice(2);
const source = fs.readFileSync(projectFile, 'utf8');
let project = source;
const lines = project.split(/(?<=\n)/);
const output = [];
let patchedBlocks = 0;
let patchedShellScripts = 0;

const settings = [
  ['CODE_SIGN_STYLE', 'Manual'],
  ['DEVELOPMENT_TEAM', teamId],
  ['PROVISIONING_PROFILE', `"${profileUuid}"`],
  ['PROVISIONING_PROFILE_SPECIFIER', `"${profileUuid}"`],
  ['CODE_SIGN_IDENTITY', `"${identity}"`],
];

function upsertSetting(block, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^(\\s*)${escapedKey}\\s*=.*;\\n$`);
  const index = block.findIndex((line) => pattern.test(line));

  if (index >= 0) {
    block[index] = block[index].replace(pattern, `$1${key} = ${value};\n`);
    return;
  }

  const closeIndex = block.findIndex((line) => /^\s*};\n?$/.test(line));
  const indent = closeIndex > 0 && /^(\s*)/.test(block[closeIndex - 1])
    ? block[closeIndex - 1].match(/^(\s*)/)[1]
    : '\t\t\t\t';
  block.splice(closeIndex, 0, `${indent}${key} = ${value};\n`);
}

for (let i = 0; i < lines.length; i += 1) {
  if (!/^\s*buildSettings = \{\n?$/.test(lines[i])) {
    output.push(lines[i]);
    continue;
  }

  const block = [lines[i]];
  i += 1;
  while (i < lines.length) {
    block.push(lines[i]);
    if (/^\s*};\n?$/.test(lines[i])) break;
    i += 1;
  }

  if (block.some((line) => /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?com\.spanwork\.app"?;/.test(line))) {
    for (const [key, value] of settings) {
      upsertSetting(block, key, value);
    }
    patchedBlocks += 1;
  }

  output.push(...block);
}

if (patchedBlocks === 0) {
  console.error(`No iOS app build settings were patched in ${projectFile}`);
  process.exit(1);
}

project = output.join('');

project = project.replace(
  /([A-F0-9]+ \/\* Build Rust Code \*\/ = \{[\s\S]*?isa = PBXShellScriptBuildPhase;[\s\S]*?name = "Build Rust Code";[\s\S]*?shellScript = ")([\s\S]*?)(";[\s\S]*?\n\s*\};)/g,
  (match, prefix, script, suffix) => {
    if (script.includes('PNPM_CONFIG_CONFIRM_MODULES_PURGE=false')) {
      return match;
    }

    patchedShellScripts += 1;
    return `${prefix}export CI=true\\nexport PNPM_CONFIG_CONFIRM_MODULES_PURGE=false\\n${script}${suffix}`;
  },
);

if (patchedShellScripts === 0) {
  console.error(`No Build Rust Code shell script was patched in ${projectFile}`);
  process.exit(1);
}

fs.writeFileSync(projectFile, project);
console.log(`Patched ${patchedBlocks} iOS app build settings block(s) in ${projectFile}`);
console.log(`Patched ${patchedShellScripts} Build Rust Code shell script phase(s) in ${projectFile}`);
NODE
