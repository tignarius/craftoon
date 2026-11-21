import XCTest
import StoreKitTest
import StoreKit
import UIKit
import PencilKit
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

  func testNativeFreeLibrarySlotAndPageLimits() async {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let library = CraftoonLibrary(storageRoot: root)
    func save(_ id: String, pages: Int = 1) async -> String? {
      await withCheckedContinuation { continuation in
        let document: [String: Any] = ["id": id, "title": id,
          "pages": (0..<pages).map { ["id": "page-\($0)", "panels": [], "bubbles": []] as [String: Any] }]
        library.saveStory(document as NSDictionary,
          resolver: { _ in continuation.resume(returning: nil) },
          rejecter: { code, _, _ in continuation.resume(returning: code) })
      }
    }
    let first = await save("first", pages: 4)
    XCTAssertNil(first)
    let overwrite = await save("first", pages: 4)
    XCTAssertNil(overwrite)
    let fifthPage = await save("first", pages: 5)
    XCTAssertEqual(fifthPage, "PRO_REQUIRED")
    let second = await save("second")
    XCTAssertEqual(second, "PRO_REQUIRED")
    let token: String? = await withCheckedContinuation { continuation in
      library.deleteStory("first", resolver: { receipt in
        continuation.resume(returning: (receipt as? [String: Any])?["token"] as? String)
      }, rejecter: { _, message, _ in XCTFail(message ?? "Delete failed"); continuation.resume(returning: nil) })
    }
    let reusedSlot = await save("second")
    XCTAssertNil(reusedSlot)
    if let token {
      let restored: String? = await withCheckedContinuation { continuation in
        library.restoreStory(token, resolver: { _ in continuation.resume(returning: nil) },
          rejecter: { code, _, _ in continuation.resume(returning: code) })
      }
      XCTAssertEqual(restored, "PRO_REQUIRED")
    } else { XCTFail("Missing deletion token") }
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

final class CraftoonImageImportTests: XCTestCase {
  private func screenshotPNG() throws -> Data {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return try XCTUnwrap(UIGraphicsImageRenderer(size: CGSize(width: 2732, height: 2048), format: format).image { context in
      UIColor.white.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 2732, height: 2048))
      UIColor.systemBlue.setFill()
      context.fill(CGRect(x: 100, y: 100, width: 300, height: 200))
    }.pngData())
  }

  func testPhotosScreenshotUsesDecodedImageWithoutExportingARepresentation() throws {
    let image = try XCTUnwrap(UIImage(data: screenshotPNG()))
    // Photos can supply an unusable export URL alongside a valid UIImage.
    let result = try CraftoonReferenceImageLoader.readPickedImage([
      .originalImage: image, .imageURL: URL(fileURLWithPath: "/unavailable/screenshot.png"),
    ])
    XCTAssertEqual(result["width"] as? Int, 2048)
    let height = try XCTUnwrap(result["height"] as? Int)
    XCTAssertEqual(Double(height) / 2048, 2048.0 / 2732, accuracy: 0.001)
    let uri = try XCTUnwrap(result["uri"] as? String)
    XCTAssertTrue(uri.hasPrefix("file:"))
    XCTAssertNotNil(result["imageRef"] as? String)
    let data = try Data(contentsOf: XCTUnwrap(URL(string: uri)))
    XCTAssertNotNil(UIImage(data: data))
  }

  func testScreenshotFileWithoutExtensionIsDecodedByItsContents() throws {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder) }
    let url = folder.appendingPathComponent("Screenshot")
    try screenshotPNG().write(to: url)
    let result = try CraftoonReferenceImageLoader.readImage(url)
    XCTAssertEqual(result["width"] as? Int, 2048)
    XCTAssertGreaterThan(result["height"] as? Int ?? 0, 0)
  }

  func testJPEGFromPhotosAndFilesDecodesToRenderableImage() throws {
    let jpeg = try XCTUnwrap(UIImage(data: screenshotPNG())?.jpegData(compressionQuality: 0.9))
    let photo = try CraftoonReferenceImageLoader.readPickedImage([
      .originalImage: try XCTUnwrap(UIImage(data: jpeg)),
    ])
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpeg")
    defer { try? FileManager.default.removeItem(at: url) }
    try jpeg.write(to: url)
    let file = try CraftoonReferenceImageLoader.readPickedImage([.imageURL: url])
    let assetData = try CraftoonReferenceImageLoader.readData(jpeg)
    for result in [photo, file, assetData] {
      XCTAssertEqual(result["width"] as? Int, 2048)
      let uri = try XCTUnwrap(result["uri"] as? String)
      XCTAssertTrue(uri.hasPrefix("file:"))
      let data = try Data(contentsOf: XCTUnwrap(URL(string: uri)))
      XCTAssertNotNil(UIImage(data: data))
    }
  }

  func testEmptyPhotoSelectionFailsWithoutInventingAnUnsupportedFormat() {
    XCTAssertThrowsError(try CraftoonReferenceImageLoader.readPickedImage([:])) { error in
      XCTAssertEqual(error.localizedDescription, "This photo could not be loaded. Please try selecting it again.")
    }
  }

  func testUIImageFallbackNormalizesOrientationAndSize() throws {
    let original = try XCTUnwrap(UIImage(data: screenshotPNG()))
    let rotated = UIImage(cgImage: try XCTUnwrap(original.cgImage), scale: 1, orientation: .right)
    let result = try CraftoonReferenceImageLoader.normalize(rotated)
    XCTAssertEqual(result["height"] as? Int, 2048)
    XCTAssertEqual(result["width"] as? Int, 1535)
  }
}

@MainActor
final class CraftoonInkPerformanceTests: XCTestCase {
  private var oldReferences: [String: String] = [:]
  private var oldDrawings: [String: PKDrawing] = [:]
  private var oldIDs: Set<String>?

  override func setUp() async throws {
    oldReferences = CraftoonInkStore.latestReferences
    oldDrawings = RNPencilKitView.drawingCache
    oldIDs = CraftoonInkStore.documentPanelIDs
    CraftoonInkStore.latestReferences = [:]
    RNPencilKitView.drawingCache = [:]
    CraftoonInkStore.documentPanelIDs = nil
  }

  override func tearDown() async throws {
    CraftoonInkStore.latestReferences = oldReferences
    RNPencilKitView.drawingCache = oldDrawings
    CraftoonInkStore.documentPanelIDs = oldIDs
  }

  private func ink(_ count: Int) -> PKDrawing {
    let strokes = (0..<count).map { index in
      let points = (0..<12).map { point in
        PKStrokePoint(location: CGPoint(x: Double(point * 4 + index % 200), y: Double(index % 200)),
          timeOffset: Double(point) / 60, size: CGSize(width: 3, height: 3), opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
      }
      return PKStroke(ink: PKInk(.pen, color: .black), path: PKStrokePath(controlPoints: points, creationDate: Date(timeIntervalSince1970: 1)))
    }
    return PKDrawing(strokes: strokes)
  }

  private func reference(_ capture: CraftoonInkCapture) throws -> String {
    try XCTUnwrap((capture.pages.first?["panels"] as? [[String: Any]])?.first?["drawingData"] as? String)
  }

  func testCaptureDistinguishesEmptyArchivesFromActualStrokes() throws {
    let id = UUID().uuidString
    let pages: [[String: Any]] = [["panels": [["id": id]]]]
    RNPencilKitView.drawingCache[id] = PKDrawing()
    let blank = CraftoonInkStore.capture(pages)
    let blankPanel = try XCTUnwrap((blank.pages[0]["panels"] as? [[String: Any]])?.first)
    XCTAssertNotNil(blankPanel["drawingData"])
    XCTAssertEqual(blankPanel["drawingHasStrokes"] as? Bool, false)
    RNPencilKitView.drawingCache[id] = ink(1)
    let drawn = CraftoonInkStore.capture(blank.pages)
    XCTAssertEqual((drawn.pages[0]["panels"] as? [[String: Any]])?.first?["drawingHasStrokes"] as? Bool, true)
    RNPencilKitView.drawingCache[id] = PKDrawing()
    let erased = CraftoonInkStore.capture(drawn.pages)
    XCTAssertEqual((erased.pages[0]["panels"] as? [[String: Any]])?.first?["drawingHasStrokes"] as? Bool, false)
  }

  func testInactiveBlankTemplateArchivesDoNotCountAsArtwork() async throws {
    let blankID = UUID().uuidString
    let drawnID = UUID().uuidString
    let source: [[String: Any]] = [["panels": [["id": blankID], ["id": drawnID]]]]
    RNPencilKitView.drawingCache[blankID] = PKDrawing()
    RNPencilKitView.drawingCache[drawnID] = ink(1)
    let first = CraftoonInkStore.capture(source)
    let result = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[[String: Any]], Error>) in
      CraftoonInkStore.queue.async {
        do {
          try CraftoonInkStore.persist(first.drawings)
          continuation.resume(returning: CraftoonInkStore.resolvingStrokePresence(first.pages))
        } catch { continuation.resume(throwing: error) }
      }
    }
    RNPencilKitView.drawingCache = [:]
    // Reproduce preview retirement: React has no stroke metadata, only native references.
    let retired = CraftoonInkStore.capture(source)
    let resolved = await withCheckedContinuation { continuation in
      CraftoonInkStore.queue.async {
        continuation.resume(returning: CraftoonInkStore.resolvingStrokePresence(retired.pages))
      }
    }
    let panels = try XCTUnwrap(resolved[0]["panels"] as? [[String: Any]])
    XCTAssertEqual(panels[0]["drawingHasStrokes"] as? Bool, false)
    XCTAssertEqual(panels[1]["drawingHasStrokes"] as? Bool, true)
    XCTAssertEqual(result[0]["panels"] as? NSArray, resolved[0]["panels"] as? NSArray)

    // A new native revision must not inherit an old false value from JavaScript.
    var stale = result
    var stalePanels = try XCTUnwrap(stale[0]["panels"] as? [[String: Any]])
    stalePanels[1]["drawingData"] = "older-reference"
    stalePanels[1]["drawingHasStrokes"] = false
    stale[0]["panels"] = stalePanels
    let changed = CraftoonInkStore.capture(stale)
    XCTAssertNil((changed.pages[0]["panels"] as? [[String: Any]])?[1]["drawingHasStrokes"])
  }

  func testThousandsOfStrokesUseSmallImmutableReferencesAndArchiveOnlyChangedInk() async throws {
    let id = UUID().uuidString
    let pages: [[String: Any]] = [["id": "page", "panels": [["id": id]], "bubbles": []]]
    RNPencilKitView.drawingCache[id] = ink(3000)
    let first = CraftoonInkStore.capture(pages)
    let token = try reference(first)
    XCTAssertLessThan(token.count, 64)
    XCTAssertEqual(try reference(CraftoonInkStore.capture(pages)), token)
    // Capturing on main performs no archive serialization or file writes.
    XCTAssertThrowsError(try CraftoonInkStore.data(token))
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      CraftoonInkStore.queue.async {
        continuation.resume(with: Result { try CraftoonInkStore.persist(first.drawings) })
      }
    }
    XCTAssertEqual(CraftoonInkStore.drawing(token)?.strokes.count, 3000)
    RNPencilKitView.drawingCache[id] = ink(3001)
    CraftoonInkStore.latestReferences.removeValue(forKey: id)
    let second = CraftoonInkStore.capture(pages)
    XCTAssertNotEqual(try reference(second), token)
    XCTAssertEqual(CraftoonInkStore.drawing(token)?.strokes.count, 3000)
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      CraftoonInkStore.queue.async {
        continuation.resume(with: Result { try CraftoonInkStore.persist(second.drawings) })
      }
    }
    XCTAssertEqual(CraftoonInkStore.drawing(try reference(second))?.strokes.count, 3001)
  }

  func testLegacyBase64MigrationIsStableAndPreservesEditableStrokes() throws {
    let document: [String: Any] = ["pages": [["panels": [["id": "legacy", "drawingData": ink(12).dataRepresentation().base64EncodedString()]]]]]
    let first = try CraftoonInkStore.compact(document)
    let second = try CraftoonInkStore.compact(document)
    let pages = try XCTUnwrap(first["pages"] as? [[String: Any]])
    let other = try XCTUnwrap(second["pages"] as? [[String: Any]])
    let token = try reference(CraftoonInkCapture(pages: pages, drawings: []))
    XCTAssertEqual(token, try reference(CraftoonInkCapture(pages: other, drawings: [])))
    XCTAssertEqual(CraftoonInkStore.drawing(token)?.strokes.count, 12)
    XCTAssertThrowsError(try CraftoonInkStore.data("craftoon-ink:../../bad"))
  }

  func testBurstOfRecoveryRequestsWritesLatestStateWithoutQueuingEverySnapshot() async throws {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder) }
    let recovery = CraftoonDraftRecovery(storageURL: folder.appendingPathComponent("recovery.json"), observeLifecycle: false)
    let done = expectation(description: "all checkpoint callbacks complete")
    done.expectedFulfillmentCount = 100
    for revision in 0..<100 {
      recovery.update(["id": "test", "title": "Revision \(revision)", "pages": [["id": "page", "panels": [], "bubbles": []]]]) { result in
        if case .failure(let error) = result { XCTFail(error.localizedDescription) }
        done.fulfill()
      }
    }
    await fulfillment(of: [done], timeout: 10)
    XCTAssertLessThanOrEqual(recovery.completedWrites, 2)
    let loaded: [String: Any]? = try await withCheckedThrowingContinuation { continuation in
      recovery.load { continuation.resume(with: $0) }
    }
    XCTAssertEqual(loaded?["title"] as? String, "Revision 99")
  }

  func testMissingInkCannotOverwriteLastGoodRecoveryFile() async throws {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder) }
    let file = folder.appendingPathComponent("recovery.json")
    let recovery = CraftoonDraftRecovery(storageURL: file, observeLifecycle: false)
    let good: [String: Any] = ["id": "test", "pages": [["id": "page", "panels": [], "bubbles": []]]]
    let _: Void = try await withCheckedThrowingContinuation { continuation in recovery.update(good) { continuation.resume(with: $0) } }
    let original = try Data(contentsOf: file)
    var bad = good
    bad["pages"] = [["panels": [["id": "missing", "drawingData": CraftoonInkStore.prefix + UUID().uuidString]]]]
    let result: Result<Void, Error> = await withCheckedContinuation { continuation in
      recovery.update(bad) { continuation.resume(returning: $0) }
    }
    if case .success = result { XCTFail("Missing drawing should fail saving") }
    XCTAssertEqual(try Data(contentsOf: file), original)
  }

  func testInactivePanelReleasesCanvasAndRestoresLassoCapableEditableInk() async throws {
    let drawing = ink(30)
    let document = try CraftoonInkStore.compact(["pages": [["panels": [["id": "preview-test", "drawingData": drawing.dataRepresentation().base64EncodedString()]]]]])
    let pages = try XCTUnwrap(document["pages"] as? [[String: Any]])
    let token = try reference(CraftoonInkCapture(pages: pages, drawings: []))
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 500, height: 500))
    let controller = UIViewController()
    window.rootViewController = controller
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 300, height: 300))
    view.panelId = "preview-test"
    view.drawingData = token
    controller.view.addSubview(view)
    window.makeKeyAndVisible()
    defer { view.removeFromSuperview(); window.isHidden = true }
    view.isDrawingActive = true
    XCTAssertEqual(view.canvasView.drawing.strokes.count, 30)
    view.canvasView.tool = PKLassoTool()
    view.isDrawingActive = true
    XCTAssertTrue(view.canvasView.tool is PKLassoTool)
    view.isDrawingActive = false
    for _ in 0..<100 {
      if !view.subviews.contains(where: { $0 is PKCanvasView }) { break }
      try await Task.sleep(nanoseconds: 30_000_000)
    }
    XCTAssertFalse(view.subviews.contains(where: { $0 is PKCanvasView }))
    // The renderer is released before disk persistence completes; keep the
    // value available for an immediate switch back until its archive is durable.
    for _ in 0..<100 {
      if RNPencilKitView.drawingCache["preview-test"] == nil { break }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    XCTAssertNil(RNPencilKitView.drawingCache["preview-test"])
    view.isDrawingActive = true
    XCTAssertEqual(view.canvasView.drawing.strokes.count, 30)
  }
  func testCaptureReferenceEchoKeepsInactivePreviewAndDrawingCacheStable() async throws {
    let id = "capture-echo-" + UUID().uuidString
    let source = ink(3)
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
    let controller = UIViewController()
    window.rootViewController = controller
    window.makeKeyAndVisible()
    defer { window.isHidden = true }
    let view = RNPencilKitView(frame: CGRect(x: 20, y: 20, width: 200, height: 200))
    view.panelId = id
    view.drawingData = source.dataRepresentation().base64EncodedString()
    RNPencilKitView.drawingCache[id] = source
    controller.view.addSubview(view)
    view.setNeedsLayout(); view.layoutIfNeeded()
    let imageView = try XCTUnwrap(view.subviews.compactMap { $0 as? UIImageView }.first)
    for _ in 0..<150 {
      if imageView.image != nil, RNPencilKitView.drawingCache[id] == nil { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    let originalPreview = try XCTUnwrap(imageView.image)
    // Native capture publishes a new JS reference for these same cached strokes.
    RNPencilKitView.drawingCache[id] = source
    let captured = CraftoonInkStore.capture([["panels": [["id": id]]]])
    let panels = try XCTUnwrap(captured.pages.first?["panels"] as? [[String: Any]])
    let reference = try XCTUnwrap(panels.first?["drawingData"] as? String)
    XCTAssertNotEqual(reference, view.drawingData)
    view.drawingData = reference
    try await Task.sleep(nanoseconds: 350_000_000)
    XCTAssertTrue(imageView.image === originalPreview, "An unchanged capture must not replace the displayed bitmap")
    XCTAssertNotNil(RNPencilKitView.drawingCache[id], "The echo must not schedule another preview/eviction cycle")
  }

  func testPreviewRasterUsesDisplayedPixelsAndKeepsABoundedMemoryBudget() {
    let full = CGSize(width: 900, height: 1200), displayed = CGSize(width: 750, height: 1000)
    let scale = CraftoonInkPreviewRaster.scale(source: full, displayed: displayed, screenScale: 2, resizing: false)
    XCTAssertGreaterThan(full.width * scale, 1200)
    XCTAssertGreaterThanOrEqual(full.width * scale, displayed.width * 2)
    XCTAssertGreaterThanOrEqual(full.height * scale, displayed.height * 2)
    let huge = CGSize(width: 8000, height: 6000)
    let limited = CraftoonInkPreviewRaster.scale(source: huge, displayed: huge, screenScale: 3, resizing: true)
    XCTAssertLessThanOrEqual(max(huge.width, huge.height) * limited, CraftoonInkPreviewRaster.maximumEdge + 0.01)
    XCTAssertLessThanOrEqual(huge.width * huge.height * limited * limited, CraftoonInkPreviewRaster.maximumPixels + 0.01)
  }

  func testLargePanelPreviewRerendersFromVectorInkAtDisplayResolutionAfterResize() async throws {
    let id = "sharp-resize-" + UUID().uuidString
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 1400, height: 1000))
    let controller = UIViewController()
    window.rootViewController = controller
    window.makeKeyAndVisible()
    defer { window.isHidden = true }
    let view = RNPencilKitView(frame: CGRect(x: 20, y: 20, width: 900, height: 600))
    view.panelId = id
    RNPencilKitView.drawingCache[id] = ink(3)
    func frame(_ width: Double, _ height: Double, preview: Bool) -> NSDictionary {
      ["x": 20, "y": 20, "width": width, "height": height, "revision": 0, "preview": preview,
       "resizeInk": true, "warpInk": true] as NSDictionary
    }
    view.shapeFrame = frame(900, 600, preview: false)
    controller.view.addSubview(view)
    view.setNeedsLayout(); view.layoutIfNeeded()
    let imageView = try XCTUnwrap(view.subviews.compactMap { $0 as? UIImageView }.first)
    for _ in 0..<150 {
      if imageView.image != nil { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    let initial = try XCTUnwrap(imageView.image)
    XCTAssertGreaterThanOrEqual(CGFloat(try XCTUnwrap(initial.cgImage).width), 900 * window.screen.scale)
    view.frame.size = CGSize(width: 1200, height: 800)
    view.shapeFrame = frame(1200, 800, preview: true)
    view.layoutIfNeeded()
    for _ in 0..<150 {
      if let image = imageView.image, CGFloat(image.cgImage?.width ?? 0) >= 1200 * window.screen.scale { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    let during = try XCTUnwrap(imageView.image)
    XCTAssertEqual(during.size.width, 900, accuracy: 0.1, "Drag previews must keep the original drawing's coordinate frame")
    XCTAssertGreaterThanOrEqual(CGFloat(try XCTUnwrap(during.cgImage).width), 1200 * window.screen.scale)
    view.shapeFrame = frame(1200, 800, preview: false)
    view.layoutIfNeeded()
    for _ in 0..<150 {
      if let image = imageView.image, abs(image.size.width - 1200) < 0.1 { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    let final = try XCTUnwrap(imageView.image)
    XCTAssertEqual(final.size.width, 1200, accuracy: 0.1)
    XCTAssertEqual(final.size.height, 800, accuracy: 0.1)
    XCTAssertGreaterThanOrEqual(CGFloat(try XCTUnwrap(final.cgImage).width), 1200 * window.screen.scale)
  }

  func testReshapePreviewStaysVisibleUntilVectorRasterCatchesUp() async throws {
    let id = "visible-warp-" + UUID().uuidString
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 500, height: 500))
    let controller = UIViewController()
    window.rootViewController = controller
    window.makeKeyAndVisible()
    defer { window.isHidden = true }
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    let original = ink(3)
    RNPencilKitView.drawingCache[id] = original
    func frame(_ bottom: Double, preview: Bool) -> NSDictionary {
      ["x": 0, "width": 200, "height": 200, "revision": 0, "preview": preview, "warpInk": true,
       "corners": [["x": 0, "y": 0], ["x": 1, "y": 0], ["x": bottom, "y": 1], ["x": 0, "y": 1]]] as NSDictionary
    }
    view.shapeFrame = frame(1, preview: false)
    controller.view.addSubview(view)
    view.layoutIfNeeded()
    let bitmap = try XCTUnwrap(view.subviews.compactMap { $0 as? UIImageView }.first)
    for _ in 0..<150 {
      if bitmap.image != nil { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    let initial = try XCTUnwrap(bitmap.image)
    for bottom in [0.8, 0.5, 0.3] {
      view.shapeFrame = frame(bottom, preview: true); view.layoutIfNeeded()
      let mesh = try XCTUnwrap(view.subviews.first { $0.accessibilityIdentifier == "craftoon-ink-warp-preview" })
      XCTAssertFalse(mesh.isHidden)
      XCTAssertTrue(bitmap.isHidden)
      XCTAssertEqual(mesh.layer.sublayers?.count, CraftoonInkPreviewWarp.stripCount)
      XCTAssertTrue(mesh.layer.sublayers?.allSatisfy { $0.contents != nil } == true)
      XCTAssertTrue(bitmap.image === initial, "Dragging reuses the source raster without rerendering each frame")
      let current = RNPencilKitView.drawingCache[id] ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[id] ?? "")
      XCTAssertEqual(try XCTUnwrap(current).strokes[0].path[1].location, original.strokes[0].path[1].location)
    }
    view.shapeFrame = frame(0.3, preview: false); view.layoutIfNeeded()
    let mesh = try XCTUnwrap(view.subviews.first { $0.accessibilityIdentifier == "craftoon-ink-warp-preview" })
    XCTAssertFalse(mesh.isHidden, "Keep the warped preview while the final vector raster is pending")
    for _ in 0..<150 {
      if bitmap.image !== initial { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertFalse(bitmap.isHidden)
    XCTAssertTrue(mesh.isHidden)
    XCTAssertFalse(bitmap.image === initial)
  }

  func testPreviewMeshMapsTaperedStripsToCurrentInkGeometry() throws {
    let old = [CGPoint(x: 20, y: 0), CGPoint(x: 180, y: 0), CGPoint(x: 200, y: 200), CGPoint(x: 0, y: 200)]
    let next = [CGPoint(x: 70, y: 0), CGPoint(x: 120, y: 0), CGPoint(x: 160, y: 160), CGPoint(x: 10, y: 160)]
    let h: CGFloat = 200 / CGFloat(CraftoonInkPreviewWarp.stripCount)
    for index in 0..<CraftoonInkPreviewWarp.stripCount {
      let y = CGFloat(index) * h
      let t = try XCTUnwrap(CraftoonInkPreviewWarp.transform(from: old, to: next, y: y, height: h))
      for localY in [CGFloat(0), h / 2, h] {
        for x in [CGFloat(30), 100, 170] {
          let denominator = t.m14 * x + t.m24 * localY + t.m44
          let actual = CGPoint(x: (t.m11 * x + t.m21 * localY + t.m41) / denominator,
                               y: (t.m12 * x + t.m22 * localY + t.m42) / denominator)
          let expected = CraftoonInkShapeWarp.point(CGPoint(x: x, y: y + localY), from: old, to: next)
          XCTAssertEqual(actual.x, expected.x, accuracy: 0.02)
          XCTAssertEqual(actual.y, expected.y, accuracy: 0.02)
        }
      }
    }
  }

  func testLateCaptureEchoDoesNotReplaceNewlyReshapedInkWithAnOlderArchive() throws {
    let id = "late-shape-echo-" + UUID().uuidString
    let original = ink(3)
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    view.drawingData = original.dataRepresentation().base64EncodedString()
    RNPencilKitView.drawingCache[id] = original
    func frame(_ size: Double) -> NSDictionary {
      ["x": 0, "y": 0, "width": size, "height": size, "revision": 0,
       "preview": false, "resizeInk": true, "warpInk": true] as NSDictionary
    }
    view.shapeFrame = frame(200); view.layoutIfNeeded()
    let before = CraftoonInkStore.capture([["panels": [["id": id]]]])
    try CraftoonInkStore.persist(before.drawings)
    let sourcePanels = try XCTUnwrap(before.pages[0]["panels"] as? [[String: Any]])
    let oldReference = try XCTUnwrap(sourcePanels[0]["drawingData"] as? String)
    // Fabric can deliver new geometry before the drawingData capture echo.
    view.frame.size = CGSize(width: 400, height: 400)
    view.shapeFrame = frame(400); view.layoutIfNeeded()
    view.drawingData = oldReference
    let after = CraftoonInkStore.capture([["panels": [["id": id]]]])
    try CraftoonInkStore.persist(after.drawings)
    let resultPanels = try XCTUnwrap(after.pages[0]["panels"] as? [[String: Any]])
    let newReference = try XCTUnwrap(resultPanels[0]["drawingData"] as? String)
    XCTAssertNotEqual(newReference, oldReference, "Transformed ink must receive its own immutable archive")
    let restored = try XCTUnwrap(CraftoonInkStore.drawing(newReference)?.strokes.first)
    XCTAssertEqual(restored.path[1].location.applying(restored.transform).x, 8, accuracy: 0.001)
    let old = try XCTUnwrap(CraftoonInkStore.drawing(oldReference)?.strokes.first)
    XCTAssertEqual(old.path[1].location.applying(old.transform).x, 4, accuracy: 0.001)
  }

}

extension CraftoonInkPerformanceTests {
  func testUnmountBeforeReactSyncPreservesLatestStrokeNatively() async throws {
    let id = UUID().uuidString
    var view: RNPencilKitView? = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view!.panelId = id
    view!.canvasView.drawing = ink(17)
    view!.canvasViewDrawingDidChange(view!.canvasView)
    weak var weakView = view
    view = nil
    XCTAssertNil(weakView)
    let token = try XCTUnwrap(CraftoonInkStore.latestReferences[id])
    let _: Void = await withCheckedContinuation { continuation in CraftoonInkStore.queue.async { continuation.resume() } }
    XCTAssertEqual(CraftoonInkStore.drawing(token)?.strokes.count, 17)
    XCTAssertNil(RNPencilKitView.drawingCache[id])
  }

  func testUndoReinstallsInkEvenWhenReactDrawingPropHasNotChangedYet() throws {
    let document = try CraftoonInkStore.compact(["pages": [["panels": [["id": "restore-test", "drawingData": ink(3).dataRepresentation().base64EncodedString()]]]]])
    let pages = try XCTUnwrap(document["pages"] as? [[String: Any]])
    let token = try reference(CraftoonInkCapture(pages: pages, drawings: []))
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = "restore-test"
    view.drawingData = token
    view.canvasView.drawing = ink(4)
    view.canvasViewDrawingDidChange(view.canvasView)
    CraftoonInkStore.reset(pages)
    XCTAssertEqual(view.drawingData, token)
    XCTAssertEqual(view.canvasView.drawing.strokes.count, 3)
  }

  func testCapturingDuringPanelResizePreservesScaledInkBeforePreviewTimer() async throws {
    let drawing = ink(5)
    let document = try CraftoonInkStore.compact(["pages": [["panels": [["id": "resize-test", "drawingData": drawing.dataRepresentation().base64EncodedString()]]]]])
    let pages = try XCTUnwrap(document["pages"] as? [[String: Any]])
    let token = try reference(CraftoonInkCapture(pages: pages, drawings: []))
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
    let controller = UIViewController()
    window.rootViewController = controller
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
    view.panelId = "resize-test"
    view.drawingData = token
    controller.view.addSubview(view)
    window.makeKeyAndVisible()
    defer { view.removeFromSuperview(); window.isHidden = true }
    view.frame.size = CGSize(width: 200, height: 100)
    view.layoutIfNeeded()
    let capture = CraftoonInkStore.capture(pages)
    let updated = try reference(capture)
    XCTAssertNotEqual(updated, token)
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      CraftoonInkStore.queue.async { continuation.resume(with: Result { try CraftoonInkStore.persist(capture.drawings) }) }
    }
    let restored = try XCTUnwrap(CraftoonInkStore.drawing(updated))
    XCTAssertEqual(restored.strokes.count, 5)
    let originalStroke = try XCTUnwrap(drawing.strokes.last)
    let restoredStroke = try XCTUnwrap(restored.strokes.last)
    let originalPoint = try XCTUnwrap(originalStroke.path.last).location.applying(originalStroke.transform)
    let restoredPoint = try XCTUnwrap(restoredStroke.path.last).location.applying(restoredStroke.transform)
    XCTAssertEqual(restoredPoint.x, originalPoint.x * 2, accuracy: 0.01)
    XCTAssertEqual(restoredPoint.y, originalPoint.y, accuracy: 0.01)
  }
}

extension CraftoonInkPerformanceTests {
  func testLeavingWindowReleasesRendererBeforeViewDeallocation() async throws {
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
    let controller = UIViewController()
    window.rootViewController = controller
    let id = UUID().uuidString
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    controller.view.addSubview(view)
    window.makeKeyAndVisible()
    defer { window.isHidden = true }
    view.isDrawingActive = true
    view.canvasView.drawing = ink(9)
    view.canvasViewDrawingDidChange(view.canvasView)
    view.removeFromSuperview()
    for _ in 0..<100 {
      if !view.subviews.contains(where: { $0 is PKCanvasView }) { break }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    XCTAssertFalse(view.subviews.contains(where: { $0 is PKCanvasView }))
    let token = try XCTUnwrap(CraftoonInkStore.latestReferences[id])
    let _: Void = await withCheckedContinuation { continuation in CraftoonInkStore.queue.async { continuation.resume() } }
    XCTAssertEqual(CraftoonInkStore.drawing(token)?.strokes.count, 9)
    // Reattaching the same native view must restore its editable ink.
    controller.view.addSubview(view)
    XCTAssertEqual(view.canvasView.drawing.strokes.count, 9)
    view.removeFromSuperview()
  }
}

extension CraftoonInkPerformanceTests {
  func testCleanupPreservesSavedTrashHistoryAndRecentInkButRemovesAbandonedRevisions() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let folder = root.appendingPathComponent("CraftoonInk")
    let recovery = root.appendingPathComponent("CraftoonRecovery")
    let trash = root.appendingPathComponent("CraftoonLibrary/Trash")
    for directory in [folder, recovery, trash] { try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true) }
    defer { try? FileManager.default.removeItem(at: root) }
    let tokens = (0..<6).map { _ in CraftoonInkStore.prefix + UUID().uuidString }
    let files = tokens.map { folder.appendingPathComponent(String($0.dropFirst(CraftoonInkStore.prefix.count))).appendingPathExtension("drawing") }
    let bytes = ink(1).dataRepresentation()
    for (index, file) in files.enumerated() {
      try bytes.write(to: file)
      if index != 4 { try FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSinceNow: -3600)], ofItemAtPath: file.path) }
    }
    let manifest: (String) throws -> Data = { token in
      try JSONSerialization.data(withJSONObject: ["pages": [["panels": [["drawingData": token]]]]])
    }
    try manifest(tokens[0]).write(to: recovery.appendingPathComponent("current.json"))
    try manifest(tokens[1]).write(to: trash.appendingPathComponent("deleted.json"))
    CraftoonInkStore.retain([tokens[2]])
    // A recently read reference has a short lease even before React records it.
    // In this isolated fixture, tokens[4] is protected by its recent file date.
    CraftoonInkStore.collectOldRevisions(root: root)
    let _: Void = await withCheckedContinuation { continuation in CraftoonInkStore.queue.async { continuation.resume() } }
    for index in [0, 1, 2, 4] { XCTAssertTrue(FileManager.default.fileExists(atPath: files[index].path)) }
    for index in [3, 5] { XCTAssertFalse(FileManager.default.fileExists(atPath: files[index].path)) }
    // An unreadable manifest disables deletion rather than risking data loss.
    try bytes.write(to: files[5])
    try FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSinceNow: -3600)], ofItemAtPath: files[5].path)
    try Data("invalid json".utf8).write(to: recovery.appendingPathComponent("unreadable.json"))
    CraftoonInkStore.collectOldRevisions(root: root)
    let _: Void = await withCheckedContinuation { continuation in CraftoonInkStore.queue.async { continuation.resume() } }
    XCTAssertTrue(FileManager.default.fileExists(atPath: files[5].path))
  }
}


extension CraftoonInkPerformanceTests {
  func testSwitchingBetweenPanelsKeepsPreviewsUntilReplacementRenderAndIgnoresTransientDetaches() async throws {
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 700, height: 700))
    let controller = UIViewController()
    window.rootViewController = controller
    let ids = (0..<3).map { _ in UUID().uuidString }
    let document = try CraftoonInkStore.compact(["pages": [["panels": ids.map { id in
      ["id": id, "drawingData": ink(20).dataRepresentation().base64EncodedString()]
    }]]])
    let pages = try XCTUnwrap(document["pages"] as? [[String: Any]])
    let panels = try XCTUnwrap(pages.first?["panels"] as? [[String: Any]])
    let views = panels.enumerated().map { index, panel -> RNPencilKitView in
      let view = RNPencilKitView(frame: CGRect(x: 20, y: 20 + index * 210, width: 200, height: 200))
      view.panelId = panel["id"] as! String
      view.drawingData = panel["drawingData"] as! String
      controller.view.addSubview(view)
      return view
    }
    window.makeKeyAndVisible()
    defer { views.forEach { $0.removeFromSuperview() }; window.isHidden = true }
    let previews = try views.map { view in try XCTUnwrap(view.subviews.compactMap { $0 as? UIImageView }.first) }
    for _ in 0..<150 {
      if previews.allSatisfy({ $0.image != nil }) { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertTrue(previews.allSatisfy { $0.image != nil })
    let images = previews.map { $0.image }
    // Fabric z-order reconciliation can detach multiple panels in one update.
    for view in views { view.removeFromSuperview() }
    XCTAssertTrue(zip(previews, images).allSatisfy { $0.0.image === $0.1 })
    for view in views { controller.view.addSubview(view) }
    try await Task.sleep(nanoseconds: 200_000_000)
    XCTAssertTrue(zip(previews, images).allSatisfy { $0.0.image === $0.1 })
    XCTAssertTrue(previews.allSatisfy { !$0.isHidden })

    for index in 0..<3 {
      let view = views[index]
      view.isDrawingActive = true
      let canvas = view.canvasView
      // A blank, newly created renderer must not cover the existing ink preview.
      XCTAssertNotNil(previews[index].image)
      XCTAssertFalse(previews[index].isHidden)
      XCTAssertTrue(view.subviews.last === previews[index])
      for other in 0..<3 where other != index {
        XCTAssertNotNil(previews[other].image)
        XCTAssertFalse(previews[other].isHidden)
      }
      view.canvasViewDidFinishRendering(canvas)
      try await Task.sleep(nanoseconds: 30_000_000)
      XCTAssertTrue(previews[index].isHidden)
      view.isDrawingActive = false
      for _ in 0..<100 {
        if !view.subviews.contains(where: { $0 is PKCanvasView }) { break }
        try await Task.sleep(nanoseconds: 10_000_000)
      }
      XCTAssertFalse(previews[index].isHidden)
      XCTAssertNotNil(previews[index].image)
      // A completion already queued by the old renderer cannot hide a preview.
      view.canvasViewDidFinishRendering(canvas)
      try await Task.sleep(nanoseconds: 10_000_000)
      XCTAssertFalse(previews[index].isHidden)
    }
  }
}


extension CraftoonInkPerformanceTests {
  func testSavingInkDoesNotBlockMainThreadReferenceCapture() async throws {
    let id = UUID().uuidString
    let pages: [[String: Any]] = [["panels": [["id": id]]]]
    RNPencilKitView.drawingCache[id] = ink(100)
    let capture = CraftoonInkStore.capture(pages)
    let started = DispatchSemaphore(value: 0)
    let release = DispatchSemaphore(value: 0)
    let finished = expectation(description: "archive finished")
    var timedOut = false
    CraftoonInkStore.queue.async {
      do {
        try CraftoonInkStore.persist(capture.drawings, archive: { drawing in
          started.signal()
          timedOut = release.wait(timeout: .now() + 2) == .timedOut
          return drawing.dataRepresentation()
        })
      } catch { XCTFail(error.localizedDescription) }
      finished.fulfill()
    }
    XCTAssertEqual(started.wait(timeout: .now() + 5), .success)
    // This main-thread capture used to wait on the archive's global lock.
    let next = CraftoonInkStore.capture(pages)
    release.signal()
    await fulfillment(of: [finished], timeout: 10)
    XCTAssertFalse(timedOut, "Main-thread bookkeeping waited for serialization")
    XCTAssertEqual(try reference(next), try reference(capture))
  }

  func testManyPhotoPanelsMigrateToSmallFileReferencesAndRebaseAcrossContainers() throws {
    var seed: UInt32 = 17
    var bytes = [UInt8](repeating: 0, count: 512 * 512 * 4)
    for index in bytes.indices { seed = seed &* 1664525 &+ 1013904223; bytes[index] = UInt8(truncatingIfNeeded: seed >> 24) }
    let photos: [Data] = try (0..<8).map { index in
      var variant = bytes
      variant[index * 4] = UInt8(index)
      let provider = try XCTUnwrap(CGDataProvider(data: Data(variant) as CFData))
      let cg = try XCTUnwrap(CGImage(width: 512, height: 512, bitsPerComponent: 8, bitsPerPixel: 32,
        bytesPerRow: 512 * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue), provider: provider,
        decode: nil, shouldInterpolate: false, intent: .defaultIntent))
      return try XCTUnwrap(UIImage(cgImage: cg).pngData())
    }
    let original: [String: Any] = ["pages": [["panels": photos.enumerated().map { index, photo in
      ["id": "photo-\(index)", "tracingImage": ["uri": "data:image/png;base64," + photo.base64EncodedString(), "opacity": 0.35, "rotation": 17, "visible": true]] as [String: Any]
    }]]]
    let migrated = try CraftoonInkStore.compact(original)
    let payload = try JSONSerialization.data(withJSONObject: migrated)
    XCTAssertLessThan(payload.count, 16_384)
    let originalPayload = try JSONSerialization.data(withJSONObject: original)
    XCTAssertGreaterThan(originalPayload.count, 1_000_000)
    XCTAssertLessThan(payload.count * 100, originalPayload.count)
    print("Eight-photo bridge payload: \(originalPayload.count) -> \(payload.count) bytes")
    let pages = try XCTUnwrap(migrated["pages"] as? [[String: Any]])
    let panels = try XCTUnwrap(pages.first?["panels"] as? [[String: Any]])
    let images = panels.compactMap { $0["tracingImage"] as? [String: Any] }
    XCTAssertEqual(images.count, 8)
    XCTAssertEqual(Set(images.compactMap { $0["imageRef"] as? String }).count, 8)
    let reference = try XCTUnwrap(images.first?["imageRef"] as? String)
    XCTAssertEqual(try Data(contentsOf: CraftoonReferenceImageStore.url(reference)), photos[0])
    XCTAssertEqual(try CraftoonReferenceImageStore.store(photos[0], mime: "image/png")["imageRef"] as? String, reference)
    var moved = images[0]
    moved["uri"] = "file:///old-container/missing.png"
    let rebased = try CraftoonReferenceImageStore.compact(["pages": [["panels": [["tracingImage": moved]]]]])
    let newPages = try XCTUnwrap(rebased["pages"] as? [[String: Any]])
    let newPanels = try XCTUnwrap(newPages.first?["panels"] as? [[String: Any]])
    let image = try XCTUnwrap(newPanels.first?["tracingImage"] as? [String: Any])
    XCTAssertEqual(image["uri"] as? String, try CraftoonReferenceImageStore.url(reference).absoluteString)
    XCTAssertEqual(image["rotation"] as? Int, 17)
    XCTAssertEqual(image["opacity"] as? Double, 0.35)
    XCTAssertThrowsError(try CraftoonReferenceImageStore.url("../../bad.png"))
  }
}


extension CraftoonInkPerformanceTests {
  func testPreviewDisplayAndFastReturnDoNotWaitForBusyArchiveWriter() async throws {
    let id = UUID().uuidString
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
    let controller = UIViewController()
    window.rootViewController = controller
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    controller.view.addSubview(view)
    window.makeKeyAndVisible()
    defer { view.removeFromSuperview(); window.isHidden = true }
    view.isDrawingActive = true
    let canvas = view.canvasView
    canvas.drawing = ink(31)
    view.canvasViewDrawingDidChange(canvas)
    let capture = CraftoonInkStore.capture([["panels": [["id": id]]]])
    let reference = try self.reference(capture)
    let started = DispatchSemaphore(value: 0)
    let release = DispatchSemaphore(value: 0)
    let finished = expectation(description: "archive finished")
    CraftoonInkStore.queue.async {
      do {
        try CraftoonInkStore.persist(capture.drawings, archive: { drawing in
          started.signal()
          _ = release.wait(timeout: .now() + 5)
          return drawing.dataRepresentation()
        })
      } catch { XCTFail(error.localizedDescription) }
      finished.fulfill()
    }
    XCTAssertEqual(started.wait(timeout: .now() + 5), .success)
    defer { release.signal() }
    view.isDrawingActive = false
    for _ in 0..<60 {
      if !view.subviews.contains(where: { $0 is PKCanvasView }) { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertFalse(view.subviews.contains(where: { $0 is PKCanvasView }), "Preview waited for the persistence queue")
    let preview = try XCTUnwrap(view.subviews.compactMap { $0 as? UIImageView }.first)
    XCTAssertNotNil(preview.image)
    XCTAssertFalse(preview.isHidden)
    XCTAssertEqual(RNPencilKitView.drawingCache[id]?.strokes.count, 31)
    view.canvasViewDrawingDidChange(canvas) // queued callback from a retired renderer
    XCTAssertEqual(CraftoonInkStore.latestReferences[id], reference)
    // Returning before the file is written must use the retained drawing value.
    view.isDrawingActive = true
    XCTAssertEqual(view.canvasView.drawing.strokes.count, 31)
    release.signal()
    await fulfillment(of: [finished], timeout: 10)
    XCTAssertEqual(CraftoonInkStore.drawing(reference)?.strokes.count, 31)
  }
}

@MainActor
final class CraftoonPanelShapeTests: XCTestCase {
  func testRootAndSceneUseCurrentCanvasOrientationAndRestoreAutomaticScreens() throws {
    let previous = CraftoonOrientationState.mask
    defer { CraftoonOrientationState.mask = previous }
    let controller = ReactNativeDelegate().createRootViewController()
    XCTAssertTrue(controller is CraftoonRootViewController)
    XCTAssertTrue(controller.prefersStatusBarHidden)
    XCTAssertEqual(controller.preferredStatusBarUpdateAnimation, .none)
    let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
    let delegate = SceneDelegate()
    for mask in [UIInterfaceOrientationMask.portrait, .landscapeLeft, .all] {
      CraftoonOrientationState.mask = mask
      XCTAssertEqual(controller.supportedInterfaceOrientations, mask)
      if #available(iOS 27.0, *) {
        XCTAssertEqual(delegate.supportedInterfaceOrientations(for: scene), mask)
      }
    }
  }

  func testOrientationLockWaitsForChosenPageAndReleasesInAutomaticMode() {
    let previous = CraftoonOrientationState.mask
    defer { CraftoonOrientationState.mask = previous }
    CraftoonOrientationState.mask = .portrait
    XCTAssertTrue(CraftoonOrientationState.shouldLock(interfaceOrientation: .portrait))
    XCTAssertFalse(CraftoonOrientationState.shouldLock(interfaceOrientation: .landscapeRight))
    XCTAssertFalse(CraftoonOrientationState.shouldLock(interfaceOrientation: .unknown))
    CraftoonOrientationState.mask = .landscapeLeft
    XCTAssertTrue(CraftoonOrientationState.shouldLock(interfaceOrientation: .landscapeLeft))
    XCTAssertFalse(CraftoonOrientationState.shouldLock(interfaceOrientation: .landscapeRight))
    CraftoonOrientationState.mask = .all
    XCTAssertFalse(CraftoonOrientationState.shouldLock(interfaceOrientation: .portrait))
    XCTAssertFalse(CraftoonOrientationState.shouldLock(interfaceOrientation: .landscapeLeft))
  }

  func testVisibleCanvasLocksSceneAndAutomaticModeUnlocksIt() async throws {
    guard #available(iOS 26.0, *) else { throw XCTSkip("Scene orientation lock requires iPadOS 26.") }
    let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
    let current = scene.effectiveGeometry.interfaceOrientation
    guard current != .unknown else { throw XCTSkip("No active interface orientation.") }
    let previous = CraftoonOrientationState.mask
    let previousWindow = scene.keyWindow
    let window = UIWindow(windowScene: scene)
    let root = CraftoonRootViewController()
    window.rootViewController = root
    defer {
      CraftoonOrientationState.mask = previous
      window.isHidden = true
      previousWindow?.makeKeyAndVisible()
      if let controller = previousWindow?.rootViewController {
        CraftoonOrientationState.updateLockPreference(on: controller)
      }
    }
    window.makeKeyAndVisible()
    CraftoonOrientationState.mask = UIInterfaceOrientationMask(rawValue: 1 << current.rawValue)
    root.setNeedsUpdateOfSupportedInterfaceOrientations()
    CraftoonOrientationState.updateLockPreference(on: root)
    for _ in 0..<40 where !scene.effectiveGeometry.isInterfaceOrientationLocked {
      try await Task.sleep(nanoseconds: 50_000_000)
    }
    XCTAssertTrue(root.prefersInterfaceOrientationLocked)
    XCTAssertTrue(scene.effectiveGeometry.isInterfaceOrientationLocked)
    XCTAssertTrue(scene.statusBarManager?.isStatusBarHidden == true)
    CraftoonOrientationState.mask = .all
    CraftoonOrientationState.updateLockPreference(on: root)
    for _ in 0..<40 where scene.effectiveGeometry.isInterfaceOrientationLocked {
      try await Task.sleep(nanoseconds: 50_000_000)
    }
    XCTAssertFalse(root.prefersInterfaceOrientationLocked)
    XCTAssertFalse(scene.effectiveGeometry.isInterfaceOrientationLocked)
  }

  func testRestartedPencilContactInMarginTargetsSelectedCanvasButPreservesControlsAndOtherPanels() throws {
    let window = CraftoonInputWindow(frame: CGRect(x: 0, y: 0, width: 500, height: 700))
    let controller = UIViewController()
    window.rootViewController = controller
    let view = RNPencilKitView(frame: CGRect(x: 100, y: 120, width: 200, height: 180))
    let neighbor = RNPencilKitView(frame: CGRect(x: 100, y: 310, width: 200, height: 150))
    controller.view.addSubview(view)
    controller.view.addSubview(neighbor)
    window.makeKeyAndVisible()
    defer { view.isDrawingActive = false; view.removeFromSuperview(); neighbor.removeFromSuperview(); window.isHidden = true }
    view.isDrawingActive = true
    view.setNeedsLayout()
    view.layoutIfNeeded()
    let canvas = view.canvasView
    let gap = CGPoint(x: 180, y: 305)
    let target = try XCTUnwrap(RNPencilKitView.pencilMarginTarget(at: gap, in: window, normalTarget: controller.view))
    XCTAssertTrue(target === canvas || target.isDescendant(of: canvas))
    let input = canvas.convert(gap, from: window)
    XCTAssertEqual(input.x / canvas.zoomScale, 80, accuracy: 0.001)
    XCTAssertEqual(input.y / canvas.zoomScale, 185, accuracy: 0.001)
    XCTAssertTrue(canvas.bounds.contains(input))
    // A regular nil-event/finger hit uses normal UIKit routing, not the margin.
    XCTAssertFalse(window.hitTest(gap, with: nil)?.isDescendant(of: canvas) == true)
    XCTAssertNil(RNPencilKitView.pencilMarginTarget(at: CGPoint(x: 180, y: 315), in: window, normalTarget: neighbor))
    XCTAssertNil(RNPencilKitView.pencilMarginTarget(at: CGPoint(x: 180, y: 340), in: window, normalTarget: controller.view))
    let button = UIView()
    button.accessibilityTraits = .button
    let glyph = UIView()
    button.addSubview(glyph)
    XCTAssertNil(RNPencilKitView.pencilMarginTarget(at: gap, in: window, normalTarget: glyph))
    XCTAssertNil(RNPencilKitView.pencilMarginTarget(at: gap, in: window, normalTarget: UIButton()))
    view.isDrawingActive = false // Includes switching to Layout or image manipulation.
    XCTAssertNil(RNPencilKitView.pencilMarginTarget(at: gap, in: window, normalTarget: controller.view))
  }

  func testStrokeContinuityNeverClaimsANewContact() {
    XCTAssertFalse(CraftoonStrokeContinuity.shouldContinue(active: false, phases: [.moved]))
    XCTAssertFalse(CraftoonStrokeContinuity.shouldContinue(active: true, phases: [.began]))
    XCTAssertFalse(CraftoonStrokeContinuity.shouldContinue(active: true, phases: [.stationary, .began]))
    XCTAssertTrue(CraftoonStrokeContinuity.shouldContinue(active: true, phases: [.moved]))
    XCTAssertTrue(CraftoonStrokeContinuity.shouldContinue(active: true, phases: [.stationary]))
    XCTAssertTrue(CraftoonStrokeContinuity.shouldContinue(active: true, phases: [.ended]))
    XCTAssertTrue(CraftoonStrokeContinuity.shouldContinue(active: true, phases: nil))
  }

  func testActiveStrokeCanLeaveAndReenterPanelWhileItsMaskStaysClipped() throws {
    let points = [["x": 0.4, "y": 0], ["x": 1, "y": 0], ["x": 1, "y": 1], ["x": 0, "y": 1]] as NSArray
    let surface = CraftoonPanelClipView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    let view = RNPencilKitView(frame: surface.bounds)
    surface.polygonPoints = points
    view.polygonPoints = points
    surface.addSubview(view)
    view.isDrawingActive = true
    let canvas = view.canvasView
    canvas.isUserInteractionEnabled = true
    surface.layoutIfNeeded()
    view.setNeedsLayout()
    view.layoutIfNeeded()
    let mask = try XCTUnwrap(view.layer.mask as? CAShapeLayer)
    let surfaceMask = try XCTUnwrap(surface.layer.mask)
    let outsideCorner = CGPoint(x: 10, y: 10), outsideBounds = CGPoint(x: 240, y: 40)
    XCTAssertFalse(view.point(inside: outsideCorner, with: nil))
    XCTAssertFalse(surface.point(inside: outsideBounds, with: nil))
    view.canvasViewDidBeginUsingTool(canvas)
    for point in [CGPoint(x: 120, y: 20), outsideCorner, outsideBounds, CGPoint(x: 140, y: 40)] {
      XCTAssertTrue(surface.point(inside: point, with: nil))
      XCTAssertTrue(view.point(inside: point, with: nil))
      XCTAssertTrue(canvas.point(inside: view.convert(point, to: canvas), with: nil))
      let target = try XCTUnwrap(surface.hitTest(point, with: nil))
      XCTAssertTrue(target === canvas || target.isDescendant(of: canvas))
      XCTAssertTrue(view.layer.mask === mask)
      XCTAssertTrue(surface.layer.mask === surfaceMask)
    }
    XCTAssertFalse(try XCTUnwrap(mask.path).contains(outsideCorner))
    XCTAssertFalse(try XCTUnwrap(mask.path).contains(outsideBounds))
    view.canvasViewDidEndUsingTool(canvas)
    XCTAssertFalse(view.point(inside: outsideCorner, with: nil))
    XCTAssertFalse(surface.point(inside: outsideBounds, with: nil))
    XCTAssertFalse(canvas.point(inside: outsideBounds, with: nil))
    XCTAssertTrue(view.point(inside: CGPoint(x: 140, y: 40), with: nil))
  }

  func testLiveViewportDoesNotResetDuringAnActiveStroke() throws {
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 150))
    view.isDrawingActive = true
    let canvas = view.canvasView
    view.setNeedsLayout()
    view.layoutIfNeeded()
    let size = canvas.bounds.size, zoom = canvas.zoomScale, offset = canvas.contentOffset
    view.canvasViewDidBeginUsingTool(canvas)
    view.renderScale = 3
    view.layoutIfNeeded()
    XCTAssertEqual(canvas.bounds.size, size)
    XCTAssertEqual(canvas.zoomScale, zoom)
    XCTAssertEqual(canvas.contentOffset, offset)
    view.canvasViewDidEndUsingTool(canvas)
    view.layoutIfNeeded()
    XCTAssertEqual(canvas.bounds.size, CGSize(width: 792, height: 642))
    XCTAssertEqual(canvas.zoomScale, 3)
    XCTAssertEqual(canvas.contentOffset, CGPoint(x: -32 * canvas.zoomScale, y: -32 * canvas.zoomScale))
  }

  func testRepeatedActiveUpdatesDoNotStealPopoverFocusOrResetSelectedInk() throws {
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 500, height: 500))
    let controller = UIViewController()
    window.rootViewController = controller
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    let input = UITextField(frame: CGRect(x: 0, y: 300, width: 200, height: 40))
    controller.view.addSubview(view)
    controller.view.addSubview(input)
    window.makeKeyAndVisible()
    defer { view.isDrawingActive = false; view.removeFromSuperview(); window.isHidden = true }
    view.isDrawingActive = true
    let canvas = view.canvasView
    canvas.tool = PKInkingTool(.pen, color: .blue, width: 7)
    XCTAssertTrue(input.becomeFirstResponder()) // A palette popover can similarly take focus.
    for _ in 0..<10 {
      view.didMoveToWindow() // Repeated Fabric/window updates during presentation.
      XCTAssertTrue(input.isFirstResponder)
      XCTAssertFalse(canvas.isFirstResponder)
      XCTAssertEqual(try XCTUnwrap(canvas.tool as? PKInkingTool).color, UIColor.blue)
    }
    // An explicit switch out of and back into Draw reconnects the palette.
    view.isDrawingActive = false
    XCTAssertTrue(input.isFirstResponder)
    view.isDrawingActive = true
    XCTAssertTrue(canvas.isFirstResponder)
  }

  func testPixelRoundedFramesStillResizeAndWarpInactiveInk() throws {
    let id = "rounded-ink-" + UUID().uuidString
    defer { RNPencilKitView.drawingCache.removeValue(forKey: id); CraftoonInkStore.latestReferences.removeValue(forKey: id) }
    // React/Yoga rounds the actual view to pixels; JS retains fractional geometry.
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    let path = PKStrokePath(controlPoints: [CGPoint(x: 100, y: 100), CGPoint(x: 100, y: 150)].enumerated().map { index, point in
      PKStrokePoint(location: point, timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    RNPencilKitView.drawingCache[id] = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    func frame(_ right: Double, _ bottom: Double, resize: Bool) -> NSDictionary {
      ["x": 12.17, "width": 200.12, "height": 200.12, "revision": 0, "preview": false,
       "resizeInk": resize, "warpInk": !resize,
       "corners": [["x": 0, "y": 0], ["x": right, "y": 0], ["x": bottom, "y": 1], ["x": 0, "y": 1]],
       "contentBounds": ["x": 0, "y": 0, "width": right * 200.12, "height": 200.12]] as NSDictionary
    }
    func point() throws -> CGPoint {
      let stroke = try XCTUnwrap(RNPencilKitView.drawingCache[id]?.strokes.first)
      return stroke.path[0].location.applying(stroke.transform)
    }
    view.shapeFrame = frame(1, 1, resize: false)
    view.layoutIfNeeded()
    view.shapeFrame = frame(0.5, 0.5, resize: true)
    view.layoutIfNeeded()
    XCTAssertEqual(try point().x, 50, accuracy: 0.001)
    view.shapeFrame = frame(0.5, 0.25, resize: false)
    view.layoutIfNeeded()
    XCTAssertEqual(try point().x, 50 * (1 - 0.5 * 100 / 200.12), accuracy: 0.001)
    let once = try point()
    view.setNeedsLayout()
    view.layoutIfNeeded()
    XCTAssertEqual(try point(), once)
  }

  func testArrowWarpFollowsSlopingEdgesAndRetainsEditableInkAndEraserMask() throws {
    let old = [CGPoint(x: 0, y: 0), CGPoint(x: 200, y: 0), CGPoint(x: 200, y: 200), CGPoint(x: 0, y: 200)]
    let next = [CGPoint(x: 0, y: 0), CGPoint(x: 200, y: 0), CGPoint(x: 100, y: 200), CGPoint(x: 0, y: 200)]
    let path = PKStrokePath(controlPoints: [CGPoint(x: 100, y: 0), CGPoint(x: 100, y: 100), CGPoint(x: 100, y: 200)].enumerated().map { index, point in
      PKStrokePoint(location: point, timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 0.7, force: 0.6, azimuth: 0.3, altitude: 1)
    }, creationDate: Date())
    let source = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .blue), path: path,
      transform: .identity, mask: UIBezierPath(rect: CGRect(x: 90, y: 80, width: 20, height: 40)))])
    let result = CraftoonInkShapeWarp.drawing(source, from: old, to: next)
    let stroke = try XCTUnwrap(result.strokes.first)
    XCTAssertEqual(stroke.path[0].location, CGPoint(x: 100, y: 0))
    XCTAssertEqual(stroke.path[1].location, CGPoint(x: 75, y: 100))
    XCTAssertEqual(stroke.path[2].location, CGPoint(x: 50, y: 200))
    XCTAssertEqual(stroke.path[1].force, 0.6, accuracy: 0.001)
    XCTAssertEqual(stroke.path[1].opacity, 0.7, accuracy: 0.001)
    XCTAssertEqual(stroke.ink.color, UIColor.blue)
    XCTAssertNotNil(stroke.mask)
    XCTAssertTrue(try XCTUnwrap(stroke.mask).contains(CGPoint(x: 75, y: 100)))
    XCTAssertTrue(CraftoonInkShapeWarp.drawing(PKDrawing(), from: old, to: next).strokes.isEmpty)
  }

  func testArrowPreviewDoesNotRepeatedlyWarpInkAndReleaseAppliesOnce() throws {
    let id = "arrow-warp-" + UUID().uuidString
    defer { RNPencilKitView.drawingCache.removeValue(forKey: id); CraftoonInkStore.latestReferences.removeValue(forKey: id) }
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    let path = PKStrokePath(controlPoints: [CGPoint(x: 100, y: 100), CGPoint(x: 100, y: 180)].enumerated().map { index, point in
      PKStrokePoint(location: point, timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    RNPencilKitView.drawingCache[id] = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    func frame(_ bottomX: Double, preview: Bool) -> NSDictionary {
      ["x": 0, "width": 200, "height": 200, "revision": 0, "preview": preview, "warpInk": true,
       "corners": [["x": 0, "y": 0], ["x": 1, "y": 0], ["x": bottomX, "y": 1], ["x": 0, "y": 1]]] as NSDictionary
    }
    view.shapeFrame = frame(1, preview: false)
    view.layoutIfNeeded()
    for bottom in [0.9, 0.8, 0.5] {
      view.shapeFrame = frame(bottom, preview: true)
      view.layoutIfNeeded()
      XCTAssertEqual(try XCTUnwrap(RNPencilKitView.drawingCache[id]).strokes[0].path[0].location.x, 100)
    }
    view.shapeFrame = frame(0.5, preview: false)
    view.layoutIfNeeded()
    XCTAssertEqual(try XCTUnwrap(RNPencilKitView.drawingCache[id]).strokes[0].path[0].location.x, 75, accuracy: 0.01)
    view.setNeedsLayout()
    view.layoutIfNeeded()
    XCTAssertEqual(try XCTUnwrap(RNPencilKitView.drawingCache[id]).strokes[0].path[0].location.x, 75, accuracy: 0.01)
  }

  func testInactiveInkResizesWithVisiblePolygonInsideRetainedFrameButNotWithArrowEdits() throws {
    let id = "visible-resize-" + UUID().uuidString
    defer { RNPencilKitView.drawingCache.removeValue(forKey: id); CraftoonInkStore.latestReferences.removeValue(forKey: id) }
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    let path = PKStrokePath(controlPoints: [CGPoint(x: 20, y: 30), CGPoint(x: 80, y: 60)].enumerated().map { index, point in
      PKStrokePoint(location: point, timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    RNPencilKitView.drawingCache[id] = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    func frame(_ width: Double, _ height: Double, resize: Bool) -> NSDictionary {
      ["x": 0, "width": 200, "height": height, "revision": 0, "preview": false, "resizeInk": resize,
       "contentBounds": ["x": 0, "y": 0, "width": width, "height": height]] as NSDictionary
    }
    func point() throws -> CGPoint {
      let stroke = try XCTUnwrap(RNPencilKitView.drawingCache[id]?.strokes.first)
      return stroke.path[0].location.applying(stroke.transform)
    }
    view.shapeFrame = frame(200, 200, resize: false)
    view.layoutIfNeeded()
    view.shapeFrame = frame(120, 200, resize: false) // Arrow: change clipping only.
    view.layoutIfNeeded()
    XCTAssertEqual(try point(), CGPoint(x: 20, y: 30))
    view.shapeFrame = frame(60, 200, resize: true) // Circle: same frame, half visible width.
    view.layoutIfNeeded()
    XCTAssertEqual(try point().x, 10, accuracy: 0.01)
    XCTAssertEqual(try point().y, 30, accuracy: 0.01)
    view.shapeFrame = frame(120, 100, resize: true)
    view.frame.size.height = 100
    view.layoutIfNeeded()
    XCTAssertEqual(try point().x, 20, accuracy: 0.01)
    XCTAssertEqual(try point().y, 15, accuracy: 0.01)
    view.setNeedsLayout()
    view.layoutIfNeeded()
    XCTAssertEqual(try point().x, 20, accuracy: 0.01)
    XCTAssertEqual(try point().y, 15, accuracy: 0.01)
    XCTAssertFalse(view.subviews.contains { $0 is PKCanvasView })
  }

  func testFocusZoomUsesNativeViewportWithoutChangingDrawingCoordinates() throws {
    let id = "focus-zoom-" + UUID().uuidString
    defer { RNPencilKitView.drawingCache.removeValue(forKey: id) }
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 150))
    view.panelId = id
    let canvas = view.canvasView
    let path = PKStrokePath(controlPoints: [CGPoint(x: 20, y: 30), CGPoint(x: 80, y: 50)].enumerated().map { index, point in
      PKStrokePoint(location: point, timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    canvas.drawing = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    let originalBounds = canvas.drawing.bounds
    view.layoutIfNeeded()
    for scale in [3.0, 1.0, 2.5, 1.0] {
      view.renderScale = scale
      view.layoutIfNeeded()
      XCTAssertEqual(canvas.zoomScale, CGFloat(scale), accuracy: 0.001)
      XCTAssertEqual(canvas.bounds.width, 264 * CGFloat(scale), accuracy: 0.001)
      XCTAssertEqual(canvas.bounds.height, 214 * CGFloat(scale), accuracy: 0.001)
      XCTAssertEqual(canvas.frame.width, 264, accuracy: 0.001)
      XCTAssertEqual(canvas.frame.height, 214, accuracy: 0.001)
      XCTAssertEqual(canvas.drawing.bounds, originalBounds)
      XCTAssertEqual(canvas.drawing.strokes[0].path[0].location, CGPoint(x: 20, y: 30))
      XCTAssertEqual(canvas.contentOffset, CGPoint(x: -32 * canvas.zoomScale, y: -32 * canvas.zoomScale))
      let point = view.convert(CGPoint(x: 40, y: 60), to: canvas)
      XCTAssertEqual(point.x / canvas.zoomScale, 40, accuracy: 0.001)
      XCTAssertEqual(point.y / canvas.zoomScale, 60, accuracy: 0.001)
    }
  }

  func testExtendingShapeFrameTranslatesInkWithoutStretchingOrApplyingTwice() throws {
    let id = "shape-frame-" + UUID().uuidString
    defer { RNPencilKitView.drawingCache.removeValue(forKey: id); CraftoonInkStore.latestReferences.removeValue(forKey: id) }
    let path = PKStrokePath(controlPoints: [20.0, 80.0].enumerated().map { index, x in
      PKStrokePoint(location: CGPoint(x: CGFloat(x), y: 30), timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    let drawing = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    view.shapeFrame = ["x": 100, "width": 200, "height": 200, "revision": 0, "preview": false]
    view.layoutIfNeeded()
    view.drawingData = drawing.dataRepresentation().base64EncodedString()
    view.shapeFrame = ["x": 50, "width": 250, "height": 200, "revision": 1, "preview": true]
    view.frame.size.width = 250
    view.layoutIfNeeded()
    let shifted = try XCTUnwrap(RNPencilKitView.drawingCache[id])
    XCTAssertEqual(shifted.bounds.minX, drawing.bounds.minX + 50, accuracy: 0.01)
    XCTAssertEqual(shifted.bounds.width, drawing.bounds.width, accuracy: 0.01)
    view.shapeFrame = ["x": 50, "width": 250, "height": 200, "revision": 1, "preview": false]
    view.layoutIfNeeded()
    XCTAssertEqual(try XCTUnwrap(RNPencilKitView.drawingCache[id]).bounds, shifted.bounds)
    view.shapeFrame = ["x": 0, "width": 300, "height": 300, "revision": 2, "preview": false]
    view.frame.size = CGSize(width: 300, height: 300)
    view.layoutIfNeeded()
    let resized = try XCTUnwrap(RNPencilKitView.drawingCache[id])
    let originalPoint = shifted.strokes[0].path[0].location.applying(shifted.strokes[0].transform)
    let resizedPoint = resized.strokes[0].path[0].location.applying(resized.strokes[0].transform)
    XCTAssertEqual(resizedPoint.x, originalPoint.x + 50, accuracy: 0.01)
    XCTAssertEqual(resizedPoint.y, originalPoint.y * 1.5, accuracy: 0.01)
    view.setNeedsLayout()
    view.layoutIfNeeded()
    XCTAssertEqual(try XCTUnwrap(RNPencilKitView.drawingCache[id]).bounds, resized.bounds)
  }

  func testRectanglesAvoidMasksAndUnchangedSlopingMasksReuseTheirPath() throws {
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.layoutIfNeeded()
    XCTAssertTrue(view.clipsToBounds)
    XCTAssertNil(view.layer.mask)
    let points = [["x": 0.4, "y": 0], ["x": 1, "y": 0], ["x": 1, "y": 1], ["x": 0, "y": 1]] as NSArray
    view.polygonPoints = points
    let mask = try XCTUnwrap(view.layer.mask as? CAShapeLayer)
    let path = try XCTUnwrap(mask.path)
    for _ in 0..<10 {
      view.polygonPoints = points
      view.setNeedsLayout()
      view.layoutIfNeeded()
    }
    XCTAssertTrue(view.layer.mask === mask)
    XCTAssertTrue(mask.path === path)
    XCTAssertFalse(view.point(inside: CGPoint(x: 10, y: 10), with: nil))
    view.polygonPoints = []
    XCTAssertNil(view.layer.mask)
  }

  func testPencilKitMasksLiveAndPreviewChildrenAndUpdatesAfterReshape() throws {
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.polygonPoints = [["x": 0.4, "y": 0], ["x": 1, "y": 0], ["x": 1, "y": 1], ["x": 0, "y": 1]] as NSArray
    view.layoutIfNeeded()
    let canvas = view.canvasView
    view.setNeedsLayout()
    view.layoutIfNeeded()
    let mask = try XCTUnwrap(view.layer.mask as? CAShapeLayer)
    XCTAssertTrue(canvas.superview === view)
    XCTAssertFalse(try XCTUnwrap(mask.path).contains(CGPoint(x: 10, y: 10)))
    XCTAssertTrue(try XCTUnwrap(mask.path).contains(CGPoint(x: 120, y: 10)))
    XCTAssertNil(view.hitTest(CGPoint(x: 10, y: 10), with: nil))
    XCTAssertFalse(view.point(inside: CGPoint(x: 10, y: 10), with: nil))

    // Changing modes or adding another rendering child cannot bypass the mask.
    let strokePreview = UIView(frame: view.bounds)
    strokePreview.backgroundColor = .red
    view.addSubview(strokePreview)
    view.isDrawingActive = false
    XCTAssertTrue(view.layer.mask === mask)
    XCTAssertTrue(strokePreview.superview === view)
    view.polygonPoints = [["x": 0, "y": 0], ["x": 0.5, "y": 0], ["x": 1, "y": 1.0000000000000002], ["x": 0, "y": 1]] as NSArray
    view.frame.size.width = 300
    view.layoutIfNeeded()
    XCTAssertTrue(view.layer.mask === mask)
    XCTAssertFalse(try XCTUnwrap(mask.path).contains(CGPoint(x: 280, y: 10)))
    XCTAssertTrue(try XCTUnwrap(mask.path).contains(CGPoint(x: 10, y: 10)))
    XCTAssertEqual(mask.frame.size, view.bounds.size)
    XCTAssertTrue(view.canvasView === canvas)
  }

  func testLiveMaskClipsCornersAndRejectsInvalidSavedGeometry() {
    let points: [[String: Double]] = [["x": 0.4, "y": 0], ["x": 1, "y": 0], ["x": 1, "y": 1], ["x": 0, "y": 1]]
    let view = CraftoonPanelClipView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.polygonPoints = points as NSArray
    view.layoutIfNeeded()
    XCTAssertFalse(view.point(inside: CGPoint(x: 10, y: 10), with: nil))
    XCTAssertTrue(view.point(inside: CGPoint(x: 120, y: 10), with: nil))
    let mask = view.layer.mask as? CAShapeLayer
    XCTAssertEqual(mask?.path?.boundingBoxOfPath, view.bounds)
    view.polygonPoints = [["x": Double.nan, "y": 0]] as NSArray
    view.layoutIfNeeded()
    XCTAssertTrue(view.point(inside: CGPoint(x: 10, y: 10), with: nil))
  }

  func testLockedArtworkSurvivesResizeAndReshapeWithoutScalingOrDeletingCroppedInk() throws {
    let id = "locked-resize-" + UUID().uuidString
    defer { RNPencilKitView.drawingCache.removeValue(forKey: id); CraftoonInkStore.latestReferences.removeValue(forKey: id) }
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    let path = PKStrokePath(controlPoints: [CGPoint(x: 70, y: 80), CGPoint(x: 180, y: 170)].enumerated().map { index, point in
      PKStrokePoint(location: point, timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    let original = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .blue), path: path)])
    RNPencilKitView.drawingCache[id] = original
    func frame(_ width: Double, _ height: Double, _ bottom: Double, locked: Bool = true) -> NSDictionary {
      ["x": 100, "y": 120, "width": width, "height": height, "revision": 1, "preview": false,
       "artworkLocked": locked, "resizeInk": true, "warpInk": true,
       "corners": [["x": 0, "y": 0], ["x": 1, "y": 0], ["x": bottom, "y": 1], ["x": 0, "y": 1]]] as NSDictionary
    }
    view.shapeFrame = frame(200, 200, 1); view.layoutIfNeeded()
    view.frame.size = CGSize(width: 100, height: 110)
    view.shapeFrame = frame(100, 110, 0.5); view.layoutIfNeeded()
    let cropped = try XCTUnwrap(RNPencilKitView.drawingCache[id])
    XCTAssertEqual(cropped.strokes.count, 1)
    XCTAssertEqual(cropped.strokes[0].path[0].location.applying(cropped.strokes[0].transform), CGPoint(x: 70, y: 80))
    XCTAssertEqual(cropped.strokes[0].path[1].location.applying(cropped.strokes[0].transform), CGPoint(x: 180, y: 170))
    view.frame.size = CGSize(width: 200, height: 200)
    view.shapeFrame = frame(200, 200, 1); view.layoutIfNeeded()
    view.shapeFrame = frame(200, 200, 1, locked: false); view.layoutIfNeeded()
    // Unlocking establishes the current frame, without a delayed resize jump.
    XCTAssertEqual(try XCTUnwrap(RNPencilKitView.drawingCache[id]).strokes[0].transform, .identity)
    view.frame.size = CGSize(width: 400, height: 400)
    view.shapeFrame = frame(400, 400, 1, locked: false); view.layoutIfNeeded()
    let resized = try XCTUnwrap(RNPencilKitView.drawingCache[id]).strokes[0]
    XCTAssertEqual(resized.path[0].location.applying(resized.transform), CGPoint(x: 140, y: 160))
  }

  func testLockedArtworkStaysAtTheSamePagePositionAndMoveCommitsOnlyOnce() throws {
    let id = "locked-move-" + UUID().uuidString
    defer { RNPencilKitView.drawingCache.removeValue(forKey: id); CraftoonInkStore.latestReferences.removeValue(forKey: id) }
    let view = RNPencilKitView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
    view.panelId = id
    let path = PKStrokePath(controlPoints: [CGPoint(x: 100, y: 100), CGPoint(x: 150, y: 150)].enumerated().map { index, point in
      PKStrokePoint(location: point, timeOffset: Double(index), size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    RNPencilKitView.drawingCache[id] = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    func frame(_ x: Double, _ y: Double, preview: Bool = false) -> NSDictionary {
      ["x": x, "y": y, "width": 200, "height": 200, "revision": 0,
       "preview": preview, "artworkLocked": true, "resizeInk": false, "warpInk": false] as NSDictionary
    }
    func point() throws -> CGPoint {
      let stroke = try XCTUnwrap(RNPencilKitView.drawingCache[id]?.strokes.first)
      return stroke.path[0].location.applying(stroke.transform)
    }
    view.shapeFrame = frame(100, 120); view.layoutIfNeeded()
    for x in [110.0, 120, 140] {
      view.shapeFrame = frame(x, 180, preview: true); view.layoutIfNeeded()
      XCTAssertEqual(try point(), CGPoint(x: 100, y: 100))
    }
    view.shapeFrame = frame(140, 180); view.layoutIfNeeded()
    XCTAssertEqual(try point(), CGPoint(x: 60, y: 40))
    view.setNeedsLayout(); view.layoutIfNeeded()
    XCTAssertEqual(try point(), CGPoint(x: 60, y: 40))
    view.shapeFrame = frame(100, 120); view.layoutIfNeeded()
    XCTAssertEqual(try point(), CGPoint(x: 100, y: 100))
  }


  func testWarpKeepsOutsideStrokesFiniteAndPreventsBlackBleedAtAConvergingEdge() throws {
    let old = [CGPoint(x: 0, y: 0), CGPoint(x: 800, y: 0), CGPoint(x: 40, y: 480), CGPoint(x: 0, y: 480)]
    let next = [CGPoint(x: 0, y: 0), CGPoint(x: 800, y: 0), CGPoint(x: 60, y: 480), CGPoint(x: 0, y: 480)]
    // Pencil contacts can continue outside the masked panel. Here the old
    // side extensions meet just below the border, at y = 505.263... .
    let points = [CGPoint(x: 1, y: 505.2), CGPoint(x: 2, y: 505.26)]
    let path = PKStrokePath(controlPoints: points.enumerated().map { index, p in
      PKStrokePoint(location: p, timeOffset: Double(index) * 0.01, size: CGSize(width: 4, height: 4),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    let original = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    let result = CraftoonInkShapeWarp.drawing(original, from: old, to: next)
    XCTAssertEqual(result.strokes.count, 1, "Masked-out ink must remain editable rather than being deleted")
    for sample in try XCTUnwrap(result.strokes.first).path {
      XCTAssertTrue(sample.location.x.isFinite && sample.location.y.isFinite)
      XCTAssertLessThan(sample.size.width, 20)
      XCTAssertLessThan(sample.size.height, 20)
    }
    XCTAssertFalse(result.bounds.intersects(CGRect(x: 0, y: 0, width: 800, height: 480)),
      "An outside stroke must not grow into a black blob over the panel")
    let restored = CraftoonInkShapeWarp.drawing(result, from: next, to: old)
    for (sample, originalPoint) in zip(try XCTUnwrap(restored.strokes.first).path, points) {
      XCTAssertEqual(sample.location.x, originalPoint.x, accuracy: 0.001)
      XCTAssertEqual(sample.location.y, originalPoint.y, accuracy: 0.001)
    }
  }


  func testRepeatedReshapeRoundTripsDoNotInflateBrushThickness() throws {
    let old = [CGPoint(x: 180, y: 0), CGPoint(x: 200, y: 0), CGPoint(x: 200, y: 200), CGPoint(x: 0, y: 200)]
    let next = [CGPoint(x: 180, y: 0), CGPoint(x: 200, y: 0), CGPoint(x: 200, y: 200), CGPoint(x: 180, y: 200)]
    let points = [CGPoint(x: 50, y: 50), CGPoint(x: 60, y: 60), CGPoint(x: 170, y: 150)]
    let path = PKStrokePath(controlPoints: points.enumerated().map { index, p in
      PKStrokePoint(location: p, timeOffset: Double(index) * 0.01, size: CGSize(width: 3, height: 3),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    var drawing = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    for _ in 0..<12 {
      drawing = CraftoonInkShapeWarp.drawing(CraftoonInkShapeWarp.drawing(drawing, from: old, to: next), from: next, to: old)
      for (sample, original) in zip(try XCTUnwrap(drawing.strokes.first).path, points) {
        // PencilKit quantizes nib dimensions when a path is rebuilt. Allow
        // under 2% rounding over 24 rebuilds, not visible/shear inflation.
        XCTAssertEqual(sample.size.width, 3, accuracy: 0.06)
        XCTAssertEqual(sample.size.height, 3, accuracy: 0.06, "Moving the outline must not accumulate shear in the pen's thickness")
        XCTAssertEqual(sample.location.x, original.x, accuracy: 0.01)
        XCTAssertEqual(sample.location.y, original.y, accuracy: 0.01)
      }
    }
  }

  private func darkness(_ image: UIImage, at point: CGPoint) throws -> Int {
    let cg = try XCTUnwrap(image.cgImage)
    let pixel = try XCTUnwrap(cg.cropping(to: CGRect(x: point.x * image.scale, y: point.y * image.scale, width: 1, height: 1)))
    var bytes = [UInt8](repeating: 0, count: 4)
    try bytes.withUnsafeMutableBytes { buffer in
      let context = try XCTUnwrap(CGContext(data: buffer.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
      context.draw(pixel, in: CGRect(x: 0, y: 0, width: 1, height: 1))
    }
    return 765 - Int(bytes[0]) - Int(bytes[1]) - Int(bytes[2])
  }

  func testReadAndExportClipInkToQuadrilateralAndPreserveBorderStyles() throws {
    let library = CraftoonLibrary()
    let path = PKStrokePath(controlPoints: [0.0, 180.0].enumerated().map { index, x in
      PKStrokePoint(location: CGPoint(x: CGFloat(x), y: 20), timeOffset: Double(index), size: CGSize(width: 8, height: 8),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
    }, creationDate: Date())
    let ink = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    let corners = [["x": 0.4, "y": 0.0], ["x": 1.0, "y": 0.0], ["x": 1.0, "y": 1.0], ["x": 0.0, "y": 1.0]]
    let panel: [String: Any] = ["id": "shape", "x": 12, "y": 12, "width": 200, "height": 200,
      "corners": corners, "borderStyle": "none", "drawingData": ink.dataRepresentation().base64EncodedString()]
    let image = try XCTUnwrap(library.pageImage(["canvasSize": ["width": 300, "height": 300], "panels": [panel]]))
    XCTAssertLessThan(try darkness(image, at: CGPoint(x: 25, y: 34)), 20)
    XCTAssertGreaterThan(try darkness(image, at: CGPoint(x: 130, y: 34)), 300)

    var counts: [String: Int] = [:]
    for style in ["solid", "dashed", "dotted", "none"] {
      let borderPanel: [String: Any] = ["id": "border", "x": 12, "y": 12, "width": 200, "height": 200, "borderStyle": style]
      let preview = try XCTUnwrap(library.pageImage(["canvasSize": ["width": 300, "height": 300], "panels": [borderPanel]]))
      counts[style] = try (24..<200).filter { try darkness(preview, at: CGPoint(x: CGFloat($0), y: 13)) > 100 }.count
    }
    XCTAssertGreaterThan(counts["solid"]!, counts["dashed"]!)
    XCTAssertGreaterThan(counts["dashed"]!, counts["dotted"]!)
    XCTAssertGreaterThan(counts["dotted"]!, 0)
    XCTAssertEqual(counts["none"], 0)
  }
}

@MainActor
final class CraftoonMailPresentationTests: XCTestCase {
  private final class DeferredPresenter: UIViewController {
    var pendingPresentation: (() -> Void)?
    override func present(_ viewControllerToPresent: UIViewController, animated flag: Bool, completion: (() -> Void)? = nil) {
      pendingPresentation = completion
    }
  }

  func testPreparingMailIsNotRejectedBeforeItsPresentationCompletes() async throws {
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 500, height: 500))
    let presenter = DeferredPresenter()
    window.rootViewController = presenter
    window.makeKeyAndVisible()
    defer { window.isHidden = true }
    presenter.loadViewIfNeeded()
    let library = CraftoonLibrary()
    var completions = 0
    library.presentEmailController(UIViewController(), from: presenter) { _, _ in completions += 1 }
    try await Task.sleep(nanoseconds: 50_000_000)
    XCTAssertEqual(completions, 0, "A Mail controller may not have a presentingViewController during asynchronous setup")
    XCTAssertNotNil(presenter.pendingPresentation)
    presenter.pendingPresentation?()
    XCTAssertEqual(completions, 0, "Showing Mail is not a send/cancel completion")
  }

  func testInteractiveDismissalCompletesOnlyTheObservedMailWindowOnce() {
    let controller = UIViewController()
    var completions = 0
    let observer = CraftoonMailDismissalObserver(controller: controller) { completions += 1 }
    observer.presentationControllerDidDismiss(UIPresentationController(presentedViewController: UIViewController(), presenting: nil))
    XCTAssertEqual(completions, 0)
    let presentation = UIPresentationController(presentedViewController: controller, presenting: nil)
    observer.presentationControllerDidDismiss(presentation)
    observer.presentationControllerDidDismiss(presentation)
    XCTAssertEqual(completions, 1)
  }
}

final class CraftoonLibraryOrderTests: XCTestCase {
  private func list(_ library: CraftoonLibrary) async throws -> [[String: Any]] {
    try await withCheckedThrowingContinuation { continuation in
      library.listStories({ value in continuation.resume(returning: value as? [[String: Any]] ?? []) },
        rejecter: { _, _, error in continuation.resume(throwing: error ?? NSError(domain: "test", code: 1)) })
    }
  }
  private func reorder(_ library: CraftoonLibrary, _ ids: [String]) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      library.reorderStories(ids as NSArray, resolver: { _ in continuation.resume() },
        rejecter: { _, _, error in continuation.resume(throwing: error ?? NSError(domain: "test", code: 1)) })
    }
  }
  private func save(_ id: String, date: String, root: URL) throws -> Data {
    let folder = root.appendingPathComponent("CraftoonLibrary")
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let data = try JSONSerialization.data(withJSONObject: ["id": id, "title": id, "createdAt": date, "updatedAt": date,
      "pages": [["id": "p", "panels": [], "bubbles": []]], "storageVersion": 2,
      "thumbnailVersion": 3, "thumbnailData": "data:image/png;base64,"])
    try data.write(to: folder.appendingPathComponent(id + ".json"))
    return data
  }
  func testOrderSurvivesReloadAndNewComicsPrecedeItWithoutChangingComicFiles() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let original = try save("a", date: "2026-11-01T00:00:00Z", root: root)
    _ = try save("b", date: "2026-11-02T00:00:00Z", root: root)
    let library = CraftoonLibrary(storageRoot: root)
    let initial = try await list(library)
    XCTAssertEqual(initial.compactMap { $0["id"] as? String }, ["b", "a"])
    try await reorder(library, ["a", "b"])
    let reloaded = try await list(CraftoonLibrary(storageRoot: root))
    XCTAssertEqual(reloaded.compactMap { $0["id"] as? String }, ["a", "b"])
    XCTAssertEqual(reloaded.compactMap { $0["libraryOrder"] as? Int }, [0, 1])
    XCTAssertEqual(try Data(contentsOf: root.appendingPathComponent("CraftoonLibrary/a.json")), original)
    _ = try save("c", date: "2026-11-03T00:00:00Z", root: root)
    let fresh = try await list(library)
    XCTAssertEqual(fresh.compactMap { $0["id"] as? String }, ["c", "a", "b"])
  }
  func testInvalidOrderCannotOverwriteLastSavedOrder() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    _ = try save("a", date: "2026-11-01", root: root)
    let library = CraftoonLibrary(storageRoot: root)
    try await reorder(library, ["a"])
    for invalid in [["a", "a"], ["missing"], ["../outside"]] {
      do { try await reorder(library, invalid); XCTFail("Invalid order accepted") } catch { }
    }
    let order = try Data(contentsOf: root.appendingPathComponent("CraftoonLibrary/Metadata/order.json"))
    XCTAssertEqual(try JSONDecoder().decode([String].self, from: order), ["a"])
  }
}
