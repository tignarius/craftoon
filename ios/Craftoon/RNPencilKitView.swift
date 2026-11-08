import UIKit
import PencilKit
import React
import UIKit.UIGestureRecognizerSubclass

class RNPencilKitView: UIView, PKCanvasViewDelegate {

  // Keep the latest native drawing when a panel unmounts during page navigation.
  static var drawingCache: [String: PKDrawing] = [:]

  private static var sharedToolPicker: PKToolPicker? = {
    if #available(iOS 14.0, *) {
      let picker = PKToolPicker()
      picker.overrideUserInterfaceStyle = .light
      picker.colorUserInterfaceStyle = .light
      return picker
    }
    return nil
  }()

  lazy var canvasView: PKCanvasView = {
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
    // Ink must remain visible on the white page, including in system dark mode.
    canvas.overrideUserInterfaceStyle = .light

    return canvas
  }()

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
      let drawing: PKDrawing
      if drawingData.isEmpty {
        drawing = PKDrawing()
      } else {
        guard let data = Data(base64Encoded: drawingData),
              let decoded = try? PKDrawing(data: data) else { return }
        drawing = decoded
      }
      applyDrawing(drawing)
    }
  }

  @objc var onDrawingChange: RCTBubblingEventBlock?

  @objc var isDrawingActive: Bool = false {
    didSet {
      updateDrawingState()
    }
  }

  @objc var drawingTool: String = "pen" {
    didSet {
      updateDrawingState()
    }
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
    addSubview(canvasView)
    installPointerInput()
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
    // Keep the preview until the committed ink is visible, avoiding a blank frame.
    committedPreviews.forEach { $0.removeFromSuperview() }
    committedPreviews.removeAll()
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
    RNPencilKitView.sharedToolPicker?.removeObserver(canvasView)
  }

  private func applyDrawing(_ drawing: PKDrawing) {
    syncTimer?.invalidate()
    drawingRevision += 1
    isApplyingDrawing = true
    canvasView.drawing = drawing
    isApplyingDrawing = false
    if !panelId.isEmpty {
      RNPencilKitView.drawingCache[panelId] = drawing
    }
  }

  private func loadDrawing() {
    if let cached = RNPencilKitView.drawingCache[panelId] {
      applyDrawing(cached)
    } else if let data = Data(base64Encoded: drawingData),
              let drawing = try? PKDrawing(data: data) {
      // React may supply drawingData before panelId during mounting.
      applyDrawing(drawing)
    } else {
      applyDrawing(PKDrawing())
    }
  }

  func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
    isUsingTool = true
    drawingRevision += 1
    syncTimer?.invalidate()
  }

  func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
    isUsingTool = false
    CraftoonDraftRecovery.shared.flush()
    scheduleDrawingSync()
  }

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    guard !isApplyingDrawing else { return }
    drawingRevision += 1
    if !panelId.isEmpty {
      RNPencilKitView.drawingCache[panelId] = canvasView.drawing
    }
    CraftoonDraftRecovery.shared.scheduleSave()
    // Final pressure updates can arrive after didEndUsingTool.
    if !isUsingTool {
      scheduleDrawingSync()
    }
  }

  private func scheduleDrawingSync() {
    syncTimer?.invalidate()
    let timer = Timer(timeInterval: 0.2, repeats: false) { [weak self] _ in
      guard let self = self, !self.isUsingTool,
            self.onDrawingChange != nil else { return }
      let drawing = self.canvasView.drawing
      let revision = self.drawingRevision
      let panelId = self.panelId
      DispatchQueue.global(qos: .utility).async { [weak self] in
        let data = drawing.dataRepresentation().base64EncodedString()
        DispatchQueue.main.async { [weak self] in
          guard let self = self, !self.isUsingTool,
                self.panelId == panelId,
                self.drawingRevision == revision else { return }
          self.lastEmittedDrawingData = data
          self.onDrawingChange?(["drawingData": data])
        }
      }
    }
    RunLoop.main.add(timer, forMode: .common)
    syncTimer = timer
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let currentSize = self.bounds.size

    // 박스 크기가 변경될 때 내부 드로잉(펜 스트로크)도 동일한 비율로 축소/확대
    if lastBoundsSize.width > 0 && lastBoundsSize.height > 0 &&
       currentSize.width > 0 && currentSize.height > 0 &&
       lastBoundsSize != currentSize {

      let scaleX = currentSize.width / lastBoundsSize.width
      let scaleY = currentSize.height / lastBoundsSize.height

      if !canvasView.drawing.strokes.isEmpty {
        let transform = CGAffineTransform(scaleX: scaleX, y: scaleY)
        canvasView.drawing = canvasView.drawing.transformed(using: transform)
      }
    }

    if currentSize.width > 0 && currentSize.height > 0 {
      lastBoundsSize = currentSize
    }

    canvasView.frame = self.bounds
    canvasView.contentSize = currentSize
    canvasView.contentOffset = .zero
    pointerPreview?.frame = canvasView.frame
    pointerPreview?.contentSize = currentSize
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateDrawingState()
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
    } else if canvasView.tool is PKLassoTool {
      canvasView.tool = savedDrawingTool ?? defaultInkTool()
    }
    if #available(iOS 18.0, *) {
      canvasView.isDrawingEnabled = true
    }
  }

  private func updateDrawingState() {
    canvasView.isUserInteractionEnabled = isDrawingActive
    let picker = RNPencilKitView.sharedToolPicker
    // Only the active canvas may follow the shared tool picker.
    picker?.removeObserver(canvasView)
    guard window != nil, isDrawingActive else {
      picker?.setVisible(false, forFirstResponder: canvasView)
      canvasView.resignFirstResponder()
      return
    }

    if drawingTool == "pen" {
      picker?.addObserver(canvasView)
    }
    canvasView.becomeFirstResponder()
    picker?.setVisible(drawingTool == "pen", forFirstResponder: canvasView)
    canvasView.drawingPolicy = .anyInput
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
