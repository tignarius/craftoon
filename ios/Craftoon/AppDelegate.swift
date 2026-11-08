import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // React Native's device-info module still reads UIApplicationDelegate.window
  // when the iPad becomes active or changes orientation, even with scenes enabled.
  var window: UIWindow?
  private var orientationObserver: NSObjectProtocol?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Enable native mouse enter/leave events for icon tooltips.
    RCTSetDispatchW3CPointerEvents(true)
    UIDevice.current.beginGeneratingDeviceOrientationNotifications()
    orientationObserver = NotificationCenter.default.addObserver(
      forName: UIDevice.orientationDidChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      guard CraftoonOrientationState.mask == .all,
        let scene = self?.window?.windowScene, scene.activationState == .foregroundActive,
        let root = self?.window?.rootViewController else { return }
      let target = CraftoonOrientationState.physicalMask
      guard target != .all,
        target.rawValue != (1 << scene.interfaceOrientation.rawValue) else { return }
      if #available(iOS 16.0, *) {
        root.setNeedsUpdateOfSupportedInterfaceOrientations()
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: target)) { _ in }
      } else { UIViewController.attemptRotationToDeviceOrientation() }
    }
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return true
  }

  func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
    CraftoonOrientationState.mask
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let sceneConfig = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    sceneConfig.delegateClass = SceneDelegate.self
    return sceneConfig
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    let appDelegate = UIApplication.shared.delegate as! AppDelegate
    guard let factory = appDelegate.reactNativeFactory else { return }

    let newWindow = UIWindow(windowScene: windowScene)
    self.window = newWindow
    appDelegate.window = newWindow

    factory.startReactNative(
      withModuleName: "Craftoon",
      in: newWindow,
      launchOptions: nil
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}


// Editor/reader use one supported orientation. Library and splash use all
// orientations so UIKit can follow the physical iPad again.
enum CraftoonOrientationState {
  static var mask: UIInterfaceOrientationMask = .all
  static var generation = 0
  static var physicalMask: UIInterfaceOrientationMask {
    switch UIDevice.current.orientation {
    case .portrait: return .portrait
    case .portraitUpsideDown: return .portraitUpsideDown
    case .landscapeLeft: return .landscapeRight
    case .landscapeRight: return .landscapeLeft
    default: return .all
    }
  }
}
