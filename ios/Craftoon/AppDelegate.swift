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
    // UIKit owns automatic rotation. Requesting the same geometry again from
    // every device notification interrupts its in-flight rotation animation.
    if CraftoonOrientationDiagnostics.enabled {
      orientationObserver = NotificationCenter.default.addObserver(
        forName: UIDevice.orientationDidChangeNotification, object: nil, queue: .main
      ) { [weak self] _ in
        guard let scene = self?.window?.windowScene,
          let root = self?.window?.rootViewController else { return }
        CraftoonOrientationDiagnostics.record("physical_orientation", scene: scene, root: root)
      }
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

  @available(iOS 27.0, *)
  func supportedInterfaceOrientations(for windowScene: UIWindowScene) -> UIInterfaceOrientationMask {
    CraftoonOrientationState.mask
  }

  @available(iOS 26.0, *)
  func windowScene(_ windowScene: UIWindowScene, didUpdateEffectiveGeometry previousEffectiveGeometry: UIWindowScene.Geometry) {
    if CraftoonOrientationDiagnostics.enabled, let root = window?.rootViewController {
      CraftoonOrientationDiagnostics.record("scene_geometry", scene: windowScene, root: root)
    }
    guard CraftoonOrientationState.mask != .all,
      previousEffectiveGeometry.interfaceOrientation != windowScene.effectiveGeometry.interfaceOrientation,
      let root = window?.rootViewController else { return }
    CraftoonOrientationState.updateLockPreference(on: root)
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    let appDelegate = UIApplication.shared.delegate as! AppDelegate
    let newWindow: UIWindow = CraftoonStrokeDiagnostics.enabled
      ? CraftoonStrokeDiagnosticWindow(windowScene: windowScene) : CraftoonInputWindow(windowScene: windowScene)
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

// A Pencil contact that restarts just outside the selected panel must belong
// to its canvas from the beginning. UIKit cannot transfer it on re-entry.
class CraftoonInputWindow: UIWindow {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let normal = super.hitTest(point, with: event)
    guard event?.allTouches?.contains(where: { touch in
      guard touch.type == .pencil, touch.phase == .began else { return false }
      let location = touch.location(in: self)
      return hypot(location.x - point.x, location.y - point.y) < 1
    }) == true,
      rootViewController?.presentedViewController == nil else { return normal }
    return RNPencilKitView.pencilMarginTarget(at: point, in: self, normalTarget: normal, event: event) ?? normal
  }
}

// Launch-only observation, with no additional gesture recognizers.
private final class CraftoonStrokeDiagnosticWindow: CraftoonInputWindow {
  override func sendEvent(_ event: UIEvent) {
    RNPencilKitView.recordStrokeEvent(event, stage: "before_dispatch")
    super.sendEvent(event)
    RNPencilKitView.recordStrokeEvent(event, stage: "after_dispatch")
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
  override func createRootViewController() -> UIViewController {
    CraftoonRootViewController()
  }
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

class CraftoonRootViewController: UIViewController {
  // UIApplication's legacy status-bar setters are no-ops with SDK 27.
  // Own this preference natively so every app screen stays immersive.
  override var prefersStatusBarHidden: Bool { true }
  override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation { .none }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { CraftoonOrientationState.mask }

  @available(iOS 26.0, *)
  override var prefersInterfaceOrientationLocked: Bool {
    guard let scene = viewIfLoaded?.window?.windowScene else { return false }
    return CraftoonOrientationState.shouldLock(interfaceOrientation: scene.effectiveGeometry.interfaceOrientation)
  }
}


// Editor/reader use one supported orientation. Library and splash use all
// orientations so UIKit can follow the physical iPad again.
enum CraftoonOrientationState {
  static var mask: UIInterfaceOrientationMask = .all
  static var generation = 0
  static func shouldLock(interfaceOrientation: UIInterfaceOrientation) -> Bool {
    guard mask != .all, interfaceOrientation != .unknown else { return false }
    let current = UIInterfaceOrientationMask(rawValue: 1 << interfaceOrientation.rawValue)
    return mask.contains(current)
  }
  static func updateLockPreference(on controller: UIViewController) {
    if #available(iOS 26.0, *) {
      controller.setNeedsUpdateOfPrefersInterfaceOrientationLocked()
    }
    if CraftoonOrientationDiagnostics.enabled {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak controller] in
        guard let controller, let scene = controller.viewIfLoaded?.window?.windowScene else { return }
        CraftoonOrientationDiagnostics.record("lock_preference_settled", scene: scene, root: controller)
      }
    }
  }
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

// Opt-in geometry-only logging: no profiler, screenshots or drawing data.
enum CraftoonOrientationDiagnostics {
  static let enabled = ProcessInfo.processInfo.arguments.contains("--craftoon-measure-orientation")
  private static let queue = DispatchQueue(label: "com.craftoon.orientation-diagnostics", qos: .utility)
  static func record(_ stage: String, scene: UIWindowScene, root: UIViewController) {
    guard enabled else { return }
    var values: [String: Any] = ["stage": stage, "timeMs": Date().timeIntervalSince1970 * 1000,
      "mask": CraftoonOrientationState.mask.rawValue,
      "physicalOrientation": UIDevice.current.orientation.rawValue,
      "root": String(describing: type(of: root)),
      "prefersStatusBarHidden": root.prefersStatusBarHidden,
      "statusBarHidden": scene.statusBarManager?.isStatusBarHidden ?? false,
      "presented": root.presentedViewController.map { String(describing: type(of: $0)) } ?? "none",
      "windowBounds": String(describing: root.viewIfLoaded?.window?.bounds ?? .zero),
      "screenBounds": String(describing: scene.screen.bounds)]
    if #available(iOS 26.0, *) {
      values["interfaceOrientation"] = scene.effectiveGeometry.interfaceOrientation.rawValue
      values["sceneBounds"] = String(describing: scene.effectiveGeometry.coordinateSpace.bounds)
      values["prefersLocked"] = root.prefersInterfaceOrientationLocked
      values["actuallyLocked"] = scene.effectiveGeometry.isInterfaceOrientationLocked
    }
    let snapshot = values
    queue.async {
      do {
        let folder = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let url = folder.appendingPathComponent("CraftoonOrientation.jsonl")
        var data = try JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys])
        data.append(10)
        if !FileManager.default.fileExists(atPath: url.path) { try data.write(to: url, options: .atomic); return }
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        if try handle.seekToEnd() > 100_000 { try handle.truncate(atOffset: 0); try handle.seek(toOffset: 0) }
        try handle.write(contentsOf: data)
      } catch { NSLog("Orientation diagnostic write failed: %@", error.localizedDescription) }
    }
  }
}
