#!/usr/bin/env bash
# Runs every test suite across macOS, the iPhone Duo simulator and the web scene.
# Requires Xcode 27.1+ (iPhone Duo support) and an installed iOS simulator runtime.
set -euo pipefail
cd "$(dirname "$0")/.."

IOS_DEVICE="iPhone Duo"

latest_ios_runtime() {
  xcrun simctl list runtimes --json | python3 -c '
import json, sys
runtimes = [r for r in json.load(sys.stdin)["runtimes"] if r["platform"] == "iOS" and r["isAvailable"]]
runtimes.sort(key=lambda r: [int(p) for p in r["version"].split(".")])
print(runtimes[-1]["identifier"] if runtimes else "")'
}

device_udid() {
  xcrun simctl list devices available --json | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"].get(sys.argv[1], [])
matches = [d["udid"] for d in devices if d["name"] == sys.argv[2]]
print(matches[0] if matches else "")' "$1" "$2"
}

runtime="$(latest_ios_runtime)"
if [ -z "$runtime" ]; then
  echo "No iOS simulator runtime installed. Run: xcodebuild -downloadPlatform iOS" >&2
  exit 1
fi

udid="$(device_udid "$runtime" "$IOS_DEVICE")"
if [ -z "$udid" ]; then
  udid="$(xcrun simctl create "$IOS_DEVICE" "$IOS_DEVICE" "$runtime")"
fi

echo "==> OceanFocusCore on macOS"
swift test --package-path OceanFocusCore

echo "==> OceanFocusCore on $IOS_DEVICE ($runtime)"
# Full xcodebuild output is long; keep the test summary and any errors. pipefail keeps failures fatal.
(cd OceanFocusCore && xcodebuild test -scheme OceanFocusCore -destination "id=$udid" 2>&1 \
  | grep -E "Executed [0-9]+ tests|\*\* TEST (SUCCEEDED|FAILED) \*\*|error:")

echo "==> Web scene"
npm test -- --maxWorkers=1

echo "All platform tests passed."
