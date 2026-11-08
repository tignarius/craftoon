import Foundation
import React
import PencilKit
import UIKit
import MessageUI

@objc(RNPencilKitManager)
class RNPencilKitManager: RCTViewManager {
  
  override func view() -> UIView! {
    return RNPencilKitView()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

// Store complete comics in Application Support, outside temporary/cache storage.
@objc(CraftoonLibrary)
class CraftoonLibrary: NSObject, MFMailComposeViewControllerDelegate {
  private var mailCompletion: ((Bool, Error?) -> Void)?
  private let storageQueue = DispatchQueue(label: "com.craftoon.library")

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func saveDraft(_ draft: NSDictionary,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let document = draft as? [String: Any],
            let pages = document["pages"] as? [[String: Any]], !pages.isEmpty else {
        reject("DRAFT_FAILED", "The canvas has no pages.", nil)
        return
      }
      CraftoonDraftRecovery.shared.update(document) { result in
        switch result {
        case .success: resolve(nil)
        case .failure(let error): reject("DRAFT_FAILED", "Could not preserve the canvas.", error)
        }
      }
    }
  }

  @objc func loadDraft(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      CraftoonDraftRecovery.shared.load { result in
        switch result {
        case .success(let document): resolve(document)
        case .failure(let error): reject("DRAFT_LOAD_FAILED", "Could not restore the last canvas.", error)
        }
      }
    }
  }

  private func withProAccess(reject: @escaping RCTPromiseRejectBlock, action: @escaping () -> Void) {
    Task {
      guard await CraftoonPurchaseStore.shared.hasProAccess() else {
        reject("PRO_REQUIRED", "Craftoon Pro is required for saving and exporting comics.", nil)
        return
      }
      DispatchQueue.main.async(execute: action)
    }
  }

  @objc func setCanvasOrientation(_ orientation: String,
                                  resolver resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard ["portrait", "landscape", "automatic"].contains(orientation) else {
        reject("ORIENTATION_FAILED", "Invalid canvas orientation.", nil)
        return
      }
      CraftoonOrientationState.generation += 1
      self.applyCanvasOrientation(orientation, generation: CraftoonOrientationState.generation,
        requestedAt: Date(), resolve: resolve, reject: reject)
    }
  }

  private func applyCanvasOrientation(_ orientation: String, generation: Int,
                                      requestedAt: Date,
                                      resolve: @escaping RCTPromiseResolveBlock,
                                      reject: @escaping RCTPromiseRejectBlock) {
    guard generation == CraftoonOrientationState.generation else { resolve(nil); return }
    guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
      .first(where: { $0.activationState == .foregroundActive }),
      let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController,
      root.viewIfLoaded?.window != nil, root.transitionCoordinator == nil,
      !(root.presentedViewController?.isBeingPresented ?? false) else {
      if Date().timeIntervalSince(requestedAt) < 3 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
          self.applyCanvasOrientation(orientation, generation: generation,
            requestedAt: requestedAt, resolve: resolve, reject: reject)
        }
      } else { reject("ORIENTATION_FAILED", "The app window is not ready to rotate.", nil) }
      return
    }
    // Keep the current edge when it already matches the paper format, then
    // lock that single orientation while editing or reading.
    let currentMask = UIInterfaceOrientationMask(rawValue: 1 << scene.interfaceOrientation.rawValue)
    let allowed: UIInterfaceOrientationMask = orientation == "landscape" ? .landscape :
      UIDevice.current.userInterfaceIdiom == .pad ? [.portrait, .portraitUpsideDown] : .portrait
    let physicalMask = CraftoonOrientationState.physicalMask
    let mask: UIInterfaceOrientationMask
    if orientation == "automatic" { mask = .all }
    else if !allowed.intersection(currentMask).isEmpty { mask = currentMask }
    else if physicalMask != .all && !allowed.intersection(physicalMask).isEmpty { mask = physicalMask }
    else { mask = orientation == "landscape" ? .landscapeRight : .portrait }
    let requestedMask = orientation == "automatic" ? CraftoonOrientationState.physicalMask : mask
    CraftoonOrientationState.mask = mask
    if orientation == "automatic" && requestedMask == .all {
      if #available(iOS 16.0, *) { root.setNeedsUpdateOfSupportedInterfaceOrientations() }
      resolve(nil)
      return
    }
    var finished = false
    var timer: Timer?
    let complete: (Error?) -> Void = { error in
      guard !finished else { return }
      finished = true
      timer?.invalidate()
      timer = nil
      if let error = error { reject("ORIENTATION_FAILED", "Could not rotate to the selected canvas.", error) }
      else { resolve(nil) }
    }
    let start = Date()
    timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
      if generation != CraftoonOrientationState.generation { complete(nil); return }
      let current = UIInterfaceOrientationMask(rawValue: 1 << scene.interfaceOrientation.rawValue)
      if orientation == "automatic" || current == mask { complete(nil) }
      else if Date().timeIntervalSince(start) > 3 {
        complete(NSError(domain: "CraftoonOrientation", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "The system could not change orientation."]))
      }
    }
    if #available(iOS 16.0, *) {
      root.setNeedsUpdateOfSupportedInterfaceOrientations()
      root.presentedViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
      scene.requestGeometryUpdate(.iOS(interfaceOrientations: requestedMask)) { error in
        guard !finished else { return }
        if Date().timeIntervalSince(requestedAt) < 3 {
          // A freshly restored React view may still be completing its first
          // layout/rotation transaction. Retry transient geometry refusals.
          finished = true
          timer?.invalidate()
          timer = nil
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.applyCanvasOrientation(orientation, generation: generation,
              requestedAt: requestedAt, resolve: resolve, reject: reject)
          }
        } else { complete(error) }
      }
    } else {
      // iOS 15: a public presentation API applies the preferred orientation.
      let rotation = CanvasRotationController(mask: requestedMask == .all ? .portrait : requestedMask)
      root.present(rotation, animated: false) { rotation.dismiss(animated: false) }
    }
  }

  private func directory() throws -> URL {
    let root = try FileManager.default.url(for: .applicationSupportDirectory,
      in: .userDomainMask, appropriateFor: nil, create: true)
    let directory = root.appendingPathComponent("CraftoonLibrary", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private func storyURL(_ id: String) throws -> URL {
    guard id.range(of: "^[A-Za-z0-9-]{1,80}$", options: .regularExpression) != nil else {
      throw NSError(domain: "CraftoonLibrary", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Invalid comic identifier."])
    }
    return try directory().appendingPathComponent(id).appendingPathExtension("json")
  }

  private func color(_ value: Any?, fallback: UIColor) -> UIColor {
    guard let string = value as? String else { return fallback }
    let hex = string.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard hex.count == 6, let rgb = UInt32(hex, radix: 16) else { return fallback }
    return UIColor(red: CGFloat((rgb >> 16) & 255) / 255,
                   green: CGFloat((rgb >> 8) & 255) / 255,
                   blue: CGFloat(rgb & 255) / 255, alpha: 1)
  }

  private func number(_ object: [String: Any], _ key: String, _ fallback: CGFloat = 0) -> CGFloat {
    guard let value = object[key] as? NSNumber, value.doubleValue.isFinite else { return fallback }
    return CGFloat(value.doubleValue)
  }

  private func thumbnail(_ story: [String: Any]) -> String? {
    guard let page = (story["pages"] as? [[String: Any]])?.first else { return nil }
    guard let image = pageImage(page, thumbnail: true), let jpeg = image.jpegData(compressionQuality: 0.68) else { return nil }
    if let png = image.pngData(), png.count < jpeg.count {
      return "data:image/png;base64," + png.base64EncodedString()
    }
    return "data:image/jpeg;base64," + jpeg.base64EncodedString()
  }

  private func pageSize(_ page: [String: Any]) -> CGSize {
    let panels = page["panels"] as? [[String: Any]] ?? []
    let bubbles = page["bubbles"] as? [[String: Any]] ?? []
    let canvas = page["canvasSize"] as? [String: Any] ?? [:]
    let contentWidth = (panels + bubbles).map { number($0, "x") + number($0, "width") + 12 }.max() ?? 0
    let contentHeight = (panels + bubbles).map { number($0, "y") + number($0, "height") + 12 }.max() ?? 0
    let landscape = page["orientation"] as? String == "landscape"
    let pageWidth = max(number(canvas, "width", landscape ? 1200 : 900), contentWidth, 1)
    let pageHeight = max(number(canvas, "height", landscape ? 900 : 1200), contentHeight, 1)
    return CGSize(width: pageWidth, height: pageHeight)
  }

  func pageImage(_ page: [String: Any], thumbnail: Bool = false, maxPixels: CGFloat = 2400) -> UIImage? {
    let panels = page["panels"] as? [[String: Any]] ?? []
    let bubbles = page["bubbles"] as? [[String: Any]] ?? []
    let dimensions = pageSize(page)
    let pageWidth = dimensions.width
    let pageHeight = dimensions.height
    let previewScale = 200 / max(pageWidth, pageHeight)
    let size = thumbnail ? CGSize(width: pageWidth * previewScale, height: pageHeight * previewScale) : dimensions
    let scale = min(size.width / pageWidth, size.height / pageHeight)
    let format = UIGraphicsImageRendererFormat()
    format.scale = thumbnail ? 2 : min(2, maxPixels / max(pageWidth, pageHeight))
    format.preferredRange = .standard
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    // PKDrawing rasterization resolves dynamic ink against the current traits.
    // Match the editor's white paper even when the iPad uses dark appearance.
    var image: UIImage!
    UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
      image = renderer.image { output in
        UIColor.white.setFill()
        output.fill(CGRect(origin: .zero, size: size))
        let context = output.cgContext
        context.translateBy(x: (size.width - pageWidth * scale) / 2,
                            y: (size.height - pageHeight * scale) / 2)
        context.scaleBy(x: scale, y: scale)
        for panel in panels {
          let rect = CGRect(x: number(panel, "x"), y: number(panel, "y"),
                            width: number(panel, "width"), height: number(panel, "height"))
          guard rect.width > 0, rect.height > 0 else { continue }
          let border = max(0, number(panel, "borderWidth", 2))
          let outline = UIBezierPath(roundedRect: rect.insetBy(dx: border / 2, dy: border / 2),
                                     cornerRadius: number(panel, "borderRadius", 2))
          UIColor.white.setFill()
          outline.fill()
          let content = rect.insetBy(dx: border, dy: border)
          if content.width > 0, content.height > 0,
             let encoded = panel["drawingData"] as? String,
             let data = Data(base64Encoded: encoded), let drawing = try? PKDrawing(data: data) {
            context.saveGState()
            context.clip(to: content)
            let ink = drawing.image(from: CGRect(origin: .zero, size: content.size), scale: max(0.05, scale * format.scale))
            ink.draw(in: content)
            context.restoreGState()
          }
          color(panel["borderColor"], fallback: UIColor.darkGray).setStroke()
          outline.lineWidth = border
          if border > 0 { outline.stroke() }
        }
        for bubble in bubbles {
          let rect = CGRect(x: number(bubble, "x"), y: number(bubble, "y"),
                            width: number(bubble, "width"), height: number(bubble, "height"))
          guard rect.width > 0, rect.height > 0 else { continue }
          let outline = UIBezierPath(roundedRect: rect, cornerRadius: 20)
          color(bubble["backgroundColor"], fallback: .white).setFill()
          outline.fill()
          UIColor.darkGray.setStroke()
          outline.lineWidth = 2
          outline.stroke()
          let paragraph = NSMutableParagraphStyle()
          paragraph.alignment = .center
          let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "ChalkboardSE-Bold", size: number(bubble, "fontSize", 14))
              ?? UIFont.systemFont(ofSize: number(bubble, "fontSize", 16), weight: .bold),
            .foregroundColor: color(bubble["color"], fallback: .darkGray),
            .paragraphStyle: paragraph
          ]
          let text = (bubble["text"] as? String ?? "") as NSString
          let textBounds = text.boundingRect(with: CGSize(width: max(1, rect.width - 24), height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes, context: nil)
          text.draw(in: CGRect(x: rect.minX + 12, y: rect.midY - min(rect.height - 20, textBounds.height) / 2,
            width: max(1, rect.width - 24), height: max(1, rect.height - 20)), withAttributes: attributes)
          let tail = UIBezierPath()
          tail.move(to: CGPoint(x: rect.minX + 20, y: rect.maxY))
          tail.addLine(to: CGPoint(x: rect.minX + 26, y: rect.maxY + 8))
          tail.addLine(to: CGPoint(x: rect.minX + 32, y: rect.maxY))
          tail.close()
          UIColor(red: 44/255, green: 62/255, blue: 80/255, alpha: 1).setFill()
          tail.fill()
        }
      }
    }
    return image
  }

  @objc func emailStory(_ story: NSDictionary,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    withProAccess(reject: reject) {
      guard self.mailCompletion == nil else {
        reject("EMAIL_BUSY", "An email is already open.", nil)
        return
      }
      guard let pages = story["pages"] as? [[String: Any]], !pages.isEmpty else {
        reject("EMAIL_FAILED", "The comic has no pages.", nil)
        return
      }
      var finished = false
      let complete: (Bool, Error?) -> Void = { completed, error in
        guard !finished else { return }
        finished = true
        self.mailCompletion = nil
        if let error = error { reject("EMAIL_FAILED", "Could not prepare the email.", error) }
        else { resolve(completed) }
      }
      self.mailCompletion = complete
      let title = story["title"] as? String ?? "Comic"
      self.storageQueue.async {
        // Keep the UI responsive while rendering a smaller attachment. Saved
        // ink remains editable and is never replaced with this email preview.
        let images = pages.compactMap { self.pageImage($0, maxPixels: 1400) }
        guard images.count == pages.count else {
          DispatchQueue.main.async {
            complete(false, NSError(domain: "CraftoonLibrary", code: 6,
              userInfo: [NSLocalizedDescriptionKey: "Could not render all comic pages."]))
          }
          return
        }
        let lossless = comicPDF(images: images, firstPage: 1, lastPage: images.count)
        let jpeg = comicPDF(images: images, firstPage: 1, lastPage: images.count, compact: true)
        let document = jpeg.count < lossless.count ? jpeg : lossless
        DispatchQueue.main.async { self.presentEmail(document: document, title: title, completion: complete) }
      }
    }
  }

  private func presentEmail(document: Data, title: String, completion complete: @escaping (Bool, Error?) -> Void) {
    guard let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
      .filter({ $0.activationState == .foregroundActive }).flatMap({ $0.windows }).first(where: { $0.isKeyWindow }),
      var presenter = window.rootViewController else {
      complete(false, NSError(domain: "CraftoonLibrary", code: 7,
        userInfo: [NSLocalizedDescriptionKey: "Could not open the email window."]))
      return
    }
    while let presented = presenter.presentedViewController { presenter = presented }
    let name = String(title.components(separatedBy: CharacterSet(charactersIn: "/\\:\n\r"))
      .joined(separator: "_").prefix(80))
    let filename = (name.isEmpty ? "Comic" : name) + ".pdf"
    if MFMailComposeViewController.canSendMail() {
      let composer = MFMailComposeViewController()
      composer.mailComposeDelegate = self
      composer.modalPresentationStyle = .formSheet
      composer.setSubject(title)
      composer.addAttachmentData(document, mimeType: "application/pdf", fileName: filename)
      presenter.present(composer, animated: true)
      return
    }
    let showShare = {
      let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
      do {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent(filename)
        try document.write(to: url, options: .atomic)
        let share = UIActivityViewController(activityItems: [CraftoonMailAttachment(url: url, subject: title)], applicationActivities: nil)
        share.completionWithItemsHandler = { _, completed, _, error in
          try? FileManager.default.removeItem(at: folder)
          complete(completed, error)
        }
        if let popover = share.popoverPresentationController {
          popover.sourceView = window
          popover.sourceRect = CGRect(x: window.bounds.width - window.safeAreaInsets.right - 112,
            y: window.safeAreaInsets.top + 6, width: 44, height: 44)
        }
        presenter.present(share, animated: true)
      } catch {
        try? FileManager.default.removeItem(at: folder)
        complete(false, error)
      }
    }
    let notice = UIAlertController(title: "Set up Mail",
      message: "To open an email with this PDF attached, add an account in Apple's Mail app. If you use Gmail or Outlook, choose Share PDF and select your mail app.",
      preferredStyle: .alert)
    notice.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in complete(false, nil) })
    notice.addAction(UIAlertAction(title: "Open Mail", style: .default) { _ in
      complete(false, nil)
      if let url = URL(string: "mailto:") { UIApplication.shared.open(url, options: [:]) }
    })
    notice.addAction(UIAlertAction(title: "Share PDF", style: .default) { _ in
      presenter.dismiss(animated: true, completion: showShare)
    })
    presenter.present(notice, animated: true)
  }

  func mailComposeController(_ controller: MFMailComposeViewController,
                             didFinishWith result: MFMailComposeResult, error: Error?) {
    let completion = mailCompletion
    controller.dismiss(animated: true) { completion?(result == .sent, error) }
  }

  @objc func printStory(_ story: NSDictionary,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    withProAccess(reject: reject) {
      guard let pages = story["pages"] as? [[String: Any]], !pages.isEmpty else {
        reject("PRINT_FAILED", "The comic has no pages.", nil)
        return
      }
      let images = pages.compactMap { page -> UIImage? in
        var snapshot = page
        var panels = page["panels"] as? [[String: Any]] ?? []
        for index in panels.indices {
          if let id = panels[index]["id"] as? String, let drawing = RNPencilKitView.drawingCache[id] {
            panels[index]["drawingData"] = drawing.dataRepresentation().base64EncodedString()
          }
        }
        snapshot["panels"] = panels
        return self.pageImage(snapshot)
      }
      guard images.count == pages.count,
            let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
              .flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) else {
        reject("PRINT_FAILED", "Could not prepare comic pages.", nil)
        return
      }
      guard var presenter = window.rootViewController else {
        reject("PRINT_FAILED", "Could not open print options.", nil)
        return
      }
      while let presented = presenter.presentedViewController { presenter = presented }
      let options = CraftoonPrintOptions(images: images, jobName: story["title"] as? String ?? "Comic") {
        completed, error in
        if let error = error { reject("PRINT_FAILED", "Could not print the comic.", error) }
        else { resolve(completed) }
      }
      let navigation = UINavigationController(rootViewController: options)
      navigation.modalPresentationStyle = .popover
      navigation.preferredContentSize = CGSize(width: 420, height: 360)
      if let popover = navigation.popoverPresentationController {
        popover.sourceView = window
        popover.sourceRect = CGRect(x: window.bounds.width - window.safeAreaInsets.right - 64,
          y: window.safeAreaInsets.top + 6, width: 44, height: 44)
        popover.permittedArrowDirections = [.up, .right]
        popover.delegate = options
      }
      presenter.present(navigation, animated: true)
    }
  }

  private func creationTimestamp(_ story: [String: Any], at url: URL) -> String {
    if let saved = story["createdAt"] as? String, !saved.isEmpty { return saved }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    // The document ID survives editing and atomic file replacements, unlike
    // filesystem dates. Recover legacy creation times before migrating files.
    if let id = story["id"] as? String, id.hasPrefix("story-"),
       let milliseconds = Int64(id.dropFirst(6)), milliseconds > 0,
       milliseconds < 253402300800000 {
      return formatter.string(from: Date(timeIntervalSince1970: Double(milliseconds) / 1000))
    }
    if let date = (try? url.resourceValues(forKeys: [.creationDateKey]))?.creationDate {
      return formatter.string(from: date)
    }
    return story["updatedAt"] as? String ?? formatter.string(from: Date())
  }

  private func summary(_ story: [String: Any]) -> [String: Any] {
    var result: [String: Any] = ["id": story["id"] ?? "", "title": story["title"] ?? "Untitled comic",
            "updatedAt": story["updatedAt"] ?? "",
            "createdAt": story["createdAt"] ?? "",
            "pageCount": (story["pages"] as? [[String: Any]])?.count ?? 0]
    if let firstPage = (story["pages"] as? [[String: Any]])?.first {
      let size = pageSize(firstPage)
      result["canvasSize"] = ["width": size.width, "height": size.height]
      result["orientation"] = size.width > size.height ? "landscape" : "portrait"
    }
    if let thumbnailData = story["thumbnailData"] as? String {
      result["thumbnailData"] = thumbnailData
    }
    return result
  }

  // Preserve a live draft without writing it to Library. A just-finished Pencil
  // stroke can be newer than the drawingData event React has received.
  @objc func capturePages(_ source: NSArray,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard var pages = source as? [[String: Any]] else {
        reject("CAPTURE_FAILED", "Could not preserve the current canvas.", nil)
        return
      }
      for pageIndex in pages.indices {
        var panels = pages[pageIndex]["panels"] as? [[String: Any]] ?? []
        for panelIndex in panels.indices {
          if let id = panels[panelIndex]["id"] as? String,
             let drawing = RNPencilKitView.drawingCache[id] {
            panels[panelIndex]["drawingData"] = drawing.dataRepresentation().base64EncodedString()
          }
        }
        pages[pageIndex]["panels"] = panels
      }
      resolve(pages)
    }
  }

  private func restoreDrawingCache(_ pages: [[String: Any]]) {
    for page in pages {
      for panel in page["panels"] as? [[String: Any]] ?? [] {
        guard let id = panel["id"] as? String else { continue }
        if let encoded = panel["drawingData"] as? String,
           let bytes = Data(base64Encoded: encoded), let drawing = try? PKDrawing(data: bytes) {
          RNPencilKitView.drawingCache[id] = drawing
        } else {
          RNPencilKitView.drawingCache.removeValue(forKey: id)
        }
      }
    }
  }

  @objc func restorePages(_ source: NSArray,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let pages = source as? [[String: Any]] else {
        reject("RESTORE_DRAFT_FAILED", "Could not restore the current canvas.", nil)
        return
      }
      self.restoreDrawingCache(pages)
      resolve(nil)
    }
  }

  @objc func saveStory(_ story: NSDictionary,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Snapshot native drawings on the main queue. A just-finished stroke may not
    // have reached React yet when the person presses Save or leaves the canvas.
    withProAccess(reject: reject) {
      var snapshot = story as? [String: Any] ?? [:]
      guard let id = snapshot["id"] as? String,
            var pages = snapshot["pages"] as? [[String: Any]], !pages.isEmpty else {
        reject("SAVE_FAILED", "The comic has no pages.", nil)
        return
      }
      for pageIndex in pages.indices {
        var panels = pages[pageIndex]["panels"] as? [[String: Any]] ?? []
        for panelIndex in panels.indices {
          if let panelId = panels[panelIndex]["id"] as? String,
             let drawing = RNPencilKitView.drawingCache[panelId] {
            panels[panelIndex]["drawingData"] = drawing.dataRepresentation().base64EncodedString()
          }
        }
        pages[pageIndex]["panels"] = panels
      }
      snapshot["pages"] = pages
      snapshot["version"] = 1
      snapshot["storageVersion"] = 2
      let document = snapshot
      self.storageQueue.async {
        do {
          var savedDocument = document
          let destination = try self.storyURL(id)
          let existing = (try? Data(contentsOf: destination)).flatMap { try? decodeComicDocument($0) }
          savedDocument["createdAt"] = self.creationTimestamp(existing ?? document, at: destination)
          savedDocument["thumbnailData"] = self.thumbnail(document)
          savedDocument["thumbnailVersion"] = 3
          let data = try encodeComicDocument(savedDocument)
          try data.write(to: destination, options: .atomic)
          DispatchQueue.main.async {
            CraftoonDraftRecovery.shared.markSaved(id: id, title: savedDocument["title"] as? String ?? "Untitled comic")
            resolve(self.summary(savedDocument))
          }
        } catch { reject("SAVE_FAILED", "Could not save this comic.", error) }
      }
    }
  }

  @objc func listStories(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    storageQueue.async {
      do {
        let urls = try FileManager.default.contentsOfDirectory(at: self.directory(),
          includingPropertiesForKeys: [.creationDateKey]).filter { $0.pathExtension == "json" }
        let stories = urls.compactMap { url -> [String: Any]? in
          guard let data = try? Data(contentsOf: url),
                var story = try? decodeComicDocument(data),
                story["id"] is String, story["pages"] is [[String: Any]] else { return nil }
          // Atomically migrate older saves without changing any editable ink.
          // Keep the internal filename so loading, deletion and Undo use the same ID.
          let needsCreationDate = (story["createdAt"] as? String ?? "").isEmpty
          if needsCreationDate { story["createdAt"] = self.creationTimestamp(story, at: url) }
          if needsCreationDate || story["storageVersion"] as? Int != 2 || story["thumbnailVersion"] as? Int != 3 || story["thumbnailData"] == nil {
            story["thumbnailData"] = self.thumbnail(story)
            story["thumbnailVersion"] = 3
            story["storageVersion"] = 2
            if let updated = try? encodeComicDocument(story) {
              try? updated.write(to: url, options: .atomic)
            }
          }
          return self.summary(story)
        }.sorted {
          let first = $0["createdAt"] as? String ?? ""
          let second = $1["createdAt"] as? String ?? ""
          return first == second ? ($0["id"] as? String ?? "") < ($1["id"] as? String ?? "") : first > second
        }
        resolve(stories)
      } catch { reject("LIST_FAILED", "Could not open the library.", error) }
    }
  }

  private func trashDirectory() throws -> URL {
    let folder = try directory().appendingPathComponent("Trash", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder
  }

  @objc func deleteStory(_ id: String,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    storageQueue.async {
      do {
        let source = try self.storyURL(id)
        let token = UUID().uuidString
        let destination = try self.trashDirectory().appendingPathComponent(token).appendingPathExtension("json")
        // Keep the complete document so Undo can restore pages and thumbnails.
        try FileManager.default.moveItem(at: source, to: destination)
        resolve(["token": token])
      } catch { reject("DELETE_FAILED", "Could not delete this comic.", error) }
    }
  }

  @objc func restoreStory(_ token: String,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    storageQueue.async {
      do {
        guard UUID(uuidString: token) != nil else {
          throw NSError(domain: "CraftoonLibrary", code: 3,
            userInfo: [NSLocalizedDescriptionKey: "Invalid recovery token."])
        }
        let source = try self.trashDirectory().appendingPathComponent(token).appendingPathExtension("json")
        let data = try Data(contentsOf: source)
        var story = try decodeComicDocument(data)
        let needsCreationDate = (story["createdAt"] as? String ?? "").isEmpty
        if needsCreationDate {
          story["createdAt"] = self.creationTimestamp(story, at: source)
          try encodeComicDocument(story).write(to: source, options: .atomic)
        }
        guard let id = story["id"] as? String else {
          throw NSError(domain: "CraftoonLibrary", code: 4,
            userInfo: [NSLocalizedDescriptionKey: "This comic file is invalid."])
        }
        // moveItem refuses to overwrite an existing comic with the same ID.
        try FileManager.default.moveItem(at: source, to: self.storyURL(id))
        resolve(self.summary(story))
      } catch { reject("RESTORE_FAILED", "Could not restore this comic.", error) }
    }
  }

  @objc func loadStory(_ id: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    storageQueue.async {
      do {
        let data = try Data(contentsOf: self.storyURL(id))
        let story = try decodeComicDocument(data)
        guard let pages = story["pages"] as? [[String: Any]], !pages.isEmpty else {
          throw NSError(domain: "CraftoonLibrary", code: 2,
            userInfo: [NSLocalizedDescriptionKey: "This comic file is invalid."])
        }
        DispatchQueue.main.async {
          // Restore the saved version regardless of React native prop ordering.
          self.restoreDrawingCache(pages)
          resolve(story)
        }
      } catch { reject("LOAD_FAILED", "Could not load this comic.", error) }
    }
  }
}


// A separate UIKit book contains only rendered pages: no drawing surfaces or editor gestures.
@objc(CraftoonReaderManager)
class CraftoonReaderManager: RCTViewManager {
  override func view() -> UIView! { CraftoonReaderView() }
  override static func requiresMainQueueSetup() -> Bool { true }
}

private class ComicBookPage: UIViewController {
  let index: Int
  let paperSize: CGSize
  init(index: Int, image: UIImage?) {
    self.index = index
    self.paperSize = image?.size ?? CGSize(width: 900, height: 1200)
    super.init(nibName: nil, bundle: nil)
    let paper = UIImageView(image: image)
    paper.contentMode = .scaleAspectFit
    paper.backgroundColor = .white
    paper.isAccessibilityElement = true
    paper.accessibilityLabel = "Page \(index + 1)"
    view = paper
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

class CraftoonReaderView: UIView, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
  private let renderer = CraftoonLibrary()
  private let book = UIPageViewController(transitionStyle: UIAccessibility.isReduceMotionEnabled ? .scroll : .pageCurl,
    navigationOrientation: .horizontal, options: [UIPageViewController.OptionsKey.spineLocation: UIPageViewController.SpineLocation.min.rawValue])
  private var displayedIndex = 0
  private var turning = false
  @objc var onPageChange: RCTBubblingEventBlock?
  @objc var pages: NSArray = [] { didSet {
    displayedIndex = min(max(0, pageIndex), max(0, pages.count - 1))
    showPage(animated: false)
  } }
  @objc var pageIndex: Int = 0 { didSet {
    guard !turning, pageIndex != displayedIndex, pages.count > 0 else { return }
    // Cross-format transitions must not race a page-curl against scene rotation.
    let source = pages[pageIndex] as? [String: Any] ?? [:]
    let size = source["canvasSize"] as? [String: Any] ?? [:]
    let targetWide = (source["orientation"] as? String) == "landscape" ||
      ((size["width"] as? Double ?? 900) > (size["height"] as? Double ?? 1200))
    let previous = (book.viewControllers?.first as? ComicBookPage)?.paperSize
    let sameFormat = previous.map { ($0.width > $0.height) == targetWide } ?? false
    showPage(animated: window != nil && sameFormat)
  } }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = UIColor(red: 233/255, green: 228/255, blue: 218/255, alpha: 1)
    book.dataSource = self
    book.delegate = self
    book.isDoubleSided = false
    addSubview(book.view)
    book.view.layer.shadowColor = UIColor.black.cgColor
    book.view.layer.shadowOpacity = 0.18
    book.view.layer.shadowRadius = 8
    book.view.layer.shadowOffset = CGSize(width: 0, height: 4)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil, book.parent == nil {
      var responder: UIResponder? = next
      while let current = responder {
        if let controller = current as? UIViewController {
          controller.addChild(book)
          book.didMove(toParent: controller)
          break
        }
        responder = current.next
      }
    } else if window == nil, book.parent != nil {
      book.willMove(toParent: nil)
      book.removeFromParent()
    }
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    let available = bounds.insetBy(dx: 20, dy: 20)
    let size = (book.viewControllers?.first as? ComicBookPage)?.paperSize ?? CGSize(width: 900, height: 1200)
    let scale = max(0.01, min(available.width / size.width, available.height / size.height))
    book.view.frame = CGRect(x: available.midX - size.width * scale / 2,
      y: available.midY - size.height * scale / 2, width: size.width * scale, height: size.height * scale)
  }
  private func page(_ index: Int) -> ComicBookPage? {
    guard index >= 0, index < pages.count, var content = pages[index] as? [String: Any] else { return nil }
    // A stroke can reach the native cache before React receives its serialized data.
    // Preview the current ink immediately when switching directly from the canvas.
    var panels = content["panels"] as? [[String: Any]] ?? []
    for panelIndex in panels.indices {
      if let id = panels[panelIndex]["id"] as? String,
         let drawing = RNPencilKitView.drawingCache[id] {
        panels[panelIndex]["drawingData"] = drawing.dataRepresentation().base64EncodedString()
      }
    }
    content["panels"] = panels
    return ComicBookPage(index: index, image: renderer.pageImage(content))
  }
  private func showPage(animated: Bool) {
    let target = min(max(0, pageIndex), max(0, pages.count - 1))
    guard let controller = page(target) else { return }
    let direction: UIPageViewController.NavigationDirection = target >= displayedIndex ? .forward : .reverse
    displayedIndex = target
    turning = animated
    book.setViewControllers([controller], direction: direction, animated: animated) { [weak self] _ in
      guard let self = self else { return }
      self.turning = false
      self.setNeedsLayout()
      if self.pageIndex != self.displayedIndex { self.showPage(animated: false) }
    }
  }
  func pageViewController(_ pageViewController: UIPageViewController,
    viewControllerBefore viewController: UIViewController) -> UIViewController? {
    guard let current = viewController as? ComicBookPage else { return nil }
    return page(current.index - 1)
  }
  func pageViewController(_ pageViewController: UIPageViewController,
    viewControllerAfter viewController: UIViewController) -> UIViewController? {
    guard let current = viewController as? ComicBookPage else { return nil }
    return page(current.index + 1)
  }
  func pageViewController(_ pageViewController: UIPageViewController,
    willTransitionTo pendingViewControllers: [UIViewController]) { turning = true }
  func pageViewController(_ pageViewController: UIPageViewController, didFinishAnimating finished: Bool,
    previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
    turning = false
    if let current = book.viewControllers?.first as? ComicBookPage {
      displayedIndex = current.index
      pageIndex = current.index
      setNeedsLayout()
      onPageChange?(["pageIndex": current.index])
    }
  }
}


// Keep the initial iPad panel sized to its controls; the system preview can leave
// a large empty area even for a one-page comic. AirPrint still handles discovery
// and delivery. Advanced printer-specific settings remain available on request.
private final class CraftoonPrintOptions: UITableViewController, UIPopoverPresentationControllerDelegate {
  private let images: [UIImage]
  private let jobName: String
  private var completion: ((Bool, Error?) -> Void)?
  private var selectedPrinter: UIPrinter?
  private var firstPage = 1
  private var lastPage: Int
  private var copies = 1
  private var busy = false

  init(images: [UIImage], jobName: String, completion: @escaping (Bool, Error?) -> Void) {
    self.images = images
    self.jobName = jobName
    self.lastPage = images.count
    self.completion = completion
    super.init(style: .insetGrouped)
    title = "Print"
    preferredContentSize = CGSize(width: 420, height: 360)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func viewDidLoad() {
    super.viewDidLoad()
    tableView.rowHeight = 52
    tableView.isScrollEnabled = false
    navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancel))
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Print", style: .done, target: self, action: #selector(printSelected))
    navigationItem.rightBarButtonItem?.isEnabled = false
    let more = UIButton(type: .system)
    more.setTitle("More Print Options…", for: .normal)
    more.addTarget(self, action: #selector(advancedOptions), for: .touchUpInside)
    more.frame.size = CGSize(width: 420, height: 44)
    tableView.tableFooterView = more
  }

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { 4 }
  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = UITableViewCell(style: .value1, reuseIdentifier: nil)
    cell.selectionStyle = .none
    if indexPath.row == 0 {
      cell.textLabel?.text = "Printer"
      cell.detailTextLabel?.text = selectedPrinter?.displayName ?? "Select Printer"
      cell.accessoryType = .disclosureIndicator
      cell.selectionStyle = .default
    } else {
      let value = indexPath.row == 1 ? firstPage : indexPath.row == 2 ? lastPage : copies
      cell.textLabel?.text = indexPath.row == 1 ? "From Page: \(value)" : indexPath.row == 2 ? "To Page: \(value)" : "Copies: \(value)"
      let stepper = UIStepper()
      stepper.tag = indexPath.row
      stepper.minimumValue = 1
      stepper.maximumValue = Double(indexPath.row == 3 ? 99 : images.count)
      stepper.value = Double(value)
      stepper.accessibilityLabel = indexPath.row == 1 ? "From Page" : indexPath.row == 2 ? "To Page" : "Copies"
      stepper.addTarget(self, action: #selector(changeValue(_:)), for: .valueChanged)
      cell.accessoryView = stepper
    }
    return cell
  }
  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    guard indexPath.row == 0, !busy else { return }
    let picker = UIPrinterPickerController(initiallySelectedPrinter: selectedPrinter)
    picker.present(from: tableView.rectForRow(at: indexPath), in: tableView, animated: true) { [weak self] picker, selected, _ in
      guard let self = self, selected else { return }
      self.selectedPrinter = picker.selectedPrinter
      self.navigationItem.rightBarButtonItem?.isEnabled = self.selectedPrinter != nil
      self.tableView.reloadData()
    }
  }
  @objc private func changeValue(_ sender: UIStepper) {
    let value = Int(sender.value)
    if sender.tag == 1 { firstPage = value; lastPage = max(lastPage, value) }
    else if sender.tag == 2 { lastPage = value; firstPage = min(firstPage, value) }
    else { copies = value }
    tableView.reloadData()
  }
  private func document() -> Data {
    comicPDF(images: images, firstPage: firstPage, lastPage: lastPage, copies: copies)
  }
  private func preparePrinter() -> UIPrintInteractionController {
    let printer = UIPrintInteractionController.shared
    let info = UIPrintInfo(dictionary: nil)
    info.jobName = jobName
    info.orientation = images[firstPage - 1].size.width > images[firstPage - 1].size.height ? .landscape : .portrait
    info.outputType = .general
    info.duplex = .none
    printer.printInfo = info
    printer.printingItem = document()
    printer.showsPageRange = true
    return printer
  }
  private func setBusy(_ value: Bool) {
    busy = value
    isModalInPresentation = value
    navigationController?.isModalInPresentation = value
    tableView.isUserInteractionEnabled = !value
    navigationItem.leftBarButtonItem?.isEnabled = !value
    navigationItem.rightBarButtonItem?.isEnabled = !value && selectedPrinter != nil
  }
  @objc private func printSelected() {
    guard let selectedPrinter = selectedPrinter, !busy else { return }
    setBusy(true)
    let started = preparePrinter().print(to: selectedPrinter) { [self] _, completed, error in
      if completed { finish(true, error) }
      else {
        setBusy(false)
        if let error = error {
          let alert = UIAlertController(title: "Could not print", message: error.localizedDescription, preferredStyle: .alert)
          alert.addAction(UIAlertAction(title: "OK", style: .default))
          present(alert, animated: true)
        }
      }
    }
    if !started { setBusy(false) }
  }
  @objc private func advancedOptions() {
    guard !busy else { return }
    setBusy(true)
    let printer = preparePrinter()
    let started = printer.present(from: CGRect(x: view.bounds.midX, y: view.bounds.maxY - 44, width: 1, height: 1),
      in: view, animated: true) { [self] _, completed, error in
      setBusy(false)
      if completed { finish(true, error) }
    }
    if !started { setBusy(false) }
  }
  @objc private func cancel() { finish(false, nil) }
  private func finish(_ completed: Bool, _ error: Error?) {
    let callback = completion
    completion = nil
    dismiss(animated: true) { callback?(completed, error) }
  }
  func presentationControllerShouldDismiss(_ presentationController: UIPresentationController) -> Bool { !busy }
  func popoverPresentationControllerShouldDismissPopover(_ popoverPresentationController: UIPopoverPresentationController) -> Bool { !busy }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    let callback = completion
    completion = nil
    callback?(false, nil)
  }
}


private func comicPDF(images: [UIImage], firstPage: Int, lastPage: Int, copies: Int = 1, compact: Bool = false) -> Data {
  let bounds = CGRect(x: 0, y: 0, width: 612, height: 792)
  return UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
    for _ in 0..<copies {
      for image in images[(firstPage - 1)..<lastPage] {
        let bounds = image.size.width > image.size.height ? CGRect(x: 0, y: 0, width: 792, height: 612) : bounds
        context.beginPage(withBounds: bounds, pageInfo: [:])
        let scale = min(bounds.width / image.size.width, bounds.height / image.size.height)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let rect = CGRect(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2,
          width: size.width, height: size.height)
        if compact, let jpeg = image.jpegData(compressionQuality: 0.68),
           let provider = CGDataProvider(data: jpeg as CFData),
           let compressed = CGImage(jpegDataProviderSource: provider, decode: nil,
             shouldInterpolate: true, intent: .defaultIntent) {
          // Preserve the JPEG stream inside the PDF instead of embedding raw pixels.
          let canvas = context.cgContext
          canvas.saveGState()
          canvas.translateBy(x: 0, y: bounds.height)
          canvas.scaleBy(x: 1, y: -1)
          canvas.draw(compressed, in: rect)
          canvas.restoreGState()
        } else { image.draw(in: rect) }
      }
    }
  }
}

private final class CraftoonMailAttachment: NSObject, UIActivityItemSource {
  private let url: URL
  private let subject: String
  init(url: URL, subject: String) { self.url = url; self.subject = subject }
  func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any { url }
  func activityViewController(_ activityViewController: UIActivityViewController,
                            itemForActivityType activityType: UIActivity.ActivityType?) -> Any? { url }
  func activityViewController(_ activityViewController: UIActivityViewController,
                            subjectForActivityType activityType: UIActivity.ActivityType?) -> String { subject }
}


// Lossless compression of the complete editable document. Older plain JSON
// saves are still accepted; thumbnails use JPEG but PencilKit strokes stay exact.
private let comicStorageMagic = Data("CRAFT02\n".utf8)
private func encodeComicDocument(_ story: [String: Any]) throws -> Data {
  let json = try JSONSerialization.data(withJSONObject: story)
  let compressed = try (json as NSData).compressed(using: .lzfse) as Data
  return compressed.count + comicStorageMagic.count < json.count ? comicStorageMagic + compressed : json
}
private func decodeComicDocument(_ data: Data) throws -> [String: Any] {
  let json: Data
  if data.starts(with: comicStorageMagic) {
    json = try (Data(data.dropFirst(comicStorageMagic.count)) as NSData).decompressed(using: .lzfse) as Data
  } else { json = data }
  guard let story = try JSONSerialization.jsonObject(with: json) as? [String: Any] else {
    throw NSError(domain: "CraftoonLibrary", code: 5,
      userInfo: [NSLocalizedDescriptionKey: "This comic file is invalid."])
  }
  return story
}


// Recovery is separate from named Library comics. Native ink is persisted even
// before its serialized drawing-change event reaches JavaScript.
final class CraftoonDraftRecovery {
  static let shared = CraftoonDraftRecovery()
  private let queue = DispatchQueue(label: "com.craftoon.canvas-recovery")
  private var document: [String: Any]?
  private var timer: Timer?
  private var observers: [NSObjectProtocol] = []
  // Accessed only on the storage queue. Never overwrite an unreadable recovery
  // file until a separate copy has been preserved for possible recovery.
  private var preserveUnreadableDraft = false

  private init() {
    for name in [UIApplication.willResignActiveNotification,
                 UIApplication.didEnterBackgroundNotification,
                 UIApplication.willTerminateNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        self?.flushSynchronously()
      })
    }
  }

  private func fileURL() throws -> URL {
    let root = try FileManager.default.url(for: .applicationSupportDirectory,
      in: .userDomainMask, appropriateFor: nil, create: true)
    let folder = root.appendingPathComponent("CraftoonRecovery", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder.appendingPathComponent("current.json")
  }

  private func snapshot() -> [String: Any]? {
    guard var snapshot = document, var pages = snapshot["pages"] as? [[String: Any]] else { return nil }
    for pageIndex in pages.indices {
      var panels = pages[pageIndex]["panels"] as? [[String: Any]] ?? []
      for panelIndex in panels.indices {
        if let id = panels[panelIndex]["id"] as? String,
           let drawing = RNPencilKitView.drawingCache[id] {
          panels[panelIndex]["drawingData"] = drawing.dataRepresentation().base64EncodedString()
        }
      }
      pages[pageIndex]["panels"] = panels
    }
    snapshot["pages"] = pages
    snapshot["updatedAt"] = ISO8601DateFormatter().string(from: Date())
    document = snapshot
    return snapshot
  }

  private func write(_ snapshot: [String: Any]) throws {
    let url = try fileURL()
    if preserveUnreadableDraft && FileManager.default.fileExists(atPath: url.path) {
      let backup = url.deletingLastPathComponent().appendingPathComponent("unreadable-\(UUID().uuidString).json")
      try FileManager.default.copyItem(at: url, to: backup)
      preserveUnreadableDraft = false
    }
    try encodeComicDocument(snapshot).write(to: url, options: .atomic)
  }

  func update(_ document: [String: Any], completion: @escaping (Result<Void, Error>) -> Void) {
    self.document = document
    flush(completion: completion)
  }

  func markSaved(id: String, title: String) {
    guard document?["id"] as? String == id else { return }
    document?["isSaved"] = true
    document?["title"] = title
    flush()
  }

  func scheduleSave() {
    guard document != nil, timer == nil else { return }
    // Throttle, rather than debounce: even a long uninterrupted stroke gets
    // periodic checkpoints. A completed stroke is flushed immediately below.
    let next = Timer(timeInterval: 0.5, repeats: false) { [weak self] _ in self?.flush() }
    timer = next
    RunLoop.main.add(next, forMode: .common)
  }

  func flush(completion: ((Result<Void, Error>) -> Void)? = nil) {
    timer?.invalidate()
    timer = nil
    guard let snapshot = snapshot() else { completion?(.success(())); return }
    queue.async {
      do { try self.write(snapshot); completion?(.success(())) }
      catch {
        NSLog("Canvas recovery save failed: %@", error.localizedDescription)
        completion?(.failure(error))
      }
    }
  }

  private func flushSynchronously() {
    timer?.invalidate()
    timer = nil
    guard let snapshot = snapshot() else { return }
    // Finish the latest checkpoint before iOS suspends the process. Do not rely
    // on a JavaScript background event or on receiving a termination callback.
    queue.sync {
      do { try self.write(snapshot) }
      catch { NSLog("Canvas recovery checkpoint failed: %@", error.localizedDescription) }
    }
  }

  func load(completion: @escaping (Result<[String: Any]?, Error>) -> Void) {
    queue.async {
      do {
        let url = try self.fileURL()
        guard FileManager.default.fileExists(atPath: url.path) else { completion(.success(nil)); return }
        let data = try Data(contentsOf: url)
        let document = try decodeComicDocument(data)
        guard document["id"] is String,
              let pages = document["pages"] as? [[String: Any]], !pages.isEmpty else {
          throw NSError(domain: "CraftoonRecovery", code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Invalid canvas recovery file."])
        }
        completion(.success(document))
      } catch {
        self.preserveUnreadableDraft = true
        completion(.failure(error))
      }
    }
  }
}

private final class CanvasRotationController: UIViewController {
  private let mask: UIInterfaceOrientationMask
  init(mask: UIInterfaceOrientationMask) { self.mask = mask; super.init(nibName: nil, bundle: nil); modalPresentationStyle = .fullScreen }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { mask }
  override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
    if mask == .portrait { return .portrait }
    if mask == .portraitUpsideDown { return .portraitUpsideDown }
    return mask == .landscapeLeft ? .landscapeLeft : .landscapeRight
  }
  override func loadView() { view = UIView(); view.backgroundColor = .clear }
}
