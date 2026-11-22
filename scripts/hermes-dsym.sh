#!/bin/sh
# RN 0.82.1 distributes its prebuilt Hermes symbols separately from the runtime.
set -eu
repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=0.82.1
checksum=82d3c1aa1e59c83acd39a366173974fae41adfb57d8446ea495705a6b4697c7c
cache="${PODS_ROOT:-$repo/ios/Pods}/hermes-symbols/$version/Release"
symbols="$cache/iphoneos/hermesvm.framework.dSYM"
fail() { echo "error: Hermes symbols: $*" >&2; exit 1; }

if [ "${1:-}" = --prepare ]; then
  temp=$(mktemp -d)
  trap 'rm -rf "$temp"' EXIT HUP INT TERM
  url="https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/$version/react-native-artifacts-$version-hermes-framework-dSYM-release.tar.gz"
  curl --fail --location --retry 2 "$url" -o "$temp/symbols.tar.gz"
  actual=$(shasum -a 256 "$temp/symbols.tar.gz" | awk '{print $1}')
  [ "$actual" = "$checksum" ] || fail 'Official artifact checksum mismatch.'
  mkdir -p "$cache"
  tar -xzf "$temp/symbols.tar.gz" -C "$cache" ./iphoneos
  echo "Prepared official React Native $version Release Hermes dSYM."
  exit 0
fi

# Leave Debug and simulator builds untouched. No network requests during builds.
[ "${CONFIGURATION:-}" = Release ] || exit 0
[ "${PLATFORM_NAME:-}" = iphoneos ] || exit 0
pods="${PODS_ROOT:-$repo/ios/Pods}"
grep -q '^  - hermes-engine (0.82.1):' "$pods/Manifest.lock" || fail 'Recheck symbol version after changing Hermes.'
[ -d "$symbols" ] || fail 'Run /bin/sh scripts/hermes-dsym.sh --prepare before the Release device build.'
binary="${TARGET_BUILD_DIR:?}/${FRAMEWORKS_FOLDER_PATH:?}/hermesvm.framework/hermesvm"
[ -f "$binary" ] || fail "Embedded Hermes not found: $binary"
uuids() { xcrun dwarfdump --uuid "$1" | awk '/^UUID:/ {print $2, $3}' | LC_ALL=C sort; }
framework_uuids=$(uuids "$binary")
symbol_uuids=$(uuids "$symbols")
[ -n "$framework_uuids" ] && [ "$framework_uuids" = "$symbol_uuids" ] || fail 'Framework and official dSYM UUIDs do not match.'
[ -s "$symbols/Contents/Resources/DWARF/hermesvm" ] || fail 'Missing DWARF data.'
mkdir -p "${DWARF_DSYM_FOLDER_PATH:?}"
destination="$DWARF_DSYM_FOLDER_PATH/hermesvm.framework.dSYM"
# Copy outside the .app, where Xcode collects dSYMs for distribution.
ditto "$symbols" "$destination"
[ "$(uuids "$destination")" = "$framework_uuids" ] || fail 'Copied dSYM UUID mismatch.'
echo "Verified Hermes framework and dSYM: $framework_uuids"
