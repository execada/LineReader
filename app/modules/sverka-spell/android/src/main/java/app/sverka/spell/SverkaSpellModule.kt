package app.sverka.spell

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.textservice.SentenceSuggestionsInfo
import android.view.textservice.SpellCheckerSession
import android.view.textservice.SuggestionsInfo
import android.view.textservice.TextInfo
import android.view.textservice.TextServicesManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

// A keyboard that never answers must not leave the check hanging.
private const val TIMEOUT_MS = 5_000L

class SpellCheckFailedException : CodedException("Проверка орфографии на телефоне не ответила")

class SpellCheckerMissingException : CodedException("На телефоне нет проверки орфографии: включите её в настройках клавиатуры")

/**
 * Finds misspelled words with the phone's spell checker (the one the keyboard provides).
 * The words go to that keyboard service; which languages work depends on it.
 */
class SverkaSpellModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("SverkaSpell")

    Constant("engine") { "android-spellchecker" }

    // The keyboard does not say which dictionaries it has; the app asks per language and gets empty results.
    Function("languages") { listOf("ru", "en", "de", "pl", "tr", "ar") }

    AsyncFunction("check") { words: List<String>, language: String, promise: Promise ->
      if (words.isEmpty()) {
        promise.resolve(emptyList<Map<String, Any>>())
        return@AsyncFunction
      }
      val tsm = context.getSystemService(Context.TEXT_SERVICES_MANAGER_SERVICE) as TextServicesManager
      val handler = Handler(Looper.getMainLooper())
      val settled = AtomicBoolean(false)
      var session: SpellCheckerSession? = null
      // Settles the promise once, closes the session and drops the timeout, whichever comes first.
      val settle = { result: List<Map<String, Any>>?, error: CodedException? ->
        if (settled.compareAndSet(false, true)) {
          handler.removeCallbacksAndMessages(null)
          session?.close()
          if (error != null) promise.reject(error) else promise.resolve(result)
        }
      }
      val listener = object : SpellCheckerSession.SpellCheckerSessionListener {
        override fun onGetSuggestions(results: Array<out SuggestionsInfo>?) = Unit

        // One TextInfo per word; its cookie is the word's index, so results map back even if reordered.
        override fun onGetSentenceSuggestions(results: Array<out SentenceSuggestionsInfo>?) {
          try {
            val out = results.orEmpty().flatMap { sentence ->
              (0 until sentence.suggestionsCount).mapNotNull { j ->
                val info = sentence.getSuggestionsInfoAt(j)
                words.getOrNull(info.cookie)?.let { misspelled(it, info) }
              }
            }
            settle(out.distinctBy { it["word"] }, null)
          } catch (e: RuntimeException) {
            settle(null, SpellCheckFailedException())
          }
        }
      }
      val opened = tsm.newSpellCheckerSession(null, Locale.forLanguageTag(language), listener, false)
      if (opened == null) {
        settle(null, SpellCheckerMissingException())
        return@AsyncFunction
      }
      session = opened
      handler.postDelayed({ settle(null, SpellCheckFailedException()) }, TIMEOUT_MS)
      opened.getSentenceSuggestions(words.mapIndexed { i, w -> TextInfo(w, i, i) }.toTypedArray(), 3)
    }
  }

  private fun misspelled(word: String, info: SuggestionsInfo): Map<String, Any>? {
    val typo = info.suggestionsAttributes and SuggestionsInfo.RESULT_ATTR_LOOKS_LIKE_TYPO != 0
    val known = info.suggestionsAttributes and SuggestionsInfo.RESULT_ATTR_IN_THE_DICTIONARY != 0
    if (!typo || known) return null
    val suggestions = (0 until maxOf(0, info.suggestionsCount)).map { info.getSuggestionAt(it) }
    return mapOf("word" to word, "suggestions" to suggestions)
  }
}
