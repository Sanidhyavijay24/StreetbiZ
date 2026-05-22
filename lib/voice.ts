/**
 * @file voice.ts
 * @description Speech-to-Text (STT) and Text-to-Speech (TTS) wrappers using
 *              expo-speech-recognition and expo-speech, with language and permission handling.
 * @module lib/voice
 */

import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Text-to-Speech Options.
 */
export interface SpeakOptions extends Speech.SpeechOptions {
  /** BCP 47 language tag, e.g. 'en-US', 'sw-KE', 'ha-NG', 'hi-IN' */
  language?: string;
}

/**
 * Speak text out loud using on-device Text-to-Speech (TTS).
 *
 * @param text - The text content to speak.
 * @param options - Optional speech settings (pitch, rate, callbacks).
 */
export function speak(text: string, options?: SpeakOptions): void {
  // If the synthesis engine is already speaking, stop it first to prevent overlapping.
  Speech.stop();

  Speech.speak(text, {
    pitch: 1.0,
    rate: 1.0,
    ...options,
  });
}

/**
 * Immediately stop any ongoing or queued text-to-speech output.
 */
export function stopSpeaking(): void {
  Speech.stop();
}

/**
 * Check if the text-to-speech engine is currently speaking.
 *
 * @returns Promise resolving to boolean.
 */
export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

/**
 * Request necessary permissions for Speech-to-Text (STT) and microphone.
 *
 * @returns Promise resolving to true if permissions are granted, false otherwise.
 */
export async function requestVoicePermissions(): Promise<boolean> {
  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return !!result.granted;
  } catch (err) {
    console.error('[voice] failed to request voice permissions:', err);
    return false;
  }
}

/**
 * Start native speech recognition recording.
 *
 * @param onResult - Callback triggered when recognition results are received (interim or final).
 * @param onError - Callback triggered if an error occurs.
 * @param onEnd - Callback triggered when recognition stops.
 * @param lang - BCP 47 language code for speech recognition.
 */
export function startListening(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (errorMsg: string) => void,
  onEnd: () => void,
  lang: string = 'en-US'
): void {
  // Hook up event listeners before starting
  const resultSubscription = ExpoSpeechRecognitionModule.addListener('result', (event) => {
    if (event.results && event.results.length > 0) {
      const topResult = event.results[0];
      onResult(topResult.transcript, !!event.isFinal);
    }
  });

  const errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event) => {
    onError(event.error || 'Unknown speech recognition error');
  });

  const endSubscription = ExpoSpeechRecognitionModule.addListener('end', () => {
    // Clean up subscriptions on end
    resultSubscription.remove();
    errorSubscription.remove();
    endSubscription.remove();
    onEnd();
  });

  ExpoSpeechRecognitionModule.start({
    lang,
    interimResults: true,
    continuous: false,
  });
}

/**
 * Stop speech recognition recording and request final results.
 */
export function stopListening(): void {
  ExpoSpeechRecognitionModule.stop();
}

/**
 * Cancel speech recognition recording immediately without returning final results.
 */
export function cancelListening(): void {
  ExpoSpeechRecognitionModule.abort();
}
