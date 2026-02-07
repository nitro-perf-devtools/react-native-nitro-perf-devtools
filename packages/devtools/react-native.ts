import { useEffect } from 'react'
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge'
import { getPerfMonitor } from '@nitroperf/core'
import type { PerfSnapshot, FPSHistory } from '@nitroperf/core'

interface PerfEvents {
  'perf-snapshot': PerfSnapshot
  'perf-history': FPSHistory
  'request-snapshot': Record<string, never>
  'request-history': Record<string, never>
  'start-monitor': Record<string, never>
  'stop-monitor': Record<string, never>
  'reset-monitor': Record<string, never>
}

/**
 * App-side Rozenite hook that bridges Nitro PerfMonitor data
 * to the DevTools panel over CDP.
 *
 * Add this hook in your app's root component:
 * ```tsx
 * import { useNitroPerfDevTools } from '@nitroperf/devtools';
 *
 * function App() {
 *   useNitroPerfDevTools();
 *   return <YourApp />;
 * }
 * ```
 */
export function useNitroPerfDevTools() {
  const client = useRozeniteDevToolsClient<PerfEvents>({
    pluginId: 'nitro-perf',
  })

  useEffect(() => {
    if (!client) return

    const monitor = getPerfMonitor()

    // Respond to panel requests
    client.onMessage('start-monitor', () => {
      monitor.start()
    })

    client.onMessage('stop-monitor', () => {
      monitor.stop()
    })

    client.onMessage('reset-monitor', () => {
      monitor.reset()
    })

    client.onMessage('request-snapshot', () => {
      client.send('perf-snapshot', monitor.getMetrics())
    })

    client.onMessage('request-history', () => {
      client.send('perf-history', monitor.getHistory())
    })

    // Push periodic metric updates to the panel
    const subId = monitor.subscribe((snapshot: PerfSnapshot) => {
      client.send('perf-snapshot', snapshot)
    })

    // Also periodically push history
    const historyInterval = setInterval(() => {
      if (monitor.isRunning) {
        client.send('perf-history', monitor.getHistory())
      }
    }, 1000)

    return () => {
      monitor.unsubscribe(subId)
      clearInterval(historyInterval)
    }
  }, [client])
}
