#include "PlatformMetrics.hpp"

#if defined(__ANDROID__)

#include <fstream>
#include <string>
#include <jni.h>
#include <android/log.h>

#define LOG_TAG "NitroPerf"
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)

namespace nitroperf {

// Global reference to the Java PerfMetricsProvider instance
static JavaVM *gJavaVM = nullptr;
static jobject gPerfProvider = nullptr;

// Called from JNI_OnLoad or Kotlin init
extern "C" {

JNIEXPORT void JNICALL
Java_com_nitroperf_PerfMetricsProvider_nativeInit(JNIEnv *env, jobject thiz) {
  env->GetJavaVM(&gJavaVM);
  gPerfProvider = env->NewGlobalRef(thiz);
}

// UI frame tick callback from Kotlin Choreographer
static std::function<void(double)> gUIFrameCallback;

JNIEXPORT void JNICALL
Java_com_nitroperf_PerfMetricsProvider_nativeOnUIFrameTick(
    JNIEnv * /*env*/, jobject /*thiz*/, jlong timestampNanos) {
  if (gUIFrameCallback) {
    double timestampSeconds = static_cast<double>(timestampNanos) / 1e9;
    gUIFrameCallback(timestampSeconds);
  }
}

} // extern "C"

class PlatformMetrics_Android : public PlatformMetrics {
public:
  void startUIFPSTracking(std::function<void(double)> onTick) override {
    gUIFrameCallback = std::move(onTick);

    // Call Kotlin to start Choreographer tracking
    callJavaMethod("startTracking");
  }

  void stopUIFPSTracking() override {
    callJavaMethod("stopTracking");
    gUIFrameCallback = nullptr;
  }

  void startJSFPSTracking(std::function<void(double)> /*onTick*/) override {
    // On Android, JS FPS is always tracked via JS-side rAF
    // calling reportJsFrameTick(). No native tracking needed.
  }

  void stopJSFPSTracking() override {
    // No-op on Android
  }

  int64_t getResidentMemoryBytes() override {
    // Read /proc/self/status for VmRSS
    std::ifstream status("/proc/self/status");
    if (!status.is_open()) return 0;

    std::string line;
    while (std::getline(status, line)) {
      if (line.compare(0, 6, "VmRSS:") == 0) {
        // Format: "VmRSS:    12345 kB"
        size_t pos = 6;
        while (pos < line.size() && (line[pos] == ' ' || line[pos] == '\t')) {
          pos++;
        }
        int64_t kbValue = 0;
        while (pos < line.size() && line[pos] >= '0' && line[pos] <= '9') {
          kbValue = kbValue * 10 + (line[pos] - '0');
          pos++;
        }
        return kbValue * 1024; // Convert kB to bytes
      }
    }
    return 0;
  }

private:
  void callJavaMethod(const char *methodName) {
    if (!gJavaVM || !gPerfProvider) return;

    JNIEnv *env = nullptr;
    bool needsDetach = false;
    jint result = gJavaVM->GetEnv(reinterpret_cast<void **>(&env), JNI_VERSION_1_6);

    if (result == JNI_EDETACHED) {
      gJavaVM->AttachCurrentThread(&env, nullptr);
      needsDetach = true;
    }

    if (env) {
      jclass cls = env->GetObjectClass(gPerfProvider);
      jmethodID method = env->GetMethodID(cls, methodName, "()V");
      if (method) {
        env->CallVoidMethod(gPerfProvider, method);
      }
      env->DeleteLocalRef(cls);
    }

    if (needsDetach) {
      gJavaVM->DetachCurrentThread();
    }
  }
};

std::unique_ptr<PlatformMetrics> PlatformMetrics::create() {
  return std::make_unique<PlatformMetrics_Android>();
}

} // namespace nitroperf

#endif // __ANDROID__
