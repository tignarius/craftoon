# Craftoon 1.0 (2) validation

Date: 2026-11-27, America/Vancouver. Source checkpoint: `f23b5c7d`.

## Checks completed

- JavaScript: 19 suites, 366 tests passed (`jest --runInBand --watchman=false`).
- TypeScript: `tsc --noEmit` passed.
- Plist syntax, shell syntax for `scripts/hermes-dsym.sh`, and `git diff --check` passed.
- Xcode Release `archive`: **ARCHIVE SUCCEEDED**.
- Archived identity: `com.squareplayer.craftoon`, marketing version `1.0`, build `2`, iPad device family `[2]`.
- `ITSAppUsesNonExemptEncryption`: false.
- Archived app signature: `codesign --verify --deep --strict` passed.

## Symbols in the actual archive

| Component | Binary UUID (arm64) | dSYM UUID (arm64) |
| --- | --- | --- |
| Craftoon | `65253CFC-D659-322E-B795-744D65276BE4` | `65253CFC-D659-322E-B795-744D65276BE4` |
| hermesvm.framework | `C5FDDA8D-39DF-30DC-9A24-EF9999BB4541` | `C5FDDA8D-39DF-30DC-9A24-EF9999BB4541` |

The archive contains `dSYMs/Craftoon.app.dSYM` and `dSYMs/hermesvm.framework.dSYM`. Hermes is its only embedded dynamic framework. `dwarfdump --verify` for the archived Hermes dSYM reported **No errors**.

The existing official RN/Hermes 0.82.1 Release symbol fix was used without changing dependencies or disabling Hermes. Build 1 remains unchanged.

## Distribution

Export/upload used Xcode automatic signing, `method=app-store-connect`, `destination=upload`, `uploadSymbols=true`, `manageAppVersionAndBuildNumber=false`, and `testFlightInternalTestingOnly=false`.

Xcode reported **Upload succeeded** and **EXPORT SUCCEEDED**. No symbol-upload warning or other warning/error was present in the export/upload log. Organizer displays **1.0 (2), Uploaded to Apple**. App Store Connect subsequently completed processing and displayed **Build 2 — Ready to Submit**. No review approval is implied.

Local archive: `release/Craftoon-1.0-build2.xcarchive` (ignored, not committed).
Local validation logs: `/tmp/craftoon-build2-tests.log`, `/tmp/craftoon-build2-archive.log`, `/tmp/craftoon-build2-dsym-verify.log`, `/tmp/craftoon-build2-upload.log`.

Craftoon Pro's real purchase review screenshot and review notes were independently observed saved in App Store Connect. Build **1.0 (2)** was selected and saved on iOS App Version 1.0. The app version was added to the existing Craftoon Pro draft. App Store Connect now shows **Items Ready to Submit (2)** containing **iOS App 1.0 — 1.0 (2)** and **Craftoon Pro**, with **Submit for Review** enabled. The app and IAP are **Ready for Review**. **Submit for Review has not been clicked.** Manual release remains selected.
