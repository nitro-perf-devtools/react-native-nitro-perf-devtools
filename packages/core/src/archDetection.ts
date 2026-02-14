import { Platform } from 'react-native'

export interface ArchInfo {
  isFabric: boolean
  isBridgeless: boolean
  jsEngine: 'hermes' | 'v8' | 'jsc'
  reactNativeVersion: string
}

let cached: ArchInfo | null = null

export function getArchInfo(): ArchInfo {
  if (cached) return cached

  const g = globalThis as any

  const isFabric = !!g.nativeFabricUIManager

  const isBridgeless = !!g.__turboModuleProxy && !g.__fbBatchedBridge

  let jsEngine: ArchInfo['jsEngine'] = 'jsc'
  if (g.HermesInternal) {
    jsEngine = 'hermes'
  } else if (g._v8runtime) {
    jsEngine = 'v8'
  }

  let reactNativeVersion = 'unknown'
  try {
    const v = Platform.constants?.reactNativeVersion
    if (v) {
      reactNativeVersion = `${v.major}.${v.minor}.${v.patch}`
    }
  } catch (_e) {
    // Platform.constants may not be available
  }

  cached = { isFabric, isBridgeless, jsEngine, reactNativeVersion }
  return cached
}
