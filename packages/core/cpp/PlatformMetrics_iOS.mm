#import "PlatformMetrics.hpp"

#if __APPLE__

#import <Foundation/Foundation.h>
#import <QuartzCore/CADisplayLink.h>
#import <mach/mach.h>
#import <mach/task_info.h>

/**
 * ObjC++ helper to bridge CADisplayLink selector callbacks to C++ std::function.
 * Must be at global scope (ObjC declarations cannot appear inside C++ namespaces).
 */
@interface NitroPerfDisplayLinkTarget : NSObject {
  std::function<void(double)> _callback;
}
- (instancetype)initWithCallback:(std::function<void(double)>)callback;
- (void)onDisplayLink:(CADisplayLink *)link;
@end

@implementation NitroPerfDisplayLinkTarget

- (instancetype)initWithCallback:(std::function<void(double)>)callback {
  self = [super init];
  if (self) {
    _callback = std::move(callback);
  }
  return self;
}

- (void)onDisplayLink:(CADisplayLink *)link {
  if (_callback) {
    _callback(link.timestamp);
  }
}

@end

namespace nitroperf {

class PlatformMetrics_iOS : public PlatformMetrics {
public:
  ~PlatformMetrics_iOS() override {
    stopUIFPSTracking();
    stopJSFPSTracking();
  }

  void startUIFPSTracking(std::function<void(double)> onTick) override {
    stopUIFPSTracking();
    uiTarget_ = [[NitroPerfDisplayLinkTarget alloc] initWithCallback:std::move(onTick)];
    uiDisplayLink_ = [CADisplayLink displayLinkWithTarget:uiTarget_
                                                 selector:@selector(onDisplayLink:)];
    [uiDisplayLink_ addToRunLoop:[NSRunLoop mainRunLoop]
                         forMode:NSRunLoopCommonModes];
  }

  void stopUIFPSTracking() override {
    if (uiDisplayLink_) {
      [uiDisplayLink_ invalidate];
      uiDisplayLink_ = nil;
      uiTarget_ = nil;
    }
  }

  void startJSFPSTracking(std::function<void(double)> onTick) override {
    stopJSFPSTracking();

    // Try to get the JS thread run loop (available with old architecture / bridge).
    // For Fabric, JS FPS is tracked via JS-side rAF + reportJsFrameTick().
    jsTarget_ = [[NitroPerfDisplayLinkTarget alloc] initWithCallback:std::move(onTick)];
    jsDisplayLink_ = [CADisplayLink displayLinkWithTarget:jsTarget_
                                                 selector:@selector(onDisplayLink:)];

    // Dispatch to the RCTJSThread run loop if available
    // For Fabric/bridgeless, this will just add to main and the JS side
    // should use reportJsFrameTick() instead.
    NSThread *jsThread = nil;
    Class bridgeClass = NSClassFromString(@"RCTBridge");
    if (bridgeClass) {
      // Attempt to find the shared JS thread
      Class jsThreadClass = NSClassFromString(@"RCTJSThread");
      if (jsThreadClass && [jsThreadClass respondsToSelector:@selector(sharedThread)]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"
        jsThread = [jsThreadClass performSelector:@selector(sharedThread)];
#pragma clang diagnostic pop
      }
    }

    if (jsThread && jsThread.isExecuting) {
      [jsDisplayLink_ addToRunLoop:[NSRunLoop mainRunLoop]
                           forMode:NSRunLoopCommonModes];
      // Note: ideally we'd add to the JS thread's run loop, but accessing
      // it reliably is complex. The JS-side rAF approach is more robust.
    } else {
      // Fabric / bridgeless: no native JS thread access
      // JS FPS will be tracked via reportJsFrameTick()
      [jsDisplayLink_ invalidate];
      jsDisplayLink_ = nil;
      jsTarget_ = nil;
    }
  }

  void stopJSFPSTracking() override {
    if (jsDisplayLink_) {
      [jsDisplayLink_ invalidate];
      jsDisplayLink_ = nil;
      jsTarget_ = nil;
    }
  }

  int64_t getResidentMemoryBytes() override {
    task_vm_info_data_t vmInfo;
    mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
    kern_return_t kr = task_info(mach_task_self(),
                                 TASK_VM_INFO,
                                 reinterpret_cast<task_info_t>(&vmInfo),
                                 &count);
    if (kr == KERN_SUCCESS) {
      return static_cast<int64_t>(vmInfo.phys_footprint);
    }
    return 0;
  }

private:
  CADisplayLink *uiDisplayLink_ = nil;
  NitroPerfDisplayLinkTarget *uiTarget_ = nil;
  CADisplayLink *jsDisplayLink_ = nil;
  NitroPerfDisplayLinkTarget *jsTarget_ = nil;
};

std::unique_ptr<PlatformMetrics> PlatformMetrics::create() {
  return std::make_unique<PlatformMetrics_iOS>();
}

} // namespace nitroperf

#endif // __APPLE__
