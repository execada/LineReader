// Проверяет PDF из scripts/make-pdf.ts через PDFKit: текст извлекается целиком,
// и строка под центром каждого четырёхугольника из manifest.json совпадает с эталоном.
// Использование: swift scripts/verify-pdf.swift <eval-set-dir> <image-file> <pdf>
import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count == 4 else { print("usage: verify <eval-set-dir> <image-file> <pdf>"); exit(64) }
let (setDir, imageFile, pdfPath) = (args[1], args[2], args[3])
let pxToPt = 72.0 / 150.0

let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: setDir + "/manifest.json"))) as! [String: Any]
let entry = (manifest["images"] as! [[String: Any]]).first { $0["file"] as? String == imageFile }!
let lines = entry["lines"] as! [[String: Any]]

guard let doc = PDFDocument(url: URL(fileURLWithPath: pdfPath)), let page = doc.page(at: 0) else {
    print("cannot open \(pdfPath)"); exit(1)
}
let pageHeight = page.bounds(for: .mediaBox).height
let full = page.string ?? ""

var exact = 0
for line in lines {
    let text = line["text"] as! String
    let poly = (line["polygon"] as! [[Double]])
    let cx = poly.map { $0[0] }.reduce(0, +) / Double(poly.count) * pxToPt
    let cy = poly.map { $0[1] }.reduce(0, +) / Double(poly.count) * pxToPt
    let center = CGPoint(x: cx, y: pageHeight - cy)
    let got = page.selectionForLine(at: center)?.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if got == text { exact += 1 } else { print("  differs: want «\(text)» got «\(got)»") }
}
let allPresent = lines.allSatisfy { full.contains($0["text"] as! String) }
print("\(imageFile): строк \(lines.count), совпало по центру рамки \(exact), весь текст извлекается: \(allPresent)")
