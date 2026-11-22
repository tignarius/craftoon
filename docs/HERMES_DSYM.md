# Hermes Release symbols

React Native 0.82.1 / Hermes 0.82.1 (prebuilt), CocoaPods 1.16.2, Xcode 27.2.

The prebuilt Hermes runtime tarball does not contain a dSYM. React Native's
[0.82.1 release](https://github.com/facebook/react-native/releases/tag/v0.82.1)
provides Debug and Release symbol tarballs separately. CocoaPods embeds the runtime,
but this project's generated embedding script does not install the separate symbols.
The app's Release setting already resolves to `DEBUG_INFORMATION_FORMAT=dwarf-with-dsym`;
that generates the app's symbols, not symbols for a prebuilt framework.

After installing Pods (also after deleting Pods), prepare the official Release symbols:

```sh
/bin/sh scripts/hermes-dsym.sh --prepare
```

The script pins the official 0.82.1 Release artifact's SHA-256:
`82d3c1aa1e59c83acd39a366173974fae41adfb57d8446ea495705a6b4697c7c`.
It extracts only the iPhoneOS symbols into the ignored `ios/Pods/hermes-symbols` cache.
Do not commit the downloaded binaries. Network access is used only by `--prepare`.

The app target's final **Copy verified Hermes dSYM** build phase runs only for Release
on iPhoneOS, after CocoaPods embeds Hermes. It checks the installed Hermes version,
compares framework and dSYM UUID/architecture pairs, then copies the original official
dSYM into `DWARF_DSYM_FOLDER_PATH`, outside the app bundle. It verifies the copy too.
Missing symbols or a UUID mismatch fail the build with an actionable error. Debug and
simulator builds are unchanged. A future Hermes upgrade requires reviewing the pinned
artifact, checksum and UUID compatibility rather than silently using old symbols.

Expected arm64 UUID for this version:
`C5FDDA8D-39DF-30DC-9A24-EF9999BB4541`.

Validation uses an ordinary Release **build**, not Archive or export/upload:

```sh
xcodebuild -workspace ios/Craftoon.xcworkspace -scheme Craftoon \
  -configuration Release -destination 'generic/platform=iOS' build
```

Use `xcrun dwarfdump --uuid` on the built app's
`Frameworks/hermesvm.framework/hermesvm` and on the copied
`hermesvm.framework.dSYM` in the Release products directory. Both must report the
same UUID and architecture. The official dSYM includes real DWARF compilation units;
no placeholder dSYM is generated from the stripped runtime.

The Build 1 archive is left untouched. App version remains 1.0 and build number remains
1 pending owner confirmation to proceed with Build 2. No new Archive, export,
upload, or App Store Connect submission is part of this fix's validation.

## Validation recorded for this fix

- Normal Release iPhoneOS `build`: succeeded; final copy phase logged the matching UUID.
- Final embedded framework and copied dSYM: matching arm64 UUID above.
- `dwarfdump --verify` on the copied dSYM: `No errors.`
- `codesign --verify --deep --strict`: valid on disk; designated requirement satisfied.
- Negative checks: missing cache and a mismatched executable both rejected.
- Debug and simulator checks: skipped without changing output.
- `sh -n`, Xcode project plist parsing and `git diff --check`: passed.
- Final built app identity: `com.squareplayer.craftoon`, version `1.0`, build `1`.

These checks do not claim Archive packaging or App Store Connect symbol-upload
acceptance. Those can be confirmed only when the owner explicitly proceeds with
Archive and distribution.
