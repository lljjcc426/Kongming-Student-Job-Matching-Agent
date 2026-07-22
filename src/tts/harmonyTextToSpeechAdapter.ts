import { hasHarmonyTextToSpeech, speakTextWithHarmony, stopSpeakingWithHarmony } from "../harmonyBridge";
import { BrowserSpeechSynthesisAdapter, type TextToSpeechAdapter } from "./browserSpeechSynthesisAdapter";

class HarmonyTextToSpeechAdapter implements TextToSpeechAdapter {
  private speaking = false;
  private readonly browserFallback = new BrowserSpeechSynthesisAdapter();

  async speak(text: string) {
    if (!text.trim()) return { durationMs: 0 };
    this.stop();
    const result = await speakTextWithHarmony(text);
    if (!result.ok) return this.browserFallback.speak(text);
    this.speaking = true;
    const durationMs = Math.max(1600, Math.min(12000, text.length * 110));
    await new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
    this.speaking = false;
    return { durationMs };
  }

  stop() {
    if (this.speaking) void stopSpeakingWithHarmony();
    this.browserFallback.stop();
    this.speaking = false;
  }

  isSpeaking() {
    return this.speaking || this.browserFallback.isSpeaking();
  }
}

export const createTextToSpeechAdapter = (): TextToSpeechAdapter =>
  hasHarmonyTextToSpeech() ? new HarmonyTextToSpeechAdapter() : new BrowserSpeechSynthesisAdapter();
