#pragma once

#include <vector>
#include <cstdint>
#include <mutex>
#include <atomic>

namespace nitroperf {

/**
 * Ring-buffer FPS tracker that counts frame callbacks per second.
 * Algorithm matches RCTFPSGraph.mm: count callbacks in 1-second windows,
 * compute round(frameCount / elapsed).
 */
class FPSTracker {
public:
  explicit FPSTracker(size_t maxSamples = 60);

  /**
   * Called on each frame tick with the timestamp in seconds.
   * Counts frames per second and updates the ring buffer.
   */
  void onFrameTick(double timestampSeconds);

  /** Returns the current FPS (most recent completed second). */
  int getCurrentFps() const;

  /** Returns ordered history from the ring buffer (oldest to newest). */
  std::vector<int> getSamples() const;

  /** Minimum FPS recorded since last reset. */
  int getMinFps() const;

  /** Maximum FPS recorded since last reset. */
  int getMaxFps() const;

  /** Total dropped frames (expected - actual) across all samples. */
  int64_t getDroppedFrames() const;

  /** Number of 1-second windows where 4+ frames were dropped. */
  int getStutterCount() const;

  /** Target FPS for dropped frame calculation. */
  void setTargetFps(int target);

  /** Reset all tracking state. */
  void reset();

private:
  void recordSample(int fps);

  mutable std::mutex mutex_;
  size_t maxSamples_;
  std::vector<int> samples_;
  size_t writeIndex_ = 0;
  size_t sampleCount_ = 0;

  // Per-second accumulation
  double windowStart_ = 0.0;
  int frameCount_ = 0;
  bool hasFirstTick_ = false;

  // Stats
  std::atomic<int> currentFps_{0};
  int minFps_ = INT32_MAX;
  int maxFps_ = 0;
  int64_t droppedFrames_ = 0;
  int stutterCount_ = 0;
  int targetFps_ = 60;
};

} // namespace nitroperf
