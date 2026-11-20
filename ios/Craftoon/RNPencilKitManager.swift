import Foundation
import React
import PencilKit
import UIKit
import MessageUI
import UniformTypeIdentifiers
import ImageIO
import CryptoKit
import Photos

@objc(RNPencilKitManager)
class RNPencilKitManager: RCTViewManager {
  
  override func view() -> UIView! {
    return RNPencilKitView()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

// Shared by the live clipping surface and saved/read/export rendering.
enum CraftoonPanelShape {
  static func points(_ value: Any?) -> [CGPoint] {
    let rectangle = [CGPoint(x: 0, y: 0), CGPoint(x: 1, y: 0), CGPoint(x: 1, y: 1), CGPoint(x: 0, y: 1)]
    guard let raw = value as? [[String: Any]], raw.count == 4 else { return rectangle }
    var points: [CGPoint] = []
    for item in raw {
      guard let x = item["x"] as? NSNumber, let y = item["y"] as? NSNumber,
            x.doubleValue.isFinite, y.doubleValue.isFinite,
            (-0.000001...1.000001).contains(x.doubleValue), (-0.000001...1.000001).contains(y.doubleValue) else { return rectangle }
      points.append(CGPoint(x: max(0, min(1, x.doubleValue)), y: max(0, min(1, y.doubleValue))))
    }
    for i in 0..<4 {
      let a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4]
      if (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) <= 0.002 { return rectangle }
    }
    return points
  }

  static func isRectangle(_ points: [CGPoint]) -> Bool {
    points == [CGPoint(x: 0, y: 0), CGPoint(x: 1, y: 0), CGPoint(x: 1, y: 1), CGPoint(x: 0, y: 1)]
  }

  static func path(_ points: [CGPoint], in rect: CGRect) -> UIBezierPath {
    let path = UIBezierPath()
    for (i, point) in points.enumerated() {
      let p = CGPoint(x: rect.minX + point.x * rect.width, y: rect.minY + point.y * rect.height)
      if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
    }
    path.close()
    return path
  }
}

@objc(CraftoonPanelClipManager)
class CraftoonPanelClipManager: RCTViewManager {
  override func view() -> UIView! { CraftoonPanelClipView() }
  override static func requiresMainQueueSetup() -> Bool { true }
}

class CraftoonPanelClipView: RCTView {
  private let shapeMask = CAShapeLayer()
  private var maskedBounds: CGRect?
  private var maskedPoints: [CGPoint] = []
  private var maskedContent: Bool?
  @objc var clipContent: Bool = true { didSet { if clipContent != oldValue { setNeedsLayout() } } }
  @objc var polygonPoints: NSArray = [] { didSet { setNeedsLayout() } }

  override init(frame: CGRect) {
    super.init(frame: frame)
    shapeMask.fillColor = UIColor.black.cgColor
    clipsToBounds = true
    layer.mask = shapeMask
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func layoutSubviews() {
    super.layoutSubviews()
    let points = CraftoonPanelShape.points(polygonPoints)
    guard maskedBounds != bounds || maskedPoints != points || maskedContent != clipContent else { return }
    maskedBounds = bounds
    maskedPoints = points
    maskedContent = clipContent
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if !clipContent || CraftoonPanelShape.isRectangle(points) {
      layer.mask = nil
    } else {
      shapeMask.frame = bounds
      shapeMask.path = CraftoonPanelShape.path(points, in: bounds).cgPath
      layer.mask = shapeMask
    }
    CATransaction.commit()
  }
  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    (super.point(inside: point, with: event) && CraftoonPanelShape.path(CraftoonPanelShape.points(polygonPoints), in: bounds).contains(point))
      || continuingStrokeView(for: event) != nil
  }
  private func continuingStrokeView(for event: UIEvent?) -> RNPencilKitView? {
    guard CraftoonStrokeContinuity.shouldContinue(active: true, event: event) else { return nil }
    func find(in view: UIView) -> RNPencilKitView? {
      if let ink = view as? RNPencilKitView, ink.continuesDrawingStroke(with: event) { return ink }
      for child in view.subviews { if let ink = find(in: child) { return ink } }
      return nil
    }
    return find(in: self)
  }
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }
    if let ink = continuingStrokeView(for: event) {
      return ink.hitTest(convert(point, to: ink), with: event)
    }
    // RCTView can hit-test children outside its own pointInside result.
    guard self.point(inside: point, with: event) else { return nil }
    return super.hitTest(point, with: event)
  }
}

// Store complete comics in Application Support, outside temporary/cache storage.
@objc(CraftoonLibrary)
class CraftoonLibrary: NSObject, MFMailComposeViewControllerDelegate {
  private var tracingPicker: CraftoonTracingImagePicker?
  private var mailCompletion: ((Bool, Error?) -> Void)?
  private let storageQueue = CraftoonInkStore.queue
  private let storageRoot: URL?

  override init() {
    storageRoot = nil
    super.init()
  }

  init(storageRoot: URL) {
    self.storageRoot = storageRoot
    super.init()
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func pickTracingImage(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.tracingPicker == nil, let presenter = RCTPresentedViewController() else {
        reject("IMAGE_PICKER_BUSY", "Please close the current image picker and try again.", nil)
        return
      }
      let picker = CraftoonTracingImagePicker { result in
        self.tracingPicker = nil
        switch result {
        case .success(let image): resolve(image)
        case .failure(let error): reject("IMAGE_IMPORT_FAILED", error.localizedDescription, error)
        }
      }
      self.tracingPicker = picker
      picker.present(from: presenter)
    }
  }

  @objc func retainInkReferences(_ references: NSArray,
                                  resolver resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      CraftoonInkStore.retain(references.compactMap { $0 as? String })
      resolve(nil)
    }
  }

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
        reject("PRO_REQUIRED", "Craftoon Pro is required for exporting comics.", nil)
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
    let previousMask = CraftoonOrientationState.mask
    CraftoonOrientationState.mask = mask
    // Modern iPadOS otherwise rotates the window presentation even when the
    // scene's paper orientation stays fixed. Unlock before changing formats;
    // re-lock once the requested interface orientation has actually arrived.
    CraftoonOrientationState.updateLockPreference(on: root)
    // Splash/Library already follow the device. Do not restart an automatic
    // rotation on initial layout or foregrounding. An explicit geometry
    // request is only needed when leaving a previously locked page.
    if orientation == "automatic", previousMask == .all {
      if #available(iOS 16.0, *) { root.setNeedsUpdateOfSupportedInterfaceOrientations() }
      resolve(nil)
      return
    }
    if orientation != "automatic", currentMask == mask {
      if #available(iOS 16.0, *) {
        UIView.performWithoutAnimation { root.setNeedsUpdateOfSupportedInterfaceOrientations() }
      }
      resolve(nil)
      return
    }
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
      CraftoonOrientationState.updateLockPreference(on: root)
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
      let updateGeometry = {
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
      }
      if orientation == "automatic" { updateGeometry() }
      else { UIView.performWithoutAnimation(updateGeometry) }
    } else {
      // iOS 15: a public presentation API applies the preferred orientation.
      let rotation = CanvasRotationController(mask: requestedMask == .all ? .portrait : requestedMask)
      root.present(rotation, animated: false) { rotation.dismiss(animated: false) }
    }
  }

  private func directory() throws -> URL {
    let root = try storageRoot ?? FileManager.default.url(for: .applicationSupportDirectory,
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

  func pageImage(_ page: [String: Any], thumbnail: Bool = false, maxPixels: CGFloat = 2400, useLiveInk: Bool = false) -> UIImage? {
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
          context.saveGState()
          let border = max(0, number(panel, "borderWidth", 2))
          let points = CraftoonPanelShape.points(panel["corners"])
          let outline = CraftoonPanelShape.path(points, in: rect.insetBy(dx: border / 2, dy: border / 2))
          UIColor.white.setFill()
          outline.fill()
          let content = rect.insetBy(dx: border, dy: border)
          if content.width > 0, content.height > 0,
             let drawing = (useLiveInk ? RNPencilKitView.drawingCache[panel["id"] as? String ?? ""] : nil)
               ?? CraftoonInkStore.drawing(panel["drawingData"] as? String ?? "") {
            context.saveGState()
            CraftoonPanelShape.path(points, in: content).addClip()
            let ink = drawing.image(from: CGRect(origin: .zero, size: content.size), scale: max(0.05, scale * format.scale))
            ink.draw(in: content)
            context.restoreGState()
          }
          color(panel["borderColor"], fallback: UIColor.darkGray).setStroke()
          outline.lineWidth = border
          switch panel["borderStyle"] as? String ?? "solid" {
          case "dashed": outline.setLineDash([8, 6], count: 2, phase: 0)
          case "dotted":
            outline.lineCapStyle = .round
            outline.setLineDash([0.1, 6], count: 2, phase: 0)
          default: break
          }
          if border > 0 && panel["borderStyle"] as? String != "none" { outline.stroke() }
          context.restoreGState()
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
          let baseFont = UIFont.systemFont(ofSize: number(bubble, "fontSize", 14), weight: .bold)
          let roundedFont = baseFont.fontDescriptor.withDesign(.rounded)
            .map { UIFont(descriptor: $0, size: baseFont.pointSize) } ?? baseFont
          let attributes: [NSAttributedString.Key: Any] = [
            .font: roundedFont,
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
      let images = pages.compactMap { self.pageImage($0, useLiveInk: true) }
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
      let capture = CraftoonInkStore.capture(pages)
      CraftoonInkStore.queue.async {
        do {
          try CraftoonInkStore.persist(capture.drawings)
          let pages = CraftoonInkStore.resolvingStrokePresence(capture.pages)
          DispatchQueue.main.async { resolve(pages) }
        } catch { reject("CAPTURE_FAILED", "Could not preserve the current canvas.", error) }
      }
    }
  }

  private func restoreDrawingCache(_ pages: [[String: Any]]) {
    CraftoonInkStore.reset(pages)
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

  // Called only on the serial storage queue: two concurrent new saves (or an
  // Undo restore racing with Save) cannot both consume the single Free slot.
  private func validateSaveAccess(id: String, pageCount: Int?, isPro: Bool) throws {
    guard !isPro else { return }
    if let pageCount, pageCount > 4 {
      throw NSError(domain: "CraftoonAccess", code: 1, userInfo: [NSLocalizedDescriptionKey:
        "Free includes 4 pages per comic. Unlock Pro to save more pages."])
    }
    let destination = try storyURL(id)
    if FileManager.default.fileExists(atPath: destination.path) { return }
    let files = try FileManager.default.contentsOfDirectory(at: directory(), includingPropertiesForKeys: nil)
    let occupied = files.contains { url in
      guard url.pathExtension == "json", let data = try? Data(contentsOf: url),
            let saved = try? decodeComicDocument(data), saved["id"] is String,
            saved["pages"] is [[String: Any]] else { return false }
      return true
    }
    if occupied {
      throw NSError(domain: "CraftoonAccess", code: 2, userInfo: [NSLocalizedDescriptionKey:
        "Free includes 1 saved comic. Unlock Pro to save more."])
    }
  }

  @objc func saveStory(_ story: NSDictionary,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      let isPro = await CraftoonPurchaseStore.shared.hasProAccess()
      DispatchQueue.main.async {
        // Capture current native ink, then validate capacity and write atomically
        // on the same queue. Existing Free files remain editable and autosaved.
        var snapshot = story as? [String: Any] ?? [:]
        guard let id = snapshot["id"] as? String,
              var pages = snapshot["pages"] as? [[String: Any]], !pages.isEmpty else {
          reject("SAVE_FAILED", "The comic has no pages.", nil)
          return
        }
        let capture = CraftoonInkStore.capture(pages)
        pages = capture.pages
        snapshot["pages"] = pages
        snapshot["version"] = 1
        snapshot["storageVersion"] = 4
        let document = snapshot
        let pageCount = pages.count
        self.storageQueue.async {
          do {
            try self.validateSaveAccess(id: id, pageCount: pageCount, isPro: isPro)
            try CraftoonInkStore.persist(capture.drawings)
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
          } catch {
            let limited = (error as NSError).domain == "CraftoonAccess"
            reject(limited ? "PRO_REQUIRED" : "SAVE_FAILED",
              limited ? error.localizedDescription : "Could not save this comic.", error)
          }
        }
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
    Task {
      let isPro = await CraftoonPurchaseStore.shared.hasProAccess()
      self.storageQueue.async {
        do {
          guard UUID(uuidString: token) != nil else {
            throw NSError(domain: "CraftoonLibrary", code: 3,
              userInfo: [NSLocalizedDescriptionKey: "Invalid recovery token."])
          }
          let source = try self.trashDirectory().appendingPathComponent(token).appendingPathExtension("json")
          let data = try Data(contentsOf: source)
          var story = try decodeComicDocument(data)
          guard let id = story["id"] as? String else {
            throw NSError(domain: "CraftoonLibrary", code: 4,
              userInfo: [NSLocalizedDescriptionKey: "This comic file is invalid."])
          }
          // Undo must respect file capacity, while preserving older long comics.
          try self.validateSaveAccess(id: id, pageCount: nil, isPro: isPro)
          if (story["createdAt"] as? String ?? "").isEmpty {
            story["createdAt"] = self.creationTimestamp(story, at: source)
            try encodeComicDocument(story).write(to: source, options: .atomic)
          }
          try FileManager.default.moveItem(at: source, to: self.storyURL(id))
          resolve(self.summary(story))
        } catch {
          let limited = (error as NSError).domain == "CraftoonAccess"
          reject(limited ? "PRO_REQUIRED" : "RESTORE_FAILED",
            limited ? error.localizedDescription : "Could not restore this comic.", error)
        }
      }
    }
  }

  @objc func loadStory(_ id: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    storageQueue.async {
      do {
        let data = try Data(contentsOf: self.storyURL(id))
        let story = try CraftoonInkStore.compact(decodeComicDocument(data))
        guard let pages = story["pages"] as? [[String: Any]], !pages.isEmpty else {
          throw NSError(domain: "CraftoonLibrary", code: 2,
            userInfo: [NSLocalizedDescriptionKey: "This comic file is invalid."])
        }
        DispatchQueue.main.async {
          // Library previews must not replace the open draft's native state.
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
    return ComicBookPage(index: index, image: renderer.pageImage(content, useLiveInk: true))
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
  try CraftoonInkStore.validate(story)
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
  private let queue = CraftoonInkStore.queue
  private var document: [String: Any]?
  private var timer: Timer?
  private var observers: [NSObjectProtocol] = []
  // Accessed only on the storage queue. Never overwrite an unreadable recovery
  // file until a separate copy has been preserved for possible recovery.
  private var preserveUnreadableDraft = false
  private let storageURL: URL?
  private(set) var completedWrites = 0

  init(storageURL: URL? = nil, observeLifecycle: Bool = true) {
    self.storageURL = storageURL
    guard observeLifecycle else { return }
    CraftoonInkStore.collectOldRevisions()
    for name in [UIApplication.willResignActiveNotification,
                 UIApplication.didEnterBackgroundNotification,
                 UIApplication.willTerminateNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        if name == UIApplication.willTerminateNotification { self?.flushSynchronously() }
        else { self?.flushInBackground() }
      })
    }
  }

  private func fileURL() throws -> URL {
    if let storageURL { return storageURL }
    let root = try FileManager.default.url(for: .applicationSupportDirectory,
      in: .userDomainMask, appropriateFor: nil, create: true)
    let folder = root.appendingPathComponent("CraftoonRecovery", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder.appendingPathComponent("current.json")
  }

  private var writing = false
  private var saveAgain = false
  private var completions: [(Result<Void, Error>) -> Void] = []

  private func snapshot() -> (document: [String: Any], drawings: [(String, PKDrawing)])? {
    guard var snapshot = document, let pages = snapshot["pages"] as? [[String: Any]] else { return nil }
    let capture = CraftoonInkStore.capture(pages)
    snapshot["pages"] = capture.pages
    snapshot["updatedAt"] = ISO8601DateFormatter().string(from: Date())
    document = snapshot
    return (snapshot, capture.drawings)
  }

  private func write(_ snapshot: [String: Any]) throws {
    let url = try fileURL()
    if preserveUnreadableDraft && FileManager.default.fileExists(atPath: url.path) {
      let backup = url.deletingLastPathComponent().appendingPathComponent("unreadable-\(UUID().uuidString).json")
      try FileManager.default.copyItem(at: url, to: backup)
      preserveUnreadableDraft = false
    }
    try encodeComicDocument(snapshot).write(to: url, options: .atomic)
    completedWrites += 1
  }

  func update(_ document: [String: Any], completion: @escaping (Result<Void, Error>) -> Void) {
    self.document = document
    CraftoonInkStore.reconcile(document["pages"] as? [[String: Any]] ?? [])
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
    if let completion { completions.append(completion) }
    guard !writing else { saveAgain = true; return }
    guard let captured = snapshot() else {
      let callbacks = completions; completions.removeAll()
      callbacks.forEach { $0(.success(())) }; return
    }
    writing = true
    saveAgain = false
    let callbacks = completions; completions.removeAll()
    queue.async {
      let result: Result<Void, Error> = Result {
        try CraftoonInkStore.persist(captured.drawings)
        try self.write(captured.document)
      }
      DispatchQueue.main.async {
        self.writing = false
        callbacks.forEach { $0(result) }
        if case .failure(let error) = result { NSLog("Canvas recovery failed: %@", error.localizedDescription) }
        if self.saveAgain { self.flush() }
      }
    }
  }

  private func flushSynchronously() {
    timer?.invalidate()
    timer = nil
    guard let captured = snapshot() else { return }
    queue.sync {
      do {
        try CraftoonInkStore.persist(captured.drawings)
        try self.write(captured.document)
      } catch { NSLog("Canvas recovery checkpoint failed: %@", error.localizedDescription) }
    }
  }

  private func flushInBackground() {
    var task = UIBackgroundTaskIdentifier.invalid
    task = UIApplication.shared.beginBackgroundTask(withName: "Protect canvas") {
      if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid }
    }
    flush { _ in
      if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid }
    }
  }

  func load(completion: @escaping (Result<[String: Any]?, Error>) -> Void) {
    queue.async {
      do {
        let url = try self.fileURL()
        guard FileManager.default.fileExists(atPath: url.path) else { completion(.success(nil)); return }
        let data = try Data(contentsOf: url)
        let document = try CraftoonInkStore.compact(decodeComicDocument(data))
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

// System pickers provide selected images without broad photo-library access.
// Embed a bounded, orientation-correct copy in the document; picker URLs expire.
private final class CraftoonTracingImagePicker: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate, UIDocumentPickerDelegate, UIPopoverPresentationControllerDelegate {
  typealias Imported = [String: Any]
  private var completion: ((Result<Imported?, Error>) -> Void)?
  init(completion: @escaping (Result<Imported?, Error>) -> Void) { self.completion = completion }

  func present(from presenter: UIViewController) {
    let choice = UIAlertController(title: "Reference image", message: nil, preferredStyle: .alert)
    choice.addAction(UIAlertAction(title: "Photos", style: .default) { [weak self, weak presenter] _ in
      guard let self, let presenter else { return }
      // Receive the selected UIImage directly. PHPicker's item-provider export
      // can fail on device before any JPEG/PNG bytes reach the app.
      let picker = UIImagePickerController()
      picker.sourceType = .photoLibrary
      picker.mediaTypes = [UTType.image.identifier]
      picker.allowsEditing = false
      picker.delegate = self
      if UIDevice.current.userInterfaceIdiom == .pad {
        picker.modalPresentationStyle = .popover
        picker.preferredContentSize = CGSize(width: 600, height: 650)
        picker.popoverPresentationController?.sourceView = presenter.view
        picker.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        picker.popoverPresentationController?.permittedArrowDirections = []
        picker.popoverPresentationController?.delegate = self
      }
      presenter.present(picker, animated: true)
    })
    choice.addAction(UIAlertAction(title: "Files", style: .default) { [weak self, weak presenter] _ in
      guard let self, let presenter else { return }
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image], asCopy: true)
      picker.allowsMultipleSelection = false
      picker.delegate = self
      presenter.present(picker, animated: true)
    })
    choice.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in self?.finish(.success(nil)) })
    presenter.present(choice, animated: true)
  }

  func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
    picker.dismiss(animated: true) { self.finish(.success(nil)) }
  }

  func popoverPresentationControllerDidDismissPopover(_ popoverPresentationController: UIPopoverPresentationController) {
    finish(.success(nil))
  }

  func imagePickerController(_ picker: UIImagePickerController,
                             didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
    CraftoonReferenceImageLoader.loadPickedImage(info) { [self] result in
      DispatchQueue.main.async {
        picker.dismiss(animated: true) { self.finish(result.map { Optional($0) }) }
      }
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(.success(nil)) }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else { finish(.success(nil)); return }
    DispatchQueue.global(qos: .userInitiated).async { [self] in
      let access = url.startAccessingSecurityScopedResource()
      defer { if access { url.stopAccessingSecurityScopedResource() } }
      do { finish(.success(try CraftoonReferenceImageLoader.readImage(url))) }
      catch { finish(.failure(error)) }
    }
  }

  private func finish(_ result: Result<Imported?, Error>) {
    if case .failure(let error) = result {
      let failure = error as NSError
      let report = "Image import failed: \(failure.domain) (\(failure.code))\n\(failure)\n"
      if let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
        try? report.write(to: cache.appendingPathComponent("CraftoonImageImportFailure.txt"), atomically: true, encoding: .utf8)
      }
    }
    DispatchQueue.main.async {
      let callback = self.completion
      self.completion = nil
      callback?(result)
    }
  }
}


// Normalize the UIImage supplied by Photos or decode a selected file's bytes.
enum CraftoonReferenceImageLoader {
  typealias Imported = [String: Any]
  static func loadPickedImage(_ info: [UIImagePickerController.InfoKey: Any],
                              completion: @escaping (Result<Imported, Error>) -> Void) {
    DispatchQueue.global(qos: .userInitiated).async {
      do { completion(.success(try readPickedImage(info))); return }
      catch {
        // Some devices return only an assets-library reference, without pixels
        // or a file URL. Read that selected asset through PhotoKit instead.
        guard info[.phAsset] is PHAsset || info[.referenceURL] is URL else {
          completion(.failure(error)); return
        }
      }
      DispatchQueue.main.async {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
          guard status == .authorized || status == .limited else {
            completion(.failure(NSError(domain: "CraftoonTracing", code: 7, userInfo: [
              NSLocalizedDescriptionKey: "Allow access to this photo in Settings, or import it using Files.",
            ]))); return
          }
          let asset = (info[.phAsset] as? PHAsset) ?? (info[.referenceURL] as? URL).flatMap {
            PHAsset.fetchAssets(withALAssetURLs: [$0], options: nil).firstObject
          }
          guard let asset else {
            completion(.failure(NSError(domain: "CraftoonTracing", code: 8, userInfo: [
              NSLocalizedDescriptionKey: "This photo is not included in the photos Craftoon can access. Allow access to it in Settings, or import it using Files.",
            ]))); return
          }
          let options = PHImageRequestOptions()
          options.version = .current
          options.deliveryMode = .highQualityFormat
          options.isNetworkAccessAllowed = true
          PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, response in
            if let error = response?[PHImageErrorKey] as? Error {
              completion(.failure(error)); return
            }
            guard let data else { completion(.failure(invalidImage(9))); return }
            do { completion(.success(try readData(data))) }
            catch { completion(.failure(error)) }
          }
        }
      }
    }
  }

  static func readPickedImage(_ info: [UIImagePickerController.InfoKey: Any]) throws -> Imported {
    let details = info.map { key, value -> String in
      var detail = "\(key.rawValue): \(type(of: value))"
      if let image = value as? UIImage {
        detail += " size=\(image.size) scale=\(image.scale) orientation=\(image.imageOrientation.rawValue) cgImage=\(image.cgImage != nil)"
      }
      if let url = value as? URL { detail += " exists=\(FileManager.default.fileExists(atPath: url.path))" }
      return detail
    }.sorted().joined(separator: "\n")
    if let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
      try? details.write(to: cache.appendingPathComponent("CraftoonImageImportTrace.txt"), atomically: true, encoding: .utf8)
    }
    if let image = info[.originalImage] as? UIImage { return try normalize(image) }
    if let url = info[.imageURL] as? URL { return try readImage(url) }
    throw invalidImage(2)
  }

  private static func invalidImage(_ code: Int = 1) -> Error {
    NSError(domain: "CraftoonTracing", code: code,
      userInfo: [NSLocalizedDescriptionKey: "This photo could not be loaded. Please try selecting it again."])
  }

  static func readImage(_ url: URL) throws -> Imported {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary)
    else { throw invalidImage(3) }
    return try readSource(source)
  }

  static func readData(_ data: Data) throws -> Imported {
    guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary)
    else { throw invalidImage(3) }
    return try readSource(source)
  }

  private static func readSource(_ source: CGImageSource) throws -> Imported {
    guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: 2048,
      kCGImageSourceShouldCacheImmediately: true,
    ] as CFDictionary) else { throw invalidImage(4) }
    return try encode(UIImage(cgImage: cg))
  }

  static func normalize(_ image: UIImage) throws -> Imported {
    let sideways = [.left, .leftMirrored, .right, .rightMirrored].contains(image.imageOrientation)
    let pixels = image.cgImage.map { CGSize(width: $0.width, height: $0.height) }
      ?? CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
    let oriented = sideways ? CGSize(width: pixels.height, height: pixels.width) : pixels
    let factor = min(1, 2048 / max(oriented.width, oriented.height, 1))
    let size = CGSize(width: max(1, (oriented.width * factor).rounded()), height: max(1, (oriented.height * factor).rounded()))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let normalized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    return try encode(normalized)
  }

  private static func encode(_ image: UIImage) throws -> Imported {
    let data: Data
    let mime: String
    if let png = image.pngData(), png.count <= 6_000_000 {
      data = png; mime = "image/png"
    } else {
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let flattened = UIGraphicsImageRenderer(size: image.size, format: format).image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: image.size))
        image.draw(at: .zero)
      }
      guard let jpeg = flattened.jpegData(compressionQuality: 0.88) else { throw invalidImage(5) }
      data = jpeg; mime = "image/jpeg"
    }
    var stored = try CraftoonReferenceImageStore.store(data, mime: mime)
    stored["width"] = Int(image.size.width)
    stored["height"] = Int(image.size.height)
    return stored
  }
}

// Immutable native ink files keep stroke payloads out of React state and undo
// history. Original Base64 documents remain readable. Archive writes run off-main.
struct CraftoonInkCapture {
  var pages: [[String: Any]]
  var drawings: [(String, PKDrawing)]
}

enum CraftoonInkStore {
  static let prefix = "craftoon-ink:"
  static let queue = DispatchQueue(label: "com.craftoon.ink", qos: .utility, autoreleaseFrequency: .workItem)
  // Main-thread state: latest references survive view/page changes, not drawings.
  static var latestReferences: [String: String] = [:]
  static var documentPanelIDs: Set<String>?

  static func reconcile(_ pages: [[String: Any]]) {
    let ids = Set(pages.flatMap { $0["panels"] as? [[String: Any]] ?? [] }.compactMap { $0["id"] as? String })
    documentPanelIDs = ids
    latestReferences = latestReferences.filter { ids.contains($0.key) }
    RNPencilKitView.drawingCache = RNPencilKitView.drawingCache.filter { ids.contains($0.key) }
  }
  private static let fileLock = NSLock()
  // This lock is never acquired by main-thread reference bookkeeping.
  private static let archiveLock = NSLock()
  private static var protectedReferences: [String: TimeInterval] = [:]
  private static var retainedReferences = Set<String>()
  private static var lastCollection = Date.distantPast

  // React supplies only the immutable references still reachable by Undo and
  // the current document. Short leases cover event/checkpoint races.
  static func retain(_ references: [String]) {
    let retained = Set(references.filter { $0.hasPrefix(prefix) })
      .union(latestReferences.values.filter { $0.hasPrefix(prefix) })
    fileLock.lock(); retainedReferences = retained; fileLock.unlock()
    if Date().timeIntervalSince(lastCollection) > 60 {
      lastCollection = Date()
      collectOldRevisions()
    }
  }

  private static func folder() throws -> URL {
    let root = try FileManager.default.url(for: .applicationSupportDirectory,
      in: .userDomainMask, appropriateFor: nil, create: true)
    let url = root.appendingPathComponent("CraftoonInk", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  private static func url(_ reference: String) throws -> URL {
    let id = String(reference.dropFirst(prefix.count))
    guard reference.hasPrefix(prefix), UUID(uuidString: id) != nil else {
      throw NSError(domain: "CraftoonInk", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid drawing reference."])
    }
    return try folder().appendingPathComponent(id).appendingPathExtension("drawing")
  }

  private static func protect(_ reference: String) {
    let now = Date().timeIntervalSince1970
    fileLock.lock()
    protectedReferences = protectedReferences.filter { $0.value > now }
    protectedReferences[reference] = now + 120
    fileLock.unlock()
  }

  static func data(_ value: String) throws -> Data {
    if value.hasPrefix(prefix) {
      protect(value)
      return try Data(contentsOf: url(value))
    }
    guard let data = Data(base64Encoded: value) else {
      throw NSError(domain: "CraftoonInk", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not read the drawing."])
    }
    return data
  }

  static func drawing(_ value: String) -> PKDrawing? {
    guard !value.isEmpty, let bytes = try? data(value) else { return nil }
    return try? PKDrawing(data: bytes)
  }

  // Called on main. Captures PKDrawing values without serializing any strokes.
  static func capture(_ source: [[String: Any]]) -> CraftoonInkCapture {
    let diagnosticStart = CraftoonPanelPerformance.paletteEnabled ? CraftoonPanelPerformance.now() : 0
    defer {
      if diagnosticStart > 0, CraftoonPanelPerformance.now() - diagnosticStart > 16 {
        CraftoonPanelPerformance.write(["stage": "ink_capture_slow", "durationMs": CraftoonPanelPerformance.now() - diagnosticStart])
      }
    }
    RNPencilKitView.prepareForCapture()
    var pages = source
    var drawings: [(String, PKDrawing)] = []
    for pageIndex in pages.indices {
      var panels = pages[pageIndex]["panels"] as? [[String: Any]] ?? []
      for index in panels.indices {
        guard let id = panels[index]["id"] as? String else { continue }
        if let drawing = RNPencilKitView.drawingCache[id] {
          panels[index]["drawingHasStrokes"] = !drawing.strokes.isEmpty
          let existing = latestReferences[id].flatMap { $0.hasPrefix(prefix) ? $0 : nil }
          let reference = existing ?? (prefix + UUID().uuidString)
          latestReferences[id] = reference
          protect(reference)
          panels[index]["drawingData"] = reference
          drawings.append((reference, drawing))
        } else if let reference = latestReferences[id] {
          if panels[index]["drawingData"] as? String != reference {
            panels[index].removeValue(forKey: "drawingHasStrokes")
          }
          panels[index]["drawingData"] = reference
        }
      }
      pages[pageIndex]["panels"] = panels
    }
    return CraftoonInkCapture(pages: pages, drawings: drawings)
  }

  // Run on the archive queue after persistence. Inactive panels may have only
  // an immutable file reference; a file can contain a completely empty drawing.
  static func resolvingStrokePresence(_ source: [[String: Any]]) -> [[String: Any]] {
    var pages = source
    for pageIndex in pages.indices {
      var panels = pages[pageIndex]["panels"] as? [[String: Any]] ?? []
      for index in panels.indices where panels[index]["drawingHasStrokes"] as? Bool == nil {
        let value = panels[index]["drawingData"] as? String ?? ""
        panels[index]["drawingHasStrokes"] = autoreleasepool {
          if value.isEmpty { return false }
          // Unknown/corrupt ink remains protected by the save confirmation.
          guard let drawing = drawing(value) else { return true }
          return !drawing.strokes.isEmpty
        }
      }
      pages[pageIndex]["panels"] = panels
    }
    return pages
  }

  static func persist(_ captures: [(String, PKDrawing)], archive: (PKDrawing) throws -> Data = { $0.dataRepresentation() }) throws {
    for (reference, drawing) in captures {
      // One archive per revision, even when recovery and Library both request it.
      archiveLock.lock()
      do {
        let destination = try url(reference)
        if !FileManager.default.fileExists(atPath: destination.path) {
          try autoreleasepool { try archive(drawing).write(to: destination, options: .atomic) }
        }
        archiveLock.unlock()
      } catch { archiveLock.unlock(); throw error }
    }
  }

  // Opening legacy documents migrates the ink only; the original file stays
  // untouched until a successful save. Failure never substitutes empty drawings.
  static func compact(_ document: [String: Any]) throws -> [String: Any] {
    var document = document
    var pages = document["pages"] as? [[String: Any]] ?? []
    for pageIndex in pages.indices {
      var panels = pages[pageIndex]["panels"] as? [[String: Any]] ?? []
      for index in panels.indices {
        guard let value = panels[index]["drawingData"] as? String, !value.isEmpty else { continue }
        if value.hasPrefix(prefix) { _ = try data(value); continue }
        let bytes = try data(value)
        let hash = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
        let id = "\(hash.prefix(8))-\(hash.dropFirst(8).prefix(4))-\(hash.dropFirst(12).prefix(4))-\(hash.dropFirst(16).prefix(4))-\(hash.dropFirst(20).prefix(12))"
        let reference = prefix + id
        protect(reference)
        if !FileManager.default.fileExists(atPath: try url(reference).path) {
          try persist([(reference, try PKDrawing(data: bytes))])
        }
        panels[index]["drawingData"] = reference
      }
      pages[pageIndex]["panels"] = panels
    }
    document["pages"] = pages
    document["storageVersion"] = 4
    return try CraftoonReferenceImageStore.compact(document)
  }

  static func validate(_ document: [String: Any]) throws {
    for page in document["pages"] as? [[String: Any]] ?? [] {
      for panel in page["panels"] as? [[String: Any]] ?? [] {
        if let value = panel["drawingData"] as? String, value.hasPrefix(prefix) {
          guard FileManager.default.fileExists(atPath: try url(value).path) else {
            throw NSError(domain: "CraftoonInk", code: 3, userInfo: [NSLocalizedDescriptionKey: "A drawing could not be preserved. The previous recovery file is unchanged."])
          }
        }
      }
    }
  }

  static func reset(_ pages: [[String: Any]]) {
    reconcile(pages)
    RNPencilKitView.drawingCache.removeAll()
    latestReferences.removeAll()
    for page in pages {
      for panel in page["panels"] as? [[String: Any]] ?? [] {
        if let id = panel["id"] as? String, let value = panel["drawingData"] as? String, !value.isEmpty {
          latestReferences[id] = value
        }
      }
    }
    RNPencilKitView.restoreVisibleDrawings(pages)
  }

  // Remove abandoned immutable revisions from previous sessions. Current session
  // references (including undo) are retained. If a document is unreadable, keep
  // every ink file rather than risk removing a recoverable drawing.
  static func collectOldRevisions(root: URL? = nil) {
    queue.async {
      do {
        let inkFolder: URL
        if let root { inkFolder = root.appendingPathComponent("CraftoonInk", isDirectory: true) }
        else { inkFolder = try folder() }
        let root = inkFolder.deletingLastPathComponent()
        var retained = Set<String>()
        for name in ["CraftoonLibrary", "CraftoonRecovery"] {
          let directory = root.appendingPathComponent(name)
          if let files = FileManager.default.enumerator(at: directory, includingPropertiesForKeys: nil) {
            for case let file as URL in files where file.pathExtension == "json" {
              let references: [String] = try autoreleasepool {
                let document = try decodeComicDocument(Data(contentsOf: file))
                return (document["pages"] as? [[String: Any]] ?? []).flatMap { page in
                  (page["panels"] as? [[String: Any]] ?? []).compactMap { panel in
                    guard let value = panel["drawingData"] as? String, value.hasPrefix(prefix) else { return nil }
                    return value
                  }
                }
              }
              retained.formUnion(references)
            }
          }
        }
        for file in try FileManager.default.contentsOfDirectory(at: inkFolder, includingPropertiesForKeys: [.contentModificationDateKey]) {
          guard file.pathExtension == "drawing", UUID(uuidString: file.deletingPathExtension().lastPathComponent) != nil else { continue }
          let reference = prefix + file.deletingPathExtension().lastPathComponent
          // Leave recent writes alone across app termination/recovery boundaries.
          let date = try file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? Date()
          guard Date().timeIntervalSince(date) > 120, !retained.contains(reference) else { continue }
          fileLock.lock()
          if !retainedReferences.contains(reference), (protectedReferences[reference] ?? 0) < Date().timeIntervalSince1970 {
            try? FileManager.default.removeItem(at: file)
            protectedReferences.removeValue(forKey: reference)
          }
          fileLock.unlock()
        }
      } catch { NSLog("Ink cleanup deferred: %@", error.localizedDescription) }
    }
  }
}

// Reference photos are immutable files, not multi-megabyte strings in every
// bridge update/checkpoint. imageRef survives app-container relocation; uri is
// resolved to the current container when a document opens.
enum CraftoonReferenceImageStore {
  private static func folder() throws -> URL {
    let root = try FileManager.default.url(for: .applicationSupportDirectory,
      in: .userDomainMask, appropriateFor: nil, create: true)
    let directory = root.appendingPathComponent("CraftoonReferenceImages", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  static func url(_ reference: String) throws -> URL {
    guard reference.range(of: "^[0-9a-f]{64}\\.(png|jpg)$", options: .regularExpression) != nil else {
      throw NSError(domain: "CraftoonImage", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid reference image."])
    }
    return try folder().appendingPathComponent(reference)
  }

  static func store(_ data: Data, mime: String) throws -> [String: Any] {
    let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    let reference = hash + (mime == "image/png" ? ".png" : ".jpg")
    let destination = try url(reference)
    if !FileManager.default.fileExists(atPath: destination.path) {
      try data.write(to: destination, options: .atomic)
    }
    return ["uri": destination.absoluteString, "imageRef": reference]
  }

  private static func compactImage(_ image: [String: Any]) throws -> [String: Any] {
    var image = image
    if let reference = image["imageRef"] as? String {
      let resolved = try url(reference)
      guard FileManager.default.fileExists(atPath: resolved.path) else {
        throw NSError(domain: "CraftoonImage", code: 2, userInfo: [NSLocalizedDescriptionKey: "A reference photo could not be found. The previous document is preserved."])
      }
      image["uri"] = resolved.absoluteString
    } else if let uri = image["uri"] as? String, uri.hasPrefix("data:image/") {
      let parts = uri.split(separator: ",", maxSplits: 1)
      guard parts.count == 2, parts[0].contains(";base64"), let data = Data(base64Encoded: String(parts[1])),
            CGImageSourceCreateWithData(data as CFData, nil) != nil else {
        throw NSError(domain: "CraftoonImage", code: 3, userInfo: [NSLocalizedDescriptionKey: "A reference photo could not be read. The previous document is preserved."])
      }
      let stored = try store(data, mime: parts[0].contains("image/png") ? "image/png" : "image/jpeg")
      image.merge(stored) { _, new in new }
    }
    return image
  }

  static func compact(_ source: [String: Any]) throws -> [String: Any] {
    var document = source
    var pages = document["pages"] as? [[String: Any]] ?? []
    for pageIndex in pages.indices {
      if let image = pages[pageIndex]["tracingImage"] as? [String: Any] {
        pages[pageIndex]["tracingImage"] = try compactImage(image)
      }
      var panels = pages[pageIndex]["panels"] as? [[String: Any]] ?? []
      for index in panels.indices {
        if let image = panels[index]["tracingImage"] as? [String: Any] {
          panels[index]["tracingImage"] = try compactImage(image)
        }
      }
      pages[pageIndex]["panels"] = panels
    }
    document["pages"] = pages
    return document
  }
}
