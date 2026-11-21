# Craftoon App Store preparation

Reviewed 2026-11-20 against development application checkpoint `7312da23`.

## Current state

The latest owner-provided account status is that paid Apple Developer Program enrollment has not been completed; no subsequent enrollment confirmation has been supplied. No App Store Connect app record, distribution upload, review submission or public release has been performed in this work.

The project uses bundle identifier `com.squareplayer.craftoon`, app version **1.0**, build **1**, minimum deployment target **15.1** and iPad-only device family. These are source settings, not proof of App Store acceptance or testing on every supported OS version.

The latest Release build succeeded and was installed and launched on both the **iPad 7th generation** and the device named **iPad 10 (iPad A16)** without deleting their app data. Both installs include the latest one-page English Quick Guide. The owner confirmed that reshaped artwork remains visible and that the native Mail composition window opens on the older iPad. That confirmation does not establish actual email delivery or every interaction on both devices.

The complete JavaScript suite passed **340 tests**; TypeScript passed. Separate targeted native runs passed **44 panel/ink tests**, **2 Mail-presentation tests** and **2 Library-order tests**. No full native/StoreKit rerun or latest-session physical-device performance benchmark is claimed.

The English listing drafts now describe reshaping, four borders, focused zoom, per-panel references, Auto arrange, artwork lock and long-press Library order. Free includes four pages per comic and one saved comic; Pro unlocks unlimited pages/comics, PDF email and print. The final accepted guide shows the page menu's real triangles/minus/plus, with one counter, a short purple connector and an adjacent insertion/deletion caption. The Library drag feature has not been added to its existing cover illustration.

Application checkpoint `7312da23` was verified on GitHub `origin/main`. This documentation refresh is a later local change until its own commit/push is verified. Pre-refresh files remain available through Git history and tag `backup/docs-before-refresh-20261120`.

## Remaining release work

1. Complete Developer Program enrollment and confirm the intended individual/organization seller identity. Verify current requirements and local membership pricing in Apple's enrollment flow.
2. Select the enrolled signing team, register/verify `com.squareplayer.craftoon` and create the App Store Connect app record. Check existing uploads before assigning the release build number.
3. Configure non-consumable `com.craftoon.pro.unlock`, availability and localized price, and complete the required agreements, banking and tax settings. CAD 4.99 is the intended/test price, not a confirmed live price.
4. Verify sandbox purchase, restoration, cancellation, revocation and offer-code redemption. No production activation codes have been issued in this work.
5. Complete real support/privacy URLs, copyright, review contact, age rating, category, availability and App Privacy declarations. The manifest's declarations do not replace reviewing the shipping build's actual behavior.
6. Produce and inspect current real-app App Store screenshots. Historical capture-session metadata is not a current approved release screenshot set; confirm Apple's current display requirements at submission time.
7. Archive with distribution signing, validate/upload, attach the first Pro purchase as required and submit for review. No public release or automatic release setting has been authorized here.

## Remaining hands-on checks

- On both physical iPads, verify long-press reorder, edge scrolling and persistence after reopening Library, including deletion/Undo after a reorder.
- Recheck direction-picker rotation, page orientation lock, empty-template save prompts, artwork lock and reshape, focused zoom and tracing-image controls.
- Verify Mail cancellation and repeated opening, actual PDF attachment/delivery, printing to an available AirPrint printer, and opening/rotating/pinching the bundled guide.
- Exercise Free's four-page/one-comic limits and the paid access transitions without deleting existing work.

These are release checks still requiring confirmation; earlier partial device confirmations must not be presented as completion of the whole checklist.

## Official references

- [Developer Program enrollment](https://developer.apple.com/programs/enroll/)
- [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)
- [Submit an In-App Purchase](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Create In-App Purchase offer codes](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases/)
