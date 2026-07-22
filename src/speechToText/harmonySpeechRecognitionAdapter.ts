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
      throw new Error(result.message || "Core Speech 语音识别无法启动。");
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

class ResilientSpeechRecognitionAdapter implements SpeechToTextAdapter {
  onPartialResult?: (text: string) => void;
  onError?: (error: Error) => void;
  private readonly harmony = new HarmonySpeechRecognitionAdapter();
  private readonly browser = new BrowserSpeechRecognitionAdapter();
  private active: SpeechToTextAdapter | null = null;

  isSupported() {
    return this.harmony.isSupported() || this.browser.isSupported();
  }

  private wire(adapter: SpeechToTextAdapter) {
    adapter.onPartialResult = (text) => this.onPartialResult?.(text);
    adapter.onError = (error) => this.onError?.(error);
  }

  async start() {
    this.wire(this.harmony);
    try {
      await this.harmony.start();
      this.active = this.harmony;
      return;
    } catch (nativeError) {
      if (!this.browser.isSupported()) {
        const error = nativeError instanceof Error ? nativeError : new Error("语音识别无法启动。");
        this.onError?.(error);
        throw error;
      }
    }
    this.wire(this.browser);
    await this.browser.start();
    this.active = this.browser;
  }

  async stop() {
    const adapter = this.active;
    this.active = null;
    return adapter ? adapter.stop() : "";
  }
}

export const createSpeechRecognitionAdapter = (): SpeechToTextAdapter =>
  hasHarmonySpeechRecognition() ? new ResilientSpeechRecognitionAdapter() : new BrowserSpeechRecognitionAdapter();
