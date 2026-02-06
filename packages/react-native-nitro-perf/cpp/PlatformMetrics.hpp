#pragma once

#include <functional>
#include <memory>
#include <cstdint>

namespace nitroperf {

/**
 * Abstract interface for platform-specific metric collection.
 * iOS: CADisplayLink + Mach APIs
 * Android: Choreographer (via JNI) + /proc/self/status
 */
class PlatformMetrics {
public:
  virtual ~PlatformMetrics() = default;

  /**
   * Start tracking UI frame ticks.
   * @param onTick Called on each UI frame with timestamp in seconds.
   */
  virtual void startUIFPSTracking(std::function<void(double)> onTick) = 0;

  /** Stop UI frame tracking. */
  virtual void stopUIFPSTracking() = 0;

  /**
   * Start tracking JS frame ticks (where available natively).
   * On Fabric/Android, JS FPS is tracked from JS-side rAF instead.
   * @param onTick Called on each JS frame with timestamp in seconds.
   */
  virtual void startJSFPSTracking(std::function<void(double)> onTick) = 0;

  /** Stop JS frame tracking. */
  virtual void stopJSFPSTracking() = 0;

  /** Get current process resident memory in bytes. */
  virtual int64_t getResidentMemoryBytes() = 0;

  /** Factory: creates the platform-appropriate implementation. */
  static std::unique_ptr<PlatformMetrics> create();
};

} // namespace nitroperf
