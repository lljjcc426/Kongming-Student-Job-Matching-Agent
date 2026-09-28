import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { KeyboardAvoidMode, mediaquery, window } from '@kit.ArkUI';
import { fileIo, fileUri, picker } from '@kit.CoreFileKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { loadCareerFormData, saveCareerFormData, updateAllCareerForms } from '../common/CareerFormStore';
import {
  NativeAiResult,
  NativeAiService,
  NativeInterviewEvaluation,
  NativeInterviewFeedbackResult,
} from '../common/NativeAiService';
import { NativeAvatarState } from '../common/NativeAvatarProfile';
import { NativeCapabilityService } from '../common/NativeCapabilityService';
import { NativeCalendarService } from '../common/NativeCalendarService';
import { NativeEvidenceService, NativeEvidenceSourceResult } from '../common/NativeEvidenceService';
import { CoreSpeechInterviewProvider, NativeInterviewSpeechProvider } from '../common/NativeInterviewSpeechProvider';
import {
  NativeJobPreferenceProfile,
  NativeJobRecommendationService,
} from '../common/NativeJobRecommendationService';
import { NativeJobFeed, NativeJobService, NativePublicJob } from '../common/NativeJobService';
import { NativeJobMaterialService } from '../common/NativeJobMaterialService';
import { NativeResumePdfService } from '../common/NativeResumePdfService';
import { NativeResumePdfInput, NativeResumePdfPage } from '../common/NativeResumeLayoutService';
import { NativeApplicationTracker } from '../components/NativeApplicationTracker';
import { NativeApplicationListItem } from '../common/NativeApplicationWorkspaceService';
import { NativeApplicationWorkspace } from '../components/NativeApplicationWorkspace';
import { NativeInterviewHistoryService } from '../common/NativeInterviewHistoryService';
import { NativeInterviewHistoryWorkspace } from '../components/NativeInterviewHistoryWorkspace';
import { NativeCandidateCamera } from '../components/NativeCandidateCamera';
import { NativeDigitalInterviewer } from '../components/NativeDigitalInterviewer';
import { NativeEvidenceLedger } from '../components/NativeEvidenceLedger';
import { NativeJobMaterialWorkspace } from '../components/NativeJobMaterialWorkspace';
import { NativeResumePdfPreview } from '../components/NativeResumePdfPreview';
import { NativeResumeVersionPanel } from '../components/NativeResumeVersionPanel';
import {
  createNativeApplicationStageOptions,
  createDefaultNativeJobEvidence,
  NativeApplicationEvent,
  NativeApplicationStageOption,
  NativeGrowthEvidenceRecord,
  NativeGrowthTask,
  NativeInterviewCompetencyResult,
  NativeInterviewSessionRecord,
  NativeInterviewTurn,
  NativeJobFeedbackRecord,
  NativeJobMaterialRecord,
  NativeJobStory,
  NativeJobEvidence,
  NativeResumeVersion,
  NativeTrackedJobRecord,
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

class NativeInterviewAssessment {
  overallScore: number;
  structureScore: number;
  evidenceScore: number;
  relevanceScore: number;
  clarityScore: number;
  strongestLabel: string;
  priorityLabel: string;
  evidenceLabel: string;
  assessmentSource: string;
  assessmentVersion: string;
  evidenceReferences: string[];
  improvedAnswer: string;

  constructor(
    overallScore: number,
    structureScore: number,
    evidenceScore: number,
    relevanceScore: number,
    clarityScore: number,
    strongestLabel: string,
    priorityLabel: string,
    evidenceLabel: string,
    assessmentSource: string = '基础训练评估',
    assessmentVersion: string = 'local-v1',
    evidenceReferences: string[] = [],
    improvedAnswer: string = '',
  ) {
    this.overallScore = overallScore;
    this.structureScore = structureScore;
    this.evidenceScore = evidenceScore;
    this.relevanceScore = relevanceScore;
    this.clarityScore = clarityScore;
    this.strongestLabel = strongestLabel;
    this.priorityLabel = priorityLabel;
    this.evidenceLabel = evidenceLabel;
    this.assessmentSource = assessmentSource;
    this.assessmentVersion = assessmentVersion;
    this.evidenceReferences = evidenceReferences;
    this.improvedAnswer = improvedAnswer;
  }
}

class NativeInterviewCompetency {
  key: string;
  label: string;
  detail: string;

  constructor(key: string, label: string, detail: string) {
    this.key = key;
    this.label = label;
    this.detail = detail;
  }
}

class NativeJobReadinessItem {
  key: string;
  label: string;
  detail: string;
  isComplete: boolean;
  actionLabel: string;

  constructor(key: string, label: string, detail: string, isComplete: boolean, actionLabel: string) {
    this.key = key;
    this.label = label;
    this.detail = detail;
    this.isComplete = isComplete;
    this.actionLabel = actionLabel;
  }
}

const NATIVE_STORE_NAME: string = 'kongming_native_workspace';
const NATIVE_APPLICATION_STAGES: NativeApplicationStageOption[] = createNativeApplicationStageOptions();
const NATIVE_PREFERRED_EMPLOYERS: string[] = ['腾讯', '字节跳动', '网易', '百度', '华为', '阿里巴巴'];
const NATIVE_EMPLOYMENT_TYPES: string[] = ['不限', '实习', '校招', '社招'];
const LAYOUT_SIZE_COMPACT: string = 'compact';
const LAYOUT_SIZE_MEDIUM: string = 'medium';
const LAYOUT_SIZE_EXPANDED: string = 'expanded';

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
  private jobRecommendationService: NativeJobRecommendationService = new NativeJobRecommendationService();
  private materialService: NativeJobMaterialService = new NativeJobMaterialService();
  private resumePdfService: NativeResumePdfService = new NativeResumePdfService();
  private savedJobMaterial: NativeJobMaterialRecord = new NativeJobMaterialRecord();
  private aiService: NativeAiService = new NativeAiService(this.hostContext);
  private evidenceService: NativeEvidenceService = new NativeEvidenceService();
  private calendarService: NativeCalendarService = new NativeCalendarService(this.hostContext);
  private mediumScreenQuery?: mediaquery.MediaQueryListener;
  private expandedScreenQuery?: mediaquery.MediaQueryListener;
  @StorageProp('FormRouteRequest') @Watch('onFormRouteRequestChanged') formRouteRequest: string = '';
  @State activeTab: number = 0;
  @State layoutSizeClass: string = LAYOUT_SIZE_COMPACT;
  @State resumeName: string = '';
  @State targetJob: string = '前端开发实习生';
  @State trackedJobRecords: NativeTrackedJobRecord[] = [];
  @State jobsSection: number = 0;
  private jobsSearchEditing: boolean = false;
  @State showTrackedJobDetail: boolean = false;
  @State showJobComparison: boolean = false;
  @State trackedJobSearch: string = '';
  @State trackedJobStageFilter: string = 'active';
  @State trackedJobSort: string = 'schedule';
  @State applicationWorkspaceNow: number = Date.now();
  private jobsScroller: Scroller = new Scroller();
  @State jobCompareKeys: string[] = [];
  @State jobMaterialRecords: NativeJobMaterialRecord[] = [];
  @State showJobMaterials: boolean = false;
  @State jobMaterialDraft: NativeJobMaterialRecord = new NativeJobMaterialRecord();
  @State jobMaterialDirty: boolean = false;
  @State jobMaterialSaving: boolean = false;
  @State jobMaterialMessage: string = '';
  @State jobMaterialResumeError: string = '';
  @State jobMaterialSection: number = 0;
  @State jobMaterialPdfPath: string = '';
  @State jobMaterialPdfPages: NativeResumePdfPage[] = [];
  private jobMaterialPdfFileName: string = '';
  @State activeTrackedJobKey: string = '';
  @State creatingTrackedJob: boolean = false;
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
  @State growthHistoryJobKeys: string[] = [];
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
  @State jobEmployer: string = '';
  @State jobPreferredCities: string = '';
  @State jobPreferredEmploymentType: string = '不限';
  @State jobGraduationYear: string = '';
  @State jobSalaryExpectation: string = '';
  @State jobPreferredIndustries: string = '';
  @State jobPreferredCompanies: string = '';
  @State jobFeedbackRecords: NativeJobFeedbackRecord[] = [];
  @State showJobPreferences: boolean = false;
  @State publicJobs: NativePublicJob[] = [];
  @State publicJobsLoading: boolean = false;
  @State publicJobsConfigured: boolean = false;
  @State publicJobsStale: boolean = false;
  @State publicJobsSearched: boolean = false;
  @State publicJobsFailed: boolean = false;
  @State publicJobsTotal: number = 0;
  @State publicJobsMessage: string = '输入关键词搜索国内企业官网公开岗位，也可以手动添加目标岗位。';
  @State selectedPublicJobIndex: number = -1;
  @State interviewType: string = '综合面';
  @State interviewStarted: boolean = false;
  @State interviewQuestion: string = '';
  @State interviewRound: number = 0;
  @State interviewTurns: NativeInterviewTurn[] = [];
  @State interviewAnswer: string = '';
  @State interviewMessage: string = '';
  @State interviewFeedback: string = '';
  @State interviewModelName: string = '标准题库';
  @State interviewLoading: boolean = false;
  @State interviewDifficulty: string = '标准';
  @State interviewDurationMinutes: number = 15;
  @State interviewElapsedSeconds: number = 0;
  @State interviewSessionPhase: string = 'setup';
  @State interviewTimeExpired: boolean = false;
  @State interviewKeyboardVisible: boolean = false;
  @State interviewTextFallbackVisible: boolean = false;
  @State interviewInputNotice: string = '';
  @State modelConsent: boolean = false;
  @State profileMessage: string = '数据默认保存在本机，可随时修改或清除。';
  @State authSignedIn: boolean = false;
  @State authDisplayName: string = '';
  @State nativeMessage: string = '正在检查账号状态。';
  @State speechActive: boolean = false;
  @State interviewSpeaking: boolean = false;
  @State interviewAvatarState: NativeAvatarState = 'idle';
  @State interviewSpeechMessage: string = '面试官已就绪';
  @State interviewAudioChecked: boolean = false;
  @State interviewTranscriptExpanded: boolean = false;
  @State interviewSessions: NativeInterviewSessionRecord[] = [];
  @State currentInterviewSessionId: string = '';
  @State currentInterviewVideoUri: string = '';
  @State currentInterviewVideoDurationSeconds: number = 0;
  @State currentInterviewVideoSizeBytes: number = 0;
  @State candidateVideoRecording: boolean = false;
  @State interviewSection: number = 0;
  @State interviewHistorySearch: string = '';
  @State interviewHistoryScope: string = 'current';
  @State interviewHistoryKind: string = 'all';
  @State interviewHistoryRecordId: string = '';
  @State interviewHistoryCompareIds: string[] = [];
  @State interviewHistoryComparing: boolean = false;
  private interviewHistorySearchEditing: boolean = false;
  private interviewHistoryService: NativeInterviewHistoryService = new NativeInterviewHistoryService();
  @State interviewAssessment: NativeInterviewAssessment = new NativeInterviewAssessment(
    0, 0, 0, 0, 0, '', '', '',
  );
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
  private previousTrackedJobKey: string = '';
  private interviewTimer: number = -1;
  private interviewSessionUpdatedAt: number = 0;
  private interviewWindowImmersive: boolean = false;
  private interviewMainWindow: window.Window | undefined = undefined;
  private interviewKeyboardDismissedAt: number = 0;
  private speechAnswerPrefix: string = '';

  aboutToAppear(): void {
    this.speechProvider.setLifecycleListener((state, message) => {
      this.interviewSpeaking = state === 'speaking';
      this.nativeMessage = message;
      if (state === 'speaking') {
        this.interviewAudioChecked = true;
        this.interviewAvatarState = 'talking';
        this.interviewSpeechMessage = '面试官正在提问';
      } else if (this.speechActive) {
        this.interviewAvatarState = 'listening';
        this.interviewSpeechMessage = '正在聆听你的回答';
      } else {
        this.interviewAvatarState = 'idle';
        this.interviewSpeechMessage = this.interviewStarted ? '轮到你回答' : '面试官已就绪';
      }
    });
    this.speechProvider.setRecognitionErrorListener((message) => {
      this.speechActive = false;
      this.interviewAvatarState = 'idle';
      this.interviewInputNotice = message;
      this.interviewSpeechMessage = message;
      this.nativeMessage = message;
    });
    this.speechProvider.setRecognitionResultListener((text, isFinal) => {
      const transcript = text.trim();
      if (!transcript) return;
      this.interviewInputNotice = '';
      this.interviewAnswer = this.speechAnswerPrefix
        ? `${this.speechAnswerPrefix}\n${transcript}`
        : transcript;
      if (this.interviewAnswerTouched) this.interviewAnswerError = this.validateInterviewAnswer(this.interviewAnswer);
      this.interviewSpeechMessage = isFinal ? '已识别当前语句，可继续补充' : '正在实时转写';
    });
    this.uiContext.setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    void this.bindInterviewWindowEvents();
    this.mediumScreenQuery = this.uiContext.getMediaQuery().matchMediaSync('(width >= 600vp)');
    this.expandedScreenQuery = this.uiContext.getMediaQuery().matchMediaSync('(width >= 960vp)');
    this.refreshLayoutSizeClass();
    this.mediumScreenQuery.on('change', (_result: mediaquery.MediaQueryResult) => {
      this.refreshLayoutSizeClass();
    });
    this.expandedScreenQuery.on('change', (_result: mediaquery.MediaQueryResult) => {
      this.refreshLayoutSizeClass();
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
    this.mediumScreenQuery?.off('change');
    this.expandedScreenQuery?.off('change');
    this.unbindInterviewWindowEvents();
    this.stopInterviewTimer();
    if (this.interviewSessionPhase === 'active') void this.saveWorkspace();
    this.speechProvider.setLifecycleListener(undefined);
    this.speechProvider.setRecognitionErrorListener(undefined);
    this.speechProvider.setRecognitionResultListener(undefined);
    void this.speechProvider.stopSpeaking();
  }

  onBackPress(): boolean {
    if (this.jobMaterialPdfPath) {
      if (!this.jobMaterialSaving) this.closeMaterialPdfPreview();
      return true;
    }
    if (this.activeTab === 2 && this.jobsSearchEditing && !this.showTrackedJobDetail && !this.showJobComparison) {
      this.jobsSearchEditing = false;
      this.uiContext.getFocusController().clearFocus();
      return true;
    }
    if (this.interviewTextFallbackVisible || this.interviewKeyboardVisible ||
      Date.now() - this.interviewKeyboardDismissedAt < 800) {
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
    if (this.showJobMaterials) {
      this.closeJobMaterials();
      return true;
    }
    if (this.selectedPublicJobIndex >= 0) {
      this.selectedPublicJobIndex = -1;
      return true;
    }
    if (this.activeTab === 2 && (this.showTrackedJobDetail || this.showJobComparison)) {
      this.requestJobsSection(1);
      return true;
    }
    if (this.activeTab === 3 && this.interviewSection === 1) {
      this.backFromInterviewHistory();
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

  private refreshLayoutSizeClass(): void {
    if (this.expandedScreenQuery?.matches) {
      this.layoutSizeClass = LAYOUT_SIZE_EXPANDED;
    } else if (this.mediumScreenQuery?.matches) {
      this.layoutSizeClass = LAYOUT_SIZE_MEDIUM;
    } else {
      this.layoutSizeClass = LAYOUT_SIZE_COMPACT;
    }
  }

  private refreshLayoutSizeClassForWidth(width: number): void {
    if (width >= 960) {
      this.layoutSizeClass = LAYOUT_SIZE_EXPANDED;
    } else if (width >= 600) {
      this.layoutSizeClass = LAYOUT_SIZE_MEDIUM;
    } else {
      this.layoutSizeClass = LAYOUT_SIZE_COMPACT;
    }
  }

  private isCompactLayout(): boolean {
    return this.layoutSizeClass === LAYOUT_SIZE_COMPACT;
  }

  private isExpandedLayout(): boolean {
    return this.layoutSizeClass === LAYOUT_SIZE_EXPANDED;
  }

  private pageMaxWidth(): number {
    return this.isExpandedLayout() ? 1240 : 920;
  }

  private pageHorizontalPadding(): number {
    if (this.isExpandedLayout()) return 28;
    return this.isCompactLayout() ? 16 : 20;
  }

  private navigationRailWidth(): number {
    return this.isExpandedLayout() ? 148 : 120;
  }

  private interviewerPreviewHeight(): number {
    if (this.isExpandedLayout()) return 320;
    if (!this.isCompactLayout()) return 270;
    return this.interviewStarted ? 220 : 184;
  }

  private interviewOverlayMaxWidth(): number {
    if (this.isExpandedLayout()) return 920;
    return this.isCompactLayout() ? 540 : 760;
  }

  private candidateCameraWidth(): number {
    if (this.isExpandedLayout()) return 216;
    return this.isCompactLayout() ? 136 : 176;
  }

  private candidateCameraHeight(): number {
    if (this.isExpandedLayout()) return 144;
    return this.isCompactLayout() ? 91 : 117;
  }

  private immersiveSidePanelWidth(): number {
    if (this.isExpandedLayout()) return 480;
    return this.isCompactLayout() ? 300 : 410;
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
    return this.resumeDirty || this.jobEditorDirty || this.applicationScheduleDirty || this.jobMaterialDirty;
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
    if (this.jobMaterialDirty) labels.push('岗位材料');
    return labels.join('、');
  }

  private unsavedChangeCount(): number {
    let count = 0;
    if (this.resumeDirty) count += 1;
    if (this.jobEditorDirty) count += 1;
    if (this.applicationScheduleDirty) count += 1;
    if (this.jobMaterialDirty) count += 1;
    return count;
  }

  private savePendingDraft(): void {
    if (this.jobMaterialDirty) {
      void this.saveJobMaterials();
      return;
    }
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
    if (this.jobMaterialDirty) {
      this.jobMaterialDraft = this.materialService.cloneRecord(this.savedJobMaterial);
      this.jobMaterialDirty = false;
    }
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

  private performTabChange(tab: number, openCurrentJob: boolean = false): void {
    this.uiContext.getFocusController().clearFocus();
    this.jobsSearchEditing = false;
    this.interviewHistorySearchEditing = false;
    if (tab === 2) {
      this.selectedPublicJobIndex = -1;
      this.applicationWorkspaceNow = Date.now();
      if (openCurrentJob) {
        this.jobsSection = 1;
        this.showTrackedJobDetail = this.trackedJobs > 0;
        this.showJobComparison = false;
      }
    }
    this.showDataCenter = false;
    this.showJobMaterials = false;
    this.closeMaterialPdfPreview();
    this.activeTab = tab;
    if (tab === 3 && this.isImmersiveInterviewSession()) void this.setInterviewWindowMode(true);
  }

  private requestTabChange(tab: number, openCurrentJob: boolean = false): void {
    if (tab === this.activeTab) {
      if (this.showJobMaterials) {
        this.closeJobMaterials();
      } else if (tab === 2 && openCurrentJob) {
        this.jobsSection = 1;
        this.showTrackedJobDetail = this.trackedJobs > 0;
        this.showJobComparison = false;
      }
      return;
    }
    if (this.jobMaterialSaving) {
      this.showGlobalNotice('材料正在保存，请稍候。', 'info');
      return;
    }
    if (this.isImmersiveInterviewSession() && tab !== 3) {
      this.requestEndInterview();
      return;
    }
    if (!this.hasUnsavedChanges()) {
      this.performTabChange(tab, openCurrentJob);
      return;
    }
    this.showConfirmDialog(
      '放弃未保存修改？',
      `${this.unsavedChangeLabel()}尚未保存。离开后将恢复上次保存内容。`,
      '放弃并离开',
      () => {
        this.discardUnsavedChanges();
        this.performTabChange(tab, openCurrentJob);
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
        message: '操作未完成，请稍后重试。',
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
      this.nativeMessage = '账号状态暂时无法读取，可稍后重试。';
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
      `待完成成长任务：${this.activeGrowthTasks().filter((task: NativeGrowthTask) => task.status !== 'verified').length}`,
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
      this.interviewSpeechMessage = '请阅读屏幕上的问题并继续作答';
    } else {
      this.interviewAudioChecked = true;
    }
  }

  private async stopInterviewPrompt(): Promise<void> {
    this.interviewAvatarState = 'interrupted';
    const result = this.parseNativeResult(await this.speechProvider.stopSpeaking());
    this.interviewSpeaking = false;
    this.interviewAvatarState = this.speechActive ? 'listening' : 'idle';
    this.interviewSpeechMessage = this.speechActive ? '正在聆听你的回答' : '轮到你回答';
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
      this.speechAnswerPrefix = this.interviewAnswer.trim();
      const result = this.parseNativeResult(await this.speechProvider.startListening());
      this.speechActive = result.ok === true;
      this.interviewAvatarState = this.speechActive ? 'listening' : 'idle';
      this.interviewInputNotice = this.speechActive ? '' :
        (result.message || '语音暂不可用，请重试或使用文字回答。');
      this.interviewSpeechMessage = this.speechActive ? '正在聆听你的回答' : this.interviewInputNotice;
      this.nativeMessage = result.message;
      return;
    }

    this.interviewAvatarState = 'thinking';
    this.interviewSpeechMessage = '正在整理语音回答';
    const result = this.parseNativeResult(await this.speechProvider.stopListening());
    this.speechActive = false;
    if (result.text && result.text.trim()) {
      this.interviewAnswer = this.speechAnswerPrefix
        ? `${this.speechAnswerPrefix}\n${result.text.trim()}`
        : result.text.trim();
      if (this.interviewAnswerTouched) this.interviewAnswerError = this.validateInterviewAnswer(this.interviewAnswer);
    }
    this.interviewAvatarState = 'idle';
    this.speechAnswerPrefix = '';
    this.interviewInputNotice = result.ok === true ? '' :
      (result.message || '没有听清，请重试或使用文字回答。');
    this.interviewSpeechMessage = result.ok === true ? '回答已记录，确认后提交' : this.interviewInputNotice;
    this.nativeMessage = result.message;
  }

  private openInterviewTextAnswer(): void {
    if (this.interviewSpeaking) void this.stopInterviewPrompt();
    if (this.speechActive) void this.toggleSpeechInput();
    this.interviewInputNotice = '';
    this.interviewTextFallbackVisible = true;
  }

  private async recognizeSelectedResumeUri(uri: string): Promise<void> {
    this.profileMessage = '已选择图片，正在本机识别文字。';
    const result = this.parseNativeResult(await this.nativeService.recognizeResumeImageUri(uri));
    if (result.ok && result.text && result.text.trim()) {
      this.resumeSummary = this.resumeSummary.trim()
        ? `${this.resumeSummary.trim()}\n${result.text.trim()}`
        : result.text.trim();
      this.updateResumeDirtyState();
      if (this.resumeSummaryTouched) this.resumeSummaryError = this.validateResumeSummary(this.resumeSummary);
      this.profileMessage = '已提取图片文字，请确认内容后保存画像。';
    } else {
      this.profileMessage = result.message || '未识别到有效文字，请改用文字输入。';
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
      this.profileMessage = '图片识别暂时不可用，请改用文字输入。';
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
      this.profileMessage = '文件识别暂时不可用，请改用文字输入。';
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
    this.refreshPublicJobRanking();
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

  private normalizeTrackedJobRecord(record: NativeTrackedJobRecord): NativeTrackedJobRecord {
    const key = record.key || this.buildTrackedJobKey(record.title || '', record.company || '', record.source || '');
    const now = new Date().toLocaleString('zh-CN');
    const createdAt = record.createdAt || record.applicationUpdatedAt || now;
    return new NativeTrackedJobRecord(
      key,
      record.title || '',
      record.company || '',
      record.source || '',
      record.description || '',
      record.applicationStage || 'interested',
      record.applicationUpdatedAt || '',
      record.applicationDeadline || '',
      record.nextInterviewAt || '',
      record.applicationEvents || [],
      record.applicationResumeVersionId || '',
      createdAt,
      record.updatedAt || record.applicationUpdatedAt || createdAt,
    );
  }

  private normalizeGrowthTask(task: NativeGrowthTask, fallbackJobKey: string, fallbackJobTitle: string): NativeGrowthTask {
    return new NativeGrowthTask(
      task.id,
      task.title,
      task.description,
      task.evidenceRequirement,
      task.projectedGain,
      task.status || 'todo',
      task.jobKey || fallbackJobKey,
      task.jobTitle || fallbackJobTitle,
      task.focusDimension || 'general',
      typeof task.baselineScore === 'number' ? task.baselineScore : 0,
      typeof task.targetScore === 'number' ? task.targetScore : 0,
      task.sourceInterviewId || '',
    );
  }

  private normalizeGrowthEvidenceRecord(
    record: NativeGrowthEvidenceRecord,
    fallbackJobKey: string,
    fallbackJobTitle: string,
  ): NativeGrowthEvidenceRecord {
    return new NativeGrowthEvidenceRecord(
      record.id,
      record.taskId,
      record.taskTitle,
      record.summary,
      record.sourceUrl,
      record.submittedAt,
      record.fingerprint,
      record.status || 'verified',
      record.revokedAt || '',
      record.sourceVerification || 'not_checked',
      record.sourceHost || '',
      record.sourceCheckedAt || '',
      record.sourceHttpStatus || 0,
      record.sourceCheckMethod || 'HEAD',
      record.jobKey || fallbackJobKey,
      record.jobTitle || fallbackJobTitle,
    );
  }

  private growthTaskById(taskId: string): NativeGrowthTask | undefined {
    for (const task of this.growthTasks) {
      if (task.id === taskId) return task;
    }
    return undefined;
  }

  private findTrackedJobRecord(jobKey: string): NativeTrackedJobRecord | undefined {
    for (const record of this.trackedJobRecords) {
      if (record.key === jobKey) return record;
    }
    return undefined;
  }

  private isJobCompareSelected(jobKey: string): boolean {
    return this.jobCompareKeys.includes(jobKey);
  }

  private normalizeJobCompareKeys(selectDefaults: boolean = false): void {
    const normalizedKeys: string[] = [];
    for (const jobKey of this.jobCompareKeys) {
      if (normalizedKeys.length >= 3) break;
      if (this.findTrackedJobRecord(jobKey) && !normalizedKeys.includes(jobKey)) {
        normalizedKeys.push(jobKey);
      }
    }
    if (selectDefaults) {
      for (const record of this.trackedJobRecords) {
        if (normalizedKeys.length >= Math.min(2, this.trackedJobRecords.length)) break;
        if (!normalizedKeys.includes(record.key)) normalizedKeys.push(record.key);
      }
    }
    this.jobCompareKeys = normalizedKeys;
  }

  private toggleJobCompare(jobKey: string): void {
    if (this.isJobCompareSelected(jobKey)) {
      this.jobCompareKeys = this.jobCompareKeys.filter((key: string) => key !== jobKey);
      void this.saveWorkspace();
      return;
    }
    if (this.jobCompareKeys.length >= 3) {
      this.showGlobalNotice('最多同时对比 3 个岗位，请先取消一个已选岗位。', 'warning');
      return;
    }
    if (!this.findTrackedJobRecord(jobKey)) return;
    this.jobCompareKeys = [...this.jobCompareKeys, jobKey];
    void this.saveWorkspace();
  }

  private comparisonJobRecords(): NativeTrackedJobRecord[] {
    const records: NativeTrackedJobRecord[] = [];
    for (const jobKey of this.jobCompareKeys) {
      const record = this.findTrackedJobRecord(jobKey);
      if (record) records.push(record);
    }
    return records;
  }

  private captureActiveTrackedJobRecord(): NativeTrackedJobRecord | undefined {
    const jobKey = this.activeTrackedJobKey || this.applicationJobKey;
    const title = this.jobEditorDirty ? this.editorJobTitle : this.trackedJobTitle;
    const company = this.jobEditorDirty ? this.editorJobCompany : this.trackedJobCompany;
    const source = this.jobEditorDirty ? this.editorJobSource : this.trackedJobSource;
    const description = this.jobEditorDirty ? this.editorJobDescription : this.trackedJobDescription;
    if (!jobKey || !title.trim()) return undefined;
    const existing = this.findTrackedJobRecord(jobKey);
    const now = new Date().toLocaleString('zh-CN');
    const activeRecord = new NativeTrackedJobRecord(
      jobKey,
      title.trim(),
      company.trim(),
      source.trim(),
      description.trim(),
      this.applicationStage,
      this.applicationUpdatedAt,
      this.applicationScheduleDirty ? this.savedApplicationDeadline : this.applicationDeadline,
      this.applicationScheduleDirty ? this.savedNextInterviewAt : this.nextInterviewAt,
      this.applicationEvents,
      this.applicationResumeVersionId,
      existing ? existing.createdAt : now,
      now,
    );
    if (existing) {
      activeRecord.updatedAt = existing.updatedAt;
      if (JSON.stringify(activeRecord) !== JSON.stringify(existing)) activeRecord.updatedAt = now;
    }
    return activeRecord;
  }

  private upsertActiveTrackedJobRecord(): void {
    const activeRecord = this.captureActiveTrackedJobRecord();
    if (!activeRecord) {
      this.trackedJobs = this.trackedJobRecords.length;
      return;
    }
    const nextRecords: NativeTrackedJobRecord[] = [];
    let replaced = false;
    for (const record of this.trackedJobRecords) {
      if (record.key === activeRecord.key) {
        nextRecords.push(activeRecord);
        replaced = true;
      } else {
        nextRecords.push(record);
      }
    }
    this.trackedJobRecords = replaced ? nextRecords : [activeRecord, ...nextRecords];
    this.trackedJobs = this.trackedJobRecords.length;
    this.normalizeJobCompareKeys();
  }

  private clearActiveTrackedJobState(): void {
    this.activeTrackedJobKey = '';
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
    this.applicationDeadlineError = '';
    this.nextInterviewAtError = '';
    this.applicationEvents = [];
    this.applicationResumeVersionId = '';
    this.applicationMessage = '保存真实岗位后即可记录投递进度。';
    this.resumeVersionMessage = '保存真实岗位后，可冻结并绑定实际投递简历。';
    this.editorJobTitle = '';
    this.editorJobCompany = '';
    this.editorJobSource = '';
    this.editorJobDescription = '';
    this.jobEditorDirty = false;
  }

  private applyTrackedJobRecord(record: NativeTrackedJobRecord): void {
    this.activeTrackedJobKey = record.key;
    this.applicationJobKey = record.key;
    this.trackedJobTitle = record.title;
    this.trackedJobCompany = record.company;
    this.trackedJobSource = record.source;
    this.trackedJobDescription = record.description;
    this.applicationStage = record.applicationStage || 'interested';
    this.applicationUpdatedAt = record.applicationUpdatedAt;
    this.applicationDeadline = record.applicationDeadline;
    this.nextInterviewAt = record.nextInterviewAt;
    this.savedApplicationDeadline = record.applicationDeadline;
    this.savedNextInterviewAt = record.nextInterviewAt;
    this.applicationScheduleDirty = false;
    this.applicationDeadlineError = '';
    this.nextInterviewAtError = '';
    this.applicationEvents = record.applicationEvents || [];
    this.applicationResumeVersionId = record.applicationResumeVersionId;
    this.editorJobTitle = record.title;
    this.editorJobCompany = record.company;
    this.editorJobSource = record.source;
    this.editorJobDescription = record.description;
    this.jobEditorDirty = false;
    this.creatingTrackedJob = false;
    this.previousTrackedJobKey = '';
    this.showJobEditor = false;
    if (this.requiresResumeVersion(this.applicationStage) && !this.boundResumeVersion()) {
      this.applicationStage = 'preparing';
      this.applicationResumeVersionId = '';
      this.applicationMessage = '该岗位缺少已绑定的投递简历，已回到“准备中”。';
    } else {
      this.applicationMessage = this.applicationEvents.length > 0
        ? '已切换到该岗位的投递时间线。'
        : '可选择阶段，首次变更后将写入本机时间线。';
    }
    this.resumeVersionMessage = this.boundResumeVersion()
      ? '已恢复该岗位绑定的实际投递版本。'
      : '保存并绑定实际投递版本后，才能进入已投递及后续阶段。';
    this.rebuildEvidenceMatrix();
    this.refreshPublicJobRanking();
  }

  private selectTrackedJob(jobKey: string): boolean {
    if (jobKey === this.activeTrackedJobKey) return true;
    if (this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused')) {
      this.showGlobalNotice('请先完成或结束当前面试，再切换岗位。', 'warning');
      return false;
    }
    if (this.jobEditorDirty || this.applicationScheduleDirty || this.jobMaterialDirty || this.jobMaterialSaving) {
      this.showGlobalNotice('请先保存或放弃当前岗位修改，再切换岗位。', 'warning');
      return false;
    }
    this.upsertActiveTrackedJobRecord();
    const selectedRecord = this.findTrackedJobRecord(jobKey);
    if (!selectedRecord) return false;
    this.applyTrackedJobRecord(selectedRecord);
    this.clearInterviewPresentationForJobSwitch();
    this.jobMessage = `已切换到“${selectedRecord.company} · ${selectedRecord.title}”。`;
    this.showGlobalNotice(this.jobMessage, 'success');
    void this.saveWorkspace();
    return true;
  }

  private openTrackedJobDetail(jobKey: string): void {
    if (!this.selectTrackedJob(jobKey)) return;
    this.jobsSection = 1;
    this.showTrackedJobDetail = true;
    this.showJobComparison = false;
    this.jobsSearchEditing = false;
    this.uiContext.getFocusController().clearFocus();
    this.jobsScroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  private performJobsSection(section: number): void {
    if (this.showJobEditor) this.cancelTrackedJobEdit();
    this.jobsSection = section;
    this.showTrackedJobDetail = false;
    this.showJobComparison = false;
    this.selectedPublicJobIndex = -1;
    this.jobsSearchEditing = false;
    this.applicationWorkspaceNow = Date.now();
    this.uiContext.getFocusController().clearFocus();
    this.jobsScroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  private requestJobsSection(section: number): void {
    if (this.jobMaterialSaving) return;
    if (!this.hasUnsavedChanges()) {
      this.performJobsSection(section);
      return;
    }
    this.showConfirmDialog(
      '放弃未保存修改？',
      `${this.unsavedChangeLabel()}尚未保存。离开后将恢复上次保存内容。`,
      '放弃并离开',
      () => {
        this.discardUnsavedChanges();
        this.performJobsSection(section);
      },
    );
  }

  private trackedApplicationItems(): NativeApplicationListItem[] {
    return this.trackedJobRecords.map((record: NativeTrackedJobRecord) =>
      new NativeApplicationListItem(record, this.trackedJobReadinessCount(record), this.trackedJobNextAction(record)));
  }

  private beginNewTrackedJob(): boolean {
    if (this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused')) {
      this.showGlobalNotice('请先完成或结束当前面试，再新增岗位。', 'warning');
      return false;
    }
    if (this.jobEditorDirty || this.applicationScheduleDirty || this.jobMaterialDirty || this.jobMaterialSaving) {
      this.showGlobalNotice('请先保存或放弃当前岗位修改，再新增岗位。', 'warning');
      return false;
    }
    this.upsertActiveTrackedJobRecord();
    this.previousTrackedJobKey = this.activeTrackedJobKey;
    this.clearActiveTrackedJobState();
    this.creatingTrackedJob = true;
    this.showJobEditor = true;
    this.jobsSection = 1;
    this.showTrackedJobDetail = true;
    this.showJobComparison = false;
    this.jobMessage = '新岗位会生成独立的投递阶段、日程和简历绑定。';
    this.jobsScroller.scrollTo({ xOffset: 0, yOffset: 0 });
    return true;
  }

  private beginTrackedJobEdit(): void {
    if (this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused')) {
      this.showGlobalNotice('请先完成或结束当前面试，再编辑岗位。', 'warning');
      return;
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
    this.showJobEditor = true;
  }

  private cancelTrackedJobEdit(): void {
    if (this.creatingTrackedJob) {
      const previousRecord = this.findTrackedJobRecord(this.previousTrackedJobKey);
      this.creatingTrackedJob = false;
      if (previousRecord) {
        this.applyTrackedJobRecord(previousRecord);
        this.jobMessage = '已返回之前的岗位作战卡。';
      } else {
        this.clearActiveTrackedJobState();
        this.showJobEditor = false;
      }
      this.previousTrackedJobKey = '';
      return;
    }
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
    await this.resumePdfService.remove(`${this.hostContext.cacheDir}/kongming-resume-preview.pdf`);
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
      let migratedLegacyTrackedJob = false;
      let migratedLegacyJobContext = false;
      let migratedJobComparison = false;
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
        this.jobPreferredCities = parsed.jobPreferredCities || '';
        this.jobPreferredEmploymentType = parsed.jobPreferredEmploymentType || '不限';
        this.jobGraduationYear = parsed.jobGraduationYear || '';
        this.jobSalaryExpectation = parsed.jobSalaryExpectation || '';
        this.jobPreferredIndustries = parsed.jobPreferredIndustries || '';
        this.jobPreferredCompanies = parsed.jobPreferredCompanies || '';
        this.jobFeedbackRecords = parsed.jobFeedbackRecords || [];
        this.jobMaterialRecords = (parsed.jobMaterialRecords || [])
          .filter((record: NativeJobMaterialRecord) => Boolean(record.jobKey))
          .map((record: NativeJobMaterialRecord) => this.materialService.cloneRecord(record));
        this.showJobPreferences = false;
        this.trackedJobRecords = [];
        if (parsed.trackedJobRecords) {
          for (const storedRecord of parsed.trackedJobRecords) {
            const restoredRecord = this.normalizeTrackedJobRecord(storedRecord);
            if (restoredRecord.key && restoredRecord.title) this.trackedJobRecords.push(restoredRecord);
          }
        }
        if (this.trackedJobRecords.length === 0 && parsed.trackedJobs > 0 && this.trackedJobTitle) {
          migratedLegacyTrackedJob = true;
          const migratedAt = this.applicationUpdatedAt || new Date().toLocaleString('zh-CN');
          const migratedKey = this.applicationJobKey || this.buildTrackedJobKey(
            this.trackedJobTitle,
            this.trackedJobCompany,
            this.trackedJobSource,
          );
          this.trackedJobRecords = [new NativeTrackedJobRecord(
            migratedKey,
            this.trackedJobTitle,
            this.trackedJobCompany,
            this.trackedJobSource,
            this.trackedJobDescription,
            this.applicationStage,
            this.applicationUpdatedAt,
            this.applicationDeadline,
            this.nextInterviewAt,
            this.applicationEvents,
            this.applicationResumeVersionId,
            migratedAt,
            migratedAt,
          )];
        }
        this.trackedJobs = this.trackedJobRecords.length;
        const storedCompareKeys = parsed.jobCompareKeys || [];
        this.jobCompareKeys = storedCompareKeys;
        this.normalizeJobCompareKeys(!parsed.jobCompareKeys);
        if (!parsed.jobCompareKeys || this.jobCompareKeys.length !== storedCompareKeys.length) {
          migratedJobComparison = this.jobCompareKeys.length > 0 || storedCompareKeys.length > 0;
        }
        if (this.trackedJobs > 0) {
          let restoredActiveRecord = this.findTrackedJobRecord(parsed.activeTrackedJobKey || this.applicationJobKey);
          if (!restoredActiveRecord) restoredActiveRecord = this.trackedJobRecords[0];
          this.applyTrackedJobRecord(restoredActiveRecord);
        }
        this.interviewType = parsed.interviewType || this.interviewType;
        this.interviewStarted = parsed.interviewStarted === true;
        this.interviewQuestion = parsed.interviewQuestion || '';
        this.interviewRound = typeof parsed.interviewRound === 'number' ? parsed.interviewRound : 0;
        this.interviewTurns = parsed.interviewTurns || [];
        this.interviewFeedback = parsed.interviewFeedback || '';
        this.interviewModelName = parsed.interviewModelName === '本机规则'
          ? '标准题库'
          : (parsed.interviewModelName ? '个性化追问' : '标准题库');
        this.interviewSessions = [];
        for (const storedSession of parsed.interviewSessions || []) {
          if (!storedSession.jobKey) {
            storedSession.jobKey = this.activeJobContextKey();
            storedSession.jobTitle = storedSession.jobTitle || this.activeJobContextTitle();
            migratedLegacyJobContext = true;
          }
          if (!storedSession.competencyLabels) {
            storedSession.competencyLabels = [];
            storedSession.competencyCoveredCount = 0;
            migratedLegacyJobContext = true;
          }
          if (typeof storedSession.competencyCoveredCount !== 'number') {
            storedSession.competencyCoveredCount = Math.min(
              storedSession.turns.length,
              storedSession.competencyLabels.length,
            );
            migratedLegacyJobContext = true;
          }
          if (!storedSession.competencyResults) {
            storedSession.competencyResults = [];
            migratedLegacyJobContext = true;
          }
          if (!storedSession.requirementFocuses) {
            storedSession.requirementFocuses = [];
            migratedLegacyJobContext = true;
          }
          if (!storedSession.jobDescriptionSnapshot) storedSession.jobDescriptionSnapshot = '';
          if (!storedSession.resumeVersionId) storedSession.resumeVersionId = '';
          if (!storedSession.resumeVersionName) storedSession.resumeVersionName = '';
          if (!storedSession.improvedAnswer) storedSession.improvedAnswer = '';
          this.interviewSessions.push(storedSession);
        }
        this.currentInterviewSessionId = parsed.currentInterviewSessionId || '';
        this.currentInterviewVideoUri = parsed.currentInterviewVideoUri || '';
        this.currentInterviewVideoDurationSeconds = parsed.currentInterviewVideoDurationSeconds || 0;
        this.currentInterviewVideoSizeBytes = parsed.currentInterviewVideoSizeBytes || 0;
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
        if (!this.interviewStarted) {
          const restoredDuration = this.interviewDurationMinutes;
          this.normalizeInterviewDurationForSetup();
          if (this.interviewDurationMinutes !== restoredDuration) migratedLegacyJobContext = true;
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
        if (this.interviewSessionPhase === 'completed' && this.interviewTurns.length > 0 &&
          !this.hasArchivedCurrentInterview()) {
          this.interviewAssessment = this.assessInterview(this.interviewTurns);
          this.archiveCurrentInterviewSession();
        }
        this.restoreCurrentInterviewAssessment();
        this.evidenceCoverage = typeof parsed.evidenceCoverage === 'number' ? parsed.evidenceCoverage : 42;
        this.empiricalCoverage = typeof parsed.empiricalCoverage === 'number' ? parsed.empiricalCoverage : this.evidenceCoverage;
        this.projectedCoverage = typeof parsed.projectedCoverage === 'number'
          ? parsed.projectedCoverage
          : Math.min(100, this.evidenceCoverage + 21);
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
        const fallbackJobKey = this.activeJobContextKey();
        const fallbackJobTitle = this.activeJobContextTitle();
        this.growthTasks = [];
        for (const storedTask of parsed.growthTasks || []) {
          if (!storedTask.jobKey || !storedTask.jobTitle || !storedTask.focusDimension) migratedLegacyJobContext = true;
          this.growthTasks.push(this.normalizeGrowthTask(storedTask, fallbackJobKey, fallbackJobTitle));
        }
        this.growthEvidenceRecords = [];
        for (const storedRecord of parsed.growthEvidenceRecords || []) {
          const linkedTask = this.growthTaskById(storedRecord.taskId);
          const recordJobKey = linkedTask ? linkedTask.jobKey : fallbackJobKey;
          const recordJobTitle = linkedTask ? linkedTask.jobTitle : fallbackJobTitle;
          if (!storedRecord.jobKey || !storedRecord.jobTitle) migratedLegacyJobContext = true;
          this.growthEvidenceRecords.push(this.normalizeGrowthEvidenceRecord(storedRecord, recordJobKey, recordJobTitle));
        }
        this.growthBaselineCoverage = typeof parsed.growthBaselineCoverage === 'number'
          ? parsed.growthBaselineCoverage
          : Math.max(0, this.empiricalCoverage - this.verifiedGrowthGain());
        this.growthHistory = parsed.growthHistory || [];
        this.growthHistoryJobKeys = parsed.growthHistoryJobKeys || [];
        while (this.growthHistoryJobKeys.length < this.growthHistory.length) {
          this.growthHistoryJobKeys.push(fallbackJobKey);
          migratedLegacyJobContext = true;
        }
        if (this.growthHistoryJobKeys.length > this.growthHistory.length) {
          this.growthHistoryJobKeys = this.growthHistoryJobKeys.slice(0, this.growthHistory.length);
          migratedLegacyJobContext = true;
        }
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
      this.refreshActiveGrowthCoverage();
      if (migratedLegacyTrackedJob || migratedLegacyJobContext || migratedJobComparison) await this.saveWorkspace();
      else await this.syncCareerFormData();
      return true;
    } catch (error) {
      console.error(`Native workspace restore failed: ${String(error)}`);
      return false;
    }
  }

  private async saveWorkspace(): Promise<boolean> {
    try {
      this.upsertActiveTrackedJobRecord();
      const store = await preferences.getPreferences(this.hostContext, NATIVE_STORE_NAME);
      const snapshotTime = Date.now();
      const snapshot: NativeWorkspaceSnapshot = {
        resumeName: this.resumeDirty ? this.savedResumeName : this.resumeName,
        targetJob: this.resumeDirty ? this.savedTargetJob : this.targetJob,
        trackedJobRecords: this.trackedJobRecords,
        jobCompareKeys: this.jobCompareKeys,
        jobMaterialRecords: this.jobMaterialRecords,
        activeTrackedJobKey: this.activeTrackedJobKey || this.previousTrackedJobKey,
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
        jobPreferredCities: this.jobPreferredCities,
        jobPreferredEmploymentType: this.jobPreferredEmploymentType,
        jobGraduationYear: this.jobGraduationYear,
        jobSalaryExpectation: this.jobSalaryExpectation,
        jobPreferredIndustries: this.jobPreferredIndustries,
        jobPreferredCompanies: this.jobPreferredCompanies,
        jobFeedbackRecords: this.jobFeedbackRecords,
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
        interviewSessions: this.interviewSessions,
        currentInterviewSessionId: this.currentInterviewSessionId,
        currentInterviewVideoUri: this.currentInterviewVideoUri,
        currentInterviewVideoDurationSeconds: this.currentInterviewVideoDurationSeconds,
        currentInterviewVideoSizeBytes: this.currentInterviewVideoSizeBytes,
        evidenceCoverage: this.evidenceCoverage,
        empiricalCoverage: this.empiricalCoverage,
        growthBaselineCoverage: this.growthBaselineCoverage,
        projectedCoverage: this.projectedCoverage,
        trackedJobs: this.trackedJobs,
        growthTasks: this.growthTasks,
        growthEvidenceRecords: this.growthEvidenceRecords,
        growthHistory: this.growthHistory,
        growthHistoryJobKeys: this.growthHistoryJobKeys,
        jobEvidence: this.jobEvidence,
      };
      await store.put('snapshot', JSON.stringify(snapshot));
      await store.flush();
      this.interviewSessionUpdatedAt = snapshotTime;
      this.workspaceSaveFailed = false;
      await this.syncCareerFormData();
      return true;
    } catch (error) {
      this.workspaceSaveFailed = true;
      this.profileMessage = '本机保存失败，请稍后重试。';
      this.showGlobalNotice(this.profileMessage, 'error');
      console.error(`Native workspace save failed: ${String(error)}`);
      return false;
    }
  }

  private hasActiveDataOperation(): boolean {
    return this.publicJobsLoading || this.interviewLoading || this.ocrActive || this.speechActive ||
      this.evidenceChecking || this.candidateVideoRecording || this.jobMaterialSaving;
  }

  private resetWorkspaceState(): void {
    this.activeTab = 0;
    this.jobsSection = 0;
    this.showJobPreferences = false;
    this.jobsSearchEditing = false;
    this.showTrackedJobDetail = false;
    this.showJobComparison = false;
    this.trackedJobSearch = '';
    this.trackedJobStageFilter = 'active';
    this.trackedJobSort = 'schedule';
    this.resumeName = '';
    this.targetJob = '前端开发实习生';
    this.trackedJobRecords = [];
    this.jobCompareKeys = [];
    this.jobMaterialRecords = [];
    this.showJobMaterials = false;
    this.jobMaterialDraft = new NativeJobMaterialRecord();
    this.savedJobMaterial = new NativeJobMaterialRecord();
    this.jobMaterialDirty = false;
    this.jobMaterialSaving = false;
    this.jobMaterialMessage = '';
    this.jobMaterialResumeError = '';
    this.closeMaterialPdfPreview();
    this.activeTrackedJobKey = '';
    this.creatingTrackedJob = false;
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
    this.growthHistoryJobKeys = [];
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
    this.jobEmployer = '';
    this.jobPreferredCities = '';
    this.jobPreferredEmploymentType = '不限';
    this.jobGraduationYear = '';
    this.jobSalaryExpectation = '';
    this.jobPreferredIndustries = '';
    this.jobPreferredCompanies = '';
    this.jobFeedbackRecords = [];
    this.showJobPreferences = false;
    this.publicJobs = [];
    this.publicJobsLoading = false;
    this.publicJobsConfigured = false;
    this.publicJobsStale = false;
    this.publicJobsSearched = false;
    this.publicJobsFailed = false;
    this.publicJobsTotal = 0;
    this.publicJobsMessage = '输入关键词搜索国内企业官网公开岗位，也可以手动添加目标岗位。';
    this.selectedPublicJobIndex = -1;
    this.interviewType = '综合面';
    this.interviewStarted = false;
    this.interviewQuestion = '';
    this.interviewRound = 0;
    this.interviewTurns = [];
    this.interviewAnswer = '';
    this.interviewMessage = '';
    this.interviewFeedback = '';
    this.interviewModelName = '标准题库';
    this.interviewLoading = false;
    this.interviewDifficulty = '标准';
    this.interviewDurationMinutes = 15;
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'setup';
    this.interviewTimeExpired = false;
    this.interviewSessionUpdatedAt = 0;
    this.interviewSessions = [];
    this.currentInterviewSessionId = '';
    this.currentInterviewVideoUri = '';
    this.currentInterviewVideoDurationSeconds = 0;
    this.currentInterviewVideoSizeBytes = 0;
    this.candidateVideoRecording = false;
    this.interviewSection = 0;
    this.interviewHistorySearch = '';
    this.interviewHistoryScope = 'current';
    this.interviewHistoryKind = 'all';
    this.interviewHistoryRecordId = '';
    this.interviewHistoryCompareIds = [];
    this.interviewHistoryComparing = false;
    this.interviewHistorySearchEditing = false;
    this.interviewAssessment = new NativeInterviewAssessment(0, 0, 0, 0, 0, '', '', '');
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
    this.previousTrackedJobKey = '';
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
      this.deleteAllInterviewVideos();
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
    for (const task of this.activeGrowthTasks()) {
      if (task.status !== 'verified') return task.title;
    }
    if (this.allActiveGrowthTasksVerified()) return '开始同岗位复测，验证专项训练效果';
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
      formData.growthTaskCount = this.activeGrowthTasks().length;
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

  private hasResumeVersionForJob(jobKey: string, versionId: string): boolean {
    if (!jobKey || !versionId) return false;
    for (const version of this.resumeVersions) {
      if (version.id === versionId && version.jobKey === jobKey) return true;
    }
    return false;
  }

  private hasInterviewSessionForJob(jobKey: string): boolean {
    if (!jobKey) return false;
    for (const session of this.interviewSessions) {
      if (session.jobKey === jobKey && session.turns.length > 0 && session.feedback) return true;
    }
    return false;
  }

  private trackedJobReadinessCount(record: NativeTrackedJobRecord): number {
    let completed = 0;
    if (record.description.trim().length >= 30) completed += 1;
    if (this.resumeSummary.trim().length >= 30) completed += 1;
    if (this.hasResumeVersionForJob(record.key, record.applicationResumeVersionId)) completed += 1;
    if (this.hasInterviewSessionForJob(record.key)) completed += 1;
    if (record.applicationDeadline.trim() || record.nextInterviewAt.trim()) completed += 1;
    return completed;
  }

  private jobReadinessItems(): NativeJobReadinessItem[] {
    const descriptionReady = this.trackedJobDescription.trim().length >= 30;
    const resumeReady = this.resumeSummary.trim().length >= 30;
    const boundVersion = this.boundResumeVersion();
    const interviewCount = this.activeInterviewSessions().length;
    const scheduleReady = this.applicationDeadline.trim().length > 0 || this.nextInterviewAt.trim().length > 0;
    return [
      new NativeJobReadinessItem(
        'job',
        '真实岗位资料',
        descriptionReady ? `已保存 ${this.trackedJobDescription.trim().length} 字岗位说明。` : '补充至少 30 字真实 JD，面试和证据核对才有可靠上下文。',
        descriptionReady,
        '补充岗位 JD',
      ),
      new NativeJobReadinessItem(
        'resume',
        '简历画像可用',
        resumeReady ? '当前简历已有可用于岗位核对的真实经历。' : '先导入或填写真实经历，避免只按岗位名称做判断。',
        resumeReady,
        '完善简历画像',
      ),
      new NativeJobReadinessItem(
        'version',
        '投递版本已冻结',
        boundVersion ? `已绑定“${boundVersion.name}”。` : '保存并绑定该岗位实际使用的简历版本。',
        boundVersion !== undefined,
        '保存投递版本',
      ),
      new NativeJobReadinessItem(
        'interview',
        '岗位面试已练习',
        interviewCount > 0 ? `已完成 ${interviewCount} 次同岗位训练。` : '完成一次岗位驱动模拟面试，提前暴露证据缺口。',
        interviewCount > 0,
        '开始岗位面试',
      ),
      new NativeJobReadinessItem(
        'schedule',
        '关键日程已记录',
        scheduleReady ? (this.nextInterviewAt.trim() ? `下一场面试：${this.nextInterviewAt.trim()}` : `投递截止：${this.applicationDeadline.trim()}`) : '记录投递截止或下一场面试时间，避免错过节点。',
        scheduleReady,
        '填写关键日程',
      ),
    ];
  }

  private jobReadinessCompletedCount(): number {
    let completed = 0;
    for (const item of this.jobReadinessItems()) {
      if (item.isComplete) completed += 1;
    }
    return completed;
  }

  private nextJobReadinessItem(): NativeJobReadinessItem | undefined {
    for (const item of this.jobReadinessItems()) {
      if (!item.isComplete) return item;
    }
    return undefined;
  }

  private performJobReadinessAction(itemKey: string): void {
    if (itemKey === 'job') {
      this.beginTrackedJobEdit();
      return;
    }
    if (itemKey === 'version') {
      this.openJobMaterials();
      return;
    }
    if (itemKey === 'resume') {
      this.requestTabChange(1);
      this.showGlobalNotice(itemKey === 'resume'
        ? '请完善并确认真实简历画像。'
        : '请在简历页保存并绑定当前岗位的投递版本。', 'info');
      return;
    }
    if (itemKey === 'interview') {
      this.applyRecommendedInterviewPlan();
      this.requestTabChange(3);
      this.showGlobalNotice('已载入当前岗位的推荐面试方案。', 'success');
      return;
    }
    this.showGlobalNotice('请在下方投递进度中填写投递截止或下一场面试时间。', 'info');
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

  private trackedJobNextAction(record: NativeTrackedJobRecord): string {
    if (record.applicationStage === 'preparing') {
      return record.applicationResumeVersionId ? '完成投递前检查' : '绑定岗位专属简历';
    }
    if (record.applicationStage === 'applied') return '核对投递状态';
    if (record.applicationStage === 'interview') {
      return record.nextInterviewAt ? `准备 ${record.nextInterviewAt} 面试` : '确认面试时间';
    }
    if (record.applicationStage === 'offer') return '核对 Offer 与截止时间';
    if (record.applicationStage === 'closed') return '完成投递复盘';
    return record.applicationDeadline ? `在 ${record.applicationDeadline} 前准备材料` : '核对岗位并开始准备';
  }

  private comparisonResumeVersionName(record: NativeTrackedJobRecord): string {
    for (const version of this.resumeVersions) {
      if (version.id === record.applicationResumeVersionId && version.jobKey === record.key) {
        return version.name;
      }
    }
    return '未绑定';
  }

  private comparisonInterviewCount(record: NativeTrackedJobRecord): number {
    let count = 0;
    for (const session of this.interviewSessions) {
      if (session.jobKey === record.key && session.turns.length > 0 && session.feedback) count += 1;
    }
    return count;
  }

  private comparisonDateLabel(record: NativeTrackedJobRecord): string {
    if (record.nextInterviewAt.trim()) return `面试 ${record.nextInterviewAt.trim()}`;
    if (record.applicationDeadline.trim()) return `截止 ${record.applicationDeadline.trim()}`;
    return '未记录';
  }

  private prepareInterviewForTrackedJob(record: NativeTrackedJobRecord): void {
    if (record.key !== this.activeTrackedJobKey) {
      this.selectTrackedJob(record.key);
      if (this.activeTrackedJobKey !== record.key) return;
    } else if (this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused')) {
      this.requestTabChange(3);
      this.showGlobalNotice('已返回该岗位正在进行的面试。', 'info');
      return;
    } else {
      this.clearInterviewPresentationForJobSwitch();
    }
    this.applyRecommendedInterviewPlan();
    this.interviewMessage = `已载入“${record.company} · ${record.title}”的岗位面试方案。`;
    this.requestTabChange(3);
    this.showGlobalNotice('已按该岗位载入面试设置。', 'success');
    void this.saveWorkspace();
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
    return this.activeGrowthTasks().length === 0 || this.allActiveGrowthTasksVerified() ? 3 : 4;
  }

  private primaryActionLabel(): string {
    if (!this.resumeSummary.trim()) return '完善求职画像';
    if (this.trackedJobs > 0) {
      if (this.applicationStage === 'preparing' && !this.boundResumeVersion()) return '保存投递版本';
      if (this.applicationStage === 'interview') return '准备岗位面试';
      return '处理投递事项';
    }
    if (this.activeGrowthTasks().length === 0) return '开始岗位面试';
    return this.allActiveGrowthTasksVerified() ? '开始同岗位复测' : '继续成长任务';
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
    const growthPending = this.activeGrowthTasks().filter((task: NativeGrowthTask) => task.status !== 'verified').length;
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
    void this.freezeNativeResumeVersion(this.resumeSummary.trim());
  }

  private async freezeNativeResumeVersion(content: string): Promise<boolean> {
    if (this.trackedJobs === 0 || !this.applicationJobKey) {
      this.resumeVersionMessage = '请先保存可追溯的真实岗位，再创建投递版本。';
      this.showGlobalNotice(this.resumeVersionMessage, 'warning');
      return false;
    }
    if (this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused')) {
      this.showGlobalNotice('请完成当前面试后再更换投递简历版本。', 'warning');
      return false;
    }
    if (content.length < 30) {
      this.resumeVersionMessage = '简历内容至少需要 30 个字，才能保存为实际投递版本。';
      this.showGlobalNotice(this.resumeVersionMessage, 'warning');
      return false;
    }
    let versionCount = 0;
    let previousVersion: NativeResumeVersion | undefined = undefined;
    for (const version of this.resumeVersions) {
      if (version.jobKey === this.applicationJobKey) {
        versionCount += 1;
        if (!previousVersion) previousVersion = version;
      }
    }
    const existingVersion = this.resumeVersions.find((version: NativeResumeVersion) =>
      version.jobKey === this.applicationJobKey && version.content === content);
    if (existingVersion && existingVersion.id === this.applicationResumeVersionId) {
      this.resumeVersionMessage = `当前内容已绑定为“${existingVersion.name}”。`;
      this.showGlobalNotice(this.resumeVersionMessage, 'success');
      return true;
    }
    const createdAt = new Date().toLocaleString('zh-CN');
    const version = existingVersion || new NativeResumeVersion(
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
    const previousVersions = this.resumeVersions;
    const previousVersionId = this.applicationResumeVersionId;
    const previousUpdatedAt = this.applicationUpdatedAt;
    const previousEvents = this.applicationEvents;
    const previousApplicationMessage = this.applicationMessage;
    if (!existingVersion) this.resumeVersions = [version, ...this.resumeVersions];
    this.applicationResumeVersionId = version.id;
    this.applicationUpdatedAt = createdAt;
    this.applicationEvents = [
      new NativeApplicationEvent(this.applicationStage, `已保存并绑定简历版本“${version.name}”`, createdAt),
      ...this.applicationEvents,
    ];
    this.resumeVersionMessage = `“${version.name}”已冻结并绑定到当前岗位。`;
    this.applicationMessage = '实际投递版本已绑定，可进入“已投递”及后续阶段。';
    const saved = await this.saveWorkspace();
    if (saved) {
      this.showGlobalNotice(this.resumeVersionMessage, 'success');
    } else {
      this.resumeVersions = previousVersions;
      this.applicationResumeVersionId = previousVersionId;
      this.applicationUpdatedAt = previousUpdatedAt;
      this.applicationEvents = previousEvents;
      this.applicationMessage = previousApplicationMessage;
      this.upsertActiveTrackedJobRecord();
      this.resumeVersionMessage = '投递版本未保存，请重试。';
    }
    return saved;
  }

  private openJobMaterials(): void {
    if (!this.applicationJobKey) return;
    if (this.hasUnsavedChanges()) {
      this.showGlobalNotice('请先保存当前修改，再打开岗位材料。', 'warning');
      return;
    }
    const stored = this.jobMaterialRecords.find((record: NativeJobMaterialRecord) =>
      record.jobKey === this.applicationJobKey);
    if (stored) {
      this.jobMaterialDraft = this.materialService.cloneRecord(stored);
      if (!this.jobMaterialDraft.candidateName) this.jobMaterialDraft.candidateName = this.resumeName;
    } else {
      const draft = new NativeJobMaterialRecord();
      draft.jobKey = this.applicationJobKey;
      draft.candidateName = this.resumeName;
      const version = this.boundResumeVersion();
      draft.resumeContent = version ? version.content : this.resumeSummary;
      draft.baseResumeContent = draft.resumeContent;
      draft.sourceResumeVersionId = version ? version.id : '';
      this.jobMaterialDraft = draft;
    }
    this.savedJobMaterial = this.materialService.cloneRecord(stored || this.jobMaterialDraft);
    this.updateJobMaterialDirtyState();
    this.jobMaterialSection = 0;
    this.jobMaterialResumeError = '';
    this.jobMaterialMessage = stored ? `上次保存：${stored.updatedAt}` : '已载入简历正文，完成调整后保存岗位材料。';
    this.showJobMaterials = true;
  }

  private closeJobMaterials(): void {
    if (this.jobMaterialSaving) return;
    this.closeMaterialPdfPreview();
    if (!this.jobMaterialDirty) {
      this.showJobMaterials = false;
      return;
    }
    this.showConfirmDialog('放弃材料修改？', '本次材料修改尚未保存，离开后将恢复上次保存内容。',
      '放弃并返回', () => {
        this.discardUnsavedChanges();
        this.showJobMaterials = false;
      });
  }

  private updateJobMaterialDirtyState(): void {
    this.jobMaterialDirty = !this.jobMaterialRecords.some((record: NativeJobMaterialRecord) =>
      record.jobKey === this.jobMaterialDraft.jobKey) ||
      JSON.stringify(this.jobMaterialDraft) !== JSON.stringify(this.savedJobMaterial);
  }

  private changeMaterialResume(content: string): void {
    const draft = this.materialService.cloneRecord(this.jobMaterialDraft);
    draft.resumeContent = content;
    this.jobMaterialDraft = draft;
    this.jobMaterialResumeError = '';
    this.updateJobMaterialDirtyState();
  }

  private changeMaterialIdentity(field: string, value: string): void {
    const draft = this.materialService.cloneRecord(this.jobMaterialDraft);
    if (field === 'candidateName') draft.candidateName = value;
    else if (field === 'contact') draft.contact = value;
    else return;
    this.jobMaterialDraft = draft;
    this.updateJobMaterialDirtyState();
  }

  private confirmMaterialResume(confirmed: boolean): void {
    this.jobMaterialDraft = this.materialService.confirmResume(this.jobMaterialDraft, confirmed);
    this.updateJobMaterialDirtyState();
  }

  private closeMaterialPdfPreview(): void {
    const path = this.jobMaterialPdfPath;
    this.jobMaterialPdfPath = '';
    this.jobMaterialPdfPages = [];
    this.jobMaterialPdfFileName = '';
    void this.resumePdfService.remove(path);
  }

  private async previewMaterialResumePdf(): Promise<void> {
    if (this.jobMaterialSaving) return;
    const version = this.boundResumeVersion();
    if (!version || !this.materialService.canExportResume(this.jobMaterialDraft, version, this.jobMaterialDirty)) {
      this.jobMaterialSection = 2;
      this.showGlobalNotice('请先完成投递检查中的待处理项。', 'warning');
      return;
    }
    this.jobMaterialSaving = true;
    const record = this.materialService.cloneRecord(this.jobMaterialDraft);
    const input = new NativeResumePdfInput(record.candidateName, record.contact, this.trackedJobTitle, version.content);
    const title = `${record.candidateName}-${this.trackedJobCompany}-${this.trackedJobTitle}`
      .replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    try {
      await new Promise<void>((resolve: () => void) => { setTimeout(resolve, 50); });
      const result = await this.resumePdfService.create(this.hostContext, input);
      this.jobMaterialPdfFileName = `${title}-简历.pdf`;
      this.jobMaterialPdfPages = result.pages;
      this.jobMaterialPdfPath = result.path;
      this.jobMaterialSection = 2;
    } catch (error) {
      console.error(`Resume PDF creation failed: ${String(error)}`);
      this.showGlobalNotice(String(error).includes('FONT_UNSUPPORTED_CHAR')
        ? '简历含当前字体不支持的字符，请移除表情或特殊符号后重试。'
        : '简历 PDF 暂时无法生成，材料仍保留，请重试。', 'warning');
    } finally {
      this.jobMaterialSaving = false;
    }
  }

  private async saveMaterialResumePdf(): Promise<void> {
    if (!this.jobMaterialPdfPath || this.jobMaterialSaving) return;
    this.jobMaterialSaving = true;
    let source: fileIo.File | undefined = undefined;
    let destination: fileIo.File | undefined = undefined;
    try {
      const documentPicker = new picker.DocumentViewPicker(this.hostContext);
      const uris = await documentPicker.save({ newFileNames: [this.jobMaterialPdfFileName] });
      if (!uris[0]) return;
      source = await fileIo.open(this.jobMaterialPdfPath, fileIo.OpenMode.READ_ONLY);
      destination = await fileIo.open(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
      await fileIo.copyFile(source.fd, destination.fd);
      if (fileIo.statSync(destination.fd).size !== fileIo.statSync(source.fd).size) throw new Error('Incomplete PDF copy');
      this.showGlobalNotice('投递简历 PDF 已保存。', 'success');
    } catch (error) {
      console.error(`Resume PDF export failed: ${String(error)}`);
      this.showGlobalNotice('PDF 未保存，请重试。', 'warning');
    } finally {
      if (source) await fileIo.close(source).catch(() => {});
      if (destination) await fileIo.close(destination).catch(() => {});
      this.jobMaterialSaving = false;
    }
  }

  private requestResetMaterialResume(): void {
    this.showConfirmDialog('载入当前简历画像？', '当前岗位的简历草稿将被当前画像替换。已冻结的投递版本仍会保留。',
      '确认载入', () => {
        this.changeMaterialResume(this.resumeSummary);
      });
  }

  private addJobStory(requirement: string): void {
    if (this.jobMaterialDraft.stories.length >= 12) {
      this.showGlobalNotice('每个岗位最多保存 12 个案例。', 'warning');
      return;
    }
    const story = new NativeJobStory();
    story.id = `story-${Date.now()}`;
    story.requirement = requirement;
    const draft = this.materialService.cloneRecord(this.jobMaterialDraft);
    draft.stories = [...draft.stories, story];
    this.jobMaterialDraft = draft;
    this.updateJobMaterialDirtyState();
  }

  private changeJobStory(storyId: string, field: string, value: string): void {
    const draft = this.materialService.cloneRecord(this.jobMaterialDraft);
    const story = draft.stories.find((item: NativeJobStory) => item.id === storyId);
    if (!story) return;
    if (field === 'title') story.title = value;
    else if (field === 'requirement') story.requirement = value;
    else if (field === 'situation') story.situation = value;
    else if (field === 'task') story.task = value;
    else if (field === 'action') story.action = value;
    else if (field === 'result') story.result = value;
    else if (field === 'evidence') story.evidence = value;
    else return;
    this.jobMaterialDraft = draft;
    this.updateJobMaterialDirtyState();
  }

  private requestDeleteJobStory(storyId: string): void {
    this.showConfirmDialog('移除这个案例？', '保存材料后，此案例将从当前岗位材料中移除。原面试记录仍会保留。',
      '确认移除', () => {
        const draft = this.materialService.cloneRecord(this.jobMaterialDraft);
        draft.stories = draft.stories.filter((story: NativeJobStory) => story.id !== storyId);
        this.jobMaterialDraft = draft;
        this.updateJobMaterialDirtyState();
      });
  }

  private importInterviewStory(): void {
    if (this.jobMaterialDraft.stories.length >= 12) {
      this.showGlobalNotice('每个岗位最多保存 12 个案例。', 'warning');
      return;
    }
    for (const session of this.activeInterviewSessions()) {
      for (let index = 0; index < session.turns.length; index += 1) {
        const story = this.materialService.storyFromSession(session, index);
        if (!story || this.jobMaterialDraft.stories.some((item: NativeJobStory) => item.id === story.id)) continue;
        const draft = this.materialService.cloneRecord(this.jobMaterialDraft);
        draft.stories = [...draft.stories, story];
        this.jobMaterialDraft = draft;
        this.updateJobMaterialDirtyState();
        this.showGlobalNotice('已导入面试原回答，可继续整理项目案例。', 'success');
        return;
      }
    }
    this.showGlobalNotice('没有可导入的新回答，请先完成该岗位面试或手动新增案例。', 'info');
  }

  private async saveJobMaterials(): Promise<boolean> {
    if (this.jobMaterialSaving || this.jobMaterialDraft.jobKey !== this.applicationJobKey) return false;
    this.jobMaterialSaving = true;
    const savedDraft = this.materialService.cloneRecord(this.jobMaterialDraft);
    const previousRecord = this.jobMaterialRecords.find((record: NativeJobMaterialRecord) => record.jobKey === savedDraft.jobKey);
    savedDraft.updatedAt = new Date().toLocaleString('zh-CN');
    this.jobMaterialRecords = [savedDraft, ...this.jobMaterialRecords.filter((record: NativeJobMaterialRecord) =>
      record.jobKey !== savedDraft.jobKey)];
    const saved = await this.saveWorkspace();
    if (saved) {
      this.savedJobMaterial = this.materialService.cloneRecord(savedDraft);
      const currentDraft = this.materialService.cloneRecord(this.jobMaterialDraft);
      currentDraft.updatedAt = savedDraft.updatedAt;
      this.jobMaterialDraft = currentDraft;
      this.updateJobMaterialDirtyState();
      this.jobMaterialMessage = `已保存岗位材料 · ${savedDraft.updatedAt}`;
      this.showGlobalNotice('岗位材料已保存。', 'success');
    } else {
      const remainingRecords = this.jobMaterialRecords.filter((record: NativeJobMaterialRecord) => record.jobKey !== savedDraft.jobKey);
      this.jobMaterialRecords = previousRecord ? [previousRecord, ...remainingRecords] : remainingRecords;
      this.jobMaterialDirty = true;
      this.jobMaterialMessage = '材料保存失败，请重试。';
    }
    this.jobMaterialSaving = false;
    return saved;
  }

  private async freezeJobMaterialResume(): Promise<void> {
    if (this.jobMaterialSaving) return;
    const content = this.jobMaterialDraft.resumeContent.trim();
    this.jobMaterialResumeError = this.validateResumeSummary(content);
    if (this.jobMaterialResumeError) return;
    if (this.jobMaterialDirty && !await this.saveJobMaterials()) return;
    this.jobMaterialSaving = true;
    try {
      await this.freezeNativeResumeVersion(content);
    } finally {
      this.jobMaterialSaving = false;
    }
  }

  private async exportJobMaterials(): Promise<void> {
    if (this.jobMaterialDirty) {
      this.showGlobalNotice('请先保存岗位材料，再导出。', 'warning');
      return;
    }
    let outputFile: fileIo.File | undefined = undefined;
    try {
      const text = this.materialService.exportText(this.savedJobMaterial,
        this.trackedJobTitle, this.trackedJobCompany, this.boundResumeVersionName());
      const safeTitle = `${this.trackedJobCompany}-${this.trackedJobTitle}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
      const documentPicker = new picker.DocumentViewPicker(this.hostContext);
      const uris = await documentPicker.save({ newFileNames: [`${safeTitle}-投递材料.txt`] });
      if (!uris[0]) return;
      outputFile = await fileIo.open(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
      await fileIo.write(outputFile.fd, text);
      this.showGlobalNotice('投递材料已导出。', 'success');
    } catch (error) {
      console.error(`Export job materials failed: ${String(error)}`);
      this.showGlobalNotice('暂时无法导出材料，请重试。', 'warning');
    } finally {
      if (outputFile) {
        try {
          await fileIo.close(outputFile);
        } catch (error) {
          console.warn(`Close exported material file failed: ${String(error)}`);
        }
      }
    }
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
    for (const task of this.activeGrowthTasks()) {
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

  private applicationStageProgress(): number {
    for (let index = 0; index < NATIVE_APPLICATION_STAGES.length; index += 1) {
      if (NATIVE_APPLICATION_STAGES[index].id === this.applicationStage) return index + 1;
    }
    return 1;
  }

  private activeJobMilestoneLabel(): string {
    if (this.applicationStage === 'interview' && this.nextInterviewAt.trim()) {
      return `下一场面试 · ${this.nextInterviewAt.trim()}`;
    }
    if (this.applicationDeadline.trim()) return `投递截止 · ${this.applicationDeadline.trim()}`;
    if (this.nextInterviewAt.trim()) return `下一场面试 · ${this.nextInterviewAt.trim()}`;
    return '尚未设置截止时间或面试安排';
  }

  private activeJobEvidenceGapLabel(): string {
    const gap = this.primaryEvidenceGap();
    return gap ? gap : '当前要求均已发现证据线索';
  }

  private latestActiveJobInterview(): NativeInterviewSessionRecord | undefined {
    const sessions = this.activeInterviewSessions();
    return sessions.length > 0 ? sessions[0] : undefined;
  }

  private activeJobInterviewCount(): number {
    return this.activeInterviewSessions().length;
  }

  private activeJobInterviewValue(): string {
    const latest = this.latestActiveJobInterview();
    return latest ? `${latest.overallScore} 分` : '尚未训练';
  }

  private activeJobInterviewDetail(): string {
    const latest = this.latestActiveJobInterview();
    if (!latest) return '完成一次岗位化模拟面试，建立训练基线';
    return `${this.interviewTrendLabel(latest)} · 共 ${this.activeJobInterviewCount()} 次训练`;
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
    if (this.activeGrowthTasks().some((task: NativeGrowthTask) => task.status !== 'verified')) {
      return `继续完成“${this.nextGrowthAction()}”，通过证据检查后再更新实证覆盖。`;
    }
    if (this.allActiveGrowthTasksVerified()) return '专项任务已完成，开始同岗位复测并比较训练前后变化。';
    return '岗位画像已具备基础线索，下一步用一次真实面试复测表达质量。';
  }

  private guidanceTab(): number {
    if (!this.resumeSummary.trim()) return 1;
    if (this.trackedJobs > 0) return this.primaryActionTab();
    if (this.primaryEvidenceGap()) return 2;
    if (this.activeGrowthTasks().some((task: NativeGrowthTask) => task.status !== 'verified')) return 4;
    if (this.allActiveGrowthTasksVerified()) return 3;
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

  private splitJobPreferenceTerms(value: string): string[] {
    const terms: string[] = [];
    for (const item of value.split(/[、,，;；/\s]+/)) {
      const normalized = item.trim();
      if (normalized && !terms.includes(normalized)) terms.push(normalized);
    }
    return terms.slice(0, 8);
  }

  private jobPreferenceProfile(): NativeJobPreferenceProfile {
    return new NativeJobPreferenceProfile(
      this.splitJobPreferenceTerms(this.jobPreferredCities),
      this.jobPreferredEmploymentType,
      this.jobGraduationYear.trim(),
      this.jobSalaryExpectation.trim(),
      this.splitJobPreferenceTerms(this.jobPreferredIndustries),
      this.splitJobPreferenceTerms(this.jobPreferredCompanies),
    );
  }

  private hasConfiguredJobPreferences(): boolean {
    return this.jobPreferredCities.trim().length > 0 || this.jobPreferredEmploymentType !== '不限' ||
      this.jobGraduationYear.trim().length > 0 || this.jobSalaryExpectation.trim().length > 0 ||
      this.jobPreferredIndustries.trim().length > 0 || this.jobPreferredCompanies.trim().length > 0;
  }

  private jobPreferenceSummary(): string {
    const summary: string[] = [];
    if (this.jobPreferredCities.trim()) summary.push(this.jobPreferredCities.trim());
    if (this.jobPreferredEmploymentType !== '不限') summary.push(this.jobPreferredEmploymentType);
    if (this.jobGraduationYear.trim()) summary.push(`${this.jobGraduationYear.trim()} 届`);
    if (this.jobSalaryExpectation.trim()) summary.push(this.jobSalaryExpectation.trim());
    if (this.jobPreferredIndustries.trim()) summary.push(this.jobPreferredIndustries.trim());
    if (this.jobPreferredCompanies.trim()) summary.push(this.jobPreferredCompanies.trim());
    return summary.length > 0 ? summary.slice(0, 4).join(' · ') : '尚未设置，当前按目标岗位和简历证据排序';
  }

  private saveJobPreferences(): void {
    this.jobPreferredCities = this.splitJobPreferenceTerms(this.jobPreferredCities).join('、');
    this.jobPreferredIndustries = this.splitJobPreferenceTerms(this.jobPreferredIndustries).join('、');
    this.jobPreferredCompanies = this.splitJobPreferenceTerms(this.jobPreferredCompanies).join('、');
    const graduationYear = this.jobGraduationYear.match(/20\d{2}/);
    this.jobGraduationYear = graduationYear ? graduationYear[0] : '';
    this.jobSalaryExpectation = this.jobSalaryExpectation.trim();
    this.showJobPreferences = false;
    this.refreshPublicJobRanking();
    this.publicJobsMessage = this.publicJobs.length > 0
      ? '求职偏好已保存，当前岗位已在本机重新排序。'
      : '求职偏好已保存，将用于下一次岗位排序。';
    this.showGlobalNotice(this.publicJobsMessage, 'success');
    void this.saveWorkspace();
  }

  private togglePreferredCompany(company: string): void {
    const companies = this.splitJobPreferenceTerms(this.jobPreferredCompanies);
    if (companies.includes(company)) {
      this.jobPreferredCompanies = companies.filter((item: string) => item !== company).join('、');
    } else {
      companies.push(company);
      this.jobPreferredCompanies = companies.slice(0, 8).join('、');
    }
  }

  private jobFeedbackKey(job: NativePublicJob): string {
    return (job.sourceUrl || job.id).trim().toLowerCase();
  }

  private updateJobFeedback(job: NativePublicJob, feedback: string): void {
    const key = this.jobFeedbackKey(job);
    const retained: NativeJobFeedbackRecord[] = [];
    for (const record of this.jobFeedbackRecords) {
      if (record.jobKey !== key) retained.push(record);
    }
    if (feedback) {
      retained.push(new NativeJobFeedbackRecord(
        key,
        feedback,
        job.company,
        job.title,
        job.city,
        new Date().toLocaleString('zh-CN'),
      ));
    }
    this.jobFeedbackRecords = retained.slice(-80);
    this.refreshPublicJobRanking();
    const label = this.jobFeedbackLabel(feedback);
    this.publicJobsMessage = feedback
      ? `已记录“${label}”，当前及相似岗位已重新排序。`
      : '已撤销该岗位反馈，并重新计算推荐顺序。';
    this.showGlobalNotice(this.publicJobsMessage, 'success');
    void this.saveWorkspace();
  }

  private jobFeedbackLabel(feedback: string): string {
    if (feedback === 'interested') return '更感兴趣';
    if (feedback === 'location_mismatch') return '地点不合适';
    if (feedback === 'too_senior') return '要求偏高';
    if (feedback === 'not_interested') return '不感兴趣';
    return '未反馈';
  }

  private restoreSelectedPublicJob(jobId: string): void {
    this.selectedPublicJobIndex = -1;
    if (!jobId) return;
    for (let index = 0; index < this.publicJobs.length; index += 1) {
      if (this.publicJobs[index].id === jobId) {
        this.selectedPublicJobIndex = index;
        return;
      }
    }
  }

  private refreshPublicJobRanking(): void {
    if (this.publicJobs.length === 0) return;
    const selectedJobId = this.selectedPublicJobIndex >= 0 && this.selectedPublicJobIndex < this.publicJobs.length
      ? this.publicJobs[this.selectedPublicJobIndex].id
      : '';
    this.publicJobs = this.jobRecommendationService.rankJobs(
      this.publicJobs,
      this.resumeSummary,
      this.targetJob,
      this.jobQuery.trim() || this.targetJob.trim(),
      this.jobPreferenceProfile(),
      this.jobFeedbackRecords,
    );
    this.restoreSelectedPublicJob(selectedJobId);
  }

  private async refreshPublicJobs(): Promise<void> {
    if (this.publicJobsLoading) return;
    this.uiContext.getFocusController().clearFocus();
    this.publicJobsLoading = true;
    this.publicJobsSearched = true;
    this.publicJobsFailed = false;
    this.selectedPublicJobIndex = -1;
    this.publicJobsMessage = '正在搜索企业官网公开岗位，请稍候。';
    const query = this.jobQuery.trim() || this.targetJob.trim();
    try {
      const feed: NativeJobFeed = await this.jobService.fetchJobs(query, this.jobCity, this.jobEmployer);
      this.publicJobsConfigured = feed.configured;
      this.publicJobsFailed = feed.failed;
      if (feed.failed) {
        this.publicJobsStale = this.publicJobs.length > 0;
        this.publicJobsMessage = this.publicJobs.length > 0
          ? `${feed.message} 已保留上次成功结果。`
          : feed.message;
        return;
      }
      this.publicJobs = this.jobRecommendationService.rankJobs(
        feed.jobs,
        this.resumeSummary,
        this.targetJob,
        query,
        this.jobPreferenceProfile(),
        this.jobFeedbackRecords,
      );
      this.publicJobsStale = feed.stale;
      this.publicJobsTotal = feed.total;
      this.publicJobsMessage = feed.jobs.length > 0
        ? `${feed.message} ${this.resumeSummary.trim().length >= 30
          ? '已在本机按简历证据排序。'
          : '简历画像不足，当前按目标方向排序。'}`
        : feed.message;
    } catch (error) {
      console.error(`Public job refresh failed: ${String(error)}`);
      this.publicJobsFailed = true;
      this.publicJobsStale = this.publicJobs.length > 0;
      this.publicJobsMessage = this.publicJobs.length > 0
        ? '暂时无法更新岗位，已保留上次结果；请检查网络后重试。'
        : '暂时无法搜索岗位，请检查网络后重试。';
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

  private trackPublicJob(job: NativePublicJob): boolean {
    if (job.description.trim().length < 30) {
      this.publicJobsMessage = '该来源未提供足够完整的岗位说明，请打开官方页面核对后手动录入。';
      return false;
    }
    const jobKey = this.buildTrackedJobKey(job.title, job.company, job.sourceUrl);
    const existing = this.findTrackedJobRecord(jobKey);
    if (existing) {
      if (this.activeTrackedJobKey !== jobKey) this.selectTrackedJob(jobKey);
      this.publicJobsMessage = `“${job.company} · ${job.title}”已在本机追踪。`;
      return this.activeTrackedJobKey === jobKey;
    }
    if (!this.beginNewTrackedJob()) return false;
    this.trackedJobTitle = job.title;
    this.trackedJobCompany = job.company;
    this.trackedJobSource = job.sourceUrl;
    this.trackedJobDescription = job.description;
    const saved = this.saveTrackedJob();
    if (!saved) return false;
    this.publicJobsMessage = '已保存为本机追踪岗位，并按简历事实重建证据矩阵。';
    return true;
  }

  private prepareInterviewForPublicJob(job: NativePublicJob): void {
    if (!this.trackPublicJob(job)) return;
    this.applyRecommendedInterviewPlan();
    this.selectedPublicJobIndex = -1;
    this.interviewMessage = `已载入“${job.company} · ${job.title}”的岗位说明和简历证据。`;
    this.requestTabChange(3);
    void this.saveWorkspace();
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

  private async openBossJobSearch(): Promise<void> {
    const terms = [this.jobEmployer.trim(), this.jobQuery.trim() || this.targetJob.trim(), this.jobCity.trim()]
      .filter((item: string) => item.length > 0)
      .join(' ');
    let endpoint = '';
    try {
      endpoint = this.hostContext.resourceManager.getStringByNameSync('boss_search_url').trim();
    } catch (error) {
      console.error(`Read BOSS search endpoint failed: ${String(error)}`);
    }
    if (!endpoint.startsWith('https://')) {
      this.publicJobsMessage = '暂时无法打开 BOSS 直聘，请稍后重试。';
      return;
    }
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}query=${encodeURIComponent(terms || '实习')}`;
    try {
      await this.hostContext.startAbility({
        action: 'ohos.want.action.viewData',
        uri: url,
      });
      this.publicJobsMessage = '已交由系统打开 BOSS 直聘，请核验招聘主体、岗位地点和发布时间。';
    } catch (error) {
      console.error(`Open BOSS search failed: ${String(error)}`);
      this.publicJobsMessage = '系统暂时无法打开 BOSS 直聘，请稍后重试。';
    }
  }

  private verificationLabel(verification: string): string {
    if (verification === 'official-live-api') return '企业官方来源';
    if (verification === 'official-ats') return '企业官方来源';
    if (verification === 'official-site') return '企业官网';
    return '可追溯来源';
  }

  private jobMatchColor(score: number): ResourceColor {
    if (score >= 80) return $r('app.color.km_success');
    if (score >= 65) return $r('app.color.km_primary_action');
    if (score >= 50) return $r('app.color.km_warning');
    return $r('app.color.km_danger');
  }

  private jobMatchBackground(score: number): ResourceColor {
    if (score >= 80) return $r('app.color.km_success_soft');
    if (score >= 65) return $r('app.color.km_primary_soft');
    if (score >= 50) return $r('app.color.km_warning_soft');
    return $r('app.color.km_danger_soft');
  }

  private saveTrackedJob(): boolean {
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
      return false;
    }
    const shouldSeedComparison = this.trackedJobRecords.length === 0 || this.creatingTrackedJob;
    const nextJobKey = this.activeTrackedJobKey && !this.creatingTrackedJob
      ? this.activeTrackedJobKey
      : this.buildTrackedJobKey(title, company, source);
    const previousRecordKey = this.activeTrackedJobKey;
    const isDifferentApplication = this.applicationJobKey !== nextJobKey;
    this.trackedJobTitle = title;
    this.trackedJobCompany = company;
    this.trackedJobSource = source;
    this.trackedJobDescription = description;
    this.targetJob = title;
    if (!this.resumeDirty) this.savedTargetJob = title;
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
    if (previousRecordKey && previousRecordKey !== nextJobKey) {
      this.trackedJobRecords = this.trackedJobRecords.filter(
        (record: NativeTrackedJobRecord) => record.key !== previousRecordKey,
      );
    }
    this.activeTrackedJobKey = nextJobKey;
    this.applicationJobKey = nextJobKey;
    this.creatingTrackedJob = false;
    this.previousTrackedJobKey = '';
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
    this.upsertActiveTrackedJobRecord();
    if (shouldSeedComparison) this.normalizeJobCompareKeys(true);
    this.rebuildEvidenceMatrix();
    this.refreshPublicJobRanking();
    this.jobMessage = '真实岗位已保存到本机，并已按简历事实重建证据矩阵。';
    this.showGlobalNotice(this.jobMessage, 'success');
    void this.saveWorkspace();
    return true;
  }

  private removeTrackedJob(): void {
    if (this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused')) {
      this.showGlobalNotice('请先完成或结束当前面试，再移除岗位。', 'warning');
      return;
    }
    const removedKey = this.activeTrackedJobKey || this.applicationJobKey;
    let removedIndex = 0;
    const remainingRecords: NativeTrackedJobRecord[] = [];
    for (let index = 0; index < this.trackedJobRecords.length; index += 1) {
      const record = this.trackedJobRecords[index];
      if (record.key === removedKey) {
        removedIndex = index;
      } else {
        remainingRecords.push(record);
      }
    }
    this.trackedJobRecords = remainingRecords;
    this.normalizeJobCompareKeys();
    this.trackedJobs = remainingRecords.length;
    this.creatingTrackedJob = false;
    this.previousTrackedJobKey = '';
    if (remainingRecords.length > 0) {
      const nextIndex = Math.min(removedIndex, remainingRecords.length - 1);
      this.applyTrackedJobRecord(remainingRecords[nextIndex]);
      this.clearInterviewPresentationForJobSwitch();
      this.jobMessage = `已移除岗位，并切换到“${this.trackedJobCompany} · ${this.trackedJobTitle}”。`;
    } else {
      this.clearActiveTrackedJobState();
      this.showJobEditor = false;
      this.jobEvidence = createDefaultNativeJobEvidence();
      this.evidenceCoverage = 42;
      this.clearInterviewPresentationForJobSwitch();
      this.refreshActiveGrowthCoverage();
      this.jobMessage = '已移除最后一个岗位，目标岗位画像仍保留在本机。';
    }
    this.showGlobalNotice(this.jobMessage, 'success');
    if (this.activeTab === 2) {
      this.showTrackedJobDetail = false;
      this.showJobComparison = false;
      this.applicationWorkspaceNow = Date.now();
    }
    void this.saveWorkspace();
  }

  private requestRemoveTrackedJob(): void {
    this.showConfirmDialog(
      '移除当前岗位？',
      '这张岗位作战卡及其投递阶段、日程和当前绑定关系将从工作台移除；已冻结的简历版本仍保留在本机。',
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
    this.refreshActiveGrowthCoverage();
  }

  private weakestInterviewDimension(assessment: NativeInterviewAssessment): string {
    let focus = 'structure';
    let score = assessment.structureScore;
    if (assessment.evidenceScore < score) {
      focus = 'evidence';
      score = assessment.evidenceScore;
    }
    if (assessment.relevanceScore < score) {
      focus = 'relevance';
      score = assessment.relevanceScore;
    }
    if (assessment.clarityScore < score) focus = 'clarity';
    return focus;
  }

  private interviewAssessmentScore(assessment: NativeInterviewAssessment, dimension: string): number {
    if (dimension === 'evidence') return assessment.evidenceScore;
    if (dimension === 'relevance') return assessment.relevanceScore;
    if (dimension === 'clarity') return assessment.clarityScore;
    return assessment.structureScore;
  }

  private growthFocusLabel(dimension: string): string {
    if (dimension === 'structure') return '回答结构';
    if (dimension === 'evidence') return '证据可信度';
    if (dimension === 'relevance') return '岗位关联';
    if (dimension === 'clarity') return '表达清晰度';
    return '综合表达';
  }

  private interviewCoreCompetencyLabel(): string {
    const skill = this.primarySkillRequirement();
    if (skill) return `${this.skillDisplayName(skill)} 实践`;
    const jobText = `${this.targetJob} ${this.trackedJobTitle} ${this.trackedJobDescription}`.toLowerCase();
    if (/算法|机器学习|深度学习|大模型|人工智能|\bai\b/.test(jobText)) return '算法与 AI 实践';
    if (/前端|客户端|鸿蒙|harmonyos|arkts/.test(jobText)) return '客户端工程实践';
    if (/后端|服务端|分布式|微服务/.test(jobText)) return '后端工程实践';
    if (/产品|需求|用户研究/.test(jobText)) return '产品分析与推进';
    if (/运营|增长|内容/.test(jobText)) return '运营策略与复盘';
    return '岗位核心实践';
  }

  private recommendedInterviewType(): string {
    const jobText = `${this.trackedJobTitle} ${this.trackedJobDescription} ${this.targetJob}`.toLowerCase();
    if (/开发|研发|工程|算法|机器学习|深度学习|大模型|数据|测试|架构|前端|后端|客户端|鸿蒙|java|python|react|sql/.test(jobText)) {
      return '技术面';
    }
    if (/人力|行政|招聘|组织|员工关系|hr/.test(jobText)) return 'HR面';
    return '综合面';
  }

  private recommendedInterviewReason(): string {
    const recommended = this.recommendedInterviewType();
    if (recommended === '技术面') return 'JD 包含明确的技术、工程或数据能力要求，建议优先核验方案与个人贡献。';
    if (recommended === 'HR面') return '岗位更侧重组织协作与职业动机，建议优先练习行为问题。';
    return '岗位同时包含职责理解与经历迁移要求，建议先进行综合面。';
  }

  private applyRecommendedInterviewPlan(): void {
    this.interviewSection = 0;
    this.interviewType = this.recommendedInterviewType();
    this.interviewDifficulty = this.applicationStage === 'interview' ? '高压' : '标准';
    this.interviewDurationMinutes = this.trackedJobDescription.trim().length >= 300 ? 20 : 15;
  }

  private interviewRequirementFocuses(): string[] {
    const jobText = `${this.trackedJobTitle} ${this.trackedJobDescription}`.toLowerCase();
    const resumeText = this.interviewResumeText().toLowerCase();
    const focuses: string[] = [];
    const primarySkill = this.primarySkillRequirement();
    if (primarySkill) focuses.push(`${this.skillDisplayName(primarySkill)}实践`);
    if (/算法|机器学习|深度学习|大模型|人工智能|ai/.test(jobText) && !focuses.includes('算法与模型能力')) {
      focuses.push('算法与模型能力');
    }
    if (/架构|性能|并发|稳定性|工程化|部署|监控/.test(jobText)) focuses.push('工程设计与稳定性');
    if (/数据|指标|分析|实验|ab测试|a\/b/.test(jobText)) focuses.push('数据分析与验证');
    if (/用户|需求|产品|业务|增长/.test(jobText)) focuses.push('业务理解与用户价值');
    if (/沟通|协作|跨部门|团队/.test(jobText)) focuses.push('协作与推进');
    if (/本科|硕士|博士|学历/.test(jobText)) focuses.push('教育与基础条件');
    if (primarySkill && !resumeText.includes(primarySkill)) focuses.push(`${this.skillDisplayName(primarySkill)}证据缺口`);
    if (focuses.length === 0) {
      focuses.push(this.interviewCoreCompetencyLabel());
      focuses.push('责任边界与成果证据');
      focuses.push('岗位适配与成长计划');
    }
    return focuses.slice(0, 5);
  }

  private interviewResumeVersionName(): string {
    const version = this.boundResumeVersion();
    if (version) return version.name;
    return this.resumeSummary.trim().length >= 30 ? '当前简历画像' : '基础岗位画像';
  }

  private interviewResumeText(): string {
    const version = this.boundResumeVersion();
    return version ? version.content : this.resumeSummary;
  }

  private interviewCompetencyBlueprint(): NativeInterviewCompetency[] {
    const coreLabel = this.interviewCoreCompetencyLabel();
    let competencies: NativeInterviewCompetency[] = [
      new NativeInterviewCompetency('core', coreLabel, '核验与目标岗位最相关的一段真实经历。'),
      new NativeInterviewCompetency('evidence', '责任与成果证据', '说明个人行动、产出物、结果和验证方式。'),
      new NativeInterviewCompetency('relevance', '岗位适配与迁移', '解释经历如何支撑岗位职责和业务目标。'),
      new NativeInterviewCompetency('problem-solving', '问题解决与复盘', '说明判断依据、推进过程、风险和改进。'),
      new NativeInterviewCompetency('growth', '学习与成长计划', '给出可执行、可验证的能力补齐路径。'),
    ];
    if (this.interviewType === '技术面') {
      competencies = [
        new NativeInterviewCompetency('technical-core', coreLabel, '核验真实项目中的技术实现和个人贡献。'),
        new NativeInterviewCompetency('tradeoff', '方案设计与取舍', '说明替代方案、约束条件和选择依据。'),
        new NativeInterviewCompetency('debugging', '问题定位与验证', '说明排查步骤、验证方法和修复结果。'),
        new NativeInterviewCompetency('scale', '系统扩展与边界', '讨论规模变化、性能瓶颈和演进方案。'),
        new NativeInterviewCompetency('risk', '工程风险与复盘', '识别风险并说明监控、降级和改进。'),
      ];
    } else if (this.interviewType === 'HR面') {
      competencies = [
        new NativeInterviewCompetency('motivation', '求职动机', '核验岗位理解、选择依据和真实兴趣。'),
        new NativeInterviewCompetency('collaboration', '团队协作', '说明分歧处理、沟通方式和共同结果。'),
        new NativeInterviewCompetency('pressure', '压力与适应', '说明压力情境中的判断、行动和调整。'),
        new NativeInterviewCompetency('feedback', '反馈与成长', '说明如何接收反馈并验证改进效果。'),
        new NativeInterviewCompetency('planning', '职业规划', '说明一年内希望形成的可验证成果。'),
      ];
    }
    if (this.hasScoredActiveGrowthPrescription()) {
      const focusDimension = this.activeGrowthPrescriptionTask()?.focusDimension || 'general';
      competencies[0] = new NativeInterviewCompetency(
        `retest-${focusDimension}`,
        `专项复测：${this.growthFocusLabel(focusDimension)}`,
        '优先验证专项训练后是否形成可观察的回答变化。',
      );
    }
    return competencies;
  }

  private plannedInterviewCompetencies(): NativeInterviewCompetency[] {
    return this.interviewCompetencyBlueprint().slice(0, this.interviewTargetRounds());
  }

  private plannedInterviewCompetencyLabels(): string[] {
    const labels: string[] = [];
    for (const competency of this.plannedInterviewCompetencies()) labels.push(competency.label);
    return labels;
  }

  private interviewCompetencyForRound(round: number): NativeInterviewCompetency {
    const competencies = this.plannedInterviewCompetencies();
    const index = Math.max(0, Math.min(competencies.length - 1, round - 1));
    return competencies[index];
  }

  private coveredInterviewCompetencyLabels(turnCount: number = this.interviewTurns.length): string[] {
    const labels = this.plannedInterviewCompetencyLabels();
    return labels.slice(0, Math.max(0, Math.min(turnCount, labels.length)));
  }

  private hasInterviewCompetencySpecificSignal(competencyKey: string, answer: string): boolean {
    let normalizedKey = competencyKey;
    if (normalizedKey.startsWith('retest-')) normalizedKey = normalizedKey.slice(7);
    if (normalizedKey === 'tradeoff') return /方案|选择|取舍|替代|约束|权衡|成本/.test(answer);
    if (normalizedKey === 'debugging' || normalizedKey === 'problem-solving') {
      return /排查|定位|日志|监控|复现|验证|根因|修复/.test(answer);
    }
    if (normalizedKey === 'scale') return /并发|性能|瓶颈|扩展|容量|缓存|吞吐|延迟|规模/.test(answer);
    if (normalizedKey === 'risk') return /风险|监控|告警|降级|回滚|预案|复盘/.test(answer);
    if (normalizedKey === 'collaboration') return /沟通|协作|分歧|对齐|团队|共识|配合/.test(answer);
    if (normalizedKey === 'pressure') return /压力|优先级|截止|突发|调整|应对|取舍/.test(answer);
    if (normalizedKey === 'feedback') return /反馈|建议|改进|复盘|调整|验证|成长/.test(answer);
    if (normalizedKey === 'planning' || normalizedKey === 'growth') {
      return /目标|阶段|计划|行动|验证|复盘|里程碑|周期/.test(answer);
    }
    if (normalizedKey === 'structure') return /背景|任务|行动|结果|复盘|首先|然后|最终/.test(answer);
    if (normalizedKey === 'evidence') return /代码|仓库|报告|日志|测试|数据|链接|截图|文档/.test(answer);
    if (normalizedKey === 'clarity') return /首先|其次|然后|最后|结论|因此|最终/.test(answer);
    if (normalizedKey === 'technical-core') return /架构|接口|模块|算法|实现|技术|测试|部署/.test(answer);
    return /岗位|职责|业务|用户|价值|需求|目标|选择|匹配/.test(answer);
  }

  private evaluateInterviewCompetencyTurn(
    competency: NativeInterviewCompetency,
    turn: NativeInterviewTurn,
    round: number,
  ): NativeInterviewCompetencyResult {
    const answer = turn.answer.trim().replace(/\s+/g, ' ');
    const hasOwnership = /我负责|我设计|我实现|我完成|我主导|我排查|我推动|我协调|独立/.test(answer);
    const hasAction = /负责|设计|实现|分析|验证|修复|构建|协调|推进|完成|测试|优化|落地/.test(answer);
    const hasOutcome = /提升|降低|增长|覆盖|产出|上线|发布|交付|完成|结果|解决/.test(answer);
    const hasMetric = /\d|%|百分之|倍|分钟|小时|天|周|月|人次|用户/.test(answer);
    const hasEvidence = /代码|仓库|报告|日志|测试|数据|链接|截图|文档|原型|演示/.test(answer);
    const hasReflection = /复盘|改进|如果重来|不足|取舍|风险|反思|下一步/.test(answer);
    const hasSpecificSignal = this.hasInterviewCompetencySpecificSignal(competency.key, answer);
    let score = 22;
    if (answer.length >= 30) score += 8;
    if (answer.length >= 80) score += 8;
    if (answer.length >= 140) score += 6;
    if (hasOwnership) score += 14;
    if (hasAction) score += 8;
    if (hasOutcome) score += 9;
    if (hasMetric) score += 11;
    if (hasEvidence) score += 10;
    if (hasSpecificSignal) score += 10;
    if (hasReflection) score += 5;
    score = Math.min(96, score);
    const status = score >= 80
      ? '证据较充分'
      : (score >= 65 ? '已有证据' : (score >= 50 ? '需要补证' : '证据不足'));
    let gap = '继续补充边界条件和可复核细节。';
    if (answer.length < 30) gap = '补充一段完整的真实经历，说明背景、行动和结果。';
    else if (!hasOwnership) gap = '明确你本人负责的部分，以及与团队工作的责任边界。';
    else if (!hasOutcome) gap = '补充行动带来的结果、影响或最终交付。';
    else if (!hasSpecificSignal) gap = `围绕“${competency.label}”补充判断依据和关键细节。`;
    else if (!hasMetric) gap = '补充时间、规模、比例或变化幅度等结果数据。';
    else if (!hasEvidence) gap = '补充代码、报告、日志、测试或数据等可核验材料。';
    return new NativeInterviewCompetencyResult(
      competency.key,
      competency.label,
      round,
      score,
      status,
      answer.slice(0, 110),
      gap,
    );
  }

  private buildInterviewCompetencyResults(turns: NativeInterviewTurn[]): NativeInterviewCompetencyResult[] {
    const competencies = this.plannedInterviewCompetencies();
    const results: NativeInterviewCompetencyResult[] = [];
    for (let index = 0; index < turns.length && index < competencies.length; index += 1) {
      results.push(this.evaluateInterviewCompetencyTurn(competencies[index], turns[index], index + 1));
    }
    return results;
  }

  private growthRetestQuestion(): string {
    const focusDimension = this.activeGrowthPrescriptionTask()?.focusDimension || 'general';
    if (focusDimension === 'structure') {
      return '请重新选择一段最能支撑目标岗位的真实经历，按背景、任务、行动、结果和复盘完整作答。';
    }
    if (focusDimension === 'evidence') {
      return '请选择一个真实项目，明确你的责任边界、可核验产出物和至少一个结果数据。';
    }
    if (focusDimension === 'relevance') {
      return '请选择一段真实经历，说明它如何对应当前岗位的核心职责、技能要求和业务目标。';
    }
    if (focusDimension === 'clarity') {
      return '请在 90 秒内先给出结论，再说明一段真实经历中的关键行动、结果和复盘。';
    }
    return '';
  }

  private createGrowthPlan(interviewFeedback: string = ''): void {
    const feedbackSummary = interviewFeedback.trim()
      ? interviewFeedback.trim().slice(0, 180)
      : '围绕背景、行动、结果和复盘重新组织回答。';
    const jobKey = this.activeJobContextKey();
    const jobTitle = this.activeJobContextTitle();
    const planId = Date.now();
    const assessment = this.currentInterviewAssessment();
    const focusDimension = this.weakestInterviewDimension(assessment);
    const focusLabel = this.growthFocusLabel(focusDimension);
    const baselineScore = this.interviewAssessmentScore(assessment, focusDimension);
    const targetScore = Math.min(95, baselineScore + 12);
    const sourceInterviewId = this.currentInterviewSessionId;
    let firstTitle = '重写一段 STAR 核心回答';
    let firstDescription = '把一个真实项目重写为背景、任务、行动、结果和复盘五段。';
    let firstRequirement = '提交回答文档或复盘记录链接，标出五段结构和个人行动。';
    let secondTitle = '补齐行动与结果证据';
    let secondDescription = '为核心回答补充个人责任边界、结果数字和可核验产出物。';
    let secondRequirement = '提交代码、报告或演示链接，并说明个人动作与结果数据。';
    let thirdTitle = '完成一次限时表达复盘';
    let thirdDescription = feedbackSummary;
    let thirdRequirement = '提交 90 秒回答录音、视频或逐字稿链接，并写明本次改进点。';
    if (focusDimension === 'evidence') {
      firstTitle = '建立项目证据清单';
      firstDescription = '整理一个最能支撑目标岗位的项目，列出责任、产出物、结果和来源。';
      firstRequirement = '提交证据清单或项目文档链接，至少包含一项可核验产出物。';
      secondTitle = '补充责任边界与结果数字';
      secondDescription = '把“参与”改写为本人负责的动作，并补充范围、效率或质量结果。';
      secondRequirement = '提交修改后的回答或简历片段链接，包含个人动作和至少一个结果数字。';
      thirdTitle = '完成一次证据追问演练';
      thirdRequirement = '提交追问演练记录链接，回答“由谁完成、如何验证、结果如何”。';
    } else if (focusDimension === 'relevance') {
      firstTitle = '拆解岗位核心要求';
      firstDescription = `从“${jobTitle}”岗位信息中提取三项核心职责和对应成功标准。`;
      firstRequirement = '提交岗位要求拆解文档链接，标出职责、技能和业务结果。';
      secondTitle = '建立经历与岗位映射';
      secondDescription = '把一段真实经历逐项映射到岗位要求，删除无法支撑的泛化表述。';
      secondRequirement = '提交经历映射表链接，每项要求至少对应一个真实行动或产出物。';
      thirdTitle = '完成一次岗位化回答复盘';
      thirdRequirement = '提交岗位化回答记录链接，明确说明经历为何能支撑该岗位。';
    } else if (focusDimension === 'clarity') {
      firstTitle = '压缩 90 秒核心回答';
      firstDescription = '先给结论，再保留最关键的背景、行动和结果，删除无关细节。';
      firstRequirement = '提交 90 秒逐字稿或录音链接，首句必须给出明确结论。';
      secondTitle = '补充顺序与转折标记';
      secondDescription = '使用“首先、随后、最终、复盘”组织回答，让关键动作易于跟随。';
      secondRequirement = '提交修改前后对照链接，并标出结构连接词与删减内容。';
      thirdTitle = '完成一次限时清晰表达';
      thirdRequirement = '提交限时回答录音、视频或逐字稿链接，并记录实际时长。';
    }
    const retainedTasks = this.growthTasks.filter((task: NativeGrowthTask) => task.jobKey !== jobKey);
    this.growthTasks = [
      new NativeGrowthTask(`growth-${planId}-1`, firstTitle, firstDescription, firstRequirement, 8, 'todo', jobKey, jobTitle, focusDimension, baselineScore, targetScore, sourceInterviewId),
      new NativeGrowthTask(`growth-${planId}-2`, secondTitle, secondDescription, secondRequirement, 7, 'todo', jobKey, jobTitle, focusDimension, baselineScore, targetScore, sourceInterviewId),
      new NativeGrowthTask(`growth-${planId}-3`, thirdTitle, thirdDescription, thirdRequirement, 6, 'todo', jobKey, jobTitle, focusDimension, baselineScore, targetScore, sourceInterviewId),
      ...retainedTasks,
    ];
    this.refreshActiveGrowthCoverage();
    this.growthHistory = [`已根据“${jobTitle}”面试生成${focusLabel}专项处方，基线 ${baselineScore} 分，复测目标 ${targetScore} 分`, ...this.growthHistory];
    this.growthHistoryJobKeys = [jobKey, ...this.growthHistoryJobKeys];
    this.growthMessage = `已围绕“${focusLabel}”生成 3 条专项任务。`;
    void this.saveWorkspace();
  }

  private fallbackInterviewQuestion(round: number): string {
    const retestQuestion = round === 1 && this.hasScoredActiveGrowthPrescription()
      ? this.growthRetestQuestion()
      : '';
    const comprehensive: string[] = [
      `请选择一段最能体现“${this.interviewCoreCompetencyLabel()}”的真实经历，说明背景、你的职责、关键行动和结果。`,
      '你刚才提到的行动中，哪一部分由你独立负责？请说明产出物和验证方式。',
      '这段经历和目标岗位的要求有什么直接关系？如果重来一次，你会改进什么？',
      '请讲一次你主动发现并解决问题的经历，说明判断依据、推进过程和最终影响。',
      '如果明天进入这个岗位，你最先需要补齐什么能力？请给出具体的学习和验证计划。',
    ];
    const technical: string[] = [
      `请选一个最能体现“${this.interviewCoreCompetencyLabel()}”的真实项目，说明核心方案、关键难点、你的实现和最终结果。`,
      '为什么选择这个方案？请说明替代方案、关键取舍以及你如何验证它有效。',
      '请讲一次问题定位过程，说明观察到的现象、排查步骤、修复结果和复盘。',
      '如果数据规模或并发量提升十倍，你认为当前方案最先出现的瓶颈是什么？如何验证？',
      '请说明这个项目目前仍存在的一项工程风险，以及你会如何设计监控和降级方案。',
    ];
    const hr: string[] = [
      '你为什么选择这个岗位方向？请结合真实经历、岗位理解和长期规划回答。',
      '请讲一次团队协作中的分歧或压力情境，说明你如何沟通并推动结果。',
      '如果实际工作和预期存在差异，你会如何判断、沟通和调整？',
      '请讲一次你收到负面反馈后的真实经历，说明你如何理解、行动并验证改进效果。',
      '未来一年你希望在这个岗位上形成什么可验证的能力成果？你准备如何推进？',
    ];
    let questions = comprehensive;
    if (this.interviewType === '技术面') questions = technical;
    if (this.interviewType === 'HR面') questions = hr;
    const question = retestQuestion || questions[Math.max(0, round - 1) % questions.length];
    if (this.interviewDifficulty === '基础') return `${question} 可以按“背景、任务、行动、结果”依次作答。`;
    if (this.interviewDifficulty === '高压') return `${question} 请同时说明你的责任边界、反例或失败风险。`;
    return question;
  }

  private interviewTargetRounds(): number {
    if (this.interviewDurationMinutes <= 10) return 3;
    if (this.interviewDurationMinutes <= 15) return 4;
    return 5;
  }

  private normalizeInterviewDurationForSetup(): void {
    if (this.interviewDurationMinutes <= 10) {
      this.interviewDurationMinutes = 10;
    } else if (this.interviewDurationMinutes <= 15) {
      this.interviewDurationMinutes = 15;
    } else {
      this.interviewDurationMinutes = 20;
    }
  }

  private interviewerPresenceLabel(): string {
    if (this.interviewSessionPhase === 'paused') return '会话已暂停';
    if (this.interviewSessionPhase === 'completed') return '面试已完成';
    if (this.interviewAvatarState === 'talking') return '面试官提问中';
    if (this.interviewAvatarState === 'listening') return '正在聆听你的回答';
    if (this.interviewAvatarState === 'thinking' || this.interviewLoading) return '正在准备追问';
    if (this.interviewAvatarState === 'greeting') return '面试即将开始';
    if (this.interviewTurns.length >= this.interviewTargetRounds()) return '本轮问答已完成';
    if (this.interviewInputNotice) return '语音暂不可用';
    if (this.interviewAnswer.trim().length > 0) return `已记录 ${this.interviewAnswer.trim().length} 字`;
    return this.interviewStarted ? '轮到你回答' : '准备就绪';
  }

  private interviewerPresenceColor(): string {
    if (this.interviewSessionPhase === 'paused') return '#F2B84B';
    if (this.speechActive || this.interviewAvatarState === 'listening') return '#52D7A5';
    if (this.interviewSpeaking || this.interviewAvatarState === 'talking') return '#75A7FF';
    if (this.interviewLoading || this.interviewAvatarState === 'thinking') return '#F2B84B';
    return '#E7EDF5';
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
    this.interviewTextFallbackVisible = false;
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
    if (!this.hasArchivedCurrentInterview()) this.deleteLocalInterviewVideo(this.currentInterviewVideoUri);
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
    this.currentInterviewVideoUri = '';
    this.currentInterviewVideoDurationSeconds = 0;
    this.currentInterviewVideoSizeBytes = 0;
    this.candidateVideoRecording = false;
    void this.setInterviewWindowMode(false);
    void this.saveWorkspace();
  }

  private requestEndInterview(): void {
    const answer = this.interviewAnswer.trim();
    const hasIncompleteDraft = answer.length > 0 && this.validateInterviewAnswer(answer).length > 0;
    const hasAnswer = this.interviewTurns.length > 0 || (answer.length > 0 && !hasIncompleteDraft);
    this.showConfirmDialog(
      hasAnswer ? '提前结束并生成反馈？' : '结束本轮面试？',
      hasAnswer
        ? hasIncompleteDraft
          ? '已提交的回答会用于生成反馈，当前未完成草稿不会纳入复盘。'
          : '当前已完成的回答会用于生成本轮反馈，未完成的轮次将标记为提前结束。'
        : hasIncompleteDraft
          ? '当前回答尚未达到提交要求，结束后不会生成反馈。'
          : '当前还没有可用于复盘的回答，结束后不会生成反馈。',
      hasAnswer ? '结束并生成反馈' : '确认结束',
      () => {
        if (hasAnswer) void this.finishInterview(true);
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

  private localInterviewImprovedAnswer(turns: NativeInterviewTurn[]): string {
    if (turns.length === 0) return '';
    const factualDraft = turns[0].answer.trim().replace(/\s+/g, ' ').slice(0, 220);
    return [
      `事实底稿：${factualDraft}`,
      'STAR 改写骨架：',
      '背景：用一句话说明项目、目标和约束。',
      '任务：明确你本人承担的责任与成功标准。',
      '行动：按顺序写出关键判断、执行步骤和取舍。',
      '结果：仅填写回答中已经出现的数字、交付或影响；缺失处标记“待补充”。',
      '复盘：说明验证方式、风险和下一次会如何改进。',
    ].join('\n');
  }

  private assessInterview(turns: NativeInterviewTurn[] = this.interviewTurns): NativeInterviewAssessment {
    let combined = '';
    let totalLength = 0;
    for (const turn of turns) {
      combined += ` ${turn.answer}`;
      totalLength += turn.answer.trim().length;
    }
    const turnCount = turns.length;
    const averageLength = turnCount > 0 ? Math.round(totalLength / turnCount) : 0;
    const hasContext = /背景|场景|当时|项目|任务|目标|需求/.test(combined);
    const hasOwnership = /我负责|我设计|我实现|我完成|独立|主导|推进|排查|协调/.test(combined);
    const hasAction = /负责|设计|实现|分析|验证|修复|构建|协调|推进|完成|测试|优化/.test(combined);
    const hasOutcome = /提升|降低|增长|覆盖|产出|上线|发布|用户|样本|结果|交付/.test(combined);
    const hasMetric = /\d|%|百分之|倍|分钟|小时|天|人/.test(combined);
    const hasEvidence = /代码|仓库|报告|演示|文档|链接|测试|数据|日志|截图/.test(combined);
    const hasReflection = /复盘|改进|如果重来|不足|取舍|风险|反思|优化/.test(combined);
    const hasRoleConnection = /岗位|业务|用户|需求|团队|工程|开发|产品|技术|职责/.test(combined);
    const hasSequence = /首先|其次|然后|最后|第一|第二|因此|最终/.test(combined);

    const structureScore = Math.min(96, 34 + turnCount * 7 + (hasContext ? 12 : 0) +
      (hasAction ? 14 : 0) + (hasOutcome ? 13 : 0) + (hasReflection ? 8 : 0));
    const evidenceScore = Math.min(95, 28 + turnCount * 4 + (hasOwnership ? 16 : 0) +
      (hasMetric ? 17 : 0) + (hasEvidence ? 14 : 0) + (hasOutcome ? 12 : 0));
    const relevanceScore = Math.min(94, 38 + turnCount * 6 + (hasRoleConnection ? 18 : 0) +
      (hasAction ? 10 : 0) + (hasReflection ? 8 : 0));
    const clarityScore = Math.min(95, 35 + turnCount * 6 + (averageLength >= 80 ? 12 : 0) +
      (averageLength >= 160 ? 10 : 0) + (hasSequence ? 12 : 0) + (hasAction && hasOutcome ? 8 : 0));
    const overallScore = Math.round((structureScore + evidenceScore + relevanceScore + clarityScore) / 4);

    let strongestLabel = '回答结构';
    let strongestScore = structureScore;
    if (evidenceScore > strongestScore) {
      strongestLabel = '证据可信度';
      strongestScore = evidenceScore;
    }
    if (relevanceScore > strongestScore) {
      strongestLabel = '岗位关联';
      strongestScore = relevanceScore;
    }
    if (clarityScore > strongestScore) strongestLabel = '表达清晰度';

    let priorityLabel = '按 STAR 补齐背景、行动、结果与复盘。';
    let priorityScore = structureScore;
    if (evidenceScore < priorityScore) {
      priorityLabel = '补充个人责任边界、结果数字和可核验材料。';
      priorityScore = evidenceScore;
    }
    if (relevanceScore < priorityScore) {
      priorityLabel = '把每段经历与目标岗位要求建立直接联系。';
      priorityScore = relevanceScore;
    }
    if (clarityScore < priorityScore) priorityLabel = '先给结论，再按顺序说明关键动作与结果。';

    const evidenceLabel = evidenceScore >= 76
      ? '证据链较完整'
      : (evidenceScore >= 60 ? '存在可核验线索' : '需要补充核验材料');
    return new NativeInterviewAssessment(
      overallScore,
      structureScore,
      evidenceScore,
      relevanceScore,
      clarityScore,
      strongestLabel,
      priorityLabel,
      evidenceLabel,
      '基础训练评估',
      'local-v1',
      [],
      this.localInterviewImprovedAnswer(turns),
    );
  }

  private activeJobContextKey(): string {
    if (this.applicationJobKey) return this.applicationJobKey;
    return `profile-${(this.trackedJobTitle || this.targetJob || '目标岗位').trim().toLowerCase()}`;
  }

  private activeJobContextTitle(): string {
    return (this.trackedJobTitle || this.targetJob || '目标岗位').trim();
  }

  private activeJobContextLabel(): string {
    return this.trackedJobCompany
      ? `${this.trackedJobCompany} · ${this.activeJobContextTitle()}`
      : this.activeJobContextTitle();
  }

  private interviewJobKey(): string {
    return this.activeJobContextKey();
  }

  private activeInterviewSessions(): NativeInterviewSessionRecord[] {
    const jobKey = this.activeJobContextKey();
    const sessions: NativeInterviewSessionRecord[] = [];
    for (const session of this.interviewSessions) {
      if (session.jobKey === jobKey) sessions.push(session);
    }
    return sessions;
  }

  private activeGrowthTasks(): NativeGrowthTask[] {
    const jobKey = this.activeJobContextKey();
    const tasks: NativeGrowthTask[] = [];
    for (const task of this.growthTasks) {
      if (task.jobKey === jobKey) tasks.push(task);
    }
    return tasks;
  }

  private activeGrowthEvidenceRecords(): NativeGrowthEvidenceRecord[] {
    const jobKey = this.activeJobContextKey();
    const records: NativeGrowthEvidenceRecord[] = [];
    for (const record of this.growthEvidenceRecords) {
      if (record.jobKey === jobKey) records.push(record);
    }
    return records;
  }

  private activeGrowthPrescriptionTask(): NativeGrowthTask | undefined {
    const tasks = this.activeGrowthTasks();
    return tasks.length > 0 ? tasks[0] : undefined;
  }

  private allActiveGrowthTasksVerified(): boolean {
    const tasks = this.activeGrowthTasks();
    if (tasks.length === 0) return false;
    for (const task of tasks) {
      if (task.status !== 'verified') return false;
    }
    return true;
  }

  private hasScoredActiveGrowthPrescription(): boolean {
    const task = this.activeGrowthPrescriptionTask();
    return this.allActiveGrowthTasksVerified() && task !== undefined &&
      task.sourceInterviewId.length > 0 && task.focusDimension !== 'general' &&
      task.baselineScore > 0 && task.targetScore > 0;
  }

  private hasArchivedCurrentInterview(): boolean {
    if (!this.currentInterviewSessionId) return false;
    for (const session of this.interviewSessions) {
      if (session.id === this.currentInterviewSessionId) return true;
    }
    return false;
  }

  private archiveCurrentInterviewSession(): void {
    if (this.interviewTurns.length === 0 || !this.interviewFeedback) return;
    if (!this.currentInterviewSessionId) this.currentInterviewSessionId = `interview-${Date.now()}`;
    const assessment = this.currentInterviewAssessment();
    const completedAtEpoch = Date.now();
    const record = new NativeInterviewSessionRecord(
      this.currentInterviewSessionId,
      this.interviewJobKey(),
      this.trackedJobTitle || this.targetJob || '目标岗位',
      this.trackedJobCompany,
      this.interviewType,
      this.interviewDifficulty,
      this.interviewDurationMinutes,
      this.interviewElapsedSeconds,
      this.interviewTurns,
      this.interviewFeedback,
      this.interviewModelName,
      assessment.overallScore,
      assessment.structureScore,
      assessment.evidenceScore,
      assessment.relevanceScore,
      assessment.clarityScore,
      assessment.strongestLabel,
      assessment.priorityLabel,
      assessment.evidenceLabel,
      assessment.assessmentSource,
      assessment.assessmentVersion,
      assessment.evidenceReferences,
      new Date(completedAtEpoch).toLocaleString('zh-CN'),
      completedAtEpoch,
      this.currentInterviewVideoUri.length > 0,
      this.currentInterviewVideoUri,
      this.currentInterviewVideoDurationSeconds,
      this.currentInterviewVideoSizeBytes,
      this.hasScoredActiveGrowthPrescription() ? (this.activeGrowthPrescriptionTask()?.focusDimension || '') : '',
      this.hasScoredActiveGrowthPrescription() ? (this.activeGrowthPrescriptionTask()?.baselineScore || 0) : 0,
      this.hasScoredActiveGrowthPrescription() ? (this.activeGrowthPrescriptionTask()?.targetScore || 0) : 0,
      this.plannedInterviewCompetencyLabels(),
      Math.min(this.interviewTurns.length, this.interviewTargetRounds()),
      this.buildInterviewCompetencyResults(this.interviewTurns),
      this.trackedJobDescription,
      this.boundResumeVersion()?.id || '',
      this.interviewResumeVersionName(),
      this.interviewRequirementFocuses(),
      assessment.improvedAnswer,
    );
    const retained: NativeInterviewSessionRecord[] = [record];
    for (const session of this.interviewSessions) {
      if (session.id !== record.id && retained.length < 30) retained.push(session);
    }
    this.interviewSessions = retained;
  }

  private currentInterviewAssessment(): NativeInterviewAssessment {
    return this.interviewAssessment.overallScore > 0
      ? this.interviewAssessment
      : this.assessInterview(this.interviewTurns);
  }

  private assessmentFromEvaluation(evaluation: NativeInterviewEvaluation): NativeInterviewAssessment {
    return new NativeInterviewAssessment(
      evaluation.overallScore,
      evaluation.structureScore,
      evaluation.evidenceScore,
      evaluation.relevanceScore,
      evaluation.clarityScore,
      evaluation.strongestLabel,
      evaluation.priorityLabel,
      evaluation.evidenceLabel,
      '个性化训练评估',
      evaluation.schemaVersion,
      evaluation.evidenceReferences,
      evaluation.improvedAnswer,
    );
  }

  private restoreCurrentInterviewAssessment(): void {
    for (const session of this.interviewSessions) {
      if (session.id === this.currentInterviewSessionId) {
        this.interviewAssessment = new NativeInterviewAssessment(
          session.overallScore,
          session.structureScore,
          session.evidenceScore,
          session.relevanceScore,
          session.clarityScore,
          session.strongestLabel,
          session.priorityLabel,
          session.evidenceLabel,
          session.assessmentSource || '基础训练评估',
          session.assessmentVersion || 'local-v1',
          session.evidenceReferences || [],
          session.improvedAnswer || '',
        );
        return;
      }
    }
    this.interviewAssessment = this.assessInterview(this.interviewTurns);
  }

  private previousInterviewSession(record: NativeInterviewSessionRecord): NativeInterviewSessionRecord | undefined {
    let currentFound = false;
    for (const session of this.interviewSessions) {
      if (session.id === record.id) {
        currentFound = true;
        continue;
      }
      if (currentFound && session.jobKey === record.jobKey) return session;
    }
    return undefined;
  }

  private currentInterviewSessionRecord(): NativeInterviewSessionRecord | undefined {
    for (const session of this.interviewSessions) {
      if (session.id === this.currentInterviewSessionId) return session;
    }
    return undefined;
  }

  private currentInterviewCompetencyLabels(): string[] {
    const record = this.currentInterviewSessionRecord();
    if (record && record.competencyLabels && record.competencyLabels.length > 0) return record.competencyLabels;
    return this.plannedInterviewCompetencyLabels();
  }

  private currentInterviewCompetencyCoveredCount(): number {
    const record = this.currentInterviewSessionRecord();
    if (record && typeof record.competencyCoveredCount === 'number') {
      return Math.min(record.competencyCoveredCount, this.currentInterviewCompetencyLabels().length);
    }
    return Math.min(this.interviewTurns.length, this.currentInterviewCompetencyLabels().length);
  }

  private currentInterviewCompetencyResults(): NativeInterviewCompetencyResult[] {
    const record = this.currentInterviewSessionRecord();
    if (record) return record.competencyResults || [];
    return this.buildInterviewCompetencyResults(this.interviewTurns);
  }

  private currentInterviewCompetencyResult(index: number): NativeInterviewCompetencyResult | undefined {
    const round = index + 1;
    for (const result of this.currentInterviewCompetencyResults()) {
      if (result.round === round) return result;
    }
    return undefined;
  }

  private competencyScoreColor(score: number): ResourceColor {
    if (score >= 80) return $r('app.color.km_success');
    if (score >= 65) return $r('app.color.km_primary_action');
    if (score >= 50) return $r('app.color.km_warning');
    return $r('app.color.km_danger');
  }

  private weakestInterviewCompetencyResult(
    record: NativeInterviewSessionRecord,
  ): NativeInterviewCompetencyResult | undefined {
    if (!record.competencyResults || record.competencyResults.length === 0) return undefined;
    let weakest = record.competencyResults[0];
    for (const result of record.competencyResults) {
      if (result.score < weakest.score) weakest = result;
    }
    return weakest;
  }

  private weakestInterviewCompetencySummary(record: NativeInterviewSessionRecord): string {
    const weakest = this.weakestInterviewCompetencyResult(record);
    return weakest ? `${weakest.label} · ${weakest.score} 分 · ${weakest.status}` : '';
  }

  private currentRetestRecord(): NativeInterviewSessionRecord | undefined {
    const record = this.currentInterviewSessionRecord();
    if (!record || !record.trainingFocusDimension || record.trainingFocusDimension === 'general' ||
      record.trainingBaselineScore <= 0 || record.trainingTargetScore <= 0) return undefined;
    return this.previousInterviewSession(record) ? record : undefined;
  }

  private interviewRecordDimensionScore(record: NativeInterviewSessionRecord, dimension: string): number {
    if (dimension === 'evidence') return record.evidenceScore;
    if (dimension === 'relevance') return record.relevanceScore;
    if (dimension === 'clarity') return record.clarityScore;
    return record.structureScore;
  }

  private currentRetestDimensionDelta(): number {
    const record = this.currentRetestRecord();
    if (!record) return 0;
    return this.interviewRecordDimensionScore(record, record.trainingFocusDimension) - record.trainingBaselineScore;
  }

  private currentRetestResultLabel(): string {
    const delta = this.currentRetestDimensionDelta();
    if (delta > 0) return `专项维度较训练前 +${delta} 分`;
    if (delta < 0) return `专项维度较训练前 ${delta} 分`;
    return '专项维度与训练前持平';
  }

  private interviewRetestGoalLabel(record: NativeInterviewSessionRecord): string {
    if (!record.trainingFocusDimension || record.trainingFocusDimension === 'general' ||
      record.trainingTargetScore <= 0) return '';
    const score = this.interviewRecordDimensionScore(record, record.trainingFocusDimension);
    const gap = score - record.trainingTargetScore;
    if (gap >= 0) return gap > 0 ? `已达标 · 超出 ${gap} 分` : '已达标 · 达到目标';
    return `未达标 · 距目标 ${Math.abs(gap)} 分`;
  }

  private currentRetestGoalLabel(): string {
    const record = this.currentRetestRecord();
    return record ? this.interviewRetestGoalLabel(record) : '';
  }

  private interviewTrendLabel(record: NativeInterviewSessionRecord): string {
    const previous = this.previousInterviewSession(record);
    if (!previous) return '同岗位首次训练';
    const comparison = this.interviewHistoryService.compare(this.interviewSessions, [previous.id, record.id]);
    if (!comparison.comparable) return '训练条件不同';
    const delta = comparison.metrics[0].delta;
    if (delta === '--') return '评分信息不完整';
    return delta === '持平' ? '与上次持平' : `较上次 ${delta} 分`;
  }

  private formattedSessionDuration(seconds: number): string {
    const minutes = Math.floor(Math.max(0, seconds) / 60);
    const remainingSeconds = Math.max(0, seconds) % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private formattedVideoSize(sizeBytes: number): string {
    if (sizeBytes <= 0) return '大小未知';
    if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private deleteLocalInterviewVideo(videoUri: string): void {
    if (!videoUri) return;
    try {
      const path = new fileUri.FileUri(videoUri).path;
      if (path && fileIo.accessSync(path)) fileIo.unlinkSync(path);
    } catch (error) {
      console.warn(`Interview video cleanup failed: ${String(error)}`);
    }
  }

  private deleteAllInterviewVideos(): void {
    const videoUris: string[] = [];
    if (this.currentInterviewVideoUri) videoUris.push(this.currentInterviewVideoUri);
    for (const session of this.interviewSessions) {
      if (session.videoUri && videoUris.indexOf(session.videoUri) < 0) videoUris.push(session.videoUri);
    }
    for (const videoUri of videoUris) this.deleteLocalInterviewVideo(videoUri);
  }

  private handleCandidateRecordingSaved(
    sessionId: string,
    videoUri: string,
    durationSeconds: number,
    sizeBytes: number,
  ): void {
    let matchedArchive = false;
    let previousUri = '';
    for (const session of this.interviewSessions) {
      if (session.id !== sessionId) continue;
      matchedArchive = true;
      previousUri = session.videoUri || '';
      session.videoRecorded = true;
      session.videoUri = videoUri;
      session.videoDurationSeconds = durationSeconds;
      session.videoSizeBytes = sizeBytes;
    }
    if (sessionId === this.currentInterviewSessionId) {
      previousUri = this.currentInterviewVideoUri || previousUri;
      this.currentInterviewVideoUri = videoUri;
      this.currentInterviewVideoDurationSeconds = durationSeconds;
      this.currentInterviewVideoSizeBytes = sizeBytes;
    } else if (!matchedArchive) {
      this.deleteLocalInterviewVideo(videoUri);
      return;
    }
    if (previousUri && previousUri !== videoUri) this.deleteLocalInterviewVideo(previousUri);
    this.interviewSessions = [...this.interviewSessions];
    this.showGlobalNotice('候选人录像已保存在本机，可在训练档案中回看。', 'success');
    void this.saveWorkspace();
  }

  private handleCandidateRecordingState(sessionId: string, recording: boolean): void {
    if (sessionId !== this.currentInterviewSessionId) return;
    this.candidateVideoRecording = recording;
  }

  private requestDeleteInterviewVideo(session: NativeInterviewSessionRecord): void {
    this.showConfirmDialog(
      '删除本机录像？',
      '将永久删除这次训练的候选人画面，问答、评分和反馈仍会保留。此操作无法撤销。',
      '删除录像',
      () => { this.deleteInterviewVideo(session.id); },
    );
  }

  private deleteInterviewVideo(sessionId: string): void {
    let videoUri = '';
    for (const session of this.interviewSessions) {
      if (session.id !== sessionId) continue;
      videoUri = session.videoUri || '';
      session.videoRecorded = false;
      session.videoUri = '';
      session.videoDurationSeconds = 0;
      session.videoSizeBytes = 0;
    }
    if (sessionId === this.currentInterviewSessionId) {
      videoUri = this.currentInterviewVideoUri || videoUri;
      this.currentInterviewVideoUri = '';
      this.currentInterviewVideoDurationSeconds = 0;
      this.currentInterviewVideoSizeBytes = 0;
    }
    this.deleteLocalInterviewVideo(videoUri);
    this.interviewSessions = [...this.interviewSessions];
    this.showGlobalNotice('本机录像已删除，训练记录仍保留。', 'success');
    void this.saveWorkspace();
  }

  private updateModelConsent(value: boolean): void {
    this.modelConsent = value;
    this.interviewMessage = value
      ? '已开启个性化追问，本次训练会使用已脱敏的岗位信息和作答内容。'
      : '已使用标准题库，本次回答仅保存在本机。';
  }

  private interviewEnhancementSummary(): string {
    return this.modelConsent ? '个性化追问已开启' : '标准题库 · 回答仅保存在本机';
  }

  private async startInterview(): Promise<void> {
    this.interviewInputNotice = '';
    if (this.interviewLoading || this.interviewStarted) return;
    this.interviewSection = 0;
    this.currentInterviewSessionId = `interview-${Date.now()}`;
    this.currentInterviewVideoUri = '';
    this.currentInterviewVideoDurationSeconds = 0;
    this.currentInterviewVideoSizeBytes = 0;
    this.candidateVideoRecording = false;
    this.interviewStarted = true;
    this.interviewRound = 1;
    this.interviewQuestion = this.fallbackInterviewQuestion(1);
    this.interviewTurns = [];
    this.interviewAnswer = '';
    this.interviewAnswerTouched = false;
    this.interviewAnswerError = '';
    this.interviewFeedback = '';
    this.interviewAssessment = new NativeInterviewAssessment(0, 0, 0, 0, 0, '', '', '');
    this.interviewTranscriptExpanded = false;
    this.interviewTextFallbackVisible = false;
    this.interviewModelName = this.modelConsent ? '个性化追问' : '标准题库';
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'active';
    this.interviewTimeExpired = false;
    this.interviewSessionUpdatedAt = Date.now();
    this.interviewSpeaking = false;
    this.interviewAvatarState = this.modelConsent ? 'thinking' : 'greeting';
    this.interviewSpeechMessage = this.modelConsent ? '正在生成岗位化首题' : '面试官正在向你问候';
    this.interviewMessage = this.modelConsent
      ? `已进入 ${this.interviewType}，正在准备第 1 轮岗位化问题。`
      : `${this.interviewType}已开始，共 ${this.interviewTargetRounds()} 轮，请结合真实经历回答。`;
    this.interviewLoading = this.modelConsent;
    void this.setInterviewWindowMode(true);

    if (this.modelConsent) {
      try {
        const result: NativeAiResult = await this.aiService.generateInterviewQuestion(
          `${this.interviewType}（${this.interviewDifficulty}难度）`,
          1,
          this.interviewTargetRounds(),
          this.interviewResumeText(),
          this.trackedJobTitle || this.targetJob,
          this.trackedJobDescription,
          this.interviewRequirementFocuses(),
          this.interviewCompetencyForRound(1).label,
          [],
          [],
        );
        if (result.ok) {
          this.interviewQuestion = result.content;
          this.interviewModelName = '个性化追问';
          this.interviewMessage = `第 1 轮“${this.interviewCompetencyForRound(1).label}”问题已准备。`;
        } else {
          this.interviewQuestion = this.fallbackInterviewQuestion(1);
          this.interviewModelName = '标准题库';
          this.interviewMessage = '个性化追问暂时不可用，已为你准备标准问题，可继续训练。';
        }
      } catch (error) {
        console.error(`Interview opening question generation failed: ${String(error)}`);
        this.interviewQuestion = this.fallbackInterviewQuestion(1);
        this.interviewModelName = '标准题库';
        this.interviewMessage = '个性化追问暂时不可用，已为你准备标准问题，可继续训练。';
      } finally {
        this.interviewLoading = false;
      }
    }

    if (this.interviewSessionPhase !== 'active' || this.interviewRound !== 1 || this.interviewTurns.length > 0) return;
    this.interviewAvatarState = 'greeting';
    this.interviewSpeechMessage = '首题已准备';
    this.startInterviewTimer();
    void this.saveWorkspace();
    setTimeout(() => {
      if (this.interviewSessionPhase === 'active' && this.interviewRound === 1 && this.interviewTurns.length === 0) {
        void this.speakInterviewPrompt();
      }
    }, 600);
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
    const targetRounds = this.interviewTargetRounds();
    if (nextTurns.length >= targetRounds) {
      this.interviewMessage = `已完成 ${targetRounds} 轮回答，可以生成本轮反馈。`;
      this.interviewAvatarState = 'idle';
      this.interviewSpeechMessage = '计划轮次已完成';
      void this.saveWorkspace();
      return;
    }

    const nextRound = this.interviewRound + 1;
    if (!this.modelConsent) {
      this.interviewRound = nextRound;
      this.interviewQuestion = this.fallbackInterviewQuestion(nextRound);
      this.interviewModelName = '标准题库';
      this.interviewMessage = `第 ${nextRound} 轮“${this.interviewCompetencyForRound(nextRound).label}”问题已准备。`;
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
        targetRounds,
        this.interviewResumeText(),
        this.trackedJobTitle || this.targetJob,
        this.trackedJobDescription,
        this.interviewRequirementFocuses(),
        this.interviewCompetencyForRound(nextRound).label,
        this.coveredInterviewCompetencyLabels(nextTurns.length),
        nextTurns,
      );
      this.interviewRound = nextRound;
      if (result.ok) {
        this.interviewQuestion = result.content;
        this.interviewModelName = '个性化追问';
        this.interviewMessage = `第 ${nextRound} 轮“${this.interviewCompetencyForRound(nextRound).label}”问题已准备。`;
      } else {
        this.interviewQuestion = this.fallbackInterviewQuestion(nextRound);
        this.interviewModelName = '标准题库';
        this.interviewMessage = '个性化追问暂时不可用，已切换为标准问题，可继续作答。';
      }
    } catch (error) {
      console.error(`Interview follow-up generation failed: ${String(error)}`);
      this.interviewRound = nextRound;
      this.interviewQuestion = this.fallbackInterviewQuestion(nextRound);
      this.interviewModelName = '标准题库';
      this.interviewMessage = '个性化追问暂时不可用，已切换为标准问题，可继续作答。';
    } finally {
      this.interviewLoading = false;
    }
    void this.saveWorkspace();
    void this.speakInterviewPrompt();
  }

  private async finishInterview(discardIncompleteDraft: boolean = false): Promise<void> {
    if (this.interviewLoading) return;
    if (this.interviewSessionPhase === 'completed') return;
    if (this.speechActive) {
      this.interviewMessage = '请先停止语音回答并检查识别内容。';
      return;
    }
    if (this.interviewSpeaking) await this.stopInterviewPrompt();
    let turns = this.interviewTurns;
    let answer = this.interviewAnswer.trim();
    if (answer.length > 0) {
      this.interviewAnswerTouched = true;
      this.interviewAnswerError = this.validateInterviewAnswer(answer);
    } else {
      this.interviewAnswerTouched = false;
      this.interviewAnswerError = '';
    }
    if (this.interviewAnswerError) {
      if (!discardIncompleteDraft) {
        this.interviewMessage = '请先修正标出的本轮回答。';
        return;
      }
      answer = '';
      this.interviewAnswer = '';
      this.interviewAnswerTouched = false;
      this.interviewAnswerError = '';
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
    this.interviewTextFallbackVisible = false;
    this.interviewKeyboardVisible = false;
    this.stopInterviewTimer();
    this.interviewSessionPhase = 'completed';
    this.interviewTimeExpired = false;
    await this.setInterviewWindowMode(false);
    this.interviewLoading = true;
    this.interviewAvatarState = 'thinking';
    this.interviewSpeechMessage = '正在复盘本轮面试';
    this.interviewAssessment = this.assessInterview(turns);
    let feedback = '';
    if (this.modelConsent) {
      this.interviewMessage = '正在生成本轮岗位化复盘。';
      try {
        const result: NativeInterviewFeedbackResult = await this.aiService.generateInterviewFeedback(
          `${this.interviewType}（${this.interviewDifficulty}难度）`,
          this.interviewResumeText(),
          this.trackedJobTitle || this.targetJob,
          this.trackedJobDescription,
          this.interviewRequirementFocuses(),
          this.plannedInterviewCompetencyLabels(),
          turns,
        );
        if (result.ok) {
          feedback = result.content;
          if (result.evaluation) this.interviewAssessment = this.assessmentFromEvaluation(result.evaluation);
          this.interviewModelName = '个性化追问';
          this.interviewMessage = '本轮复盘已生成，内容仅作为训练建议。';
        } else {
          feedback = this.localInterviewFeedback(turns);
          this.interviewModelName = '标准题库';
          this.interviewMessage = '个性化复盘暂时不可用，已根据本轮回答生成基础反馈。';
        }
      } catch (error) {
        console.error(`Interview feedback generation failed: ${String(error)}`);
        feedback = this.localInterviewFeedback(turns);
        this.interviewModelName = '标准题库';
        this.interviewMessage = '个性化复盘暂时不可用，已根据本轮回答生成基础反馈。';
      }
    } else {
      feedback = this.localInterviewFeedback(turns);
      this.interviewModelName = '标准题库';
      this.interviewMessage = '已根据本轮回答生成训练反馈。';
    }
    this.interviewLoading = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '本轮面试已完成';
    this.interviewFeedback = feedback;
    this.archiveCurrentInterviewSession();
    void this.saveWorkspace();
    const completedPrescription = this.allActiveGrowthTasksVerified();
    if (completedPrescription) {
      const retestRecord = this.currentRetestRecord();
      const retestSummary = retestRecord
        ? `${this.currentRetestResultLabel()}，${this.interviewRetestGoalLabel(retestRecord)}`
        : '已建立新的面试评分基线';
      this.growthHistory = [`${this.activeJobContextTitle()} · 已完成同岗位复测，${retestSummary}`, ...this.growthHistory];
      this.growthHistoryJobKeys = [this.activeJobContextKey(), ...this.growthHistoryJobKeys];
    }
    if (this.activeGrowthTasks().length === 0 || completedPrescription) {
      this.createGrowthPlan(feedback);
    } else {
      this.growthHistory = [`${this.activeJobContextTitle()} · 已完成 ${this.interviewType} 复测并更新训练记录`, ...this.growthHistory];
      this.growthHistoryJobKeys = [this.activeJobContextKey(), ...this.growthHistoryJobKeys];
      void this.saveWorkspace();
    }
  }

  private clearInterviewPresentationForJobSwitch(): void {
    if (!this.interviewStarted || this.interviewSessionPhase !== 'completed') return;
    this.interviewStarted = false;
    this.interviewQuestion = '';
    this.interviewRound = 0;
    this.interviewTurns = [];
    this.interviewAnswer = '';
    this.interviewAnswerTouched = false;
    this.interviewAnswerError = '';
    this.interviewFeedback = '';
    this.interviewAssessment = new NativeInterviewAssessment(0, 0, 0, 0, 0, '', '', '');
    this.interviewTranscriptExpanded = false;
    this.interviewTextFallbackVisible = false;
    this.interviewKeyboardVisible = false;
    this.interviewModelName = '标准题库';
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'setup';
    this.interviewTimeExpired = false;
    this.interviewSessionUpdatedAt = 0;
    this.currentInterviewSessionId = '';
    this.currentInterviewVideoUri = '';
    this.currentInterviewVideoDurationSeconds = 0;
    this.currentInterviewVideoSizeBytes = 0;
    this.candidateVideoRecording = false;
    this.interviewMessage = '';
    this.normalizeInterviewDurationForSetup();
  }

  private resetInterview(): void {
    this.interviewSection = 0;
    if (!this.hasArchivedCurrentInterview()) this.deleteLocalInterviewVideo(this.currentInterviewVideoUri);
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
    this.interviewAssessment = new NativeInterviewAssessment(0, 0, 0, 0, 0, '', '', '');
    this.interviewTranscriptExpanded = false;
    this.interviewTextFallbackVisible = false;
    this.interviewKeyboardVisible = false;
    this.interviewModelName = '标准题库';
    this.interviewElapsedSeconds = 0;
    this.interviewSessionPhase = 'setup';
    this.interviewTimeExpired = false;
    this.interviewSessionUpdatedAt = 0;
    this.currentInterviewSessionId = '';
    this.currentInterviewVideoUri = '';
    this.currentInterviewVideoDurationSeconds = 0;
    this.currentInterviewVideoSizeBytes = 0;
    this.candidateVideoRecording = false;
    this.speechActive = false;
    this.interviewSpeaking = false;
    this.interviewAvatarState = 'idle';
    this.interviewSpeechMessage = '面试官已就绪';
    this.interviewMessage = '已清空本轮面试记录，可以重新选择面试类型。';
    this.normalizeInterviewDurationForSetup();
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
    const jobKey = this.activeJobContextKey();
    const jobTitle = this.activeJobContextTitle();
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
    this.growthMessage = '正在核验证据来源是否可访问。';
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
      if (!verifiedTask && task.jobKey === jobKey && task.status !== 'verified') {
        verifiedTask = new NativeGrowthTask(
          task.id,
          task.title,
          task.description,
          task.evidenceRequirement,
          task.projectedGain,
          'verified',
          task.jobKey,
          task.jobTitle,
          task.focusDimension,
          task.baselineScore,
          task.targetScore,
          task.sourceInterviewId,
        );
        nextTasks.push(verifiedTask);
      } else {
        nextTasks.push(new NativeGrowthTask(
          task.id,
          task.title,
          task.description,
          task.evidenceRequirement,
          task.projectedGain,
          task.status,
          task.jobKey,
          task.jobTitle,
          task.focusDimension,
          task.baselineScore,
          task.targetScore,
          task.sourceInterviewId,
        ));
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
      jobKey,
      jobTitle,
    );
    this.growthEvidenceRecords = [record, ...this.growthEvidenceRecords];
    this.refreshActiveGrowthCoverage();
    this.growthHistory = [`${jobTitle} · ${verifiedTask.title} 的公开来源已通过可访问性核验，实证覆盖率更新为 ${this.empiricalCoverage}%`, ...this.growthHistory];
    this.growthHistoryJobKeys = [jobKey, ...this.growthHistoryJobKeys];
    this.evidenceDraft = '';
    this.evidenceSourceUrl = '';
    this.evidenceConfirmed = false;
    this.growthDraftTouched = false;
    this.growthSourceTouched = false;
    this.growthDraftError = '';
    this.growthSourceError = '';
    this.growthMessage = `${sourceResult.message}证据已保存，可用于后续岗位匹配与复盘。`;
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
    const jobKey = this.activeJobContextKey();
    let revokedRecord: NativeGrowthEvidenceRecord | undefined = undefined;
    const revokedAt = new Date().toLocaleString('zh-CN');
    const nextRecords: NativeGrowthEvidenceRecord[] = [];
    for (const record of this.growthEvidenceRecords) {
      if (!revokedRecord && record.jobKey === jobKey && record.taskId === taskId && record.status === 'verified') {
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
          record.jobKey,
          record.jobTitle,
        );
        nextRecords.push(revokedRecord);
      } else {
        nextRecords.push(record);
      }
    }
    let revokedTask: NativeGrowthTask | undefined = undefined;
    const nextTasks: NativeGrowthTask[] = [];
    for (const task of this.growthTasks) {
      if (task.jobKey === jobKey && task.id === taskId && task.status === 'verified') {
        revokedTask = new NativeGrowthTask(
          task.id,
          task.title,
          task.description,
          task.evidenceRequirement,
          task.projectedGain,
          'todo',
          task.jobKey,
          task.jobTitle,
          task.focusDimension,
          task.baselineScore,
          task.targetScore,
          task.sourceInterviewId,
        );
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
    this.refreshActiveGrowthCoverage();
    const revokeLabel = revokedRecord ? '证据已撤销并保留审计记录' : '旧版验证状态已撤销';
    this.growthHistory = [`${revokedTask.jobTitle} · ${revokedTask.title} 的${revokeLabel}，实证覆盖率回退为 ${this.empiricalCoverage}%`, ...this.growthHistory];
    this.growthHistoryJobKeys = [jobKey, ...this.growthHistoryJobKeys];
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
    return this.growthGainForTasks(this.activeGrowthTasks());
  }

  private verifiedGrowthTaskCount(): number {
    let count = 0;
    for (const task of this.activeGrowthTasks()) {
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

  private refreshActiveGrowthCoverage(): void {
    const tasks = this.activeGrowthTasks();
    let projectedGain = 0;
    for (const task of tasks) projectedGain += task.projectedGain;
    this.growthBaselineCoverage = this.evidenceCoverage;
    this.empiricalCoverage = Math.min(100, this.growthBaselineCoverage + this.growthGainForTasks(tasks));
    this.projectedCoverage = Math.max(
      this.empiricalCoverage,
      Math.min(100, this.growthBaselineCoverage + projectedGain),
    );
  }

  private activeGrowthHistory(): string[] {
    const jobKey = this.activeJobContextKey();
    const history: string[] = [];
    for (let index = 0; index < this.growthHistory.length; index += 1) {
      if (this.growthHistoryJobKeys[index] === jobKey) history.push(this.growthHistory[index]);
    }
    return history;
  }

  private resumeCompletionValue(): number {
    let completion = 0;
    if (this.resumeName.trim()) completion += 20;
    if (this.targetJob.trim()) completion += 30;
    if (this.resumeSummary.trim().length >= 30) completion += 50;
    return completion;
  }

  @Builder
  private buildFieldLabel(label: string, hint: string = '', hintProvider?: () => string): void {
    Row() {
      Text(label)
        .fontSize(11)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
      Blank()
      if (hint || hintProvider) {
        Text(hintProvider ? hintProvider() : hint)
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
          .constraintSize({
            minHeight: 32,
            maxWidth: this.isExpandedLayout() ? 260 : (this.isCompactLayout() ? 132 : 200),
          })
          .padding({ left: 9, right: 9 })
          .backgroundColor(this.authSignedIn ? $r('app.color.km_teal_soft') : $r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(6)
          .accessibilityText(this.authSignedIn ? `${this.authDisplayName}，打开数据与隐私中心` : '打开数据与隐私中心')
          .onClick(() => { this.showDataCenter = !this.showDataCenter; })
      }
      .width('100%')
      .constraintSize({ minHeight: 54 })
      .padding({
        left: this.pageHorizontalPadding(),
        right: this.pageHorizontalPadding(),
        top: 2,
        bottom: 2,
      })
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
          this.buildPrivacyBoundary('个性化训练默认关闭', '开启后仅上传已脱敏的岗位信息和本次作答，用于生成追问与复盘。')
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
      .padding({
        left: this.pageHorizontalPadding(),
        right: this.pageHorizontalPadding(),
        top: 14,
        bottom: 28,
      })
      .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  private openJobsTab(): void {
    this.requestTabChange(2);
  }

  private openPrimaryAction(): void {
    const tab = this.primaryActionTab();
    this.requestTabChange(tab, tab === 2);
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
        this.buildJourneyStep('面试', this.interviewStarted || this.activeGrowthTasks().length > 0 ? '已启动' : '待复测', this.interviewStarted || this.activeGrowthTasks().length > 0, 3)
        this.buildJourneyStep(
          '成长',
          this.allActiveGrowthTasksVerified() ? '待复测' : (this.verifiedGrowthCount() > 0 ? '进行中' : '待行动'),
          this.verifiedGrowthCount() > 0,
          this.allActiveGrowthTasksVerified() ? 3 : 4,
        )
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
  private buildActiveJobSignal(
    icon: Resource,
    label: string,
    value: string,
    detail: string,
    tone: ResourceColor,
  ): void {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        Circle()
          .width(30)
          .height(30)
          .fill($r('app.color.km_surface_subtle'))
        SymbolGlyph(icon)
          .fontSize(15)
          .fontColor([tone])
      }
      .width(30)
      .height(30)
      Column({ space: 2 }) {
        Row() {
          Text(label)
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
          Blank()
          Text(value)
            .fontSize(11)
            .fontWeight(FontWeight.Bold)
            .fontColor(tone)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('100%')
        Text(detail)
          .fontSize(11)
          .fontColor($r('app.color.km_text_body'))
          .lineHeight(17)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
  }

  @Builder
  private buildActiveJobCockpit(): void {
    Column({ space: 12 }) {
      Row({ space: 10 }) {
        Column({ space: 3 }) {
          Text('当前岗位作战台')
            .fontSize(9)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_primary_action'))
          Text(this.trackedJobTitle)
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .maxLines(2)
          Text(this.trackedJobCompany)
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
            .maxLines(1)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Button() {
          Row({ space: 5 }) {
            SymbolGlyph($r('sys.symbol.briefcase'))
              .fontSize(13)
              .fontColor([$r('app.color.km_primary_action')])
            Text(`${this.trackedJobs} 个岗位`)
              .fontSize(10)
              .fontColor($r('app.color.km_primary_action'))
          }
        }
        .constraintSize({ minHeight: 34 })
        .padding({ left: 9, right: 9 })
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(8)
        .accessibilityText(`当前共 ${this.trackedJobs} 个岗位，打开岗位中心切换`)
        .onClick(() => { this.openJobsTab(); })
      }
      .alignItems(VerticalAlign.Top)
      .width('100%')

      Row() {
        Text(`${this.applicationStageLabel(this.applicationStage)} · 第 ${this.applicationStageProgress()}/${NATIVE_APPLICATION_STAGES.length} 阶段`)
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_primary_emphasis'))
        Blank()
        Text(this.applicationUpdatedAt ? `更新于 ${this.applicationUpdatedAt}` : '等待首次更新')
          .fontSize(9)
          .fontColor($r('app.color.km_text_tertiary'))
          .maxLines(1)
      }
      .width('100%')
      Progress({
        value: this.applicationStageProgress(),
        total: NATIVE_APPLICATION_STAGES.length,
        type: ProgressType.Linear,
      })
        .width('100%')
        .height(6)
        .color($r('app.color.km_primary_action'))
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(3)

      Divider().color($r('app.color.km_border')).strokeWidth(1)

      Column({ space: 4 }) {
        Text('下一行动')
          .fontSize(9)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_primary_action'))
        Text(this.currentApplicationAction())
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
          .lineHeight(23)
          .maxLines(3)
          .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')

      Divider().color($r('app.color.km_border')).strokeWidth(1)
      this.buildActiveJobSignal(
        $r('sys.symbol.clock'),
        '关键节点',
        this.applicationDeadline || this.nextInterviewAt ? '已安排' : '待补充',
        this.activeJobMilestoneLabel(),
        this.applicationDeadline || this.nextInterviewAt
          ? $r('app.color.km_teal')
          : $r('app.color.km_warning'),
      )
      Divider().color($r('app.color.km_border')).strokeWidth(1)
      this.buildActiveJobSignal(
        this.primaryEvidenceGap()
          ? $r('sys.symbol.exclamationmark_triangle')
          : $r('sys.symbol.checkmark_circle'),
        '首要证据缺口',
        `${this.evidenceReadyCount()}/${this.jobEvidence.length} 项有线索`,
        this.activeJobEvidenceGapLabel(),
        this.primaryEvidenceGap() ? $r('app.color.km_warning') : $r('app.color.km_success'),
      )
      Divider().color($r('app.color.km_border')).strokeWidth(1)
      this.buildActiveJobSignal(
        $r('sys.symbol.ranking'),
        '最近岗位训练',
        this.activeJobInterviewValue(),
        this.activeJobInterviewDetail(),
        this.latestActiveJobInterview() ? $r('app.color.km_primary_action') : $r('app.color.km_text_secondary'),
      )

      Row({ space: 8 }) {
        Button() {
          Row({ space: 5 }) {
            Text(this.primaryActionLabel())
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_on_primary'))
            SymbolGlyph($r('sys.symbol.chevron_right'))
              .fontSize(13)
              .fontColor([$r('app.color.km_text_on_primary')])
          }
        }
        .layoutWeight(1)
        .constraintSize({ minHeight: 42 })
        .backgroundColor($r('app.color.km_primary_action'))
        .borderRadius(8)
        .onClick(() => { this.openPrimaryAction(); })
        Button() {
          Row({ space: 5 }) {
            SymbolGlyph(this.primaryActionTab() === 3
              ? $r('sys.symbol.briefcase')
              : $r('sys.symbol.mic'))
              .fontSize(14)
              .fontColor([$r('app.color.km_primary_emphasis')])
            Text(this.primaryActionTab() === 3 ? '查看岗位' : '模拟面试')
              .fontSize(11)
              .fontColor($r('app.color.km_primary_emphasis'))
          }
        }
        .layoutWeight(1)
        .constraintSize({ minHeight: 42 })
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(8)
        .onClick(() => {
          this.primaryActionTab() === 3 ? this.openJobsTab() : this.requestTabChange(3);
        })
      }
      .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface_elevated'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
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
        .onClick(() => { this.openPrimaryAction(); })
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
  private buildHomeMetrics(): void {
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
        label: '成长待办',
        value: `${this.activeGrowthTasks().filter((task: NativeGrowthTask) => task.status !== 'verified').length}`,
        detail: this.allActiveGrowthTasksVerified() ? '专项完成，等待复测' : '按优先级推进',
        accentColor: $r('app.color.km_warning'),
      })
    }
    .width('100%')
  }

  @Builder
  private buildHomePrimaryColumn(): void {
    Column({ space: 12 }) {
      if (this.trackedJobs > 0) {
        this.buildActiveJobCockpit()
      } else {
        this.buildTodayAction()
      }
      this.buildHomeMetrics()
      if (this.isExpandedLayout()) {
        this.buildJourney()
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildHomeSecondaryColumn(): void {
    Column({ space: 12 }) {
      if (this.trackedJobs === 0 || this.isExpandedLayout()) {
        this.buildTargetJobSnapshot()
      }
      if (!this.isExpandedLayout()) {
        this.buildJourney()
      }
      if (this.trackedJobs === 0) {
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
      }
      if (this.trackedJobs === 0 || this.isExpandedLayout()) {
        this.buildHomeGuidance()
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
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

        if (this.isExpandedLayout()) {
          Row({ space: 14 }) {
            Column() {
              this.buildHomePrimaryColumn()
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(3)
            Column() {
              this.buildHomeSecondaryColumn()
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(2)
          }
          .alignItems(VerticalAlign.Top)
          .width('100%')
        } else {
          this.buildHomePrimaryColumn()
          this.buildHomeSecondaryColumn()
        }
      }
      .width('100%')
      .padding({
        left: this.pageHorizontalPadding(),
        right: this.pageHorizontalPadding(),
        top: 14,
        bottom: 20,
      })
      .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
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
            this.buildFieldLabel('真实经历', '', () => `${this.resumeSummary.length}/4000 · 至少 30 字`)
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
            Text('识别结果、岗位信息和分析建议都需要你确认后才会进入求职资料。')
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
      .padding({
        left: this.pageHorizontalPadding(),
        right: this.pageHorizontalPadding(),
        top: 14,
        bottom: 24,
      })
      .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildJobPreferencePanel(): void {
    Column({ space: 10 }) {
      Button() {
        Row({ space: 10 }) {
          SymbolGlyph($r('sys.symbol.ranking'))
            .fontSize(18)
            .fontColor([$r('app.color.km_primary_action')])
          Column({ space: 3 }) {
            Text('我的求职偏好')
              .fontSize(15)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text(this.jobPreferenceSummary())
              .fontSize(9)
              .fontColor($r('app.color.km_text_secondary'))
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(this.hasConfiguredJobPreferences() ? '已参与排序' : '待设置')
            .fontSize(9)
            .fontColor(this.hasConfiguredJobPreferences() ? $r('app.color.km_success') : $r('app.color.km_warning'))
          SymbolGlyph($r('sys.symbol.chevron_right'))
            .fontSize(13)
            .fontColor([$r('app.color.km_text_secondary')])
            .rotate({ angle: this.showJobPreferences ? -90 : 90 })
        }
        .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: 48 })
      .padding({ left: 12, right: 12 })
      .backgroundColor($r('app.color.km_surface_subtle'))
      .borderRadius(8)
      .accessibilityText(this.showJobPreferences ? '收起求职偏好' : '展开求职偏好')
      .onClick(() => { this.showJobPreferences = !this.showJobPreferences; })

      if (this.showJobPreferences) {
        Column({ space: 10 }) {
          this.buildFieldLabel('期望城市', '可填写多个，用顿号分隔')
          TextInput({ placeholder: '例如：北京、上海、杭州', text: this.jobPreferredCities })
            .constraintSize({ minHeight: 42 })
            .maxLength(80)
            .backgroundColor($r('app.color.km_surface_subtle'))
            .border({ width: 1, color: $r('app.color.km_border') })
            .borderRadius(8)
            .onChange((value: string) => { this.jobPreferredCities = value; })

          this.buildFieldLabel('求职阶段', '影响实习、校招和社招排序')
          Row({ space: 6 }) {
            ForEach(NATIVE_EMPLOYMENT_TYPES, (employmentType: string) => {
              Button(employmentType)
                .layoutWeight(1)
                .constraintSize({ minHeight: 36 })
                .fontSize(10)
                .fontColor(this.jobPreferredEmploymentType === employmentType
                  ? $r('app.color.km_text_on_primary')
                  : $r('app.color.km_text_body'))
                .backgroundColor(this.jobPreferredEmploymentType === employmentType
                  ? $r('app.color.km_primary_action')
                  : $r('app.color.km_surface_subtle'))
                .border({ width: 1, color: this.jobPreferredEmploymentType === employmentType
                  ? $r('app.color.km_primary_action')
                  : $r('app.color.km_border') })
                .borderRadius(6)
                .onClick(() => { this.jobPreferredEmploymentType = employmentType; })
            }, (employmentType: string) => employmentType)
          }
          .width('100%')

          Row({ space: 8 }) {
            Column({ space: 6 }) {
              this.buildFieldLabel('毕业年份', '选填')
              TextInput({ placeholder: '例如：2027', text: this.jobGraduationYear })
                .constraintSize({ minHeight: 42 })
                .maxLength(8)
                .type(InputType.Number)
                .backgroundColor($r('app.color.km_surface_subtle'))
                .border({ width: 1, color: $r('app.color.km_border') })
                .borderRadius(8)
                .onChange((value: string) => { this.jobGraduationYear = value; })
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)
            Column({ space: 6 }) {
              this.buildFieldLabel('月薪期望', '仅在岗位公开时比较')
              TextInput({ placeholder: '例如：15K', text: this.jobSalaryExpectation })
                .constraintSize({ minHeight: 42 })
                .maxLength(20)
                .backgroundColor($r('app.color.km_surface_subtle'))
                .border({ width: 1, color: $r('app.color.km_border') })
                .borderRadius(8)
                .onChange((value: string) => { this.jobSalaryExpectation = value; })
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)
          }
          .width('100%')

          this.buildFieldLabel('偏好行业', '例如：AI、互联网、游戏')
          TextInput({ placeholder: '多个行业用顿号分隔', text: this.jobPreferredIndustries })
            .constraintSize({ minHeight: 42 })
            .maxLength(80)
            .backgroundColor($r('app.color.km_surface_subtle'))
            .border({ width: 1, color: $r('app.color.km_border') })
            .borderRadius(8)
            .onChange((value: string) => { this.jobPreferredIndustries = value; })

          this.buildFieldLabel('偏好企业', '', () => this.jobPreferredCompanies || '可多选')
          Grid() {
            ForEach(NATIVE_PREFERRED_EMPLOYERS, (employer: string) => {
              GridItem() {
                Button(employer)
                  .width('100%')
                  .constraintSize({ minHeight: 34 })
                  .fontSize(9)
                  .fontColor(this.splitJobPreferenceTerms(this.jobPreferredCompanies).includes(employer)
                    ? $r('app.color.km_text_on_primary')
                    : $r('app.color.km_text_muted'))
                  .backgroundColor(this.splitJobPreferenceTerms(this.jobPreferredCompanies).includes(employer)
                    ? $r('app.color.km_primary_action')
                    : $r('app.color.km_neutral_soft'))
                  .borderRadius(7)
                  .onClick(() => { this.togglePreferredCompany(employer); })
              }
            }, (employer: string) => `preference-${employer}`)
          }
          .columnsTemplate('1fr 1fr 1fr')
          .columnsGap(7)
          .rowsGap(7)
          .constraintSize({ minHeight: 74 })
          .width('100%')

          Button('保存偏好并重新排序')
            .width('100%')
            .constraintSize({ minHeight: 42 })
            .fontSize(11)
            .fontColor($r('app.color.km_text_on_primary'))
            .backgroundColor($r('app.color.km_primary_action'))
            .borderRadius(8)
            .onClick(() => { this.saveJobPreferences(); })
          Text('求职偏好和岗位反馈只保存在本机；在线搜索仍只发送当前关键词、城市和企业筛选。')
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
            .lineHeight(15)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(14)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildPublicJobSearch(): void {
    Column({ space: 10 }) {
      Text('国内官方岗位搜索')
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
        .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位关键词', '', () => `默认：${this.targetJob}`)
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
        this.buildFieldLabel('优先企业', '', () => this.jobEmployer || '全部国内来源')
        Grid() {
          ForEach(NATIVE_PREFERRED_EMPLOYERS, (employer: string) => {
            GridItem() {
              Button(employer)
                .width('100%')
                .constraintSize({ minHeight: 36 })
                .fontSize(10)
                .fontWeight(this.jobEmployer === employer ? FontWeight.Bold : FontWeight.Regular)
                .fontColor(this.jobEmployer === employer
                  ? $r('app.color.km_text_on_primary')
                  : $r('app.color.km_text_muted'))
                .backgroundColor(this.jobEmployer === employer
                  ? $r('app.color.km_primary_action')
                  : $r('app.color.km_neutral_soft'))
                .borderRadius(8)
                .onClick(() => {
                  this.jobEmployer = this.jobEmployer === employer ? '' : employer;
                })
            }
          }, (employer: string) => employer)
        }
        .columnsTemplate('1fr 1fr 1fr')
        .columnsGap(8)
        .rowsGap(8)
        .constraintSize({ minHeight: 80 })
        .width('100%')
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
      Button('在 BOSS 直聘补充搜索')
        .width('100%')
        .constraintSize({ minHeight: 40 })
        .fontSize(11)
        .fontColor($r('app.color.km_info'))
        .backgroundColor($r('app.color.km_info_soft'))
        .borderRadius(8)
        .onClick(() => { void this.openBossJobSearch(); })
      Text('BOSS 直聘属于第三方招聘平台，仅作为补充入口，不与企业官方岗位混合排序。')
        .fontSize(9)
        .fontColor($r('app.color.km_text_muted'))
        .lineHeight(15)
      if (this.publicJobsStale) {
        Text('当前展示上次成功获取的缓存结果')
          .fontSize(9)
          .fontColor($r('app.color.km_warning'))
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor($r('app.color.km_warning_soft'))
          .borderRadius(8)
      }
      if ((this.publicJobsSearched || this.publicJobsLoading) && (!this.publicJobsFailed || this.publicJobs.length > 0)) {
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
        Column({ space: 5 }) {
          Text(this.verificationLabel(job.verification))
            .fontSize(9)
            .fontColor($r('app.color.km_success'))
            .padding({ left: 7, right: 7, top: 4, bottom: 4 })
            .backgroundColor($r('app.color.km_success_soft'))
            .borderRadius(9)
          if (job.employerPriority >= 90) {
            Text('国内大厂')
              .fontSize(9)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_primary_action'))
              .padding({ left: 7, right: 7, top: 4, bottom: 4 })
              .backgroundColor($r('app.color.km_primary_soft'))
              .borderRadius(9)
          }
          Text(`${job.matchScore}% · ${job.matchLabel}`)
            .fontSize(9)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.jobMatchColor(job.matchScore))
            .padding({ left: 7, right: 7, top: 4, bottom: 4 })
            .backgroundColor(this.jobMatchBackground(job.matchScore))
            .borderRadius(9)
        }
        .alignItems(HorizontalAlign.End)
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
      Row({ space: 8 }) {
        if (job.employmentType) {
          Text(job.employmentType)
            .fontSize(9)
            .fontColor($r('app.color.km_text_secondary'))
        }
        if (job.salary) {
          Text(job.salary)
            .fontSize(9)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_success'))
        }
        Text(job.freshnessLabel)
          .fontSize(9)
          .fontColor(job.freshnessLabel === '发布时间较早'
            ? $r('app.color.km_warning')
            : $r('app.color.km_text_tertiary'))
      }
      .width('100%')
      Text(job.summary)
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(18)
        .maxLines(3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Column({ space: 4 }) {
        Text(job.matchMode.includes('evidence') ? '简历证据 + 求职偏好' : '目标方向 + 求职偏好')
          .fontSize(9)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.jobMatchColor(job.matchScore))
        Text(job.matchReasons.length > 0 ? job.matchReasons[0] : '当前没有足够证据生成个性化解释。')
          .fontSize(10)
          .fontColor($r('app.color.km_text_body'))
          .lineHeight(16)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        if (job.matchedSkills.length > 0) {
          Text(`已命中 · ${job.matchedSkills.slice(0, 4).join(' · ')}`)
            .fontSize(9)
            .fontColor($r('app.color.km_success'))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        if (job.matchGaps.length > 0) {
          Text(`待核对 · ${job.matchGaps[0]}`)
            .fontSize(9)
            .fontColor($r('app.color.km_warning'))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        if (job.preferenceReasons.length > 0) {
          Text(`偏好命中 · ${job.preferenceReasons[0]}`)
            .fontSize(9)
            .fontColor($r('app.color.km_primary_action'))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        if (job.preferenceConflicts.length > 0) {
          Text(`偏好风险 · ${job.preferenceConflicts[0]}`)
            .fontSize(9)
            .fontColor($r('app.color.km_warning'))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        if (job.feedbackState) {
          Text(`你的反馈 · ${this.jobFeedbackLabel(job.feedbackState)}`)
            .fontSize(9)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_text_secondary'))
        }
      }
      .alignItems(HorizontalAlign.Start)
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

        Column({ space: 10 }) {
          Row() {
            Column({ space: 3 }) {
              Text(job.matchMode.includes('evidence') ? '证据与偏好匹配' : '方向与偏好相关性')
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text(job.matchLabel)
                .fontSize(10)
                .fontColor(this.jobMatchColor(job.matchScore))
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Text(`${job.matchScore}%`)
              .fontSize(24)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.jobMatchColor(job.matchScore))
          }
          .width('100%')
          Progress({ value: job.matchScore, total: 100, type: ProgressType.Linear })
            .width('100%')
            .height(6)
            .color(this.jobMatchColor(job.matchScore))
            .backgroundColor($r('app.color.km_border'))
          Text('该数值只表示本机简历证据、求职偏好与当前 JD 的综合相关性，不代表企业筛选或录用概率。')
            .fontSize(10)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(17)
          if (job.matchReasons.length > 0) {
            Text('匹配依据')
              .fontSize(11)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            ForEach(job.matchReasons, (reason: string) => {
              Row({ space: 8 }) {
                Circle()
                  .width(5)
                  .height(5)
                  .fill($r('app.color.km_success'))
                Text(reason)
                  .fontSize(10)
                  .fontColor($r('app.color.km_text_body'))
                  .lineHeight(17)
                  .layoutWeight(1)
              }
              .alignItems(VerticalAlign.Top)
              .width('100%')
            }, (reason: string) => reason)
          }
          if (job.matchGaps.length > 0) {
            Text('待核对缺口')
              .fontSize(11)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_warning'))
            ForEach(job.matchGaps, (gap: string) => {
              Row({ space: 8 }) {
                Circle()
                  .width(5)
                  .height(5)
                  .fill($r('app.color.km_warning'))
                Text(gap)
                  .fontSize(10)
                  .fontColor($r('app.color.km_text_body'))
                  .lineHeight(17)
                  .layoutWeight(1)
              }
              .alignItems(VerticalAlign.Top)
              .width('100%')
            }, (gap: string) => gap)
          }
          if (job.preferenceReasons.length > 0) {
            Text('偏好命中')
              .fontSize(11)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_primary_action'))
            ForEach(job.preferenceReasons, (reason: string) => {
              Text(`· ${reason}`)
                .fontSize(10)
                .fontColor($r('app.color.km_text_body'))
                .lineHeight(17)
                .width('100%')
            }, (reason: string) => `preference-${reason}`)
          }
          if (job.preferenceConflicts.length > 0) {
            Text('偏好冲突')
              .fontSize(11)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_warning'))
            ForEach(job.preferenceConflicts, (conflict: string) => {
              Text(`· ${conflict}`)
                .fontSize(10)
                .fontColor($r('app.color.km_text_body'))
                .lineHeight(17)
                .width('100%')
            }, (conflict: string) => `conflict-${conflict}`)
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor(this.jobMatchBackground(job.matchScore))
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
        Button() {
          Row({ space: 7 }) {
            SymbolGlyph($r('sys.symbol.mic'))
              .fontSize(15)
              .fontColor([$r('app.color.km_text_on_primary')])
            Text('保存并按此岗位模拟面试')
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_on_primary'))
          }
        }
        .width('100%')
        .constraintSize({ minHeight: 44 })
        .backgroundColor($r('app.color.km_success'))
        .borderRadius(8)
        .onClick(() => { this.prepareInterviewForPublicJob(job); })

        Column({ space: 8 }) {
          Row() {
            Text('调整后续推荐')
              .fontSize(12)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Blank()
            if (job.feedbackState) {
              Button('撤销反馈')
                .constraintSize({ minHeight: 30 })
                .fontSize(9)
                .fontColor($r('app.color.km_text_secondary'))
                .backgroundColor($r('app.color.km_surface_subtle'))
                .borderRadius(6)
                .onClick(() => { this.updateJobFeedback(job, ''); })
            }
          }
          .width('100%')
          Row({ space: 6 }) {
            Button('更感兴趣')
              .layoutWeight(1)
              .constraintSize({ minHeight: 34 })
              .fontSize(9)
              .fontColor(job.feedbackState === 'interested' ? $r('app.color.km_text_on_primary') : $r('app.color.km_success'))
              .backgroundColor(job.feedbackState === 'interested' ? $r('app.color.km_success') : $r('app.color.km_success_soft'))
              .borderRadius(6)
              .onClick(() => { this.updateJobFeedback(job, 'interested'); })
            Button('地点不合适')
              .layoutWeight(1)
              .constraintSize({ minHeight: 34 })
              .fontSize(9)
              .fontColor(job.feedbackState === 'location_mismatch' ? $r('app.color.km_text_on_primary') : $r('app.color.km_warning'))
              .backgroundColor(job.feedbackState === 'location_mismatch' ? $r('app.color.km_warning') : $r('app.color.km_warning_soft'))
              .borderRadius(6)
              .onClick(() => { this.updateJobFeedback(job, 'location_mismatch'); })
          }
          .width('100%')
          Row({ space: 6 }) {
            Button('要求偏高')
              .layoutWeight(1)
              .constraintSize({ minHeight: 34 })
              .fontSize(9)
              .fontColor(job.feedbackState === 'too_senior' ? $r('app.color.km_text_on_primary') : $r('app.color.km_warning'))
              .backgroundColor(job.feedbackState === 'too_senior' ? $r('app.color.km_warning') : $r('app.color.km_warning_soft'))
              .borderRadius(6)
              .onClick(() => { this.updateJobFeedback(job, 'too_senior'); })
            Button('不感兴趣')
              .layoutWeight(1)
              .constraintSize({ minHeight: 34 })
              .fontSize(9)
              .fontColor(job.feedbackState === 'not_interested' ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_secondary'))
              .backgroundColor(job.feedbackState === 'not_interested' ? $r('app.color.km_text_secondary') : $r('app.color.km_surface_subtle'))
              .borderRadius(6)
              .onClick(() => { this.updateJobFeedback(job, 'not_interested'); })
          }
          .width('100%')
          Text('反馈仅保存在本机，并用于调整当前岗位及相似岗位的排序。')
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(12)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)
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
          if (job.employmentType) {
            Text(`招聘类型：${job.employmentType}`)
              .fontSize(11)
              .fontColor($r('app.color.km_text_secondary'))
          }
          if (job.salary) {
            Text(`公开薪资：${job.salary}`)
              .fontSize(11)
              .fontColor($r('app.color.km_success'))
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
      .padding({
        left: this.pageHorizontalPadding(),
        right: this.pageHorizontalPadding(),
        top: 14,
        bottom: 24,
      })
      .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildTrackedJobSwitcher(): void {
    NativeApplicationWorkspace({
      items: this.trackedApplicationItems(),
      activeJobKey: this.activeTrackedJobKey,
      now: this.applicationWorkspaceNow,
      search: $trackedJobSearch,
      stage: $trackedJobStageFilter,
      sort: $trackedJobSort,
      onSelectJob: (key: string) => { this.openTrackedJobDetail(key); },
      onNewJob: () => { this.beginNewTrackedJob(); },
      onDiscover: () => { this.requestJobsSection(0); },
      onCompare: () => {
        this.showJobComparison = true;
        this.uiContext.getFocusController().clearFocus();
        this.jobsScroller.scrollTo({ xOffset: 0, yOffset: 0 });
      },
      onSearchEditing: (editing: boolean) => { this.jobsSearchEditing = editing; },
    })
  }

  @Builder
  private buildJobComparisonFact(label: string, value: string): void {
    Row({ space: 8 }) {
      Text(label)
        .width(58)
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
      Text(value)
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
    }
    .alignItems(VerticalAlign.Top)
    .width('100%')
  }

  @Builder
  private buildJobComparisonCard(record: NativeTrackedJobRecord): void {
    Column({ space: 9 }) {
      Row({ space: 8 }) {
        Column({ space: 2 }) {
          Text(record.company || '未填写公司')
            .fontSize(9)
            .fontColor($r('app.color.km_text_muted'))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(record.title)
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        if (record.key === this.activeTrackedJobKey) {
          Text('当前')
            .fontSize(9)
            .fontColor($r('app.color.km_primary_action'))
            .padding({ left: 7, right: 7, top: 4, bottom: 4 })
            .backgroundColor($r('app.color.km_primary_soft'))
            .borderRadius(7)
        }
      }
      .alignItems(VerticalAlign.Top)
      .width('100%')

      Divider()
        .color($r('app.color.km_border'))

      this.buildJobComparisonFact('投递阶段', this.applicationStageLabel(record.applicationStage))
      this.buildJobComparisonFact('准备清单', `${this.trackedJobReadinessCount(record)}/5 已完成`)
      this.buildJobComparisonFact('投递简历', this.comparisonResumeVersionName(record))
      this.buildJobComparisonFact('岗位面试', `已完成 ${this.comparisonInterviewCount(record)} 次`)
      this.buildJobComparisonFact('关键节点', this.comparisonDateLabel(record))
      this.buildJobComparisonFact('下一行动', this.trackedJobNextAction(record))

      Blank()

      Row({ space: 7 }) {
        Button(record.key === this.activeTrackedJobKey ? '当前岗位' : '设为当前')
          .layoutWeight(1)
          .constraintSize({ minHeight: 36 })
          .fontSize(10)
          .fontColor(record.key === this.activeTrackedJobKey
            ? $r('app.color.km_text_muted')
            : $r('app.color.km_primary_action'))
          .backgroundColor(record.key === this.activeTrackedJobKey
            ? $r('app.color.km_surface_subtle')
            : $r('app.color.km_primary_soft'))
          .borderRadius(8)
          .onClick(() => { this.openTrackedJobDetail(record.key); })
        Button('按此岗位面试')
          .layoutWeight(1)
          .constraintSize({ minHeight: 36 })
          .fontSize(10)
          .fontColor($r('app.color.km_text_on_primary'))
          .backgroundColor($r('app.color.km_primary_action'))
          .borderRadius(8)
          .onClick(() => { this.prepareInterviewForTrackedJob(record); })
      }
      .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width(this.isCompactLayout() ? 260 : 286)
    .height(270)
    .padding(13)
    .backgroundColor(record.key === this.activeTrackedJobKey
      ? $r('app.color.km_primary_tint')
      : $r('app.color.km_surface'))
    .border({
      width: record.key === this.activeTrackedJobKey ? 2 : 1,
      color: record.key === this.activeTrackedJobKey
        ? $r('app.color.km_primary_action')
        : $r('app.color.km_border'),
    })
    .borderRadius(8)
  }

  @Builder
  private buildJobComparisonPanel(): void {
    if (this.trackedJobRecords.length >= 2) {
      Column({ space: 10 }) {
        Row({ space: 8 }) {
          Column({ space: 2 }) {
            Text('多岗位决策台')
              .fontSize(15)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text('并排核对本机事实，不生成录用概率或隐藏排名。')
              .fontSize(9)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(15)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(`已选 ${this.comparisonJobRecords().length}/3`)
            .fontSize(10)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_primary_action'))
        }
        .alignItems(VerticalAlign.Top)
        .width('100%')

        Scroll() {
          Row({ space: 6 }) {
            ForEach(this.trackedJobRecords, (record: NativeTrackedJobRecord) => {
              Button() {
                Row({ space: 5 }) {
                  SymbolGlyph(this.isJobCompareSelected(record.key)
                    ? $r('sys.symbol.checkmark_circle')
                    : $r('sys.symbol.circle'))
                    .fontSize(13)
                    .fontColor([this.isJobCompareSelected(record.key)
                      ? $r('app.color.km_primary_action')
                      : $r('app.color.km_text_tertiary')])
                  Text(record.company ? `${record.company} · ${record.title}` : record.title)
                    .fontSize(10)
                    .fontColor(this.isJobCompareSelected(record.key)
                      ? $r('app.color.km_primary_action')
                      : $r('app.color.km_text_secondary'))
                    .maxLines(1)
                }
              }
              .constraintSize({ minHeight: 34, maxWidth: 220 })
              .padding({ left: 9, right: 9 })
              .backgroundColor(this.isJobCompareSelected(record.key)
                ? $r('app.color.km_primary_soft')
                : $r('app.color.km_surface_subtle'))
              .border({
                width: 1,
                color: this.isJobCompareSelected(record.key)
                  ? $r('app.color.km_primary_action')
                  : $r('app.color.km_border'),
              })
              .borderRadius(8)
              .accessibilityText(`${this.isJobCompareSelected(record.key) ? '取消对比' : '加入对比'}${record.company}${record.title}`)
              .onClick(() => { this.toggleJobCompare(record.key); })
            }, (record: NativeTrackedJobRecord) => record.key)
          }
        }
        .width('100%')
        .scrollable(ScrollDirection.Horizontal)
        .scrollBar(BarState.Off)

        if (this.comparisonJobRecords().length < 2) {
          Row({ space: 7 }) {
            SymbolGlyph($r('sys.symbol.info_circle'))
              .fontSize(15)
              .fontColor([$r('app.color.km_info')])
            Text('至少选择 2 个岗位后，才能并排核对投递事实。')
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
              .layoutWeight(1)
          }
          .width('100%')
          .padding(10)
          .backgroundColor($r('app.color.km_info_soft'))
          .borderRadius(8)
        } else {
          Scroll() {
            Row({ space: 10 }) {
              ForEach(this.comparisonJobRecords(), (record: NativeTrackedJobRecord) => {
                this.buildJobComparisonCard(record)
              }, (record: NativeTrackedJobRecord) => record.key)
            }
          }
          .width('100%')
          .scrollable(ScrollDirection.Horizontal)
          .scrollBar(BarState.Off)
        }
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding({ top: 11, bottom: 11 })
      .border({ width: { top: 1, bottom: 1 }, color: $r('app.color.km_border') })
    }
  }

  @Builder
  private buildTrackedJobEditor(): void {
    Column({ space: 10 }) {
      Row() {
        Text(this.creatingTrackedJob ? '新增岗位作战卡' : (this.trackedJobs > 0 ? '编辑真实岗位' : '添加真实岗位'))
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
        if (this.trackedJobs > 0 || this.creatingTrackedJob) {
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
  private buildJobReadinessPanel(): void {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 2 }) {
          Text('投递准备清单')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text('只核对当前岗位的可执行准备项，不代表企业筛选或录用概率。')
            .fontSize(9)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(15)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(`${this.jobReadinessCompletedCount()}/5 已完成`)
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.jobReadinessCompletedCount() === 5
            ? $r('app.color.km_success')
            : $r('app.color.km_primary_action'))
      }
      .alignItems(VerticalAlign.Top)
      .width('100%')

      Progress({ value: this.jobReadinessCompletedCount(), total: 5, type: ProgressType.Linear })
        .width('100%')
        .height(5)
        .color(this.jobReadinessCompletedCount() === 5
          ? $r('app.color.km_success')
          : $r('app.color.km_primary_action'))
        .backgroundColor($r('app.color.km_border'))

      ForEach(this.jobReadinessItems(), (item: NativeJobReadinessItem) => {
        Row({ space: 9 }) {
          SymbolGlyph(item.isComplete ? $r('sys.symbol.checkmark_circle') : $r('sys.symbol.clock'))
            .fontSize(17)
            .fontColor([item.isComplete ? $r('app.color.km_success') : $r('app.color.km_warning')])
          Column({ space: 2 }) {
            Text(item.label)
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
            Text(item.detail)
              .fontSize(9)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(15)
              .maxLines(2)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(item.isComplete ? '已完成' : '待完成')
            .fontSize(9)
            .fontColor(item.isComplete ? $r('app.color.km_success') : $r('app.color.km_warning'))
        }
        .alignItems(VerticalAlign.Top)
        .width('100%')
      }, (item: NativeJobReadinessItem) => item.key)

      if (this.nextJobReadinessItem()) {
        Button(this.nextJobReadinessItem()?.actionLabel || '继续准备')
          .width('100%')
          .constraintSize({ minHeight: 40 })
          .fontSize(11)
          .fontColor($r('app.color.km_text_on_primary'))
          .backgroundColor($r('app.color.km_primary_action'))
          .borderRadius(8)
          .onClick(() => { this.performJobReadinessAction(this.nextJobReadinessItem()?.key || ''); })
      } else {
        Text('基础准备已完成，可继续在下方维护投递阶段和关键节点。')
          .fontSize(10)
          .fontColor($r('app.color.km_success'))
          .width('100%')
          .padding(9)
          .backgroundColor($r('app.color.km_success_soft'))
          .borderRadius(7)
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding({ top: 11, bottom: 11 })
    .border({ width: { top: 1, bottom: 1 }, color: $r('app.color.km_border') })
  }

  @Builder
  private buildTrackedJobCard(): void {
    if (this.trackedJobs === 0 || this.showJobEditor) {
      this.buildTrackedJobEditor()
    } else {
      Column({ space: 10 }) {
        Row() {
          Column({ space: 4 }) {
            Text('当前作战岗位')
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
        Button() {
          Row({ space: 7 }) {
            SymbolGlyph($r('sys.symbol.doc_text'))
              .fontSize(16)
              .fontColor([$r('app.color.km_primary_action')])
            Text('整理投递材料')
              .fontSize(12)
              .fontColor($r('app.color.km_primary_action'))
          }
        }
        .width('100%')
        .constraintSize({ minHeight: 42 })
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(8)
        .onClick(() => { this.openJobMaterials(); })
        this.buildJobReadinessPanel()
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
            .borderRadius(8)
            .onClick(() => { this.beginTrackedJobEdit(); })
          Button('移除作战卡')
            .layoutWeight(1)
            .constraintSize({ minHeight: 38 })
            .fontSize(11)
            .fontColor($r('app.color.km_danger'))
            .backgroundColor($r('app.color.km_danger_soft'))
            .borderRadius(8)
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
  private buildJobsNavigation(): void {
    if (this.showTrackedJobDetail || this.showJobComparison) {
      Row({ space: 10 }) {
        Button() {
          SymbolGlyph($r('sys.symbol.chevron_left'))
            .fontSize(18)
            .fontColor([$r('app.color.km_text_primary')])
        }
        .width(38)
        .height(38)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .borderRadius(6)
        .accessibilityText('返回我的投递')
        .onClick(() => { this.requestJobsSection(1); })
        Text(this.showJobComparison ? '岗位对比' : (this.creatingTrackedJob ? '新增岗位' : '投递详情'))
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
          .layoutWeight(1)
      }
      .width('100%')
    } else {
      Row({ space: 4 }) {
        ForEach(['发现岗位', '我的投递'], (label: string, index: number) => {
          Button() {
            Text(label)
              .fontSize(14)
              .fontWeight(this.jobsSection === index ? FontWeight.Bold : FontWeight.Medium)
              .fontColor(this.jobsSection === index ? $r('app.color.km_primary_action') : $r('app.color.km_text_secondary'))
              .width('100%')
              .textAlign(TextAlign.Center)
              .padding({ top: 13, bottom: 13 })
              .border({ width: { bottom: this.jobsSection === index ? 2 : 1 },
                color: this.jobsSection === index ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
          }
          .layoutWeight(1)
          .backgroundColor(Color.Transparent)
          .borderRadius(0)
          .accessibilityText(label)
          .onClick(() => { this.requestJobsSection(index); })
        }, (label: string) => label)
      }
      .width('100%')
    }
  }

  @Builder
  private buildJobs(): void {
    if (this.jobMaterialPdfPath) {
      NativeResumePdfPreview({
        pages: this.jobMaterialPdfPages,
        saving: this.jobMaterialSaving,
        onBack: () => { this.closeMaterialPdfPreview(); },
        onSave: () => { void this.saveMaterialResumePdf(); },
      })
    } else if (this.showJobMaterials) {
      NativeJobMaterialWorkspace({
        material: this.jobMaterialDraft,
        jobTitle: this.trackedJobTitle,
        company: this.trackedJobCompany,
        requirements: this.interviewRequirementFocuses(),
        boundVersionName: this.boundResumeVersionName(),
        dirty: this.jobMaterialDirty,
        saving: this.jobMaterialSaving,
        message: this.jobMaterialMessage,
        resumeError: this.jobMaterialResumeError,
        horizontalPadding: this.pageHorizontalPadding(),
        contentMaxWidth: this.pageMaxWidth(),
        checks: this.materialService.preflight(this.jobMaterialDraft, this.boundResumeVersion(), this.jobMaterialDirty),
        section: $jobMaterialSection,
        onBack: () => { this.closeJobMaterials(); },
        onSave: () => { void this.saveJobMaterials(); },
        onFreeze: () => { void this.freezeJobMaterialResume(); },
        onExport: () => { void this.exportJobMaterials(); },
        onPreviewPdf: () => { void this.previewMaterialResumePdf(); },
        onIdentityChange: (field: string, value: string) => { this.changeMaterialIdentity(field, value); },
        onConfirmResume: (confirmed: boolean) => { this.confirmMaterialResume(confirmed); },
        onResetResume: () => { this.requestResetMaterialResume(); },
        onResumeChange: (content: string) => { this.changeMaterialResume(content); },
        onAddStory: (requirement: string) => { this.addJobStory(requirement); },
        onImportStory: () => { this.importInterviewStory(); },
        onStoryChange: (storyId: string, field: string, value: string) => { this.changeJobStory(storyId, field, value); },
        onDeleteStory: (storyId: string) => { this.requestDeleteJobStory(storyId); },
      })
    } else if (this.selectedPublicJobIndex >= 0 && this.selectedPublicJobIndex < this.publicJobs.length) {
      this.buildPublicJobDetail(this.publicJobs[this.selectedPublicJobIndex])
    } else {
      Scroll(this.jobsScroller) {
        Column({ space: 12 }) {
          this.buildJobsNavigation()
          if (this.showTrackedJobDetail) {
            this.buildTrackedJobCard()
            if (!this.showJobEditor && this.trackedJobs > 0) {
              this.buildSectionHeading('岗位要求与准备情况', this.trackedJobTitle)
              ForEach(this.jobEvidence, (evidence: NativeJobEvidence) => {
                this.buildRequirement(evidence.title, evidence.status, evidence.detail, evidence.color, evidence.background);
              }, (evidence: NativeJobEvidence) => evidence.id)
              Button('开始岗位模拟面试')
                .width('100%')
                .constraintSize({ minHeight: 46 })
                .fontColor($r('app.color.km_text_on_primary'))
                .backgroundColor($r('app.color.km_primary_action'))
                .borderRadius(8)
                .onClick(() => {
                  const record = this.findTrackedJobRecord(this.activeTrackedJobKey);
                  if (record) this.prepareInterviewForTrackedJob(record);
                })
            }
          } else if (this.showJobComparison) {
            this.buildJobComparisonPanel()
          } else if (this.jobsSection === 1) {
            this.buildTrackedJobSwitcher()
          } else {
            this.buildPublicJobSearch()
            this.buildJobPreferencePanel()
            if (this.publicJobs.length > 0) {
              Row() {
                Text('推荐岗位')
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
                title: '暂时无法搜索官方岗位',
                detail: this.publicJobsMessage,
                actionLabel: this.publicJobsConfigured ? '重新连接' : '',
                onAction: () => { void this.refreshPublicJobs(); },
              })
            } else if (this.publicJobsSearched) {
              NativeAsyncStatePanel({
                state: 'empty',
                title: '没有找到符合条件的官方岗位',
                detail: '调整关键词或国内城市后重新搜索，也可以通过 BOSS 直聘补充查找。',
              })
            }
          }
        }
        .width('100%')
        .padding({
          left: this.pageHorizontalPadding(),
          right: this.pageHorizontalPadding(),
          top: 14,
          bottom: 24,
        })
        .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
        .alignSelf(ItemAlign.Center)
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .align(Alignment.Top)
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
      Row({ space: 8 }) {
        Image($r('app.media.startIconNative'))
          .width(26)
          .height(26)
          .objectFit(ImageFit.Contain)
        Column({ space: 1 }) {
          Text('孔明职配 · 模拟面试')
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor('#F8FAFC')
          Text(`${this.trackedJobTitle || this.targetJob} · ${this.interviewType}`)
            .fontSize(9)
            .fontColor('#B8C2D1')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
      }
      .constraintSize({ maxWidth: this.isExpandedLayout() ? 380 : (this.isCompactLayout() ? 190 : 300) })
      Blank()
      Column({ space: 3 }) {
        Row({ space: 7 }) {
          Text(`第 ${Math.max(1, this.interviewRound)} / ${this.interviewTargetRounds()} 轮`)
            .fontSize(9)
            .fontColor('#B8C2D1')
          SymbolGlyph($r('sys.symbol.clock'))
            .fontSize(12)
            .fontColor([this.interviewTimeExpired ? '#F2B84B' : '#DDE7F6'])
          Text(this.formattedInterviewTime())
            .fontSize(11)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.interviewTimeExpired ? '#F2B84B' : '#F8FAFC')
        }
        Progress({ value: this.interviewProgressValue(), total: 100, type: ProgressType.Linear })
          .width(this.isExpandedLayout() ? 180 : (this.isCompactLayout() ? 90 : 150))
          .height(3)
          .color(this.interviewTimeExpired ? '#F2B84B' : '#75A7FF')
          .backgroundColor('#45FFFFFF')
      }
      .alignItems(HorizontalAlign.End)
      Button() {
        SymbolGlyph($r('sys.symbol.pause'))
          .fontSize(16)
          .fontColor(['#F8FAFC'])
      }
      .width(36)
      .height(36)
      .backgroundColor('#2FFFFFFF')
      .borderRadius(8)
      .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
      .accessibilityText('暂停面试')
      .onClick(() => { void this.pauseInterview(); })
      Button() {
        SymbolGlyph($r('sys.symbol.stop_circle'))
          .fontSize(17)
          .fontColor(['#FFD7D7'])
      }
      .width(36)
      .height(36)
      .backgroundColor('#8FB91C1C')
      .borderRadius(8)
      .enabled(!this.interviewLoading)
      .accessibilityText('提前结束面试')
      .onClick(() => { this.requestEndInterview(); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .constraintSize({ minHeight: 48, maxHeight: 48 })
    .padding({ left: 12, right: 10, top: 5, bottom: 5 })
    .backgroundColor('#F0161D27')
    .border({ width: { bottom: 1 }, color: '#33FFFFFF' })
  }

  @Builder
  private buildImmersiveQuestionOverlay(): void {
    Column({ space: 4 }) {
      Row({ space: 7 }) {
        Text(this.interviewTurns.length >= this.interviewTargetRounds()
          ? '问答完成'
          : `问题 ${Math.max(1, this.interviewRound)} · ${this.interviewCompetencyForRound(Math.max(1, this.interviewRound)).label}`)
          .fontSize(9)
          .fontWeight(FontWeight.Medium)
          .fontColor('#AFC8FF')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Blank()
        if (this.interviewAnswer.trim().length > 0) {
          Text(`已记录 ${this.interviewAnswer.trim().length} 字`)
            .fontSize(9)
            .fontColor('#9FE3C7')
        }
      }
      .width('100%')
      Text(this.interviewTurns.length >= this.interviewTargetRounds()
        ? '本轮问答已完成，可以生成复盘。'
        : (this.interviewQuestion || this.fallbackInterviewQuestion(1)))
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor('#FFFFFF')
        .lineHeight(21)
        .maxLines(3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width(this.isCompactLayout() ? '92%' : '78%')
    .constraintSize({ maxWidth: this.interviewOverlayMaxWidth() })
    .padding({ left: 14, right: 14, top: 9, bottom: 10 })
    .backgroundColor('#D918202B')
    .border({ width: 1, color: '#33FFFFFF' })
    .borderRadius(8)
    .alignSelf(ItemAlign.Center)
  }

  @Builder
  private buildImmersiveControls(): void {
    Row({ space: 7 }) {
      Button() {
        Row({ space: 5 }) {
          SymbolGlyph(this.interviewSpeaking ? $r('sys.symbol.stop_circle') : $r('sys.symbol.waveform'))
            .fontSize(14)
            .fontColor([this.interviewSpeaking ? '#FFD7D7' : '#F8FAFC'])
          if (!this.isCompactLayout()) {
            Text(this.interviewSpeaking ? '停止提问' : '重播问题')
              .fontSize(9)
              .fontColor('#F8FAFC')
          }
        }
      }
      .constraintSize({ minWidth: this.isCompactLayout() ? 44 : 98, minHeight: 40, maxHeight: 40 })
      .padding({ left: this.isCompactLayout() ? 8 : 10, right: this.isCompactLayout() ? 8 : 10 })
      .backgroundColor(this.interviewSpeaking ? '#8FB91C1C' : '#D91A2230')
      .borderRadius(8)
      .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
      .onClick(() => {
        if (this.interviewSpeaking) void this.stopInterviewPrompt();
        else void this.speakInterviewPrompt();
      })
      if (this.interviewTurns.length < this.interviewTargetRounds()) {
        Button() {
          Row({ space: 6 }) {
            SymbolGlyph(this.speechActive ? $r('sys.symbol.stop_circle') : $r('sys.symbol.mic'))
              .fontSize(16)
              .fontColor(['#FFFFFF'])
            if (!this.isCompactLayout()) {
              Text(this.speechActive ? '结束回答' : '语音回答')
                .fontSize(10)
                .fontWeight(FontWeight.Medium)
                .fontColor('#FFFFFF')
            }
          }
        }
        .constraintSize({ minWidth: this.isCompactLayout() ? 48 : 116, minHeight: 42, maxHeight: 42 })
        .padding({ left: this.isCompactLayout() ? 8 : 13, right: this.isCompactLayout() ? 8 : 13 })
        .backgroundColor(this.speechActive ? '#D94848' : '#3156D3')
        .borderRadius(8)
        .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
        .onClick(() => { void this.toggleSpeechInput(); })
        Button() {
          Row({ space: 5 }) {
            SymbolGlyph($r('sys.symbol.doc_text'))
              .fontSize(14)
              .fontColor(['#F8FAFC'])
            if (!this.isCompactLayout()) {
              Text('文字回答')
                .fontSize(9)
                .fontColor('#F8FAFC')
            }
          }
        }
        .constraintSize({ minWidth: this.isCompactLayout() ? 44 : 96, minHeight: 40, maxHeight: 40 })
        .padding({ left: this.isCompactLayout() ? 8 : 10, right: this.isCompactLayout() ? 8 : 10 })
        .backgroundColor('#D91A2230')
        .borderRadius(8)
        .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
        .onClick(() => { this.openInterviewTextAnswer(); })
        Button() {
          Row({ space: 5 }) {
            if (this.interviewLoading) {
              LoadingProgress().width(13).height(13).color('#FFFFFF')
            } else {
              SymbolGlyph($r('sys.symbol.paperplane_fill'))
                .fontSize(13)
                .fontColor(['#FFFFFF'])
            }
            if (!this.isCompactLayout()) {
              Text(this.interviewLoading ? '准备追问' : '提交本轮')
                .fontSize(9)
                .fontWeight(FontWeight.Medium)
                .fontColor('#FFFFFF')
            }
          }
        }
        .constraintSize({ minWidth: this.isCompactLayout() ? 44 : 100, minHeight: 40, maxHeight: 40 })
        .padding({ left: this.isCompactLayout() ? 8 : 10, right: this.isCompactLayout() ? 8 : 10 })
        .backgroundColor('#147D58')
        .borderRadius(8)
        .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' &&
          this.interviewAnswer.trim().length >= 20)
        .onClick(() => { void this.submitInterviewAnswer(); })
      } else {
        Button() {
          Row({ space: 6 }) {
            SymbolGlyph($r('sys.symbol.checkmark_circle'))
              .fontSize(15)
              .fontColor(['#FFFFFF'])
            Text('生成本轮复盘')
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor('#FFFFFF')
          }
        }
        .constraintSize({ minWidth: 150, minHeight: 42, maxHeight: 42 })
        .backgroundColor('#147D58')
        .borderRadius(8)
        .enabled(!this.interviewLoading)
        .accessibilityText('结束面试并生成复盘')
        .onClick(() => { void this.finishInterview(); })
      }
    }
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .constraintSize({ maxWidth: this.interviewOverlayMaxWidth(), minHeight: 52 })
    .padding({ left: 8, right: 8, top: 5, bottom: 5 })
    .backgroundColor('#D90B111A')
    .border({ width: 1, color: '#28FFFFFF' })
    .borderRadius(8)
    .alignSelf(ItemAlign.Center)
  }

  @Builder
  private buildImmersiveAnswerPanel(): void {
    Column({ space: this.interviewKeyboardVisible ? 4 : 8 }) {
      Row({ space: 8 }) {
        Column({ space: 1 }) {
          Text('文字回答')
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(`第 ${Math.max(1, this.interviewRound)} 轮 · 至少 20 字`)
            .fontSize(9)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Button() {
          SymbolGlyph($r('sys.symbol.xmark'))
            .fontSize(14)
            .fontColor([$r('app.color.km_text_secondary')])
        }
        .width(34)
        .height(34)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .borderRadius(8)
        .id('interview-answer-close')
        .accessibilityText('关闭文字回答')
        .onClick(() => { this.dismissInterviewKeyboard(); })
      }
      .width('100%')
      Text(this.interviewQuestion || this.fallbackInterviewQuestion(1))
        .fontSize(this.interviewKeyboardVisible ? 10 : 12)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
        .lineHeight(this.interviewKeyboardVisible ? 14 : 18)
        .maxLines(this.interviewKeyboardVisible ? 1 : 3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      TextArea({ placeholder: '输入真实回答，不要填写无法核验的成果。', text: this.interviewAnswer })
        .id('interview-answer-editor')
        .layoutWeight(1)
        .constraintSize({ minHeight: this.interviewKeyboardVisible ? 24 : 72 })
        .maxLength(3000)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: this.interviewAnswerError ? $r('app.color.km_danger') : $r('app.color.km_border') })
        .borderRadius(8)
        .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' && this.interviewTurns.length < this.interviewTargetRounds())
        .enableKeyboardOnFocus(true)
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
      Row({ space: 8 }) {
        Text(this.interviewAnswerError || `${this.interviewAnswer.length}/3000`)
          .fontSize(9)
          .fontColor(this.interviewAnswerError ? $r('app.color.km_danger') : $r('app.color.km_text_tertiary'))
          .maxLines(this.interviewKeyboardVisible ? 1 : 2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        Button() {
          Row({ space: 5 }) {
            SymbolGlyph($r('sys.symbol.paperplane_fill'))
              .fontSize(13)
              .fontColor([$r('app.color.km_text_on_primary')])
            Text('提交本轮')
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_on_primary'))
          }
        }
        .id('interview-answer-submit')
        .constraintSize({ minWidth: 112, minHeight: this.interviewKeyboardVisible ? 32 : 38 })
        .backgroundColor($r('app.color.km_primary_action'))
        .borderRadius(8)
        .accessibilityText('提交本轮文字回答')
        .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' &&
          this.interviewAnswer.trim().length >= 20)
        .onClick(() => {
          this.dismissInterviewKeyboard();
          void this.submitInterviewAnswer();
        })
      }
      .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width(this.interviewKeyboardVisible ? '100%' : this.immersiveSidePanelWidth())
    .height('100%')
    .padding(this.interviewKeyboardVisible ? 6 : 12)
    .backgroundColor('#FAFFFFFF')
    .border({ width: { left: 1 }, color: $r('app.color.km_border_strong') })
    .shadow({ radius: 22, color: '#66000000', offsetX: -6 })
  }

  @Builder
  private buildImmersiveInterviewerStage(): void {
    Stack({ alignContent: Alignment.Center }) {
      NativeDigitalInterviewer({
        avatarState: this.interviewAvatarState,
        compact: this.isCompactLayout(),
        fullStage: true,
        showIdentity: false,
      })
        .width('100%')
        .height('100%')
      Column({ space: 8 }) {
        Row({ space: 7 }) {
          Circle()
            .width(6)
            .height(6)
            .fill(this.interviewerPresenceColor())
          Text(this.interviewerPresenceLabel())
            .fontSize(10)
            .fontWeight(FontWeight.Medium)
            .fontColor('#F8FAFC')
        }
        .padding({ left: 10, right: 10, top: 6, bottom: 6 })
        .backgroundColor('#C817202B')
        .border({ width: 1, color: '#2FFFFFFF' })
        .borderRadius(15)
        if (this.interviewInputNotice && !this.interviewTextFallbackVisible) {
          Column({ space: 6 }) {
            Text(this.interviewInputNotice)
              .id('interview-input-notice')
              .fontSize(11)
              .fontColor('#FFFFFF')
              .lineHeight(16)
              .maxLines(3)
              .width('100%')
            Button('改用文字回答')
              .fontSize(10)
              .height(32)
              .backgroundColor('#FFFFFF')
              .fontColor('#18202B')
              .borderRadius(6)
              .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active')
              .onClick(() => { this.openInterviewTextAnswer(); })
          }
          .alignItems(HorizontalAlign.Start)
          .width(this.isCompactLayout() ? 260 : 360)
          .padding(10)
          .backgroundColor('#F0753515')
          .borderRadius(8)
        }
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .height('100%')
      .padding({ left: 12, top: 10 })
      .hitTestBehavior(HitTestMode.Transparent)
      if (this.interviewSessionPhase === 'active') {
        Stack({ alignContent: Alignment.TopEnd }) {
          NativeCandidateCamera({
            active: true,
            sessionId: this.currentInterviewSessionId,
            existingVideoUri: this.currentInterviewVideoUri,
            maxDurationSeconds: Math.max(60, this.interviewDurationMinutes * 60 - this.interviewElapsedSeconds),
            viewportWidth: this.candidateCameraWidth(),
            viewportHeight: this.candidateCameraHeight(),
            onRecordingSaved: (
              sessionId: string,
              videoUri: string,
              durationSeconds: number,
              sizeBytes: number,
            ) => {
              this.handleCandidateRecordingSaved(sessionId, videoUri, durationSeconds, sizeBytes);
            },
            onRecordingStateChange: (sessionId: string, recording: boolean) => {
              this.handleCandidateRecordingState(sessionId, recording);
            },
          })
        }
        .width('100%')
        .height('100%')
        .padding({ right: 12, top: 10 })
        .hitTestBehavior(HitTestMode.Transparent)
      }
      if (!this.interviewTextFallbackVisible) {
        Column({ space: 7 }) {
          Blank()
          this.buildImmersiveQuestionOverlay()
          this.buildImmersiveControls()
        }
        .width('100%')
        .height('100%')
        .padding({ left: 14, right: 14, bottom: 10 })
        .hitTestBehavior(HitTestMode.Transparent)
      }
      if (this.interviewTextFallbackVisible) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('#66050A12')
        Row() {
          Blank().layoutWeight(1)
          this.buildImmersiveAnswerPanel()
        }
        .width('100%')
        .height('100%')
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#111821')
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
    .width(this.isCompactLayout() ? '92%' : this.immersiveSidePanelWidth())
    .padding(22)
    .backgroundColor($r('app.color.km_surface_elevated'))
    .border({ width: 1, color: this.interviewTimeExpired ? $r('app.color.km_warning') : $r('app.color.km_primary_action') })
    .borderRadius(8)
    .shadow({ radius: 24, color: '#66000000', offsetY: 8 })
  }

  @Builder
  private buildImmersiveInterview(): void {
    Stack({ alignContent: Alignment.Center }) {
      Column() {
        if (!this.interviewKeyboardVisible) {
          this.buildImmersiveInterviewHeader()
        }
        Stack() {
          this.buildImmersiveInterviewerStage()
        }
        .width('100%')
        .layoutWeight(1)
      }
      .width('100%')
      .height('100%')
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
    .backgroundColor('#111821')
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
  private buildInterviewCompetencyPlan(): void {
    Column({ space: 9 }) {
      Row() {
        Column({ space: 2 }) {
          Text('本轮能力题谱')
            .fontSize(12)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text('每轮只聚焦一个核验目标，减少重复和泛泛追问。')
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(`${this.plannedInterviewCompetencies().length} 项`)
          .fontSize(9)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_primary_action'))
      }
      .width('100%')
      ForEach(this.plannedInterviewCompetencies(), (competency: NativeInterviewCompetency, index: number) => {
        Row({ space: 9 }) {
          Text(`${index + 1}`)
            .fontSize(9)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_primary_action'))
            .width(24)
            .height(24)
            .textAlign(TextAlign.Center)
            .backgroundColor($r('app.color.km_primary_tint'))
            .borderRadius(12)
          Column({ space: 2 }) {
            Text(competency.label)
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
            Text(competency.detail)
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
              .lineHeight(14)
              .maxLines(2)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .alignItems(VerticalAlign.Top)
        .width('100%')
      }, (competency: NativeInterviewCompetency) => competency.key)
      Text(this.trackedJobDescription.trim()
        ? '题谱已结合当前岗位信息；更换岗位或面试类型后会重新生成。'
        : '当前缺少完整岗位说明，先按目标岗位和面试类型生成基础题谱。')
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
        .lineHeight(15)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildInterviewJobContext(): void {
    Column({ space: 10 }) {
      Row({ space: 10 }) {
        SymbolGlyph($r('sys.symbol.briefcase'))
          .fontSize(20)
          .fontColor([$r('app.color.km_primary_action')])
        Column({ space: 3 }) {
          Text('本轮岗位上下文')
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
          Text(this.activeJobContextLabel())
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .maxLines(2)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(this.trackedJobDescription.trim() ? '真实 JD 已绑定' : '基础岗位画像')
          .fontSize(9)
          .fontColor(this.trackedJobDescription.trim() ? $r('app.color.km_success') : $r('app.color.km_warning'))
          .padding({ left: 8, right: 8, top: 5, bottom: 5 })
          .backgroundColor(this.trackedJobDescription.trim() ? $r('app.color.km_success_soft') : $r('app.color.km_warning_soft'))
          .borderRadius(8)
      }
      .width('100%')

      Row({ space: 8 }) {
        Text(this.interviewResumeVersionName())
          .fontSize(9)
          .fontColor($r('app.color.km_primary_action'))
          .padding({ left: 8, right: 8, top: 5, bottom: 5 })
          .backgroundColor($r('app.color.km_primary_tint'))
          .borderRadius(7)
        Text(this.trackedJobDescription.trim()
          ? `岗位说明 ${this.trackedJobDescription.trim().length} 字`
          : '建议先在岗位页保存完整 JD')
          .fontSize(9)
          .fontColor($r('app.color.km_text_secondary'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')

      Column({ space: 6 }) {
        Row() {
          Column({ space: 2 }) {
            Text(`推荐方案 · ${this.recommendedInterviewType()}`)
              .fontSize(11)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text(this.recommendedInterviewReason())
              .fontSize(9)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(15)
              .maxLines(3)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Button(this.interviewType === this.recommendedInterviewType() ? '已采用' : '采用')
            .constraintSize({ minHeight: 32 })
            .fontSize(9)
            .fontColor(this.interviewType === this.recommendedInterviewType()
              ? $r('app.color.km_success')
              : $r('app.color.km_primary_action'))
            .backgroundColor(this.interviewType === this.recommendedInterviewType()
              ? $r('app.color.km_success_soft')
              : $r('app.color.km_primary_soft'))
            .borderRadius(6)
            .onClick(() => { this.applyRecommendedInterviewPlan(); })
        }
        .alignItems(VerticalAlign.Center)
        .width('100%')

        Text('岗位核验重点')
          .fontSize(9)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_secondary'))
        Grid() {
          ForEach(this.interviewRequirementFocuses(), (focus: string) => {
            GridItem() {
              Text(focus)
                .fontSize(9)
                .fontColor($r('app.color.km_primary_action'))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .textAlign(TextAlign.Center)
                .width('100%')
                .padding({ top: 6, bottom: 6, left: 5, right: 5 })
                .backgroundColor($r('app.color.km_primary_tint'))
                .borderRadius(6)
            }
          }, (focus: string) => `interview-focus-${focus}`)
        }
        .columnsTemplate('1fr 1fr')
        .columnsGap(6)
        .rowsGap(6)
        .constraintSize({ minHeight: 36 })
        .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(10)
      .backgroundColor($r('app.color.km_surface_subtle'))
      .borderRadius(7)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildInterviewCompetencyCoverage(): void {
    Column({ space: 10 }) {
      this.buildSectionHeading(
        '岗位能力覆盖',
        `已完成 ${this.currentInterviewCompetencyCoveredCount()} / ${this.currentInterviewCompetencyLabels().length} 项核验`,
      )
      ForEach(this.currentInterviewCompetencyLabels(), (label: string, index: number) => {
        Column({ space: 6 }) {
          Row({ space: 9 }) {
            SymbolGlyph(index < this.currentInterviewCompetencyCoveredCount()
              ? $r('sys.symbol.checkmark_circle')
              : $r('sys.symbol.clock'))
              .fontSize(17)
              .fontColor([index < this.currentInterviewCompetencyCoveredCount()
                ? $r('app.color.km_success')
                : $r('app.color.km_text_tertiary')])
            Text(label)
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
              .layoutWeight(1)
            if (this.currentInterviewCompetencyResult(index)) {
              Text(`${this.currentInterviewCompetencyResult(index)?.score || 0} · ${this.currentInterviewCompetencyResult(index)?.status || ''}`)
                .fontSize(9)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.competencyScoreColor(this.currentInterviewCompetencyResult(index)?.score || 0))
            } else {
              Text(index < this.currentInterviewCompetencyCoveredCount() ? '已回答' : '未覆盖')
                .fontSize(9)
                .fontColor(index < this.currentInterviewCompetencyCoveredCount()
                  ? $r('app.color.km_text_secondary')
                  : $r('app.color.km_warning'))
            }
          }
          .width('100%')
          if (this.currentInterviewCompetencyResult(index)) {
            Text(`回答摘录：${this.currentInterviewCompetencyResult(index)?.evidenceExcerpt || ''}`)
              .fontSize(9)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(15)
              .maxLines(3)
            Text(`待补证据：${this.currentInterviewCompetencyResult(index)?.gap || ''}`)
              .fontSize(9)
              .fontColor(this.competencyScoreColor(this.currentInterviewCompetencyResult(index)?.score || 0))
              .lineHeight(15)
              .maxLines(2)
          } else if (index < this.currentInterviewCompetencyCoveredCount()) {
            Text('该记录生成于证据级评分上线前，仅保留已回答状态。')
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
      }, (label: string, index: number) => `${index}-${label}`)
      Text('逐项分数来自本轮回答中的确定性文本信号，仅用于训练复盘；题谱覆盖和训练分都不代表招聘结论或实际胜任水平。')
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
        .lineHeight(15)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildInterviewReportMetric(label: string, dimension: string, detail: string, color: ResourceColor): void {
    Column({ space: 6 }) {
      Row() {
        Text(label)
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_text_primary'))
        Blank()
        Text(`${this.interviewAssessmentScore(this.currentInterviewAssessment(), dimension)}`)
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor(color)
      }
      .width('100%')
      Progress({ value: this.interviewAssessmentScore(this.currentInterviewAssessment(), dimension), total: 100, type: ProgressType.Linear })
        .width('100%')
        .height(5)
        .color(color)
        .backgroundColor($r('app.color.km_border'))
      Text(detail)
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
        .lineHeight(14)
        .maxLines(2)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildInterviewReport(): void {
    Column({ space: 14 }) {
      Column({ space: 12 }) {
        Row({ space: 14 }) {
          Column({ space: 2 }) {
            Text('训练表现')
              .fontSize(10)
              .fontColor($r('app.color.km_primary_action'))
            Row({ space: 3 }) {
              Text(`${this.currentInterviewAssessment().overallScore}`)
                .fontSize(36)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text('/ 100')
                .fontSize(11)
                .fontColor($r('app.color.km_text_tertiary'))
                .margin({ bottom: 6 })
            }
            .alignItems(VerticalAlign.Bottom)
          }
          .alignItems(HorizontalAlign.Start)
          Column({ space: 4 }) {
            Text(`${this.interviewType} · ${this.interviewDifficulty}难度`)
              .fontSize(13)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text(`${this.interviewTurns.length} 轮回答 · 用时 ${this.formattedInterviewTime()}`)
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
              .maxLines(2)
            Text(this.currentInterviewAssessment().evidenceLabel)
              .fontSize(9)
              .fontColor($r('app.color.km_success'))
              .padding({ left: 8, right: 8, top: 4, bottom: 4 })
              .backgroundColor($r('app.color.km_success_soft'))
              .borderRadius(8)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .alignItems(VerticalAlign.Center)
        .width('100%')
        Progress({ value: this.currentInterviewAssessment().overallScore, total: 100, type: ProgressType.Linear })
          .width('100%')
          .height(6)
          .color($r('app.color.km_primary_action'))
          .backgroundColor($r('app.color.km_border'))
        Text('评分依据本轮回答中的结构、证据和岗位关联生成，仅用于训练复盘，不代表招聘结论或实际胜任水平。')
          .fontSize(9)
          .fontColor($r('app.color.km_text_tertiary'))
          .lineHeight(15)
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(16)
      .backgroundColor($r('app.color.km_primary_tint'))
      .border({ width: 1, color: $r('app.color.km_primary_soft') })
      .borderRadius(8)

      if (this.currentRetestRecord()) {
        Column({ space: 11 }) {
          Row() {
            Column({ space: 2 }) {
              Text('专项复测结果')
                .fontSize(14)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text(this.growthFocusLabel(this.currentRetestRecord()?.trainingFocusDimension || 'general'))
                .fontSize(10)
                .fontColor($r('app.color.km_text_secondary'))
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Column({ space: 2 }) {
              Text(this.currentRetestResultLabel())
                .fontSize(10)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.currentRetestDimensionDelta() >= 0
                  ? $r('app.color.km_success')
                  : $r('app.color.km_warning'))
              Text(this.currentRetestGoalLabel())
                .fontSize(9)
                .fontColor(this.currentRetestGoalLabel().startsWith('已达标')
                  ? $r('app.color.km_success')
                  : $r('app.color.km_warning'))
            }
            .alignItems(HorizontalAlign.End)
          }
          .width('100%')
          Row({ space: 8 }) {
            Column({ space: 2 }) {
              Text(`${this.currentRetestRecord()?.trainingBaselineScore || 0}`)
                .fontSize(19)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
              Text('训练前')
                .fontSize(9)
                .fontColor($r('app.color.km_text_tertiary'))
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Center)
            Column({ space: 2 }) {
              Text(`${this.interviewRecordDimensionScore(
                this.currentRetestRecord() as NativeInterviewSessionRecord,
                this.currentRetestRecord()?.trainingFocusDimension || 'structure',
              )}`)
                .fontSize(19)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_primary_action'))
              Text('本次复测')
                .fontSize(9)
                .fontColor($r('app.color.km_text_tertiary'))
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Center)
            Column({ space: 2 }) {
              Text(`${this.currentRetestRecord()?.trainingTargetScore || 0}`)
                .fontSize(19)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_success'))
              Text('训练目标')
                .fontSize(9)
                .fontColor($r('app.color.km_text_tertiary'))
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Center)
          }
          .width('100%')
          .padding({ top: 9, bottom: 9 })
          .backgroundColor($r('app.color.km_surface_subtle'))
          .borderRadius(6)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(15)
        .backgroundColor($r('app.color.km_success_surface'))
        .border({ width: 1, color: $r('app.color.km_success_border') })
        .borderRadius(8)
      }

      this.buildInterviewCompetencyCoverage()

      Column({ space: 12 }) {
        this.buildSectionHeading('能力维度', '依据回答文本中的结构、责任、结果和岗位线索生成。')
        this.buildInterviewReportMetric(
          '回答结构',
          'structure',
          '背景、行动、结果与复盘的完整程度',
          $r('app.color.km_primary_action'),
        )
        this.buildInterviewReportMetric(
          '证据可信度',
          'evidence',
          '个人责任、结果数字与可核验材料线索',
          $r('app.color.km_success'),
        )
        this.buildInterviewReportMetric(
          '岗位关联',
          'relevance',
          '经历与岗位职责、业务和用户价值的联系',
          $r('app.color.km_warning'),
        )
        this.buildInterviewReportMetric(
          '表达清晰度',
          'clarity',
          '回答篇幅、顺序和结论表达的可理解性',
          $r('app.color.km_purple'),
        )
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(16)
      .backgroundColor($r('app.color.km_surface'))
      .border({ width: 1, color: $r('app.color.km_border') })
      .borderRadius(8)

      Column({ space: 12 }) {
        this.buildSectionHeading('本轮诊断', '先保留表现稳定的部分，再集中修正一个关键缺口。')
        Row({ space: 10 }) {
          SymbolGlyph($r('sys.symbol.checkmark_circle'))
            .fontSize(19)
            .fontColor([$r('app.color.km_success')])
          Column({ space: 2 }) {
            Text('相对优势')
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
            Text(this.currentInterviewAssessment().strongestLabel)
              .fontSize(12)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .alignItems(VerticalAlign.Center)
        .width('100%')
        Row({ space: 10 }) {
          SymbolGlyph($r('sys.symbol.ranking'))
            .fontSize(19)
            .fontColor([$r('app.color.km_warning')])
          Column({ space: 2 }) {
            Text('优先改进')
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
            Text(this.currentInterviewAssessment().priorityLabel)
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
              .lineHeight(17)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .alignItems(VerticalAlign.Top)
        .width('100%')
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
            Text('岗位化反馈')
              .fontSize(15)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
          }
          .alignItems(HorizontalAlign.Start)
          Blank()
          SymbolGlyph($r('sys.symbol.info_circle'))
            .fontSize(20)
            .fontColor([$r('app.color.km_primary_action')])
        }
        .width('100%')
        Text(this.interviewFeedback || '本轮反馈正在整理。')
          .fontSize(11)
          .fontColor($r('app.color.km_text_secondary'))
          .lineHeight(19)
          .width('100%')
        if (this.currentInterviewAssessment().evidenceReferences.length > 0) {
          Divider().color($r('app.color.km_border'))
          Text('回答证据引用')
            .fontSize(10)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          ForEach(this.currentInterviewAssessment().evidenceReferences, (reference: string) => {
            Row({ space: 7 }) {
              Circle()
                .width(5)
                .height(5)
                .fill($r('app.color.km_primary_action'))
              Text(reference)
                .fontSize(9)
                .fontColor($r('app.color.km_text_secondary'))
                .lineHeight(16)
                .layoutWeight(1)
            }
            .alignItems(VerticalAlign.Top)
            .width('100%')
          }, (reference: string) => reference)
        }
        if (this.currentInterviewAssessment().improvedAnswer) {
          Divider().color($r('app.color.km_border'))
          Text('STAR 改写示例')
            .fontSize(10)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(this.currentInterviewAssessment().improvedAnswer)
            .fontSize(10)
            .fontColor($r('app.color.km_text_body'))
            .lineHeight(18)
            .width('100%')
          Text('示例只重组本轮已表达事实；“待补充”内容需要你自行核实。')
            .fontSize(9)
            .fontColor($r('app.color.km_text_tertiary'))
        }
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(16)
      .backgroundColor($r('app.color.km_surface'))
      .border({ width: 1, color: $r('app.color.km_border') })
      .borderRadius(8)

      Column({ space: 10 }) {
        Button() {
          Row({ space: 8 }) {
            SymbolGlyph($r('sys.symbol.info_circle'))
              .fontSize(16)
              .fontColor([$r('app.color.km_primary_action')])
            Text(this.interviewTranscriptExpanded ? '收起问答记录' : `查看 ${this.interviewTurns.length} 轮问答记录`)
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_primary_action'))
            Blank()
            SymbolGlyph($r('sys.symbol.chevron_right'))
              .fontSize(13)
              .fontColor([$r('app.color.km_primary_action')])
              .rotate({ angle: this.interviewTranscriptExpanded ? -90 : 90 })
          }
          .width('100%')
        }
        .width('100%')
        .constraintSize({ minHeight: 42 })
        .padding({ left: 12, right: 12 })
        .backgroundColor($r('app.color.km_surface_subtle'))
        .borderRadius(8)
        .onClick(() => { this.interviewTranscriptExpanded = !this.interviewTranscriptExpanded; })
        if (this.interviewTranscriptExpanded) {
          ForEach(this.interviewTurns, (turn: NativeInterviewTurn) => {
            Column({ space: 6 }) {
              Text(turn.question)
                .fontSize(11)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
                .lineHeight(18)
              Text(turn.answer)
                .fontSize(10)
                .fontColor($r('app.color.km_text_secondary'))
                .lineHeight(17)
              Text(turn.createdAt)
                .fontSize(8)
                .fontColor($r('app.color.km_text_tertiary'))
              Divider().color($r('app.color.km_border'))
            }
            .alignItems(HorizontalAlign.Start)
            .width('100%')
          }, (turn: NativeInterviewTurn) => `${turn.createdAt}-${turn.question}`)
        }
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(16)
      .backgroundColor($r('app.color.km_surface'))
      .border({ width: 1, color: $r('app.color.km_border') })
      .borderRadius(8)

      Row({ space: 10 }) {
        Button() {
          Row({ space: 6 }) {
            SymbolGlyph($r('sys.symbol.ranking'))
              .fontSize(15)
              .fontColor([$r('app.color.km_success')])
            Text('查看成长任务')
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_success'))
          }
        }
        .layoutWeight(1)
        .constraintSize({ minHeight: 44 })
        .backgroundColor($r('app.color.km_success_soft'))
        .borderRadius(8)
        .onClick(() => { this.requestTabChange(4); })
        Button() {
          Row({ space: 6 }) {
            SymbolGlyph($r('sys.symbol.play_fill'))
              .fontSize(15)
              .fontColor([$r('app.color.km_text_secondary')])
            Text('重新训练')
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_secondary'))
          }
        }
        .layoutWeight(1)
        .constraintSize({ minHeight: 44 })
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)
        .onClick(() => { this.requestResetInterview(); })
      }
      .width('100%')
      NativeStatusMessage({ message: this.interviewMessage })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildInterviewHistory(): void {
    Button() {
      Row({ space: 10 }) {
        SymbolGlyph($r('sys.symbol.doc_text'))
          .fontSize(18)
          .fontColor([$r('app.color.km_primary_action')])
        Column({ space: 4 }) {
          Text('面试记录')
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_text_primary'))
          Text(`${this.activeJobContextLabel()} · ${this.activeInterviewSessions().length} 次训练`)
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
            .maxLines(2)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        SymbolGlyph($r('sys.symbol.chevron_right'))
          .fontSize(13)
          .fontColor([$r('app.color.km_text_tertiary')])
      }
      .width('100%')
      .padding(12)
    }
    .width('100%')
    .backgroundColor($r('app.color.km_surface_subtle'))
    .borderRadius(6)
    .onClick(() => { this.requestInterviewSection(1); })
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
        Text(this.interviewEnhancementSummary())
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
      .accessibilityText(this.modelConsent ? '开始个性化模拟面试' : '开始标准模拟面试')
      .enabled(!this.interviewLoading)
      .onClick(() => { void this.startInterview(); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
  }

  private requestInterviewSection(section: number): void {
    if (this.interviewLoading || (section === 1 && this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused'))) {
      this.showGlobalNotice('请先完成或结束当前面试，再查看训练记录。', 'info');
      return;
    }
    this.uiContext.getFocusController().clearFocus();
    this.interviewHistorySearchEditing = false;
    this.interviewHistoryRecordId = '';
    this.interviewHistoryComparing = false;
    this.interviewSection = section;
  }

  private backFromInterviewHistory(): void {
    const searchEditing = this.interviewHistorySearchEditing;
    this.uiContext.getFocusController().clearFocus();
    if (!this.interviewHistoryRecordId && !this.interviewHistoryComparing && searchEditing) {
      this.interviewHistorySearchEditing = false;
      return;
    }
    this.interviewHistorySearchEditing = false;
    if (this.interviewHistoryRecordId) this.interviewHistoryRecordId = '';
    else if (this.interviewHistoryComparing) this.interviewHistoryComparing = false;
    else this.requestInterviewSection(0);
  }

  private historyPracticeJobKeys(): string[] {
    return [...this.trackedJobRecords.map((record: NativeTrackedJobRecord) => record.key), this.activeJobContextKey()];
  }

  private prepareHistoryTraining(session: NativeInterviewSessionRecord): void {
    if (this.hasUnsavedChanges() || this.jobMaterialSaving) {
      this.showGlobalNotice('请先保存当前修改，再准备下一次面试。', 'warning');
      return;
    }
    if (this.interviewLoading || (this.interviewStarted &&
      (this.interviewSessionPhase === 'active' || this.interviewSessionPhase === 'paused'))) {
      this.showGlobalNotice('请先完成或结束当前面试。', 'warning');
      return;
    }
    const record = this.findTrackedJobRecord(session.jobKey);
    if (record) {
      if (!this.selectTrackedJob(record.key)) return;
    } else if (session.jobKey !== this.activeJobContextKey()) {
      this.showGlobalNotice('该岗位资料已移除，历史复盘仍可查看。', 'warning');
      return;
    }
    if (this.interviewSessionPhase === 'completed') this.resetInterview();
    this.applyRecommendedInterviewPlan();
    if (['综合面', '技术面', 'HR面'].includes(session.interviewType)) this.interviewType = session.interviewType;
    if (['基础', '标准', '高压'].includes(session.difficulty)) this.interviewDifficulty = session.difficulty;
    if ([10, 15, 20].includes(session.durationMinutes)) this.interviewDurationMinutes = session.durationMinutes;
    this.requestInterviewSection(0);
    this.showGlobalNotice('已准备同岗位训练，本次使用当前岗位资料与简历版本。', 'success');
  }

  @Builder
  private buildInterview(): void {
    Column() {
      if (!this.interviewHistoryRecordId && !this.interviewHistoryComparing || this.interviewSection === 0) {
        Row({ space: 4 }) {
          ForEach(['面试练习', '面试记录'], (label: string, index: number) => {
            Button() {
              Text(label)
                .fontSize(14)
                .fontWeight(this.interviewSection === index ? FontWeight.Bold : FontWeight.Medium)
                .fontColor(this.interviewSection === index ? $r('app.color.km_primary_action') : $r('app.color.km_text_secondary'))
                .width('100%')
                .textAlign(TextAlign.Center)
                .padding({ top: 13, bottom: 13 })
                .border({ width: { bottom: this.interviewSection === index ? 2 : 1 },
                  color: this.interviewSection === index ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
            }
            .layoutWeight(1)
            .backgroundColor(Color.Transparent)
            .borderRadius(0)
            .onClick(() => { this.requestInterviewSection(index); })
          }, (label: string) => label)
        }
        .width('100%')
        .padding({ left: this.pageHorizontalPadding(), right: this.pageHorizontalPadding(), top: 6 })
      }
      if (this.interviewSection === 1) {
        NativeInterviewHistoryWorkspace({
          sessions: this.interviewSessions,
          currentJobKey: this.activeJobContextKey(),
          practiceJobKeys: this.historyPracticeJobKeys(),
          horizontalPadding: this.pageHorizontalPadding(),
          contentMaxWidth: this.pageMaxWidth(),
          search: $interviewHistorySearch,
          scope: $interviewHistoryScope,
          kind: $interviewHistoryKind,
          recordId: $interviewHistoryRecordId,
          compareIds: $interviewHistoryCompareIds,
          comparing: $interviewHistoryComparing,
          onBack: () => { this.backFromInterviewHistory(); },
          onNewTraining: () => { this.requestInterviewSection(0); },
          onPractice: (session: NativeInterviewSessionRecord) => { this.prepareHistoryTraining(session); },
          onDeleteVideo: (session: NativeInterviewSessionRecord) => { this.requestDeleteInterviewVideo(session); },
          onNotice: (message: string) => { this.showGlobalNotice(message, 'warning'); },
          onSearchEditing: (editing: boolean) => { this.interviewHistorySearchEditing = editing; },
        })
      } else {
        this.buildInterviewPractice()
      }
    }
    .width('100%')
    .layoutWeight(1)
  }

  @Builder
  private buildInterviewPractice(): void {
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

        if (this.interviewSessionPhase === 'completed') {
          this.buildInterviewReport()
          this.buildInterviewHistory()
        }

        if (!this.interviewStarted) {
          Column({ space: 14 }) {
            this.buildSectionHeading('本轮设置', '先选择训练模式，再进入横屏全屏面试。')
            this.buildFieldLabel('面试类型', '', () => `本轮计划 ${this.interviewTargetRounds()} 轮核心问答`)
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

            this.buildInterviewJobContext()

            if (this.allActiveGrowthTasksVerified()) {
              Row({ space: 9 }) {
                SymbolGlyph($r('sys.symbol.ranking'))
                  .fontSize(17)
                  .fontColor([$r('app.color.km_success')])
                Column({ space: 2 }) {
                  Text(`专项复测 · ${this.growthFocusLabel(this.activeGrowthPrescriptionTask()?.focusDimension || 'general')}`)
                    .fontSize(11)
                    .fontWeight(FontWeight.Bold)
                    .fontColor($r('app.color.km_text_primary'))
                  Text(this.activeGrowthPrescriptionTask()?.sourceInterviewId
                    ? `训练前 ${this.activeGrowthPrescriptionTask()?.baselineScore || 0} 分 · 目标 ${this.activeGrowthPrescriptionTask()?.targetScore || 0} 分`
                    : '本轮将建立新的评分基线并生成专项处方')
                    .fontSize(9)
                    .fontColor($r('app.color.km_text_secondary'))
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)
              }
              .alignItems(VerticalAlign.Center)
              .width('100%')
              .padding(10)
              .backgroundColor($r('app.color.km_success_surface'))
              .borderRadius(6)
            }

            Divider().color($r('app.color.km_border'))
            this.buildInterviewCompetencyPlan()
            Divider().color($r('app.color.km_border'))

            this.buildFieldLabel('追问强度', '', () => this.interviewDifficultyHint())
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
              this.buildInterviewReadinessItem(
                this.trackedJobDescription.trim().length >= 30 ? '真实 JD 已绑定' : '使用基础方向',
                this.trackedJobDescription.trim().length >= 30,
              )
              this.buildInterviewReadinessItem(
                this.resumeSummary.trim().length >= 30 ? '画像已就绪' : '使用基础画像',
                this.resumeSummary.trim().length >= 30,
              )
              this.buildInterviewAudioReadinessItem()
            }
            .width('100%')

            Divider().color($r('app.color.km_border'))
            Row({ space: 12 }) {
              Toggle({ type: ToggleType.Switch, isOn: this.modelConsent })
                .selectedColor($r('app.color.km_primary_action'))
                .onChange((value: boolean) => { this.updateModelConsent(value); })
              Column({ space: 3 }) {
                Text('启用个性化追问')
                  .fontSize(13)
                  .fontWeight(FontWeight.Bold)
                  .fontColor($r('app.color.km_text_primary'))
                Text(this.modelConsent
                  ? '已脱敏的岗位信息和本次作答会用于在线生成追问与复盘。'
                  : '关闭时使用标准题库，回答仅保存在本机。')
                  .fontSize(10)
                  .fontColor($r('app.color.km_text_secondary'))
                  .lineHeight(17)
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
            }
            .alignItems(VerticalAlign.Top)
            .width('100%')
            .padding({ top: 2, bottom: 2 })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(16)
          .backgroundColor($r('app.color.km_surface'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          this.buildInterviewHistory()
        }

        if (this.interviewSessionPhase !== 'completed') {
          NativeDigitalInterviewer({
            avatarState: this.interviewAvatarState,
            compact: this.isCompactLayout(),
            viewportHeight: this.interviewerPreviewHeight(),
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
              Text(this.interviewSpeechMessage)
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
        }

        if (this.interviewStarted && this.interviewSessionPhase !== 'completed') {
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
                Text(`第 ${Math.max(1, this.interviewRound)} 轮 / ${this.interviewTargetRounds()}`)
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
              Text(`${this.interviewType} · 第 ${Math.max(1, this.interviewRound)} 轮 / ${this.interviewTargetRounds()}`)
                .fontSize(12)
                .fontColor($r('app.color.km_primary_action'))
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
            this.buildFieldLabel('本轮回答', '', () => `${this.interviewAnswer.length}/3000 · 至少 20 字`)
            TextArea({ placeholder: '输入真实回答，不要填写无法核验的成果。', text: this.interviewAnswer })
              .constraintSize({ minHeight: 180 })
              .maxLength(3000)
              .backgroundColor($r('app.color.km_surface_subtle'))
              .border({ width: 1, color: this.interviewAnswerError ? $r('app.color.km_danger') : $r('app.color.km_border') })
              .borderRadius(8)
              .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' && this.interviewTurns.length < this.interviewTargetRounds())
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
                .enabled(!this.interviewLoading && this.interviewSessionPhase === 'active' && this.interviewTurns.length < this.interviewTargetRounds())
                .onClick(() => { void this.toggleSpeechInput(); })
              }
              .width('100%')
            }
            if (this.interviewSessionPhase !== 'completed' && this.interviewTurns.length < this.interviewTargetRounds()) {
              Button(this.interviewLoading
                ? '正在生成岗位化问题…'
                : this.interviewTurns.length + 1 >= this.interviewTargetRounds()
                  ? '提交最后一轮回答'
                  : '提交回答并生成追问')
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
        .padding({
          left: this.pageHorizontalPadding(),
          right: this.pageHorizontalPadding(),
          top: 14,
          bottom: 18,
        })
        .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
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
  private buildGrowthPrescription(): void {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 2 }) {
          Text('本轮训练处方')
            .fontSize(14)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(this.growthFocusLabel(this.activeGrowthPrescriptionTask()?.focusDimension || 'general'))
            .fontSize(10)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(this.allActiveGrowthTasksVerified() ? '等待复测' : '专项训练中')
          .fontSize(9)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.allActiveGrowthTasksVerified()
            ? $r('app.color.km_success')
            : $r('app.color.km_primary_action'))
          .padding({ left: 8, right: 8, top: 5, bottom: 5 })
          .backgroundColor(this.allActiveGrowthTasksVerified()
            ? $r('app.color.km_success_soft')
            : $r('app.color.km_primary_soft'))
          .borderRadius(6)
      }
      .width('100%')

      if (this.activeGrowthPrescriptionTask()?.sourceInterviewId) {
        Row({ space: 8 }) {
          Column({ space: 2 }) {
            Text(`${this.activeGrowthPrescriptionTask()?.baselineScore || 0}`)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text('面试基线')
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
          }
          .alignItems(HorizontalAlign.Center)
          .layoutWeight(1)
          Text('→')
            .fontSize(16)
            .fontColor($r('app.color.km_text_tertiary'))
          Column({ space: 2 }) {
            Text(`${this.activeGrowthPrescriptionTask()?.targetScore || 0}`)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_success'))
            Text('复测目标')
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
          }
          .alignItems(HorizontalAlign.Center)
          .layoutWeight(1)
          Column({ space: 2 }) {
            Text(`${this.verifiedGrowthTaskCount()} / ${this.activeGrowthTasks().length}`)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_primary_action'))
            Text('任务进度')
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
          }
          .alignItems(HorizontalAlign.Center)
          .layoutWeight(1)
        }
        .width('100%')
        .padding({ top: 8, bottom: 8 })
        .backgroundColor($r('app.color.km_surface_subtle'))
        .borderRadius(6)
      } else {
        Text('这是历史版本成长计划。完成后可进行同岗位复测，新一轮将生成带评分基线的专项处方。')
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
          .lineHeight(17)
          .width('100%')
      }

      Progress({ value: this.verifiedGrowthTaskCount(), total: this.activeGrowthTasks().length, type: ProgressType.Linear })
        .width('100%')
        .height(5)
        .color($r('app.color.km_success'))
        .backgroundColor($r('app.color.km_border'))

      if (this.allActiveGrowthTasksVerified()) {
        Button() {
          Row({ space: 7 }) {
            SymbolGlyph($r('sys.symbol.play_fill'))
              .fontSize(15)
              .fontColor([$r('app.color.km_text_on_primary')])
            Text('进入同岗位复测')
              .fontSize(12)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_on_primary'))
          }
        }
        .width('100%')
        .constraintSize({ minHeight: 44 })
        .backgroundColor($r('app.color.km_primary_action'))
        .borderRadius(8)
        .onClick(() => { this.startGrowthRetest(); })
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(14)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }

  private startGrowthRetest(): void {
    if (!this.allActiveGrowthTasksVerified()) {
      this.growthMessage = '请先完成当前专项处方，再开始复测。';
      return;
    }
    this.clearInterviewPresentationForJobSwitch();
    this.interviewSection = 0;
    this.interviewMessage = this.hasScoredActiveGrowthPrescription()
      ? `本轮将重点复测“${this.growthFocusLabel(this.activeGrowthPrescriptionTask()?.focusDimension || 'general')}”。`
      : '本轮将完成同岗位复测，并建立新的能力评分基线。';
    this.showGlobalNotice('已进入同岗位复测设置，可调整面试类型和时长。', 'success');
    this.requestTabChange(3);
  }

  @Builder
  private buildGrowth(): void {
    Scroll() {
      Column({ space: 12 }) {
        this.buildPageHeading('行动计划', '成长计划', `围绕“${this.activeJobContextTitle()}”把岗位缺口拆成可执行、可提交、可复盘的任务。`)

        Row({ space: 10 }) {
          SymbolGlyph($r('sys.symbol.briefcase'))
            .fontSize(18)
            .fontColor([$r('app.color.km_primary_action')])
          Column({ space: 2 }) {
            Text('当前岗位')
              .fontSize(9)
              .fontColor($r('app.color.km_text_tertiary'))
            Text(this.activeJobContextLabel())
              .fontSize(14)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(`${this.verifiedGrowthTaskCount()} / ${this.activeGrowthTasks().length} 已验证`)
            .fontSize(10)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_primary_action'))
        }
        .alignItems(VerticalAlign.Center)
        .width('100%')
        .padding(12)
        .backgroundColor($r('app.color.km_primary_tint'))
        .borderRadius(8)

        Row({ space: 10 }) {
          NativeMetricCard({ label: '当前实证覆盖', value: `${this.empiricalCoverage}%`, detail: '通过审核后更新' })
          NativeMetricCard({ label: '完成后预测', value: `${this.projectedCoverage}%`, detail: '预测不等于掌握' })
        }
        .width('100%')

        if (this.activeGrowthTasks().length > 0) {
          this.buildGrowthPrescription()
        }

        if (this.activeGrowthTasks().length === 0) {
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
            tasks: this.activeGrowthTasks(),
            records: this.activeGrowthEvidenceRecords(),
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
        if (this.activeGrowthHistory().length > 0) {
          Column({ space: 7 }) {
            Text('实证变化记录')
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            ForEach(this.activeGrowthHistory().slice(0, 5), (item: string) => {
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
      .padding({
        left: this.pageHorizontalPadding(),
        right: this.pageHorizontalPadding(),
        top: 14,
        bottom: 24,
      })
      .constraintSize({ maxWidth: this.isCompactLayout() ? '100%' : this.pageMaxWidth() })
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
    .width(this.navigationRailWidth())
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
      .onClick(() => { this.openPrimaryAction(); })
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
    .constraintSize({ maxWidth: this.isExpandedLayout() ? 760 : (this.isCompactLayout() ? '100%' : 680) })
    .padding({
      left: this.pageHorizontalPadding(),
      right: this.pageHorizontalPadding(),
      bottom: this.isCompactLayout() ? 82 : 18,
    })
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
          } else if (!this.isCompactLayout()) {
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
    .onAreaChange((_oldArea: Area, newArea: Area) => {
      const viewportWidth = Number.parseFloat(`${newArea.width}`);
      if (viewportWidth > 0) this.refreshLayoutSizeClassForWidth(viewportWidth);
    })
  }
}
