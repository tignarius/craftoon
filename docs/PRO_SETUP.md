# Craftoon Pro

Reviewed 2026-11-20 against application checkpoint `7312da23`. App Store Connect enrollment and real sales remain pending.

The app is Free by default. Pro is a **one-time, non-consumable** Apple In-App Purchase.

- Developer credit: **Squareplayer** (`CraftoonDeveloperName` in `ios/Craftoon/Info.plist`).
- Product ID: **`com.craftoon.pro.unlock`** (`CraftoonProProductID` in the same plist).
- Intended base price: **CAD 4.99**.
- The app shows the localized price returned by StoreKit; it never hardcodes the production price or grants Pro from a local preference.

## Free and Pro

Free allows drawing, layouts, tracing, reading, up to **4 pages per comic**, and **1 named saved comic** in Library. That comic can be edited and saved again. Pro is required for a second saved comic, more than four pages, PDF email and printing. The offline Quick Guide, Library selection/reordering and opening existing saved comics remain available in Free. Both versions keep native automatic draft recovery. Existing saved comics and recovery drafts are not deleted or truncated when access is Free or a purchase is revoked.

All page creation routes share the same limit, including the side `+`, the page menu, and layout templates that create another page. Native Library saving enforces the one-comic Free limit and permits resaving an existing comic; PDF email and printing verify Pro entitlement. Viewing or editing older saved comics remains available.

The first button in Canvas, Library and Read identifies the current mode and opens the same app-information/purchase panel. A matching welcome button on the splash screen allows immediate purchase. Cancelling a purchase leaves the drawing intact. Pending approval leaves the app Free until a verified transaction arrives. Restore purchases is available in the same panel.

## App Store Connect setup still required for real sales

1. Use the final app bundle identifier and create its app record in App Store Connect. The app now uses the final identifier `com.squareplayer.craftoon` and targets iPad only. Register this identifier after enrolling in the Apple Developer Program.
2. Create a **Non-Consumable** In-App Purchase with product ID **`com.craftoon.pro.unlock`** and name **Craftoon Pro**.
3. Set Canada as the base region and **CAD 4.99** as the price. Add localized descriptions and the required review information.
4. Complete the paid-app agreement, tax and banking setup, and submit the purchase with the app as required by App Store Connect.
5. Test using Sandbox/TestFlight before release.

Without an available product, a new purchase cannot proceed. Access still follows verified entitlements, so a catalog/network failure does not itself revoke an existing Pro purchase. The app does not simulate a successful real purchase; localized storefront prices come from StoreKit.

Official references: [configure In-App Purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/), [StoreKit testing](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode).

## Local testing (no real charges)

`ios/CraftoonPro.storekit` contains the CAD 4.99 test product. It is a resource of **CraftoonPurchaseTests only**, not the shipping app. The `CraftoonPurchases` scheme runs native StoreKit tests using `SKTestSession`. No Apple payment account or real charge is involved.

```sh
xcodebuild -workspace ios/Craftoon.xcworkspace -scheme CraftoonPurchases \
  -configuration Debug -destination 'platform=iOS Simulator,name=Craftoon Recovery QA' \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test
npm test -- --runInBand --watchman=false
```

Native tests cover verified purchase, restore, Ask to Buy approval, refund/revocation, enforcement of Free Library limits, and preservation of Free draft recovery. JavaScript tests cover feature gates, cancellation/pending UI, transaction updates, duplicate purchase taps, and preservation of legacy comics.

For an interactive local preview, run the `CraftoonPurchases` scheme in Xcode with `CraftoonPro.storekit` selected under Run > Options > StoreKit Configuration. The regular `Craftoon` scheme is not configured to simulate purchases.

## Access and delivery checks

Source limits are `FREE_PAGE_LIMIT = 4` and `FREE_FILE_LIMIT = 1` in `src/access/accessPolicy.ts`. Native save/export checks are in `CraftoonLibrary`; JavaScript UI gates alone do not grant entitlement. A restored/revoked entitlement never deletes existing documents.

The mail composer opened successfully on the older physical iPad after the presentation timing fix. This is not proof of message delivery, sandbox payment approval, a production StoreKit product or code redemption. If Mail is not configured, the app offers setup or PDF sharing. The system Mail composer manages its own draft-save/delete menu.

No working production offer codes are stored in the repository. Activation uses Apple's redemption flow; see [PROMOTION_CODES.md](PROMOTION_CODES.md). The intended CAD 4.99 price is a project decision and local test value, not a verified live App Store price.
