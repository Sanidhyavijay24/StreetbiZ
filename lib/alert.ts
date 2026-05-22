/**
 * @file alert.ts
 * @description Cross-platform alert/confirm helper supporting web and native.
 * @module lib/alert
 */

import { Alert as RNAlert, Platform } from 'react-native';

export function showAlert(
  title: string,
  message?: string,
  buttons?: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]
): void {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 0) {
      // Find the primary button (non-cancel)
      const confirmBtn = buttons.find((b) => b.style !== 'cancel' && b.text.toLowerCase() !== 'cancel') || buttons[0];
      const confirmed = window.confirm(`${title}\n\n${message || ''}`);
      if (confirmed && confirmBtn.onPress) {
        confirmBtn.onPress();
      }
    } else {
      window.alert(`${title}\n\n${message || ''}`);
    }
  } else {
    RNAlert.alert(title, message, buttons);
  }
}
