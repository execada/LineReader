import ExpoModulesCore
import UIKit

/// Finds misspelled words with the system spell checker (UITextChecker). Nothing leaves the phone.
public final class SverkaSpellModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SverkaSpell")

    Constant("engine") { "uitextchecker" }

    // Two-letter languages the checker has a dictionary for on this phone.
    Function("languages") { () -> [String] in
      Array(Set(UITextChecker.availableLanguages.map { String($0.prefix(2)) })).sorted()
    }

    // UITextChecker belongs to the main thread.
    AsyncFunction("check") { (words: [String], language: String) throws -> [Misspelling] in
      try MainActor.assumeIsolated {
        guard let code = UITextChecker.availableLanguages.first(where: { $0.hasPrefix(language) }) else {
          throw SpellLanguageMissing(language)
        }
        let checker = UITextChecker()
        return words.compactMap { word -> Misspelling? in
          let range = NSRange(location: 0, length: (word as NSString).length)
          let wrong = checker.rangeOfMisspelledWord(in: word, range: range, startingAt: 0, wrap: false, language: code)
          guard wrong.location != NSNotFound else { return nil }
          let guesses = checker.guesses(forWordRange: wrong, in: word, language: code) ?? []
          return Misspelling(word: word, suggestions: Array(guesses.prefix(3)))
        }
      }
    }.runOnQueue(.main)
  }
}

/// A word the checker does not know and its best guesses.
struct Misspelling: Record {
  @Field var word: String = ""
  @Field var suggestions: [String] = []

  init() {}

  init(word: String, suggestions: [String]) {
    self.word = word
    self.suggestions = suggestions
  }
}

final class SpellLanguageMissing: GenericException<String>, @unchecked Sendable {
  override var reason: String { "На телефоне нет словаря для проверки языка \(param)" }
}
