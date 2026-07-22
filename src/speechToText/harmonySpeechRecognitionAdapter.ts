import { hasHarmonySpeechRecognition, startSpeechRecognitionWithHarmony, stopSpeechRecognitionWithHarmony } from "../harmonyBridge";
import { BrowserSpeechRecognitionAdapter, type SpeechToTextAdapter } from "./browserSpeechRecognitionAdapter";

class HarmonySpeechRecognitionAdapter implements SpeechToTextAdapter {
  onPartialResult?: (text: string) => void;
  onError?: (error: Error) => void;

  isSupported() {
    return hasHarmonySpeechRecognition();
  }

  async start() {
    const result = await startSpeechRecognitionWithHarmony();
    if (!result.ok) {
      const error = new Error(result.message || "Core Speech 语音识别无法启动。");
      this.onError?.(error);
      throw error;
    }
  }

  async stop() {
    const result = await stopSpeechRecognitionWithHarmony();
    if (!result.ok && !result.text) {
      const error = new Error(result.message || "Core Speech 未识别到有效语音。");
      this.onError?.(error);
      return "";
    }
    if (result.text) this.onPartialResult?.(result.text);
    return result.text;
  }
}

export const createSpeechRecognitionAdapter = (): SpeechToTextAdapter =>
  hasHarmonySpeechRecognition() ? new HarmonySpeechRecognitionAdapter() : new BrowserSpeechRecognitionAdapter();
