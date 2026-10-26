Pod::Spec.new do |s|
  s.name           = 'SverkaOcr'
  s.version        = '0.1.0'
  s.summary        = 'On-device line recognition for Sverka with Apple Vision'
  s.author         = 'Sverka'
  s.homepage       = 'https://example.invalid/sverka'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '17.0' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '6.0'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'UIKit'
  s.source_files   = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
