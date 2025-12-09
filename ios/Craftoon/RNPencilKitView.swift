import UIKit
import PencilKit

class RNPencilKitView: UIView {
  
  lazy var canvasView: PKCanvasView = {
    let canvas = PKCanvasView()
    canvas.drawingPolicy = .anyInput // 손가락, 펜슬 모두 입력 허용 (필요에 따라 .pencilOnly로 변경 가능)
    canvas.backgroundColor = .clear // 배경 투명 (RN쪽 배경색 따름)
    canvas.isOpaque = false
    // 도구 모음(ToolPicker)은 나중에 추가할 수 있습니다.
    return canvas
  }()
  
  override init(frame: CGRect) {
    super.init(frame: frame)
    setupView()
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupView()
  }
  
  private func setupView() {
    addSubview(canvasView)
  }
  
  override func layoutSubviews() {
    super.layoutSubviews()
    canvasView.frame = self.bounds
    
    // 이 시점에서 ToolPicker를 활성화하면 그리기 도구가 나타납니다.
    // 일단 기본 펜 입력을 확인하기 위해 아래 코드를 추가합니다.
    if let window = self.window, let toolPicker = PKToolPicker.shared(for: window) {
        toolPicker.setVisible(true, forFirstResponder: canvasView)
        toolPicker.addObserver(canvasView)
        canvasView.becomeFirstResponder()
    }
  }
}
