#include "HybridPerfMonitor.hpp"
#include <chrono>
#include <cmath>

namespace nitroperf {

HybridPerfMonitor::HybridPerfMonitor()
    : uiFpsTracker_(std::make_unique<FPSTracker>(60)),
      jsFpsTracker_(std::make_unique<FPSTracker>(60)),
      platform_(PlatformMetrics::create()) {}

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

bool HybridPerfMonitor::getIsRunning() const {
  return isRunning_.load();
}

PerfSnapshot HybridPerfMonitor::getMetrics() {
  PerfSnapshot snapshot;
  snapshot.uiFps = static_cast<double>(uiFpsTracker_->getCurrentFps());
  snapshot.jsFps = static_cast<double>(jsFpsTracker_->getCurrentFps());
  snapshot.ramBytes = static_cast<double>(platform_->getResidentMemoryBytes());
  snapshot.jsHeapUsedBytes = static_cast<double>(jsHeapUsed_.load(std::memory_order_relaxed));
  snapshot.jsHeapTotalBytes = static_cast<double>(jsHeapTotal_.load(std::memory_order_relaxed));
  snapshot.droppedFrames = static_cast<double>(
      uiFpsTracker_->getDroppedFrames() + jsFpsTracker_->getDroppedFrames());
  snapshot.stutterCount = static_cast<double>(
      uiFpsTracker_->getStutterCount() + jsFpsTracker_->getStutterCount());
  snapshot.timestamp = getCurrentTimestamp();
  return snapshot;
}

FPSHistoryData HybridPerfMonitor::getHistory() {
  FPSHistoryData history;

  auto uiSamples = uiFpsTracker_->getSamples();
  auto jsSamples = jsFpsTracker_->getSamples();

  history.uiFpsSamples.reserve(uiSamples.size());
  for (int s : uiSamples) {
    history.uiFpsSamples.push_back(static_cast<double>(s));
  }

  history.jsFpsSamples.reserve(jsSamples.size());
  for (int s : jsSamples) {
    history.jsFpsSamples.push_back(static_cast<double>(s));
  }

  history.uiFpsMin = static_cast<double>(uiFpsTracker_->getMinFps());
  history.uiFpsMax = static_cast<double>(uiFpsTracker_->getMaxFps());
  history.jsFpsMin = static_cast<double>(jsFpsTracker_->getMinFps());
  history.jsFpsMax = static_cast<double>(jsFpsTracker_->getMaxFps());

  return history;
}

int HybridPerfMonitor::subscribe(std::function<void(PerfSnapshot)> callback) {
  int id = nextSubscriberId_.fetch_add(1);
  std::lock_guard<std::mutex> lock(subscriberMutex_);
  subscribers_[id] = std::move(callback);
  return id;
}

void HybridPerfMonitor::unsubscribe(int id) {
  std::lock_guard<std::mutex> lock(subscriberMutex_);
  subscribers_.erase(id);
}

void HybridPerfMonitor::reportJsFrameTick(double timestampMs) {
  // Convert ms to seconds for FPSTracker
  double timestampSeconds = timestampMs / 1000.0;
  jsFpsTracker_->onFrameTick(timestampSeconds);
}

void HybridPerfMonitor::configure(const PerfConfig& config) {
  updateIntervalMs_.store(static_cast<int>(config.updateIntervalMs));

  if (config.maxHistorySamples > 0) {
    // Recreate trackers with new history size
    size_t maxSamples = static_cast<size_t>(config.maxHistorySamples);
    uiFpsTracker_ = std::make_unique<FPSTracker>(maxSamples);
    jsFpsTracker_ = std::make_unique<FPSTracker>(maxSamples);
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

} // namespace nitroperf
