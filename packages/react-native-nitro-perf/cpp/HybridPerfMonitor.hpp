#pragma once

#include <memory>
#include <mutex>
#include <atomic>
#include <functional>
#include <unordered_map>
#include <thread>

#include "FPSTracker.hpp"
#include "PlatformMetrics.hpp"

// Forward declare the nitrogen-generated spec
// In a real build, this would be #include "HybridPerfMonitorSpec.hpp"
// from nitrogen/generated/shared/

namespace nitroperf {

struct PerfSnapshot {
  double uiFps;
  double jsFps;
  double ramBytes;
  double jsHeapUsedBytes;
  double jsHeapTotalBytes;
  double droppedFrames;
  double stutterCount;
  double timestamp;
};

struct FPSHistoryData {
  std::vector<double> uiFpsSamples;
  std::vector<double> jsFpsSamples;
  double uiFpsMin;
  double uiFpsMax;
  double jsFpsMin;
  double jsFpsMax;
};

struct PerfConfig {
  double updateIntervalMs;
  double maxHistorySamples;
  double targetFps;
};

/**
 * HybridPerfMonitor — the main Nitro HybridObject.
 * Orchestrates FPS tracking, memory sampling, and subscriber notification.
 */
class HybridPerfMonitor {
public:
  HybridPerfMonitor();
  ~HybridPerfMonitor();

  // Nitro interface methods
  void start();
  void stop();
  bool getIsRunning() const;

  PerfSnapshot getMetrics();
  FPSHistoryData getHistory();

  int subscribe(std::function<void(PerfSnapshot)> callback);
  void unsubscribe(int id);

  void reportJsFrameTick(double timestampMs);

  void configure(const PerfConfig& config);
  void reset();

private:
  void notifySubscribers();
  void timerLoop();
  double getCurrentTimestamp() const;

  std::unique_ptr<FPSTracker> uiFpsTracker_;
  std::unique_ptr<FPSTracker> jsFpsTracker_;
  std::unique_ptr<PlatformMetrics> platform_;

  std::atomic<bool> isRunning_{false};
  std::atomic<int> updateIntervalMs_{500};
  int targetFps_ = 60;

  // Subscriber management
  mutable std::mutex subscriberMutex_;
  std::unordered_map<int, std::function<void(PerfSnapshot)>> subscribers_;
  std::atomic<int> nextSubscriberId_{1};

  // Notification timer thread
  std::thread timerThread_;
  std::atomic<bool> timerRunning_{false};

  // JS heap values (set from JS side or Hermes instrumentation)
  std::atomic<int64_t> jsHeapUsed_{0};
  std::atomic<int64_t> jsHeapTotal_{0};
};

} // namespace nitroperf
