# Craftoon Pro

The app is Free by default. Pro is a **one-time, non-consumable** Apple In-App Purchase.

- Developer credit: **Squareplayer** (`CraftoonDeveloperName` in `ios/Craftoon/Info.plist`).
- Product ID: **`com.craftoon.pro.unlock`** (`CraftoonProProductID` in the same plist).
- Intended base price: **CAD 4.99**.
- The app shows the localized price returned by StoreKit; it never hardcodes the production price or grants Pro from a local preference.

## Free and Pro

Free allows drawing, layouts, reading, and up to **4 pages per current comic**. Named Library saving, PDF/email/print export, and adding further pages require Pro. Both versions keep native automatic draft recovery. Existing saved comics and recovery drafts are not deleted or truncated when access is Free or a purchase is revoked.

All page creation routes share the same limit, including the side `+`, the page menu, and layout templates that create another page. Native Library saving and export also verify the entitlement. Viewing or editing older saved comics remains available.

The first button in Canvas, Library and Read identifies the current mode and opens the same app-information/purchase panel. A matching welcome button on the splash screen allows immediate purchase. Cancelling a purchase leaves the drawing intact. Pending approval leaves the app Free until a verified transaction arrives. Restore purchases is available in the same panel.

## App Store Connect setup still required for real sales

1. Use the final app bundle identifier and create its app record in App Store Connect. The app now uses the final identifier `com.squareplayer.craftoon` and targets iPad only. Register this identifier after enrolling in the Apple Developer Program.
2. Create a **Non-Consumable** In-App Purchase with product ID **`com.craftoon.pro.unlock`** and name **Craftoon Pro**.
3. Set Canada as the base region and **CAD 4.99** as the price. Add localized descriptions and the required review information.
4. Complete the paid-app agreement, tax and banking setup, and submit the purchase with the app as required by App Store Connect.
5. Test using Sandbox/TestFlight before release.

Without a registered/available product, the app stays Free and shows that purchases are unavailable; it does not simulate a successful real purchase. Prices in other storefronts are provided by Apple.

Official references: [configure In-App Purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/), [StoreKit testing](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode).

## Local testing (no real charges)

`ios/CraftoonPro.storekit` contains the CAD 4.99 test product. It is a resource of **CraftoonPurchaseTests only**, not the shipping app. The `CraftoonPurchases` scheme runs native StoreKit tests using `SKTestSession`. No Apple payment account or real charge is involved.

```sh
xcodebuild -workspace ios/Craftoon.xcworkspace -scheme CraftoonPurchases \
  -configuration Debug -destination 'platform=iOS Simulator,name=Craftoon Recovery QA' \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test
npm test -- --runInBand --watchman=false
```

Native tests cover verified purchase, restore, Ask to Buy approval, refund/revocation, rejection of Free Library saving, and preservation of Free draft recovery. JavaScript tests cover feature gates, cancellation/pending UI, transaction updates, duplicate purchase taps, and preservation of legacy comics.

For an interactive local preview, run the `CraftoonPurchases` scheme in Xcode with `CraftoonPro.storekit` selected under Run > Options > StoreKit Configuration. The regular `Craftoon` scheme is not configured to simulate purchases.
