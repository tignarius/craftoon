import UIKit
import PencilKit

class RNPencilKitView: UIView {
  
  lazy var canvasView: PKCanvasView = {
    let canvas = PKCanvasView()
    canvas.drawingPolicy = .anyInput // 손가락, 펜슬 모두 입력 허용
    canvas.backgroundColor = .white
    canvas.isOpaque = true
    return canvas
  }()
  
  private var toolPicker: PKToolPicker?
  
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
    addSubview(canvasView)
  }
  
  override func layoutSubviews() {
    super.layoutSubviews()
    canvasView.frame = self.bounds
  }
  
  override func didMoveToWindow() {
    super.didMoveToWindow()
    if let window = self.window {
      let picker = PKToolPicker()
      self.toolPicker = picker
      picker.setVisible(true, forFirstResponder: canvasView)
      picker.addObserver(canvasView)
      canvasView.becomeFirstResponder()
    }
  }
}

