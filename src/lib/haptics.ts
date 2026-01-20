/**
 * Haptic feedback utility for mobile devices
 * Uses the Vibration API with fallback for devices that don't support it
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 30], // short-pause-longer
  warning: [30, 30, 30],
  error: [50, 30, 50, 30, 50],
  selection: 5,
};

/**
 * Check if the device supports haptic feedback
 */
export const supportsHaptics = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Trigger haptic feedback with a predefined pattern
 * @param pattern - The type of haptic feedback to trigger
 */
export const haptic = (pattern: HapticPattern = 'light'): void => {
  if (!supportsHaptics()) return;
  
  try {
    const vibrationPattern = HAPTIC_PATTERNS[pattern];
    navigator.vibrate(vibrationPattern);
  } catch (error) {
    // Silently fail - haptics are a nice-to-have
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger a custom vibration pattern
 * @param pattern - Array of vibration durations in ms, or single duration
 */
export const hapticCustom = (pattern: number | number[]): void => {
  if (!supportsHaptics()) return;
  
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Cancel any ongoing vibration
 */
export const hapticCancel = (): void => {
  if (!supportsHaptics()) return;
  
  try {
    navigator.vibrate(0);
  } catch (error) {
    // Silently fail
  }
};
