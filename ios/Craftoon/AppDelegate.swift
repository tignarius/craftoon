import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import PencilKit

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
    let newWindow = UIWindow(windowScene: windowScene)
    self.window = newWindow
    appDelegate.window = newWindow

    if ProcessInfo.processInfo.arguments.contains("--craftoon-native-palette-screen") {
      newWindow.rootViewController = CraftoonNativePaletteDiagnosticController()
      newWindow.makeKeyAndVisible()
      return
    }
    guard let factory = appDelegate.reactNativeFactory else { return }

    factory.startReactNative(
      withModuleName: "Craftoon",
      in: newWindow,
      launchOptions: nil
    )
  }
}

// Launch-only isolation screen. No React surface, panel clipping, zoom,
// custom recognizers, document restoration, or draft writes participate.
private final class CraftoonNativePaletteDiagnosticController: UIViewController {
  private let canvas = PKCanvasView()
  private let picker = PKToolPicker()
  private var connected = false

  override func viewDidLoad() {
    super.viewDidLoad()
    overrideUserInterfaceStyle = .light
    view.backgroundColor = .white
    let label = UILabel()
    label.text = "Palette input test — existing comics are preserved"
    label.font = .systemFont(ofSize: 16, weight: .medium)
    label.textAlignment = .center
    label.translatesAutoresizingMaskIntoConstraints = false
    canvas.translatesAutoresizingMaskIntoConstraints = false
    canvas.backgroundColor = .white
    canvas.drawingPolicy = .anyInput
    view.addSubview(label)
    view.addSubview(canvas)
    NSLayoutConstraint.activate([
      label.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
      label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
      label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
      label.heightAnchor.constraint(equalToConstant: 28),
      canvas.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 8),
      canvas.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      canvas.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      canvas.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    picker.overrideUserInterfaceStyle = .light
    picker.colorUserInterfaceStyle = .light
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !connected else { return }
    connected = true
    picker.addObserver(canvas)
    picker.setVisible(true, forFirstResponder: canvas)
    canvas.becomeFirstResponder()
    CraftoonPanelPerformance.write(["stage": "isolated_native_palette_started"])
  }

  deinit {
    picker.removeObserver(canvas)
    picker.setVisible(false, forFirstResponder: canvas)
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
