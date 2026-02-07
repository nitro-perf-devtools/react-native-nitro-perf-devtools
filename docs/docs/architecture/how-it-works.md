---
sidebar_position: 1
---

# How It Works

NitroPerf uses a C++ core powered by [Nitro Modules](https://github.com/mrousavy/nitro) for synchronous JSI calls between JavaScript and native code. This means there is zero bridge overhead when reading metrics.

## iOS

| Metric | Implementation |
|--------|---------------|
| **UI FPS** | `CADisplayLink` on `NSRunLoopCommonModes` |
| **JS FPS** | `CADisplayLink` on JS thread (Bridge) or JS-side `requestAnimationFrame` (Fabric) |
| **RAM** | `task_info(TASK_VM_INFO)` → `phys_footprint` |

## Android

| Metric | Implementation |
|--------|---------------|
| **UI FPS** | `Choreographer.FrameCallback` → JNI → C++ FPSTracker |
| **JS FPS** | JS-side `requestAnimationFrame` → `reportJsFrameTick()` |
| **RAM** | `/proc/self/status` → `VmRSS` |

:::info Platform Difference
On iOS, both UI and JS FPS are tracked natively via `CADisplayLink`. On Android, UI FPS uses the Choreographer via JNI, but JS FPS must be tracked from the JavaScript side using `requestAnimationFrame` feeding timestamps to `reportJsFrameTick()`.
:::

## FPS Algorithm

NitroPerf uses the same approach as React Native's built-in `RCTFPSGraph.mm`:

1. Count frame callbacks received within a 1-second window
2. Compute FPS as `round(frameCount / elapsed)`
3. Store results in a ring buffer (last N seconds of samples)

This provides a stable, human-readable FPS value that matches what developers see in React Native's built-in performance monitor.

## JS Heap Metrics

On Hermes, JS heap metrics (`jsHeapUsedBytes`, `jsHeapTotalBytes`) are read directly from the Hermes runtime. These values help identify memory leaks in JavaScript code versus native memory growth.
