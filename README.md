# Craftoon

Updated 2026-11-20 against application checkpoint `7312da23`.

Craftoon is an English-language iPad app for drawing comics and storyboards. The current application is React Native 0.82.1 / React 19.1.1 with native Swift PencilKit, file-backed artwork, StoreKit purchases and PDF email/printing. The iOS project targets iPad only, with deployment target iPadOS 15.1. Android scaffolding remains in the repository; native feature parity has not been validated.

## Current features

- Canvas, Library and Read screens. Layout and Draw are the two panel modes; stroke selection uses PencilKit's built-in lasso.
- Draw rectangular or slanted panels, resize/move them with guides and snapping, and choose solid, dashed, dotted or invisible borders.
- Templates and Auto arrange tidy rough layouts using template spacing. Already aligned regions are preserved.
- Lock artwork to change a panel boundary without moving/scaling its drawing or tracing reference. Unlocked artwork follows panel resize/reshape; a cached preview follows the gesture and native vector ink is committed once on release.
- Focused panel zoom with crisp borders and separate, unscaled controls. Import one tracing reference per panel from Photos/Files; move, rotate, scale, hide and adjust opacity independently.
- Library cover selection exposes Canvas, Read and Delete actions without moving the gallery. Empty-space deselection, deletion Undo and long-press drag reordering are available. Custom order survives reopening; newly saved comics appear first.
- Read pages by swiping. Pro can attach a PDF in the system Mail composer or print. Cancel/dismiss and failed export restore button availability.
- One bundled English Quick Guide is used in both orientations. The mode menu also provides edition/version, unlock, restore, activation code entry and creator credit.

## Free and Pro

Free includes up to **4 pages per comic** and **1 saved comic** in Library. That saved comic can be edited and saved again. Layout, drawing, tracing, reading and the offline guide are available in Free. Pro is a one-time non-consumable purchase for unlimited pages and saved comics, PDF email and printing. Existing documents are not deleted when access changes. See [Pro setup](docs/PRO_SETUP.md).

## Development

Install the JavaScript dependencies with `npm ci`. For native dependencies, use `bundle install`, then run `bundle exec pod install` from `ios/`. An existing configured Xcode installation and appropriate signing are required for a physical device.

```sh
npm start
npm run ios
# Release, without a Metro dependency:
npm run ios:release
```

Use the `Craftoon` scheme for the app. The `CraftoonPurchases` scheme includes local StoreKit testing; its configuration is not a real purchase or production entitlement.

```sh
npm test -- --runInBand --watchman=false
npx tsc --noEmit
xcodebuild -workspace ios/Craftoon.xcworkspace -scheme CraftoonPurchases \
  -configuration Debug -destination 'platform=iOS Simulator,name=Craftoon Recovery QA' \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test
```

The latest complete JavaScript run passed 340 tests. Targeted native panel/ink, Mail-presentation and Library-order suites also passed; see [performance and verification](docs/PERFORMANCE.md) for the scope of those checks. Do not run two Xcode builds concurrently when they share this Mac's configured product directory.

## Documents and release state

- [Feature review](docs/FEATURE_REVIEW.md)
- [Storage, rendering and performance](docs/PERFORMANCE.md)
- [Pro configuration](docs/PRO_SETUP.md)
- [Promotion/offer codes](docs/PROMOTION_CODES.md)
- [Quick Guide source and PDF workflow](docs/manual/README.md)
- [App Store copy](docs/app-store/README.md) and [submission status](docs/app-store/SUBMISSION_STATUS.md)

Release builds of `7312da23` were installed and launched on both the iPad 7th generation and the device named iPad 10 (iPad A16). This is development installation, not an App Store release. Paid Developer Program enrollment and App Store submission are not confirmed complete.

## Saving, history and backups

Git history preserves committed source/document versions; it does **not** back up comics drawn inside an iPad. The pre-refresh documentation is identified by tag `backup/docs-before-refresh-20261120` at `7312da23`, whose `main` commit was verified on GitHub before this refresh. Use `git show <commit>:<path>` or GitHub history to read an older file; restore only specific files when needed rather than resetting unrelated work.

The user instruction “저장하자” means save current changes, build, update connected iPads and commit. Keep build products, caches and temporary diagnostics out of those commits. A local commit and a remote push are separate operations; verify the remote branch before reporting an upload complete.

Device document backups require the manifests, native ink and reference-image files together; see [PERFORMANCE.md](docs/PERFORMANCE.md). Automatic draft recovery and PDF email are not equivalent to a complete editable-document backup.
