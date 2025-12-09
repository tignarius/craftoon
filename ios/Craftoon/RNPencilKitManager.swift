import Foundation
import React

@objc(RNPencilKitManager)
class RNPencilKitManager: RCTViewManager {
  
  override func view() -> UIView! {
    return RNPencilKitView()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
