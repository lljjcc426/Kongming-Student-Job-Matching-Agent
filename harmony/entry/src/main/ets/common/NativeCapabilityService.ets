import { authentication } from '@kit.AccountKit';
import { systemShare } from '@kit.ShareKit';
import { textRecognition } from '@kit.CoreVisionKit';
import { speechRecognizer, textToSpeech } from '@kit.CoreSpeechKit';
import { preferences } from '@kit.ArkData';
import { audio } from '@kit.AudioKit';
import { image } from '@kit.ImageKit';
import { util } from '@kit.ArkTS';
import { fileIo } from '@kit.CoreFileKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';
import { CareerFormData, saveCareerFormData, updateAllCareerForms } from '../common/CareerFormStore';

const CAMERA_PERMISSION: Permissions = 'ohos.permission.CAMERA';
const MICROPHONE_PERMISSION: Permissions = 'ohos.permission.MICROPHONE';

interface HuaweiAuthPayload {
  nativeAvailable: boolean;
  signedIn: boolean;
  displayName: string;
  accountHint: string;
  message: string;
  errorCode?: number;
}

interface ApplicationFormPayload {
  trackedCount?: number;
  pendingCount?: number;
  nextAction?: string;
  jobTitle?: string;
  updatedAt?: string;
}


export class NativeCapabilityService {
  private signedIn: boolean = false;
  private accountHint: string = '';
  private context: common.UIAbilityContext;
  private authLoaded: boolean = false;
  private ttsEngine: textToSpeech.TextToSpeechEngine | undefined = undefined;
  private speechEngine: speechRecognizer.SpeechRecognitionEngine | undefined = undefined;
  private audioCapturer: audio.AudioCapturer | undefined = undefined;
  private speechCaptureTask: Promise<void> | undefined = undefined;
  private speechSessionId: string = '';
  private speechTranscript: string = '';
  private speechActive: boolean = false;
  private speechError: string = '';

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  private serialize(message: string, errorCode?: number): string {
    const payload: HuaweiAuthPayload = {
      nativeAvailable: true,
      signedIn: this.signedIn,
      displayName: this.signedIn ? `华为用户 · ${this.accountHint}` : '',
      accountHint: this.accountHint,
      message,
      errorCode,
    };
    return JSON.stringify(payload);
  }

  private isNativeCaller(): boolean {
    return true;
  }

  private async restoreAuthState(): Promise<void> {
    if (this.authLoaded) return;
    this.authLoaded = true;
    try {
      const store = await preferences.getPreferences(this.context, 'account_state');
      this.signedIn = await store.get('signed_in', false) as boolean;
      this.accountHint = await store.get('account_hint', '') as string;
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Account state restore failed: ${businessError.code} ${businessError.message}`);
    }
  }

  private async persistAuthState(): Promise<void> {
    const store = await preferences.getPreferences(this.context, 'account_state');
    await store.put('signed_in', this.signedIn);
    await store.put('account_hint', this.accountHint);
    await store.flush();
  }

  async getHuaweiAuthState(): Promise<string> {
    if (!this.isNativeCaller()) {
      return this.serialize('已拒绝非本地页面访问账号能力。');
    }
    await this.restoreAuthState();
    return this.serialize(this.signedIn ? '已恢复本机上的华为账号登录状态。' : '尚未登录华为账号。');
  }

  async loginWithHuawei(): Promise<string> {
    if (!this.isNativeCaller()) {
      return this.serialize('已拒绝非本地页面调用华为账号登录。');
    }

    const requestState = `kongming_${Date.now()}`;
    try {
      const provider = new authentication.HuaweiIDProvider();
      const request = provider.createLoginWithHuaweiIDRequest();
      request.forceLogin = true;
      request.state = requestState;
      request.nonce = requestState;
      request.idTokenSignAlgorithm = authentication.IdTokenSignAlgorithm.PS256;

      const authController = new authentication.AuthenticationController(this.context);
      const response = await authController.executeRequest(request) as authentication.LoginWithHuaweiIDResponse;
      if (response.state !== requestState || !response.data?.openID) {
        return this.serialize('华为账号返回结果校验失败，请重试。');
      }

      const openID = response.data.openID;
      this.accountHint = openID.length > 6 ? openID.slice(openID.length - 6) : openID;
      this.signedIn = true;
      await this.persistAuthState();
      return this.serialize('华为账号登录成功。');
    } catch (error) {
      const businessError = error as BusinessError;
      if (businessError.code === authentication.AuthenticationErrorCode.USER_CANCELED) {
        return this.serialize('已取消华为账号登录。', businessError.code);
      }
      if (businessError.code === authentication.AuthenticationErrorCode.APP_NOT_AUTHORIZED) {
        return this.serialize('当前应用尚未在 AppGallery Connect 授权华为账号服务。', businessError.code);
      }
      if (businessError.code === authentication.AuthenticationErrorCode.PACKAGE_FINGERPRINT_CHECK_ERROR) {
        return this.serialize('应用签名指纹与 AppGallery Connect 配置不一致。', businessError.code);
      }
      console.error(`Huawei account login failed: ${businessError.code} ${businessError.message}`);
      return this.serialize('华为账号登录失败，请检查网络与应用配置。', businessError.code);
    }
  }

  async logoutHuawei(): Promise<string> {
    if (!this.isNativeCaller()) {
      return this.serialize('已拒绝非本地页面访问账号能力。');
    }
    this.signedIn = false;
    this.accountHint = '';
    await this.persistAuthState();
    return this.serialize('已退出孔明职配账号；设备上的华为账号保持登录。');
  }

  private async getTextToSpeechEngine(): Promise<textToSpeech.TextToSpeechEngine> {
    if (this.ttsEngine) return this.ttsEngine;
    try {
      this.ttsEngine = await textToSpeech.createEngine({ language: 'zh-CN', person: 0, online: 1 });
    } catch (error) {
      this.ttsEngine = await textToSpeech.createEngine({ language: 'zh-CN', person: 0, online: 0 });
    }
    this.ttsEngine.setListener({
      onStart: (requestId: string, response: textToSpeech.StartResponse): void => {
        console.info(`Core Speech TTS started: ${requestId} ${response}`);
      },
      onComplete: (requestId: string, response: textToSpeech.CompleteResponse): void => {
        console.info(`Core Speech TTS completed: ${requestId} ${response}`);
      },
      onStop: (requestId: string, response: textToSpeech.StopResponse): void => {
        console.info(`Core Speech TTS stopped: ${requestId} ${response}`);
      },
      onError: (requestId: string, errorCode: number, errorMessage: string): void => {
        console.error(`Core Speech TTS failed: ${requestId} ${errorCode} ${errorMessage}`);
      },
    });
    return this.ttsEngine;
  }

  async speakText(payload: string): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '已拒绝非本地页面调用语音播报。' });
    }
    try {
      const parsed = JSON.parse(payload) as Record<string, string>;
      const content = typeof parsed.content === 'string' ? parsed.content.trim().slice(0, 2000) : '';
      if (!content) {
        return JSON.stringify({ nativeAvailable: true, ok: false, message: '没有可播报的文本。' });
      }
      const engine = await this.getTextToSpeechEngine();
      engine.stop();
      engine.speak(content, { requestId: `tts_${Date.now()}` });
      return JSON.stringify({ nativeAvailable: true, ok: true, message: '已使用 Core Speech 开始播报。' });
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Core Speech TTS invocation failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, message: 'Core Speech 语音播报暂时不可用。', errorCode: businessError.code });
    }
  }

  async stopSpeaking(): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '已拒绝非本地页面停止语音播报。' });
    }
    if (this.ttsEngine) this.ttsEngine.stop();
    return JSON.stringify({ nativeAvailable: true, ok: true, message: '已停止语音播报。' });
  }

  private async createSpeechEngine(): Promise<speechRecognizer.SpeechRecognitionEngine> {
    try {
      return await speechRecognizer.createEngine({ language: 'zh-CN', online: 1 });
    } catch (error) {
      return await speechRecognizer.createEngine({ language: 'zh-CN', online: 0 });
    }
  }

  private async captureSpeechAudio(): Promise<void> {
    const startedAt = Date.now();
    try {
      while (this.speechActive && Date.now() - startedAt < 15000) {
        const buffer = await this.audioCapturer!.read(1280, true);
        if (!this.speechActive || buffer.byteLength === 0) continue;
        const bytes = new Uint8Array(buffer);
        for (let offset = 0; offset + 640 <= bytes.byteLength; offset += 1280) {
          const size = Math.min(1280, bytes.byteLength - offset);
          if (size !== 640 && size !== 1280) continue;
          this.speechEngine!.writeAudio(this.speechSessionId, bytes.slice(offset, offset + size));
        }
      }
      this.speechActive = false;
      await this.audioCapturer!.stop();
      this.speechEngine!.finish(this.speechSessionId);
      await new Promise<void>((resolve) => setTimeout(resolve, 700));
    } catch (error) {
      const businessError = error as BusinessError;
      this.speechError = businessError.message || '本机语音识别过程中断。';
      console.error(`Core Speech recognition capture failed: ${businessError.code} ${businessError.message}`);
    } finally {
      if (this.audioCapturer) {
        await this.audioCapturer.release().catch(() => {});
      }
      if (this.speechEngine) {
        this.speechEngine.shutdown();
      }
      this.audioCapturer = undefined;
      this.speechEngine = undefined;
      this.speechCaptureTask = undefined;
    }
  }

  async startSpeechRecognition(): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '已拒绝非本地页面调用语音识别。' });
    }
    if (this.speechActive) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '已有一段语音正在识别。' });
    }

    try {
      const accessManager = abilityAccessCtrl.createAtManager();
      const permissionResult = await accessManager.requestPermissionsFromUser(this.context, [MICROPHONE_PERMISSION]);
      if (permissionResult.authResults.length !== 1 || permissionResult.authResults[0] !== 0) {
        return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '未获得麦克风权限，请改用文字输入。' });
      }

      this.speechSessionId = `speech_${Date.now()}`;
      this.speechTranscript = '';
      this.speechError = '';
      this.speechEngine = await this.createSpeechEngine();
      this.speechEngine.setListener({
        onStart: (sessionId: string, eventMessage: string): void => {
          console.info(`Core Speech recognition started: ${sessionId} ${eventMessage}`);
        },
        onEvent: (sessionId: string, eventCode: number, eventMessage: string): void => {
          console.info(`Core Speech recognition event: ${sessionId} ${eventCode} ${eventMessage}`);
        },
        onResult: (sessionId: string, result: speechRecognizer.SpeechRecognitionResult): void => {
          if (sessionId === this.speechSessionId && result.result.trim()) this.speechTranscript = result.result.trim();
        },
        onComplete: (sessionId: string, eventMessage: string): void => {
          console.info(`Core Speech recognition completed: ${sessionId} ${eventMessage}`);
        },
        onError: (sessionId: string, errorCode: number, errorMessage: string): void => {
          this.speechError = errorMessage;
          console.error(`Core Speech recognition failed: ${sessionId} ${errorCode} ${errorMessage}`);
        },
      });
      this.audioCapturer = await audio.createAudioCapturer({
        streamInfo: {
          samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_16000,
          channels: audio.AudioChannel.CHANNEL_1,
          sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
          encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW,
        },
        capturerInfo: {
          source: audio.SourceType.SOURCE_TYPE_VOICE_RECOGNITION,
          capturerFlags: 0,
        },
      });
      this.speechEngine.startListening({
        sessionId: this.speechSessionId,
        audioInfo: { audioType: 'pcm', sampleRate: 16000, soundChannel: 1, sampleBit: 16 },
      });
      await this.audioCapturer.start();
      this.speechActive = true;
      this.speechCaptureTask = this.captureSpeechAudio();
      return JSON.stringify({ nativeAvailable: true, ok: true, text: '', message: 'Core Speech 正在本机收听，最长 15 秒。' });
    } catch (error) {
      const businessError = error as BusinessError;
      this.speechActive = false;
      console.error(`Core Speech recognition start failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: 'Core Speech 语音识别无法启动。', errorCode: businessError.code });
    }
  }

  async stopSpeechRecognition(): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '已拒绝非本地页面停止语音识别。' });
    }
    this.speechActive = false;
    if (this.speechCaptureTask) await this.speechCaptureTask;
    const ok = this.speechTranscript.trim().length > 0;
    return JSON.stringify({
      nativeAvailable: true,
      ok,
      text: this.speechTranscript,
      message: ok ? '已使用 Core Speech 完成本机语音识别。' : this.speechError || '未识别到有效语音，请重试或改用文字输入。',
    });
  }

  async updateApplicationForm(payload: string): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '已拒绝非本地页面更新服务卡片。' });
    }
    try {
      const parsed = JSON.parse(payload) as ApplicationFormPayload;
      const data = new CareerFormData();
      data.trackedCount = typeof parsed.trackedCount === 'number' ? Math.max(0, parsed.trackedCount) : 0;
      data.pendingCount = typeof parsed.pendingCount === 'number' ? Math.max(0, parsed.pendingCount) : 0;
      data.nextAction = typeof parsed.nextAction === 'string' && parsed.nextAction.trim() ? parsed.nextAction.trim() : data.nextAction;
      data.jobTitle = typeof parsed.jobTitle === 'string' && parsed.jobTitle.trim() ? parsed.jobTitle.trim() : data.jobTitle;
      data.updatedAt = typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim() ? parsed.updatedAt.trim() : data.updatedAt;
      await saveCareerFormData(this.context, data);
      const updatedCount = await updateAllCareerForms(this.context);
      return JSON.stringify({ nativeAvailable: true, ok: true, message: `已同步 ${updatedCount} 个求职服务卡片。` });
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Application form sync failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '求职服务卡片同步失败。', errorCode: businessError.code });
    }
  }

  async shareText(payload: string): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '已拒绝非本地页面调用系统分享。' });
    }

    try {
      const parsed = JSON.parse(payload) as Record<string, string>;
      const title = typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : '孔明职配分析报告';
      const content = typeof parsed.content === 'string' ? parsed.content.slice(0, 100000) : '';
      if (!content.trim()) {
        return JSON.stringify({ nativeAvailable: true, ok: false, message: '没有可分享的内容。' });
      }
      const data = new systemShare.SharedData({
        utd: 'general.plain-text',
        title,
        content,
      });
      const shareController = new systemShare.ShareController(data);
      await shareController.show(this.context, {});
      return JSON.stringify({ nativeAvailable: true, ok: true, message: '已打开鸿蒙系统分享面板。' });
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Harmony share failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '鸿蒙系统分享暂时不可用。', errorCode: businessError.code });
    }
  }

  async recognizeResumeImage(dataUrl: string): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '已拒绝非本地页面调用本机 OCR。' });
    }
    if (!dataUrl.startsWith('data:image/') || dataUrl.length > 11000000) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '图片格式无效或超过本机 OCR 大小限制。' });
    }

    const separator = dataUrl.indexOf(',');
    if (separator < 0) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '无法读取图片数据。' });
    }

    let source: image.ImageSource | undefined = undefined;
    let pixelMap: image.PixelMap | undefined = undefined;
    try {
      const bytes = new util.Base64Helper().decodeSync(dataUrl.slice(separator + 1));
      source = image.createImageSource(bytes.buffer);
      pixelMap = await source.createPixelMap();
      const initialized = await textRecognition.init();
      if (!initialized) {
        return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: 'Core Vision OCR 初始化失败。' });
      }
      const result = await textRecognition.recognizeText({ pixelMap });
      const text = result.value.trim();
      return JSON.stringify({
        nativeAvailable: true,
        ok: text.length > 0,
        text,
        message: text.length > 0 ? '已使用 Core Vision 在本机完成文字识别。' : '本机 OCR 未识别到文字。',
      });
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Core Vision OCR failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '本机 OCR 暂时不可用。', errorCode: businessError.code });
    } finally {
      if (pixelMap) {
        try {
          await pixelMap.release();
        } catch (error) {
          console.warn(`Pixel map release failed: ${String(error)}`);
        }
      }
      if (source) {
        try {
          await source.release();
        } catch (error) {
          console.warn(`Image source release failed: ${String(error)}`);
        }
      }
      try {
        await textRecognition.release();
      } catch (error) {
        console.warn(`Core Vision OCR release failed: ${String(error)}`);
      }
    }
  }

  async recognizeResumeImageUri(uri: string): Promise<string> {
    if (!this.isNativeCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '已拒绝非本地页面调用本机 OCR。' });
    }
    if (!uri || uri.length > 4096) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '图片地址无效，请重新选择图片。' });
    }

    let file: fileIo.File | undefined = undefined;
    try {
      file = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
      const fileStat = await fileIo.stat(file.fd);
      if (fileStat.size <= 0 || fileStat.size > 8 * 1024 * 1024) {
        return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '图片过大或为空，请选择 8 MB 以内的简历图片。' });
      }
      const buffer = new ArrayBuffer(fileStat.size);
      const bytesRead = await fileIo.read(file.fd, buffer);
      if (bytesRead <= 0) {
        return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '无法读取所选图片。' });
      }
      const bytes = new Uint8Array(buffer, 0, bytesRead);
      const base64 = new util.Base64Helper().encodeToStringSync(bytes);
      const fileName = file.name.toLowerCase();
      const mimeType = fileName.endsWith('.png') ? 'image/png' : fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      return await this.recognizeResumeImage(`data:${mimeType};base64,${base64}`);
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Selected resume image read failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '无法读取所选图片，请改用文字输入。', errorCode: businessError.code });
    } finally {
      if (file) {
        try {
          await fileIo.close(file);
        } catch (error) {
          console.warn(`Selected resume image close failed: ${String(error)}`);
        }
      }
    }
  }
}
