Pod::Spec.new do |s|
  s.name           = 'SverkaTranslate'
  s.version        = '0.1.0'
  s.summary        = 'On-device translation for Sverka with Apple Translation'
  s.author         = 'Sverka'
  s.homepage       = 'https://example.invalid/sverka'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '17.0' }
  s.source         = { :git => '' }
  s.static_framework = true
  # Swift 5 mode: Apple Translation's session is not Sendable yet, and Swift 6 rejects
  # using it inside the SwiftUI task that hands it out.
  s.swift_version  = '5.10'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'SwiftUI', 'UIKit'
  s.weak_frameworks = 'Translation'
  s.source_files   = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
