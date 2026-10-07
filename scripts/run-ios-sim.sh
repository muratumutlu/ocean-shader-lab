#!/usr/bin/env bash
# Builds Ocean Focus for the iOS simulator and runs it on a device (default: iPhone Duo).
# Usage: scripts/run-ios-sim.sh ["iPhone 18 Pro"] [--skip-web]
set -euo pipefail
cd "$(dirname "$0")/.."
DEVICE=${1:-iPhone Duo}
APP_DIR=apps/OceanFocus
if [ "${2:-}" != "--skip-web" ]; then
  npx vite build --logLevel error
  rm -rf "$APP_DIR/Resources/web" && mkdir -p "$APP_DIR/Resources/web" && cp -R dist/. "$APP_DIR/Resources/web/"
fi
(cd "$APP_DIR" && xcodegen generate --quiet)
UDID=$(xcrun simctl list devices available --json | python3 -c '
import json,sys
devices=[d for runtime,ds in json.load(sys.stdin)["devices"].items() if "iOS-27" in runtime for d in ds if d["name"]==sys.argv[1]]
print(devices[-1]["udid"] if devices else "")' "$DEVICE")
[ -n "$UDID" ] || { echo "No simulator named $DEVICE" >&2; exit 1; }
xcodebuild -project "$APP_DIR/OceanFocus.xcodeproj" -scheme OceanFocusiOS -configuration Debug \
  -destination "id=$UDID" -derivedDataPath "$APP_DIR/build" -quiet build
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
APP="$APP_DIR/build/Build/Products/Debug-iphonesimulator/Ocean Focus.app"
xcrun simctl install "$UDID" "$APP"
xcrun simctl terminate "$UDID" ai.muum.oceanfocus 2>/dev/null || true
xcrun simctl launch "$UDID" ai.muum.oceanfocus >/dev/null
echo "Running on $DEVICE ($UDID)"
