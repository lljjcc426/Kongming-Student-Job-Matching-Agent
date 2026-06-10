export interface TextToSpeechAdapter {
  speak(text: string): Promise<{ audioUrl?: string; durationMs?: number }>;
  stop(): void;
  isSpeaking(): boolean;
}

export class BrowserSpeechSynthesisAdapter implements TextToSpeechAdapter {
  private speaking = false;

  async speak(text: string) {
    if (!("speechSynthesis" in window) || !text.trim()) {
      return { durationMs: Math.max(1200, text.length * 90) };
    }

    this.stop();
    this.speaking = true;
    const durationMs = Math.max(1600, Math.min(12000, text.length * 110));
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 0.95;
      utterance.pitch = 1.02;
      utterance.volume = 0.9;
      utterance.onend = () => {
        this.speaking = false;
        resolve();
      };
      utterance.onerror = () => {
        this.speaking = false;
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
    return { durationMs };
  }

  stop() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
  }

  isSpeaking() {
    return this.speaking;
  }
}
