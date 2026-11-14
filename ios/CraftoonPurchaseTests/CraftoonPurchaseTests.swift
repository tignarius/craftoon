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
