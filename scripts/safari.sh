#!/usr/bin/env bash
#
# Packages Sonorus for Safari: converts the Chrome MV3 build into a Safari Web
# Extension wrapped in a macOS app, which is what App Store distribution needs.
#
# For day-to-day development you do NOT need this — Safari 26 can load
# dist/chrome directly via Settings > Developer > Add Temporary Extension.
# See docs/safari-support.md.
#
# Usage: scripts/safari.sh [--bundle-id <id>] [--build] [--open] [--force]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/safari"
APP_NAME="Sonorus"
BUNDLE_ID="com.0xSiddhant.Sonorus"
DO_BUILD=0 DO_OPEN=0 DO_FORCE=0

step() { printf '\n==> %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --bundle-id) BUNDLE_ID="${2:-}"; [ -n "$BUNDLE_ID" ] || die "--bundle-id needs a value"; shift 2 ;;
    --build) DO_BUILD=1; shift ;;
    --open)  DO_OPEN=1;  shift ;;
    --force) DO_FORCE=1; shift ;;
    --help|-h) awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

step "Checking toolchain"
[ "$(uname -s)" = "Darwin" ] || die "Safari extensions can only be built on macOS."
command -v xcrun >/dev/null 2>&1 || die "xcrun not found. Install Xcode from the App Store."

# The converter ships inside Xcode.app, not the standalone Command Line Tools.
DEVELOPER_DIR_PATH="$(xcode-select -p 2>/dev/null || true)"
case "$DEVELOPER_DIR_PATH" in
  *Xcode*) ;;
  *) die "xcode-select points at '$DEVELOPER_DIR_PATH', which has no Safari extension converter.
       Fix with: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" ;;
esac

# safari-web-extension-packager is the legacy alias for the same tool.
CONVERTER=safari-web-extension-converter
xcrun --find "$CONVERTER" >/dev/null 2>&1 || CONVERTER=safari-web-extension-packager
xcrun --find "$CONVERTER" >/dev/null 2>&1 || die "No Safari web extension converter in this Xcode install."
ok "Xcode $(xcodebuild -version | head -1 | awk '{print $2}'), using $CONVERTER"

step "Building extension sources"
( cd "$ROOT" && npm run build >/dev/null 2>&1 ) || die "npm run build failed. Run it directly to see why."
EXT_DIR="$ROOT/dist/chrome"
[ -f "$EXT_DIR/manifest.json" ] || die "Expected $EXT_DIR/manifest.json after build, but it is missing."
ok "dist/chrome ready"

step "Generating Xcode project"
if [ -e "$OUT_DIR" ]; then
  [ "$DO_FORCE" -eq 1 ] || die "$OUT_DIR already exists. Re-run with --force to overwrite it."
  rm -rf "$OUT_DIR"
fi

# --copy-resources (plural — the singular form is silently mis-parsed) bakes the
# extension into the project. Without it the project only references dist/chrome,
# which the next npm run build wipes out.
xcrun "$CONVERTER" \
  --project-location "$OUT_DIR" --app-name "$APP_NAME" \
  --bundle-identifier "$BUNDLE_ID" --macos-only --swift \
  --copy-resources --no-prompt --no-open "$EXT_DIR"

PROJECT="$OUT_DIR/$APP_NAME/$APP_NAME.xcodeproj"
[ -d "$PROJECT" ] || die "Converter finished but $PROJECT was not created."

# Guard against someone repointing this at dist/firefox, whose gecko block and
# options_ui.browser_style Safari does not understand.
RES_MANIFEST="$OUT_DIR/$APP_NAME/$APP_NAME Extension/Resources/manifest.json"
grep -q 'browser_specific_settings' "$RES_MANIFEST" 2>/dev/null &&
  die "Firefox gecko block leaked into the Safari resources — the input should be dist/chrome."
ok "Project at ${PROJECT#"$ROOT"/}"

if [ "$DO_BUILD" -eq 1 ]; then
  step "Compiling with xcodebuild"
  # Ad-hoc signing is enough to load locally; distribution needs a real team.
  if xcodebuild -project "$PROJECT" -scheme "$APP_NAME" -configuration Debug \
       -derivedDataPath "$OUT_DIR/build" CODE_SIGNING_ALLOWED=NO build \
       >"$OUT_DIR/build.log" 2>&1; then
    ok "Build succeeded"
  else
    printf '\n\033[31mxcodebuild failed.\033[0m Last 20 lines:\n\n'
    tail -20 "$OUT_DIR/build.log"
    exit 1
  fi
fi

step "Next steps"
cat <<EOF
  1. open ${PROJECT#"$ROOT"/}
  2. Set your Team under Signing & Capabilities for BOTH targets
     ($APP_NAME and "$APP_NAME Extension").
  3. Build & run the container app once — that registers the extension.
  4. Safari > Settings > Advanced > "Show features for web developers".
  5. Develop menu > "Allow Unsigned Extensions" (resets on Safari restart).
  6. Safari > Settings > Extensions > enable $APP_NAME.
  7. Click the toolbar icon > "Allow on Every Website".
     Safari does NOT auto-grant <all_urls>; without this the extension is inert.
EOF

[ "$DO_OPEN" -eq 1 ] && open "$PROJECT"
exit 0
