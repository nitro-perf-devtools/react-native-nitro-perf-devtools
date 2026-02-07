package com.nitroperf

import android.os.Handler
import android.os.Looper
import android.view.Choreographer

/**
 * Android-side helper that hooks into Choreographer for UI frame timing.
 * Each frame callback fires nativeOnUIFrameTick() into C++ via JNI.
 */
class PerfMetricsProvider private constructor() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var isTracking = false

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (isTracking) {
                nativeOnUIFrameTick(frameTimeNanos)
                Choreographer.getInstance().postFrameCallback(this)
            }
        }
    }

    init {
        nativeInit()
    }

    fun startTracking() {
        if (isTracking) return
        isTracking = true
        mainHandler.post {
            Choreographer.getInstance().postFrameCallback(frameCallback)
        }
    }

    fun stopTracking() {
        isTracking = false
        mainHandler.post {
            Choreographer.getInstance().removeFrameCallback(frameCallback)
        }
    }

    private external fun nativeInit()
    private external fun nativeOnUIFrameTick(timestampNanos: Long)

    companion object {
        init {
            System.loadLibrary("NitroPerf")
        }

        @Volatile
        private var instance: PerfMetricsProvider? = null

        @JvmStatic
        fun getInstance(): PerfMetricsProvider {
            return instance ?: synchronized(this) {
                instance ?: PerfMetricsProvider().also { instance = it }
            }
        }
    }
}
