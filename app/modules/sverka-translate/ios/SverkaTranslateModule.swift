import ExpoModulesCore
import SwiftUI
import Translation
import UIKit

/// Translates recognized text on the phone with Apple Translation (iOS 18 and later).
/// The text never leaves the device; language models are downloaded by the system
/// once, after the person agrees in the system sheet.
public final class SverkaTranslateModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SverkaTranslate")

    Constant("engine") { "apple-translation" }

    // "installed" — ready offline, "supported" — needs a one-time download, "unsupported" — no such pair,
    // "unavailable" — this iOS has no on-device translation.
    AsyncFunction("status") { (source: String, target: String) async -> String in
      guard #available(iOS 18.0, *) else { return "unavailable" }
      let status = await LanguageAvailability().status(from: Locale.Language(identifier: source), to: Locale.Language(identifier: target))
      switch status {
      case .installed: return "installed"
      case .supported: return "supported"
      default: return "unsupported"
      }
    }

    AsyncFunction("translate") { (texts: [String], source: String, target: String) async throws -> [String] in
      guard #available(iOS 18.0, *) else { throw TranslationUnavailable() }
      return try await TranslationHost.translate(texts, from: source, to: target)
    }
  }
}

final class TranslationUnavailable: Exception, @unchecked Sendable {
  override var reason: String { "Перевод на телефоне работает с iOS 18" }
}

final class TranslationFailed: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Перевод на телефоне не удался: \(param)" }
}

final class NoWindow: Exception, @unchecked Sendable {
  override var reason: String { "Перевод можно запустить только на открытом экране" }
}

/// Apple Translation hands out sessions only through a SwiftUI modifier, which also shows
/// the system sheet for downloading languages. An invisible SwiftUI view is attached to
/// the current screen for one batch and removed afterwards. The batch ends exactly once:
/// with the result, with an error, when the app goes to the background or after a timeout.
@available(iOS 18.0, *)
@MainActor
enum TranslationHost {
  // Long enough for the person to read the download sheet and for a language pack to download.
  private static let timeout: Duration = .seconds(300)

  static func translate(_ texts: [String], from source: String, to target: String) async throws -> [String] {
    guard !texts.isEmpty else { return [] }
    guard let root = topController() else { throw NoWindow() }
    let configuration = TranslationSession.Configuration(
      source: Locale.Language(identifier: source),
      target: Locale.Language(identifier: target)
    )
    return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[String], Error>) in
      let host = UIHostingController(rootView: AnyView(EmptyView()))
      let batch = Batch(continuation: continuation, host: host)
      host.rootView = AnyView(TranslationRunner(configuration: configuration, texts: texts, finish: batch.finish))
      host.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
      host.view.alpha = 0.01
      host.view.isUserInteractionEnabled = false
      root.addChild(host)
      root.view.addSubview(host.view)
      host.didMove(toParent: root)
      batch.observer = NotificationCenter.default.addObserver(
        forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
      ) { _ in
        MainActor.assumeIsolated { batch.finish(.failure(TranslationFailed("приложение ушло в фон"))) }
      }
      Task { @MainActor in
        try? await Task.sleep(for: timeout)
        batch.finish(.failure(TranslationFailed("перевод не закончился вовремя")))
      }
    }
  }

  private static func topController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
    var top = scene?.keyWindow?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}

/// One translation batch: resumes its continuation once and removes its view and observer.
@available(iOS 18.0, *)
@MainActor
private final class Batch {
  private var continuation: CheckedContinuation<[String], Error>?
  private let host: UIViewController
  var observer: NSObjectProtocol?

  init(continuation: CheckedContinuation<[String], Error>, host: UIViewController) {
    self.continuation = continuation
    self.host = host
  }

  func finish(_ result: Result<[String], Error>) {
    guard let continuation else { return }
    self.continuation = nil
    if let observer { NotificationCenter.default.removeObserver(observer) }
    host.willMove(toParent: nil)
    host.view.removeFromSuperview()
    host.removeFromParent()
    continuation.resume(with: result)
  }
}

@available(iOS 18.0, *)
private struct TranslationRunner: View {
  let configuration: TranslationSession.Configuration
  let texts: [String]
  let finish: @MainActor (Result<[String], Error>) -> Void

  var body: some View {
    Color.clear
      .frame(width: 1, height: 1)
      .translationTask(configuration) { session in
        let result: Result<[String], Error>
        do {
          let requests = texts.enumerated().map { index, text in
            TranslationSession.Request(sourceText: text, clientIdentifier: String(index))
          }
          let responses = try await session.translations(from: requests)
          var out = Array(repeating: "", count: texts.count)
          for response in responses {
            if let id = response.clientIdentifier, let index = Int(id), out.indices.contains(index) {
              out[index] = response.targetText
            }
          }
          result = .success(out)
        } catch {
          result = .failure(TranslationFailed(error.localizedDescription))
        }
        await MainActor.run { finish(result) }
      }
  }
}
