package app.sverka.translate

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PairNotSupportedException(source: String, target: String) :
  CodedException("Перевод $source → $target на телефоне не поддерживается")

class TranslationFailedException : CodedException("Перевод на телефоне не удался")

/**
 * Translates recognized text on the phone with ML Kit. The text never leaves the device;
 * a language model (about 30 MB) is downloaded once the first time a language is used.
 */
class SverkaTranslateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SverkaTranslate")

    Constant("engine") { "mlkit-translate-17.0.3" }

    // "installed" — ready offline, "supported" — needs a one-time download, "unsupported" — no such pair.
    AsyncFunction("status") { source: String, target: String, promise: Promise ->
      val from = TranslateLanguage.fromLanguageTag(source)
      val to = TranslateLanguage.fromLanguageTag(target)
      if (from == null || to == null || from == to) {
        promise.resolve("unsupported")
        return@AsyncFunction
      }
      RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel::class.java)
        .addOnSuccessListener { models ->
          val installed = models.map { it.language }.toSet()
          promise.resolve(if (installed.contains(from) && installed.contains(to)) "installed" else "supported")
        }
        .addOnFailureListener { promise.resolve("supported") }
    }

    AsyncFunction("translate") { texts: List<String>, source: String, target: String, promise: Promise ->
      val from = TranslateLanguage.fromLanguageTag(source)
      val to = TranslateLanguage.fromLanguageTag(target)
      if (from == null || to == null || from == to) {
        promise.reject(PairNotSupportedException(source, target))
        return@AsyncFunction
      }
      val translator = Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(from).setTargetLanguage(to).build())
      translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
        .continueWithTask { download ->
          download.exception?.let { throw it }
          com.google.android.gms.tasks.Tasks.whenAllSuccess<String>(texts.map { translator.translate(it) })
        }
        .addOnSuccessListener { results ->
          translator.close()
          promise.resolve(results)
        }
        .addOnFailureListener {
          translator.close()
          promise.reject(TranslationFailedException())
        }
    }
  }
}
