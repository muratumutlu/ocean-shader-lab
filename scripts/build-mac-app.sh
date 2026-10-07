#!/usr/bin/env bash
# Builds the Ocean Focus macOS menu bar app: web scene → app resources → Xcode project → .app
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR=apps/OceanFocus
CONFIG=${1:-Debug}

echo "==> Web scene"
npx vite build --logLevel warn
rm -rf "$APP_DIR/Resources/web" && mkdir -p "$APP_DIR/Resources/web"
cp -R dist/. "$APP_DIR/Resources/web/"

echo "==> Xcode project"
(cd "$APP_DIR" && xcodegen generate --quiet)

echo "==> macOS app ($CONFIG)"
xcodebuild -project "$APP_DIR/OceanFocus.xcodeproj" -scheme OceanFocusMac -configuration "$CONFIG" \
  -derivedDataPath "$APP_DIR/build" -quiet build
APP="$APP_DIR/build/Build/Products/$CONFIG/Ocean Focus.app"
echo "Built: $APP"
