require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'NitroPerf'
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = 'https://github.com/nitroperf/react-native-perf-monitor'
  s.license      = package['license']
  s.authors      = 'NitroPerf Contributors'
  s.source       = { :git => 'https://github.com/nitroperf/react-native-perf-monitor.git', :tag => s.version }

  s.platforms    = { :ios => '13.0' }
  s.swift_version = '5.0'

  # Source files
  s.source_files = [
    'ios/**/*.{h,m,mm,swift}',
    'cpp/**/*.{hpp,cpp,mm}',
  ]

  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/cpp" "$(PODS_TARGET_SRCROOT)/nitrogen/generated/shared/c++"',
  }

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  # Load nitrogen autolinking
  autolinking_script = File.join(__dir__, 'nitrogen', 'generated', 'ios', 'NitroPerf+autolinking.rb')
  if File.exist?(autolinking_script)
    load autolinking_script
    add_nitrogen_files(s)
  end
end
