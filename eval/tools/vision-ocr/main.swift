// vision-ocr: распознаёт изображение через Apple Vision (VNRecognizeTextRequest, .accurate)
// и печатает JSON со строками, уверенностью, до 3 кандидатов и рамкой в пикселях (начало координат сверху слева).
// Использование: vision-ocr <image> <lang>[,<lang>...]
import Foundation
import Vision
import ImageIO

struct Candidate: Encodable {
    let text: String
    let confidence: Float
}

struct Line: Encodable {
    let text: String
    let confidence: Float
    let bbox: [Int]
    let candidates: [Candidate]
}

struct Output: Encodable {
    let engine: String
    let languages: [String]
    let lines: [Line]
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

let args = CommandLine.arguments
guard args.count == 3 else { fail("usage: vision-ocr <image> <lang>[,<lang>...]") }
let url = URL(fileURLWithPath: args[1])
let languages = args[2].split(separator: ",").map(String.init)

guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fail("cannot read image: \(url.path)")
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
let supported: [String]
do {
    supported = try request.supportedRecognitionLanguages()
} catch {
    fail("cannot list Vision languages: \(error.localizedDescription)")
}
let unsupported = languages.filter { !supported.contains($0) }
guard unsupported.isEmpty else { fail("unsupported languages: \(unsupported.joined(separator: ","))") }
request.recognitionLanguages = languages

do {
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
} catch {
    fail("vision failed: \(error.localizedDescription)")
}

let width = Double(image.width), height = Double(image.height)
let lines: [Line] = (request.results ?? []).compactMap { observation in
    let top = observation.topCandidates(3)
    guard let best = top.first else { return nil }
    let box = observation.boundingBox
    return Line(
        text: best.string,
        confidence: best.confidence,
        bbox: [Int(box.minX * width), Int((1 - box.maxY) * height), Int(box.width * width), Int(box.height * height)],
        candidates: top.map { Candidate(text: $0.string, confidence: $0.confidence) }
    )
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
let data = try encoder.encode(Output(engine: "apple-vision-macos-accurate", languages: languages, lines: lines))
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
