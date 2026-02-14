#pragma once

#include <memory>
#include <mutex>
#include <atomic>
#include <functional>
#include <unordered_map>
#include <thread>

#include "HybridPerfMonitorSpec.hpp"
#include "FPSTracker.hpp"
#include "PlatformMetrics.hpp"

namespace margelo::nitro::nitroperf {

/**
 * HybridPerfMonitor — the main Nitro HybridObject.
 * Inherits from the nitrogen-generated HybridPerfMonitorSpec.
 * Orchestrates FPS tracking, memory sampling, and subscriber notification.
 */
class HybridPerfMonitor : public HybridPerfMonitorSpec {
public:
  HybridPerfMonitor();
  ~HybridPerfMonitor() override;

  // HybridPerfMonitorSpec interface
  bool getIsRunning() override;
  void start() override;
  void stop() override;
  PerfSnapshot getMetrics() override;
  FPSHistory getHistory() override;
  double subscribe(const std::function<void(const PerfSnapshot&)>& cb) override;
  void unsubscribe(double id) override;
  void reportJsFrameTick(double ts) override;
  void reportLongTask(double durationMs) override;
  void reportSlowEvent(double durationMs) override;
  void reportRender(double actualDurationMs) override;
  void reportJsHeap(double usedBytes, double totalBytes) override;
  void configure(const PerfConfig& config) override;
  void reset() override;

private:
  void notifySubscribers();
  void timerLoop();
  double getCurrentTimestamp() const;

  std::unique_ptr<::nitroperf::FPSTracker> uiFpsTracker_;
  std::unique_ptr<::nitroperf::FPSTracker> jsFpsTracker_;
  std::unique_ptr<::nitroperf::PlatformMetrics> platform_;

  std::atomic<bool> isRunning_{false};
  std::atomic<int> updateIntervalMs_{500};
  int targetFps_ = 60;

  // Subscriber management
  mutable std::mutex subscriberMutex_;
  std::unordered_map<double, std::function<void(const PerfSnapshot&)>> subscribers_;
  std::atomic<int> nextSubscriberId_{1};

  // Notification timer thread
  std::thread timerThread_;
  std::atomic<bool> timerRunning_{false};

  // JS heap values (set from JS side or Hermes instrumentation)
  std::atomic<int64_t> jsHeapUsed_{0};
  std::atomic<int64_t> jsHeapTotal_{0};

  // New architecture metrics (set from JS side via report*() methods)
  std::atomic<int64_t> longTaskCount_{0};
  std::atomic<int64_t> longTaskTotalMs_{0};
  std::atomic<int64_t> slowEventCount_{0};
  std::atomic<double> maxEventDurationMs_{0.0};
  std::atomic<int64_t> renderCount_{0};
  std::atomic<double> lastRenderDurationMs_{0.0};
};

} // namespace margelo::nitro::nitroperf
