import Foundation
import React
import StoreKit
import UIKit
import PDFKit

extension Notification.Name {
  static let craftoonProChanged = Notification.Name("CraftoonProChanged")
}

// Entitlements come from StoreKit's verified transactions, never a local toggle.
actor CraftoonPurchaseStore {
  static let shared = CraftoonPurchaseStore()
  let productID: String
  private var product: Product?
  private var updates: Task<Void, Never>?

  init() {
    productID = Bundle.main.object(forInfoDictionaryKey: "CraftoonProProductID") as? String ?? "com.craftoon.pro.unlock"
  }

  func startObserving() {
    guard updates == nil else { return }
    updates = Task { [weak self] in
      for await result in StoreKit.Transaction.updates {
        guard let self else { return }
        if case .verified(let transaction) = result, transaction.productID == self.productID {
          await transaction.finish()
          let status = await self.status()
          await MainActor.run {
            NotificationCenter.default.post(name: .craftoonProChanged, object: nil, userInfo: status)
          }
        }
      }
    }
  }

  func hasProAccess() async -> Bool {
    for await result in StoreKit.Transaction.currentEntitlements {
      if case .verified(let transaction) = result,
         transaction.productID == productID,
         transaction.revocationDate == nil,
         transaction.expirationDate.map({ $0 > Date() }) ?? true { return true }
    }
    return false
  }

  private func loadProduct() async throws -> Product {
    if let product { return product }
    guard let fetched = try await Product.products(for: [productID]).first,
          fetched.type == .nonConsumable else {
      throw NSError(domain: "CraftoonPro", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Purchases are currently unavailable. Please try again later."])
    }
    product = fetched
    return fetched
  }

  func status() async -> [String: Any] {
    let enabled = await hasProAccess()
    let available = try? await loadProduct()
    return ["isPro": enabled,
      "canPurchase": available != nil && SKPaymentQueue.canMakePayments(),
      "displayPrice": available?.displayPrice ?? "", "productId": productID,
      "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
      "developerName": Bundle.main.object(forInfoDictionaryKey: "CraftoonDeveloperName") as? String ?? ""]
  }

  func purchase() async throws -> [String: Any] {
    startObserving()
    guard SKPaymentQueue.canMakePayments() else {
      throw NSError(domain: "CraftoonPro", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Purchases are not allowed on this device."])
    }
    let product = try await loadProduct()
    let outcome: String
    switch try await Self.confirmPurchase(product) {
    case .success(let result):
      guard case .verified(let transaction) = result,
            transaction.productID == productID, transaction.revocationDate == nil else {
        throw NSError(domain: "CraftoonPro", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "This purchase could not be verified. Please restore purchases or try again."])
      }
      await transaction.finish()
      outcome = "purchased"
    case .userCancelled: outcome = "cancelled"
    case .pending: outcome = "pending"
    @unknown default: outcome = "pending"
    }
    var result = await status()
    if outcome == "purchased" { result["isPro"] = true }
    result["outcome"] = outcome
    return result
  }

  @MainActor
  private static func confirmPurchase(_ product: Product) async throws -> Product.PurchaseResult {
    if #available(iOS 17.0, *),
       let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
      return try await product.purchase(confirmIn: scene)
    }
    return try await product.purchase()
  }

  func restore() async throws -> [String: Any] {
    try await AppStore.sync()
    var result = await status()
    result["outcome"] = "restored"
    return result
  }

  func redeem() async throws -> [String: Any] {
    startObserving()
    try await Self.presentRedemption()
    var result = await status()
    result["outcome"] = "redeemed"
    return result
  }

  @MainActor
  private static func presentRedemption() async throws {
    guard #available(iOS 16.3, *) else {
      throw NSError(domain: "CraftoonPro", code: 4, userInfo: [NSLocalizedDescriptionKey:
        "Please update to iPadOS 16.3 or later to enter an offer code."])
    }
    guard let presenter = RCTPresentedViewController(),
          let scene = presenter.view.window?.windowScene,
          scene.activationState == .foregroundActive else {
      throw NSError(domain: "CraftoonPro", code: 5, userInfo: [NSLocalizedDescriptionKey:
        "Could not open code entry. Please try again."])
    }
    // Verified transactions (including later deliveries) use the same observer
    // and native entitlement checks as paid purchases.
    try await AppStore.presentOfferCodeRedeemSheet(in: scene)
  }
}

private final class CraftoonGuideController: UIViewController {
  private let pdf = PDFView()
  private var fittedSize: CGSize = .zero

  static func documentURL() -> URL? {
    Bundle.main.url(forResource: "craftoon-quick-guide", withExtension: "pdf")
  }

  private func loadGuide() {
    guard let url = Self.documentURL() else { return }
    if pdf.document?.documentURL == url { return }
    pdf.document = PDFDocument(url: url)
    pdf.accessibilityLabel = "Craftoon quick guide"
    fittedSize = .zero
    pdf.autoScales = true
    view.setNeedsLayout()
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "Craftoon Quick Guide"
    view.backgroundColor = .systemBackground
    navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .done,
      target: self, action: #selector(closeGuide))
    pdf.translatesAutoresizingMaskIntoConstraints = false
    pdf.displayMode = .singlePage
    pdf.displaysPageBreaks = false
    pdf.autoScales = true
    loadGuide()
    view.addSubview(pdf)
    NSLayoutConstraint.activate([
      pdf.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      pdf.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
      pdf.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
      pdf.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
    ])
  }
  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    // PDFKit may choose its initial scale before the navigation bar and safe
    // area have their final sizes. Fit again only when bounds/document change,
    // so the whole guide is visible without resetting the user's pinch zoom.
    guard pdf.bounds.width > 0, pdf.bounds.height > 0,
          fittedSize != pdf.bounds.size else { return }
    fittedSize = pdf.bounds.size
    pdf.layoutIfNeeded()
    pdf.scaleFactor = pdf.scaleFactorForSizeToFit
    pdf.goToFirstPage(nil)
  }
  @objc private func closeGuide() { dismiss(animated: true) }
}

@objc(CraftoonPro)
class CraftoonPro: RCTEventEmitter {
  private var observer: NSObjectProtocol?
  override static func requiresMainQueueSetup() -> Bool { true }
  override init() {
    super.init()
    Task { await CraftoonPurchaseStore.shared.startObserving() }
  }
  override func supportedEvents() -> [String]! { ["CraftoonProChanged"] }
  override func startObserving() {
    observer = NotificationCenter.default.addObserver(forName: .craftoonProChanged, object: nil, queue: .main) { [weak self] notification in
      self?.sendEvent(withName: "CraftoonProChanged", body: notification.userInfo)
    }
  }
  override func stopObserving() {
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
  }
  deinit { if let observer { NotificationCenter.default.removeObserver(observer) } }

  @objc func getStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { resolve(await CraftoonPurchaseStore.shared.status()) }
  }
  @objc func purchase(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do { resolve(try await CraftoonPurchaseStore.shared.purchase()) }
      catch { reject("PURCHASE_FAILED", error.localizedDescription, error) }
    }
  }
  @objc func restore(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do { resolve(try await CraftoonPurchaseStore.shared.restore()) }
      catch { reject("RESTORE_FAILED", error.localizedDescription, error) }
    }
  }
  @objc func redeem(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do { resolve(try await CraftoonPurchaseStore.shared.redeem()) }
      catch { reject("REDEMPTION_FAILED", error.localizedDescription, error) }
    }
  }
  @objc func showManual(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let presenter = RCTPresentedViewController(), !presenter.isBeingDismissed else {
        reject("GUIDE_UNAVAILABLE", "Could not open the quick guide. Please try again.", nil)
        return
      }
      guard CraftoonGuideController.documentURL() != nil else {
        reject("GUIDE_UNAVAILABLE", "Could not open the quick guide. Please try again.", nil)
        return
      }
      let navigation = UINavigationController(rootViewController: CraftoonGuideController())
      navigation.modalPresentationStyle = .fullScreen
      presenter.present(navigation, animated: true) { resolve(nil) }
    }
  }
}
