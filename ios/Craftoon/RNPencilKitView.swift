import UIKit
import PencilKit
import React
import UIKit.UIGestureRecognizerSubclass

class RNPencilKitView: UIView, PKCanvasViewDelegate {

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

  static func restoreVisibleDrawings() {
    for view in views.allObjects where CraftoonInkStore.documentPanelIDs?.contains(view.panelId) == true {
      view.liveCanvas?.undoManager?.removeAllActions()
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
      picker.overrideUserInterfaceStyle = .light
      picker.colorUserInterfaceStyle = .light
      return picker
    }
    return nil
  }()

  private var liveCanvas: PKCanvasView?
  private let previewView = UIImageView()
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
    let canvas = makeCanvas()
    liveCanvas = canvas
    canvas.frame = bounds
    canvas.contentSize = bounds.size
    addSubview(canvas)
    // A new PencilKit renderer initially has no visible tiles. Keep the last
    // preview above it until its first completed render has been presented.
    canvasAwaitingRender = canvas
    previewView.isHidden = false
    bringSubviewToFront(previewView)
    installPointerInput()
    let drawing = RNPencilKitView.drawingCache[panelId]
      ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[panelId] ?? drawingData)
      ?? PKDrawing()
    isApplyingDrawing = true
    canvas.drawing = drawing
    isApplyingDrawing = false
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
    Self.views.add(self)
    _ = Self.memoryObserver
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
      let location = touch.location(in: canvasView)
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
  private var savedDrawingTool: PKTool?

  deinit {
    pointerDisplayLink?.invalidate()
    syncTimer?.invalidate()
    previewTimer?.invalidate()
    detachWork?.cancel()
    if let canvas = liveCanvas { RNPencilKitView.sharedToolPicker?.removeObserver(canvas) }
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

  private func applyDrawing(_ drawing: PKDrawing, reference: String? = nil) {
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
    let timer = Timer(timeInterval: 0.3, repeats: false) { [weak self] _ in
      guard let self, !self.isUsingTool, !self.syncing,
            self.onDrawingChange != nil, !self.panelId.isEmpty else { return }
      let revision = self.drawingRevision
      let panelId = self.panelId
      let capture = CraftoonInkStore.capture([["panels": [["id": panelId]]]])
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
          self.onDrawingChange?(["drawingData": reference])
        }
      }
    }
    RunLoop.main.add(timer, forMode: .common)
    syncTimer = timer
  }

  private func scaleInkIfNeeded() {
    let size = bounds.size
    guard size.width > 0, size.height > 0 else { return }
    guard inkSize.width > 0, inkSize.height > 0, inkSize != size else { inkSize = size; return }
    let drawing = liveCanvas?.drawing ?? RNPencilKitView.drawingCache[panelId]
      ?? CraftoonInkStore.drawing(CraftoonInkStore.latestReferences[panelId] ?? drawingData) ?? PKDrawing()
    let scaled = drawing.transformed(using: CGAffineTransform(scaleX: size.width / inkSize.width, y: size.height / inkSize.height))
    applyDrawing(scaled)
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
    super.layoutSubviews()
    previewView.frame = bounds
    if let canvas = liveCanvas {
      if canvas.frame != bounds { canvas.frame = bounds }
      if canvas.contentSize != bounds.size { canvas.contentSize = bounds.size }
      if canvas.contentOffset != .zero { canvas.contentOffset = .zero }
    }
    pointerPreview?.frame = bounds
    pointerPreview?.contentSize = bounds.size
    if isDrawingActive { scaleInkIfNeeded() }
    else if lastBoundsSize != bounds.size { schedulePreview() }
    lastBoundsSize = bounds.size
  }

  private func releaseCanvas() {
    guard let canvas = liveCanvas else { return }
    canvas.delegate = nil
    let picker = RNPencilKitView.sharedToolPicker
    picker?.removeObserver(canvas)
    picker?.setVisible(false, forFirstResponder: canvas)
    canvas.resignFirstResponder()
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
        let picker = RNPencilKitView.sharedToolPicker
        picker?.removeObserver(canvas)
        picker?.setVisible(false, forFirstResponder: canvas)
        canvas.resignFirstResponder()
      }
      schedulePreview()
      return
    }
    previewRevision += 1
    previewTimer?.invalidate()
    scaleInkIfNeeded()
    let canvas = canvasView
    canvas.isUserInteractionEnabled = true
    canvas.backgroundColor = transparentBackground ? .clear : .white
    canvas.isOpaque = !transparentBackground
    let picker = RNPencilKitView.sharedToolPicker
    picker?.removeObserver(canvas)
    picker?.addObserver(canvas)
    if drawingTool == "pen", let selected = picker?.selectedTool { canvas.tool = selected }
    canvas.becomeFirstResponder()
    picker?.setVisible(true, forFirstResponder: canvas)
    canvas.drawingPolicy = .anyInput
    updateTool()
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
