#include "HybridPerfMonitor.hpp"
#include <chrono>
#include <cmath>

namespace margelo::nitro::nitroperf {

HybridPerfMonitor::HybridPerfMonitor()
    : HybridObject(TAG),
      HybridPerfMonitorSpec(),
      uiFpsTracker_(std::make_unique<::nitroperf::FPSTracker>(60)),
      jsFpsTracker_(std::make_unique<::nitroperf::FPSTracker>(60)),
      platform_(::nitroperf::PlatformMetrics::create()) {}

HybridPerfMonitor::~HybridPerfMonitor() {
  stop();
}

void HybridPerfMonitor::start() {
  if (isRunning_.exchange(true)) return; // Already running

  // Start platform UI FPS tracking
  platform_->startUIFPSTracking([this](double ts) {
    uiFpsTracker_->onFrameTick(ts);
  });

  // Start platform JS FPS tracking (may be no-op on Android)
  platform_->startJSFPSTracking([this](double ts) {
    jsFpsTracker_->onFrameTick(ts);
  });

  // Start notification timer
  timerRunning_.store(true);
  timerThread_ = std::thread(&HybridPerfMonitor::timerLoop, this);
}

void HybridPerfMonitor::stop() {
  if (!isRunning_.exchange(false)) return; // Already stopped

  platform_->stopUIFPSTracking();
  platform_->stopJSFPSTracking();

  // Stop timer thread
  timerRunning_.store(false);
  if (timerThread_.joinable()) {
    timerThread_.join();
  }
}

bool HybridPerfMonitor::getIsRunning() {
  return isRunning_.load();
}

PerfSnapshot HybridPerfMonitor::getMetrics() {
  return PerfSnapshot(
    static_cast<double>(uiFpsTracker_->getCurrentFps()),
    static_cast<double>(jsFpsTracker_->getCurrentFps()),
    static_cast<double>(platform_->getResidentMemoryBytes()),
    static_cast<double>(jsHeapUsed_.load(std::memory_order_relaxed)),
    static_cast<double>(jsHeapTotal_.load(std::memory_order_relaxed)),
    static_cast<double>(uiFpsTracker_->getDroppedFrames() + jsFpsTracker_->getDroppedFrames()),
    static_cast<double>(uiFpsTracker_->getStutterCount() + jsFpsTracker_->getStutterCount()),
    getCurrentTimestamp(),
    static_cast<double>(longTaskCount_.load(std::memory_order_relaxed)),
    static_cast<double>(longTaskTotalMs_.load(std::memory_order_relaxed)),
    static_cast<double>(slowEventCount_.load(std::memory_order_relaxed)),
    maxEventDurationMs_.load(std::memory_order_relaxed),
    static_cast<double>(renderCount_.load(std::memory_order_relaxed)),
    lastRenderDurationMs_.load(std::memory_order_relaxed)
  );
}

FPSHistory HybridPerfMonitor::getHistory() {
  auto uiSamples = uiFpsTracker_->getSamples();
  auto jsSamples = jsFpsTracker_->getSamples();

  std::vector<double> uiDoubleSamples;
  uiDoubleSamples.reserve(uiSamples.size());
  for (int s : uiSamples) {
    uiDoubleSamples.push_back(static_cast<double>(s));
  }

  std::vector<double> jsDoubleSamples;
  jsDoubleSamples.reserve(jsSamples.size());
  for (int s : jsSamples) {
    jsDoubleSamples.push_back(static_cast<double>(s));
  }

  return FPSHistory(
    std::move(uiDoubleSamples),
    std::move(jsDoubleSamples),
    static_cast<double>(uiFpsTracker_->getMinFps()),
    static_cast<double>(uiFpsTracker_->getMaxFps()),
    static_cast<double>(jsFpsTracker_->getMinFps()),
    static_cast<double>(jsFpsTracker_->getMaxFps())
  );
}

double HybridPerfMonitor::subscribe(const std::function<void(const PerfSnapshot&)>& cb) {
  double id = static_cast<double>(nextSubscriberId_.fetch_add(1));
  std::lock_guard<std::mutex> lock(subscriberMutex_);
  subscribers_[id] = cb;
  return id;
}

void HybridPerfMonitor::unsubscribe(double id) {
  std::lock_guard<std::mutex> lock(subscriberMutex_);
  subscribers_.erase(id);
}

void HybridPerfMonitor::reportJsFrameTick(double ts) {
  // Convert ms to seconds for FPSTracker
  double timestampSeconds = ts / 1000.0;
  jsFpsTracker_->onFrameTick(timestampSeconds);
}

void HybridPerfMonitor::reportLongTask(double durationMs) {
  longTaskCount_.fetch_add(1, std::memory_order_relaxed);
  longTaskTotalMs_.fetch_add(static_cast<int64_t>(durationMs), std::memory_order_relaxed);
}

void HybridPerfMonitor::reportSlowEvent(double durationMs) {
  slowEventCount_.fetch_add(1, std::memory_order_relaxed);
  // CAS loop to update max event duration
  double current = maxEventDurationMs_.load(std::memory_order_relaxed);
  while (durationMs > current) {
    if (maxEventDurationMs_.compare_exchange_weak(current, durationMs, std::memory_order_relaxed)) {
      break;
    }
  }
}

void HybridPerfMonitor::reportRender(double actualDurationMs) {
  renderCount_.fetch_add(1, std::memory_order_relaxed);
  lastRenderDurationMs_.store(actualDurationMs, std::memory_order_relaxed);
}

void HybridPerfMonitor::reportJsHeap(double usedBytes, double totalBytes) {
  jsHeapUsed_.store(static_cast<int64_t>(usedBytes), std::memory_order_relaxed);
  jsHeapTotal_.store(static_cast<int64_t>(totalBytes), std::memory_order_relaxed);
}

void HybridPerfMonitor::configure(const PerfConfig& config) {
  updateIntervalMs_.store(static_cast<int>(config.updateIntervalMs));

  if (config.maxHistorySamples > 0) {
    size_t maxSamples = static_cast<size_t>(config.maxHistorySamples);
    uiFpsTracker_ = std::make_unique<::nitroperf::FPSTracker>(maxSamples);
    jsFpsTracker_ = std::make_unique<::nitroperf::FPSTracker>(maxSamples);
  }

  if (config.targetFps > 0) {
    targetFps_ = static_cast<int>(config.targetFps);
    uiFpsTracker_->setTargetFps(targetFps_);
    jsFpsTracker_->setTargetFps(targetFps_);
  }
}

void HybridPerfMonitor::reset() {
  uiFpsTracker_->reset();
  jsFpsTracker_->reset();
  jsHeapUsed_.store(0);
  jsHeapTotal_.store(0);
  longTaskCount_.store(0);
  longTaskTotalMs_.store(0);
  slowEventCount_.store(0);
  maxEventDurationMs_.store(0.0);
  renderCount_.store(0);
  lastRenderDurationMs_.store(0.0);
}

void HybridPerfMonitor::notifySubscribers() {
  PerfSnapshot snapshot = getMetrics();

  std::lock_guard<std::mutex> lock(subscriberMutex_);
  for (auto& [id, callback] : subscribers_) {
    callback(snapshot);
  }
}

void HybridPerfMonitor::timerLoop() {
  while (timerRunning_.load()) {
    int intervalMs = updateIntervalMs_.load();
    std::this_thread::sleep_for(std::chrono::milliseconds(intervalMs));

    if (timerRunning_.load()) {
      notifySubscribers();
    }
  }
}

double HybridPerfMonitor::getCurrentTimestamp() const {
  auto now = std::chrono::system_clock::now();
  auto duration = now.time_since_epoch();
  auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
  return static_cast<double>(millis.count());
}

} // namespace margelo::nitro::nitroperf
