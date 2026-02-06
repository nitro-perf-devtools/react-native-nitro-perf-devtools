import { DevSettings } from 'react-native'

let isOverlayVisible = false
let toggleCallback: ((visible: boolean) => void) | null = null

/**
 * Register a "Toggle Nitro Perf Monitor" item in the React Native Dev Menu.
 * When tapped, it toggles the PerfOverlay visibility via the provided callback.
 *
 * @param onToggle Callback receiving the new visibility state
 */
export function registerDevMenuItem(
  onToggle: (visible: boolean) => void
): void {
  toggleCallback = onToggle

  if (__DEV__ && DevSettings?.addMenuItem) {
    DevSettings.addMenuItem('Toggle Nitro Perf Monitor', () => {
      isOverlayVisible = !isOverlayVisible
      toggleCallback?.(isOverlayVisible)
    })
  }
}

/**
 * Programmatically set the overlay visibility.
 * Useful for controlling the overlay from outside the dev menu.
 */
export function setPerfOverlayVisible(visible: boolean): void {
  isOverlayVisible = visible
  toggleCallback?.(isOverlayVisible)
}

/**
 * Get the current overlay visibility state.
 */
export function isPerfOverlayVisible(): boolean {
  return isOverlayVisible
}
