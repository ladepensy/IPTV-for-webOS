#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 APP_DIR" >&2
  exit 2
fi

app_dir=$(cd "$1" 2>/dev/null && pwd -P) || {
  echo "App directory not found: $1" >&2
  exit 1
}
manifest="$app_dir/appinfo.json"

if [ ! -f "$manifest" ]; then
  echo "Missing appinfo.json in $app_dir" >&2
  exit 1
fi

manifest_summary=$(node -e '
const fs = require("fs");
const path = require("path");
const manifestPath = process.argv[1];
const appDir = path.dirname(manifestPath);
const info = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const key of ["id", "version", "type", "main", "title"]) {
  if (!info[key]) throw new Error(`appinfo.json missing ${key}`);
}
const requiredFiles = [info.main, info.icon, info.largeIcon].filter(Boolean);
const missing = requiredFiles.filter(file => !fs.existsSync(path.join(appDir, file)));
if (missing.length) throw new Error(`missing referenced files: ${missing.join(", ")}`);
console.log(`App: ${info.id} ${info.version}`);
console.log(`Title: ${info.title}`);
console.log(`Type: ${info.type}`);
console.log(`Main: ${info.main}`);
' "$manifest") || {
  echo "Manifest validation failed" >&2
  exit 1
}

printf '%s\n' "$manifest_summary"

if [ -f "$app_dir/config.js" ]; then
  echo "Local config: present (contents hidden)"
else
  echo "Local config: absent"
fi

for command_name in ares-launch ares-package ares-install ares-inspect ares-device; do
  if command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name: available"
  else
    echo "$command_name: missing"
  fi
done

if command -v ares-config >/dev/null 2>&1; then
  ares-config --profile-details 2>/dev/null || true
fi
