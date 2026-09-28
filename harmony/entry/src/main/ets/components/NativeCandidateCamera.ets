import { camera } from '@kit.CameraKit';
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';
import { fileIo, fileUri } from '@kit.CoreFileKit';
import { media } from '@kit.MediaKit';

const CAMERA_PERMISSION: Permissions = 'ohos.permission.CAMERA';

@Component
export struct NativeCandidateCamera {
  @Prop active: boolean = false;
  @Prop sessionId: string = '';
  @Prop existingVideoUri: string = '';
  @Prop maxDurationSeconds: number = 1200;
  @Prop viewportWidth: number = 148;
  @Prop viewportHeight: number = 98;
  @State cameraEnabled: boolean = false;
  @State cameraReady: boolean = false;
  @State cameraMessage: string = '镜头默认关闭';
  @State opening: boolean = false;
  @State releasing: boolean = false;
  @State recording: boolean = false;
  @State recordingBusy: boolean = false;
  @State recordingSeconds: number = 0;
  @State recordedInThisView: boolean = false;
  onRecordingSaved: (sessionId: string, videoUri: string, durationSeconds: number, sizeBytes: number) => void =
    () => {};
  onRecordingStateChange: (sessionId: string, recording: boolean) => void = () => {};
  private controller: XComponentController = new XComponentController();
  private hostContext: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
  private cameraInput: camera.CameraInput | undefined = undefined;
  private previewOutput: camera.PreviewOutput | undefined = undefined;
  private videoOutput: camera.VideoOutput | undefined = undefined;
  private videoProfile: camera.VideoProfile | undefined = undefined;
  private captureSession: camera.VideoSession | undefined = undefined;
  private avRecorder: media.AVRecorder | undefined = undefined;
  private outputFile: fileIo.File | undefined = undefined;
  private outputPath: string = '';
  private recordingStartedAt: number = 0;
  private recordingTimer: number = -1;

  aboutToDisappear(): void {
    void this.stopPreview();
  }

  private async startPreview(): Promise<void> {
    if (!this.active || this.opening || this.releasing || this.cameraReady) return;
    this.opening = true;
    this.cameraMessage = '正在开启前置镜头';
    try {
      const accessManager = abilityAccessCtrl.createAtManager();
      const permissionResult = await accessManager.requestPermissionsFromUser(this.hostContext, [CAMERA_PERMISSION]);
      if (permissionResult.authResults.length !== 1 || permissionResult.authResults[0] !== 0) {
        this.cameraMessage = '相机未授权，可继续面试';
        return;
      }
      const surfaceId = this.controller.getXComponentSurfaceId();
      if (!surfaceId) {
        this.cameraMessage = '预览画面尚未就绪';
        return;
      }
      const cameraManager = camera.getCameraManager(this.hostContext);
      const devices = cameraManager.getSupportedCameras();
      if (devices.length === 0) {
        this.cameraMessage = '当前设备没有可用镜头';
        return;
      }
      let selectedDevice: camera.CameraDevice = devices[0];
      for (const device of devices) {
        if (device.cameraPosition === camera.CameraPosition.CAMERA_POSITION_FRONT) {
          selectedDevice = device;
          break;
        }
      }
      const capability = cameraManager.getSupportedOutputCapability(selectedDevice, camera.SceneMode.NORMAL_VIDEO);
      if (capability.previewProfiles.length === 0) {
        this.cameraMessage = '当前镜头不支持实时预览';
        return;
      }
      this.videoProfile = capability.videoProfiles.length > 0 ?
        this.selectVideoProfile(capability.videoProfiles) : undefined;
      this.cameraInput = cameraManager.createCameraInput(selectedDevice);
      await this.cameraInput.open();
      this.previewOutput = cameraManager.createPreviewOutput(capability.previewProfiles[0], surfaceId);
      this.captureSession = cameraManager.createSession<camera.VideoSession>(camera.SceneMode.NORMAL_VIDEO);
      this.captureSession.beginConfig();
      this.captureSession.addInput(this.cameraInput);
      this.captureSession.addOutput(this.previewOutput);
      await this.captureSession.commitConfig();
      await this.captureSession.start();
      this.cameraReady = true;
      if (!this.videoProfile) {
        this.cameraMessage = '本机预览，当前设备不支持录像';
      } else {
        this.cameraMessage = this.existingVideoUri ? '本轮已有录像，可重新录制' : '本机预览，录像需主动开始';
      }
    } catch (error) {
      console.error(`Candidate camera preview failed: ${String(error)}`);
      this.cameraMessage = '镜头暂不可用，可继续文字或语音面试';
      await this.releaseCamera();
    } finally {
      this.opening = false;
    }
  }

  private selectVideoProfile(profiles: camera.VideoProfile[]): camera.VideoProfile {
    let selected = profiles[0];
    let selectedDistance = Math.abs(selected.size.width * selected.size.height - 1280 * 720);
    for (const profile of profiles) {
      const pixels = profile.size.width * profile.size.height;
      const distance = Math.abs(pixels - 1280 * 720);
      if (pixels <= 1920 * 1080 && distance < selectedDistance) {
        selected = profile;
        selectedDistance = distance;
      }
    }
    return selected;
  }

  private async prepareRecorder(profile: camera.VideoProfile): Promise<void> {
    const recordingDirectory = `${this.hostContext.filesDir}/interview-recordings`;
    if (!fileIo.accessSync(recordingDirectory)) fileIo.mkdirSync(recordingDirectory);
    const safeSessionId = (this.sessionId || `interview-${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, '_');
    this.outputPath = `${recordingDirectory}/${safeSessionId}-${Date.now()}.mp4`;
    this.outputFile = fileIo.openSync(
      this.outputPath,
      fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
    );
    const frameRate = Math.max(profile.frameRateRange.min, Math.min(30, profile.frameRateRange.max));
    const recorderProfile: media.AVRecorderProfile = {
      fileFormat: media.ContainerFormatType.CFT_MPEG_4,
      videoBitrate: Math.min(4000000, Math.max(1200000, profile.size.width * profile.size.height * 3)),
      videoCodec: media.CodecMimeType.VIDEO_AVC,
      videoFrameWidth: profile.size.width,
      videoFrameHeight: profile.size.height,
      videoFrameRate: frameRate,
    };
    const recorderConfig: media.AVRecorderConfig = {
      videoSourceType: media.VideoSourceType.VIDEO_SOURCE_TYPE_SURFACE_YUV,
      profile: recorderProfile,
      url: `fd://${this.outputFile.fd}`,
      maxDuration: Math.max(10, this.maxDurationSeconds),
    };
    this.avRecorder = await media.createAVRecorder();
    await this.avRecorder.prepare(recorderConfig);
  }

  private startRecordingTimer(): void {
    this.stopRecordingTimer();
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds = Math.max(0, Math.floor((Date.now() - this.recordingStartedAt) / 1000));
      if (this.recordingSeconds >= this.maxDurationSeconds) void this.stopRecording();
    }, 1000);
  }

  private stopRecordingTimer(): void {
    if (this.recordingTimer < 0) return;
    clearInterval(this.recordingTimer);
    this.recordingTimer = -1;
  }

  private async configureCaptureSession(includeVideoOutput: boolean): Promise<void> {
    if (!this.cameraInput || !this.previewOutput) throw new Error('Camera preview is not ready');
    const previousSession = this.captureSession;
    this.captureSession = undefined;
    if (previousSession) {
      try {
        await previousSession.stop();
      } catch (_) {
      }
      await previousSession.release();
    }
    const nextSession = camera.getCameraManager(this.hostContext)
      .createSession<camera.VideoSession>(camera.SceneMode.NORMAL_VIDEO);
    try {
      nextSession.beginConfig();
      nextSession.addInput(this.cameraInput);
      nextSession.addOutput(this.previewOutput);
      if (includeVideoOutput) {
        if (!this.videoOutput) throw new Error('Recording output is not ready');
        nextSession.addOutput(this.videoOutput);
      }
      await nextSession.commitConfig();
      await nextSession.start();
      this.captureSession = nextSession;
    } catch (error) {
      try {
        await nextSession.release();
      } catch (_) {
      }
      throw new Error(String(error));
    }
  }

  private async releaseVideoOutput(): Promise<void> {
    try {
      if (this.videoOutput) await this.videoOutput.release();
    } catch (error) {
      console.warn(`Candidate camera video output release failed: ${String(error)}`);
    }
    this.videoOutput = undefined;
  }

  private async restorePreviewAfterRecording(): Promise<void> {
    if (!this.cameraInput || !this.previewOutput) return;
    try {
      await this.configureCaptureSession(false);
      this.cameraReady = true;
    } catch (error) {
      console.warn(`Candidate camera preview restore failed: ${String(error)}`);
      this.cameraReady = false;
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.cameraReady || !this.videoProfile || this.recording || this.recordingBusy) return;
    const profile = this.videoProfile;
    this.recordingBusy = true;
    this.cameraMessage = '正在开始本机录像';
    try {
      await this.prepareRecorder(profile);
      const recorder = this.avRecorder;
      if (!recorder) throw new Error('Recorder preparation did not complete');
      const recordingSurfaceId = await recorder.getInputSurface();
      const videoOutput = camera.getCameraManager(this.hostContext)
        .createVideoOutput(profile, recordingSurfaceId);
      this.videoOutput = videoOutput;
      await this.configureCaptureSession(true);
      await videoOutput.start();
      await recorder.start();
      this.recordingStartedAt = Date.now();
      this.recordingSeconds = 0;
      this.recording = true;
      this.onRecordingStateChange(this.sessionId, true);
      this.startRecordingTimer();
      this.cameraMessage = '正在录像，仅保存画面';
    } catch (error) {
      console.error(`Candidate recording start failed: ${String(error)}`);
      try {
        if (this.videoOutput) await this.videoOutput.stop();
      } catch (_) {
      }
      if (this.videoOutput) await this.restorePreviewAfterRecording();
      await this.releaseVideoOutput();
      await this.releaseRecorder(true);
      this.cameraMessage = '录像启动失败，实时预览仍可使用';
    } finally {
      this.recordingBusy = false;
    }
  }

  private async stopRecording(): Promise<void> {
    if (!this.recording || this.recordingBusy) return;
    this.recordingBusy = true;
    this.stopRecordingTimer();
    try {
      if (this.avRecorder) await this.avRecorder.stop();
      if (this.videoOutput) await this.videoOutput.stop();
      this.recordingSeconds = Math.max(1, Math.floor((Date.now() - this.recordingStartedAt) / 1000));
      await this.restorePreviewAfterRecording();
      await this.releaseVideoOutput();
      await this.releaseRecorder(false);
      const sizeBytes = fileIo.statSync(this.outputPath).size;
      if (sizeBytes <= 0) throw new Error('Recorded file is empty');
      const savedUri = fileUri.getUriFromPath(this.outputPath);
      this.recordedInThisView = true;
      this.cameraMessage = `录像已保存 ${this.formattedRecordingTime()}`;
      this.onRecordingSaved(this.sessionId, savedUri, this.recordingSeconds, sizeBytes);
    } catch (error) {
      console.error(`Candidate recording stop failed: ${String(error)}`);
      this.cameraMessage = '录像保存失败，未覆盖已有记录';
      await this.restorePreviewAfterRecording();
      await this.releaseVideoOutput();
      await this.releaseRecorder(true);
    } finally {
      this.recording = false;
      this.recordingStartedAt = 0;
      this.onRecordingStateChange(this.sessionId, false);
      this.recordingBusy = false;
    }
  }

  private formattedRecordingTime(): string {
    const minutes = Math.floor(this.recordingSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.recordingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  private async releaseRecorder(deleteOutput: boolean): Promise<void> {
    try {
      if (this.avRecorder) await this.avRecorder.release();
    } catch (error) {
      console.warn(`Candidate recorder release failed: ${String(error)}`);
    }
    this.avRecorder = undefined;
    try {
      if (this.outputFile) fileIo.closeSync(this.outputFile);
    } catch (error) {
      console.warn(`Candidate recording file close failed: ${String(error)}`);
    }
    this.outputFile = undefined;
    if (deleteOutput && this.outputPath) {
      try {
        if (fileIo.accessSync(this.outputPath)) fileIo.unlinkSync(this.outputPath);
      } catch (error) {
        console.warn(`Candidate recording cleanup failed: ${String(error)}`);
      }
      this.outputPath = '';
    }
  }

  private async releaseCamera(): Promise<void> {
    if (this.releasing) return;
    this.releasing = true;
    if (this.recording) await this.stopRecording();
    this.stopRecordingTimer();
    try {
      if (this.captureSession) await this.captureSession.stop();
    } catch (error) {
      console.warn(`Candidate camera stop failed: ${String(error)}`);
    }
    try {
      if (this.captureSession) await this.captureSession.release();
    } catch (error) {
      console.warn(`Candidate camera session release failed: ${String(error)}`);
    }
    await this.releaseVideoOutput();
    try {
      if (this.previewOutput) await this.previewOutput.release();
    } catch (error) {
      console.warn(`Candidate camera output release failed: ${String(error)}`);
    }
    try {
      if (this.cameraInput) await this.cameraInput.close();
    } catch (error) {
      console.warn(`Candidate camera input close failed: ${String(error)}`);
    }
    if (this.avRecorder) await this.releaseRecorder(true);
    this.captureSession = undefined;
    this.videoProfile = undefined;
    this.previewOutput = undefined;
    this.cameraInput = undefined;
    this.cameraReady = false;
    this.releasing = false;
  }

  private async stopPreview(): Promise<void> {
    this.cameraEnabled = false;
    this.cameraMessage = '镜头默认关闭';
    await this.releaseCamera();
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.cameraEnabled) {
        XComponent({
          id: 'candidate-camera-preview',
          type: XComponentType.SURFACE,
          controller: this.controller,
        })
          .width('100%')
          .height('100%')
          .onLoad(() => { void this.startPreview(); })
          .onDestroy(() => { void this.releaseCamera(); })
        if (!this.cameraReady) {
          Column({ space: 5 }) {
            if (this.opening) {
              LoadingProgress()
                .width(20)
                .height(20)
                .color($r('app.color.km_text_on_primary'))
            } else {
              SymbolGlyph($r('sys.symbol.exclamationmark_triangle'))
                .fontSize(16)
                .fontColor([$r('app.color.km_text_on_primary')])
            }
            Text(this.cameraMessage)
              .id('candidate-camera-status')
              .fontSize(8)
              .fontColor($r('app.color.km_text_on_primary'))
              .textAlign(TextAlign.Center)
              .maxLines(2)
            if (!this.opening) {
              Button('重试镜头')
                .id('candidate-camera-retry')
                .height(24)
                .fontSize(9)
                .fontColor($r('app.color.km_text_on_primary'))
                .backgroundColor('#CC050A12')
                .borderRadius(6)
                .enabled(this.active && !this.releasing)
                .onClick(() => { void this.startPreview(); })
            }
          }
          .padding({ left: 10, right: 10, top: 14, bottom: 4 })
        }
      } else {
        Button() {
          Column({ space: 6 }) {
            SymbolGlyph($r('sys.symbol.video'))
              .fontSize(22)
              .fontColor([$r('app.color.km_text_on_primary')])
            Text('开启我的镜头')
              .fontSize(9)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_on_primary'))
          }
        }
        .id('candidate-camera-open')
        .width('100%')
        .height('100%')
        .backgroundColor(Color.Transparent)
        .borderRadius(8)
        .accessibilityText('开启候选人镜头')
        .enabled(this.active && !this.releasing)
        .onClick(() => {
          this.cameraEnabled = true;
          this.cameraMessage = '正在请求相机权限';
        })
      }
      Row({ space: 4 }) {
        Circle()
          .width(5)
          .height(5)
          .fill(this.cameraReady ? $r('app.color.km_success') : $r('app.color.km_text_tertiary'))
        Text(this.recording ? `录像 ${this.formattedRecordingTime()}` :
          (this.cameraReady ? '你' : '我的镜头'))
          .fontSize(7)
          .fontColor($r('app.color.km_text_on_primary'))
          .maxLines(1)
      }
      .position({ x: 7, y: 7 })
      .padding({ left: 6, right: 6, top: 3, bottom: 3 })
      .backgroundColor('#99050A12')
      .borderRadius(5)
      if (this.cameraEnabled) {
        Button() {
          SymbolGlyph($r('sys.symbol.dot_video_slash'))
            .fontSize(12)
            .fontColor([$r('app.color.km_text_on_primary')])
        }
        .width(28)
        .height(28)
        .position({ x: this.viewportWidth - 36, y: 6 })
        .backgroundColor('#99050A12')
        .borderRadius(6)
        .id('candidate-camera-close')
        .enabled(!this.opening && !this.recordingBusy)
        .accessibilityText('关闭候选人镜头')
        .onClick(() => { void this.stopPreview(); })
        if (this.cameraReady && !this.recordedInThisView && this.videoProfile) {
          Button() {
            if (this.recording) {
              Rect()
                .width(10)
                .height(10)
                .fill($r('app.color.km_text_on_primary'))
                .borderRadius(2)
            } else {
              Circle()
                .width(13)
                .height(13)
                .fill($r('app.color.km_danger'))
            }
          }
          .width(30)
          .height(30)
          .position({ x: this.viewportWidth - 36, y: this.viewportHeight - 36 })
          .backgroundColor('#CC050A12')
          .borderRadius(15)
          .enabled(!this.recordingBusy)
          .accessibilityText(this.recording ? '停止并保存候选人录像' : '开始候选人本机录像')
          .onClick(() => {
            if (this.recording) void this.stopRecording();
            else void this.startRecording();
          })
        }
      }
    }
    .width(this.viewportWidth)
    .height(this.viewportHeight)
    .backgroundColor('#CC18202B')
    .border({ width: 1, color: '#66FFFFFF' })
    .borderRadius(8)
    .clip(true)
  }
}
