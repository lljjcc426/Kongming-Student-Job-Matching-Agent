export interface SpeechToTextAdapter {
  isSupported(): boolean;
  start(): Promise<void>;
  stop(): Promise<string>;
  onPartialResult?: (text: string) => void;
  onError?: (error: Error) => void;
}

type SpeechRecognitionResultLike = {
  0?: {
    transcript?: string;
  };
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const getSpeechRecognition = () => {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
};

export class BrowserSpeechRecognitionAdapter implements SpeechToTextAdapter {
  onPartialResult?: (text: string) => void;
  onError?: (error: Error) => void;
  private recognition: BrowserSpeechRecognition | null = null;
  private transcript = "";
  private stopping = false;

  isSupported() {
    return typeof window !== "undefined" && Boolean(getSpeechRecognition());
  }

  async start() {
    const Constructor = getSpeechRecognition();
    if (!Constructor) {
      throw new Error("当前浏览器不支持语音识别，请使用文字输入。");
    }

    this.transcript = "";
    this.stopping = false;
    this.recognition = new Constructor();
    this.recognition.lang = "zh-CN";
    this.recognition.interimResults = true;
    this.recognition.continuous = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("")
        .trim();
      this.transcript = text;
      this.onPartialResult?.(text);
    };
    this.recognition.onerror = (event) => {
      if (this.stopping || this.transcript.trim()) return;
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.onError?.(new Error("语音识别失败，请重新录制或改用文字输入。"));
    };
    this.recognition.start();
  }

  async stop() {
    if (!this.recognition) return this.transcript;
    const current = this.recognition;
    this.recognition = null;
    this.stopping = true;
    await new Promise<void>((resolve) => {
      current.onend = () => resolve();
      window.setTimeout(resolve, 800);
      current.stop();
    });
    this.stopping = false;
    return this.transcript;
  }
}
