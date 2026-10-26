package app.sverka.ocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.googlecode.tesseract.android.TessBaseAPI
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val TESSDATA = "tessdata"

class ImageNotReadableException : CodedException("Не удалось открыть снимок для распознавания")

class LanguageNotInstalledException(missing: List<String>) :
  CodedException("Нет моделей распознавания на телефоне для языков: ${missing.joinToString(", ")}")

class RecognitionFailedException : CodedException("Распознавание на телефоне не удалось")

/** Recognizes text lines on the phone with Tesseract (Tesseract4Android). Nothing leaves the device. */
class SverkaOcrModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("SverkaOcr")

    Constant("engine") { "tesseract4android-4.9.0" }

    AsyncFunction("supportedLanguages") {
      installModels(context)
      installedLanguages(context)
    }

    // Android backup is disabled for the whole app (allowBackup=false in app.json).
    AsyncFunction("excludeFromBackup") { _: String -> }

    // customWords are a Vision feature; Tesseract has no equivalent here, so they are not used.
    AsyncFunction("recognize") { uri: String, languages: List<String>, _: List<String> ->
      installModels(context)
      val missing = languages - installedLanguages(context).toSet()
      if (languages.isEmpty() || missing.isNotEmpty()) {
        throw LanguageNotInstalledException(missing)
      }
      val bitmap = try {
        uprightBitmap(context, Uri.parse(uri))
      } catch (e: OutOfMemoryError) {
        throw ImageNotReadableException()
      }
      try {
        recognizeLines(context, bitmap, languages)
      } finally {
        bitmap.recycle()
      }
    }
  }
}

/** Copies bundled *.traineddata from APK assets to app storage, where Tesseract can read them. */
private fun installModels(context: Context) {
  val target = File(context.filesDir, TESSDATA).apply { mkdirs() }
  val bundled = context.assets.list(TESSDATA).orEmpty().filter { it.endsWith(".traineddata") }
  for (name in bundled) {
    val file = File(target, name)
    if (file.exists()) continue
    val partial = File(target, "$name.part")
    context.assets.open("$TESSDATA/$name").use { input -> partial.outputStream().use { input.copyTo(it) } }
    if (!partial.renameTo(file)) throw RecognitionFailedException()
  }
}

private fun installedLanguages(context: Context): List<String> =
  File(context.filesDir, TESSDATA).listFiles().orEmpty()
    .map { it.name }
    .filter { it.endsWith(".traineddata") && it != "osd.traineddata" }
    .map { it.removeSuffix(".traineddata") }
    .sorted()

/** Decodes the file and applies its EXIF rotation, so boxes match the picture the app shows. */
private fun uprightBitmap(context: Context, uri: Uri): Bitmap {
  val resolver = context.contentResolver
  val decoded = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
    ?: throw ImageNotReadableException()
  val degrees = resolver.openInputStream(uri)?.use { ExifInterface(it).rotationDegrees } ?: 0
  if (degrees == 0) return decoded
  val rotated = Bitmap.createBitmap(
    decoded, 0, 0, decoded.width, decoded.height, Matrix().apply { postRotate(degrees.toFloat()) }, true,
  )
  decoded.recycle()
  return rotated
}

private fun recognizeLines(context: Context, bitmap: Bitmap, languages: List<String>): Map<String, Any> {
  val api = TessBaseAPI()
  try {
    if (!api.init(context.filesDir.absolutePath, languages.joinToString("+"), TessBaseAPI.OEM_LSTM_ONLY)) {
      throw RecognitionFailedException()
    }
    api.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO)
    api.setImage(bitmap)
    // getUTF8Text runs recognition; the iterator below reads its result.
    api.getUTF8Text() ?: throw RecognitionFailedException()

    val lines = mutableListOf<Map<String, Any>>()
    val level = TessBaseAPI.PageIteratorLevel.RIL_TEXTLINE
    val iterator = api.resultIterator ?: return page(bitmap, lines)
    try {
      iterator.begin()
      do {
        val text = iterator.getUTF8Text(level)?.trim().orEmpty()
        val box = iterator.getBoundingRect(level)
        if (text.isNotEmpty() && box != null) {
          val confidence = (iterator.confidence(level) / 100f).coerceIn(0f, 1f).toDouble()
          lines += mapOf(
            "text" to text,
            "confidence" to confidence,
            // Tesseract gives one reading per line, so the only candidate is the line itself.
            "candidates" to listOf(mapOf("text" to text, "confidence" to confidence)),
            "quad" to listOf(
              point(box.left, box.top), point(box.right, box.top),
              point(box.right, box.bottom), point(box.left, box.bottom),
            ),
          )
        }
      } while (iterator.next(level))
    } finally {
      iterator.delete()
    }
    return page(bitmap, lines)
  } finally {
    api.recycle()
  }
}

private fun point(x: Int, y: Int) = mapOf("x" to x.toDouble(), "y" to y.toDouble())

private fun page(bitmap: Bitmap, lines: List<Map<String, Any>>) =
  mapOf("width" to bitmap.width, "height" to bitmap.height, "lines" to lines)
