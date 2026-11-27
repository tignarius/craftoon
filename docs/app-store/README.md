# App Store English copy

For the current release and verified purchase state, see [SUBMISSION_STATUS.md](SUBMISSION_STATUS.md). The November 20 checkpoint below is historical and predates the owner’s App Store Connect setup and Sandbox verification.

Reviewed 2026-11-20 against development checkpoint `7312da23`: automatic layout, artwork lock, live reshape preview, Library drag order, email presentation and the latest shared Quick Guide. English text under `en-US/` is a draft for App Store Connect, not a live listing. No app record, upload, review submission or publication has been performed in this work.

`whats-new.txt` is for an update to an existing release; omit it for an initial App Store version. Free includes up to four pages. Free allows one saved comic. Pro is a non-consumable purchase for unlimited saved comics and pages, PDF email, and printing. No price is hardcoded.

Field counts are validated without the trailing file newline. Name/subtitle <=30 characters, promotional text <=170, description <=4,000, keywords <=100 UTF-8 bytes.

Apple references:
- https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/
- https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/

Support URL, privacy-policy URL, copyright, screenshots, final version/build, and purchase availability must be completed in the release record using the actual release settings. These files do not invent those values.

## Current verification and handoff

Free is four pages per comic and one saved comic, including resaving it. Both current iPad development installs include the latest guide. The complete JavaScript run passed 340 tests; the targeted native suites and device confirmations are recorded in [SUBMISSION_STATUS.md](SUBMISSION_STATUS.md). Native Mail opening is confirmed, but actual delivery, printing, real sandbox purchasing/redemption and final store metadata still need release verification.

The editable English description/review notes mention Auto arrange, artwork lock and long-press Library ordering. The accepted Quick Guide layout has not been expanded to illustrate Library drag order. Keep those two scopes distinct when preparing screenshots.

Previous document versions remain in Git history. Tag `backup/docs-before-refresh-20261120` identifies the pre-refresh files at `7312da23`. This is source/document history, not a backup of drawings stored inside a user's iPad.
