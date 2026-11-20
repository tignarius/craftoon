# Craftoon App Store preparation

Updated: 2026-11-20. Includes the automatic layout, artwork lock, and live reshape preview checkpoint.

## Current state

The owner has not enrolled in the paid Apple Developer Program. No App Store Connect app record, upload, review submission, or public release has been performed in this session.

The latest Release build succeeded for the iPad 7th generation and was installed and launched without deleting app data. The owner confirmed the drawing remains visible while reshaping. Native panel and ink regression tests passed (44 tests).

The English description includes panel reshaping, four border styles, focused panel zoom, per-panel tracing, four free pages, and one free saved comic. All listing text fields are within Apple's character limits. Review notes are prepared in `en-US/review-notes.txt`.

## Enrollment and release sequence

1. Enroll in Apple Developer Program using an Apple Account with two-factor authentication. Annual fee: USD 99 or local pricing. Individual enrollment displays the legal personal name as seller; organization enrollment requires an eligible legal entity and normally a D-U-N-S Number. A brand name alone does not qualify as an organization.
2. After enrollment is active, select the enrolled Xcode team, verify/register bundle ID `com.squareplayer.craftoon`, and create the iPad app record in App Store Connect. Current project version/build: 1.0 (1); check for existing uploaded builds before assigning the release build number.
3. Configure the non-consumable `com.craftoon.pro.unlock`, its price and availability, and the applicable paid-app agreements, banking and tax details. Test real sandbox purchase, restoration, and cancellation with the enrolled account.
4. Complete support and privacy-policy URLs, copyright, review contact, category, age rating, availability, and App Privacy responses using the owner's actual details. The app privacy manifest declares no collected data or tracking; verify the App Store declaration against the final shipping build.
5. Capture and inspect current real-app screenshots for the required 13-inch iPad display. The old capture-session file uses an obsolete bundle ID and is not a current release asset. No current screenshots are ready for upload in `release/app-store/screenshots`.
6. Rebuild/archive with the enrolled distribution team, validate and upload, attach the processed build and the first Pro In-App Purchase to the same submission, and submit for review. Use manual release if release timing has not been decided.

## Pending device verification

On the iPad 7th generation: open the direction chooser and rotate; verify it folds away and reopens at the new anchor. On a blank page following a drawn page, apply a template and verify no save prompt appears and earlier artwork is preserved. Confirm drawing, saving, and the bundled Quick Guide still open.

## Official references

- https://developer.apple.com/programs/enroll/
- https://developer.apple.com/help/account/membership/program-enrollment/
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
