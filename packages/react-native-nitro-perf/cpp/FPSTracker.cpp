#include "FPSTracker.hpp"
#include <cmath>
#include <algorithm>

namespace nitroperf {

FPSTracker::FPSTracker(size_t maxSamples)
    : maxSamples_(maxSamples), samples_(maxSamples, 0) {}

void FPSTracker::onFrameTick(double timestampSeconds) {
  std::lock_guard<std::mutex> lock(mutex_);

  if (!hasFirstTick_) {
    windowStart_ = timestampSeconds;
    frameCount_ = 1;
    hasFirstTick_ = true;
    return;
  }

  frameCount_++;
  double elapsed = timestampSeconds - windowStart_;

  // Once a full second has elapsed, record the sample
  if (elapsed >= 1.0) {
    int fps = static_cast<int>(std::round(frameCount_ / elapsed));
    recordSample(fps);

    // Start new window
    windowStart_ = timestampSeconds;
    frameCount_ = 0;
  }
}

void FPSTracker::recordSample(int fps) {
  // Write to ring buffer
  samples_[writeIndex_] = fps;
  writeIndex_ = (writeIndex_ + 1) % maxSamples_;
  if (sampleCount_ < maxSamples_) {
    sampleCount_++;
  }

  currentFps_.store(fps, std::memory_order_relaxed);

  // Update min/max
  if (fps < minFps_) minFps_ = fps;
  if (fps > maxFps_) maxFps_ = fps;

  // Dropped frames: how many frames below target in this second
  int dropped = std::max(0, targetFps_ - fps);
  droppedFrames_ += dropped;

  // Stutter: 4+ frames dropped in a single second
  if (dropped >= 4) {
    stutterCount_++;
  }
}

int FPSTracker::getCurrentFps() const {
  return currentFps_.load(std::memory_order_relaxed);
}

std::vector<int> FPSTracker::getSamples() const {
  std::lock_guard<std::mutex> lock(mutex_);

  std::vector<int> result;
  result.reserve(sampleCount_);

  if (sampleCount_ < maxSamples_) {
    // Buffer hasn't wrapped yet — samples are in order from index 0
    for (size_t i = 0; i < sampleCount_; i++) {
      result.push_back(samples_[i]);
    }
  } else {
    // Buffer has wrapped — read from writeIndex_ (oldest) forward
    for (size_t i = 0; i < maxSamples_; i++) {
      size_t idx = (writeIndex_ + i) % maxSamples_;
      result.push_back(samples_[idx]);
    }
  }

  return result;
}

int FPSTracker::getMinFps() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return sampleCount_ > 0 ? minFps_ : 0;
}

int FPSTracker::getMaxFps() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return maxFps_;
}

int64_t FPSTracker::getDroppedFrames() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return droppedFrames_;
}

int FPSTracker::getStutterCount() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return stutterCount_;
}

void FPSTracker::setTargetFps(int target) {
  std::lock_guard<std::mutex> lock(mutex_);
  targetFps_ = target;
}

void FPSTracker::reset() {
  std::lock_guard<std::mutex> lock(mutex_);
  std::fill(samples_.begin(), samples_.end(), 0);
  writeIndex_ = 0;
  sampleCount_ = 0;
  windowStart_ = 0.0;
  frameCount_ = 0;
  hasFirstTick_ = false;
  currentFps_.store(0, std::memory_order_relaxed);
  minFps_ = INT32_MAX;
  maxFps_ = 0;
  droppedFrames_ = 0;
  stutterCount_ = 0;
}

} // namespace nitroperf
