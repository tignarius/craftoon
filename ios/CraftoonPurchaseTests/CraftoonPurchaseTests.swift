import XCTest
import StoreKitTest
import StoreKit
@testable import Craftoon

final class CraftoonPurchaseTests: XCTestCase {
  private var session: SKTestSession!

  override func setUp() async throws {
    let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "CraftoonPro", withExtension: "storekit"))
    session = try SKTestSession(contentsOf: url)
    session.resetToDefaultState()
    session.disableDialogs = true
    session.askToBuyEnabled = false
    session.storefront = "CAN"
    session.locale = Locale(identifier: "en_CA")
    session.clearTransactions()
    // StoreKit's process applies resets asynchronously, even though these
    // testing setters are synchronous.
    try await Task.sleep(nanoseconds: 300_000_000)
  }

  override func tearDownWithError() throws {
    session.clearTransactions()
    session = nil
  }

  // Fail before presenting a purchase sheet if the simulator did not activate
  // StoreKit Testing. This never uses an Apple Account or a real payment.
  private func localStore() async throws -> CraftoonPurchaseStore {
    if #available(iOS 17.0, *) {
      let probe = try await session.buyProduct(identifier: "com.craftoon.pro.unlock")
      XCTAssertEqual(probe.environment, .xcode)
      await probe.finish()
      session.clearTransactions()
    }
    let store = CraftoonPurchaseStore()
    for _ in 0..<30 {
      try await Task.sleep(nanoseconds: 100_000_000)
      if await !store.hasProAccess(), session.allTransactions().isEmpty { return store }
    }
    throw NSError(domain: "CraftoonPurchaseTests", code: 1,
      userInfo: [NSLocalizedDescriptionKey: "Local StoreKit transactions did not reset"])
  }

  func testVerifiedPurchaseUnlocksPro() async throws {
    let store = try await localStore()
    let before = await store.status()
    XCTAssertEqual(before["isPro"] as? Bool, false)
    XCTAssertEqual(before["canPurchase"] as? Bool, true)
    XCTAssertFalse((before["displayPrice"] as? String ?? "").isEmpty)
    let result = try await store.purchase()
    XCTAssertEqual(result["outcome"] as? String, "purchased")
    XCTAssertEqual(result["isPro"] as? Bool, true)
    let enabled = await store.hasProAccess()
    XCTAssertTrue(enabled)
  }

  func testRestoreFindsPurchaseWithoutBuyingAgain() async throws {
    let store = try await localStore()
    let purchase = try await store.purchase()
    XCTAssertEqual(purchase["outcome"] as? String, "purchased")
    let reopened = CraftoonPurchaseStore()
    let result = try await reopened.restore()
    XCTAssertEqual(result["outcome"] as? String, "restored")
    XCTAssertEqual(result["isPro"] as? Bool, true)
    XCTAssertEqual(session.allTransactions().count, 1)
  }

  func testPendingApprovalDoesNotUnlockUntilApproved() async throws {
    let store = try await localStore()
    session.askToBuyEnabled = true
    let result = try await store.purchase()
    XCTAssertEqual(result["outcome"] as? String, "pending")
    XCTAssertEqual(result["isPro"] as? Bool, false)
    let transaction = try XCTUnwrap(session.allTransactions().first)
    try session.approveAskToBuyTransaction(identifier: transaction.identifier)
    for _ in 0..<30 {
      if await store.hasProAccess() { return }
      try await Task.sleep(nanoseconds: 100_000_000)
    }
    XCTFail("Approved purchase did not become an entitlement")
  }

  func testRefundRemovesProAccess() async throws {
    let store = try await localStore()
    let purchase = try await store.purchase()
    XCTAssertEqual(purchase["outcome"] as? String, "purchased")
    let transaction = try XCTUnwrap(session.allTransactions().first)
    try session.refundTransaction(identifier: transaction.identifier)
    for _ in 0..<30 {
      if await !store.hasProAccess() { return }
      try await Task.sleep(nanoseconds: 100_000_000)
    }
    XCTFail("Refunded purchase remained entitled")
  }

  func testNativeLibrarySavingRejectsFreeAccess() async {
    let rejected = expectation(description: "Pro required")
    let library = CraftoonLibrary()
    library.saveStory(["id": "free-test", "title": "Free", "pages": [["id": "p", "panels": [], "bubbles": []]]] as NSDictionary,
      resolver: { _ in XCTFail("Free library saving should be rejected"); rejected.fulfill() },
      rejecter: { code, _, _ in XCTAssertEqual(code, "PRO_REQUIRED"); rejected.fulfill() })
    await fulfillment(of: [rejected], timeout: 5)
  }

  func testFreeDraftRecoveryRemainsAvailable() async {
    let saved = expectation(description: "Draft saved")
    let library = CraftoonLibrary()
    library.saveDraft(["id": "free-recovery", "title": "Draft", "isSaved": false, "pageIndex": 0,
      "pages": [["id": "p", "panels": [], "bubbles": []]]] as NSDictionary,
      resolver: { _ in saved.fulfill() }, rejecter: { _, message, _ in XCTFail(message ?? "Draft failed"); saved.fulfill() })
    await fulfillment(of: [saved], timeout: 5)
    let loaded = expectation(description: "Draft loaded")
    library.loadDraft({ value in
      XCTAssertEqual((value as? [String: Any])?["id"] as? String, "free-recovery")
      loaded.fulfill()
    }, rejecter: { _, message, _ in XCTFail(message ?? "Draft load failed"); loaded.fulfill() })
    await fulfillment(of: [loaded], timeout: 5)
  }
}
