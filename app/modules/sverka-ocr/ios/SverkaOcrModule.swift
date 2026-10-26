import ExpoModulesCore
import UIKit
import Vision

/// Recognizes text lines on the phone with Apple Vision. Nothing leaves the device.
public final class SverkaOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SverkaOcr")

    Constant("engine") { "apple-vision" }

    AsyncFunction("supportedLanguages") { () throws -> [String] in
      try VNRecognizeTextRequest().supportedRecognitionLanguages()
    }

    // Documents are photos of private papers; keep them out of iCloud and computer backups.
    AsyncFunction("excludeFromBackup") { (uri: String) throws in
      guard var url = URL(string: uri), url.isFileURL else {
        throw ImageNotReadable()
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }

    AsyncFunction("recognize") { (uri: String, languages: [String], customWords: [String]) throws -> [String: Any] in
      let image = try uprightImage(uri)
      return try recognizeLines(in: image, languages: languages, customWords: customWords)
    }
  }
}

final class ImageNotReadable: Exception, @unchecked Sendable {
  override var reason: String { "Не удалось открыть снимок для распознавания" }
}

final class LanguageNotSupported: GenericException<[String]>, @unchecked Sendable {
  override var reason: String { "Языки не поддерживаются распознаванием на телефоне: \(param.joined(separator: ", "))" }
}

final class RecognitionFailed: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Распознавание на телефоне не удалось: \(param)" }
}

/// Loads the file and redraws it with orientation applied, so Vision's
/// coordinates match the pixels the app shows and crops.
private func uprightImage(_ uri: String) throws -> CGImage {
  guard let url = URL(string: uri), url.isFileURL,
        let image = UIImage(contentsOfFile: url.path) else {
    throw ImageNotReadable()
  }
  if image.imageOrientation == .up, let cg = image.cgImage {
    return cg
  }
  let format = UIGraphicsImageRendererFormat.default()
  format.scale = 1
  let upright = UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
    image.draw(in: CGRect(origin: .zero, size: image.size))
  }
  guard let cg = upright.cgImage else {
    throw ImageNotReadable()
  }
  return cg
}

private func recognizeLines(in image: CGImage, languages: [String], customWords: [String]) throws -> [String: Any] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  let supported = Set(try request.supportedRecognitionLanguages())
  let missing = languages.filter { !supported.contains($0) }
  guard missing.isEmpty else {
    throw LanguageNotSupported(missing)
  }
  request.recognitionLanguages = languages
  request.customWords = customWords

  do {
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
  } catch {
    throw RecognitionFailed(error.localizedDescription)
  }

  let width = Double(image.width)
  let height = Double(image.height)
  // Vision uses normalized coordinates with the origin at the bottom left.
  func pixel(_ p: CGPoint) -> [String: Double] {
    ["x": p.x * width, "y": (1 - p.y) * height]
  }
  let lines: [[String: Any]] = (request.results ?? []).compactMap { (observation: VNRecognizedTextObservation) -> [String: Any]? in
    let top = observation.topCandidates(3)
    guard let best = top.first else { return nil }
    return [
      "text": best.string,
      "confidence": Double(best.confidence),
      "candidates": top.map { (c: VNRecognizedText) -> [String: Any] in
        ["text": c.string, "confidence": Double(c.confidence)]
      },
      "quad": [
        pixel(observation.topLeft),
        pixel(observation.topRight),
        pixel(observation.bottomRight),
        pixel(observation.bottomLeft),
      ],
    ]
  }
  return ["width": image.width, "height": image.height, "lines": lines]
}
