import type { LiveTalkingAdapter, LiveTalkingSessionConfig } from "./types";

export class BrowserLiveTalkingAdapter implements LiveTalkingAdapter {
  private config: LiveTalkingSessionConfig = {};

  async connect(sessionConfig: LiveTalkingSessionConfig) {
    this.config = sessionConfig;
    if (!this.config.baseUrl && !this.config.webRtcUrl) {
      throw new Error("LiveTalking 服务地址未配置。");
    }
  }

  async sendText(text: string) {
    if (!this.config.baseUrl) return;
    await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/talk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, avatarId: this.config.avatarId }),
    }).catch(() => undefined);
  }

  async sendAudio(audioBlob: Blob) {
    if (!this.config.baseUrl) return;
    const formData = new FormData();
    formData.append("audio", audioBlob);
    if (this.config.avatarId) formData.append("avatarId", this.config.avatarId);
    await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/talk/audio`, {
      method: "POST",
      body: formData,
    }).catch(() => undefined);
  }

  async interrupt() {
    if (!this.config.baseUrl) return;
    await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/interrupt`, { method: "POST" }).catch(() => undefined);
  }

  async disconnect() {
    this.config = {};
  }
}
