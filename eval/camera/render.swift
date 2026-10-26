// Рисует снимки «любого текста» для проверки съёмки: вывеска, экран телефона,
// страница книги, записка от руки, документ, справка с опечатками на самой бумаге. Тексты придуманы; набор синтетический.
// Запуск: swift render.swift <папка>  → <имя>.png, <имя>_photo.jpg (наклон, перспектива, смаз,
// шум, тёплый свет, как с телефона) и <имя>.txt (эталон, строка за строкой).
import AppKit
import CoreImage

struct Shot {
  let name: String
  let size: CGSize
  let background: NSColor
  let ink: NSColor
  let font: String
  let points: CGFloat
  let lines: [String]
}

let shots: [Shot] = [
  Shot(name: "sign_ru", size: CGSize(width: 1600, height: 900), background: NSColor(red: 0.12, green: 0.25, blue: 0.40, alpha: 1),
       ink: .white, font: "Arial Bold", points: 110, lines: ["АПТЕКА 24 ЧАСА", "Вход со двора", "Тел. 8 800 555-01-47"]),
  Shot(name: "screen_en", size: CGSize(width: 1200, height: 1600), background: NSColor(white: 0.97, alpha: 1),
       ink: NSColor(white: 0.1, alpha: 1), font: "Helvetica", points: 58,
       lines: ["Your order #A7-3051 is ready", "Pickup point: Gate 4", "Code: 0O1l-5S2Z", "Open until 21:30"]),
  Shot(name: "book_pl", size: CGSize(width: 1300, height: 1800), background: NSColor(red: 0.96, green: 0.93, blue: 0.86, alpha: 1),
       ink: NSColor(white: 0.15, alpha: 1), font: "Georgia", points: 46,
       lines: ["Rozdział trzeci", "Pociąg ruszył o świcie, a za oknem", "migały pola, mosty i małe stacje.", "Nikt w przedziale nie mówił ani słowa."]),
  Shot(name: "note_ru", size: CGSize(width: 1400, height: 1000), background: NSColor(red: 1.0, green: 0.97, blue: 0.70, alpha: 1),
       ink: NSColor(red: 0.1, green: 0.15, blue: 0.5, alpha: 1), font: "Noteworthy-Bold", points: 72,
       lines: ["Купить хлеб и молоко", "Позвонить маме в 19:00", "Ключи у соседа"]),
  Shot(name: "doc_ru_en", size: CGSize(width: 1240, height: 1754), background: .white,
       ink: NSColor(white: 0.1, alpha: 1), font: "Times New Roman", points: 40,
       lines: ["СПРАВКА / CERTIFICATE", "Выдана Ивановой Анне Сергеевне", "Issued to Anna Ivanova", "Дата выдачи: 14.10.2026", "Номер: 2026/10-047"]),
  // Typos written on the paper itself, for the typo screen: «сентябр», «бухгалтерей», «Rusia».
  Shot(name: "typos_ru_en", size: CGSize(width: 1240, height: 1000), background: .white,
       ink: NSColor(white: 0.1, alpha: 1), font: "Times New Roman", points: 44,
       lines: ["Справка о доходах", "Доход за сентябр 2026 года", "Выдана бухгалтерей завода", "Moscow, Rusia"]),
]

let out = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")
for shot in shots {
  let image = NSImage(size: shot.size)
  image.lockFocus()
  shot.background.setFill()
  NSRect(origin: .zero, size: shot.size).fill()
  let font = NSFont(name: shot.font, size: shot.points) ?? NSFont.systemFont(ofSize: shot.points)
  let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: shot.ink]
  let lineHeight = shot.points * 1.6
  var y = shot.size.height - shot.points * 2.2
  for line in shot.lines {
    NSAttributedString(string: line, attributes: attrs).draw(at: CGPoint(x: shot.points * 1.2, y: y))
    y -= lineHeight
  }
  image.unlockFocus()
  guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:]) else { fatalError("cannot encode \(shot.name)") }
  try png.write(to: out.appendingPathComponent("\(shot.name).png"))
  try photo(from: png).write(to: out.appendingPathComponent("\(shot.name)_photo.jpg"))
  try (shot.lines.joined(separator: "\n") + "\n").write(to: out.appendingPathComponent("\(shot.name).txt"), atomically: true, encoding: .utf8)
}
print("rendered \(shots.count) shots")

/// Makes the clean render look like a phone photo: the sheet is tilted in perspective,
/// slightly out of focus, noisy and lit by warm uneven light.
func photo(from png: Data) throws -> Data {
  guard let input = CIImage(data: png) else { fatalError("cannot read render") }
  let w = input.extent.width, h = input.extent.height
  let perspective = input.applyingFilter("CIPerspectiveTransform", parameters: [
    "inputTopLeft": CIVector(x: w * 0.06, y: h * 0.97), "inputTopRight": CIVector(x: w * 0.93, y: h * 0.92),
    "inputBottomRight": CIVector(x: w * 0.97, y: h * 0.05), "inputBottomLeft": CIVector(x: w * 0.02, y: h * 0.09),
  ])
  let table = CIImage(color: CIColor(red: 0.42, green: 0.36, blue: 0.30)).cropped(to: input.extent)
  let placed = perspective.composited(over: table)
  let blurred = placed.applyingGaussianBlur(sigma: 2.2).cropped(to: input.extent)
  let warm = blurred.applyingFilter("CITemperatureAndTint", parameters: ["inputNeutral": CIVector(x: 6500, y: 0), "inputTargetNeutral": CIVector(x: 4300, y: 0)])
  let shade = CIFilter(name: "CILinearGradient", parameters: [
    "inputPoint0": CIVector(x: 0, y: 0), "inputPoint1": CIVector(x: w, y: h),
    "inputColor0": CIColor(red: 0, green: 0, blue: 0, alpha: 0.35), "inputColor1": CIColor(red: 0, green: 0, blue: 0, alpha: 0),
  ])!.outputImage!.cropped(to: input.extent)
  let noise = CIFilter(name: "CIRandomGenerator")!.outputImage!.cropped(to: input.extent)
    .applyingFilter("CIColorMatrix", parameters: [
      "inputRVector": CIVector(x: 0.06, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 0, y: 0.06, z: 0, w: 0),
      "inputBVector": CIVector(x: 0, y: 0, z: 0.06, w: 0), "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
      "inputBiasVector": CIVector(x: -0.03, y: -0.03, z: -0.03, w: 0),
    ])
  let result = noise.applyingFilter("CIAdditionCompositing", parameters: ["inputBackgroundImage": shade.composited(over: warm)])
  let context = CIContext()
  guard let jpeg = context.jpegRepresentation(of: result, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                                              options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.8])
  else { fatalError("cannot encode photo") }
  return jpeg
}
