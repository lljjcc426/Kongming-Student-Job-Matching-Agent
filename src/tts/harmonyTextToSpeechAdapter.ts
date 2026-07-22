import { hasHarmonyTextToSpeech, speakTextWithHarmony, stopSpeakingWithHarmony } from "../harmonyBridge";
import { BrowserSpeechSynthesisAdapter, type TextToSpeechAdapter } from "./browserSpeechSynthesisAdapter";

class HarmonyTextToSpeechAdapter implements TextToSpeechAdapter {
  private speaking = false;

  async speak(text: string) {
    if (!text.trim()) return { durationMs: 0 };
    this.stop();
    const result = await speakTextWithHarmony(text);
    if (!result.ok) return { durationMs: Math.max(1200, Math.min(12000, text.length * 90)) };
    this.speaking = true;
    const durationMs = Math.max(1600, Math.min(12000, text.length * 110));
    await new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
    this.speaking = false;
    return { durationMs };
  }

  stop() {
    if (this.speaking) void stopSpeakingWithHarmony();
    this.speaking = false;
  }

  isSpeaking() {
    return this.speaking;
  }
}

export const createTextToSpeechAdapter = (): TextToSpeechAdapter =>
  hasHarmonyTextToSpeech() ? new HarmonyTextToSpeechAdapter() : new BrowserSpeechSynthesisAdapter();
