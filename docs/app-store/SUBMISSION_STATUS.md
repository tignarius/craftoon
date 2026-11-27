# Craftoon App Store preparation

Updated 2026-11-27 (America/Vancouver).

## Current release identity

- Bundle identifier: `com.squareplayer.craftoon` (unchanged).
- App version: **1.0** (unchanged); iOS build number: **2**.
- Minimum deployment target: 15.1; iPad-only device family.
- Non-consumable Pro product: `com.craftoon.pro.unlock`, App Store Connect ID `6839401070`.
- Build 1 was previously uploaded by the owner for TestFlight. That archive remains unchanged.

## Purchase verification

The owner confirmed on the iPad 7th generation that the real Apple sandbox displayed CAD 4.99, completed a one-time purchase, unlocked Pro, retained Pro after relaunch, and restored without error. These are physical-device owner confirmations, not production purchase tests.

Before availability recovered, the device reported payments allowed but no product returned by StoreKit. The product ID, price, localization, signing team, explicit App ID and enabled In-App Purchase capability were checked. Paid Apps Agreement, banking and tax forms were Active. Availability recovered after account/configuration work and a later retry; the exact server-side cause or timing cannot be established from the recorded evidence.

The app now distinguishes a missing product, a StoreKit lookup error and device payment restrictions. Retry reissues an unsuccessful product lookup. The latest lookup result is stored only in the app's local Caches directory for diagnostics; no receipts/account identifiers are intentionally recorded or transmitted. No local entitlement override was added: verified StoreKit transactions remain the authority for Pro access.

Not newly confirmed in this physical-device session: cancellation, refund/revocation and offer-code redemption. Prior native tests are historical evidence, not a claim of a new full native run.

## Store materials and settings

- Support: https://tignarius.github.io/craftoon/
- Privacy: https://tignarius.github.io/craftoon/privacy.html
- Final 9 marketing screenshots: `screencapture/app-store/ipad-13-en-CA-v3/`.
- Purchase review screenshot: `screencapture/app-store/iap-review/craftoon-pro-review-ipad-1536x2048.jpg` (1536 × 2048, 72 dpi, opaque JPEG). Original `IMG_0598.PNG` is unchanged.
- App download is intended to be free; Pro is a one-time CAD 4.99 purchase.
- Owner confirmed the pricing/availability checks after being advised to exclude China mainland, disable untested Mac/Vision Pro availability, and keep Public distribution. Not every final toggle was independently re-read.
- App Privacy and policy link were completed by the owner. DSA was last observed In Review; Part XX was Active.
- Promotional IAP image and offer codes are optional and not configured in this work.

## Build 2 preparation checks

- Complete JavaScript suite: **19 suites / 366 tests passed**.
- TypeScript `tsc --noEmit`: passed.
- Source Info.plist and Xcode project plist validation: passed.
- Hermes copy script shell syntax: passed.
- `git diff --check`: passed before the release version update; repeat before commit.
- App source sets `ITSAppUsesNonExemptEncryption` to false.

Build 2 Archive, actual archived app/Hermes UUID matching, Hermes DWARF and app signature validation, and App Store Connect upload succeeded. Xcode Organizer shows 1.0 (2) Uploaded to Apple. App Store Connect processing was still in progress at the first check. See [BUILD_2_VALIDATION.md](BUILD_2_VALIDATION.md) for exact evidence. Processing and review approval are separate from upload success.

## Authorization and remaining handoff

On 2026-11-27 the owner authorized commit/push, Build 2, final validation, Archive/upload and attaching Craftoon Pro to the app version. Final App Review submission and public release are not authorized by this handoff.

After upload processing, select **1.0 (2)** on the app version, attach the first Craftoon Pro purchase, verify its review screenshot/notes are saved, and inspect remaining validation messages. Do not click the final submission action without owner approval.

Historical preparation checkpoints and detailed older device/native checks remain available in Git history. Device artwork backups remain local under ignored `release/device-backups/`; they must not be committed or uploaded.
