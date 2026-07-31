#!/bin/sh
set -eu

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 DEVICE APP_DIR [--inspect]" >&2
  exit 2
fi

device=$1
app_dir=$(cd "$2" 2>/dev/null && pwd -P) || {
  echo "App directory not found: $2" >&2
  exit 1
}
inspect=false

if [ "$#" -eq 3 ]; then
  if [ "$3" != "--inspect" ]; then
    echo "Unknown option: $3" >&2
    exit 2
  fi
  inspect=true
fi

if [ ! -f "$app_dir/appinfo.json" ]; then
  echo "Missing appinfo.json in $app_dir" >&2
  exit 1
fi

for command_name in ares-device ares-package ares-install ares-launch; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing command: $command_name" >&2
    exit 1
  fi
done

app_id=$(node -e 'const i=require(process.argv[1]); if(!i.id) process.exit(1); process.stdout.write(i.id)' "$app_dir/appinfo.json")
task_tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/webos-tv-debug.XXXXXX")
cleanup() {
  case "$task_tmp_dir" in
    "${TMPDIR:-/tmp}"/webos-tv-debug.*) rm -rf -- "$task_tmp_dir" ;;
  esac
}
trap cleanup EXIT HUP INT TERM

echo "Checking device: $device"
ares-device --system-info --device "$device"

echo "Packaging: $app_id"
ares-package "$app_dir" --outdir "$task_tmp_dir"
package_file=$(find "$task_tmp_dir" -maxdepth 1 -type f -name '*.ipk' -print -quit)

if [ -z "$package_file" ]; then
  echo "ares-package did not create an IPK" >&2
  exit 1
fi

echo "Installing: $(basename "$package_file")"
ares-install --device "$device" "$package_file"

echo "Launching: $app_id"
ares-launch --device "$device" "$app_id"

if [ "$inspect" = true ]; then
  if ! command -v ares-inspect >/dev/null 2>&1; then
    echo "Missing command: ares-inspect" >&2
    exit 1
  fi
  ares-inspect --device "$device" --app "$app_id" --open
fi
