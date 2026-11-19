import UIKit
import PencilKit
import React
import UIKit.UIGestureRecognizerSubclass

// Explicitly opt in at launch; no profiler connection or per-stroke logging.
enum CraftoonPanelPerformance {
  static let paletteEnabled = ProcessInfo.processInfo.arguments.contains("--craftoon-measure-palette")
  static let enabled = paletteEnabled || ProcessInfo.processInfo.arguments.contains("--craftoon-measure-panels")
  private static let queue = DispatchQueue(label: "com.craftoon.panel-timing", qos: .utility)
  private static let session = UUID().uuidString
  static func now() -> Double { Date().timeIntervalSince1970 * 1000 }
  static func write(_ values: [String: Any]) {
    guard enabled else { return }
    var record = values
    record["session"] = session
    record["recordedAtMs"] = now()
    let event = record
    queue.async {
      do {
        let root = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let url = root.appendingPathComponent("CraftoonPanelPerformance.jsonl")
        var bytes = try JSONSerialization.data(withJSONObject: event, options: [.sortedKeys])
        bytes.append(10)
        if !FileManager.default.fileExists(atPath: url.path) { try bytes.write(to: url, options: .atomic); return }
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        if try handle.seekToEnd() > 5_000_000 { try handle.truncate(atOffset: 0); try handle.seek(toOffset: 0) }
        try handle.write(contentsOf: bytes)
      } catch { NSLog("Panel timing log failed: %@", error.localizedDescription) }
    }
  }
}

private enum CraftoonResponderSnapshot {
  static weak var responder: UIResponder?
}
private extension UIResponder {
  @objc func craftoonRecordFirstResponder(_ sender: Any?) { CraftoonResponderSnapshot.responder = self }
}

// Panel edges have horizontal tops/bottoms. Map a point's relative position
// between its two sloping sides into the new panel, keeping editable strokes.
enum CraftoonInkShapeWarp {
  static func point(_ p: CGPoint, from old: [CGPoint], to next: [CGPoint]) -> CGPoint {
    guard old.count == 4, next.count == 4 else { return p }
    let height = old[3].y - old[0].y
    guard abs(height) > 0.001 else { return p }
    let v = (p.y - old[0].y) / height
    let left = old[0].x + (old[3].x - old[0].x) * v
    let right = old[1].x + (old[2].x - old[1].x) * v
    guard abs(right - left) > 0.001 else { return p }
    let u = (p.x - left) / (right - left)
    let newLeft = next[0].x + (next[3].x - next[0].x) * v
    let newRight = next[1].x + (next[2].x - next[1].x) * v
    return CGPoint(x: newLeft + (newRight - newLeft) * u,
                   y: next[0].y + (next[3].y - next[0].y) * v)
  }

  static func drawing(_ drawing: PKDrawing, from old: [CGPoint], to next: [CGPoint]) -> PKDrawing {
    guard old != next, !drawing.strokes.isEmpty else { return drawing }
    let strokes = drawing.strokes.map { stroke -> PKStroke in
      let map: (CGPoint) -> CGPoint = { point($0.applying(stroke.transform), from: old, to: next) }
      let controlPoints = stroke.path.map { sample -> PKStrokePoint in
        let location = map(sample.location)
        let horizontal = map(CGPoint(x: sample.location.x + sample.size.width, y: sample.location.y))
        let vertical = map(CGPoint(x: sample.location.x, y: sample.location.y + sample.size.height))
        let size = CGSize(width: hypot(horizontal.x - location.x, horizontal.y - location.y),
                          height: hypot(vertical.x - location.x, vertical.y - location.y))
        if #available(iOS 17.0, *) {
          return PKStrokePoint(location: location, timeOffset: sample.timeOffset, size: size,
            opacity: sample.opacity, force: sample.force, azimuth: sample.azimuth, altitude: sample.altitude,
            secondaryScale: sample.secondaryScale)
        }
        return PKStrokePoint(location: location, timeOffset: sample.timeOffset, size: size,
          opacity: sample.opacity, force: sample.force, azimuth: sample.azimuth, altitude: sample.altitude)
      }
      let path = PKStrokePath(controlPoints: controlPoints, creationDate: stroke.path.creationDate)
      // Bitmap-eraser masks are pre-transform paths. Move them with the ink
      // so reshaping never brings back previously erased portions.
      let mask = stroke.mask.map { source -> UIBezierPath in
        let result = UIBezierPath()
        result.usesEvenOddFillRule = source.usesEvenOddFillRule
        source.cgPath.applyWithBlock { pointer in
          let element = pointer.pointee
          switch element.type {
          case .moveToPoint: result.move(to: map(element.points[0]))
          case .addLineToPoint: result.addLine(to: map(element.points[0]))
          case .addQuadCurveToPoint: result.addQuadCurve(to: map(element.points[1]), controlPoint: map(element.points[0]))
          case .addCurveToPoint: result.addCurve(to: map(element.points[2]), controlPoint1: map(element.points[0]), controlPoint2: map(element.points[1]))
          case .closeSubpath: result.close()
          @unknown default: break
          }
        }
        return result
      }
      if #available(iOS 16.0, *) {
        return PKStroke(ink: stroke.ink, path: path, transform: .identity, mask: mask, randomSeed: stroke.randomSeed)
      }
      return PKStroke(ink: stroke.ink, path: path, transform: .identity, mask: mask)
    }
    return PKDrawing(strokes: strokes)
  }
}

class RNPencilKitView: UIView, PKCanvasViewDelegate, PKToolPickerObserver {

  // Keep the latest native drawing when a panel unmounts during page navigation.
  static var drawingCache: [String: PKDrawing] = [:]
  private static let views = NSHashTable<RNPencilKitView>.weakObjects()
  private static let memoryObserver = NotificationCenter.default.addObserver(
    forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main
  ) { _ in
    for view in views.allObjects {
      view.liveCanvas?.undoManager?.levelsOfUndo = 5
      if !view.isDrawingActive { view.schedulePreview() }
    }
  }

  static func prepareForCapture() {
    for view in views.allObjects where view.window != nil && CraftoonInkStore.documentPanelIDs?.contains(view.panelId) != false {
      view.scaleInkIfNeeded()
    }
  }

  static func restoreVisibleDrawings(_ pages: [[String: Any]]? = nil) {
    for view in views.allObjects where CraftoonInkStore.documentPanelIDs?.contains(view.panelId) == true {
      view.liveCanvas?.undoManager?.removeAllActions()
      if let target = pages?.flatMap({ $0["panels"] as? [[String: Any]] ?? [] }).first(where: { $0["id"] as? String == view.panelId }),
         let x = target["x"] as? NSNumber, let width = target["width"] as? NSNumber, let height = target["height"] as? NSNumber {
        view.restoredShapeFrame = (x: CGFloat(truncating: x), width: CGFloat(truncating: width) - 4,
          height: CGFloat(truncating: height) - 4, revision: (target["shapeRevision"] as? NSNumber)?.intValue ?? 0, preview: false)
      }
      let value = CraftoonInkStore.latestReferences[view.panelId] ?? ""
      if view.liveCanvas == nil, !view.isDrawingActive {
        view.previewKey = nil
        view.inkSize = view.bounds.size
        view.schedulePreview()
      } else {
        view.applyDrawing(CraftoonInkStore.drawing(value) ?? PKDrawing(), reference: value.isEmpty ? nil : value)
      }
    }
  }

  private static var sharedToolPicker: PKToolPicker? = {
    if #available(iOS 14.0, *) {
      let picker = PKToolPicker()
      if #available(iOS 18.0, *) {
        picker.accessoryItem = nil
        for case let item as PKToolPickerInkingItem in picker.toolItems {
          item.allowsColorSelection = true
        }
      }
      picker.overrideUserInterfaceStyle = .light
      picker.colorUserInterfaceStyle = .light
      return picker
    }
    return nil
  }()
  private weak var paletteCanvas: PKCanvasView?
  private var registeredToolPicker: PKToolPicker?
  private static var lastPaletteState: Data?
  private static let paletteDiagnosticsStarted: Void = {
    guard CraftoonPanelPerformance.paletteEnabled else { return }
    CraftoonPanelPerformance.write(["stage": "palette_diagnostics_started"])
    schedulePaletteProbe()
  }()

  private static func schedulePaletteProbe() {
    // Only one probe can be outstanding. A busy main thread cannot build a
    // backlog of diagnostics, and no profiler or input recognizer is attached.
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 0.25) {
      let start = CraftoonPanelPerformance.now()
      DispatchQueue.main.async {
        reportPaletteState("palette_state", lag: CraftoonPanelPerformance.now() - start)
        schedulePaletteProbe()
      }
    }
  }

  private static func reportPaletteState(_ stage: String, lag: Double = 0) {
    guard CraftoonPanelPerformance.paletteEnabled else { return }
    CraftoonResponderSnapshot.responder = nil
    UIApplication.shared.sendAction(#selector(UIResponder.craftoonRecordFirstResponder(_:)), to: nil, from: nil, for: nil)
    let active = views.allObjects.filter { $0.isDrawingActive && $0.window != nil }
    var values: [String: Any] = [
      "appState": UIApplication.shared.applicationState.rawValue,
      "firstResponderClass": CraftoonResponderSnapshot.responder.map { String(describing: type(of: $0)) } ?? "none",
      "paletteVisible": active.first?.registeredToolPicker?.isVisible ?? false,
      "activeCanvases": active.map { view -> [String: Any] in
        ["panel": view.panelId, "registered": view.paletteCanvas != nil,
         "canvasFirstResponder": view.liveCanvas?.isFirstResponder ?? false,
         "canvasInteractive": view.liveCanvas?.isUserInteractionEnabled ?? false]
      }.sorted { ($0["panel"] as? String ?? "") < ($1["panel"] as? String ?? "") },
    ]
    let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
    values["presentations"] = windows.compactMap { window -> [String: Any]? in
      guard !window.isHidden, var controller = window.rootViewController else { return nil }
      while let next = controller.presentedViewController { controller = next }
      return ["class": String(describing: type(of: controller)), "keyWindow": window.isKeyWindow,
              "presenting": controller.isBeingPresented, "dismissing": controller.isBeingDismissed,
              "transition": controller.transitionCoordinator != nil]
    }
    let signature = try? JSONSerialization.data(withJSONObject: values, options: [.sortedKeys])
    guard stage != "palette_state" || signature != lastPaletteState || lag > 100 else { return }
    lastPaletteState = signature
    values["stage"] = stage
    values["mainQueueDelayMs"] = lag
    CraftoonPanelPerformance.write(values)
  }

  func toolPickerVisibilityDidChange(_ toolPicker: PKToolPicker) { Self.reportPaletteState("palette_visibility") }
  func toolPickerFramesObscuredDidChange(_ toolPicker: PKToolPicker) { Self.reportPaletteState("palette_frame") }
  func toolPickerSelectedToolDidChange(_ toolPicker: PKToolPicker) { Self.reportPaletteState("palette_tool") }

  private func attachToolPicker(to canvas: PKCanvasView) {
    // A color/width popover may temporarily own first responder. That does
    // not mean this drawing canvas needs to register again or reclaim focus.
    guard paletteCanvas !== canvas else { return }
    if let previous = paletteCanvas { detachToolPicker(from: previous) }
    let picker: PKToolPicker?
    if #available(iOS 19.0, *) {
      picker = Self.sharedToolPicker
    } else if #available(iOS 18.0, *), let window = canvas.window {
      // iPadOS 18 compatibility: associate the native palette with the actual
      // drawing window. Keep newer systems on the current initializer.
      picker = PKToolPicker.shared(for: window) ?? Self.sharedToolPicker
      picker?.overrideUserInterfaceStyle = .light
      picker?.colorUserInterfaceStyle = .light
      picker?.accessoryItem = nil
      if let picker {
        for case let item as PKToolPickerInkingItem in picker.toolItems {
          item.allowsColorSelection = true
        }
      }
    } else {
      picker = Self.sharedToolPicker
    }
    paletteCanvas = canvas
    registeredToolPicker = picker
    picker?.addObserver(canvas)
    if CraftoonPanelPerformance.paletteEnabled { picker?.addObserver(self) }
    if drawingTool == "pen", let selected = picker?.selectedTool { canvas.tool = selected }
    picker?.setVisible(true, forFirstResponder: canvas)
    canvas.becomeFirstResponder()
    Self.reportPaletteState("palette_attach")
  }

  private func detachToolPicker(from canvas: PKCanvasView) {
    guard paletteCanvas === canvas else { return }
    let picker = registeredToolPicker
    paletteCanvas = nil
    registeredToolPicker = nil
    picker?.removeObserver(canvas)
    if CraftoonPanelPerformance.paletteEnabled { picker?.removeObserver(self) }
    // Unregister even while a popover owns focus. setVisible(false) removes
    // this responder's subscription; it does not unregister another panel.
    picker?.setVisible(false, forFirstResponder: canvas)
    if canvas.isFirstResponder { canvas.resignFirstResponder() }
    Self.reportPaletteState("palette_detach")
  }

  @objc var selectionTimestamp: Double = 0 { didSet {
    if CraftoonPanelPerformance.enabled, selectionTimestamp != oldValue, isDrawingActive { reportPanelTiming("selection_received") }
  } }
  private var activationStartedMs: Double = 0
  private var nativeReadyMs: Double = 0
  private var firstRenderMs: Double = 0
  private var activationMeasurements: [String: Any] = [:]
  private func reportPanelTiming(_ stage: String) {
    guard CraftoonPanelPerformance.enabled, activationStartedMs > 0 else { return }
    var values = activationMeasurements
    values["stage"] = stage
    values["panel"] = panelId
    values["activationAtMs"] = activationStartedMs
    values["selectionAtMs"] = selectionTimestamp
    values["nativeReadyAtMs"] = nativeReadyMs
    values["firstRenderAtMs"] = firstRenderMs
    values["width"] = bounds.width
    values["height"] = bounds.height
    CraftoonPanelPerformance.write(values)
  }

  private var liveCanvas: PKCanvasView?
  // The React panel still positions/scales its controls and reference image.
  // Cancel that scale for the ink viewport, then zoom PencilKit's content so
  // it renders new tiles at the displayed size without modifying PKDrawing.
  @objc var renderScale: Double = 1 { didSet { if renderScale != oldValue { setNeedsLayout() } } }
  private var inkRenderScale: CGFloat {
    renderScale.isFinite ? max(1, CGFloat(renderScale)) : 1
  }

  private func layoutInkCanvas(_ canvas: PKCanvasView) {
    let scale = inkRenderScale
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    let transform = CGAffineTransform(scaleX: 1 / scale, y: 1 / scale)
    if canvas.transform != transform { canvas.transform = transform }
    if canvas.bounds.size != size { canvas.bounds.size = size }
    let center = CGPoint(x: bounds.midX, y: bounds.midY)
    if canvas.center != center { canvas.center = center }
    if canvas.maximumZoomScale < scale { canvas.maximumZoomScale = scale }
    if canvas.zoomScale != scale { canvas.setZoomScale(scale, animated: false) }
    if canvas.contentSize != size { canvas.contentSize = size }
    if canvas.contentOffset != .zero { canvas.contentOffset = .zero }
    if canvas.pinchGestureRecognizer?.isEnabled == true { canvas.pinchGestureRecognizer?.isEnabled = false }
  }
  private let previewView = UIImageView()
  private let inkPolygonMask = CAShapeLayer()
  private var maskedInkBounds: CGRect?
  private var maskedInkPoints: [CGPoint] = []
  @objc var polygonPoints: NSArray = [] { didSet { updateInkPolygonMask() } }

  private func updateInkPolygonMask() {
    let points = CraftoonPanelShape.points(polygonPoints)
    guard maskedInkBounds != bounds || maskedInkPoints != points else { return }
    maskedInkBounds = bounds
    maskedInkPoints = points
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if CraftoonPanelShape.isRectangle(points) {
      // Rectangular panels already clip via clipsToBounds; avoid an extra
      // offscreen compositing pass for their live renderer and preview.
      layer.mask = nil
    } else {
      inkPolygonMask.frame = bounds
      inkPolygonMask.path = CraftoonPanelShape.path(points, in: bounds).cgPath
      layer.mask = inkPolygonMask
    }
    CATransaction.commit()
  }

  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    super.point(inside: point, with: event)
      && CraftoonPanelShape.path(CraftoonPanelShape.points(polygonPoints), in: bounds).contains(point)
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard self.point(inside: point, with: event) else { return nil }
    return super.hitTest(point, with: event)
  }
  private weak var canvasAwaitingRender: PKCanvasView?
  private var detachWork: DispatchWorkItem?
  private var previewRevision = 0
  private var previewKey: String?
  private var previewTimer: Timer?
  private var inkSize: CGSize = .zero
  private var syncing = false
  private static let previewQueue = DispatchQueue(label: "com.craftoon.ink-preview", qos: .userInitiated)

  var canvasView: PKCanvasView {
    if let canvas = liveCanvas { return canvas }
    let createStart = CraftoonPanelPerformance.enabled ? CraftoonPanelPerformance.now() : 0
    let canvas = makeCanvas()
    if CraftoonPanelPerformance.enabled { activationMeasurements["createCanvasMs"] = CraftoonPanelPerformance.now() - createStart }
    liveCanvas = canvas
    layoutInkCanvas(canvas)
    addSubview(canvas)
    // A new PencilKit renderer initially has no visible tiles. Keep the last
    // preview above it until its first completed render has been presented.
    canvasAwaitingRender = canvas
    previewView.isHidden = false
    bringSubviewToFront(previewView)
    installPointerInput()
    let decodeStart = CraftoonPanelPerformance.enabled ? CraftoonPanelPerformance.now() : 0
    let cached = RNPencilKitView.drawingCache[panelId]
    let drawing = cached ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[panelId] ?? drawingData) ?? PKDrawing()
    if CraftoonPanelPerformance.enabled {
      activationMeasurements["drawingCached"] = cached != nil
      activationMeasurements["decodeDrawingMs"] = CraftoonPanelPerformance.now() - decodeStart
      activationMeasurements["strokeCount"] = drawing.strokes.count
    }
    let assignStart = CraftoonPanelPerformance.enabled ? CraftoonPanelPerformance.now() : 0
    isApplyingDrawing = true
    canvas.drawing = drawing
    isApplyingDrawing = false
    if CraftoonPanelPerformance.enabled { activationMeasurements["assignDrawingMs"] = CraftoonPanelPerformance.now() - assignStart }
    RNPencilKitView.drawingCache[panelId] = drawing
    if inkSize == .zero { inkSize = bounds.size }
    return canvas
  }

  private func makeCanvas() -> PKCanvasView {
    let canvas = PKCanvasView()
    canvas.drawingPolicy = .anyInput
    canvas.backgroundColor = .white
    canvas.isOpaque = true
    canvas.isUserInteractionEnabled = false
    canvas.delegate = self

    canvas.isScrollEnabled = false
    canvas.bounces = false
    // Keep PencilKit's recognizers intact; only disable scrolling through its API.
    canvas.minimumZoomScale = 1
    canvas.maximumZoomScale = 1
    canvas.contentInsetAdjustmentBehavior = .never
    canvas.contentInset = .zero

    canvas.delaysContentTouches = false
    canvas.tool = defaultInkTool()
    canvas.undoManager?.levelsOfUndo = 20
    // Ink must remain visible on the white page, including in system dark mode.
    canvas.overrideUserInterfaceStyle = .light

    return canvas
  }

  @objc var panelId: String = "" {
    didSet {
      guard panelId != oldValue else { return }
      syncTimer?.invalidate()
      drawingRevision += 1
      lastEmittedDrawingData = nil
      loadDrawing()
    }
  }

  @objc var drawingData: String = "" {
    didSet {
      // React echoes our save event back as a prop. Reinstalling that snapshot
      // can erase a newer stroke and restart PencilKit's live renderer.
      guard drawingData != oldValue,
            drawingData != lastEmittedDrawingData else { return }
      if !isDrawingActive, liveCanvas == nil {
        if !panelId.isEmpty { CraftoonInkStore.latestReferences[panelId] = drawingData.isEmpty ? nil : drawingData }
        inkSize = bounds.size
        previewKey = nil
        schedulePreview()
        return
      }
      let decoded = CraftoonInkStore.drawing(drawingData)
      guard drawingData.isEmpty || decoded != nil else { return }
      let drawing = decoded ?? PKDrawing()
      applyDrawing(drawing, reference: drawingData.isEmpty ? nil : drawingData)
    }
  }

  @objc var onDrawingChange: RCTBubblingEventBlock?

  @objc var transparentBackground: Bool = false {
    didSet {
      guard transparentBackground != oldValue else { return }
      backgroundColor = transparentBackground ? .clear : .white
      isOpaque = !transparentBackground
      liveCanvas?.backgroundColor = transparentBackground ? .clear : .white
      liveCanvas?.isOpaque = !transparentBackground
    }
  }

  @objc var isDrawingActive: Bool = false {
    didSet {
      if isDrawingActive != oldValue { updateDrawingState() }
    }
  }

  @objc var drawingTool: String = "pen" {
    didSet { if drawingTool != oldValue { updateDrawingState() } }
  }

  private var lastBoundsSize: CGSize = .zero

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupView()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupView()
  }

  private func setupView() {
    backgroundColor = .white
    clipsToBounds = true
    // Mask the view that actually owns PencilKit's live renderer, the pointer
    // stroke previews and the inactive image. Fabric may host React children
    // outside the legacy PanelSurface view, so its outer mask is insufficient.
    inkPolygonMask.fillColor = UIColor.black.cgColor
    layer.mask = inkPolygonMask
    updateInkPolygonMask()
    Self.views.add(self)
    _ = Self.memoryObserver
    _ = Self.paletteDiagnosticsStarted
    previewView.isUserInteractionEnabled = false
    previewView.contentMode = .scaleToFill
    addSubview(previewView)
  }

  // Simulator mouse events arrive as direct touches. On an iPad, only pointer
  // events use this path; Apple Pencil and finger drawing stay with PencilKit.
  private let pointerInput = ActualPointerGestureRecognizer(target: nil, action: nil)
  private var pointerInk: PKInkingTool?
  private var pointerPointWidth: CGFloat = 1
  private var pointerPoints: [PKStrokePoint] = []
  private var pointerStartTime: TimeInterval = 0
  private var pointerCreationDate = Date()
  private var pointerRandomSeed: UInt32 = 0
  private var pointerPreview: PKCanvasView?
  private var committedPreviews: [PKCanvasView] = []
  private var pointerPreviewNeedsUpdate = false
  private var pointerDisplayLink: CADisplayLink?
  private lazy var pointerDisplayTarget = PointerPreviewDisplayTarget { [weak self] in
    self?.renderPointerPreview()
  }

  private func installPointerInput() {
    pointerInput.acceptsTouch = { [weak self] touch in
      guard let self = self, self.isDrawingActive,
            self.drawingTool == "pen", self.canvasView.tool is PKInkingTool,
            !self.canvasView.isRulerActive else { return false }
      #if targetEnvironment(simulator)
      return touch.type == .direct || touch.type == .indirectPointer
      #else
      return touch.type == .indirectPointer
      #endif
    }
    pointerInput.onBegin = { [weak self] touch in
      self?.beginPointerStroke(touch)
    }
    pointerInput.onSamples = { [weak self] touches in
      self?.appendPointerSamples(touches)
    }
    pointerInput.onEnd = { [weak self] cancelled in
      self?.endPointerStroke(cancelled: cancelled)
    }
    canvasView.addGestureRecognizer(pointerInput)
    // A recognized mouse stroke must not also start PencilKit's predicted ink.
    canvasView.drawingGestureRecognizer.require(toFail: pointerInput)
  }

  private func beginPointerStroke(_ touch: UITouch) {
    guard let ink = canvasView.tool as? PKInkingTool else { return }
    canvasViewDidBeginUsingTool(canvasView)
    pointerInk = ink
    // PKStrokePoint.size is not the palette's base width. Native raster checks
    // show pen/monoline points of size 1.5 and below produce no ink. Offset the
    // palette range to a visible point size, preserving distinct thin presets.
    let minimumWidth = ink.inkType.validWidthRange.lowerBound
    pointerPointWidth = max(2.5, ink.width + max(0, 2.5 - minimumWidth))
    pointerPoints = []
    pointerStartTime = touch.timestamp
    pointerCreationDate = Date()
    pointerRandomSeed = UInt32.random(in: UInt32.min...UInt32.max)
    // Render the live stroke with the same PencilKit ink engine and stroke
    // points used by the saved drawing. A CAShapeLayer line cannot reproduce
    // brush-specific width, opacity, nib shape, or texture.
    let preview = PKCanvasView(frame: canvasView.frame)
    preview.isUserInteractionEnabled = false
    preview.isOpaque = false
    preview.backgroundColor = .clear
    preview.overrideUserInterfaceStyle = .light
    preview.isScrollEnabled = false
    preview.contentInsetAdjustmentBehavior = .never
    preview.contentSize = canvasView.bounds.size
    addSubview(preview)
    layoutInkCanvas(preview)
    pointerPreview = preview
    pointerPreviewNeedsUpdate = false
    let displayLink = CADisplayLink(target: pointerDisplayTarget,
                                    selector: #selector(PointerPreviewDisplayTarget.displayFrame))
    displayLink.add(to: .main, forMode: .common)
    pointerDisplayLink = displayLink
  }

  private func appendPointerSamples(_ touches: [UITouch]) {
    guard pointerInk != nil else { return }
    for touch in touches {
      let viewportLocation = touch.location(in: canvasView)
      let location = CGPoint(x: viewportLocation.x / canvasView.zoomScale,
                             y: viewportLocation.y / canvasView.zoomScale)
      let time = max(0, touch.timestamp - pointerStartTime)
      if let previous = pointerPoints.last, time <= previous.timeOffset { continue }
      pointerPoints.append(PKStrokePoint(
        location: location, timeOffset: time,
        size: CGSize(width: pointerPointWidth, height: pointerPointWidth),
        opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2
      ))
    }
    pointerPreviewNeedsUpdate = true
  }

  private func currentPointerStroke() -> PKStroke? {
    guard let ink = pointerInk, !pointerPoints.isEmpty else { return nil }
    let path = PKStrokePath(controlPoints: pointerPoints, creationDate: pointerCreationDate)
    let strokeInk = ink.ink
    if #available(iOS 16.0, *) {
      return PKStroke(ink: strokeInk, path: path, transform: .identity,
                      mask: nil, randomSeed: pointerRandomSeed)
    }
    return PKStroke(ink: strokeInk, path: path)
  }

  private func renderPointerPreview() {
    guard pointerPreviewNeedsUpdate, let stroke = currentPointerStroke() else { return }
    // Update only the in-progress stroke, at most once per display frame.
    // Previously drawn content never gets copied or reinstalled during a drag.
    pointerPreview?.drawing = PKDrawing(strokes: [stroke])
    pointerPreviewNeedsUpdate = false
  }

  private func endPointerStroke(cancelled: Bool) {
    pointerDisplayLink?.invalidate()
    pointerDisplayLink = nil
    if !cancelled, let stroke = currentPointerStroke() {
      // Use this exact stroke for both the final preview and the document.
      pointerPreview?.drawing = PKDrawing(strokes: [stroke])
      if let preview = pointerPreview {
        committedPreviews.append(preview)
      }
      replacePointerDrawing(PKDrawing(strokes: canvasView.drawing.strokes + [stroke]))
    } else {
      pointerPreview?.removeFromSuperview()
    }
    pointerPreview = nil
    pointerPreviewNeedsUpdate = false
    pointerInk = nil
    pointerPoints = []
    canvasViewDidEndUsingTool(canvasView)
  }

  private func replacePointerDrawing(_ drawing: PKDrawing) {
    let previous = canvasView.drawing
    canvasView.undoManager?.registerUndo(withTarget: self) { target in
      target.replacePointerDrawing(previous)
    }
    applyDrawing(drawing)
    if !isUsingTool { scheduleDrawingSync() }
  }

  func canvasViewDidFinishRendering(_ canvasView: PKCanvasView) {
    guard canvasView === liveCanvas else { return }
    if CraftoonPanelPerformance.enabled, isDrawingActive, firstRenderMs == 0 {
      firstRenderMs = CraftoonPanelPerformance.now()
      reportPanelTiming("first_render")
    }
    let renderedPreviews = committedPreviews
    // Defer the handoff to the next main turn so the newly rendered tiles and
    // overlay removal reach the compositor together. Ignore retired renderers.
    DispatchQueue.main.async { [weak self, weak canvasView] in
      guard let self, let canvasView, canvasView === self.liveCanvas else { return }
      UIView.performWithoutAnimation {
        renderedPreviews.forEach { $0.removeFromSuperview() }
        self.committedPreviews.removeAll { preview in renderedPreviews.contains { $0 === preview } }
        if self.canvasAwaitingRender === canvasView, self.window != nil {
          self.canvasAwaitingRender = nil
          self.previewView.isHidden = true
        }
      }
    }
  }

  private var syncTimer: Timer?
  private var isApplyingDrawing = false
  private var isUsingTool = false
  private var drawingRevision = 0
  private var lastEmittedDrawingData: String?
  private var pendingGeometrySource: String?
  private var savedDrawingTool: PKTool?

  deinit {
    pointerDisplayLink?.invalidate()
    syncTimer?.invalidate()
    previewTimer?.invalidate()
    detachWork?.cancel()
    if let canvas = paletteCanvas { detachToolPicker(from: canvas) }
    // Preserve a stroke even if React unmounts this panel before the sync event.
    if let drawing = liveCanvas?.drawing, !panelId.isEmpty,
       CraftoonInkStore.documentPanelIDs?.contains(panelId) != false {
      RNPencilKitView.drawingCache[panelId] = drawing
      let capture = CraftoonInkStore.capture([["panels": [["id": panelId]]]])
      let id = panelId
      let reference = CraftoonInkStore.latestReferences[id]
      CraftoonInkStore.queue.async {
        do {
          try CraftoonInkStore.persist(capture.drawings)
          DispatchQueue.main.async {
            if CraftoonInkStore.latestReferences[id] == reference { RNPencilKitView.drawingCache.removeValue(forKey: id) }
          }
        } catch { NSLog("Ink checkpoint failed: %@", error.localizedDescription) }
      }
    }
  }

  private func applyDrawing(_ drawing: PKDrawing, reference: String? = nil, geometryChange: Bool = false) {
    if geometryChange {
      if pendingGeometrySource == nil { pendingGeometrySource = drawingData }
    } else { pendingGeometrySource = nil }
    syncTimer?.invalidate()
    drawingRevision += 1
    isApplyingDrawing = true
    liveCanvas?.drawing = drawing
    isApplyingDrawing = false
    inkSize = bounds.size
    if !panelId.isEmpty {
      RNPencilKitView.drawingCache[panelId] = drawing
      CraftoonInkStore.latestReferences[panelId] = reference
    }
    if !isDrawingActive { schedulePreview() }
  }

  private func loadDrawing() {
    let reference = CraftoonInkStore.latestReferences[panelId] ?? drawingData
    if !isDrawingActive, liveCanvas == nil {
      inkSize = bounds.size
      schedulePreview()
      return
    }
    let drawing = RNPencilKitView.drawingCache[panelId] ?? CraftoonInkStore.drawing(reference) ?? PKDrawing()
    applyDrawing(drawing, reference: reference.isEmpty ? nil : reference)
  }

  func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
    guard canvasView === liveCanvas else { return }
    isUsingTool = true
    drawingRevision += 1
    syncTimer?.invalidate()
  }

  func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
    guard canvasView === liveCanvas else { return }
    isUsingTool = false
    CraftoonDraftRecovery.shared.flush()
    scheduleDrawingSync()
  }

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    guard canvasView === liveCanvas else { return }
    guard !isApplyingDrawing else { return }
    pendingGeometrySource = nil
    drawingRevision += 1
    if !panelId.isEmpty {
      RNPencilKitView.drawingCache[panelId] = canvasView.drawing
      CraftoonInkStore.latestReferences.removeValue(forKey: panelId)
    }
    CraftoonDraftRecovery.shared.scheduleSave()
    if !isDrawingActive { schedulePreview() }
    // Final pressure updates can arrive after didEndUsingTool.
    if !isUsingTool {
      scheduleDrawingSync()
    }
  }

  private func scheduleDrawingSync() {
    syncTimer?.invalidate()
    // Geometry commits happen once on release. Publish their ink immediately
    // so a following pen stroke gets the completed geometry as its Undo base.
    let delay: TimeInterval = pendingGeometrySource == nil ? 0.3 : 0
    let timer = Timer(timeInterval: delay, repeats: false) { [weak self] _ in
      guard let self, !self.isUsingTool, !self.syncing,
            self.onDrawingChange != nil, !self.panelId.isEmpty else { return }
      let revision = self.drawingRevision
      let panelId = self.panelId
      let capture = CraftoonInkStore.capture([["panels": [["id": panelId]]]])
      var geometry: [String: Any]?
      if let source = self.pendingGeometrySource {
        geometry = ["width": self.shapeFrame["width"] ?? self.bounds.width,
                    "height": self.shapeFrame["height"] ?? self.bounds.height,
                    "corners": self.shapeFrame["corners"] ?? [], "sourceDrawingData": source]
      }
      let geometryResult = geometry
      guard let reference = (capture.pages.first?["panels"] as? [[String: Any]])?.first?["drawingData"] as? String,
            reference != self.lastEmittedDrawingData else { return }
      self.syncing = true
      CraftoonInkStore.queue.async { [weak self] in
        let result = Result { try CraftoonInkStore.persist(capture.drawings) }
        DispatchQueue.main.async { [weak self] in
          guard let self else { return }
          self.syncing = false
          guard self.panelId == panelId else { return }
          guard !self.isUsingTool, self.drawingRevision == revision else {
            if !self.isUsingTool { self.scheduleDrawingSync() }
            return
          }
          if case .failure(let error) = result { NSLog("Ink sync failed: %@", error.localizedDescription); return }
          self.lastEmittedDrawingData = reference
          self.pendingGeometrySource = nil
          var event: [String: Any] = ["drawingData": reference]
          if let geometryResult { event["geometry"] = geometryResult }
          self.onDrawingChange?(event)
        }
      }
    }
    RunLoop.main.add(timer, forMode: .common)
    syncTimer = timer
  }

  // Geometry previews may extend the panel's frame without resizing artwork.
  // Track that separately from normal circle resizing and ordinary panel moves.
  @objc var shapeFrame: NSDictionary = [:] { didSet { if !shapeFrame.isEqual(oldValue) { setNeedsLayout() } } }
  private var appliedShapeFrame: (x: CGFloat, width: CGFloat, height: CGFloat, revision: Int, preview: Bool)?
  private var restoredShapeFrame: (x: CGFloat, width: CGFloat, height: CGFloat, revision: Int, preview: Bool)?
  private var appliedContentBounds: CGRect?
  private var appliedInkCorners: [CGPoint]?

  private var layoutPixelTolerance: CGFloat { 1 / (window?.screen.scale ?? UIScreen.main.scale) + 0.001 }

  private func applyShapeFrameIfNeeded() -> Bool {
    guard let xValue = shapeFrame["x"] as? NSNumber,
          let widthValue = shapeFrame["width"] as? NSNumber,
          let heightValue = shapeFrame["height"] as? NSNumber else { return false }
    let next = (x: CGFloat(truncating: xValue), width: CGFloat(truncating: widthValue), height: CGFloat(truncating: heightValue),
      revision: (shapeFrame["revision"] as? NSNumber)?.intValue ?? 0,
      preview: (shapeFrame["preview"] as? NSNumber)?.boolValue ?? false)
    let content = shapeFrame["contentBounds"] as? [String: NSNumber]
    let nextContent = CGRect(x: content?["x"]?.doubleValue ?? 0, y: content?["y"]?.doubleValue ?? 0,
      width: content?["width"]?.doubleValue ?? Double(next.width),
      height: content?["height"]?.doubleValue ?? Double(next.height))
    let nextCorners = CraftoonPanelShape.points(shapeFrame["corners"]).map {
      CGPoint(x: $0.x * next.width, y: $0.y * next.height)
    }
    if let restored = restoredShapeFrame {
      guard abs(next.x - restored.x) < 0.01, abs(next.width - restored.width) < 0.01,
            abs(next.height - restored.height) < 0.01, next.revision == restored.revision,
            abs(bounds.width - restored.width) <= layoutPixelTolerance,
            abs(bounds.height - restored.height) <= layoutPixelTolerance else { return true }
      // Undo/open already supplied ink archived in this coordinate frame.
      appliedShapeFrame = restored
      appliedContentBounds = nextContent
      appliedInkCorners = nextCorners
      restoredShapeFrame = nil
      inkSize = bounds.size
      return true
    }
    let previous = appliedShapeFrame
    let reshaping = next.preview || previous?.preview == true || (previous != nil && previous?.revision != next.revision)
    // Fabric can deliver frame/props in separate steps. Never scale the ink
    // against an intermediate frame while a shape update is still pending.
    // Yoga rounds native frames to device pixels. A 0.01-point comparison
    // rejects ordinary fractional drags forever, skipping every ink update.
    guard abs(bounds.width - next.width) <= layoutPixelTolerance,
          abs(bounds.height - next.height) <= layoutPixelTolerance else { return true }
    // Arrow drags preview only the border. Keep the original ink/geometry
    // baseline and perform the expensive stroke warp once on release.
    if next.preview, shapeFrame["warpInk"] != nil { return true }
    appliedShapeFrame = next
    let previousContent = appliedContentBounds
    appliedContentBounds = nextContent
    let previousCorners = appliedInkCorners
    appliedInkCorners = nextCorners
    if (shapeFrame["warpInk"] as? NSNumber)?.boolValue == true,
       previous != nil, let previousCorners, previousCorners != nextCorners {
      let drawing = liveCanvas?.drawing ?? RNPencilKitView.drawingCache[panelId]
        ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[panelId] ?? drawingData) ?? PKDrawing()
      applyDrawing(CraftoonInkShapeWarp.drawing(drawing, from: previousCorners, to: nextCorners), geometryChange: true)
      scheduleDrawingSync()
      CraftoonDraftRecovery.shared.scheduleSave()
      return true
    }
    if (shapeFrame["resizeInk"] as? NSNumber)?.boolValue == true,
       previous != nil, let previousContent, previousContent.width > 0, previousContent.height > 0 {
      // A circle resizes the visible polygon, which can shrink entirely
      // inside a retained ink frame. Frame dimensions alone cannot detect it.
      guard previousContent != nextContent else { return true }
      let sx = nextContent.width / previousContent.width, sy = nextContent.height / previousContent.height
      let drawing = liveCanvas?.drawing ?? RNPencilKitView.drawingCache[panelId]
        ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[panelId] ?? drawingData) ?? PKDrawing()
      let transform = CGAffineTransform(a: sx, b: 0, c: 0, d: sy,
        tx: nextContent.minX - previousContent.minX * sx,
        ty: nextContent.minY - previousContent.minY * sy)
      applyDrawing(drawing.transformed(using: transform), geometryChange: true)
      scheduleDrawingSync()
      CraftoonDraftRecovery.shared.scheduleSave()
      return true
    }
    guard let previous, reshaping,
          abs(previous.width - next.width) > 0.001 || abs(previous.x - next.x) > 0.001 else { return false }
    let drawing = liveCanvas?.drawing ?? RNPencilKitView.drawingCache[panelId]
      ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[panelId] ?? drawingData) ?? PKDrawing()
    // Circle resizing may change height in the same update that extends the
    // retained ink frame horizontally. Preserve the horizontal translation
    // and apply the vertical resize together, exactly once.
    let verticalScale = previous.height > 0 ? next.height / previous.height : 1
    applyDrawing(drawing.transformed(using: CGAffineTransform(a: 1, b: 0, c: 0, d: verticalScale,
                                                             tx: previous.x - next.x, ty: 0)), geometryChange: true)
    scheduleDrawingSync()
    CraftoonDraftRecovery.shared.scheduleSave()
    return true
  }

  private func scaleInkIfNeeded() {
    if applyShapeFrameIfNeeded() { return }
    let size = bounds.size
    guard size.width > 0, size.height > 0 else { return }
    guard inkSize.width > 0, inkSize.height > 0, inkSize != size else { inkSize = size; return }
    let drawing = liveCanvas?.drawing ?? RNPencilKitView.drawingCache[panelId]
      ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[panelId] ?? drawingData) ?? PKDrawing()
    let scaled = drawing.transformed(using: CGAffineTransform(scaleX: size.width / inkSize.width, y: size.height / inkSize.height))
    applyDrawing(scaled, geometryChange: true)
    scheduleDrawingSync()
    CraftoonDraftRecovery.shared.scheduleSave()
  }

  private func schedulePreview() {
    previewRevision += 1
    previewTimer?.invalidate()
    guard !isDrawingActive, window != nil, bounds.width > 0, bounds.height > 0 else { return }
    let timer = Timer(timeInterval: 0.15, repeats: false) { [weak self] _ in self?.refreshPreview() }
    previewTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func refreshPreview() {
    guard !isDrawingActive, !panelId.isEmpty, window != nil else { return }
    scaleInkIfNeeded()
    // applyDrawing schedules another preview when a resize was committed.
    previewTimer?.invalidate()
    let capture = CraftoonInkStore.capture([["panels": [["id": panelId]]]])
    let reference = (capture.pages.first?["panels"] as? [[String: Any]])?.first?["drawingData"] as? String ?? ""
    let rect = CGRect(origin: .zero, size: bounds.size)
    let key = reference + "-\(rect.size)"
    if previewKey == key {
      // No ink changed since this preview. It is safe to reuse it, but the
      // inactive live renderer must still be released after becoming visible.
      UIView.performWithoutAnimation {
        previewView.isHidden = false
        releaseCanvas()
      }
      persistPreview(capture, reference: reference, panel: panelId)
      return
    }
    let liveDrawing = liveCanvas?.drawing ?? RNPencilKitView.drawingCache[panelId]
    let revision = previewRevision
    let id = panelId
    let scale = min(UIScreen.main.scale, 1200 / max(rect.width, rect.height, 1))
    Self.previewQueue.async { [weak self] in
        // Display does not wait behind document compression or disk saves.
        // Keep the value cached until the separate archive write is durable.
        let drawing = liveDrawing ?? CraftoonInkStore.drawing(reference) ?? PKDrawing()
        let image: UIImage? = autoreleasepool {
          if drawing.strokes.isEmpty { return nil }
          var image: UIImage?
          UITraitCollection(userInterfaceStyle: .light).performAsCurrent { image = drawing.image(from: rect, scale: scale) }
          return image
        }
        DispatchQueue.main.async { [weak self] in
          guard let self, !self.isDrawingActive, self.panelId == id, self.previewRevision == revision else { return }
          UIView.performWithoutAnimation {
            self.previewView.image = image
            self.previewView.isHidden = false
            self.previewKey = key
            self.releaseCanvas()
          }
          self.persistPreview(capture, reference: reference, panel: id)
        }
    }
  }

  private func persistPreview(_ capture: CraftoonInkCapture, reference: String, panel id: String) {
    CraftoonInkStore.queue.async { [weak self] in
      do {
        try CraftoonInkStore.persist(capture.drawings)
        DispatchQueue.main.async { [weak self] in
          guard let self, !self.isDrawingActive, self.liveCanvas == nil,
                CraftoonInkStore.latestReferences[id] == reference else { return }
          RNPencilKitView.drawingCache.removeValue(forKey: id)
        }
      } catch { NSLog("Preview checkpoint failed: %@", error.localizedDescription) }
    }
  }

  override func layoutSubviews() {
    let diagnosticStart = CraftoonPanelPerformance.paletteEnabled ? CraftoonPanelPerformance.now() : 0
    defer {
      if diagnosticStart > 0, CraftoonPanelPerformance.now() - diagnosticStart > 16 {
        CraftoonPanelPerformance.write(["stage": "ink_layout_slow", "panel": panelId,
          "durationMs": CraftoonPanelPerformance.now() - diagnosticStart, "active": isDrawingActive])
      }
    }
    super.layoutSubviews()
    updateInkPolygonMask()
    inkPolygonMask.contentsScale = (window?.screen.scale ?? UIScreen.main.scale) * inkRenderScale
    previewView.frame = bounds
    if let canvas = liveCanvas {
      layoutInkCanvas(canvas)
    }
    if let preview = pointerPreview { layoutInkCanvas(preview) }
    committedPreviews.forEach { layoutInkCanvas($0) }
    // Layout mode normally has no live PKCanvasView. Resize its cached ink
    // too; otherwise only the clipping shape changes until Draw is selected.
    scaleInkIfNeeded()
    if !isDrawingActive, lastBoundsSize != bounds.size { schedulePreview() }
    lastBoundsSize = bounds.size
  }

  private func releaseCanvas() {
    guard let canvas = liveCanvas else { return }
    canvas.delegate = nil
    detachToolPicker(from: canvas)
    committedPreviews.forEach { $0.removeFromSuperview() }
    committedPreviews.removeAll()
    canvas.removeGestureRecognizer(pointerInput)
    canvas.undoManager?.removeAllActions()
    canvas.removeFromSuperview()
    liveCanvas = nil
    canvasAwaitingRender = nil
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    detachWork?.cancel()
    detachWork = nil
    if window == nil {
      previewRevision += 1
      previewTimer?.invalidate()
      // Fabric can temporarily remove/reinsert siblings when their z-order
      // changes. Do not clear every panel's pixels during that handoff.
      let work = DispatchWorkItem { [weak self] in
        guard let self, self.window == nil else { return }
        self.checkpointDetachedCanvas()
        self.previewView.image = nil
        self.previewKey = nil
      }
      detachWork = work
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: work)
      return
    }
    updateDrawingState()
  }

  private func checkpointDetachedCanvas() {
    guard let canvas = liveCanvas else { return }
    releaseCanvas()
    if !panelId.isEmpty, CraftoonInkStore.documentPanelIDs?.contains(panelId) != false {
      let id = panelId
      RNPencilKitView.drawingCache[id] = canvas.drawing
      let capture = CraftoonInkStore.capture([["panels": [["id": id]]]])
      let reference = CraftoonInkStore.latestReferences[id]
      CraftoonInkStore.queue.async { [weak self] in
        do {
          try CraftoonInkStore.persist(capture.drawings)
          DispatchQueue.main.async { [weak self] in
            if self?.window == nil, CraftoonInkStore.latestReferences[id] == reference {
              RNPencilKitView.drawingCache.removeValue(forKey: id)
            }
          }
        } catch { NSLog("Panel checkpoint failed: %@", error.localizedDescription) }
      }
    }
  }

  private func defaultInkTool() -> PKInkingTool {
    if #available(iOS 17.0, *) {
      return PKInkingTool(.monoline, color: .black, width: 2.5)
    }
    return PKInkingTool(.pen, color: .black, width: 2.5)
  }

  private func updateTool() {
    if drawingTool == "lasso" {
      if !(canvasView.tool is PKLassoTool) {
        savedDrawingTool = canvasView.tool
      }
      canvasView.tool = PKLassoTool()
    }
    // In Draw mode the native palette owns pen/eraser/lasso selection. Do not
    // replace the lasso just because React updates a panel property.
    if #available(iOS 18.0, *) {
      canvasView.isDrawingEnabled = true
    }
  }

  private func updateDrawingState() {
    guard window != nil, isDrawingActive else {
      if let canvas = liveCanvas {
        canvas.isUserInteractionEnabled = false
        detachToolPicker(from: canvas)
      }
      schedulePreview()
      return
    }
    if CraftoonPanelPerformance.enabled {
      activationStartedMs = CraftoonPanelPerformance.now()
      nativeReadyMs = 0
      firstRenderMs = 0
      activationMeasurements = ["reusedCanvas": liveCanvas != nil]
    }
    previewRevision += 1
    previewTimer?.invalidate()
    scaleInkIfNeeded()
    let canvas = canvasView
    canvas.isUserInteractionEnabled = true
    canvas.backgroundColor = transparentBackground ? .clear : .white
    canvas.isOpaque = !transparentBackground
    attachToolPicker(to: canvas)
    canvas.drawingPolicy = .anyInput
    updateTool()
    if CraftoonPanelPerformance.enabled {
      nativeReadyMs = CraftoonPanelPerformance.now()
      reportPanelTiming("native_ready")
    }
  }
}

// Consume actual/coalesced mouse samples only. Never append predictedTouches:
// prediction can temporarily put the tip ahead of a fast-changing mouse path.
private final class ActualPointerGestureRecognizer: UIGestureRecognizer {
  var acceptsTouch: ((UITouch) -> Bool)?
  var onBegin: ((UITouch) -> Void)?
  var onSamples: (([UITouch]) -> Void)?
  var onEnd: ((Bool) -> Void)?
  private var trackedTouch: UITouch?

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    guard trackedTouch == nil, touches.count == 1,
          let touch = touches.first, acceptsTouch?(touch) == true else {
      if trackedTouch == nil { state = .failed }
      return
    }
    trackedTouch = touch
    onBegin?(touch)
    onSamples?([touch])
    state = .began
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let touch = trackedTouch, touches.contains(touch) else { return }
    onSamples?(event.coalescedTouches(for: touch) ?? [touch])
    state = .changed
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let touch = trackedTouch, touches.contains(touch) else { return }
    onSamples?(event.coalescedTouches(for: touch) ?? [touch])
    onEnd?(false)
    trackedTouch = nil
    state = .ended
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
    guard trackedTouch != nil else { return }
    onEnd?(true)
    trackedTouch = nil
    state = .cancelled
  }

  override func reset() {
    if trackedTouch != nil { onEnd?(true) }
    trackedTouch = nil
    super.reset()
  }
}

// CADisplayLink retains its target; this closure captures the canvas weakly.
private final class PointerPreviewDisplayTarget: NSObject {
  private let onFrame: () -> Void

  init(onFrame: @escaping () -> Void) {
    self.onFrame = onFrame
    super.init()
  }

  @objc func displayFrame() {
    onFrame()
  }
}
