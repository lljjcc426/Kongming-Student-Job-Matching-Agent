import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { KeyboardAvoidMode, mediaquery, window } from '@kit.ArkUI';
import { picker } from '@kit.CoreFileKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { loadCareerFormData, saveCareerFormData, updateAllCareerForms } from '../common/CareerFormStore';
import { NativeAiResult, NativeAiService } from '../common/NativeAiService';
import { NativeAvatarState } from '../common/NativeAvatarProfile';
import { NativeCapabilityService } from '../common/NativeCapabilityService';
import { NativeCalendarService } from '../common/NativeCalendarService';
import { NativeEvidenceService, NativeEvidenceSourceResult } from '../common/NativeEvidenceService';
import { CoreSpeechInterviewProvider, NativeInterviewSpeechProvider } from '../common/NativeInterviewSpeechProvider';
import { NativeJobFeed, NativeJobService, NativePublicJob } from '../common/NativeJobService';
import { NativeApplicationTracker } from '../components/NativeApplicationTracker';
import { NativeDigitalInterviewer } from '../components/NativeDigitalInterviewer';
import { NativeEvidenceLedger } from '../components/NativeEvidenceLedger';
import { NativeResumeVersionPanel } from '../components/NativeResumeVersionPanel';
import {
  createNativeApplicationStageOptions,
  createDefaultNativeJobEvidence,
  NativeApplicationEvent,
  NativeApplicationStageOption,
  NativeGrowthEvidenceRecord,
  NativeGrowthTask,
  NativeInterviewTurn,
  NativeJobEvidence,
  NativeResumeVersion,
  NativeWorkspaceSnapshot,
} from '../common/NativeWorkspaceModel';

interface NativeCapabilityResult {
  nativeAvailable: boolean;
  ok?: boolean;
  signedIn?: boolean;
  displayName?: string;
  text?: string;
  message: string;
}

const NATIVE_STORE_NAME: string = 'kongming_native_workspace';
const NATIVE_APPLICATION_STAGES: NativeApplicationStageOption[] = createNativeApplicationStageOptions();

@Component
struct NativeMetricCard {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop detail: string = '';
  @Prop accentColor: ResourceColor = $r('app.color.km_primary');

  build() {
    Column({ space: 6 }) {
      Row({ space: 6 }) {
        Circle()
          .width(6)
          .height(6)
          .fill(this.accentColor)
        Text(this.label)
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_text_secondary'))
          .maxLines(1)
      }
      .width('100%')
      Text(this.value)
        .fontSize(21)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
      Text(this.detail)
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
        .lineHeight(14)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .alignItems(HorizontalAlign.Start)
    .layoutWeight(1)
    .constraintSize({ minHeight: 84 })
    .padding(12)
    .backgroundColor($r('app.color.km_surface_elevated'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(6)
  }
}

@Component
struct NativeFieldError {
  @Prop message: string = '';

  build() {
    if (this.message) {
      Row({ space: 5 }) {
        SymbolGlyph($r('sys.symbol.exclamationmark_circle'))
          .fontSize(12)
          .fontColor([$r('app.color.km_danger')])
        Text(this.message)
          .fontSize(9)
          .fontColor($r('app.color.km_danger'))
          .lineHeight(15)
          .layoutWeight(1)
      }
      .alignItems(VerticalAlign.Top)
      .width('100%')
    }
  }
}

@Component
struct NativeStatusMessage {
  @Prop message: string = '';

  private messageState(): number {
    if (this.message.includes('正在') || this.message.includes('请稍候')) return 1;
    if (this.message.includes('失败') || this.message.includes('无法') || this.message.includes('不可用') ||
      this.message.includes('请填写') || this.message.includes('请补充') || this.message.includes('请至少') ||
      this.message.includes('请先修正') || this.message.includes('不够具体') ||
      this.message.includes('不在当前') || this.message.includes('没有可打开') ||
      this.message.includes('未提供足够')) return 3;
    if (this.message.includes('已保存') || this.message.includes('已完成') || this.message.includes('已生成') ||
      this.message.includes('已恢复') || this.message.includes('已打开') || this.message.includes('已交由') ||
      this.message.includes('已回填') || this.message.includes('已写入') || this.message.includes('已清除') ||
      this.message.includes('通过')) return 2;
    return 0;
  }

  private messageColor(): ResourceColor {
    const state = this.messageState();
    if (state === 2) return $r('app.color.km_success');
    if (state === 3) return $r('app.color.km_warning');
    if (state === 1) return $r('app.color.km_info');
    return $r('app.color.km_text_muted');
  }

  private messageBackground(): ResourceColor {
    const state = this.messageState();
    if (state === 2) return $r('app.color.km_success_surface');
    if (state === 3) return $r('app.color.km_warning_soft');
    if (state === 1) return $r('app.color.km_primary_tint');
    return $r('app.color.km_surface_subtle');
  }

  build() {
    if (this.message) {
      Row({ space: 8 }) {
        if (this.messageState() === 1) {
          LoadingProgress()
            .width(16)
            .height(16)
            .color(this.messageColor())
        } else if (this.messageState() === 2) {
          SymbolGlyph($r('sys.symbol.checkmark_circle'))
            .fontSize(16)
            .fontColor([this.messageColor()])
        } else if (this.messageState() === 3) {
          SymbolGlyph($r('sys.symbol.exclamationmark_triangle'))
            .fontSize(16)
            .fontColor([this.messageColor()])
        } else {
          SymbolGlyph($r('sys.symbol.info_circle'))
            .fontSize(16)
            .fontColor([this.messageColor()])
        }
        Text(this.message)
          .fontSize(10)
          .fontColor(this.messageColor())
          .lineHeight(17)
          .layoutWeight(1)
      }
      .alignItems(VerticalAlign.Top)
      .width('100%')
      .padding(10)
      .backgroundColor(this.messageBackground())
      .border({ width: 1, color: this.messageState() === 0 ? $r('app.color.km_border') : this.messageBackground() })
      .borderRadius(8)
    }
  }
}

@Component
struct NativeGlobalNotice {
  @Prop message: string = '';
  @Prop tone: string = 'info';
  onDismiss: () => void = () => {};

  private accentColor(): ResourceColor {
    if (this.tone === 'success') return $r('app.color.km_success');
    if (this.tone === 'warning') return $r('app.color.km_warning');
    if (this.tone === 'error') return $r('app.color.km_danger');
    return $r('app.color.km_info');
  }

  private surfaceColor(): ResourceColor {
    if (this.tone === 'success') return $r('app.color.km_success_surface');
    if (this.tone === 'warning') return $r('app.color.km_warning_soft');
    if (this.tone === 'error') return $r('app.color.km_danger_soft');
    return $r('app.color.km_info_soft');
  }

  build() {
    Row({ space: 9 }) {
      if (this.tone === 'success') {
        SymbolGlyph($r('sys.symbol.checkmark_circle'))
          .fontSize(17)
          .fontColor([this.accentColor()])
      } else if (this.tone === 'warning' || this.tone === 'error') {
        SymbolGlyph($r('sys.symbol.exclamationmark_triangle'))
          .fontSize(17)
          .fontColor([this.accentColor()])
      } else {
        SymbolGlyph($r('sys.symbol.info_circle'))
          .fontSize(17)
          .fontColor([this.accentColor()])
      }
      Text(this.message)
        .fontSize(11)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
        .lineHeight(18)
        .maxLines(3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
      Button() {
        SymbolGlyph($r('sys.symbol.xmark'))
          .fontSize(14)
          .fontColor([$r('app.color.km_text_secondary')])
      }
      .width(32)
      .height(32)
      .backgroundColor($r('app.color.km_transparent'))
      .borderRadius(8)
      .accessibilityText('关闭操作提示')
      .accessibilityDescription(this.message)
      .onClick(() => { this.onDismiss(); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .constraintSize({ minHeight: 50 })
    .padding({ left: 13, right: 8, top: 8, bottom: 8 })
    .backgroundColor(this.surfaceColor())
    .border({ width: 1, color: this.accentColor() })
    .borderRadius(8)
  }
}

@Component
struct NativeAsyncStatePanel {
  @Prop state: string = 'loading';
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop actionLabel: string = '';
  onAction: () => void = () => {};

  private accentColor(): ResourceColor {
    if (this.state === 'error') return $r('app.color.km_warning');
    if (this.state === 'empty') return $r('app.color.km_text_tertiary');
    return $r('app.color.km_primary');
  }

  build() {
    Column({ space: 10 }) {
      if (this.state === 'loading') {
        LoadingProgress()
          .width(30)
          .height(30)
          .color(this.accentColor())
      } else {
        SymbolGlyph(this.state === 'error'
          ? $r('sys.symbol.exclamationmark_triangle')
          : $r('sys.symbol.magnifyingglass'))
          .fontSize(26)
          .fontColor([this.accentColor()])
      }
      Text(this.title)
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
        .textAlign(TextAlign.Center)
      Text(this.detail)
        .fontSize(10)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(17)
        .textAlign(TextAlign.Center)
      if (this.actionLabel) {
        Button() {
          Row({ space: 6 }) {
            Text(this.actionLabel)
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_on_primary'))
            SymbolGlyph($r('sys.symbol.chevron_right'))
              .fontSize(13)
              .fontColor([$r('app.color.km_text_on_primary')])
          }
        }
        .constraintSize({ minHeight: 38 })
        .padding({ left: 16, right: 14 })
        .backgroundColor($r('app.color.km_primary_action'))
        .borderRadius(8)
        .onClick(() => { this.onAction(); })
      }
    }
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .width('100%')
    .constraintSize({ minHeight: 150, maxWidth: 560 })
    .padding({ left: 24, right: 24, top: 22, bottom: 22 })
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }
}

@Entry
@Component
struct Index {
  private uiContext: UIContext = this.getUIContext();
  private hostContext: common.UIAbilityContext = this.uiContext.getHostContext() as common.UIAbilityContext;
  private nativeService: NativeCapabilityService = new NativeCapabilityService(this.hostContext);
  private speechProvider: NativeInterviewSpeechProvider = new CoreSpeechInterviewProvider(this.nativeService);
  private jobService: NativeJobService = new NativeJobService(this.hostContext);
  private aiService: NativeAiService = new NativeAiService(this.hostContext);
  private evidenceService: NativeEvidenceService = new NativeEvidenceService();
  private calendarService: NativeCalendarService = new NativeCalendarService(this.hostContext);
  private wideScreenQuery?: mediaquery.MediaQueryListener;
  @StorageProp('FormRouteRequest') @Watch('onFormRouteRequestChanged') formRouteRequest: string = '';
  @State activeTab: number = 0;
  @State isWideLayout: boolean = false;
  @State resumeName: string = '';
  @State targetJob: string = '前端开发实习生';
  @State trackedJobTitle: string = '';
  @State trackedJobCompany: string = '';
  @State trackedJobSource: string = '';
  @State trackedJobDescription: string = '';
  @State applicationJobKey: string = '';
  @State applicationStage: string = 'interested';
  @State applicationUpdatedAt: string = '';
  @State applicationDeadline: string = '';
  @State nextInterviewAt: string = '';
  @State applicationEvents: NativeApplicationEvent[] = [];
  @State applicationResumeVersionId: string = '';
  @State applicationMessage: string = '保存真实岗位后即可记录投递进度。';
  @State resumeSummary: string = '';
  @State resumeVersions: NativeResumeVersion[] = [];
  @State resumeVersionMessage: string = '保存真实岗位后，可冻结并绑定实际投递简历。';
  @State evidenceCoverage: number = 42;
  @State empiricalCoverage: number = 42;
  @State growthBaselineCoverage: number = 42;
  @State projectedCoverage: number = 63;
  @State trackedJobs: number = 0;
  @State growthTasks: NativeGrowthTask[] = [];
  @State growthEvidenceRecords: NativeGrowthEvidenceRecord[] = [];
  @State growthHistory: string[] = [];
  @State jobEvidence: NativeJobEvidence[] = createDefaultNativeJobEvidence();
  @State evidenceDraft: string = '';
  @State evidenceSourceUrl: string = '';
  @State evidenceConfirmed: boolean = false;
  @State evidenceChecking: boolean = false;
  @State growthMessage: string = '';
  @State jobMessage: string = '尚未保存真实岗位，当前只展示目标岗位画像。';
  @State showJobEditor: boolean = false;
  @State jobQuery: string = '';
  @State jobCity: string = '';
  @State publicJobs: NativePublicJob[] = [];
  @State publicJobsLoading: boolean = false;
  @State publicJobsConfigured: boolean = false;
  @State publicJobsStale: boolean = false;
  @State publicJobsSearched: boolean = false;
  @State publicJobsFailed: boolean = false;
  @State publicJobsTotal: number = 0;
  @State publicJobsMessage: string = '可搜索已配置的官方岗位源，也可继续使用本机录入。';
  @State selectedPublicJobIndex: number = -1;
  @State interviewType: string = '综合面';
  @State interviewStarted: boolean = false;
  @State interviewQuestion: string = '';
  @State interviewRound: number = 0;
  @State interviewTurns: NativeInterviewTurn[] = [];
  @State interviewAnswer: string = '';
  @State interviewMessage: string = '';
  @State interviewFeedback: string = '';
  @State interviewModelName: string = '本机规则';
  @State interviewLoading: boolean = false;
  @State interviewDifficulty: string = '标准';
  @State interviewDurationMinutes: number = 15;
  @State interviewElapsedSeconds: number = 0;
  @State interviewSessionPhase: string = 'setup';
  @State interviewTimeExpired: boolean = false;
  @State interviewKeyboardVisible: boolean = false;
  @State modelConsent: boolean = false;
  @State profileMessage: string = '数据默认保存在本机，可随时修改或清除。';
  @State authSignedIn: boolean = false;
  @State authDisplayName: string = '';
  @State nativeMessage: string = '正在检查账号和系统服务状态。';
  @State speechActive: boolean = false;
  @State interviewSpeaking: boolean = false;
  @State interviewAvatarState: NativeAvatarState = 'idle';
  @State interviewSpeechMessage: string = '面试官已就绪';
  @State interviewAudioChecked: boolean = false;
  @State ocrActive: boolean = false;
  @State showIntro: boolean = true;
  @State introPhase: number = 0;
  @State workspaceLoading: boolean = true;
  @State workspaceLoadFailed: boolean = false;
  @State showDataCenter: boolean = false;
  @State dataClearInProgress: boolean = false;
  @State dataCenterMessage: string = '';
  @State globalNoticeMessage: string = '';
  @State globalNoticeTone: string = 'info';
  @State resumeDirty: boolean = false;
  @State jobEditorDirty: boolean = false;
  @State applicationScheduleDirty: boolean = false;
  @State workspaceSaveFailed: boolean = false;
  @State resumeTargetTouched: boolean = false;
  @State resumeSummaryTouched: boolean = false;
  @State jobTitleTouched: boolean = false;
  @State jobCompanyTouched: boolean = false;
  @State jobSourceTouched: boolean = false;
  @State jobDescriptionTouched: boolean = false;
  @State resumeTargetError: string = '';
  @State resumeSummaryError: string = '';
  @State jobTitleError: string = '';
  @State jobCompanyError: string = '';
  @State jobSourceError: string = '';
  @State jobDescriptionError: string = '';
  @State applicationDeadlineError: string = '';
  @State nextInterviewAtError: string = '';
  @State interviewAnswerTouched: boolean = false;
  @State interviewAnswerError: string = '';
  @State growthDraftTouched: boolean = false;
  @State growthSourceTouched: boolean = false;
  @State growthDraftError: string = '';
  @State growthSourceError: string = '';
  private savedResumeName: string = '';
  private savedTargetJob: string = '前端开发实习生';
  private savedResumeSummary: string = '';
  private savedApplicationDeadline: string = '';
  private savedNextInterviewAt: string = '';
  private globalNoticeSequence: number = 0;
  private editorJobTitle: string = '';
  private editorJobCompany: string = '';
  private editorJobSource: string = '';
  private editorJobDescription: string = '';
  private interviewTimer: number = -1;
  private interviewSessionUpdatedAt: number = 0;
  private interviewWindowImmersive: boolean = false;
  private interviewMainWindow: window.Window | undefined = undefined;
  private interviewKeyboardDismissedAt: number = 0;

  aboutToAppear(): void {
    this.speechProvider.setLifecycleListener((state, message) => {
      this.interviewSpeaking = state === 'speaking';
      this.interviewSpeechMessage = message;
      if (state === 'speaking') {
        this.interviewAudioChecked = true;
        this.interviewAvatarState = 'talking';
      } else if (this.speechActive) {
        this.interviewAvatarState = 'listening';
      } else {
        this.interviewAvatarState = 'idle';
      }
    });
    this.speechProvider.setRecognitionErrorListener((message) => {
      this.speechActive = false;
      this.interviewAvatarState = 'idle';
      this.interviewSpeechMessage = message;
      this.nativeMessage = message;
    });
    this.uiContext.setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    void this.bindInterviewWindowEvents();
    this.wideScreenQuery = this.uiContext.getMediaQuery().matchMediaSync('(600vp<=width)');
    this.isWideLayout = this.wideScreenQuery.matches;
    this.wideScreenQuery.on('change', (result: mediaquery.MediaQueryResult) => {
      this.isWideLayout = result.matches;
    });
    const routedFromForm = this.applyFormRouteRequest();
    void this.initializeWorkspace();
    void this.restoreNativeState();
    if (routedFromForm) {
      this.introPhase = 2;
      this.showIntro = false;
      return;
    }
    animateTo({ duration: 620, curve: Curve.EaseOut }, () => {
      this.introPhase = 1;
    });
    setTimeout(() => {
      animateTo({ duration: 320, curve: Curve.EaseIn }, () => {
        this.introPhase = 2;
      });
      setTimeout(() => {
        this.showIntro = false;
      }, 320);
    }, 820);
  }

  aboutToDisappear(): void {
    this.wideScreenQuery?.off('change');
    this.unbindInterviewWindowEvents();
    this.stopInterviewTimer();
    if (this.interviewSessionPhase === 'active') void this.saveWorkspace();
    this.speechProvider.setLifecycleListener(undefined);
    this.speechProvider.setRecognitionErrorListener(undefined);
    void this.speechProvider.stopSpeaking();
  }

  onBackPress(): boolean {
    if (this.interviewKeyboardVisible || Date.now() - this.interviewKeyboardDismissedAt < 800) {
      this.dismissInterviewKeyboard();
      return true;
    }
    if (this.isImmersiveInterviewSession()) {
      this.requestEndInterview();
      return true;
    }
    if (this.showDataCenter) {
      this.showDataCenter = false;
      return true;
    }
    if (this.selectedPublicJobIndex >= 0) {
      this.selectedPublicJobIndex = -1;
      return true;
    }
    if (this.activeTab !== 0) {
      this.requestTabChange(0);
      return true;
    }
    if (this.hasUnsavedChanges()) {
      this.showConfirmDialog(
        '退出并放弃修改？',
        `${this.unsavedChangeLabel()}尚未保存，退出后将恢复上次保存内容。`,
        '放弃并退出',
        () => {
          this.discardUnsavedChanges();
          void this.hostContext.terminateSelf();
        },
      );
      return true;
    }
    return false;
  }

  private showConfirmDialog(title: string, message: string, confirmLabel: string, action: () => void): void {
    this.uiContext.getFocusController().clearFocus();
    AlertDialog.show({
      title,
      message,
      autoCancel: true,
      primaryButton: {
        value: '取消',
        fontColor: $r('app.color.km_text_muted'),
        action: () => {},
      },
      secondaryButton: {
        value: confirmLabel,
        fontColor: $r('app.color.km_danger'),
        action,
      },
    });
  }

  private showGlobalNotice(message: string, tone: string = 'info'): void {
    const normalized = message.trim();
    if (!normalized) return;
    this.globalNoticeMessage = normalized;
    this.globalNoticeTone = tone;
    this.globalNoticeSequence += 1;
    const currentSequence = this.globalNoticeSequence;
    setTimeout(() => {
      if (currentSequence === this.globalNoticeSequence) this.globalNoticeMessage = '';
    }, 4200);
  }

  private dismissGlobalNotice(): void {
    this.globalNoticeSequence += 1;
    this.globalNoticeMessage = '';
  }

  private hasUnsavedChanges(): boolean {
    return this.resumeDirty || this.jobEditorDirty || this.applicationScheduleDirty;
  }

  private updateResumeDirtyState(): void {
    this.resumeDirty = this.resumeName !== this.savedResumeName ||
      this.targetJob !== this.savedTargetJob || this.resumeSummary !== this.savedResumeSummary;
  }

  private updateJobEditorDirtyState(): void {
    this.jobEditorDirty = this.trackedJobTitle !== this.editorJobTitle ||
      this.trackedJobCompany !== this.editorJobCompany || this.trackedJobSource !== this.editorJobSource ||
      this.trackedJobDescription !== this.editorJobDescription;
  }

  private updateApplicationScheduleDirtyState(): void {
    this.applicationScheduleDirty = this.applicationDeadline !== this.savedApplicationDeadline ||
      this.nextInterviewAt !== this.savedNextInterviewAt;
  }

  private unsavedChangeLabel(): string {
    const labels: string[] = [];
    if (this.resumeDirty) labels.push('简历画像');
    if (this.jobEditorDirty) labels.push('岗位资料');
    if (this.applicationScheduleDirty) labels.push('投递日程');
    return labels.join('、');
  }

  private unsavedChangeCount(): number {
    let count = 0;
    if (this.resumeDirty) count += 1;
    if (this.jobEditorDirty) count += 1;
    if (this.applicationScheduleDirty) count += 1;
    return count;
  }

  private savePendingDraft(): void {
    if (this.activeTab === 1 && this.resumeDirty) {
      this.saveResumeProfile();
      return;
    }
    if (this.activeTab === 2 && this.jobEditorDirty) {
      this.saveTrackedJob();
      return;
    }
    if (this.activeTab === 2 && this.applicationScheduleDirty) {
      this.saveApplicationSchedule();
      return;
    }
    if (this.resumeDirty) this.saveResumeProfile();
    else if (this.jobEditorDirty) this.saveTrackedJob();
    else if (this.applicationScheduleDirty) this.saveApplicationSchedule();
  }

  private discardUnsavedChanges(): void {
    if (this.resumeDirty) {
      this.resumeName = this.savedResumeName;
      this.targetJob = this.savedTargetJob;
      this.resumeSummary = this.savedResumeSummary;
      this.resumeDirty = false;
      this.resumeTargetTouched = false;
      this.resumeSummaryTouched = false;
      this.resumeTargetError = '';
      this.resumeSummaryError = '';
    }
    if (this.jobEditorDirty) this.cancelTrackedJobEdit();
    if (this.applicationScheduleDirty) {
      this.applicationDeadline = this.savedApplicationDeadline;
      this.nextInterviewAt = this.savedNextInterviewAt;
      this.applicationScheduleDirty = false;
      this.applicationDeadlineError = '';
      this.nextInterviewAtError = '';
    }
  }

  private performTabChange(tab: number): void {
    this.uiContext.getFocusController().clearFocus();
    if (tab === 2) this.selectedPublicJobIndex = -1;
    this.showDataCenter = false;
    this.activeTab = tab;
    if (tab === 3 && this.isImmersiveInterviewSession()) void this.setInterviewWindowMode(true);
  }

  private requestTabChange(tab: number): void {
    if (tab === this.activeTab) return;
    if (this.isImmersiveInterviewSession() && tab !== 3) {
      this.requestEndInterview();
      return;
    }
    if (!this.hasUnsavedChanges()) {
      this.performTabChange(tab);
      return;
    }
    this.showConfirmDialog(
      '放弃未保存修改？',
      `${this.unsavedChangeLabel()}尚未保存。离开后将恢复上次保存内容。`,
      '放弃并离开',
      () => {
        this.discardUnsavedChanges();
        this.performTabChange(tab);
      },
    );
  }

  private onFormRouteRequestChanged(): void {
    if (this.applyFormRouteRequest()) {
      this.introPhase = 2;
      this.showIntro = false;
    }
  }

  private applyFormRouteRequest(): boolean {
    const page = this.formRouteRequest.split('|')[0];
    if (!page) return false;
    if (page === 'resume') this.requestTabChange(1);
    else if (page === 'jobs') this.openJobsTab();
    else if (page === 'interview') this.requestTabChange(3);
    else if (page === 'growth') this.requestTabChange(4);
    else if (page === 'home') this.requestTabChange(0);
    else return false;
    return true;
  }

  private parseNativeResult(payload: string): NativeCapabilityResult {
    try {
      return JSON.parse(payload) as NativeCapabilityResult;
    } catch (error) {
      console.error(`Native capability response parse failed: ${String(error)}`);
      return {
        nativeAvailable: true,
        ok: false,
        message: '本机能力返回结果无法解析。',
      };
    }
  }

  private async restoreNativeState(): Promise<void> {
    try {
      const result = this.parseNativeResult(await this.nativeService.getHuaweiAuthState());
      this.authSignedIn = result.signedIn === true;
      this.authDisplayName = result.displayName || '';
      this.nativeMessage = result.message;
    } catch (error) {
      this.nativeMessage = '系统服务状态暂时无法读取，可稍后重试。';
      console.error(`Native capability state restore failed: ${String(error)}`);
    }
  }

  private async loginHuawei(): Promise<void> {
    this.nativeMessage = '正在打开华为账号登录。';
    const result = this.parseNativeResult(await this.nativeService.loginWithHuawei());
    this.authSignedIn = result.signedIn === true;
    this.authDisplayName = result.displayName || '';
    this.nativeMessage = result.message;
  }

  private async logoutHuawei(): Promise<void> {
    const result = this.parseNativeResult(await this.nativeService.logoutHuawei());
    this.authSignedIn = result.signedIn === true;
    this.authDisplayName = result.displayName || '';
    this.nativeMessage = result.message;
  }

  private async shareProgress(): Promise<void> {
    const result = this.parseNativeResult(await this.nativeService.shareText(JSON.stringify({
      title: '孔明职配 · 求职进展',
      content: this.buildProgressSummary(),
    })));
    this.nativeMessage = result.message;
    this.dataCenterMessage = result.message;
  }

  private buildProgressSummary(): string {
    return [
      `目标岗位：${this.targetJob}`,
      `岗位证据覆盖：${this.evidenceCoverage}%`,
      `当前实证覆盖：${this.empiricalCoverage}%`,
      `完成后预测覆盖：${this.projectedCoverage}%`,
      `投递阶段：${this.trackedJobs > 0 ? this.applicationStageLabel(this.applicationStage) : '待追踪'}`,
      `投递版本：${this.boundResumeVersionName() || '未绑定'}`,
      `待完成成长任务：${this.growthTasks.filter((task: NativeGrowthTask) => task.status !== 'verified').length}`,
      `下一步：${this.primaryNextAction()}`,
    ].join('\n');
  }

  private async speakInterviewPrompt(): Promise<void> {
    if (this.interviewSessionPhase === 'paused') {
      this.interviewSpeechMessage = '会话已暂停，恢复后可继续朗读。';
      return;
    }
    if (this.interviewSessionPhase === 'completed') return;
    if (this.speechActive) {
      this.interviewSpeechMessage = '请先结束当前语音回答。';
      return;
    }
    this.interviewAvatarState = 'thinking';
    this.interviewSpeechMessage = '正在准备语音问题';
    const result = this.parseNativeResult(await this.speechProvider.speak(
      `${this.interviewType}。${this.interviewQuestion || this.fallbackInterviewQuestion(1)}`,
    ));
    this.nativeMessage = result.message;
    if (result.ok !== true) {
      this.interviewSpeaking = false;
      this.interviewAvatarState = 'idle';
      this.interviewSpeechMessage = result.message;
    } else {
      this.interviewAudioChecked = true;
    }
  }

  private async stopInterviewPrompt(): Promise<void> {
    this.interviewAvatarState = 'interrupted';
    const result = this.parseNativeResult(await this.speechProvider.stopSpeaking());
    this.interviewSpeaking = false;
    this.interviewAvatarState = this.speechActive ? 'listening' : 'idle';
    this.interviewSpeechMessage = result.message;
    this.nativeMessage = result.message;
  }

  private async toggleSpeechInput(): Promise<void> {
    if (this.interviewSessionPhase === 'paused' || this.interviewSessionPhase === 'completed') {
      this.interviewSpeechMessage = this.interviewSessionPhase === 'paused'
        ? '会话已暂停，恢复后可继续回答。'
        : '本轮面试已完成。';
      return;
    }
    if (!this.speechActive) {
      if (this.interviewSpeaking) await this.stopInterviewPrompt();
      this.interviewAvatarState = 'interrupted';
      const result = this.parseNativeResult(await this.speechProvider.startListening());
      this.speechActive = result.ok === true;
      this.interviewAvatarState = this.speechActive ? 'listening' : 'idle';
      this.interviewSpeechMessage = this.speechActive ? '正在聆听你的回答' : result.message;
      this.nativeMessage = result.message;
      return;
    }

    this.interviewAvatarState = 'thinking';
    this.interviewSpeechMessage = '正在整理语音回答';
    const result = this.parseNativeResult(await this.speechProvider.stopListening());
    this.speechActive = false;
    if (result.text && result.text.trim()) {
      this.interviewAnswer = this.interviewAnswer.trim()
        ? `${this.interviewAnswer.trim()}\n${result.text.trim()}`
        : result.text.trim();
      if (this.interviewAnswerTouched) this.interviewAnswerError = this.validateInterviewAnswer(this.interviewAnswer);
    }
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = result.ok === true ? '语音已填入，可检查后提交' : result.message;
    this.nativeMessage = result.message;
  }

  private async recognizeSelectedResumeUri(uri: string): Promise<void> {
    this.profileMessage = '已选择图片，Core Vision 正在本机识别。';
    const result = this.parseNativeResult(await this.nativeService.recognizeResumeImageUri(uri));
    if (result.ok && result.text && result.text.trim()) {
      this.resumeSummary = this.resumeSummary.trim()
        ? `${this.resumeSummary.trim()}\n${result.text.trim()}`
        : result.text.trim();
      this.updateResumeDirtyState();
      if (this.resumeSummaryTouched) this.resumeSummaryError = this.validateResumeSummary(this.resumeSummary);
      this.profileMessage = '本机 OCR 已回填经历文本，请确认事实后保存画像。';
    } else {
      this.profileMessage = result.message || '本机 OCR 未识别到有效文字，请改用文字输入。';
    }
  }

  private async importResumeImage(): Promise<void> {
    if (this.ocrActive) return;
    this.ocrActive = true;
    this.profileMessage = '正在打开系统图片选择器，图片只在本机处理。';
    try {
      const picker = new photoAccessHelper.PhotoViewPicker();
      const selection = await picker.select({
        MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE,
        maxSelectNumber: 1,
        isOriginalSupported: true,
      });
      const uri = selection.photoUris[0];
      if (!uri) {
        this.profileMessage = '未选择图片，仍可直接粘贴简历文字。';
        return;
      }
      await this.recognizeSelectedResumeUri(uri);
    } catch (error) {
      console.error(`Native resume image picker failed: ${String(error)}`);
      this.profileMessage = '图片选择或本机 OCR 暂时不可用，请改用文字输入。';
    } finally {
      this.ocrActive = false;
    }
  }

  private async importResumeFile(): Promise<void> {
    if (this.ocrActive) return;
    this.ocrActive = true;
    this.profileMessage = '正在打开系统文件选择器，图片只在本机处理。';
    try {
      const documentPicker = new picker.DocumentViewPicker(this.hostContext);
      const uris = await documentPicker.select({
        fileSuffixFilters: ['PNG|png', 'JPEG|jpg,jpeg', 'WEBP|webp'],
        maxSelectNumber: 1,
      });
      const uri = uris[0];
      if (!uri) {
        this.profileMessage = '未选择文件，仍可直接粘贴简历文字。';
        return;
      }
      await this.recognizeSelectedResumeUri(uri);
    } catch (error) {
      console.error(`Native resume document picker failed: ${String(error)}`);
      this.profileMessage = '文件选择或本机 OCR 暂时不可用，请改用文字输入。';
    } finally {
      this.ocrActive = false;
    }
  }

  private validateTargetJob(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '请填写目标岗位。';
    if (normalized.length < 2) return '目标岗位至少需要 2 个字。';
    return '';
  }

  private validateResumeSummary(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '请填写至少一段真实经历。';
    if (normalized.length < 30) return `还需补充 ${30 - normalized.length} 个字，说明个人行动和结果。`;
    return '';
  }

  private saveResumeProfile(): void {
    this.resumeTargetTouched = true;
    this.resumeSummaryTouched = true;
    this.resumeTargetError = this.validateTargetJob(this.targetJob);
    this.resumeSummaryError = this.validateResumeSummary(this.resumeSummary);
    if (this.resumeTargetError || this.resumeSummaryError) {
      this.profileMessage = '请先修正标出的简历字段。';
      this.showGlobalNotice(this.profileMessage, 'warning');
      return;
    }
    this.resumeName = this.resumeName.trim();
    this.targetJob = this.targetJob.trim();
    this.resumeSummary = this.resumeSummary.trim();
    this.savedResumeName = this.resumeName;
    this.savedTargetJob = this.targetJob;
    this.savedResumeSummary = this.resumeSummary;
    this.resumeDirty = false;
    this.uiContext.getFocusController().clearFocus();
    this.rebuildEvidenceMatrix();
    this.profileMessage = '简历画像已保存到本机。';
    this.showGlobalNotice(this.profileMessage, 'success');
    void this.saveWorkspace();
  }

  private validateJobTitle(value: string): string {
    return value.trim() ? '' : '请填写岗位名称。';
  }

  private validateJobCompany(value: string): string {
    return value.trim() ? '' : '请填写公司或招聘主体名称。';
  }

  private validateJobSource(value: string): string {
    return /^https?:\/\/[^\s]+$/i.test(value.trim()) ? '' : '请填写可追溯的岗位来源链接，需为完整的 http/https 地址。';
  }

  private validateJobDescription(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '请粘贴岗位职责与要求。';
    if (normalized.length < 30) return `还需补充 ${30 - normalized.length} 个字才能建立证据矩阵。`;
    return '';
  }

  private validateLocalDateTime(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) return '格式应为 YYYY-MM-DD HH:mm。';
    const sections = normalized.split(/\s+/);
    const dateParts = sections[0].split('-');
    const timeParts = sections[1].split(':');
    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const day = Number(dateParts[2]);
    const hour = Number(timeParts[0]);
    const minute = Number(timeParts[1]);
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day ||
      parsed.getHours() !== hour || parsed.getMinutes() !== minute) return '日期或时间无效，请重新填写。';
    if (parsed.getTime() <= Date.now()) return '请选择未来时间。';
    return '';
  }

  private validateInterviewAnswer(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '请先填写本轮回答。';
    if (normalized.length < 20) return `还需补充 ${20 - normalized.length} 个字，说明个人行动和结果。`;
    return '';
  }

  private validateGrowthDraft(value: string): string {
    const normalized = value.trim();
    if (normalized.length < 30) return '至少填写 30 个字，并说明个人行动、产出物和结果。';
    if (!/负责|设计|实现|分析|验证|修复|构建|复盘|提交|完成|测试/.test(normalized)) {
      return '请明确写出你亲自完成的行动。';
    }
    if (!/\d|%|提升|降低|增长|覆盖|产出|上线|发布|用户|样本/.test(normalized)) {
      return '请补充结果数据或可核验的产出物。';
    }
    return '';
  }

  private validateGrowthSource(value: string): string {
    return /^https:\/\/[^\s]+$/i.test(value.trim()) ? '' : '请补充可核验的 HTTPS 代码仓库、报告或演示链接。';
  }

  private beginTrackedJobEdit(): void {
    this.editorJobTitle = this.trackedJobTitle;
    this.editorJobCompany = this.trackedJobCompany;
    this.editorJobSource = this.trackedJobSource;
    this.editorJobDescription = this.trackedJobDescription;
    this.jobEditorDirty = false;
    this.jobTitleTouched = false;
    this.jobCompanyTouched = false;
    this.jobSourceTouched = false;
    this.jobDescriptionTouched = false;
    this.jobTitleError = '';
    this.jobCompanyError = '';
    this.jobSourceError = '';
    this.jobDescriptionError = '';
    this.showJobEditor = true;
  }

  private cancelTrackedJobEdit(): void {
    this.trackedJobTitle = this.editorJobTitle;
    this.trackedJobCompany = this.editorJobCompany;
    this.trackedJobSource = this.editorJobSource;
    this.trackedJobDescription = this.editorJobDescription;
    this.jobEditorDirty = false;
    this.jobTitleTouched = false;
    this.jobCompanyTouched = false;
    this.jobSourceTouched = false;
    this.jobDescriptionTouched = false;
    this.jobTitleError = '';
    this.jobCompanyError = '';
    this.jobSourceError = '';
    this.jobDescriptionError = '';
    this.showJobEditor = false;
  }

  private async initializeWorkspace(): Promise<void> {
    this.workspaceLoading = true;
    this.workspaceLoadFailed = false;
    const restored = await this.loadWorkspace();
    this.workspaceLoadFailed = !restored;
    this.workspaceLoading = false;
    if (restored && this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused')) {
      this.activeTab = 3;
      void this.setInterviewWindowMode(true);
    }
  }

  private async loadWorkspace(): Promise<boolean> {
    try {
      const store = await preferences.getPreferences(this.hostContext, NATIVE_STORE_NAME);
      const raw = await store.get('snapshot', '') as string;
      if (raw) {
        const parsed = JSON.parse(raw) as NativeWorkspaceSnapshot;
        this.resumeName = parsed.resumeName || '';
        this.targetJob = parsed.targetJob || this.targetJob;
        this.trackedJobTitle = parsed.trackedJobTitle || '';
        this.trackedJobCompany = parsed.trackedJobCompany || '';
        this.trackedJobSource = parsed.trackedJobSource || '';
        this.trackedJobDescription = parsed.trackedJobDescription || '';
        this.applicationJobKey = parsed.applicationJobKey || '';
        this.applicationStage = parsed.applicationStage || 'interested';
        this.applicationUpdatedAt = parsed.applicationUpdatedAt || '';
        this.applicationDeadline = parsed.applicationDeadline || '';
        this.nextInterviewAt = parsed.nextInterviewAt || '';
        this.applicationEvents = parsed.applicationEvents || [];
        this.applicationResumeVersionId = parsed.applicationResumeVersionId || '';
        this.resumeSummary = parsed.resumeSummary || '';
        this.resumeVersions = parsed.resumeVersions || [];
        this.interviewType = parsed.interviewType || this.interviewType;
        this.interviewStarted = parsed.interviewStarted === true;
        this.interviewQuestion = parsed.interviewQuestion || '';
        this.interviewRound = typeof parsed.interviewRound === 'number' ? parsed.interviewRound : 0;
        this.interviewTurns = parsed.interviewTurns || [];
        this.interviewFeedback = parsed.interviewFeedback || '';
        this.interviewModelName = parsed.interviewModelName || '本机规则';
        this.interviewDifficulty = parsed.interviewDifficulty || '标准';
        this.interviewDurationMinutes = typeof parsed.interviewDurationMinutes === 'number'
          ? parsed.interviewDurationMinutes
          : 15;
        this.interviewElapsedSeconds = typeof parsed.interviewElapsedSeconds === 'number'
          ? parsed.interviewElapsedSeconds
          : 0;
        this.interviewSessionUpdatedAt = typeof parsed.interviewSessionUpdatedAt === 'number'
          ? parsed.interviewSessionUpdatedAt
          : Date.now();
        this.interviewTimeExpired = parsed.interviewTimeExpired === true;
        if (parsed.interviewSessionPhase) {
          this.interviewSessionPhase = parsed.interviewSessionPhase;
        } else if (this.interviewStarted && this.interviewFeedback) {
          this.interviewSessionPhase = 'completed';
        } else if (this.interviewStarted) {
          this.interviewSessionPhase = 'active';
        } else {
          this.interviewSessionPhase = 'setup';
        }
        if (this.interviewSessionPhase === 'active') {
          const offlineSeconds = Math.max(0, Math.floor((Date.now() - this.interviewSessionUpdatedAt) / 1000));
          this.interviewElapsedSeconds += offlineSeconds;
          if (this.interviewElapsedSeconds >= this.interviewDurationMinutes * 60) {
            this.interviewElapsedSeconds = this.interviewDurationMinutes * 60;
            this.interviewSessionPhase = 'paused';
            this.interviewTimeExpired = true;
            this.interviewMessage = '设定时长已到，已暂停会话；可加时后继续或直接生成反馈。';
          }
        }
        if (this.interviewStarted && !this.interviewQuestion) {
          this.interviewQuestion = this.fallbackInterviewQuestion(Math.max(1, this.interviewRound));
        }
        this.evidenceCoverage = typeof parsed.evidenceCoverage === 'number' ? parsed.evidenceCoverage : 42;
        this.empiricalCoverage = typeof parsed.empiricalCoverage === 'number' ? parsed.empiricalCoverage : this.evidenceCoverage;
        this.projectedCoverage = typeof parsed.projectedCoverage === 'number'
          ? parsed.projectedCoverage
          : Math.min(100, this.evidenceCoverage + 21);
        this.trackedJobs = typeof parsed.trackedJobs === 'number' ? parsed.trackedJobs : 0;
        if (this.trackedJobs > 0 && !this.applicationJobKey) {
          this.applicationJobKey = this.buildTrackedJobKey(
            this.trackedJobTitle,
            this.trackedJobCompany,
            this.trackedJobSource,
          );
        }
        if (this.trackedJobs > 0) {
          this.jobMessage = '真实岗位已从本机恢复，可继续更新证据与投递进度。';
          if (this.requiresResumeVersion(this.applicationStage) && !this.boundResumeVersion()) {
            this.applicationStage = 'preparing';
            this.applicationResumeVersionId = '';
            this.applicationMessage = '旧投递状态缺少实际简历版本，已回到“准备中”。';
          } else {
            this.applicationMessage = this.applicationEvents.length > 0
              ? '投递阶段和时间线已从本机恢复。'
              : '可选择阶段，首次变更后将写入本机时间线。';
          }
          this.resumeVersionMessage = this.boundResumeVersion()
            ? '已恢复当前岗位绑定的实际投递版本。'
            : '保存并绑定实际投递版本后，才能进入已投递及后续阶段。';
        }
        this.growthTasks = parsed.growthTasks || [];
        this.growthEvidenceRecords = parsed.growthEvidenceRecords || [];
        this.growthBaselineCoverage = typeof parsed.growthBaselineCoverage === 'number'
          ? parsed.growthBaselineCoverage
          : Math.max(0, this.empiricalCoverage - this.verifiedGrowthGain());
        this.growthHistory = parsed.growthHistory || [];
        this.jobEvidence = parsed.jobEvidence && parsed.jobEvidence.length > 0
          ? parsed.jobEvidence
          : createDefaultNativeJobEvidence();
      }
      this.savedResumeName = this.resumeName;
      this.savedTargetJob = this.targetJob;
      this.savedResumeSummary = this.resumeSummary;
      this.savedApplicationDeadline = this.applicationDeadline;
      this.savedNextInterviewAt = this.nextInterviewAt;
      this.editorJobTitle = this.trackedJobTitle;
      this.editorJobCompany = this.trackedJobCompany;
      this.editorJobSource = this.trackedJobSource;
      this.editorJobDescription = this.trackedJobDescription;
      this.resumeDirty = false;
      this.jobEditorDirty = false;
      this.applicationScheduleDirty = false;
      if (this.interviewSessionPhase === 'active') this.startInterviewTimer();
      await this.syncCareerFormData();
      return true;
    } catch (error) {
      console.error(`Native workspace restore failed: ${String(error)}`);
      return false;
    }
  }

  private async saveWorkspace(): Promise<void> {
    try {
      const store = await preferences.getPreferences(this.hostContext, NATIVE_STORE_NAME);
      const snapshotTime = Date.now();
      const snapshot: NativeWorkspaceSnapshot = {
        resumeName: this.resumeDirty ? this.savedResumeName : this.resumeName,
        targetJob: this.resumeDirty ? this.savedTargetJob : this.targetJob,
        trackedJobTitle: this.jobEditorDirty ? this.editorJobTitle : this.trackedJobTitle,
        trackedJobCompany: this.jobEditorDirty ? this.editorJobCompany : this.trackedJobCompany,
        trackedJobSource: this.jobEditorDirty ? this.editorJobSource : this.trackedJobSource,
        trackedJobDescription: this.jobEditorDirty ? this.editorJobDescription : this.trackedJobDescription,
        applicationJobKey: this.applicationJobKey,
        applicationStage: this.applicationStage,
        applicationUpdatedAt: this.applicationUpdatedAt,
        applicationDeadline: this.applicationScheduleDirty ? this.savedApplicationDeadline : this.applicationDeadline,
        nextInterviewAt: this.applicationScheduleDirty ? this.savedNextInterviewAt : this.nextInterviewAt,
        applicationEvents: this.applicationEvents,
        applicationResumeVersionId: this.applicationResumeVersionId,
        resumeSummary: this.resumeDirty ? this.savedResumeSummary : this.resumeSummary,
        resumeVersions: this.resumeVersions,
        interviewType: this.interviewType,
        interviewStarted: this.interviewStarted,
        interviewQuestion: this.interviewQuestion,
        interviewRound: this.interviewRound,
        interviewTurns: this.interviewTurns,
        interviewFeedback: this.interviewFeedback,
        interviewModelName: this.interviewModelName,
        interviewDifficulty: this.interviewDifficulty,
        interviewDurationMinutes: this.interviewDurationMinutes,
        interviewElapsedSeconds: this.interviewElapsedSeconds,
        interviewSessionPhase: this.interviewSessionPhase,
        interviewSessionUpdatedAt: snapshotTime,
        interviewTimeExpired: this.interviewTimeExpired,
        evidenceCoverage: this.evidenceCoverage,
        empiricalCoverage: this.empiricalCoverage,
        growthBaselineCoverage: this.growthBaselineCoverage,
        projectedCoverage: this.projectedCoverage,
        trackedJobs: this.trackedJobs,
        growthTasks: this.growthTasks,
        growthEvidenceRecords: this.growthEvidenceRecords,
        growthHistory: this.growthHistory,
        jobEvidence: this.jobEvidence,
      };
      await store.put('snapshot', JSON.stringify(snapshot));
      await store.flush();
      this.interviewSessionUpdatedAt = snapshotTime;
      this.workspaceSaveFailed = false;
      await this.syncCareerFormData();
    } catch (error) {
      this.workspaceSaveFailed = true;
      this.profileMessage = '本机保存失败，请稍后重试。';
      this.showGlobalNotice(this.profileMessage, 'error');
      console.error(`Native workspace save failed: ${String(error)}`);
    }
  }

  private hasActiveDataOperation(): boolean {
    return this.publicJobsLoading || this.interviewLoading || this.ocrActive || this.speechActive ||
      this.evidenceChecking;
  }

  private resetWorkspaceState(): void {
    this.activeTab = 0;
    this.resumeName = '';
    this.targetJob = '前端开发实习生';
    this.trackedJobTitle = '';
    this.trackedJobCompany = '';
    this.trackedJobSource = '';
    this.trackedJobDescription = '';
    this.applicationJobKey = '';
    this.applicationStage = 'interested';
    this.applicationUpdatedAt = '';
    this.applicationDeadline = '';
    this.nextInterviewAt = '';
    this.applicationEvents = [];
    this.applicationResumeVersionId = '';
    this.applicationMessage = '保存真实岗位后即可记录投递进度。';
    this.resumeSummary = '';
    this.resumeVersions = [];
    this.resumeVersionMessage = '保存真实岗位后，可冻结并绑定实际投递简历。';
    this.evidenceCoverage = 42;
    this.empiricalCoverage = 42;
    this.growthBaselineCoverage = 42;
    this.projectedCoverage = 63;
    this.trackedJobs = 0;
    this.growthTasks = [];
    this.growthEvidenceRecords = [];
    this.growthHistory = [];
    this.jobEvidence = createDefaultNativeJobEvidence();
    this.evidenceDraft = '';
    this.evidenceSourceUrl = '';
    this.evidenceConfirmed = false;
    this.evidenceChecking = false;
    this.growthMessage = '';
    this.jobMessage = '尚未保存真实岗位，当前只展示目标岗位画像。';
    this.showJobEditor = false;
    this.jobQuery = '';
    this.jobCity = '';
    this.publicJobs = [];
    this.publicJobsLoading = false;
    this.publicJobsConfigured = false;
    this.publicJobsStale = false;
    this.publicJobsSearched = false;
    this.publicJobsFailed = false;
    this.publicJobsTotal = 0;
    this.publicJobsMessage = '可搜索已配置的官方岗位源，也可继续使用本机录入。';
    this.selectedPublicJobIndex = -1;
    this.interviewType = '综合面';
    this.interviewStarted = false;
    this.interviewQuestion = '';
    this.interviewRound = 0;
    this.interviewTurns = [];
    this.interviewAnswer = '';
    this.interviewMessage = '';
    this.interviewFeedback = '';
    this.interviewModelName = '本机规则';
    this.interviewLoading = false;
    this.interviewDifficulty = '标准';
    this.interviewDurationMinutes = 15;
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'setup';
    this.interviewTimeExpired = false;
    this.interviewSessionUpdatedAt = 0;
    this.stopInterviewTimer();
    this.modelConsent = false;
    this.profileMessage = '数据默认保存在本机，可随时修改或清除。';
    this.resumeDirty = false;
    this.jobEditorDirty = false;
    this.applicationScheduleDirty = false;
    this.workspaceSaveFailed = false;
    this.workspaceLoadFailed = false;
    this.resumeTargetTouched = false;
    this.resumeSummaryTouched = false;
    this.jobTitleTouched = false;
    this.jobCompanyTouched = false;
    this.jobSourceTouched = false;
    this.jobDescriptionTouched = false;
    this.resumeTargetError = '';
    this.resumeSummaryError = '';
    this.jobTitleError = '';
    this.jobCompanyError = '';
    this.jobSourceError = '';
    this.jobDescriptionError = '';
    this.applicationDeadlineError = '';
    this.nextInterviewAtError = '';
    this.interviewAnswerTouched = false;
    this.interviewAnswerError = '';
    this.growthDraftTouched = false;
    this.growthSourceTouched = false;
    this.growthDraftError = '';
    this.growthSourceError = '';
    this.savedResumeName = '';
    this.savedTargetJob = this.targetJob;
    this.savedResumeSummary = '';
    this.savedApplicationDeadline = '';
    this.savedNextInterviewAt = '';
    this.editorJobTitle = '';
    this.editorJobCompany = '';
    this.editorJobSource = '';
    this.editorJobDescription = '';
  }

  private requestClearWorkspaceData(): void {
    if (this.hasActiveDataOperation()) {
      this.dataCenterMessage = '请等待当前识别、语音或网络任务完成后再清除数据。';
      this.showGlobalNotice(this.dataCenterMessage, 'warning');
      return;
    }
    this.showConfirmDialog(
      '清除工作区数据？',
      '将删除简历版本、岗位、投递、面试与成长记录。华为账号登录状态和系统权限不会改变。此操作无法撤销。',
      '确认清除',
      () => { void this.clearWorkspaceData(); },
    );
  }

  private async clearWorkspaceData(): Promise<void> {
    if (this.dataClearInProgress) return;
    this.dataClearInProgress = true;
    this.dataCenterMessage = '正在清除本机工作区数据。';
    try {
      const store = await preferences.getPreferences(this.hostContext, NATIVE_STORE_NAME);
      await store.delete('snapshot');
      await store.flush();
      this.resetWorkspaceState();
      await this.syncCareerFormData();
      this.dataCenterMessage = '本机工作区已清除，账号登录状态和系统权限未改变。';
      this.showGlobalNotice(this.dataCenterMessage, 'success');
    } catch (error) {
      this.dataCenterMessage = '本机工作区清除失败，请稍后重试。';
      this.showGlobalNotice(this.dataCenterMessage, 'error');
      console.error(`Native workspace clear failed: ${String(error)}`);
    } finally {
      this.dataClearInProgress = false;
    }
  }

  private nextGrowthAction(): string {
    for (const task of this.growthTasks) {
      if (task.status !== 'verified') return task.title;
    }
    return '先完成一次岗位面试，生成成长任务';
  }

  private formRoutePage(): string {
    const tab = this.primaryActionTab();
    if (tab === 1) return 'resume';
    if (tab === 2) return 'jobs';
    if (tab === 3) return 'interview';
    if (tab === 4) return 'growth';
    return 'home';
  }

  private async syncCareerFormData(): Promise<void> {
    try {
      const formData = await loadCareerFormData(this.hostContext);
      formData.trackedCount = this.trackedJobs;
      formData.pendingCount = this.pendingActionCount();
      formData.applicationStage = this.trackedJobs > 0 ? this.applicationStageLabel(this.applicationStage) : '待追踪';
      formData.nextAction = this.primaryNextAction();
      formData.jobTitle = this.trackedJobs > 0 ? this.trackedJobTitle : this.targetJob;
      formData.empiricalCoverage = this.empiricalCoverage;
      formData.growthCompletedCount = this.verifiedGrowthCount();
      formData.growthTaskCount = this.growthTasks.length;
      formData.routePage = this.formRoutePage();
      formData.updatedAt = new Date().toLocaleString('zh-CN');
      await saveCareerFormData(this.hostContext, formData);
      await updateAllCareerForms(this.hostContext);
    } catch (error) {
      console.error(`Application form synchronization failed: ${String(error)}`);
    }
  }

  private buildTrackedJobKey(title: string, company: string, source: string): string {
    return `${source.trim()}|${company.trim()}|${title.trim()}`.toLowerCase();
  }

  private applicationStageLabel(stageId: string): string {
    for (const stage of NATIVE_APPLICATION_STAGES) {
      if (stage.id === stageId) return stage.label;
    }
    return '已收藏';
  }

  private requiresResumeVersion(stageId: string): boolean {
    return stageId === 'applied' || stageId === 'interview' || stageId === 'offer';
  }

  private boundResumeVersion(): NativeResumeVersion | undefined {
    if (!this.applicationResumeVersionId || !this.applicationJobKey) return undefined;
    for (const version of this.resumeVersions) {
      if (version.id === this.applicationResumeVersionId && version.jobKey === this.applicationJobKey) {
        return version;
      }
    }
    return undefined;
  }

  private boundResumeVersionName(): string {
    const version = this.boundResumeVersion();
    return version ? version.name : '';
  }

  private currentApplicationAction(): string {
    if (this.trackedJobs === 0) return '添加真实岗位后开始投递追踪';
    if (this.applicationStage === 'preparing') {
      if (!this.boundResumeVersion()) return '保存并绑定当前实际投递简历版本';
      return this.applicationDeadline.trim()
        ? `在 ${this.applicationDeadline.trim()} 前完成事实核验、简历定制与投递检查`
        : '完成事实核验、简历定制与投递前检查';
    }
    if (this.applicationStage === 'applied') return '保存投递凭证，并核对企业招聘系统中的最新状态';
    if (this.applicationStage === 'interview') {
      return this.nextInterviewAt.trim()
        ? `准备 ${this.nextInterviewAt.trim()} 的面试，补齐岗位证据故事`
        : '确认面试时间，按岗位证据矩阵准备真实项目故事';
    }
    if (this.applicationStage === 'offer') return '核对 Offer 条款、截止时间和入职材料';
    if (this.applicationStage === 'closed') return '复盘本次投递并归档可复用的岗位证据';
    return '确认岗位仍在招聘，再进入材料准备';
  }

  private primaryNextAction(): string {
    if (!this.resumeSummary.trim()) return '导入或填写真实经历，建立求职画像';
    return this.trackedJobs > 0 ? this.currentApplicationAction() : this.nextGrowthAction();
  }

  private primaryActionTab(): number {
    if (!this.resumeSummary.trim()) return 1;
    if (this.trackedJobs > 0) {
      if (this.applicationStage === 'preparing' && !this.boundResumeVersion()) return 1;
      return this.applicationStage === 'interview' ? 3 : 2;
    }
    return this.growthTasks.length === 0 ? 3 : 4;
  }

  private primaryActionLabel(): string {
    if (!this.resumeSummary.trim()) return '完善求职画像';
    if (this.trackedJobs > 0) {
      if (this.applicationStage === 'preparing' && !this.boundResumeVersion()) return '保存投递版本';
      if (this.applicationStage === 'interview') return '准备岗位面试';
      return '处理投递事项';
    }
    return this.growthTasks.length === 0 ? '开始岗位面试' : '继续成长任务';
  }

  private primaryActionDestinationLabel(): string {
    const tab = this.primaryActionTab();
    if (tab === 1) return '简历';
    if (tab === 2) return '岗位';
    if (tab === 3) return '面试';
    if (tab === 4) return '成长';
    return '首页';
  }

  private pendingActionCount(): number {
    const profilePending = this.resumeSummary.trim() ? 0 : 1;
    const growthPending = this.growthTasks.filter((task: NativeGrowthTask) => task.status !== 'verified').length;
    if (this.trackedJobs === 0 || this.applicationStage === 'offer' || this.applicationStage === 'closed') {
      return profilePending + growthPending;
    }
    return profilePending + growthPending + 1;
  }

  private navigationHasPendingAction(tab: number): boolean {
    return this.pendingActionCount() > 0 && this.primaryActionTab() === tab;
  }

  private navigationAccessibilityText(label: string, tab: number): string {
    const currentState = this.activeTab === tab ? '，当前页面' : '，切换页面';
    const pendingState = this.navigationHasPendingAction(tab)
      ? `，下一行动入口，共 ${this.pendingActionCount()} 项待处理`
      : '';
    return `${label}${currentState}${pendingState}`;
  }

  private updateApplicationStage(stageId: string): void {
    if (this.trackedJobs === 0) {
      this.applicationMessage = '请先保存可追溯的真实岗位，再更新投递阶段。';
      this.showGlobalNotice(this.applicationMessage, 'warning');
      return;
    }
    if (stageId === this.applicationStage) {
      this.applicationMessage = `当前已经是“${this.applicationStageLabel(stageId)}”。`;
      return;
    }
    if (this.requiresResumeVersion(stageId) && !this.boundResumeVersion()) {
      this.applicationMessage = `进入“${this.applicationStageLabel(stageId)}”前，请先在简历页保存并绑定实际投递版本。`;
      this.showGlobalNotice(this.applicationMessage, 'warning');
      return;
    }
    let validStage = false;
    for (const stage of NATIVE_APPLICATION_STAGES) {
      if (stage.id === stageId) validStage = true;
    }
    if (!validStage) return;
    const occurredAt = new Date().toLocaleString('zh-CN');
    const label = this.applicationStageLabel(stageId);
    this.applicationStage = stageId;
    this.applicationUpdatedAt = occurredAt;
    this.applicationEvents = [
      new NativeApplicationEvent(stageId, `阶段更新为“${label}”`, occurredAt),
      ...this.applicationEvents,
    ];
    this.applicationMessage = `已更新为“${label}”，并写入本机时间线。`;
    this.showGlobalNotice(this.applicationMessage, 'success');
    void this.saveWorkspace();
  }

  private saveNativeResumeVersion(): void {
    if (this.trackedJobs === 0 || !this.applicationJobKey) {
      this.resumeVersionMessage = '请先保存可追溯的真实岗位，再创建投递版本。';
      this.showGlobalNotice(this.resumeVersionMessage, 'warning');
      return;
    }
    const content = this.resumeSummary.trim();
    if (content.length < 30) {
      this.resumeVersionMessage = '简历内容至少需要 30 个字，才能保存为实际投递版本。';
      this.showGlobalNotice(this.resumeVersionMessage, 'warning');
      return;
    }
    let versionCount = 0;
    let previousVersion: NativeResumeVersion | undefined = undefined;
    for (const version of this.resumeVersions) {
      if (version.jobKey === this.applicationJobKey) {
        versionCount += 1;
        if (!previousVersion) previousVersion = version;
      }
    }
    if (previousVersion && previousVersion.content === content) {
      this.resumeVersionMessage = `当前内容与“${previousVersion.name}”相同，无需重复保存。`;
      return;
    }
    const createdAt = new Date().toLocaleString('zh-CN');
    const version = new NativeResumeVersion(
      `native-resume-${Date.now()}`,
      `${this.trackedJobTitle} · 投递版 ${versionCount + 1}`,
      this.applicationJobKey,
      this.trackedJobTitle,
      content,
      createdAt,
      previousVersion
        ? `相较上一版，正文长度由 ${previousVersion.content.length} 字调整为 ${content.length} 字。`
        : '当前岗位的首个本机投递版本。',
    );
    this.resumeVersions = [version, ...this.resumeVersions];
    this.applicationResumeVersionId = version.id;
    this.applicationUpdatedAt = createdAt;
    this.applicationEvents = [
      new NativeApplicationEvent(this.applicationStage, `已保存并绑定简历版本“${version.name}”`, createdAt),
      ...this.applicationEvents,
    ];
    this.resumeVersionMessage = `“${version.name}”已冻结并绑定到当前岗位。`;
    this.applicationMessage = '实际投递版本已绑定，可进入“已投递”及后续阶段。';
    this.showGlobalNotice(this.resumeVersionMessage, 'success');
    void this.saveWorkspace();
  }

  private bindNativeResumeVersion(versionId: string): void {
    let selectedVersion: NativeResumeVersion | undefined = undefined;
    for (const version of this.resumeVersions) {
      if (version.id === versionId && version.jobKey === this.applicationJobKey) selectedVersion = version;
    }
    if (!selectedVersion) {
      this.resumeVersionMessage = '该版本不属于当前追踪岗位，不能绑定。';
      this.showGlobalNotice(this.resumeVersionMessage, 'warning');
      return;
    }
    const occurredAt = new Date().toLocaleString('zh-CN');
    this.applicationResumeVersionId = selectedVersion.id;
    this.applicationUpdatedAt = occurredAt;
    this.applicationEvents = [
      new NativeApplicationEvent(this.applicationStage, `已绑定简历版本“${selectedVersion.name}”`, occurredAt),
      ...this.applicationEvents,
    ];
    this.resumeVersionMessage = `当前投递已改为使用“${selectedVersion.name}”。`;
    this.applicationMessage = '实际投递版本已更新，并写入本机时间线。';
    this.showGlobalNotice(this.resumeVersionMessage, 'success');
    void this.saveWorkspace();
  }

  private deleteNativeResumeVersion(versionId: string): void {
    if (versionId === this.applicationResumeVersionId) {
      this.resumeVersionMessage = '当前版本已绑定投递记录，请先绑定其他版本。';
      this.showGlobalNotice(this.resumeVersionMessage, 'warning');
      return;
    }
    const remainingVersions = this.resumeVersions.filter((version: NativeResumeVersion) => version.id !== versionId);
    if (remainingVersions.length === this.resumeVersions.length) return;
    this.resumeVersions = remainingVersions;
    this.resumeVersionMessage = '未绑定的投递版本已从本机删除。';
    this.showGlobalNotice(this.resumeVersionMessage, 'success');
    void this.saveWorkspace();
  }

  private requestDeleteNativeResumeVersion(versionId: string): void {
    let versionName = '该投递版本';
    for (const version of this.resumeVersions) {
      if (version.id === versionId) versionName = `“${version.name}”`;
    }
    this.showConfirmDialog(
      '删除简历版本？',
      `${versionName}删除后无法恢复，已绑定版本不会被删除。`,
      '确认删除',
      () => { this.deleteNativeResumeVersion(versionId); },
    );
  }

  private saveApplicationSchedule(): void {
    if (this.trackedJobs === 0) {
      this.applicationMessage = '请先保存真实岗位，再记录截止时间或面试安排。';
      this.showGlobalNotice(this.applicationMessage, 'warning');
      return;
    }
    this.applicationDeadlineError = this.validateLocalDateTime(this.applicationDeadline);
    this.nextInterviewAtError = this.validateLocalDateTime(this.nextInterviewAt);
    if (this.applicationDeadlineError || this.nextInterviewAtError) {
      this.applicationMessage = '请先修正标出的日期时间。';
      this.showGlobalNotice(this.applicationMessage, 'warning');
      return;
    }
    this.applicationDeadline = this.applicationDeadline.trim();
    this.nextInterviewAt = this.nextInterviewAt.trim();
    this.savedApplicationDeadline = this.applicationDeadline;
    this.savedNextInterviewAt = this.nextInterviewAt;
    this.applicationScheduleDirty = false;
    this.applicationUpdatedAt = new Date().toLocaleString('zh-CN');
    this.applicationMessage = this.applicationDeadline || this.nextInterviewAt
      ? '投递日程已保存在本机，并同步下一行动。'
      : '已清空该岗位的投递日程。';
    this.showGlobalNotice(this.applicationMessage, 'success');
    this.uiContext.getFocusController().clearFocus();
    void this.saveWorkspace();
  }

  private async openApplicationReminder(reminderType: string): Promise<void> {
    if (this.trackedJobs === 0) {
      this.applicationMessage = '请先保存真实岗位，再创建系统日历提醒。';
      return;
    }
    const scheduledAt = reminderType === 'interview' ? this.nextInterviewAt : this.applicationDeadline;
    if (!scheduledAt.trim()) {
      this.applicationMessage = reminderType === 'interview' ? '请先填写下一场面试时间。' : '请先填写投递截止时间。';
      return;
    }
    this.applicationMessage = '正在打开 Calendar Kit 系统事件编辑器。';
    const result = await this.calendarService.openReminderEditor(
      reminderType,
      scheduledAt,
      this.trackedJobTitle,
      this.trackedJobCompany,
      this.currentApplicationAction(),
    );
    this.applicationMessage = result.message;
  }

  private evidenceReadyCount(): number {
    let readyCount = 0;
    for (const evidence of this.jobEvidence) {
      if (evidence.status.includes('已')) readyCount += 1;
    }
    return readyCount;
  }

  private verifiedGrowthCount(): number {
    let verifiedCount = 0;
    for (const task of this.growthTasks) {
      if (task.status === 'verified') verifiedCount += 1;
    }
    return verifiedCount;
  }

  private primaryEvidenceGap(): string {
    for (const evidence of this.jobEvidence) {
      if (!evidence.status.includes('已')) return evidence.title;
    }
    return '';
  }

  private homeGuidance(): string {
    if (!this.resumeSummary.trim()) {
      return '先导入或填写一段真实经历，孔明会在本机生成岗位证据线索。';
    }
    if (this.trackedJobs > 0) return this.currentApplicationAction();
    const gap = this.primaryEvidenceGap();
    if (gap) {
      return `当前优先补强“${gap}”，先准备可引用的产出物和个人行动。`;
    }
    if (this.growthTasks.some((task: NativeGrowthTask) => task.status !== 'verified')) {
      return `继续完成“${this.nextGrowthAction()}”，通过证据检查后再更新实证覆盖。`;
    }
    return '岗位画像已具备基础线索，下一步用一次真实面试复测表达质量。';
  }

  private guidanceTab(): number {
    if (!this.resumeSummary.trim()) return 1;
    if (this.trackedJobs > 0) return this.primaryActionTab();
    if (this.primaryEvidenceGap()) return 2;
    if (this.growthTasks.some((task: NativeGrowthTask) => task.status !== 'verified')) return 4;
    return 3;
  }

  private primarySkillRequirement(): string {
    const jobText = `${this.targetJob} ${this.trackedJobDescription}`.toLowerCase();
    const skills: string[] = ['react', 'vue', 'typescript', 'javascript', 'python', 'java', 'sql', '数据分析', '产品', '运营'];
    for (const skill of skills) {
      if (jobText.includes(skill)) return skill;
    }
    return '';
  }

  private skillDisplayName(skill: string): string {
    if (skill === 'react') return 'React';
    if (skill === 'vue') return 'Vue';
    if (skill === 'typescript') return 'TypeScript';
    if (skill === 'javascript') return 'JavaScript';
    if (skill === 'python') return 'Python';
    if (skill === 'java') return 'Java';
    if (skill === 'sql') return 'SQL';
    return skill;
  }

  private async refreshPublicJobs(): Promise<void> {
    if (this.publicJobsLoading) return;
    this.uiContext.getFocusController().clearFocus();
    this.publicJobsLoading = true;
    this.publicJobsSearched = true;
    this.publicJobsFailed = false;
    this.selectedPublicJobIndex = -1;
    this.publicJobsMessage = '正在连接官方岗位源，请稍候。';
    const query = this.jobQuery.trim() || this.targetJob.trim();
    try {
      const feed: NativeJobFeed = await this.jobService.fetchJobs(query, this.jobCity);
      this.publicJobsConfigured = feed.configured;
      this.publicJobsFailed = feed.failed;
      if (feed.failed) {
        this.publicJobsStale = this.publicJobs.length > 0;
        this.publicJobsMessage = this.publicJobs.length > 0
          ? `${feed.message} 已保留上次成功结果。`
          : feed.message;
        return;
      }
      this.publicJobs = feed.jobs;
      this.publicJobsStale = feed.stale;
      this.publicJobsTotal = feed.total;
      this.publicJobsMessage = feed.message;
    } catch (error) {
      console.error(`Public job refresh failed: ${String(error)}`);
      this.publicJobsFailed = true;
      this.publicJobsStale = this.publicJobs.length > 0;
      this.publicJobsMessage = this.publicJobs.length > 0
        ? '岗位服务连接失败，已保留上次结果；请检查网络后重试。'
        : '岗位服务连接失败，请检查网络后重试。';
    } finally {
      this.publicJobsLoading = false;
    }
  }

  private showPublicJob(jobId: string): void {
    for (let index = 0; index < this.publicJobs.length; index += 1) {
      if (this.publicJobs[index].id === jobId) {
        this.selectedPublicJobIndex = index;
        return;
      }
    }
    this.publicJobsMessage = '该岗位已不在当前结果中，请重新搜索。';
  }

  private trackPublicJob(job: NativePublicJob): void {
    if (job.description.trim().length < 30) {
      this.publicJobsMessage = '该来源未提供足够完整的岗位说明，请打开官方页面核对后手动录入。';
      return;
    }
    this.trackedJobTitle = job.title;
    this.trackedJobCompany = job.company;
    this.trackedJobSource = job.sourceUrl;
    this.trackedJobDescription = job.description;
    this.saveTrackedJob();
    this.publicJobsMessage = '已保存为本机追踪岗位，并按简历事实重建证据矩阵。';
  }

  private async openPublicJob(job: NativePublicJob): Promise<void> {
    const url = job.applyUrl || job.sourceUrl;
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      this.publicJobsMessage = '该岗位没有可打开的官方投递链接。';
      return;
    }
    try {
      await this.hostContext.startAbility({
        action: 'ohos.want.action.viewData',
        uri: url,
      });
      this.publicJobsMessage = '已交由系统打开官方岗位页面。';
    } catch (error) {
      console.error(`Open public job failed: ${String(error)}`);
      this.publicJobsMessage = '系统暂时无法打开该链接，请稍后重试。';
    }
  }

  private verificationLabel(verification: string): string {
    if (verification === 'official-ats') return '官方 ATS';
    if (verification === 'official-site') return '企业官网';
    return '可追溯来源';
  }

  private saveTrackedJob(): void {
    const title = this.trackedJobTitle.trim();
    const company = this.trackedJobCompany.trim();
    const source = this.trackedJobSource.trim();
    const description = this.trackedJobDescription.trim();
    this.jobTitleTouched = true;
    this.jobCompanyTouched = true;
    this.jobSourceTouched = true;
    this.jobDescriptionTouched = true;
    this.jobTitleError = this.validateJobTitle(title);
    this.jobCompanyError = this.validateJobCompany(company);
    this.jobSourceError = this.validateJobSource(source);
    this.jobDescriptionError = this.validateJobDescription(description);
    if (this.jobTitleError || this.jobCompanyError || this.jobSourceError || this.jobDescriptionError) {
      this.jobMessage = '请先修正标出的岗位字段。';
      this.showGlobalNotice(this.jobMessage, 'warning');
      return;
    }
    const nextJobKey = this.buildTrackedJobKey(title, company, source);
    const isDifferentApplication = this.applicationJobKey !== nextJobKey;
    this.trackedJobTitle = title;
    this.trackedJobCompany = company;
    this.trackedJobSource = source;
    this.trackedJobDescription = description;
    this.targetJob = title;
    this.trackedJobs = 1;
    if (isDifferentApplication) {
      const occurredAt = new Date().toLocaleString('zh-CN');
      this.applicationJobKey = nextJobKey;
      this.applicationStage = 'interested';
      this.applicationUpdatedAt = occurredAt;
      this.applicationDeadline = '';
      this.nextInterviewAt = '';
      this.savedApplicationDeadline = '';
      this.savedNextInterviewAt = '';
      this.applicationScheduleDirty = false;
      this.applicationEvents = [
        new NativeApplicationEvent('interested', `已收藏“${title}”并开始本机追踪`, occurredAt),
      ];
      this.applicationResumeVersionId = '';
      this.applicationMessage = '岗位已进入“已收藏”阶段，可继续更新投递进度。';
      this.resumeVersionMessage = '保存并绑定实际投递版本后，才能进入已投递及后续阶段。';
    }
    this.editorJobTitle = this.trackedJobTitle;
    this.editorJobCompany = this.trackedJobCompany;
    this.editorJobSource = this.trackedJobSource;
    this.editorJobDescription = this.trackedJobDescription;
    this.jobEditorDirty = false;
    this.jobTitleTouched = false;
    this.jobCompanyTouched = false;
    this.jobSourceTouched = false;
    this.jobDescriptionTouched = false;
    this.jobTitleError = '';
    this.jobCompanyError = '';
    this.jobSourceError = '';
    this.jobDescriptionError = '';
    this.showJobEditor = false;
    this.uiContext.getFocusController().clearFocus();
    this.rebuildEvidenceMatrix();
    this.jobMessage = '真实岗位已保存到本机，并已按简历事实重建证据矩阵。';
    this.showGlobalNotice(this.jobMessage, 'success');
    void this.saveWorkspace();
  }

  private removeTrackedJob(): void {
    this.trackedJobTitle = '';
    this.trackedJobCompany = '';
    this.trackedJobSource = '';
    this.trackedJobDescription = '';
    this.applicationJobKey = '';
    this.applicationStage = 'interested';
    this.applicationUpdatedAt = '';
    this.applicationDeadline = '';
    this.nextInterviewAt = '';
    this.savedApplicationDeadline = '';
    this.savedNextInterviewAt = '';
    this.applicationScheduleDirty = false;
    this.applicationEvents = [];
    this.applicationResumeVersionId = '';
    this.applicationMessage = '保存真实岗位后即可记录投递进度。';
    this.trackedJobs = 0;
    this.editorJobTitle = '';
    this.editorJobCompany = '';
    this.editorJobSource = '';
    this.editorJobDescription = '';
    this.jobEditorDirty = false;
    this.showJobEditor = false;
    this.jobEvidence = createDefaultNativeJobEvidence();
    this.evidenceCoverage = 42;
    this.projectedCoverage = Math.max(this.empiricalCoverage, 63);
    this.jobMessage = '已移除岗位来源，目标岗位画像仍保留在本机。';
    void this.saveWorkspace();
  }

  private requestRemoveTrackedJob(): void {
    this.showConfirmDialog(
      '移除当前岗位？',
      '岗位资料、投递阶段、日程和当前绑定关系将从工作台移除；已冻结的简历版本仍保留在本机。',
      '确认移除',
      () => { this.removeTrackedJob(); },
    );
  }

  private rebuildEvidenceMatrix(): void {
    const resumeText = this.resumeSummary.toLowerCase();
    const primarySkill = this.primarySkillRequirement();
    const primarySkillName = primarySkill ? this.skillDisplayName(primarySkill) : '目标岗位核心技能';
    const hasPrimarySkill = primarySkill ? resumeText.includes(primarySkill) : false;
    const hasEducation = /本科|硕士|学士|大学/.test(resumeText);
    const hasOutcome = /负责|设计|实现|分析|验证|修复|构建|上线|发布|提升|降低|覆盖|用户|样本|%|\d/.test(resumeText);
    this.jobEvidence = [
      new NativeJobEvidence(
        'primary-skill',
        `${primarySkillName}经历`,
        hasPrimarySkill ? '已发现线索' : '待补证据',
        hasPrimarySkill
          ? `已在本机简历画像中发现 ${primarySkillName} 线索，仍需补充项目产出物。`
          : `岗位要求包含 ${primarySkillName}，简历画像中尚未发现对应事实。`,
        hasPrimarySkill ? '#047857' : '#B45309',
        hasPrimarySkill ? '#D1FAE5' : '#FEF3C7',
      ),
      new NativeJobEvidence(
        'education',
        '本科及以上',
        hasEducation ? '已发现线索' : '待确认',
        hasEducation ? '已在本机简历画像中发现教育背景线索，请准备可提交的证明材料。' : '确认教育背景和可提交的证明材料，避免把推测当作匹配结果。',
        hasEducation ? '#047857' : '#B45309',
        hasEducation ? '#D1FAE5' : '#FEF3C7',
      ),
      new NativeJobEvidence(
        'contribution',
        '清晰说明个人贡献',
        hasOutcome ? '已有结果线索' : '待补证据',
        hasOutcome ? '已发现动作或结果线索，面试时仍需补充个人贡献和核验材料。' : '在面试回答中补充个人行动、产出物和结果数据。',
        hasOutcome ? '#2563EB' : '#B91C1C',
        hasOutcome ? '#DBEAFE' : '#FEE2E2',
      ),
    ];
    this.evidenceCoverage = Math.min(100, 42 + (hasPrimarySkill ? 15 : 0) + (hasEducation ? 12 : 0) + (hasOutcome ? 15 : 0));
    this.projectedCoverage = Math.max(this.empiricalCoverage, Math.min(100, this.evidenceCoverage + 21));
  }

  private createGrowthPlan(interviewFeedback: string = ''): void {
    const feedbackSummary = interviewFeedback.trim()
      ? interviewFeedback.trim().slice(0, 180)
      : '围绕背景、行动、结果和复盘重新组织回答。';
    this.growthTasks = [
      new NativeGrowthTask('native-growth-1', `补充${this.targetJob}项目证据`, '把目标岗位最关注的技能转成可引用的个人成果。', '提交代码、报告、演示链接，并说明个人动作与结果。', 9),
      new NativeGrowthTask('native-growth-2', '完成一次 STAR 面试复盘', feedbackSummary, '提交一段真实项目回答，至少包含个人贡献和结果数据。', 6),
      new NativeGrowthTask('native-growth-3', '完善可验证简历成果', '把已有经历改写为岗位能够核验的成果证据。', '补充产出物、影响范围或可核验的结果信号。', 6),
    ];
    this.growthBaselineCoverage = this.empiricalCoverage;
    this.projectedCoverage = Math.min(100, this.empiricalCoverage + 21);
    const sourceLabel = interviewFeedback.trim() ? this.interviewModelName : '本机规则';
    this.growthHistory = [`已根据 ${sourceLabel} 面试反馈建立“${this.targetJob}”成长基线`, ...this.growthHistory];
    this.growthMessage = `已根据 ${sourceLabel} 反馈生成 3 条成长任务。`;
    void this.saveWorkspace();
  }

  private fallbackInterviewQuestion(round: number): string {
    const comprehensive: string[] = [
      '请选择一段最能支撑目标岗位的真实经历，说明背景、你的职责、关键行动和结果。',
      '你刚才提到的行动中，哪一部分由你独立负责？请说明产出物和验证方式。',
      '这段经历和目标岗位的要求有什么直接关系？如果重来一次，你会改进什么？',
    ];
    const technical: string[] = [
      '请选一个最熟悉的真实项目，说明核心方案、关键难点、你的实现和最终结果。',
      '为什么选择这个方案？请说明替代方案、关键取舍以及你如何验证它有效。',
      '请讲一次问题定位过程，说明观察到的现象、排查步骤、修复结果和复盘。',
    ];
    const hr: string[] = [
      '你为什么选择这个岗位方向？请结合真实经历、岗位理解和长期规划回答。',
      '请讲一次团队协作中的分歧或压力情境，说明你如何沟通并推动结果。',
      '如果实际工作和预期存在差异，你会如何判断、沟通和调整？',
    ];
    let questions = comprehensive;
    if (this.interviewType === '技术面') questions = technical;
    if (this.interviewType === 'HR面') questions = hr;
    const question = questions[Math.max(0, round - 1) % questions.length];
    if (this.interviewDifficulty === '基础') return `${question} 可以按“背景、任务、行动、结果”依次作答。`;
    if (this.interviewDifficulty === '高压') return `${question} 请同时说明你的责任边界、反例或失败风险。`;
    return question;
  }

  private interviewerPresenceLabel(): string {
    if (this.interviewSessionPhase === 'paused') return '会话已暂停';
    if (this.interviewSessionPhase === 'completed') return '面试已完成';
    if (this.interviewAvatarState === 'talking') return '正在提问';
    if (this.interviewAvatarState === 'listening') return '正在聆听';
    if (this.interviewAvatarState === 'thinking') return '正在思考';
    if (this.interviewAvatarState === 'greeting') return '正在问候';
    if (this.interviewAvatarState === 'interrupted') return '已响应打断';
    return this.interviewStarted ? '等待回答' : '准备就绪';
  }

  private isImmersiveInterviewSession(): boolean {
    return this.activeTab === 3 && this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused');
  }

  private async bindInterviewWindowEvents(): Promise<void> {
    try {
      const mainWindow = await window.getLastWindow(this.hostContext);
      this.interviewMainWindow = mainWindow;
      mainWindow.on('keyboardHeightChange', (height: number) => {
        if (height <= 0 && this.interviewKeyboardVisible) {
          this.interviewKeyboardDismissedAt = Date.now();
        }
        this.interviewKeyboardVisible = height > 0 && this.isImmersiveInterviewSession();
      });
    } catch (error) {
      console.error(`Interview keyboard event binding failed: ${String(error)}`);
    }
  }

  private unbindInterviewWindowEvents(): void {
    if (!this.interviewMainWindow) return;
    try {
      this.interviewMainWindow.off('keyboardHeightChange');
    } catch (error) {
      console.error(`Interview keyboard event unbinding failed: ${String(error)}`);
    }
    this.interviewMainWindow = undefined;
    this.interviewKeyboardVisible = false;
  }

  private dismissInterviewKeyboard(): void {
    this.uiContext.getFocusController().clearFocus();
    this.interviewKeyboardDismissedAt = Date.now();
    this.interviewKeyboardVisible = false;
  }

  private async setInterviewWindowMode(immersive: boolean): Promise<void> {
    if (this.interviewWindowImmersive === immersive) return;
    try {
      const mainWindow = this.interviewMainWindow || await window.getLastWindow(this.hostContext);
      this.interviewMainWindow = mainWindow;
      if (immersive) {
        await mainWindow.setPreferredOrientation(window.Orientation.LANDSCAPE);
        await mainWindow.setWindowLayoutFullScreen(true);
        await mainWindow.setWindowSystemBarEnable([]);
      } else {
        this.interviewKeyboardVisible = false;
        await mainWindow.setWindowSystemBarEnable(['status', 'navigation']);
        await mainWindow.setWindowLayoutFullScreen(false);
        await mainWindow.setPreferredOrientation(window.Orientation.PORTRAIT);
      }
      this.interviewWindowImmersive = immersive;
    } catch (error) {
      console.error(`Interview window mode update failed: ${String(error)}`);
      this.interviewMessage = immersive
        ? '设备暂时无法进入横屏全屏，仍可继续当前面试。'
        : '设备暂时无法恢复竖屏，请旋转设备后继续查看反馈。';
    }
  }

  private startInterviewTimer(): void {
    this.stopInterviewTimer();
    if (!this.interviewStarted || this.interviewSessionPhase !== 'active') return;
    this.interviewTimer = setInterval(() => {
      if (this.interviewSessionPhase !== 'active') return;
      this.interviewElapsedSeconds += 1;
      if (this.interviewElapsedSeconds >= this.interviewDurationMinutes * 60) {
        this.interviewElapsedSeconds = this.interviewDurationMinutes * 60;
        void this.handleInterviewTimeout();
      }
    }, 1000);
  }

  private stopInterviewTimer(): void {
    if (this.interviewTimer < 0) return;
    clearInterval(this.interviewTimer);
    this.interviewTimer = -1;
  }

  private formattedInterviewTime(): string {
    const minutes = Math.floor(this.interviewElapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.interviewElapsedSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  private interviewProgressValue(): number {
    const totalSeconds = Math.max(1, this.interviewDurationMinutes * 60);
    return Math.min(100, Math.round(this.interviewElapsedSeconds / totalSeconds * 100));
  }

  private interviewDifficultyHint(): string {
    if (this.interviewDifficulty === '基础') return '以经历梳理和表达完整性为主';
    if (this.interviewDifficulty === '高压') return '追问取舍、边界和证据细节';
    return '兼顾岗位匹配与证据追问';
  }

  private async pauseInterview(): Promise<void> {
    if (this.interviewLoading || this.interviewSessionPhase !== 'active') return;
    this.interviewSessionPhase = 'paused';
    this.interviewTimeExpired = false;
    this.stopInterviewTimer();
    this.uiContext.getFocusController().clearFocus();
    if (this.interviewSpeaking) await this.speechProvider.stopSpeaking();
    if (this.speechActive) await this.speechProvider.stopListening();
    this.interviewSpeaking = false;
    this.speechActive = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '会话已暂停';
    this.interviewMessage = '计时与语音已暂停，恢复后可继续当前问题。';
    void this.saveWorkspace();
  }

  private async handleInterviewTimeout(): Promise<void> {
    if (this.interviewSessionPhase !== 'active') return;
    this.interviewSessionPhase = 'paused';
    this.interviewTimeExpired = true;
    this.stopInterviewTimer();
    if (this.interviewSpeaking) await this.speechProvider.stopSpeaking();
    if (this.speechActive) await this.speechProvider.stopListening();
    this.interviewSpeaking = false;
    this.speechActive = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '设定时长已到';
    this.interviewMessage = '设定时长已到，已暂停会话；可加时 5 分钟后继续或直接生成反馈。';
    this.showGlobalNotice(this.interviewMessage, 'warning');
    void this.saveWorkspace();
  }

  private resumeInterview(): void {
    if (this.interviewSessionPhase !== 'paused') return;
    if (this.interviewTimeExpired) this.interviewDurationMinutes += 5;
    this.interviewSessionPhase = 'active';
    this.interviewTimeExpired = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '会话已恢复，等待你的回答';
    this.interviewMessage = '面试已恢复，计时继续。';
    this.startInterviewTimer();
    void this.saveWorkspace();
  }

  private endEmptyInterview(): void {
    this.stopInterviewTimer();
    void this.speechProvider.stopSpeaking();
    if (this.speechActive) void this.speechProvider.stopListening();
    this.interviewStarted = false;
    this.interviewQuestion = '';
    this.interviewRound = 0;
    this.interviewAnswer = '';
    this.interviewAnswerTouched = false;
    this.interviewAnswerError = '';
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'setup';
    this.interviewTimeExpired = false;
    this.interviewSpeaking = false;
    this.speechActive = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '面试官已就绪';
    this.interviewMessage = '本轮会话已结束，未生成面试记录。';
    void this.setInterviewWindowMode(false);
    void this.saveWorkspace();
  }

  private requestEndInterview(): void {
    const hasAnswer = this.interviewTurns.length > 0 || this.interviewAnswer.trim().length > 0;
    this.showConfirmDialog(
      hasAnswer ? '提前结束并生成反馈？' : '结束本轮面试？',
      hasAnswer
        ? '当前已完成的回答会用于生成本轮反馈，未完成的轮次将标记为提前结束。'
        : '当前还没有可用于复盘的回答，结束后不会生成反馈。',
      hasAnswer ? '结束并生成反馈' : '确认结束',
      () => {
        if (hasAnswer) void this.finishInterview();
        else this.endEmptyInterview();
      },
    );
  }

  private localInterviewFeedback(turns: NativeInterviewTurn[]): string {
    let combined = '';
    for (const turn of turns) combined += ` ${turn.answer}`;
    const hasAction = /负责|设计|实现|分析|验证|修复|构建|协调|推进|完成|测试/.test(combined);
    const hasOutcome = /\d|%|提升|降低|增长|覆盖|产出|上线|发布|用户|样本|结果/.test(combined);
    const evidenceState = hasAction && hasOutcome
      ? '已发现个人行动和结果线索，仍需准备可核验材料。'
      : '回答中的个人行动或结果证据不足，不能据此形成能力结论。';
    return [
      `证据状态：${evidenceState}`,
      `回答亮点：已完成 ${turns.length} 轮真实回答，并保留本机面试记录。`,
      '主要缺口：需要进一步说明个人责任边界、产出物和验证方式。',
      '下一轮行动：使用 STAR 结构补充背景、任务、个人行动、结果与复盘。',
    ].join('\n');
  }

  private updateModelConsent(value: boolean): void {
    this.modelConsent = value;
    this.interviewMessage = value
      ? '已开启本次会话的外部模型增强；发送前会隐藏手机号、邮箱、身份证号和详细地址。'
      : '已关闭外部模型增强，后续问题与反馈仅使用本机规则。';
  }

  private startInterview(): void {
    this.interviewStarted = true;
    this.interviewRound = 1;
    this.interviewQuestion = this.fallbackInterviewQuestion(1);
    this.interviewTurns = [];
    this.interviewAnswer = '';
    this.interviewAnswerTouched = false;
    this.interviewAnswerError = '';
    this.interviewFeedback = '';
    this.interviewModelName = '本机规则';
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'active';
    this.interviewTimeExpired = false;
    this.interviewSessionUpdatedAt = Date.now();
    this.interviewSpeaking = false;
    this.interviewAvatarState = 'greeting';
    this.interviewSpeechMessage = '面试官正在向你问候';
    this.interviewMessage = this.modelConsent
      ? `${this.interviewType} 已开始；首题由本机准备，提交后由外部模型生成证据追问。`
      : `本机 ${this.interviewType} 已开始，请结合真实经历回答。`;
    this.startInterviewTimer();
    void this.setInterviewWindowMode(true);
    void this.saveWorkspace();
    setTimeout(() => {
      if (this.interviewSessionPhase === 'active' && this.interviewRound === 1 && this.interviewTurns.length === 0) {
        void this.speakInterviewPrompt();
      }
    }, 1200);
  }

  private async submitInterviewAnswer(): Promise<void> {
    if (this.interviewLoading) return;
    if (this.interviewSessionPhase === 'paused') {
      this.interviewMessage = '请先恢复面试，再提交本轮回答。';
      return;
    }
    if (this.interviewSessionPhase === 'completed') return;
    if (this.speechActive) {
      this.interviewMessage = '请先停止语音回答并检查识别内容。';
      return;
    }
    if (this.interviewSpeaking) await this.stopInterviewPrompt();
    const answer = this.interviewAnswer.trim();
    this.interviewAnswerTouched = true;
    this.interviewAnswerError = this.validateInterviewAnswer(answer);
    if (this.interviewAnswerError) {
      this.interviewMessage = '请先修正标出的本轮回答。';
      return;
    }
    this.uiContext.getFocusController().clearFocus();
    const occurredAt = new Date().toLocaleString('zh-CN');
    const nextTurns = [...this.interviewTurns, new NativeInterviewTurn(this.interviewQuestion, answer, occurredAt)];
    this.interviewTurns = nextTurns;
    this.interviewAnswer = '';
    this.interviewAnswerTouched = false;
    this.interviewAnswerError = '';
    if (nextTurns.length >= 3) {
      this.interviewMessage = '已完成 3 轮回答，可以生成本轮反馈。';
      this.interviewAvatarState = 'idle';
      this.interviewSpeechMessage = '三轮回答已完成';
      void this.saveWorkspace();
      return;
    }

    const nextRound = this.interviewRound + 1;
    if (!this.modelConsent) {
      this.interviewRound = nextRound;
      this.interviewQuestion = this.fallbackInterviewQuestion(nextRound);
      this.interviewModelName = '本机规则';
      this.interviewMessage = '外部模型未授权，已生成本机规则追问。';
      void this.saveWorkspace();
      void this.speakInterviewPrompt();
      return;
    }

    this.interviewLoading = true;
    this.interviewAvatarState = 'thinking';
    this.interviewSpeechMessage = '正在生成下一轮追问';
    this.interviewMessage = '已脱敏本轮内容，正在生成岗位化追问。';
    try {
      const result: NativeAiResult = await this.aiService.generateInterviewQuestion(
        `${this.interviewType}（${this.interviewDifficulty}难度）`,
        nextRound,
        this.resumeSummary,
        this.trackedJobTitle || this.targetJob,
        this.trackedJobDescription,
        nextTurns,
      );
      this.interviewRound = nextRound;
      if (result.ok) {
        this.interviewQuestion = result.content;
        this.interviewModelName = result.model || '外部模型';
        this.interviewMessage = `已由 ${this.interviewModelName} 生成第 ${nextRound} 轮证据追问。`;
      } else {
        this.interviewQuestion = this.fallbackInterviewQuestion(nextRound);
        this.interviewModelName = '本机规则';
        this.interviewMessage = result.message;
      }
    } catch (error) {
      console.error(`Interview follow-up generation failed: ${String(error)}`);
      this.interviewRound = nextRound;
      this.interviewQuestion = this.fallbackInterviewQuestion(nextRound);
      this.interviewModelName = '本机规则';
      this.interviewMessage = '外部模型连接失败，已切换到本机追问，可继续作答或稍后重试。';
    } finally {
      this.interviewLoading = false;
    }
    void this.saveWorkspace();
    void this.speakInterviewPrompt();
  }

  private async finishInterview(): Promise<void> {
    if (this.interviewLoading) return;
    if (this.interviewSessionPhase === 'completed') return;
    if (this.speechActive) {
      this.interviewMessage = '请先停止语音回答并检查识别内容。';
      return;
    }
    if (this.interviewSpeaking) await this.stopInterviewPrompt();
    let turns = this.interviewTurns;
    const answer = this.interviewAnswer.trim();
    if (answer.length > 0) {
      this.interviewAnswerTouched = true;
      this.interviewAnswerError = this.validateInterviewAnswer(answer);
    } else {
      this.interviewAnswerTouched = false;
      this.interviewAnswerError = '';
    }
    if (this.interviewAnswerError) {
      this.interviewMessage = '请先修正标出的本轮回答。';
      return;
    }
    if (answer.length >= 20) {
      turns = [...turns, new NativeInterviewTurn(this.interviewQuestion, answer, new Date().toLocaleString('zh-CN'))];
      this.interviewTurns = turns;
      this.interviewAnswer = '';
      this.interviewAnswerTouched = false;
      this.interviewAnswerError = '';
    }
    if (turns.length === 0) {
      this.interviewMessage = '请至少提交一轮真实回答后再生成反馈。';
      return;
    }

    this.uiContext.getFocusController().clearFocus();
    this.stopInterviewTimer();
    this.interviewSessionPhase = 'completed';
    this.interviewTimeExpired = false;
    await this.setInterviewWindowMode(false);
    this.interviewLoading = true;
    this.interviewAvatarState = 'thinking';
    this.interviewSpeechMessage = '正在复盘本轮面试';
    let feedback = '';
    if (this.modelConsent) {
      this.interviewMessage = '正在对已脱敏的面试记录生成岗位化反馈。';
      try {
        const result: NativeAiResult = await this.aiService.generateInterviewFeedback(
          `${this.interviewType}（${this.interviewDifficulty}难度）`,
          this.resumeSummary,
          this.trackedJobTitle || this.targetJob,
          this.trackedJobDescription,
          turns,
        );
        if (result.ok) {
          feedback = result.content;
          this.interviewModelName = result.model || '外部模型';
          this.interviewMessage = `已由 ${this.interviewModelName} 生成反馈；内容仅作为训练建议。`;
        } else {
          feedback = this.localInterviewFeedback(turns);
          this.interviewModelName = '本机规则';
          this.interviewMessage = result.message;
        }
      } catch (error) {
        console.error(`Interview feedback generation failed: ${String(error)}`);
        feedback = this.localInterviewFeedback(turns);
        this.interviewModelName = '本机规则';
        this.interviewMessage = '外部模型连接失败，已生成本机反馈；可继续完成成长任务。';
      }
    } else {
      feedback = this.localInterviewFeedback(turns);
      this.interviewModelName = '本机规则';
      this.interviewMessage = '外部模型未授权，已完成本机结构化反馈。';
    }
    this.interviewLoading = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '本轮面试已完成';
    this.interviewFeedback = feedback;
    void this.saveWorkspace();
    if (this.growthTasks.length === 0) {
      this.createGrowthPlan(feedback);
    } else {
      this.growthHistory = [`已完成 ${this.interviewType} 复测，反馈来源：${this.interviewModelName}`, ...this.growthHistory];
      void this.saveWorkspace();
    }
  }

  private resetInterview(): void {
    this.stopInterviewTimer();
    void this.speechProvider.stopSpeaking();
    if (this.speechActive) void this.speechProvider.stopListening();
    this.interviewStarted = false;
    this.interviewQuestion = '';
    this.interviewRound = 0;
    this.interviewTurns = [];
    this.interviewAnswer = '';
    this.interviewAnswerTouched = false;
    this.interviewAnswerError = '';
    this.interviewFeedback = '';
    this.interviewModelName = '本机规则';
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'setup';
    this.interviewTimeExpired = false;
    this.interviewSessionUpdatedAt = 0;
    this.speechActive = false;
    this.interviewSpeaking = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '面试官已就绪';
    this.interviewMessage = '已清空本轮面试记录，可以重新选择面试类型。';
    void this.setInterviewWindowMode(false);
    void this.saveWorkspace();
  }

  private requestResetInterview(): void {
    this.showConfirmDialog(
      '重新开始本轮面试？',
      '当前问题、回答和已生成反馈会被清空，已写入成长任务的历史记录不受影响。',
      '重新开始',
      () => { this.resetInterview(); },
    );
  }

  private async submitGrowthEvidence(): Promise<void> {
    if (this.evidenceChecking) return;
    const text = this.evidenceDraft.trim();
    const sourceUrl = this.evidenceSourceUrl.trim();
    this.growthDraftTouched = true;
    this.growthSourceTouched = true;
    this.growthDraftError = this.validateGrowthDraft(text);
    this.growthSourceError = this.validateGrowthSource(sourceUrl);
    if (this.growthDraftError || this.growthSourceError) {
      this.growthMessage = '请先修正标出的成长证据字段。';
      return;
    }
    if (!this.evidenceConfirmed) {
      this.growthMessage = '请先确认内容真实且来源可供核验。';
      return;
    }
    this.uiContext.getFocusController().clearFocus();
    this.evidenceChecking = true;
    this.growthMessage = '正在使用 Network Kit 核验公开 HTTPS 来源。';
    let sourceResult: NativeEvidenceSourceResult;
    try {
      sourceResult = await this.evidenceService.verifyPublicHttps(sourceUrl);
    } catch (error) {
      console.error(`Growth evidence verification failed: ${String(error)}`);
      this.growthMessage = '证据来源连接失败，请检查网络和链接后重试。';
      this.evidenceChecking = false;
      return;
    }
    this.evidenceChecking = false;
    if (!sourceResult.ok) {
      this.growthMessage = sourceResult.message;
      return;
    }
    const nextTasks: NativeGrowthTask[] = [];
    let verifiedTask: NativeGrowthTask | undefined = undefined;
    for (const task of this.growthTasks) {
      if (!verifiedTask && task.status !== 'verified') {
        verifiedTask = new NativeGrowthTask(task.id, task.title, task.description, task.evidenceRequirement, task.projectedGain, 'verified');
        nextTasks.push(verifiedTask);
      } else {
        nextTasks.push(new NativeGrowthTask(task.id, task.title, task.description, task.evidenceRequirement, task.projectedGain, task.status));
      }
    }
    if (!verifiedTask) {
      this.growthMessage = '本轮任务已经全部验证完成。';
      return;
    }
    this.growthTasks = nextTasks;
    const submittedAt = new Date().toLocaleString('zh-CN');
    const record = new NativeGrowthEvidenceRecord(
      `${verifiedTask.id}-${Date.now()}`,
      verifiedTask.id,
      verifiedTask.title,
      text,
      sourceResult.sourceUrl,
      submittedAt,
      this.growthEvidenceFingerprint(`${verifiedTask.id}\n${text}\n${sourceResult.sourceUrl}`),
      'verified',
      '',
      'reachable',
      sourceResult.sourceHost,
      sourceResult.checkedAt,
      sourceResult.responseCode,
      sourceResult.checkMethod,
    );
    this.growthEvidenceRecords = [record, ...this.growthEvidenceRecords];
    this.empiricalCoverage = Math.min(100, this.growthBaselineCoverage + this.growthGainForTasks(nextTasks));
    this.projectedCoverage = Math.max(this.empiricalCoverage, this.projectedCoverage);
    const sourceMethod = sourceResult.checkMethod === 'GET_RANGE' ? 'Range GET' : sourceResult.checkMethod;
    this.growthHistory = [`${verifiedTask.title} 的公开来源已通过 Network Kit ${sourceMethod} 核验，实证覆盖率更新为 ${this.empiricalCoverage}%`, ...this.growthHistory];
    this.evidenceDraft = '';
    this.evidenceSourceUrl = '';
    this.evidenceConfirmed = false;
    this.growthDraftTouched = false;
    this.growthSourceTouched = false;
    this.growthDraftError = '';
    this.growthSourceError = '';
    this.growthMessage = `${sourceResult.message}证据已写入本机账本，内容指纹 ${record.fingerprint}。`;
    void this.saveWorkspace();
  }

  private growthEvidenceFingerprint(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 4294967291;
    }
    return `KM-${Math.floor(hash).toString(16).toUpperCase().padStart(8, '0')}`;
  }

  private async openGrowthEvidenceSource(sourceUrl: string): Promise<void> {
    if (!sourceUrl.startsWith('https://')) {
      this.growthMessage = '证据来源不是可打开的 HTTPS 链接。';
      return;
    }
    try {
      await this.hostContext.startAbility({
        action: 'ohos.want.action.viewData',
        uri: sourceUrl,
      });
      this.growthMessage = '已交由系统打开证据来源。';
    } catch (error) {
      console.error(`Open growth evidence source failed: ${String(error)}`);
      this.growthMessage = '系统暂时无法打开证据来源，请稍后重试。';
    }
  }

  private revokeGrowthEvidence(taskId: string): void {
    let revokedRecord: NativeGrowthEvidenceRecord | undefined = undefined;
    const revokedAt = new Date().toLocaleString('zh-CN');
    const nextRecords: NativeGrowthEvidenceRecord[] = [];
    for (const record of this.growthEvidenceRecords) {
      if (!revokedRecord && record.taskId === taskId && record.status === 'verified') {
        revokedRecord = new NativeGrowthEvidenceRecord(
          record.id,
          record.taskId,
          record.taskTitle,
          record.summary,
          record.sourceUrl,
          record.submittedAt,
          record.fingerprint,
          'revoked',
          revokedAt,
          record.sourceVerification || 'not_checked',
          record.sourceHost || '',
          record.sourceCheckedAt || '',
          record.sourceHttpStatus || 0,
          record.sourceCheckMethod || 'HEAD',
        );
        nextRecords.push(revokedRecord);
      } else {
        nextRecords.push(record);
      }
    }
    let revokedTask: NativeGrowthTask | undefined = undefined;
    const nextTasks: NativeGrowthTask[] = [];
    for (const task of this.growthTasks) {
      if (task.id === taskId && task.status === 'verified') {
        revokedTask = new NativeGrowthTask(task.id, task.title, task.description, task.evidenceRequirement, task.projectedGain, 'todo');
        nextTasks.push(revokedTask);
      } else {
        nextTasks.push(task);
      }
    }
    if (!revokedTask) {
      this.growthMessage = '对应成长任务已不是验证状态。';
      return;
    }

    this.growthEvidenceRecords = nextRecords;
    this.growthTasks = nextTasks;
    this.empiricalCoverage = Math.min(100, this.growthBaselineCoverage + this.growthGainForTasks(nextTasks));
    this.projectedCoverage = Math.max(this.empiricalCoverage, this.projectedCoverage);
    const revokeLabel = revokedRecord ? '证据已撤销并保留审计记录' : '旧版验证状态已撤销';
    this.growthHistory = [`${revokedTask.title} 的${revokeLabel}，实证覆盖率回退为 ${this.empiricalCoverage}%`, ...this.growthHistory];
    this.growthMessage = `${revokeLabel}，可重新提交。`;
    void this.saveWorkspace();
  }

  private requestRevokeGrowthEvidence(taskId: string): void {
    this.showConfirmDialog(
      '撤销证据验证？',
      '该证据会标记为已撤销并保留审计记录，实证覆盖率将同步回退。',
      '确认撤销',
      () => { this.revokeGrowthEvidence(taskId); },
    );
  }

  private verifiedGrowthGain(): number {
    return this.growthGainForTasks(this.growthTasks);
  }

  private verifiedGrowthTaskCount(): number {
    let count = 0;
    for (const task of this.growthTasks) {
      if (task.status === 'verified') count += 1;
    }
    return count;
  }

  private growthGainForTasks(tasks: NativeGrowthTask[]): number {
    let gain = 0;
    for (const task of tasks) {
      if (task.status === 'verified') gain += task.projectedGain;
    }
    return gain;
  }

  private resumeCompletionValue(): number {
    let completion = 0;
    if (this.resumeName.trim()) completion += 20;
    if (this.targetJob.trim()) completion += 30;
    if (this.resumeSummary.trim().length >= 30) completion += 50;
    return completion;
  }

  @Builder
  private buildFieldLabel(label: string, hint: string = ''): void {
    Row() {
      Text(label)
        .fontSize(11)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
      Blank()
      if (hint) {
        Text(hint)
          .fontSize(9)
          .fontColor($r('app.color.km_text_tertiary'))
      }
    }
    .width('100%')
  }

  @Builder
  private buildPageHeading(section: string, title: string, detail: string): void {
    Column({ space: 4 }) {
      Text(section)
        .fontSize(9)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_primary'))
        .maxLines(1)
      Text(title)
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
        .maxLines(2)
      Text(detail)
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(18)
        .maxLines(3)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildSectionHeading(title: string, detail: string): void {
    Column({ space: 3 }) {
      Text(title)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
      Text(detail)
        .fontSize(10)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(16)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildHeader(): void {
    Column() {
      Row() {
        Row({ space: 8 }) {
          Image($r('app.media.startIconNative'))
            .width(30)
            .height(30)
            .objectFit(ImageFit.Contain)
          Column({ space: 1 }) {
            Text('孔明职配')
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text('学生求职证据工作台')
              .fontSize(9)
              .fontColor($r('app.color.km_text_secondary'))
          }
          .alignItems(HorizontalAlign.Start)
        }
        Blank()
        Button() {
          Row({ space: 5 }) {
            SymbolGlyph($r('sys.symbol.info_circle'))
              .fontSize(14)
              .fontColor([this.authSignedIn ? $r('app.color.km_teal') : $r('app.color.km_text_secondary')])
            Text(this.authSignedIn ? this.authDisplayName : '本机数据')
              .fontSize(10)
              .fontColor(this.authSignedIn ? $r('app.color.km_teal') : $r('app.color.km_text_secondary'))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
          .constraintSize({ minHeight: 32, maxWidth: this.isWideLayout ? 220 : 140 })
          .padding({ left: 9, right: 9 })
          .backgroundColor(this.authSignedIn ? $r('app.color.km_teal_soft') : $r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(6)
          .accessibilityText(this.authSignedIn ? `${this.authDisplayName}，打开数据与隐私中心` : '打开数据与隐私中心')
          .onClick(() => { this.showDataCenter = !this.showDataCenter; })
      }
      .width('100%')
      .constraintSize({ minHeight: 54 })
      .padding({ left: 16, right: 16, top: 2, bottom: 2 })
      Divider()
        .color($r('app.color.km_border'))
        .strokeWidth(1)
      if (this.workspaceSaveFailed) {
        Row({ space: 8 }) {
          SymbolGlyph($r('sys.symbol.exclamationmark_triangle'))
            .fontSize(15)
            .fontColor([$r('app.color.km_warning')])
          Text('本机保存未完成，请重试。')
            .fontSize(10)
            .fontColor($r('app.color.km_warning'))
            .layoutWeight(1)
          Button('重试')
            .constraintSize({ minHeight: 30 })
            .fontSize(10)
            .fontColor($r('app.color.km_text_on_primary'))
            .backgroundColor($r('app.color.km_warning'))
            .borderRadius(8)
            .onClick(() => { void this.saveWorkspace(); })
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 7, bottom: 7 })
        .backgroundColor($r('app.color.km_warning_soft'))
      }
    }
    .width('100%')
    .backgroundColor($r('app.color.km_surface'))
  }

  @Builder
  private buildPrivacyBoundary(title: string, detail: string): void {
    Row({ space: 10 }) {
      SymbolGlyph($r('sys.symbol.checkmark_circle'))
        .fontSize(18)
        .fontColor([$r('app.color.km_success')])
      Column({ space: 3 }) {
        Text(title)
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_text_primary'))
          .width('100%')
        Text(detail)
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
          .lineHeight(17)
          .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .alignItems(VerticalAlign.Top)
    .width('100%')
  }

  @Builder
  private buildDataCenter(): void {
    Scroll() {
      Column({ space: 14 }) {
        Row() {
          Button() {
            Row({ space: 6 }) {
              SymbolGlyph($r('sys.symbol.chevron_right'))
                .fontSize(14)
                .fontColor([$r('app.color.km_text_secondary')])
                .rotate({ angle: 180 })
              Text('返回工作台')
                .fontSize(11)
                .fontColor($r('app.color.km_text_secondary'))
            }
          }
          .constraintSize({ minHeight: 36 })
          .padding({ left: 10, right: 12 })
          .backgroundColor($r('app.color.km_surface_subtle'))
          .borderRadius(8)
          .onClick(() => { this.showDataCenter = false; })
          Blank()
        }
        .width('100%')

        this.buildPageHeading('设置', '数据与隐私', '查看本机记录范围，管理账号与数据操作。')

        Column({ space: 10 }) {
          Row() {
            Column({ space: 3 }) {
              Text('本机工作区')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text('以下记录仅保存在当前设备的应用数据中')
                .fontSize(10)
                .fontColor($r('app.color.km_text_secondary'))
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Text('本机保存')
              .fontSize(9)
              .fontColor($r('app.color.km_success'))
              .padding({ left: 8, right: 8, top: 4, bottom: 4 })
              .backgroundColor($r('app.color.km_success_soft'))
              .borderRadius(8)
          }
          .width('100%')
          Row({ space: 8 }) {
            NativeMetricCard({
              label: '简历版本',
              value: `${this.resumeVersions.length}`,
              detail: '已冻结的投递版本',
              accentColor: $r('app.color.km_primary'),
            })
            NativeMetricCard({
              label: '追踪岗位',
              value: `${this.trackedJobs}`,
              detail: '已保存真实岗位',
              accentColor: $r('app.color.km_teal'),
            })
          }
          .width('100%')
          Row({ space: 8 }) {
            NativeMetricCard({
              label: '投递记录',
              value: `${this.applicationEvents.length}`,
              detail: '本机阶段时间线',
              accentColor: $r('app.color.km_purple'),
            })
            NativeMetricCard({
              label: '有效证据',
              value: `${this.growthEvidenceRecords.filter((record: NativeGrowthEvidenceRecord) =>
                record.status === 'verified').length}`,
              detail: '通过核验的记录',
              accentColor: $r('app.color.km_success'),
            })
          }
          .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Column({ space: 12 }) {
          Text('数据边界')
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .width('100%')
          this.buildPrivacyBoundary('工作区默认留在本机', '简历、岗位、投递、面试与成长记录保存在应用本机存储。')
          Divider().color($r('app.color.km_border')).strokeWidth(1)
          this.buildPrivacyBoundary('在线岗位不读取简历正文', '搜索官方岗位时仅发送岗位关键词和城市筛选条件。')
          Divider().color($r('app.color.km_border')).strokeWidth(1)
          this.buildPrivacyBoundary('外部模型增强默认关闭', '开启后仅发送面试页标明的已脱敏岗位化上下文。')
          Divider().color($r('app.color.km_border')).strokeWidth(1)
          this.buildPrivacyBoundary('分享由系统面板确认', '应用不会自动发布进展摘要，也不在摘要中包含简历正文和岗位 JD。')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Column({ space: 10 }) {
          Row() {
            Column({ space: 3 }) {
              Text('华为账号')
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text(this.authSignedIn ? this.authDisplayName : '当前未登录')
                .fontSize(10)
                .fontColor($r('app.color.km_text_secondary'))
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Button(this.authSignedIn ? '退出登录' : '登录')
              .constraintSize({ minHeight: 36 })
              .fontSize(11)
              .fontColor(this.authSignedIn ? $r('app.color.km_danger') : $r('app.color.km_info'))
              .backgroundColor(this.authSignedIn ? $r('app.color.km_danger_soft') : $r('app.color.km_info_soft'))
              .borderRadius(8)
              .onClick(() => { void (this.authSignedIn ? this.logoutHuawei() : this.loginHuawei()); })
          }
          .width('100%')
          Text('清除工作区不会退出账号，也不会改变相机、麦克风等系统权限。')
            .fontSize(10)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(17)
            .width('100%')
          NativeStatusMessage({ message: this.nativeMessage })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Column({ space: 10 }) {
          Text('数据操作')
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .width('100%')
          Button() {
            Row({ space: 10 }) {
              SymbolGlyph($r('sys.symbol.doc_text'))
                .fontSize(19)
                .fontColor([$r('app.color.km_success')])
              Column({ space: 2 }) {
                Text('分享求职进展摘要')
                  .fontSize(12)
                  .fontWeight(FontWeight.Medium)
                  .fontColor($r('app.color.km_text_primary'))
                  .width('100%')
                Text('调用系统分享面板，不包含简历正文与岗位 JD')
                  .fontSize(9)
                  .fontColor($r('app.color.km_text_secondary'))
                  .width('100%')
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              SymbolGlyph($r('sys.symbol.chevron_right'))
                .fontSize(14)
                .fontColor([$r('app.color.km_text_tertiary')])
            }
            .width('100%')
          }
          .width('100%')
          .constraintSize({ minHeight: 58 })
          .padding({ left: 12, right: 12 })
          .backgroundColor($r('app.color.km_surface_subtle'))
          .borderRadius(8)
          .onClick(() => { void this.shareProgress(); })
          Button() {
            Row({ space: 10 }) {
              SymbolGlyph($r('sys.symbol.exclamationmark_triangle'))
                .fontSize(19)
                .fontColor([$r('app.color.km_danger')])
              Column({ space: 2 }) {
                Text(this.dataClearInProgress ? '正在清除本机工作区' : '清除本机工作区')
                  .fontSize(12)
                  .fontWeight(FontWeight.Medium)
                  .fontColor($r('app.color.km_danger'))
                  .width('100%')
                Text('删除简历、岗位、投递、面试与成长记录')
                  .fontSize(9)
                  .fontColor($r('app.color.km_text_secondary'))
                  .width('100%')
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              SymbolGlyph($r('sys.symbol.chevron_right'))
                .fontSize(14)
                .fontColor([$r('app.color.km_danger')])
            }
            .width('100%')
          }
          .width('100%')
          .constraintSize({ minHeight: 58 })
          .padding({ left: 12, right: 12 })
          .backgroundColor($r('app.color.km_danger_soft'))
          .borderRadius(8)
          .enabled(!this.dataClearInProgress)
          .onClick(() => { this.requestClearWorkspaceData(); })
          NativeStatusMessage({ message: this.dataCenterMessage })
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 28 })
      .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  private openJobsTab(): void {
    this.requestTabChange(2);
  }

  @Builder
  private buildIntro(): void {
    Column() {
      Blank().layoutWeight(1)
      Column({ space: 14 }) {
        Image($r('app.media.startIconNative'))
          .width(116)
          .height(116)
          .objectFit(ImageFit.Contain)
          .opacity(0.96)
        Text('孔明职配')
          .fontSize(36)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
        Text('学生求职智能工作台')
          .fontSize(16)
          .fontColor($r('app.color.km_primary'))
        Row({ space: 8 }) {
          Circle().width(7).height(7).fill($r('app.color.km_primary'))
          Blank().width(44).height(1).backgroundColor($r('app.color.km_decor_line'))
          Circle().width(8).height(8).fill($r('app.color.km_accent_cyan'))
          Blank().width(44).height(1).backgroundColor($r('app.color.km_decor_line'))
          Circle().width(7).height(7).fill($r('app.color.km_primary'))
        }
        Text('从证据开始，建立你的求职优势')
          .fontSize(14)
          .fontColor($r('app.color.km_text_secondary'))
      }
      .alignItems(HorizontalAlign.Center)
      .opacity(this.introPhase === 0 ? 0 : 1)
      .translate({ y: this.introPhase === 0 ? 20 : 0 })
      .animation({ duration: 620, curve: Curve.EaseOut })
      Blank().layoutWeight(1)
      Text('让每一步成长都有证据')
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
    }
    .width('100%')
    .height('100%')
    .padding({ left: 24, right: 24, top: 30, bottom: 24 })
    .backgroundColor($r('app.color.km_page_background'))
    .opacity(this.introPhase === 2 ? 0 : 1)
    .translate({ y: this.introPhase === 2 ? -12 : 0 })
    .animation({ duration: 320, curve: Curve.EaseIn })
  }

  @Builder
  private buildWorkspaceState(): void {
    Row() {
      NativeAsyncStatePanel({
        state: this.workspaceLoadFailed ? 'error' : 'loading',
        title: this.workspaceLoadFailed ? '暂时无法恢复本机工作区' : '正在恢复本机工作区',
        detail: this.workspaceLoadFailed
          ? '为避免覆盖已有记录，工作区已暂停编辑。请重新读取本机数据。'
          : '正在读取简历、岗位、投递和成长记录。',
        actionLabel: this.workspaceLoadFailed ? '重新读取' : '',
        onAction: () => { void this.initializeWorkspace(); },
      })
    }
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .layoutWeight(1)
    .width('100%')
    .padding(16)
  }

  @Builder
  private buildJourneyStep(title: string, detail: string, completed: boolean, targetTab: number): void {
    Button() {
      Column({ space: 6 }) {
        Circle()
          .width(8)
          .height(8)
          .fill(completed ? $r('app.color.km_teal') : $r('app.color.km_border_strong'))
        Text(title)
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_text_primary'))
          .maxLines(1)
        Text(detail)
          .fontSize(9)
          .fontColor(completed ? $r('app.color.km_teal') : $r('app.color.km_text_secondary'))
          .maxLines(1)
      }
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
    }
    .layoutWeight(1)
    .constraintSize({ minHeight: 58 })
    .padding(0)
    .backgroundColor($r('app.color.km_transparent'))
    .borderRadius(6)
    .accessibilityText(`${title}，${detail}，打开${title}页面`)
    .onClick(() => { this.requestTabChange(targetTab); })
  }

  @Builder
  private buildJourney(): void {
    Column({ space: 8 }) {
      Row() {
        Text('求职主线')
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
        Blank()
        Text('点击阶段继续')
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
      }
      .width('100%')
      Row({ space: 6 }) {
        this.buildJourneyStep('画像', this.resumeSummary.trim() ? '已录入' : '待完善', this.resumeSummary.trim().length > 0, 1)
        this.buildJourneyStep('证据', this.evidenceReadyCount() > 0 ? '有线索' : '待补充', this.evidenceReadyCount() > 0, 2)
        this.buildJourneyStep('面试', this.interviewStarted || this.growthTasks.length > 0 ? '已启动' : '待复测', this.interviewStarted || this.growthTasks.length > 0, 3)
        this.buildJourneyStep('成长', this.verifiedGrowthCount() > 0 ? '已验证' : '待行动', this.verifiedGrowthCount() > 0, 4)
      }
      .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(12)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(6)
  }

  @Builder
  private buildTargetJobSnapshot(): void {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 4 }) {
          Text('目标岗位 · 证据快照')
            .fontSize(9)
            .fontColor($r('app.color.km_primary'))
          Text(this.targetJob)
            .fontSize(19)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .maxLines(2)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Column({ space: 2 }) {
          Text(`${this.empiricalCoverage}%`)
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_primary_emphasis'))
          Text('当前实证覆盖')
            .fontSize(9)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.End)
      }
      .width('100%')
      Progress({ value: this.empiricalCoverage, total: 100, type: ProgressType.Linear })
        .width('100%')
        .height(7)
        .color($r('app.color.km_primary'))
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(4)
      Row() {
        Text(`${this.evidenceReadyCount()}/${this.jobEvidence.length} 项发现线索`)
          .fontSize(11)
          .fontColor($r('app.color.km_text_body'))
        Blank()
        Text(this.trackedJobs > 0 ? `已追踪 ${this.trackedJobs} 个真实岗位` : '尚未导入真实岗位')
          .fontSize(10)
          .fontColor(this.trackedJobs > 0 ? $r('app.color.km_success') : $r('app.color.km_warning'))
      }
      .width('100%')
      Text(this.trackedJobs > 0
        ? '推荐结论只引用已追踪岗位与本机证据。'
        : '当前仅展示目标岗位画像，不生成虚构企业或招聘信息。')
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(18)
        .width('100%')
      Button('查看岗位证据')
        .width('100%')
        .constraintSize({ minHeight: 40 })
        .fontSize(12)
        .fontColor($r('app.color.km_primary_emphasis'))
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(6)
        .onClick(() => { this.openJobsTab(); })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(15)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(6)
  }

  @Builder
  private buildHomeGuidance(): void {
    Row({ space: 12 }) {
      Image($r('app.media.startIconNative'))
        .width(38)
        .height(38)
        .objectFit(ImageFit.Contain)
      Column({ space: 5 }) {
        Text('孔明建议')
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
        Text(this.homeGuidance())
          .fontSize(11)
          .fontColor($r('app.color.km_text_muted'))
          .lineHeight(18)
          .maxLines(3)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Button('去处理')
        .constraintSize({ minHeight: 34 })
        .fontSize(11)
        .fontColor($r('app.color.km_info'))
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(6)
        .onClick(() => { this.requestTabChange(this.guidanceTab()); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .padding(14)
    .backgroundColor($r('app.color.km_primary_tint'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(6)
  }

  @Builder
  private buildTodayAction(): void {
    Column({ space: 12 }) {
      Row() {
        Row({ space: 6 }) {
          Circle()
            .width(8)
            .height(8)
            .fill($r('app.color.km_primary'))
          Text('下一行动')
            .fontSize(10)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_primary_emphasis'))
        }
        Blank()
        Text(`${this.pendingActionCount()} 项待处理`)
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_warning'))
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor($r('app.color.km_warning_soft'))
          .borderRadius(6)
      }
      .width('100%')
      Text(this.primaryNextAction())
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
        .lineHeight(24)
        .maxLines(3)
        .width('100%')
      Row({ space: 8 }) {
        Text(this.trackedJobs > 0 ? this.trackedJobTitle : this.targetJob)
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        Button() {
          Row({ space: 4 }) {
            Text(this.primaryActionLabel())
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_on_primary'))
            SymbolGlyph($r('sys.symbol.chevron_right'))
              .fontSize(14)
              .fontColor([$r('app.color.km_text_on_primary')])
          }
        }
        .constraintSize({ minHeight: 34 })
        .padding({ left: 12, right: 10 })
        .backgroundColor($r('app.color.km_primary_action'))
        .borderRadius(6)
        .onClick(() => { this.requestTabChange(this.primaryActionTab()); })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface_elevated'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(6)
  }

  @Builder
  private buildNativeCapabilityCard(): void {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 4 }) {
          Text('账号与数据')
            .fontSize(17)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(this.authSignedIn ? this.authDisplayName : '当前未登录华为账号')
            .fontSize(12)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Button(this.authSignedIn ? '退出登录' : '华为账号登录')
          .constraintSize({ minHeight: 36 })
          .fontSize(12)
          .fontColor(this.authSignedIn ? $r('app.color.km_danger') : $r('app.color.km_info'))
          .backgroundColor(this.authSignedIn ? $r('app.color.km_danger_soft') : $r('app.color.km_info_soft'))
          .borderRadius(6)
          .onClick(() => {
            void (this.authSignedIn ? this.logoutHuawei() : this.loginHuawei());
          })
      }
      .width('100%')
      Text('求职资料默认保存在本机。登录账号、分享进展或使用语音时，会先由你主动触发。')
        .fontSize(12)
        .fontColor($r('app.color.km_text_body'))
        .lineHeight(19)
        .width('100%')
      Row({ space: 8 }) {
        Button('分享求职进展')
          .layoutWeight(1)
          .constraintSize({ minHeight: 40 })
          .fontSize(12)
          .fontColor($r('app.color.km_success'))
          .backgroundColor($r('app.color.km_success_soft'))
          .borderRadius(6)
          .onClick(() => { void this.shareProgress(); })
        Button('打开面试语音')
          .layoutWeight(1)
          .constraintSize({ minHeight: 40 })
          .fontSize(12)
          .fontColor($r('app.color.km_purple'))
          .backgroundColor($r('app.color.km_purple_soft'))
          .borderRadius(6)
          .onClick(() => { this.requestTabChange(3); })
      }
      .width('100%')
      NativeStatusMessage({ message: this.nativeMessage })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildHome(): void {
    Scroll() {
      Column({ space: 12 }) {
        this.buildPageHeading(
          '今日概览',
          this.resumeName ? `你好，${this.resumeName}` : '求职工作台',
          `目标岗位 · ${this.targetJob}`,
        )

        this.buildTodayAction()

        Row({ space: 8 }) {
          NativeMetricCard({
            label: '实证覆盖',
            value: `${this.empiricalCoverage}%`,
            detail: '审核通过后更新',
            accentColor: $r('app.color.km_teal'),
          })
          NativeMetricCard({
            label: '成长预测',
            value: `${this.projectedCoverage}%`,
            detail: '完成任务后的预测',
            accentColor: $r('app.color.km_primary'),
          })
          NativeMetricCard({
            label: '待办任务',
            value: `${this.growthTasks.filter((task: NativeGrowthTask) => task.status !== 'verified').length}`,
            detail: '按优先级推进',
            accentColor: $r('app.color.km_warning'),
          })
        }
        .width('100%')

        this.buildTargetJobSnapshot()
        this.buildJourney()

        Row({ space: 8 }) {
          Button('更新简历画像')
            .layoutWeight(1)
            .constraintSize({ minHeight: 40 })
            .fontColor($r('app.color.km_info'))
            .backgroundColor($r('app.color.km_primary_soft'))
            .borderRadius(8)
            .onClick(() => { this.requestTabChange(1); })
          Button('查看岗位证据')
            .layoutWeight(1)
            .constraintSize({ minHeight: 40 })
            .fontColor($r('app.color.km_success'))
            .backgroundColor($r('app.color.km_teal_soft'))
            .borderRadius(8)
            .onClick(() => { this.openJobsTab(); })
        }
        .width('100%')

        this.buildHomeGuidance()
        this.buildNativeCapabilityCard()
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 20 })
      .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildResume(): void {
    Scroll() {
      Column({ space: 14 }) {
        this.buildPageHeading('个人资料', '简历与画像', '录入真实经历并维护目标岗位，后续匹配只引用你确认过的内容。')

        Column({ space: 10 }) {
          Row({ space: 10 }) {
            Stack({ alignContent: Alignment.Center }) {
              Circle()
                .width(38)
                .height(38)
                .fill($r('app.color.km_primary_soft'))
              SymbolGlyph($r('sys.symbol.doc_text'))
                .fontSize(18)
                .fontColor([$r('app.color.km_primary_action')])
            }
            Column({ space: 2 }) {
              Text('资料完整度')
                .fontSize(10)
                .fontColor($r('app.color.km_text_secondary'))
              Text(this.resumeCompletionValue() === 100 ? '画像已可用于岗位匹配' : '补全真实经历，提升匹配可信度')
                .fontSize(13)
                .fontWeight(FontWeight.Medium)
                .fontColor($r('app.color.km_text_primary'))
                .maxLines(2)
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Text(`${this.resumeCompletionValue()}%`)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_primary_action'))
          }
          .width('100%')
          Progress({ value: this.resumeCompletionValue(), total: 100, type: ProgressType.Linear })
            .width('100%')
            .height(5)
            .color($r('app.color.km_primary_action'))
            .backgroundColor($r('app.color.km_border'))
          Text(this.resumeDirty ? '有尚未保存的修改' : '本机资料已保存')
            .fontSize(9)
            .fontColor(this.resumeDirty ? $r('app.color.km_warning') : $r('app.color.km_success'))
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(14)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Column({ space: 12 }) {
          this.buildSectionHeading('基础画像', '姓名仅用于本机称呼，目标岗位决定后续匹配与训练方向。')
          Column({ space: 6 }) {
            this.buildFieldLabel('姓名', '选填')
            TextInput({ placeholder: '填写你的姓名', text: this.resumeName })
              .constraintSize({ minHeight: 44 })
              .maxLength(40)
              .enterKeyType(EnterKeyType.Next)
              .backgroundColor($r('app.color.km_surface_subtle'))
              .border({ width: 1, color: $r('app.color.km_border') })
              .borderRadius(6)
              .onChange((value: string) => {
                this.resumeName = value;
                this.updateResumeDirtyState();
              })
          }
          .width('100%')
          Column({ space: 6 }) {
            this.buildFieldLabel('目标岗位', '必填 · 用于匹配')
            TextInput({ placeholder: '例如：前端开发实习生', text: this.targetJob })
              .constraintSize({ minHeight: 44 })
              .maxLength(80)
              .enterKeyType(EnterKeyType.Next)
              .backgroundColor($r('app.color.km_surface_subtle'))
              .border({ width: 1, color: this.resumeTargetError ? $r('app.color.km_danger') : $r('app.color.km_border') })
              .borderRadius(6)
              .onChange((value: string) => {
                this.targetJob = value;
                this.updateResumeDirtyState();
                if (this.resumeTargetTouched) this.resumeTargetError = this.validateTargetJob(value);
              })
              .onBlur(() => {
                this.resumeTargetTouched = true;
                this.resumeTargetError = this.validateTargetJob(this.targetJob);
              })
            NativeFieldError({ message: this.resumeTargetError })
          }
          .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Column({ space: 12 }) {
          this.buildSectionHeading('经历证据', '写清场景、个人动作与结果；导入内容也需要你最终确认。')
          Column({ space: 6 }) {
            this.buildFieldLabel('真实经历', `${this.resumeSummary.length}/4000 · 至少 30 字`)
            TextArea({ placeholder: '填写项目、实习或校园经历，说明你具体做了什么。', text: this.resumeSummary })
              .constraintSize({ minHeight: 132 })
              .maxLength(4000)
              .backgroundColor($r('app.color.km_surface_subtle'))
              .border({ width: 1, color: this.resumeSummaryError ? $r('app.color.km_danger') : $r('app.color.km_border') })
              .borderRadius(6)
              .onChange((value: string) => {
                this.resumeSummary = value;
                this.updateResumeDirtyState();
                if (this.resumeSummaryTouched) this.resumeSummaryError = this.validateResumeSummary(value);
              })
              .onBlur(() => {
                this.resumeSummaryTouched = true;
                this.resumeSummaryError = this.validateResumeSummary(this.resumeSummary);
              })
            NativeFieldError({ message: this.resumeSummaryError })
          }
          .width('100%')
          Row({ space: 8 }) {
            Button() {
              Row({ space: 6 }) {
                SymbolGlyph($r('sys.symbol.doc_text'))
                  .fontSize(14)
                  .fontColor([$r('app.color.km_info')])
                Text(this.ocrActive ? '识别中…' : '图库导入')
                  .fontSize(11)
                  .fontColor($r('app.color.km_info'))
              }
            }
            .layoutWeight(1)
            .constraintSize({ minHeight: 40 })
            .backgroundColor($r('app.color.km_info_soft'))
            .borderRadius(6)
            .enabled(!this.ocrActive)
            .onClick(() => { void this.importResumeImage(); })
            Button() {
              Row({ space: 6 }) {
                SymbolGlyph($r('sys.symbol.doc_text'))
                  .fontSize(14)
                  .fontColor([$r('app.color.km_teal')])
                Text(this.ocrActive ? '请稍候' : '文件导入')
                  .fontSize(11)
                  .fontColor($r('app.color.km_teal'))
              }
            }
            .layoutWeight(1)
            .constraintSize({ minHeight: 40 })
            .backgroundColor($r('app.color.km_teal_soft'))
            .borderRadius(6)
            .enabled(!this.ocrActive)
            .onClick(() => { void this.importResumeFile(); })
          }
          .width('100%')
          Row({ space: 6 }) {
            SymbolGlyph($r('sys.symbol.checkmark_shield'))
              .fontSize(13)
              .fontColor([$r('app.color.km_success')])
            Text('导入内容仅在本机读取，识别后由你确认。')
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
              .layoutWeight(1)
          }
          .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Button(this.resumeDirty ? '保存本机简历画像' : '资料已保存')
          .width('100%')
          .constraintSize({ minHeight: 46 })
          .fontColor($r('app.color.km_text_on_primary'))
          .backgroundColor(this.resumeDirty ? $r('app.color.km_primary_action') : $r('app.color.km_disabled'))
          .borderRadius(8)
          .onClick(() => { this.saveResumeProfile(); })
        NativeStatusMessage({ message: this.profileMessage })
        NativeResumeVersionPanel({
          versions: this.resumeVersions,
          currentJobKey: this.applicationJobKey,
          currentJobTitle: this.trackedJobTitle,
          boundVersionId: this.applicationResumeVersionId,
          message: this.resumeVersionMessage,
          onCreateVersion: () => { this.saveNativeResumeVersion(); },
          onBindVersion: (versionId: string) => { this.bindNativeResumeVersion(versionId); },
          onDeleteVersion: (versionId: string) => { this.requestDeleteNativeResumeVersion(versionId); },
        })
        Row({ space: 10 }) {
          SymbolGlyph($r('sys.symbol.checkmark_shield'))
            .fontSize(18)
            .fontColor([$r('app.color.km_primary_action')])
          Column({ space: 3 }) {
            Text('隐私与识别')
              .fontSize(13)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text('识别结果、岗位信息和模型输出都需要你确认后才会进入求职资料。')
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(17)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .alignItems(VerticalAlign.Top)
        .width('100%')
        .padding(14)
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(8)
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 24 })
      .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildPublicJobSearch(): void {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 3 }) {
          Text('官方岗位搜索')
            .fontSize(17)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text('只展示带有可追溯来源链接的岗位')
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(this.publicJobsConfigured ? '服务已配置' : '支持离线降级')
          .fontSize(10)
          .fontColor(this.publicJobsConfigured ? $r('app.color.km_success') : $r('app.color.km_warning'))
          .padding({ left: 8, right: 8, top: 5, bottom: 5 })
          .backgroundColor(this.publicJobsConfigured ? $r('app.color.km_success_soft') : $r('app.color.km_warning_badge'))
          .borderRadius(11)
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位关键词', `默认：${this.targetJob}`)
        TextInput({ placeholder: '输入岗位名称或技能关键词', text: this.jobQuery })
          .constraintSize({ minHeight: 44 })
          .maxLength(80)
          .enterKeyType(EnterKeyType.Search)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.jobQuery = value; })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('城市', '选填')
        TextInput({ placeholder: '例如：上海', text: this.jobCity })
          .constraintSize({ minHeight: 44 })
          .maxLength(40)
          .enterKeyType(EnterKeyType.Search)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.jobCity = value; })
      }
      .width('100%')
      Button(this.publicJobsLoading ? '正在读取官方岗位…' : '搜索官方岗位')
        .width('100%')
        .constraintSize({ minHeight: 42 })
        .fontSize(12)
        .fontColor($r('app.color.km_text_on_primary'))
        .backgroundColor(this.publicJobsLoading ? $r('app.color.km_disabled') : $r('app.color.km_primary_action'))
        .borderRadius(8)
        .enabled(!this.publicJobsLoading)
        .onClick(() => { void this.refreshPublicJobs(); })
      if (this.publicJobsStale) {
        Text('当前展示上次成功获取的缓存结果')
          .fontSize(9)
          .fontColor($r('app.color.km_warning'))
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor($r('app.color.km_warning_soft'))
          .borderRadius(8)
      }
      if (!this.publicJobsFailed || this.publicJobs.length > 0) {
        NativeStatusMessage({ message: this.publicJobsMessage })
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildPublicJobCard(job: NativePublicJob): void {
    Column({ space: 9 }) {
      Row() {
        Column({ space: 4 }) {
          Text(job.title)
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .maxLines(2)
          Text(job.company)
            .fontSize(12)
            .fontColor($r('app.color.km_text_muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(this.verificationLabel(job.verification))
          .fontSize(9)
          .fontColor($r('app.color.km_success'))
          .padding({ left: 7, right: 7, top: 4, bottom: 4 })
          .backgroundColor($r('app.color.km_success_soft'))
          .borderRadius(9)
      }
      .width('100%')
      Row({ space: 8 }) {
        Text(job.city)
          .fontSize(10)
          .fontColor($r('app.color.km_primary_action'))
        Text(job.level)
          .fontSize(10)
          .fontColor($r('app.color.km_purple'))
        Text(job.sourceName)
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      Text(job.summary)
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(18)
        .maxLines(3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Row({ space: 8 }) {
        Button('查看详情')
          .layoutWeight(1)
          .constraintSize({ minHeight: 38 })
          .fontSize(11)
          .fontColor($r('app.color.km_info'))
          .backgroundColor($r('app.color.km_info_soft'))
          .borderRadius(12)
          .onClick(() => { this.showPublicJob(job.id); })
        Button('保存追踪')
          .layoutWeight(1)
          .constraintSize({ minHeight: 38 })
          .fontSize(11)
          .fontColor($r('app.color.km_text_on_primary'))
          .backgroundColor($r('app.color.km_primary_action'))
          .borderRadius(12)
          .onClick(() => { this.trackPublicJob(job); })
      }
      .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildPublicJobDetail(job: NativePublicJob): void {
    Scroll() {
      Column({ space: 12 }) {
        Button('返回岗位列表')
          .constraintSize({ minHeight: 38 })
          .fontSize(11)
          .fontColor($r('app.color.km_info'))
          .backgroundColor($r('app.color.km_info_soft'))
          .borderRadius(12)
          .alignSelf(ItemAlign.Start)
          .onClick(() => { this.selectedPublicJobIndex = -1; })
        Column({ space: 10 }) {
          Row() {
            Text(this.verificationLabel(job.verification))
              .fontSize(10)
              .fontColor($r('app.color.km_success'))
              .padding({ left: 8, right: 8, top: 5, bottom: 5 })
              .backgroundColor($r('app.color.km_success_soft'))
              .borderRadius(10)
            Blank()
            Text(job.level)
              .fontSize(11)
              .fontColor($r('app.color.km_purple'))
          }
          .width('100%')
          Text(job.title)
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .width('100%')
          Text(`${job.company} · ${job.city}`)
            .fontSize(13)
            .fontColor($r('app.color.km_text_muted'))
            .width('100%')
          Text(job.summary)
            .fontSize(12)
            .fontColor($r('app.color.km_text_body'))
            .lineHeight(20)
            .maxLines(6)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(18)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Row({ space: 8 }) {
          Button('保存为追踪岗位')
            .layoutWeight(1)
            .constraintSize({ minHeight: 44 })
            .fontSize(11)
            .fontColor($r('app.color.km_info'))
            .backgroundColor($r('app.color.km_info_soft'))
            .borderRadius(8)
            .onClick(() => { this.trackPublicJob(job); })
          Button('打开官方投递')
            .layoutWeight(1)
            .constraintSize({ minHeight: 44 })
            .fontSize(11)
            .fontColor($r('app.color.km_text_on_primary'))
            .backgroundColor($r('app.color.km_primary_action'))
            .borderRadius(8)
            .onClick(() => { void this.openPublicJob(job); })
        }
        .width('100%')
        NativeStatusMessage({ message: this.publicJobsMessage })

        Column({ space: 8 }) {
          Text('岗位职责与要求')
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(job.description)
            .fontSize(12)
            .fontColor($r('app.color.km_text_muted'))
            .lineHeight(21)
            .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        Column({ space: 7 }) {
          Text('来源核验')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(`来源：${job.sourceName}`)
            .fontSize(11)
            .fontColor($r('app.color.km_text_muted'))
          if (job.publishedAt) {
            Text(`发布时间：${job.publishedAt}`)
              .fontSize(11)
              .fontColor($r('app.color.km_text_secondary'))
          }
          Text(job.sourceUrl)
            .fontSize(10)
            .fontColor($r('app.color.km_primary_action'))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_primary_tint'))
        .borderRadius(8)
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 24 })
      .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildTrackedJobEditor(): void {
    Column({ space: 10 }) {
      Row() {
        Text(this.trackedJobs > 0 ? '编辑真实岗位' : '添加真实岗位')
          .fontSize(17)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
        Blank()
        Text('仅保存在本机')
          .fontSize(10)
          .fontColor($r('app.color.km_success'))
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor($r('app.color.km_success_soft'))
          .borderRadius(10)
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位名称', '必填')
        TextInput({ placeholder: '填写招聘页面中的岗位名称', text: this.trackedJobTitle })
          .constraintSize({ minHeight: 44 })
          .maxLength(120)
          .enterKeyType(EnterKeyType.Next)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: this.jobTitleError ? $r('app.color.km_danger') : $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => {
            this.trackedJobTitle = value;
            this.updateJobEditorDirtyState();
            if (this.jobTitleTouched) this.jobTitleError = this.validateJobTitle(value);
          })
          .onBlur(() => {
            this.jobTitleTouched = true;
            this.jobTitleError = this.validateJobTitle(this.trackedJobTitle);
          })
        NativeFieldError({ message: this.jobTitleError })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('公司名称', '必填')
        TextInput({ placeholder: '填写招聘主体或公司名称', text: this.trackedJobCompany })
          .constraintSize({ minHeight: 44 })
          .maxLength(120)
          .enterKeyType(EnterKeyType.Next)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: this.jobCompanyError ? $r('app.color.km_danger') : $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => {
            this.trackedJobCompany = value;
            this.updateJobEditorDirtyState();
            if (this.jobCompanyTouched) this.jobCompanyError = this.validateJobCompany(value);
          })
          .onBlur(() => {
            this.jobCompanyTouched = true;
            this.jobCompanyError = this.validateJobCompany(this.trackedJobCompany);
          })
        NativeFieldError({ message: this.jobCompanyError })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位来源', '必填')
        TextInput({ placeholder: '粘贴 http/https 招聘页面链接', text: this.trackedJobSource })
          .constraintSize({ minHeight: 44 })
          .maxLength(1000)
          .enterKeyType(EnterKeyType.Next)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: this.jobSourceError ? $r('app.color.km_danger') : $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => {
            this.trackedJobSource = value;
            this.updateJobEditorDirtyState();
            if (this.jobSourceTouched) this.jobSourceError = this.validateJobSource(value);
          })
          .onBlur(() => {
            this.jobSourceTouched = true;
            this.jobSourceError = this.validateJobSource(this.trackedJobSource);
          })
        NativeFieldError({ message: this.jobSourceError })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位描述', '至少 30 字')
        TextArea({ placeholder: '粘贴真实 JD，用于识别技能、学历和成果要求。', text: this.trackedJobDescription })
          .constraintSize({ minHeight: 128 })
          .maxLength(6000)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: this.jobDescriptionError ? $r('app.color.km_danger') : $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => {
            this.trackedJobDescription = value;
            this.updateJobEditorDirtyState();
            if (this.jobDescriptionTouched) this.jobDescriptionError = this.validateJobDescription(value);
          })
          .onBlur(() => {
            this.jobDescriptionTouched = true;
            this.jobDescriptionError = this.validateJobDescription(this.trackedJobDescription);
          })
        NativeFieldError({ message: this.jobDescriptionError })
      }
      .width('100%')
      Row({ space: 8 }) {
        Button('保存并重建证据')
          .layoutWeight(1)
          .constraintSize({ minHeight: 42 })
          .fontSize(12)
          .fontColor($r('app.color.km_text_on_primary'))
          .backgroundColor($r('app.color.km_primary_action'))
          .borderRadius(8)
          .onClick(() => { this.saveTrackedJob(); })
        if (this.trackedJobs > 0) {
          Button('取消')
            .constraintSize({ minHeight: 42 })
            .fontSize(12)
            .fontColor($r('app.color.km_text_muted'))
            .backgroundColor($r('app.color.km_border'))
            .borderRadius(8)
            .onClick(() => { this.cancelTrackedJobEdit(); })
        }
      }
      .width('100%')
      NativeStatusMessage({ message: this.jobMessage })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildTrackedJobCard(): void {
    if (this.trackedJobs === 0 || this.showJobEditor) {
      this.buildTrackedJobEditor()
    } else {
      Column({ space: 10 }) {
        Row() {
          Column({ space: 4 }) {
            Text('当前追踪岗位')
              .fontSize(9)
              .fontColor($r('app.color.km_primary'))
            Text(this.trackedJobTitle)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
              .maxLines(2)
            Text(this.trackedJobCompany)
              .fontSize(12)
              .fontColor($r('app.color.km_text_muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text('本机追踪')
            .fontSize(10)
            .fontColor($r('app.color.km_success'))
            .padding({ left: 8, right: 8, top: 5, bottom: 5 })
            .backgroundColor($r('app.color.km_success_soft'))
            .borderRadius(11)
        }
        .width('100%')
        Text(this.trackedJobSource)
          .fontSize(10)
          .fontColor($r('app.color.km_primary_action'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        Text(this.trackedJobDescription)
          .fontSize(11)
          .fontColor($r('app.color.km_text_secondary'))
          .lineHeight(18)
          .maxLines(3)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        NativeApplicationTracker({
          applicationStage: this.applicationStage,
          applicationUpdatedAt: this.applicationUpdatedAt,
          applicationDeadline: this.applicationDeadline,
          nextInterviewAt: this.nextInterviewAt,
          applicationEvents: this.applicationEvents,
          applicationMessage: this.applicationMessage,
          applicationDeadlineError: this.applicationDeadlineError,
          nextInterviewAtError: this.nextInterviewAtError,
          currentAction: this.currentApplicationAction(),
          boundVersionName: this.boundResumeVersionName(),
          onStageChange: (stageId: string) => { this.updateApplicationStage(stageId); },
          onDeadlineChange: (value: string) => {
            this.applicationDeadline = value;
            this.updateApplicationScheduleDirtyState();
            this.applicationDeadlineError = this.validateLocalDateTime(value);
          },
          onInterviewChange: (value: string) => {
            this.nextInterviewAt = value;
            this.updateApplicationScheduleDirtyState();
            this.nextInterviewAtError = this.validateLocalDateTime(value);
          },
          onSaveSchedule: () => { this.saveApplicationSchedule(); },
          onCreateDeadlineReminder: () => { void this.openApplicationReminder('deadline'); },
          onCreateInterviewReminder: () => { void this.openApplicationReminder('interview'); },
        })
        Row({ space: 8 }) {
          Button('编辑岗位')
            .layoutWeight(1)
            .constraintSize({ minHeight: 38 })
            .fontSize(11)
            .fontColor($r('app.color.km_info'))
            .backgroundColor($r('app.color.km_info_soft'))
            .borderRadius(12)
            .onClick(() => { this.beginTrackedJobEdit(); })
          Button('移除岗位')
            .layoutWeight(1)
            .constraintSize({ minHeight: 38 })
            .fontSize(11)
            .fontColor($r('app.color.km_danger'))
            .backgroundColor($r('app.color.km_danger_soft'))
            .borderRadius(12)
            .onClick(() => { this.requestRemoveTrackedJob(); })
        }
        .width('100%')
        NativeStatusMessage({ message: this.jobMessage })
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(16)
      .backgroundColor($r('app.color.km_surface'))
      .border({ width: 1, color: $r('app.color.km_border') })
      .borderRadius(8)
    }
  }

  @Builder
  private buildJobs(): void {
    if (this.selectedPublicJobIndex >= 0 && this.selectedPublicJobIndex < this.publicJobs.length) {
      this.buildPublicJobDetail(this.publicJobs[this.selectedPublicJobIndex])
    } else {
      Scroll() {
        Column({ space: 12 }) {
          this.buildPageHeading('岗位情报', '岗位中心', `围绕“${this.targetJob}”发现真实岗位，并核对要求与个人证据。`)

          Row({ space: 4 }) {
            Column({ space: 4 }) {
              Text('01')
                .fontSize(9)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_primary_action'))
              Text('搜索来源')
                .fontSize(10)
                .fontWeight(FontWeight.Medium)
                .fontColor($r('app.color.km_text_primary'))
            }
            .alignItems(HorizontalAlign.Center)
            .layoutWeight(1)
            Divider()
              .width(20)
              .color($r('app.color.km_border_strong'))
            Column({ space: 4 }) {
              Text('02')
                .fontSize(9)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_teal'))
              Text('保存追踪')
                .fontSize(10)
                .fontWeight(FontWeight.Medium)
                .fontColor($r('app.color.km_text_primary'))
            }
            .alignItems(HorizontalAlign.Center)
            .layoutWeight(1)
            Divider()
              .width(20)
              .color($r('app.color.km_border_strong'))
            Column({ space: 4 }) {
              Text('03')
                .fontSize(9)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_warning'))
              Text('核对证据')
                .fontSize(10)
                .fontWeight(FontWeight.Medium)
                .fontColor($r('app.color.km_text_primary'))
            }
            .alignItems(HorizontalAlign.Center)
            .layoutWeight(1)
          }
          .alignItems(VerticalAlign.Center)
          .width('100%')
          .padding({ left: 12, right: 12, top: 10, bottom: 10 })
          .backgroundColor($r('app.color.km_surface_subtle'))
          .borderRadius(8)

          this.buildSectionHeading('发现岗位', '搜索可追溯来源，确认详情后再保存到本机工作区。')
          this.buildPublicJobSearch()

          if (this.publicJobs.length > 0) {
            Row() {
              Text('官方岗位结果')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Blank()
              Text(`${this.publicJobs.length}/${this.publicJobsTotal}`)
                .fontSize(11)
                .fontColor($r('app.color.km_text_secondary'))
            }
            .width('100%')
            ForEach(this.publicJobs, (job: NativePublicJob) => {
              this.buildPublicJobCard(job);
            }, (job: NativePublicJob) => job.id)
          } else if (this.publicJobsLoading) {
            NativeAsyncStatePanel({
              state: 'loading',
              title: '正在汇总官方岗位',
              detail: '正在核对来源、岗位状态与筛选条件。',
            })
          } else if (this.publicJobsSearched && this.publicJobsFailed) {
            NativeAsyncStatePanel({
              state: 'error',
              title: this.publicJobsConfigured ? '暂时无法读取官方岗位' : '当前版本未连接岗位服务',
              detail: this.publicJobsMessage,
              actionLabel: this.publicJobsConfigured ? '重新连接' : '',
              onAction: () => { void this.refreshPublicJobs(); },
            })
          } else if (this.publicJobsSearched) {
            NativeAsyncStatePanel({
              state: 'empty',
              title: '没有找到符合条件的官方岗位',
              detail: '调整关键词或城市后重新搜索，也可以继续在下方录入真实岗位。',
            })
          }

          this.buildSectionHeading('本机岗位与证据', '围绕已追踪岗位查看要求覆盖，并把缺口带入模拟面试。')

          Row({ space: 10 }) {
            NativeMetricCard({ label: '证据覆盖', value: `${this.evidenceCoverage}%`, detail: '岗位要求可追溯度' })
            NativeMetricCard({ label: '已追踪岗位', value: `${this.trackedJobs}`, detail: '不混入职业方向' })
          }
          .width('100%')

          this.buildTrackedJobCard()

          ForEach(this.jobEvidence, (evidence: NativeJobEvidence) => {
            this.buildRequirement(evidence.title, evidence.status, evidence.detail, evidence.color, evidence.background);
          }, (evidence: NativeJobEvidence) => evidence.id)

          Button('进入模拟面试')
            .width('100%')
            .constraintSize({ minHeight: 46 })
            .fontColor($r('app.color.km_text_on_primary'))
            .backgroundColor($r('app.color.km_primary_action'))
            .borderRadius(8)
            .onClick(() => { this.requestTabChange(3); })
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 14, bottom: 24 })
        .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
        .alignSelf(ItemAlign.Center)
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
  }

  @Builder
  private buildRequirement(title: string, status: string, detail: string, color: string, background: string): void {
    Column({ space: 8 }) {
      Row() {
        Text(title)
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
        Blank()
        Text(status)
          .fontSize(11)
          .fontColor(color)
          .padding({ left: 9, right: 9, top: 5, bottom: 5 })
          .backgroundColor(background)
          .borderRadius(12)
      }
      .width('100%')
      Text(detail)
        .fontSize(12)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(19)
        .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildImmersiveInterviewHeader(): void {
    Row({ space: 10 }) {
      Image($r('app.media.startIconNative'))
        .width(28)
        .height(28)
        .objectFit(ImageFit.Contain)
      Column({ space: 1 }) {
        Text('孔明模拟面试')
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
        Text(`${this.trackedJobTitle || this.targetJob} · ${this.interviewType} · ${this.interviewDifficulty}难度`)
          .fontSize(9)
          .fontColor($r('app.color.km_text_secondary'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .alignItems(HorizontalAlign.Start)
      .constraintSize({ maxWidth: 360 })
      Blank()
      Column({ space: 4 }) {
        Row({ space: 6 }) {
          Text(`第 ${Math.max(1, this.interviewRound)} 轮 / 3`)
            .fontSize(9)
            .fontColor($r('app.color.km_text_secondary'))
          SymbolGlyph($r('sys.symbol.clock'))
            .fontSize(12)
            .fontColor([this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_primary_action')])
          Text(`${this.formattedInterviewTime()} / ${this.interviewDurationMinutes}:00`)
            .fontSize(11)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_text_primary'))
        }
        Progress({ value: this.interviewProgressValue(), total: 100, type: ProgressType.Linear })
          .width(190)
          .height(3)
          .color(this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_primary_action'))
          .backgroundColor($r('app.color.km_border'))
      }
      .alignItems(HorizontalAlign.End)
      Button() {
        SymbolGlyph($r('sys.symbol.pause'))
          .fontSize(17)
          .fontColor([$r('app.color.km_primary_action')])
      }
      .width(38)
      .height(38)
      .backgroundColor($r('app.color.km_primary_tint'))
      .borderRadius(8)
      .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
      .accessibilityText('暂停面试')
      .onClick(() => { void this.pauseInterview(); })
      Button() {
        SymbolGlyph($r('sys.symbol.stop_circle'))
          .fontSize(18)
          .fontColor([$r('app.color.km_danger')])
      }
      .width(38)
      .height(38)
      .backgroundColor($r('app.color.km_danger_soft'))
      .borderRadius(8)
      .enabled(!this.interviewLoading)
      .accessibilityText('提前结束面试')
      .onClick(() => { this.requestEndInterview(); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .constraintSize({ minHeight: 50 })
    .padding({ left: 12, right: 8, top: 6, bottom: 6 })
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildImmersiveInterviewerStage(): void {
    Column({ space: 10 }) {
      NativeDigitalInterviewer({
        avatarState: this.interviewAvatarState,
        compact: true,
        viewportHeight: 220,
      })
      Row({ space: 9 }) {
        SymbolGlyph(this.interviewSpeaking ? $r('sys.symbol.waveform') : $r('sys.symbol.person_crop_circle_fill'))
          .fontSize(17)
          .fontColor([$r('app.color.km_primary_action')])
        Column({ space: 2 }) {
          Text(this.interviewerPresenceLabel())
            .fontSize(12)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(`${this.interviewSpeechMessage} · ${this.speechProvider.providerName}`)
            .fontSize(9)
            .fontColor($r('app.color.km_text_secondary'))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        if (this.interviewSpeaking) {
          Button() {
            SymbolGlyph($r('sys.symbol.stop_circle'))
              .fontSize(16)
              .fontColor([$r('app.color.km_danger')])
          }
          .width(36)
          .height(36)
          .backgroundColor($r('app.color.km_danger_soft'))
          .borderRadius(8)
          .accessibilityText('停止播报')
          .onClick(() => { void this.stopInterviewPrompt(); })
        }
      }
      .alignItems(VerticalAlign.Center)
      .width('100%')
      .padding({ left: 12, right: 9, top: 8, bottom: 8 })
      .backgroundColor($r('app.color.km_surface'))
      .border({ width: 1, color: $r('app.color.km_border') })
      .borderRadius(8)
    }
    .layoutWeight(11)
    .height('100%')
  }

  @Builder
  private buildImmersiveAnswerPanel(): void {
    Column({ space: this.interviewKeyboardVisible ? 4 : 6 }) {
      if (this.interviewKeyboardVisible) {
        Row({ space: 6 }) {
          Text(`第 ${Math.max(1, this.interviewRound)} 轮`)
            .fontSize(9)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_primary_action'))
            .padding({ left: 7, right: 7, top: 4, bottom: 4 })
            .backgroundColor($r('app.color.km_primary_tint'))
            .borderRadius(7)
          Text(this.interviewQuestion || this.fallbackInterviewQuestion(1))
            .fontSize(10)
            .fontColor($r('app.color.km_text_primary'))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
          Text(`${this.interviewAnswer.length}/3000`)
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
          Button() {
            SymbolGlyph($r('sys.symbol.checkmark_circle'))
              .fontSize(15)
              .fontColor([$r('app.color.km_text_on_primary')])
          }
          .width(34)
          .height(30)
          .backgroundColor($r('app.color.km_primary_action'))
          .borderRadius(7)
          .accessibilityText('完成回答输入')
          .onClick(() => { this.dismissInterviewKeyboard(); })
        }
        .alignItems(VerticalAlign.Center)
        .width('100%')
        .constraintSize({ minHeight: 30, maxHeight: 30 })
      } else {
        Row() {
          Text(`${this.interviewType} · 第 ${Math.max(1, this.interviewRound)} 轮`)
            .fontSize(10)
            .fontColor($r('app.color.km_primary_action'))
          Blank()
          Text(this.interviewModelName)
            .fontSize(9)
            .fontColor(this.interviewModelName === '本机规则' ? $r('app.color.km_text_muted') : $r('app.color.km_success'))
            .padding({ left: 8, right: 8, top: 4, bottom: 4 })
            .backgroundColor(this.interviewModelName === '本机规则' ? $r('app.color.km_border') : $r('app.color.km_success_soft'))
            .borderRadius(8)
        }
        .width('100%')
        Scroll() {
          Text(this.interviewQuestion || this.fallbackInterviewQuestion(1))
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .lineHeight(18)
            .width('100%')
        }
        .width('100%')
        .constraintSize({ minHeight: 48, maxHeight: 64 })
        .scrollBar(BarState.Off)
        Row() {
          Text('本轮回答')
            .fontSize(11)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_text_primary'))
          if (this.interviewTurns.length > 0) {
            Text(` · 已保留 ${this.interviewTurns.length} 轮`)
              .fontSize(9)
              .fontColor($r('app.color.km_text_secondary'))
          }
          Blank()
          Text(`${this.interviewAnswer.length}/3000 · 至少 20 字`)
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
        }
        .width('100%')
      }
      TextArea({ placeholder: '输入真实回答，不要填写无法核验的成果。', text: this.interviewAnswer })
        .layoutWeight(1)
        .constraintSize({ minHeight: this.interviewKeyboardVisible ? 52 : 64, maxHeight: this.interviewKeyboardVisible ? 84 : 96 })
        .maxLength(3000)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: this.interviewAnswerError ? $r('app.color.km_danger') : $r('app.color.km_border') })
        .borderRadius(8)
        .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' && this.interviewTurns.length < 3)
        .enableKeyboardOnFocus(true)
        .onChange((value: string) => {
          this.interviewAnswer = value;
          if (this.interviewAnswerTouched) this.interviewAnswerError = this.validateInterviewAnswer(value);
        })
        .onBlur(() => {
          this.interviewKeyboardVisible = false;
          if (this.interviewAnswer.trim()) {
            this.interviewAnswerTouched = true;
            this.interviewAnswerError = this.validateInterviewAnswer(this.interviewAnswer);
          }
        })
      if (!this.interviewKeyboardVisible) {
        NativeFieldError({ message: this.interviewAnswerError })
        Row({ space: 6 }) {
          Button() {
            Row({ space: 4 }) {
              SymbolGlyph(this.interviewSpeaking ? $r('sys.symbol.stop_circle') : $r('sys.symbol.waveform'))
                .fontSize(13)
                .fontColor([this.interviewSpeaking ? $r('app.color.km_danger') : $r('app.color.km_purple')])
              Text(this.interviewSpeaking ? '停止播报' : '朗读问题')
                .fontSize(9)
                .fontColor(this.interviewSpeaking ? $r('app.color.km_danger') : $r('app.color.km_purple'))
            }
          }
          .layoutWeight(1)
          .constraintSize({ minHeight: 38, maxHeight: 38 })
          .backgroundColor(this.interviewSpeaking ? $r('app.color.km_danger_soft') : $r('app.color.km_purple_soft'))
          .borderRadius(8)
          .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
          .onClick(() => {
            if (this.interviewSpeaking) void this.stopInterviewPrompt();
            else void this.speakInterviewPrompt();
          })
          Button() {
            Row({ space: 4 }) {
              SymbolGlyph($r('sys.symbol.mic'))
                .fontSize(13)
                .fontColor([this.speechActive ? $r('app.color.km_text_on_primary') : $r('app.color.km_info')])
              Text(this.speechActive ? '停止并填入' : '语音回答')
                .fontSize(9)
                .fontColor(this.speechActive ? $r('app.color.km_text_on_primary') : $r('app.color.km_info'))
            }
          }
          .layoutWeight(1)
          .constraintSize({ minHeight: 38, maxHeight: 38 })
          .backgroundColor(this.speechActive ? $r('app.color.km_danger_active') : $r('app.color.km_info_soft'))
          .borderRadius(8)
          .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' && this.interviewTurns.length < 3)
          .onClick(() => { void this.toggleSpeechInput(); })
          if (this.interviewTurns.length < 3) {
            Button() {
              Row({ space: 4 }) {
                if (this.interviewLoading) {
                  LoadingProgress().width(13).height(13).color($r('app.color.km_text_on_primary'))
                } else {
                  SymbolGlyph($r('sys.symbol.paperplane_fill'))
                    .fontSize(13)
                    .fontColor([$r('app.color.km_text_on_primary')])
                }
                Text(this.interviewLoading ? '生成追问中' : '提交并追问')
                  .fontSize(9)
                  .fontWeight(FontWeight.Medium)
                  .fontColor($r('app.color.km_text_on_primary'))
              }
            }
            .layoutWeight(1)
            .constraintSize({ minHeight: 38, maxHeight: 38 })
            .backgroundColor($r('app.color.km_primary_action'))
            .borderRadius(8)
            .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
            .onClick(() => { void this.submitInterviewAnswer(); })
          }
          Button() {
            Text('生成反馈')
              .fontSize(9)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_success'))
          }
            .layoutWeight(1)
            .constraintSize({ minHeight: 38, maxHeight: 38 })
            .padding({ left: 4, right: 4 })
            .backgroundColor($r('app.color.km_success_soft'))
            .borderRadius(8)
            .enabled(!this.interviewLoading)
            .onClick(() => { void this.finishInterview(); })
        }
        .width('100%')
      }
    }
    .alignItems(HorizontalAlign.Start)
    .layoutWeight(9)
    .height('100%')
    .padding(this.interviewKeyboardVisible ? 6 : 10)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildImmersivePauseOverlay(): void {
    Column({ space: 14 }) {
      SymbolGlyph(this.interviewTimeExpired ? $r('sys.symbol.clock_fill') : $r('sys.symbol.pause_circle'))
        .fontSize(36)
        .fontColor([this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_primary_action')])
      Text(this.interviewTimeExpired ? '设定时长已到' : '面试已暂停')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
      Text(this.interviewTimeExpired
        ? '加时 5 分钟后可继续当前问题，也可以直接结束并生成反馈。'
        : '计时和语音均已停止，当前回答草稿会保留。')
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(18)
        .textAlign(TextAlign.Center)
      Row({ space: 10 }) {
        Button() {
          Row({ space: 6 }) {
            SymbolGlyph($r('sys.symbol.play_fill'))
              .fontSize(15)
              .fontColor([$r('app.color.km_text_on_primary')])
            Text(this.interviewTimeExpired ? '加时 5 分钟' : '继续面试')
              .fontSize(11)
              .fontColor($r('app.color.km_text_on_primary'))
          }
        }
        .layoutWeight(1)
        .constraintSize({ minHeight: 42 })
        .backgroundColor($r('app.color.km_primary_action'))
        .borderRadius(8)
        .onClick(() => { this.resumeInterview(); })
        Button('结束面试')
          .layoutWeight(1)
          .constraintSize({ minHeight: 42 })
          .fontSize(11)
          .fontColor($r('app.color.km_danger'))
          .backgroundColor($r('app.color.km_danger_soft'))
          .borderRadius(8)
          .onClick(() => { this.requestEndInterview(); })
      }
      .width('100%')
    }
    .width(410)
    .padding(22)
    .backgroundColor($r('app.color.km_surface_elevated'))
    .border({ width: 1, color: this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_primary_action') })
    .borderRadius(8)
    .shadow({ radius: 24, color: '#66000000', offsetY: 8 })
  }

  @Builder
  private buildImmersiveInterview(): void {
    Stack({ alignContent: Alignment.Center }) {
      Column({ space: this.interviewKeyboardVisible ? 0 : 10 }) {
        if (!this.interviewKeyboardVisible) {
          this.buildImmersiveInterviewHeader()
        }
        Row({ space: this.interviewKeyboardVisible ? 0 : 12 }) {
          if (!this.interviewKeyboardVisible) {
            this.buildImmersiveInterviewerStage()
          }
          this.buildImmersiveAnswerPanel()
        }
        .width('100%')
        .layoutWeight(1)
      }
      .width('100%')
      .height('100%')
      .padding(this.interviewKeyboardVisible ? 6 : 12)
      if (this.interviewSessionPhase === 'paused') {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('#99050A12')
        this.buildImmersivePauseOverlay()
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.km_page_background'))
  }

  @Builder
  private buildInterviewReadinessItem(label: string, ready: boolean): void {
    Row({ space: 6 }) {
      Circle()
        .width(6)
        .height(6)
        .fill(ready ? $r('app.color.km_success') : $r('app.color.km_warning'))
      Text(label)
        .fontSize(9)
        .fontWeight(FontWeight.Medium)
        .fontColor(ready ? $r('app.color.km_success') : $r('app.color.km_warning'))
        .maxLines(1)
    }
    .justifyContent(FlexAlign.Center)
    .layoutWeight(1)
    .constraintSize({ minHeight: 28 })
    .backgroundColor(ready ? $r('app.color.km_success_soft') : $r('app.color.km_warning_soft'))
    .borderRadius(6)
  }

  @Builder
  private buildInterviewAudioReadinessItem(): void {
    Row({ space: 6 }) {
      Circle()
        .width(6)
        .height(6)
        .fill(this.interviewAudioChecked ? $r('app.color.km_success') : $r('app.color.km_warning'))
      Text(this.interviewAudioChecked ? '音频已试听' : '建议试听音频')
        .fontSize(9)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.interviewAudioChecked ? $r('app.color.km_success') : $r('app.color.km_warning'))
        .maxLines(1)
    }
    .justifyContent(FlexAlign.Center)
    .layoutWeight(1)
    .constraintSize({ minHeight: 28 })
    .backgroundColor(this.interviewAudioChecked ? $r('app.color.km_success_soft') : $r('app.color.km_warning_soft'))
    .borderRadius(6)
  }

  @Builder
  private buildInterviewLaunchBar(): void {
    Row({ space: 12 }) {
      Column({ space: 2 }) {
        Text(`${this.interviewType} · ${this.interviewDifficulty} · ${this.interviewDurationMinutes} 分钟`)
          .fontSize(11)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
          .maxLines(1)
        Text(this.modelConsent ? '智能增强 · 发送前自动脱敏' : '本机规则 · 回答不离开设备')
          .fontSize(9)
          .fontColor(this.modelConsent ? $r('app.color.km_primary_action') : $r('app.color.km_text_secondary'))
          .maxLines(1)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Button() {
        Row({ space: 6 }) {
          SymbolGlyph($r('sys.symbol.play_fill'))
            .fontSize(14)
            .fontColor([$r('app.color.km_text_on_primary')])
          Text('开始面试')
            .fontSize(11)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_text_on_primary'))
        }
      }
      .constraintSize({ minWidth: 112, minHeight: 42 })
      .backgroundColor($r('app.color.km_primary_action'))
      .borderRadius(8)
      .accessibilityText(this.modelConsent ? '开始 AI 增强面试' : '开始本机面试')
      .onClick(() => { this.startInterview(); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
  }

  @Builder
  private buildInterview(): void {
    Column() {
      Scroll() {
        Column({ space: 14 }) {
        this.buildPageHeading(
          '能力训练',
          '模拟面试',
          this.interviewStarted
            ? (this.interviewSessionPhase === 'completed'
              ? `${this.interviewType}已完成，可查看反馈或重新开始。`
              : `正在进行 ${this.interviewType}，问题与回答仅在当前工作区留存。`)
            : '配置一场完整的岗位模拟面试，练习表达、追问应对和证据说明。',
        )

        if (!this.interviewStarted) {
          Column({ space: 14 }) {
            this.buildSectionHeading('本轮设置', '先选择训练模式，再进入横屏全屏面试。')
            this.buildFieldLabel('面试类型', '每轮最多 3 次核心追问')
            Row({ space: 6 }) {
              Button('综合面')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(11)
                .fontColor(this.interviewType === '综合面' ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body'))
                .backgroundColor(this.interviewType === '综合面' ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
                .border({ width: 1, color: this.interviewType === '综合面' ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
                .borderRadius(6)
                .onClick(() => { this.interviewType = '综合面'; })
              Button('技术面')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(11)
                .fontColor(this.interviewType === '技术面' ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body'))
                .backgroundColor(this.interviewType === '技术面' ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
                .border({ width: 1, color: this.interviewType === '技术面' ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
                .borderRadius(6)
                .onClick(() => { this.interviewType = '技术面'; })
              Button('HR 面')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(11)
                .fontColor(this.interviewType === 'HR面' ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body'))
                .backgroundColor(this.interviewType === 'HR面' ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
                .border({ width: 1, color: this.interviewType === 'HR面' ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
                .borderRadius(6)
                .onClick(() => { this.interviewType = 'HR面'; })
            }
            .width('100%')

            Row({ space: 10 }) {
              SymbolGlyph($r('sys.symbol.briefcase'))
                .fontSize(20)
                .fontColor([$r('app.color.km_primary_action')])
              Column({ space: 3 }) {
                Text('本轮目标岗位')
                  .fontSize(10)
                  .fontColor($r('app.color.km_text_tertiary'))
                Text(this.trackedJobTitle || this.targetJob)
                  .fontSize(15)
                  .fontWeight(FontWeight.Bold)
                  .fontColor($r('app.color.km_text_primary'))
                  .maxLines(2)
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              Text(this.resumeSummary.trim() ? '简历画像已就绪' : '使用基础岗位画像')
                .fontSize(9)
                .fontColor(this.resumeSummary.trim() ? $r('app.color.km_success') : $r('app.color.km_warning'))
                .padding({ left: 8, right: 8, top: 5, bottom: 5 })
                .backgroundColor(this.resumeSummary.trim() ? $r('app.color.km_success_soft') : $r('app.color.km_warning_soft'))
                .borderRadius(8)
            }
            .width('100%')

            this.buildFieldLabel('追问强度', this.interviewDifficultyHint())
            Row({ space: 8 }) {
              Button('基础')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(12)
                .fontColor(this.interviewDifficulty === '基础' ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body'))
                .backgroundColor(this.interviewDifficulty === '基础' ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
                .border({ width: 1, color: this.interviewDifficulty === '基础' ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
                .borderRadius(6)
                .onClick(() => { this.interviewDifficulty = '基础'; })
              Button('标准')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(12)
                .fontColor(this.interviewDifficulty === '标准' ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body'))
                .backgroundColor(this.interviewDifficulty === '标准' ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
                .border({ width: 1, color: this.interviewDifficulty === '标准' ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
                .borderRadius(6)
                .onClick(() => { this.interviewDifficulty = '标准'; })
              Button('高压')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(12)
                .fontColor(this.interviewDifficulty === '高压' ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body'))
                .backgroundColor(this.interviewDifficulty === '高压' ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
                .border({ width: 1, color: this.interviewDifficulty === '高压' ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
                .borderRadius(6)
                .onClick(() => { this.interviewDifficulty = '高压'; })
            }
            .width('100%')

            this.buildFieldLabel('训练时长', '到时自动暂停，可继续加时')
            Row({ space: 8 }) {
              Button('10 分钟').layoutWeight(1).constraintSize({ minHeight: 38 }).fontSize(11).fontColor(this.interviewDurationMinutes === 10 ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body')).backgroundColor(this.interviewDurationMinutes === 10 ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle')).border({ width: 1, color: this.interviewDurationMinutes === 10 ? $r('app.color.km_primary_action') : $r('app.color.km_border') }).borderRadius(6).onClick(() => { this.interviewDurationMinutes = 10; })
              Button('15 分钟').layoutWeight(1).constraintSize({ minHeight: 38 }).fontSize(11).fontColor(this.interviewDurationMinutes === 15 ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body')).backgroundColor(this.interviewDurationMinutes === 15 ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle')).border({ width: 1, color: this.interviewDurationMinutes === 15 ? $r('app.color.km_primary_action') : $r('app.color.km_border') }).borderRadius(6).onClick(() => { this.interviewDurationMinutes = 15; })
              Button('20 分钟').layoutWeight(1).constraintSize({ minHeight: 38 }).fontSize(11).fontColor(this.interviewDurationMinutes === 20 ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_body')).backgroundColor(this.interviewDurationMinutes === 20 ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle')).border({ width: 1, color: this.interviewDurationMinutes === 20 ? $r('app.color.km_primary_action') : $r('app.color.km_border') }).borderRadius(6).onClick(() => { this.interviewDurationMinutes = 20; })
            }
            .width('100%')

            Row({ space: 6 }) {
              this.buildInterviewReadinessItem('岗位已确认', this.targetJob.trim().length > 0)
              this.buildInterviewReadinessItem(
                this.resumeSummary.trim().length >= 30 ? '画像已就绪' : '使用基础画像',
                this.resumeSummary.trim().length >= 30,
              )
              this.buildInterviewAudioReadinessItem()
            }
            .width('100%')
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(16)
          .backgroundColor($r('app.color.km_surface'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
        }

        NativeDigitalInterviewer({
          avatarState: this.interviewAvatarState,
          compact: !this.isWideLayout,
          viewportHeight: this.isWideLayout ? 260 : (this.interviewStarted ? 220 : 184),
        })

        Row({ space: 10 }) {
          SymbolGlyph(this.interviewSpeaking ? $r('sys.symbol.waveform') : $r('sys.symbol.person_crop_circle_fill'))
            .fontSize(18)
            .fontColor([$r('app.color.km_primary_action')])
          Column({ space: 2 }) {
            Text(this.interviewerPresenceLabel())
              .fontSize(13)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text(`${this.interviewSpeechMessage} · ${this.speechProvider.providerName}`)
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
              .maxLines(2)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          if (this.interviewSpeaking) {
            Button('停止播报')
              .constraintSize({ minHeight: 34 })
              .fontSize(11)
              .fontColor($r('app.color.km_danger'))
              .backgroundColor($r('app.color.km_danger_soft'))
              .borderRadius(7)
              .onClick(() => { void this.stopInterviewPrompt(); })
          } else if (!this.interviewStarted) {
            Button() {
              Row({ space: 5 }) {
                SymbolGlyph($r('sys.symbol.waveform'))
                  .fontSize(13)
                  .fontColor([$r('app.color.km_primary_action')])
                Text(this.interviewAudioChecked ? '再次试听' : '试听声音')
                  .fontSize(10)
                  .fontColor($r('app.color.km_primary_action'))
              }
            }
            .constraintSize({ minHeight: 34 })
            .padding({ left: 10, right: 10 })
            .backgroundColor($r('app.color.km_primary_soft'))
            .borderRadius(7)
            .onClick(() => { void this.speakInterviewPrompt(); })
          }
        }
        .width('100%')
        .padding({ left: 12, right: 12, top: 10, bottom: 10 })
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

        if (!this.interviewStarted) {
          Row({ space: 12 }) {
            Toggle({ type: ToggleType.Switch, isOn: this.modelConsent })
              .selectedColor($r('app.color.km_primary_action'))
              .onChange((value: boolean) => { this.updateModelConsent(value); })
            Column({ space: 3 }) {
              Text('本次训练使用智能增强')
                .fontSize(14)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text('发送前隐藏手机号、邮箱、身份证号和详细地址；模型密钥仅保存在服务端。')
                .fontSize(11)
                .fontColor($r('app.color.km_text_secondary'))
                .lineHeight(18)
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
          }
          .alignItems(VerticalAlign.Top)
          .width('100%')
          .padding(14)
          .backgroundColor(this.modelConsent ? $r('app.color.km_primary_tint') : $r('app.color.km_surface_subtle'))
          .borderRadius(8)
        }

        if (!this.interviewStarted) {
          Row({ space: 8 }) {
            SymbolGlyph($r('sys.symbol.checkmark_shield'))
              .fontSize(14)
              .fontColor([$r('app.color.km_success')])
            Text(this.modelConsent
              ? '回答发送前自动脱敏，外部模型只用于生成岗位化追问。'
              : '当前使用本机规则，简历与回答不会发送到外部服务。')
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(17)
              .layoutWeight(1)
          }
          .alignItems(VerticalAlign.Top)
          .width('100%')
          .padding(12)
          .backgroundColor($r('app.color.km_success_surface'))
          .borderRadius(8)
        }

        if (this.interviewStarted) {
          Column({ space: 10 }) {
            Column({ space: 8 }) {
              Row({ space: 8 }) {
                Text(`${this.interviewType} · ${this.interviewDifficulty}难度`)
                  .fontSize(11)
                  .fontWeight(FontWeight.Medium)
                  .fontColor($r('app.color.km_primary_action'))
                Blank()
                Row({ space: 5 }) {
                  SymbolGlyph($r('sys.symbol.clock'))
                    .fontSize(13)
                    .fontColor([this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_text_secondary')])
                  Text(`${this.formattedInterviewTime()} / ${this.interviewDurationMinutes}:00`)
                    .fontSize(11)
                    .fontWeight(FontWeight.Medium)
                    .fontColor(this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_text_primary'))
                }
              }
              .width('100%')
              Progress({ value: this.interviewProgressValue(), total: 100, type: ProgressType.Linear })
                .width('100%')
                .height(4)
                .color(this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_primary_action'))
                .backgroundColor($r('app.color.km_border'))
              Row({ space: 8 }) {
                Text(`第 ${Math.max(1, this.interviewRound)} 轮 / 3`)
                  .fontSize(10)
                  .fontColor($r('app.color.km_text_secondary'))
                Blank()
                if (this.interviewSessionPhase !== 'completed') {
                  Button() {
                    SymbolGlyph(this.interviewSessionPhase === 'paused'
                      ? $r('sys.symbol.play_fill')
                      : $r('sys.symbol.pause'))
                      .fontSize(17)
                      .fontColor([$r('app.color.km_primary_action')])
                  }
                  .width(38)
                  .height(38)
                  .backgroundColor($r('app.color.km_primary_tint'))
                  .borderRadius(8)
                  .enabled(!this.interviewLoading)
                  .accessibilityText(this.interviewSessionPhase === 'paused' ? '恢复面试' : '暂停面试')
                  .onClick(() => {
                    if (this.interviewSessionPhase === 'paused') this.resumeInterview();
                    else void this.pauseInterview();
                  })
                  Button() {
                    SymbolGlyph($r('sys.symbol.stop_circle'))
                      .fontSize(18)
                      .fontColor([$r('app.color.km_danger')])
                  }
                  .width(38)
                  .height(38)
                  .backgroundColor($r('app.color.km_danger_soft'))
                  .borderRadius(8)
                  .enabled(!this.interviewLoading)
                  .accessibilityText('提前结束面试')
                  .onClick(() => { this.requestEndInterview(); })
                }
              }
              .width('100%')
            }
            .alignItems(HorizontalAlign.Start)
            .width('100%')
            .padding(12)
            .backgroundColor($r('app.color.km_surface_subtle'))
            .borderRadius(8)

            if (this.interviewSessionPhase === 'paused') {
              Row({ space: 10 }) {
                SymbolGlyph(this.interviewTimeExpired ? $r('sys.symbol.clock_fill') : $r('sys.symbol.pause_circle'))
                  .fontSize(23)
                  .fontColor([this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_primary_action')])
                Column({ space: 3 }) {
                  Text(this.interviewTimeExpired ? '设定时长已到' : '面试已暂停')
                    .fontSize(14)
                    .fontWeight(FontWeight.Bold)
                    .fontColor($r('app.color.km_text_primary'))
                  Text(this.interviewTimeExpired ? '加时 5 分钟后可继续当前问题，也可以直接结束并生成反馈。' : '计时和语音均已停止，当前回答草稿会保留。')
                    .fontSize(10)
                    .fontColor($r('app.color.km_text_secondary'))
                    .lineHeight(17)
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)
                Button(this.interviewTimeExpired ? '加时 5 分钟' : '继续')
                  .constraintSize({ minHeight: 36 })
                  .fontSize(11)
                  .fontColor($r('app.color.km_text_on_primary'))
                  .backgroundColor($r('app.color.km_primary_action'))
                  .borderRadius(8)
                  .onClick(() => { this.resumeInterview(); })
              }
              .alignItems(VerticalAlign.Center)
              .width('100%')
              .padding(13)
              .backgroundColor(this.interviewTimeExpired ? $r('app.color.km_warning_soft') : $r('app.color.km_primary_tint'))
              .borderRadius(8)
            }

            Row() {
              Text(`${this.interviewType} · 第 ${Math.max(1, this.interviewRound)} 轮 / 3`)
                .fontSize(12)
                .fontColor($r('app.color.km_primary_action'))
              Blank()
              Text(this.interviewModelName)
                .fontSize(10)
                .fontColor(this.interviewModelName === '本机规则' ? $r('app.color.km_text_muted') : $r('app.color.km_success'))
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .backgroundColor(this.interviewModelName === '本机规则' ? $r('app.color.km_border') : $r('app.color.km_success_soft'))
                .borderRadius(10)
            }
            .width('100%')
            Text(this.interviewQuestion || this.fallbackInterviewQuestion(1))
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
              .lineHeight(25)
            if (this.interviewTurns.length > 0) {
              Text(`已在本机保留 ${this.interviewTurns.length} 轮回答`)
                .fontSize(11)
                .fontColor($r('app.color.km_text_secondary'))
            }
            this.buildFieldLabel('本轮回答', `${this.interviewAnswer.length}/3000 · 至少 20 字`)
            TextArea({ placeholder: '输入真实回答，不要填写无法核验的成果。', text: this.interviewAnswer })
              .constraintSize({ minHeight: 180 })
              .maxLength(3000)
              .backgroundColor($r('app.color.km_surface_subtle'))
              .border({ width: 1, color: this.interviewAnswerError ? $r('app.color.km_danger') : $r('app.color.km_border') })
              .borderRadius(8)
              .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' && this.interviewTurns.length < 3)
              .onChange((value: string) => {
                this.interviewAnswer = value;
                if (this.interviewAnswerTouched) this.interviewAnswerError = this.validateInterviewAnswer(value);
              })
              .onBlur(() => {
                if (this.interviewAnswer.trim()) {
                  this.interviewAnswerTouched = true;
                  this.interviewAnswerError = this.validateInterviewAnswer(this.interviewAnswer);
                }
              })
            NativeFieldError({ message: this.interviewAnswerError })
            if (this.interviewSessionPhase !== 'completed') {
              Row({ space: 8 }) {
                Button(this.interviewSpeaking ? '停止播报' : '朗读问题')
                .layoutWeight(1)
                .constraintSize({ minHeight: 40 })
                .fontSize(12)
                .fontColor(this.interviewSpeaking ? $r('app.color.km_danger') : $r('app.color.km_purple'))
                .backgroundColor(this.interviewSpeaking ? $r('app.color.km_danger_soft') : $r('app.color.km_purple_soft'))
                .borderRadius(8)
                .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
                .onClick(() => {
                  if (this.interviewSpeaking) void this.stopInterviewPrompt();
                  else void this.speakInterviewPrompt();
                })
                Button(this.speechActive ? '停止并填入语音' : '语音回答')
                .layoutWeight(1)
                .constraintSize({ minHeight: 40 })
                .fontSize(12)
                .fontColor(this.speechActive ? $r('app.color.km_text_on_primary') : $r('app.color.km_info'))
                .backgroundColor(this.speechActive ? $r('app.color.km_danger_active') : $r('app.color.km_info_soft'))
                .borderRadius(8)
                .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' && this.interviewTurns.length < 3)
                .onClick(() => { void this.toggleSpeechInput(); })
              }
              .width('100%')
            }
            if (this.interviewSessionPhase !== 'completed' && this.interviewTurns.length < 3) {
              Button(this.interviewLoading ? '正在生成岗位化追问…' : '提交回答并生成追问')
                .width('100%')
                .constraintSize({ minHeight: 46 })
                .fontColor($r('app.color.km_info'))
                .backgroundColor($r('app.color.km_info_soft'))
                .borderRadius(8)
                .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
                .onClick(() => { void this.submitInterviewAnswer(); })
            }
            if (this.interviewSessionPhase !== 'completed') {
              Button(this.interviewLoading ? '正在生成反馈…' : '完成面试并生成反馈')
                .width('100%')
                .constraintSize({ minHeight: 46 })
                .fontColor($r('app.color.km_text_on_primary'))
                .backgroundColor($r('app.color.km_primary_action'))
                .borderRadius(8)
                .enabled(!this.interviewLoading)
                .onClick(() => { void this.finishInterview(); })
            }
            NativeStatusMessage({ message: this.interviewMessage })
            if (this.interviewFeedback) {
              Divider().color($r('app.color.km_border_strong'))
              Text('本轮反馈')
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text(this.interviewFeedback)
                .fontSize(12)
                .fontColor($r('app.color.km_text_muted'))
                .lineHeight(21)
                .width('100%')
              Row({ space: 8 }) {
                Button('查看成长任务')
                  .layoutWeight(1)
                  .constraintSize({ minHeight: 40 })
                  .fontSize(12)
                  .fontColor($r('app.color.km_success'))
                  .backgroundColor($r('app.color.km_success_soft'))
                  .borderRadius(8)
                  .onClick(() => { this.requestTabChange(4); })
                Button('重新开始')
                  .layoutWeight(1)
                  .constraintSize({ minHeight: 40 })
                  .fontSize(12)
                  .fontColor($r('app.color.km_text_muted'))
                  .backgroundColor($r('app.color.km_border'))
                  .borderRadius(8)
                  .onClick(() => { this.requestResetInterview(); })
              }
              .width('100%')
            }
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(18)
          .backgroundColor($r('app.color.km_surface'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
        }
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 14, bottom: 18 })
        .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
        .alignSelf(ItemAlign.Center)
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)

      if (!this.interviewStarted) {
        Column() {
          this.buildInterviewLaunchBar()
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 9, bottom: 9 })
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: { top: 1 }, color: $r('app.color.km_border') })
      }
    }
    .width('100%')
    .layoutWeight(1)
  }

  @Builder
  private buildGrowth(): void {
    Scroll() {
      Column({ space: 12 }) {
        this.buildPageHeading('行动计划', '成长计划', `围绕“${this.targetJob}”把岗位缺口拆成可执行、可提交、可复盘的任务。`)

        Row({ space: 10 }) {
          NativeMetricCard({ label: '当前实证覆盖', value: `${this.empiricalCoverage}%`, detail: '通过审核后更新' })
          NativeMetricCard({ label: '完成后预测', value: `${this.projectedCoverage}%`, detail: '预测不等于掌握' })
        }
        .width('100%')

        if (this.growthTasks.length > 0) {
          Column({ space: 8 }) {
            Row() {
              Column({ space: 2 }) {
                Text('行动进度')
                  .fontSize(13)
                  .fontWeight(FontWeight.Bold)
                  .fontColor($r('app.color.km_text_primary'))
                Text('一次只推进一个任务，提交可访问来源后进入下一项。')
                  .fontSize(9)
                  .fontColor($r('app.color.km_text_secondary'))
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              Text(`${this.verifiedGrowthTaskCount()} / ${this.growthTasks.length}`)
                .fontSize(13)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_primary_action'))
            }
            .width('100%')
            Progress({ value: this.verifiedGrowthTaskCount(), total: this.growthTasks.length, type: ProgressType.Linear })
              .width('100%')
              .height(5)
              .color($r('app.color.km_success'))
              .backgroundColor($r('app.color.km_border'))
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(13)
          .backgroundColor($r('app.color.km_surface'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
        }

        if (this.growthTasks.length === 0) {
          Column({ space: 10 }) {
            Text('还没有成长计划')
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text('先完成一次岗位面试，系统会根据岗位证据和回答表现生成任务。')
              .fontSize(13)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(20)
            Button('开始岗位面试')
              .width('100%')
              .constraintSize({ minHeight: 44 })
              .fontColor($r('app.color.km_text_on_primary'))
              .backgroundColor($r('app.color.km_primary_action'))
              .borderRadius(8)
              .onClick(() => { this.requestTabChange(3); })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(18)
          .backgroundColor($r('app.color.km_surface'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
        } else {
          this.buildSectionHeading('行动队列', '先完成当前任务并核验证据，后续任务会按顺序解锁。')
          NativeEvidenceLedger({
            tasks: this.growthTasks,
            records: this.growthEvidenceRecords,
            evidenceDraft: this.evidenceDraft,
            evidenceSourceUrl: this.evidenceSourceUrl,
            evidenceConfirmed: this.evidenceConfirmed,
            evidenceChecking: this.evidenceChecking,
            evidenceDraftError: this.growthDraftError,
            evidenceSourceError: this.growthSourceError,
            onDraftChange: (value: string) => {
              this.evidenceDraft = value;
              if (this.growthDraftTouched) this.growthDraftError = this.validateGrowthDraft(value);
            },
            onSourceChange: (value: string) => {
              this.evidenceSourceUrl = value;
              if (this.growthSourceTouched) this.growthSourceError = this.validateGrowthSource(value);
            },
            onConfirmedChange: (value: boolean) => { this.evidenceConfirmed = value; },
            onSubmitEvidence: () => { void this.submitGrowthEvidence(); },
            onOpenSource: (sourceUrl: string) => { void this.openGrowthEvidenceSource(sourceUrl); },
            onRevokeEvidence: (taskId: string) => { this.requestRevokeGrowthEvidence(taskId); },
          })
        }

        NativeStatusMessage({ message: this.growthMessage })
        if (this.growthHistory.length > 0) {
          Column({ space: 7 }) {
            Text('实证变化记录')
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            ForEach(this.growthHistory.slice(0, 5), (item: string) => {
              Text(`• ${item}`)
                .fontSize(12)
                .fontColor($r('app.color.km_text_secondary'))
                .lineHeight(19)
                .width('100%')
            }, (item: string, index: number) => `${index}-${item}`)
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(16)
          .backgroundColor($r('app.color.km_primary_tint'))
          .borderRadius(8)
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 24 })
      .constraintSize({ maxWidth: this.isWideLayout ? 1040 : '100%' })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildNavigationIcon(icon: Resource, tab: number): void {
    Badge({
      count: this.navigationHasPendingAction(tab) ? this.pendingActionCount() : 0,
      maxCount: 9,
      position: { x: 21, y: -2 },
      style: {
        color: $r('app.color.km_text_on_primary'),
        fontSize: 7,
        badgeSize: 15,
        badgeColor: $r('app.color.km_warning'),
      },
    }) {
      Stack() {
        SymbolGlyph(icon)
          .fontSize(19)
          .maxFontScale(1.35)
          .fontColor([this.activeTab === tab ? $r('app.color.km_primary_emphasis') : $r('app.color.km_text_secondary')])
      }
      .width(28)
      .height(25)
      .alignContent(Alignment.Center)
    }
  }

  @Builder
  private buildNavigationItem(icon: Resource, label: string, tab: number): void {
    Button() {
      Column({ space: 2 }) {
        Blank()
          .width(24)
          .height(3)
          .backgroundColor(this.activeTab === tab ? $r('app.color.km_primary') : $r('app.color.km_transparent'))
          .borderRadius(2)
        this.buildNavigationIcon(icon, tab)
        Text(label)
          .fontSize(9)
          .fontWeight(this.activeTab === tab ? FontWeight.Medium : FontWeight.Regular)
          .fontColor(this.activeTab === tab ? $r('app.color.km_primary_emphasis') : $r('app.color.km_text_secondary'))
          .maxLines(1)
      }
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .width('100%')
      .height(54)
      .padding({ left: 6, right: 6, top: 2, bottom: 3 })
    }
    .layoutWeight(1)
    .height(54)
    .padding(0)
    .backgroundColor($r('app.color.km_transparent'))
    .borderRadius(0)
    .accessibilityText(this.navigationAccessibilityText(label, tab))
    .animation({ duration: 180, curve: Curve.EaseOut })
    .onClick(() => { this.requestTabChange(tab); })
  }

  @Builder
  private buildBottomNavigation(): void {
    Column() {
      Divider()
        .color($r('app.color.km_border'))
        .strokeWidth(1)
      Row({ space: 2 }) {
        this.buildNavigationItem($r('sys.symbol.house'), '首页', 0)
        this.buildNavigationItem($r('sys.symbol.doc_text'), '简历', 1)
        this.buildNavigationItem($r('sys.symbol.briefcase'), '岗位', 2)
        this.buildNavigationItem($r('sys.symbol.mic'), '面试', 3)
        this.buildNavigationItem($r('sys.symbol.ranking'), '成长', 4)
      }
      .width('100%')
      .padding({ left: 8, right: 8, top: 2, bottom: 7 })
    }
    .width('100%')
    .backgroundColor($r('app.color.km_surface'))
  }

  @Builder
  private buildRailNavigationItem(icon: Resource, label: string, tab: number): void {
    Button() {
      Row({ space: 8 }) {
        Blank()
          .width(3)
          .height(28)
          .backgroundColor(this.activeTab === tab ? $r('app.color.km_primary') : $r('app.color.km_transparent'))
          .borderRadius(2)
        this.buildNavigationIcon(icon, tab)
        Text(label)
          .fontSize(11)
          .fontWeight(this.activeTab === tab ? FontWeight.Medium : FontWeight.Regular)
          .fontColor(this.activeTab === tab ? $r('app.color.km_primary') : $r('app.color.km_text_secondary'))
          .maxFontScale(1.6)
          .layoutWeight(1)
      }
      .width('100%')
    }
    .width('100%')
    .constraintSize({ minHeight: 52 })
    .padding(0)
    .padding({ left: 8, right: 10 })
    .backgroundColor(this.activeTab === tab ? $r('app.color.km_primary_tint') : $r('app.color.km_transparent'))
    .borderRadius(6)
    .accessibilityText(this.navigationAccessibilityText(label, tab))
    .animation({ duration: 180, curve: Curve.EaseOut })
    .onClick(() => { this.requestTabChange(tab); })
  }

  @Builder
  private buildRailNavigation(): void {
    Column({ space: 6 }) {
      Text('工作区')
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
        .width('100%')
        .padding({ left: 12, bottom: 4 })
      this.buildRailNavigationItem($r('sys.symbol.house'), '首页', 0)
      this.buildRailNavigationItem($r('sys.symbol.doc_text'), '简历', 1)
      this.buildRailNavigationItem($r('sys.symbol.briefcase'), '岗位', 2)
      this.buildRailNavigationItem($r('sys.symbol.mic'), '面试', 3)
      this.buildRailNavigationItem($r('sys.symbol.ranking'), '成长', 4)
      Blank()
    }
    .width(116)
    .height('100%')
    .padding({ left: 10, right: 10, top: 14, bottom: 14 })
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: { right: 1 }, color: $r('app.color.km_border') })
  }

  @Builder
  private buildUnsavedChangesBar(): void {
    Row({ space: 10 }) {
      Column()
        .width(3)
        .height(38)
        .backgroundColor($r('app.color.km_warning'))
        .borderRadius(2)
      SymbolGlyph($r('sys.symbol.exclamationmark_circle'))
        .fontSize(17)
        .maxFontScale(1.35)
        .fontColor([$r('app.color.km_warning')])
      Column({ space: 3 }) {
        Text('未保存修改')
          .fontSize(9)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_warning'))
          .width('100%')
        Text(`${this.unsavedChangeLabel()}尚未写入本机`)
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_text_primary'))
          .lineHeight(17)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Button(this.unsavedChangeCount() > 1 ? '逐项保存' : '保存')
        .constraintSize({ minHeight: 36 })
        .padding({ left: 12, right: 12 })
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_on_primary'))
        .backgroundColor($r('app.color.km_warning'))
        .borderRadius(8)
        .accessibilityText(`保存${this.unsavedChangeLabel()}修改`)
        .onClick(() => { this.savePendingDraft(); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .padding({ left: 16, right: 16, top: 9, bottom: 9 })
    .backgroundColor($r('app.color.km_warning_soft'))
    .border({ width: { bottom: 1 }, color: $r('app.color.km_warning') })
  }

  @Builder
  private buildTaskContinuityBar(): void {
    Row({ space: 10 }) {
      Column()
        .width(3)
        .height(38)
        .backgroundColor($r('app.color.km_primary'))
        .borderRadius(2)
      Column({ space: 3 }) {
        Text(`下一行动 · ${this.primaryActionDestinationLabel()}`)
          .fontSize(9)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_primary'))
          .width('100%')
        Text(this.primaryNextAction())
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_text_primary'))
          .lineHeight(17)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Button() {
        Row({ space: 3 }) {
          Text('继续')
            .fontSize(10)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_primary_emphasis'))
            .maxFontScale(1.5)
          SymbolGlyph($r('sys.symbol.chevron_right'))
            .fontSize(13)
            .fontColor([$r('app.color.km_primary_emphasis')])
        }
      }
      .constraintSize({ minHeight: 36 })
      .padding({ left: 10, right: 8 })
      .backgroundColor($r('app.color.km_primary_soft'))
      .borderRadius(8)
      .onClick(() => { this.requestTabChange(this.primaryActionTab()); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .padding({ left: 16, right: 16, top: 9, bottom: 9 })
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
  }

  @Builder
  private buildActivePage(): void {
    if (this.activeTab === 0) {
      this.buildHome()
    } else if (this.activeTab === 1) {
      this.buildResume()
    } else if (this.activeTab === 2) {
      this.buildJobs()
    } else if (this.activeTab === 3) {
      this.buildInterview()
    } else {
      this.buildGrowth()
    }
  }

  @Builder
  private buildWorkspaceContent(): void {
    Column() {
      if (this.hasUnsavedChanges()) {
        this.buildUnsavedChangesBar()
      } else if (this.activeTab !== 0 && this.activeTab !== this.primaryActionTab()) {
        this.buildTaskContinuityBar()
      }
      this.buildActivePage()
    }
    .width('100%')
    .layoutWeight(1)
  }

  @Builder
  private buildGlobalNotice(): void {
    Column() {
      NativeGlobalNotice({
        message: this.globalNoticeMessage,
        tone: this.globalNoticeTone,
        onDismiss: () => { this.dismissGlobalNotice(); },
      })
    }
    .width('100%')
    .constraintSize({ maxWidth: this.isWideLayout ? 680 : '100%' })
    .padding({ left: 16, right: 16, bottom: this.isWideLayout ? 18 : 82 })
    .align(Alignment.Bottom)
    .zIndex(20)
  }

  build() {
    Stack() {
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor($r('app.color.km_page_background'))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      if (this.showIntro) {
        this.buildIntro()
      } else if (this.isImmersiveInterviewSession()) {
        this.buildImmersiveInterview()
      } else {
        Column() {
          this.buildHeader()
          if (this.workspaceLoading || this.workspaceLoadFailed) {
            this.buildWorkspaceState()
          } else if (this.showDataCenter) {
            this.buildDataCenter()
          } else if (this.isWideLayout) {
            Row() {
              this.buildRailNavigation()
              this.buildWorkspaceContent()
            }
            .width('100%')
            .layoutWeight(1)
          } else {
            this.buildWorkspaceContent()
            this.buildBottomNavigation()
          }
        }
        .width('100%')
        .height('100%')
        .backgroundColor($r('app.color.km_page_background'))
      }
      if (this.globalNoticeMessage) {
        this.buildGlobalNotice()
      }
    }
    .width('100%')
    .height('100%')
  }
}
