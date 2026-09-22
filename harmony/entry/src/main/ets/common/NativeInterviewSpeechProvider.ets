import {
  NativeCapabilityService,
  NativeRecognitionErrorListener,
  NativeSpeechLifecycleListener,
} from './NativeCapabilityService';

export interface NativeInterviewSpeechProvider {
  readonly providerId: string;
  readonly providerName: string;
  setLifecycleListener(listener: NativeSpeechLifecycleListener | undefined): void;
  setRecognitionErrorListener(listener: NativeRecognitionErrorListener | undefined): void;
  speak(content: string): Promise<string>;
  stopSpeaking(): Promise<string>;
  startListening(): Promise<string>;
  stopListening(): Promise<string>;
}

export class CoreSpeechInterviewProvider implements NativeInterviewSpeechProvider {
  readonly providerId: string = 'huawei-core-speech';
  readonly providerName: string = 'Core Speech';
  private capabilityService: NativeCapabilityService;

  constructor(capabilityService: NativeCapabilityService) {
    this.capabilityService = capabilityService;
  }

  setLifecycleListener(listener: NativeSpeechLifecycleListener | undefined): void {
    this.capabilityService.setTtsLifecycleListener(listener);
  }

  setRecognitionErrorListener(listener: NativeRecognitionErrorListener | undefined): void {
    this.capabilityService.setRecognitionErrorListener(listener);
  }

  speak(content: string): Promise<string> {
    return this.capabilityService.speakText(JSON.stringify({ content }));
  }

  stopSpeaking(): Promise<string> {
    return this.capabilityService.stopSpeaking();
  }

  startListening(): Promise<string> {
    return this.capabilityService.startSpeechRecognition();
  }

  stopListening(): Promise<string> {
    return this.capabilityService.stopSpeechRecognition();
  }
}
