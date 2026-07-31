#!/bin/sh
set -eu

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 VERSION APP_DIR [SIMULATOR_DIR]" >&2
  exit 2
fi

version=$1
app_dir=$(cd "$2" 2>/dev/null && pwd -P) || {
  echo "App directory not found: $2" >&2
  exit 1
}

case "$version" in
  *[!0-9.]*|'')
    echo "Invalid webOS TV version: $version" >&2
    exit 1
    ;;
esac

if [ ! -f "$app_dir/appinfo.json" ]; then
  echo "Missing appinfo.json in $app_dir" >&2
  exit 1
fi

if ! command -v ares-launch >/dev/null 2>&1; then
  echo "ares-launch is not installed" >&2
  exit 1
fi

if [ "$#" -eq 3 ]; then
  simulator_dir=$(cd "$3" 2>/dev/null && pwd -P) || {
    echo "Simulator directory not found: $3" >&2
    exit 1
  }
  exec ares-launch --simulator "$version" --simulator-path "$simulator_dir" "$app_dir"
fi

exec ares-launch --simulator "$version" "$app_dir"
