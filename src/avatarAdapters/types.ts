export interface AvatarAdapter {
  init(container: HTMLElement): Promise<void>;
  speak(text: string, audioUrl?: string): Promise<void>;
  listen(): void;
  think(): void;
  idle(): void;
  destroy(): void;
}

export type LiveTalkingSessionConfig = {
  baseUrl?: string;
  webRtcUrl?: string;
  avatarId?: string;
};

export interface LiveTalkingAdapter {
  connect(sessionConfig: LiveTalkingSessionConfig): Promise<void>;
  sendText(text: string): Promise<void>;
  sendAudio(audioBlob: Blob): Promise<void>;
  interrupt(): Promise<void>;
  disconnect(): Promise<void>;
}
