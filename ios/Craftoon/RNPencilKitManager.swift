import Foundation
import React
import PencilKit
import UIKit

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
class CraftoonLibrary: NSObject {
  private let storageQueue = DispatchQueue(label: "com.craftoon.library")

  @objc static func requiresMainQueueSetup() -> Bool { false }

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
    guard let image = pageImage(page, thumbnail: true), let data = image.pngData() else { return nil }
    return "data:image/png;base64," + data.base64EncodedString()
  }

  func pageImage(_ page: [String: Any], thumbnail: Bool = false) -> UIImage? {
    let panels = page["panels"] as? [[String: Any]] ?? []
    let bubbles = page["bubbles"] as? [[String: Any]] ?? []
    let canvas = page["canvasSize"] as? [String: Any] ?? [:]
    let contentWidth = (panels + bubbles).map { number($0, "x") + number($0, "width") + 12 }.max() ?? 0
    let contentHeight = (panels + bubbles).map { number($0, "y") + number($0, "height") + 12 }.max() ?? 0
    let pageWidth = max(number(canvas, "width", 900), contentWidth, 1)
    let pageHeight = max(number(canvas, "height", 1200), contentHeight, 1)
    let size = thumbnail ? CGSize(width: 160, height: 200) : CGSize(width: pageWidth, height: pageHeight)
    let scale = min(size.width / pageWidth, size.height / pageHeight)
    let format = UIGraphicsImageRendererFormat()
    format.scale = thumbnail ? 2 : min(2, 2400 / max(pageWidth, pageHeight))
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let image = renderer.image { output in
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
    return image
  }

  @objc func printStory(_ story: NSDictionary,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
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
      // A single multipage document enables AirPrint's page selection controls.
      // Image arrays (printingItems) suppress the page-range option.
      let pdfRenderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 612, height: 792))
      let document = pdfRenderer.pdfData { context in
        for image in images {
          let bounds = CGRect(x: 0, y: 0, width: 612,
                              height: 612 * image.size.height / image.size.width)
          context.beginPage(withBounds: bounds, pageInfo: [:])
          image.draw(in: bounds)
        }
      }
      let printer = UIPrintInteractionController.shared
      let info = UIPrintInfo(dictionary: nil)
      info.jobName = story["title"] as? String ?? "Comic"
      info.outputType = .general
      printer.printInfo = info
      printer.printingItem = document
      printer.showsPageRange = true
      printer.present(from: CGRect(x: window.bounds.width - 64, y: window.safeAreaInsets.top + 56,
                                  width: 44, height: 1), in: window, animated: true) { _, completed, error in
        if let error = error { reject("PRINT_FAILED", "Could not print the comic.", error) }
        else { resolve(completed) }
      }
    }
  }

  private func summary(_ story: [String: Any]) -> [String: Any] {
    var result: [String: Any] = ["id": story["id"] ?? "", "title": story["title"] ?? "Untitled comic",
            "updatedAt": story["updatedAt"] ?? "",
            "pageCount": (story["pages"] as? [[String: Any]])?.count ?? 0]
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
    DispatchQueue.main.async {
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
      let document = snapshot
      self.storageQueue.async {
        do {
          var savedDocument = document
          savedDocument["thumbnailData"] = self.thumbnail(document)
          let data = try JSONSerialization.data(withJSONObject: savedDocument)
          try data.write(to: self.storyURL(id), options: .atomic)
          resolve(self.summary(savedDocument))
        } catch { reject("SAVE_FAILED", "Could not save this comic.", error) }
      }
    }
  }

  @objc func listStories(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    storageQueue.async {
      do {
        let urls = try FileManager.default.contentsOfDirectory(at: self.directory(),
          includingPropertiesForKeys: nil).filter { $0.pathExtension == "json" }
        let stories = urls.compactMap { url -> [String: Any]? in
          guard let data = try? Data(contentsOf: url),
                var story = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                story["id"] is String, story["pages"] is [[String: Any]] else { return nil }
          // Backfill thumbnails for comics saved before previews were introduced.
          if story["thumbnailData"] == nil {
            story["thumbnailData"] = self.thumbnail(story)
            if let updated = try? JSONSerialization.data(withJSONObject: story) {
              try? updated.write(to: url, options: .atomic)
            }
          }
          return self.summary(story)
        }.sorted { ($0["updatedAt"] as? String ?? "") > ($1["updatedAt"] as? String ?? "") }
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
        guard let story = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = story["id"] as? String else {
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
        guard let story = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let pages = story["pages"] as? [[String: Any]], !pages.isEmpty else {
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
  init(index: Int, image: UIImage?) {
    self.index = index
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
    showPage(animated: true)
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
    book.view.frame = bounds.insetBy(dx: 20, dy: 20)
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
      onPageChange?(["pageIndex": current.index])
    }
  }
}
