import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { picker } from '@kit.CoreFileKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { loadCareerFormData, saveCareerFormData, updateAllCareerForms } from '../common/CareerFormStore';
import { NativeAiResult, NativeAiService } from '../common/NativeAiService';
import { NativeCapabilityService } from '../common/NativeCapabilityService';
import { NativeCalendarService } from '../common/NativeCalendarService';
import { NativeEvidenceService } from '../common/NativeEvidenceService';
import { NativeJobFeed, NativeJobService, NativePublicJob } from '../common/NativeJobService';
import { NativeApplicationTracker } from '../components/NativeApplicationTracker';
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
  @Prop accentColor: string = '#246BFE';

  build() {
    Column({ space: 5 }) {
      Row({ space: 6 }) {
        Blank()
          .width(4)
          .height(14)
          .backgroundColor(this.accentColor)
          .borderRadius(2)
        Text(this.label)
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
          .maxLines(1)
      }
      .width('100%')
      Text(this.value)
        .fontSize(22)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
      Text(this.detail)
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .alignItems(HorizontalAlign.Start)
    .layoutWeight(1)
    .height(92)
    .padding(11)
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
  private jobService: NativeJobService = new NativeJobService(this.hostContext);
  private aiService: NativeAiService = new NativeAiService(this.hostContext);
  private evidenceService: NativeEvidenceService = new NativeEvidenceService();
  private calendarService: NativeCalendarService = new NativeCalendarService(this.hostContext);
  @StorageProp('FormRouteRequest') @Watch('onFormRouteRequestChanged') formRouteRequest: string = '';
  @State activeTab: number = 0;
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
  @State modelConsent: boolean = false;
  @State profileMessage: string = '数据默认保存在本机，可随时修改或清除。';
  @State authSignedIn: boolean = false;
  @State authDisplayName: string = '';
  @State nativeMessage: string = '正在检查账号和系统服务状态。';
  @State speechActive: boolean = false;
  @State ocrActive: boolean = false;
  @State showIntro: boolean = true;
  @State introPhase: number = 0;

  aboutToAppear(): void {
    const routedFromForm = this.applyFormRouteRequest();
    void this.loadWorkspace();
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

  private onFormRouteRequestChanged(): void {
    if (this.applyFormRouteRequest()) {
      this.introPhase = 2;
      this.showIntro = false;
    }
  }

  private applyFormRouteRequest(): boolean {
    const page = this.formRouteRequest.split('|')[0];
    if (!page) return false;
    if (page === 'resume') this.activeTab = 1;
    else if (page === 'jobs') this.openJobsTab();
    else if (page === 'interview') this.activeTab = 3;
    else if (page === 'growth') this.activeTab = 4;
    else if (page === 'home') this.activeTab = 0;
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
    const result = this.parseNativeResult(await this.nativeService.getHuaweiAuthState());
    this.authSignedIn = result.signedIn === true;
    this.authDisplayName = result.displayName || '';
    this.nativeMessage = result.message;
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
    const result = this.parseNativeResult(await this.nativeService.speakText(JSON.stringify({
      content: `${this.interviewType}。${this.interviewQuestion || this.fallbackInterviewQuestion(1)}`,
    })));
    this.nativeMessage = result.message;
  }

  private async toggleSpeechInput(): Promise<void> {
    if (!this.speechActive) {
      const result = this.parseNativeResult(await this.nativeService.startSpeechRecognition());
      this.speechActive = result.ok === true;
      this.nativeMessage = result.message;
      return;
    }

    const result = this.parseNativeResult(await this.nativeService.stopSpeechRecognition());
    this.speechActive = false;
    if (result.text && result.text.trim()) {
      this.interviewAnswer = this.interviewAnswer.trim()
        ? `${this.interviewAnswer.trim()}\n${result.text.trim()}`
        : result.text.trim();
    }
    this.nativeMessage = result.message;
  }

  private async recognizeSelectedResumeUri(uri: string): Promise<void> {
    this.profileMessage = '已选择图片，Core Vision 正在本机识别。';
    const result = this.parseNativeResult(await this.nativeService.recognizeResumeImageUri(uri));
    if (result.ok && result.text && result.text.trim()) {
      this.resumeSummary = this.resumeSummary.trim()
        ? `${this.resumeSummary.trim()}\n${result.text.trim()}`
        : result.text.trim();
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

  private async loadWorkspace(): Promise<void> {
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
      await this.syncCareerFormData();
    } catch (error) {
      console.error(`Native workspace restore failed: ${String(error)}`);
    }
  }

  private async saveWorkspace(): Promise<void> {
    try {
      const store = await preferences.getPreferences(this.hostContext, NATIVE_STORE_NAME);
      const snapshot: NativeWorkspaceSnapshot = {
        resumeName: this.resumeName,
        targetJob: this.targetJob,
        trackedJobTitle: this.trackedJobTitle,
        trackedJobCompany: this.trackedJobCompany,
        trackedJobSource: this.trackedJobSource,
        trackedJobDescription: this.trackedJobDescription,
        applicationJobKey: this.applicationJobKey,
        applicationStage: this.applicationStage,
        applicationUpdatedAt: this.applicationUpdatedAt,
        applicationDeadline: this.applicationDeadline,
        nextInterviewAt: this.nextInterviewAt,
        applicationEvents: this.applicationEvents,
        applicationResumeVersionId: this.applicationResumeVersionId,
        resumeSummary: this.resumeSummary,
        resumeVersions: this.resumeVersions,
        interviewType: this.interviewType,
        interviewStarted: this.interviewStarted,
        interviewQuestion: this.interviewQuestion,
        interviewRound: this.interviewRound,
        interviewTurns: this.interviewTurns,
        interviewFeedback: this.interviewFeedback,
        interviewModelName: this.interviewModelName,
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
      await this.syncCareerFormData();
    } catch (error) {
      this.profileMessage = '本机保存失败，请稍后重试。';
      console.error(`Native workspace save failed: ${String(error)}`);
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
    return this.trackedJobs > 0 ? this.currentApplicationAction() : this.nextGrowthAction();
  }

  private primaryActionTab(): number {
    if (this.trackedJobs > 0) {
      if (this.applicationStage === 'preparing' && !this.boundResumeVersion()) return 1;
      return this.applicationStage === 'interview' ? 3 : 2;
    }
    return this.growthTasks.length === 0 ? 3 : 4;
  }

  private primaryActionLabel(): string {
    if (this.trackedJobs > 0) {
      if (this.applicationStage === 'preparing' && !this.boundResumeVersion()) return '保存投递版本';
      if (this.applicationStage === 'interview') return '准备岗位面试';
      return '处理投递事项';
    }
    return this.growthTasks.length === 0 ? '开始岗位面试' : '继续成长任务';
  }

  private pendingActionCount(): number {
    const growthPending = this.growthTasks.filter((task: NativeGrowthTask) => task.status !== 'verified').length;
    if (this.trackedJobs === 0 || this.applicationStage === 'offer' || this.applicationStage === 'closed') {
      return growthPending;
    }
    return growthPending + 1;
  }

  private updateApplicationStage(stageId: string): void {
    if (this.trackedJobs === 0) {
      this.applicationMessage = '请先保存可追溯的真实岗位，再更新投递阶段。';
      return;
    }
    if (stageId === this.applicationStage) {
      this.applicationMessage = `当前已经是“${this.applicationStageLabel(stageId)}”。`;
      return;
    }
    if (this.requiresResumeVersion(stageId) && !this.boundResumeVersion()) {
      this.applicationMessage = `进入“${this.applicationStageLabel(stageId)}”前，请先在简历页保存并绑定实际投递版本。`;
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
    void this.saveWorkspace();
  }

  private saveNativeResumeVersion(): void {
    if (this.trackedJobs === 0 || !this.applicationJobKey) {
      this.resumeVersionMessage = '请先保存可追溯的真实岗位，再创建投递版本。';
      return;
    }
    const content = this.resumeSummary.trim();
    if (content.length < 30) {
      this.resumeVersionMessage = '简历内容至少需要 30 个字，才能保存为实际投递版本。';
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
    void this.saveWorkspace();
  }

  private bindNativeResumeVersion(versionId: string): void {
    let selectedVersion: NativeResumeVersion | undefined = undefined;
    for (const version of this.resumeVersions) {
      if (version.id === versionId && version.jobKey === this.applicationJobKey) selectedVersion = version;
    }
    if (!selectedVersion) {
      this.resumeVersionMessage = '该版本不属于当前追踪岗位，不能绑定。';
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
    void this.saveWorkspace();
  }

  private deleteNativeResumeVersion(versionId: string): void {
    if (versionId === this.applicationResumeVersionId) {
      this.resumeVersionMessage = '当前版本已绑定投递记录，请先绑定其他版本。';
      return;
    }
    const remainingVersions = this.resumeVersions.filter((version: NativeResumeVersion) => version.id !== versionId);
    if (remainingVersions.length === this.resumeVersions.length) return;
    this.resumeVersions = remainingVersions;
    this.resumeVersionMessage = '未绑定的投递版本已从本机删除。';
    void this.saveWorkspace();
  }

  private saveApplicationSchedule(): void {
    if (this.trackedJobs === 0) {
      this.applicationMessage = '请先保存真实岗位，再记录截止时间或面试安排。';
      return;
    }
    this.applicationDeadline = this.applicationDeadline.trim();
    this.nextInterviewAt = this.nextInterviewAt.trim();
    this.applicationUpdatedAt = new Date().toLocaleString('zh-CN');
    this.applicationMessage = this.applicationDeadline || this.nextInterviewAt
      ? '投递日程已保存在本机，并同步下一行动。'
      : '已清空该岗位的投递日程。';
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
    this.publicJobsLoading = true;
    this.publicJobsSearched = true;
    this.selectedPublicJobIndex = -1;
    this.publicJobsMessage = '正在连接官方岗位源，请稍候。';
    const query = this.jobQuery.trim() || this.targetJob.trim();
    const feed: NativeJobFeed = await this.jobService.fetchJobs(query, this.jobCity);
    this.publicJobs = feed.jobs;
    this.publicJobsConfigured = feed.configured;
    this.publicJobsStale = feed.stale;
    this.publicJobsTotal = feed.total;
    this.publicJobsMessage = feed.message;
    this.publicJobsLoading = false;
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
    if (!title || !company) {
      this.jobMessage = '请填写真实岗位名称和公司名称。';
      return;
    }
    if (!source.startsWith('https://') && !source.startsWith('http://')) {
      this.jobMessage = '请填写可追溯的岗位来源链接。';
      return;
    }
    if (description.length < 30) {
      this.jobMessage = '岗位描述至少需要 30 个字，才能建立证据矩阵。';
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
      this.applicationEvents = [
        new NativeApplicationEvent('interested', `已收藏“${title}”并开始本机追踪`, occurredAt),
      ];
      this.applicationResumeVersionId = '';
      this.applicationMessage = '岗位已进入“已收藏”阶段，可继续更新投递进度。';
      this.resumeVersionMessage = '保存并绑定实际投递版本后，才能进入已投递及后续阶段。';
    }
    this.showJobEditor = false;
    this.rebuildEvidenceMatrix();
    this.jobMessage = '真实岗位已保存到本机，并已按简历事实重建证据矩阵。';
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
    this.applicationEvents = [];
    this.applicationResumeVersionId = '';
    this.applicationMessage = '保存真实岗位后即可记录投递进度。';
    this.trackedJobs = 0;
    this.showJobEditor = false;
    this.jobEvidence = createDefaultNativeJobEvidence();
    this.evidenceCoverage = 42;
    this.projectedCoverage = Math.max(this.empiricalCoverage, 63);
    this.jobMessage = '已移除岗位来源，目标岗位画像仍保留在本机。';
    void this.saveWorkspace();
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
    return questions[Math.max(0, round - 1) % questions.length];
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
    this.interviewFeedback = '';
    this.interviewModelName = '本机规则';
    this.interviewMessage = this.modelConsent
      ? `${this.interviewType} 已开始；首题由本机准备，提交后由外部模型生成证据追问。`
      : `本机 ${this.interviewType} 已开始，请结合真实经历回答。`;
    void this.saveWorkspace();
  }

  private async submitInterviewAnswer(): Promise<void> {
    if (this.interviewLoading) return;
    const answer = this.interviewAnswer.trim();
    if (answer.length < 20) {
      this.interviewMessage = '回答还不够具体，请至少说明个人行动和结果。';
      return;
    }
    const occurredAt = new Date().toLocaleString('zh-CN');
    const nextTurns = [...this.interviewTurns, new NativeInterviewTurn(this.interviewQuestion, answer, occurredAt)];
    this.interviewTurns = nextTurns;
    this.interviewAnswer = '';
    if (nextTurns.length >= 3) {
      this.interviewMessage = '已完成 3 轮回答，可以生成本轮反馈。';
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
      return;
    }

    this.interviewLoading = true;
    this.interviewMessage = '已脱敏本轮内容，正在生成岗位化追问。';
    const result: NativeAiResult = await this.aiService.generateInterviewQuestion(
      this.interviewType,
      nextRound,
      this.resumeSummary,
      this.trackedJobTitle || this.targetJob,
      this.trackedJobDescription,
      nextTurns,
    );
    this.interviewLoading = false;
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
    void this.saveWorkspace();
  }

  private async finishInterview(): Promise<void> {
    if (this.interviewLoading) return;
    let turns = this.interviewTurns;
    const answer = this.interviewAnswer.trim();
    if (answer.length > 0 && answer.length < 20) {
      this.interviewMessage = '当前回答还不够具体，请补充个人行动和结果后再生成反馈。';
      return;
    }
    if (answer.length >= 20) {
      turns = [...turns, new NativeInterviewTurn(this.interviewQuestion, answer, new Date().toLocaleString('zh-CN'))];
      this.interviewTurns = turns;
      this.interviewAnswer = '';
    }
    if (turns.length === 0) {
      this.interviewMessage = '请至少提交一轮真实回答后再生成反馈。';
      return;
    }

    this.interviewLoading = true;
    let feedback = '';
    if (this.modelConsent) {
      this.interviewMessage = '正在对已脱敏的面试记录生成岗位化反馈。';
      const result: NativeAiResult = await this.aiService.generateInterviewFeedback(
        this.interviewType,
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
    } else {
      feedback = this.localInterviewFeedback(turns);
      this.interviewModelName = '本机规则';
      this.interviewMessage = '外部模型未授权，已完成本机结构化反馈。';
    }
    this.interviewLoading = false;
    this.interviewFeedback = feedback;
    if (this.growthTasks.length === 0) {
      this.createGrowthPlan(feedback);
    } else {
      this.growthHistory = [`已完成 ${this.interviewType} 复测，反馈来源：${this.interviewModelName}`, ...this.growthHistory];
      void this.saveWorkspace();
    }
  }

  private resetInterview(): void {
    this.interviewStarted = false;
    this.interviewQuestion = '';
    this.interviewRound = 0;
    this.interviewTurns = [];
    this.interviewAnswer = '';
    this.interviewFeedback = '';
    this.interviewModelName = '本机规则';
    this.interviewMessage = '已清空本轮面试记录，可以重新选择面试类型。';
    void this.saveWorkspace();
  }

  private async submitGrowthEvidence(): Promise<void> {
    if (this.evidenceChecking) return;
    const text = this.evidenceDraft.trim();
    const sourceUrl = this.evidenceSourceUrl.trim();
    const hasAction = /负责|设计|实现|分析|验证|修复|构建|复盘|提交|完成|测试/.test(text);
    const hasOutcome = /\d|%|提升|降低|增长|覆盖|产出|上线|发布|用户|样本/.test(text);
    if (text.length < 30 || !hasAction || !hasOutcome) {
      this.growthMessage = '证据需要更具体：请补充个人动作、产出物和结果数据。';
      return;
    }
    if (!/^https:\/\/[^\s]+$/i.test(sourceUrl)) {
      this.growthMessage = '请补充可核验的 HTTPS 代码仓库、报告或演示链接。';
      return;
    }
    if (!this.evidenceConfirmed) {
      this.growthMessage = '请先确认内容真实且来源可供核验。';
      return;
    }
    this.evidenceChecking = true;
    this.growthMessage = '正在使用 Network Kit 核验公开 HTTPS 来源。';
    const sourceResult = await this.evidenceService.verifyPublicHttps(sourceUrl);
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

  private verifiedGrowthGain(): number {
    return this.growthGainForTasks(this.growthTasks);
  }

  private growthGainForTasks(tasks: NativeGrowthTask[]): number {
    let gain = 0;
    for (const task of tasks) {
      if (task.status === 'verified') gain += task.projectedGain;
    }
    return gain;
  }

  private messageState(message: string): number {
    if (message.includes('正在') || message.includes('请稍候')) return 1;
    if (message.includes('失败') || message.includes('无法') || message.includes('不可用') ||
      message.includes('请填写') || message.includes('请补充') || message.includes('请至少') ||
      message.includes('不够具体') || message.includes('不在当前') || message.includes('没有可打开') ||
      message.includes('未提供足够')) return 3;
    if (message.includes('已保存') || message.includes('已完成') || message.includes('已生成') ||
      message.includes('已恢复') || message.includes('已打开') || message.includes('已交由') ||
      message.includes('已回填') || message.includes('已写入') || message.includes('通过')) return 2;
    return 0;
  }

  private messageColor(message: string): string {
    const state = this.messageState(message);
    if (state === 2) return '#047857';
    if (state === 3) return '#B45309';
    if (state === 1) return '#1D4ED8';
    return '#475569';
  }

  private messageBackground(message: string): string {
    const state = this.messageState(message);
    if (state === 2) return '#ECFDF5';
    if (state === 3) return '#FFF7E6';
    if (state === 1) return '#EFF6FF';
    return '#F8FAFC';
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
  private buildStatusMessage(message: string): void {
    if (message) {
      Row({ space: 8 }) {
        if (this.messageState(message) === 1) {
          LoadingProgress()
            .width(16)
            .height(16)
            .color(this.messageColor(message))
        } else if (this.messageState(message) === 2) {
          SymbolGlyph($r('sys.symbol.checkmark_circle'))
            .fontSize(16)
            .fontColor([this.messageColor(message)])
        } else if (this.messageState(message) === 3) {
          SymbolGlyph($r('sys.symbol.exclamationmark_triangle'))
            .fontSize(16)
            .fontColor([this.messageColor(message)])
        } else {
          SymbolGlyph($r('sys.symbol.info_circle'))
            .fontSize(16)
            .fontColor([this.messageColor(message)])
        }
        Text(message)
          .fontSize(10)
          .fontColor(this.messageColor(message))
          .lineHeight(17)
          .layoutWeight(1)
      }
      .alignItems(VerticalAlign.Top)
      .width('100%')
      .padding(10)
      .backgroundColor(this.messageBackground(message))
      .border({ width: 1, color: this.messageState(message) === 0 ? '#E2E8F0' : this.messageBackground(message) })
      .borderRadius(8)
    }
  }

  @Builder
  private buildHeader(): void {
    Column() {
      Row() {
        Row({ space: 9 }) {
          Image($r('app.media.startIconNative'))
            .width(34)
            .height(34)
            .objectFit(ImageFit.Contain)
          Column({ space: 1 }) {
            Text('孔明职配')
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text('学生求职证据工作台')
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
          }
          .alignItems(HorizontalAlign.Start)
        }
        Blank()
        Text(this.authSignedIn ? this.authDisplayName : '本机数据')
          .fontSize(10)
          .fontColor(this.authSignedIn ? $r('app.color.km_teal') : $r('app.color.km_text_secondary'))
          .padding({ left: 9, right: 9, top: 5, bottom: 5 })
          .backgroundColor(this.authSignedIn ? $r('app.color.km_teal_soft') : $r('app.color.km_surface_subtle'))
          .borderRadius(8)
      }
      .width('100%')
      .height(58)
      .padding({ left: 16, right: 16 })
      Divider()
        .color($r('app.color.km_border'))
        .strokeWidth(1)
    }
    .width('100%')
    .backgroundColor($r('app.color.km_surface'))
  }

  private openJobsTab(): void {
    this.selectedPublicJobIndex = -1;
    this.activeTab = 2;
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
          Blank().width(44).height(1).backgroundColor('#93C5FD')
          Circle().width(8).height(8).fill('#22D3EE')
          Blank().width(44).height(1).backgroundColor('#93C5FD')
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
  private buildJourneyStep(title: string, detail: string, completed: boolean, targetTab: number): void {
    Column({ space: 6 }) {
      Circle()
        .width(10)
        .height(10)
        .fill(completed ? $r('app.color.km_teal') : '#CBD5E1')
      Text(title)
        .fontSize(11)
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
    .layoutWeight(1)
    .height(68)
    .backgroundColor(completed ? $r('app.color.km_teal_soft') : $r('app.color.km_surface'))
    .border({ width: 1, color: completed ? '#B7E4DA' : $r('app.color.km_border') })
    .borderRadius(8)
    .onClick(() => { this.activeTab = targetTab; })
  }

  @Builder
  private buildJourney(): void {
    Column({ space: 10 }) {
      Row() {
        Text('求职主线')
          .fontSize(16)
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
    .padding({ top: 4, bottom: 4 })
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
            .fontColor($r('app.color.km_primary_dark'))
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
          .fontColor('#334155')
        Blank()
        Text(this.trackedJobs > 0 ? `已追踪 ${this.trackedJobs} 个真实岗位` : '尚未导入真实岗位')
          .fontSize(10)
          .fontColor(this.trackedJobs > 0 ? '#047857' : '#B45309')
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
        .height(40)
        .fontSize(12)
        .fontColor('#FFFFFF')
        .backgroundColor($r('app.color.km_primary'))
        .borderRadius(8)
        .onClick(() => { this.openJobsTab(); })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(15)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
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
          .fontColor('#475569')
          .lineHeight(18)
          .maxLines(3)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Button('去处理')
        .height(34)
        .fontSize(11)
        .fontColor('#0B63CE')
        .backgroundColor($r('app.color.km_surface'))
        .borderRadius(8)
        .onClick(() => { this.activeTab = this.guidanceTab(); })
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .padding(14)
    .backgroundColor($r('app.color.km_primary_soft'))
    .borderRadius(8)
  }

  @Builder
  private buildTodayAction(): void {
    Column({ space: 10 }) {
      Row() {
        Text('今日重点')
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor('#DCE8FF')
        Blank()
        Text(`${this.pendingActionCount()} 项待处理`)
          .fontSize(10)
          .fontColor('#DCE8FF')
      }
      .width('100%')
      Text(this.primaryNextAction())
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor('#FFFFFF')
        .lineHeight(25)
        .maxLines(3)
        .width('100%')
      Row({ space: 8 }) {
        Text(this.trackedJobs > 0 ? this.trackedJobTitle : this.targetJob)
          .fontSize(10)
          .fontColor('#DCE8FF')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        Button() {
          Row({ space: 4 }) {
            Text(this.primaryActionLabel())
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_primary_dark'))
            SymbolGlyph($r('sys.symbol.chevron_right'))
              .fontSize(14)
              .fontColor([$r('app.color.km_primary_dark')])
          }
        }
        .height(34)
        .padding({ left: 12, right: 10 })
        .backgroundColor('#FFFFFF')
        .borderRadius(8)
        .onClick(() => { this.activeTab = this.primaryActionTab(); })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.km_primary_dark'))
    .borderRadius(8)
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
          .height(36)
          .fontSize(12)
          .fontColor(this.authSignedIn ? '#B91C1C' : '#1D4ED8')
          .backgroundColor(this.authSignedIn ? '#FEE2E2' : '#DBEAFE')
          .borderRadius(12)
          .onClick(() => {
            void (this.authSignedIn ? this.logoutHuawei() : this.loginHuawei());
          })
      }
      .width('100%')
      Text('求职资料默认保存在本机。登录账号、分享进展或使用语音时，会先由你主动触发。')
        .fontSize(12)
        .fontColor('#334155')
        .lineHeight(19)
        .width('100%')
      Row({ space: 8 }) {
        Button('分享求职进展')
          .layoutWeight(1)
          .height(40)
          .fontSize(12)
          .fontColor('#047857')
          .backgroundColor('#D1FAE5')
          .borderRadius(12)
          .onClick(() => { void this.shareProgress(); })
        Button('打开面试语音')
          .layoutWeight(1)
          .height(40)
          .fontSize(12)
          .fontColor('#7C3AED')
          .backgroundColor('#EDE9FE')
          .borderRadius(12)
          .onClick(() => { this.activeTab = 3; })
      }
      .width('100%')
      this.buildStatusMessage(this.nativeMessage)
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
        Column({ space: 5 }) {
          Text(this.resumeName ? `你好，${this.resumeName}` : '从证据开始，建立你的求职优势')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .width('100%')
          Text(`目标岗位：${this.targetJob}`)
            .fontSize(12)
            .fontColor($r('app.color.km_text_secondary'))
            .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')

        this.buildTodayAction()

        Row({ space: 8 }) {
          NativeMetricCard({
            label: '实证覆盖',
            value: `${this.empiricalCoverage}%`,
            detail: '审核通过后更新',
            accentColor: '#0F766E',
          })
          NativeMetricCard({
            label: '成长预测',
            value: `${this.projectedCoverage}%`,
            detail: '完成任务后的预测',
            accentColor: '#246BFE',
          })
          NativeMetricCard({
            label: '待办任务',
            value: `${this.growthTasks.filter((task: NativeGrowthTask) => task.status !== 'verified').length}`,
            detail: '按优先级推进',
            accentColor: '#B45309',
          })
        }
        .width('100%')

        this.buildTargetJobSnapshot()
        this.buildJourney()

        Row({ space: 8 }) {
          Button('更新简历画像')
            .layoutWeight(1)
            .height(40)
            .fontColor('#1D4ED8')
            .backgroundColor($r('app.color.km_primary_soft'))
            .borderRadius(8)
            .onClick(() => { this.activeTab = 1; })
          Button('查看岗位证据')
            .layoutWeight(1)
            .height(40)
            .fontColor('#047857')
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
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildResume(): void {
    Scroll() {
      Column({ space: 14 }) {
        Column({ space: 8 }) {
          Text('简历与画像')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text('录入真实经历并维护目标岗位，后续匹配只引用你确认过的内容。')
            .fontSize(12)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(20)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')

        Column({ space: 6 }) {
          this.buildFieldLabel('姓名', '选填')
          TextInput({ placeholder: '填写你的姓名', text: this.resumeName })
            .height(48)
            .backgroundColor($r('app.color.km_surface'))
            .border({ width: 1, color: $r('app.color.km_border') })
            .borderRadius(8)
            .onChange((value: string) => { this.resumeName = value; })
        }
        .width('100%')
        Column({ space: 6 }) {
          this.buildFieldLabel('目标岗位', '用于匹配')
          TextInput({ placeholder: '例如：前端开发实习生', text: this.targetJob })
            .height(48)
            .backgroundColor($r('app.color.km_surface'))
            .border({ width: 1, color: $r('app.color.km_border') })
            .borderRadius(8)
            .onChange((value: string) => { this.targetJob = value; })
        }
        .width('100%')
        Column({ space: 6 }) {
          this.buildFieldLabel('真实经历', '只写可核验内容')
          TextArea({ placeholder: '粘贴真实项目、实习或校园经历，不要填写无法核验的数字。', text: this.resumeSummary })
            .height(150)
            .backgroundColor($r('app.color.km_surface'))
            .border({ width: 1, color: $r('app.color.km_border') })
            .borderRadius(8)
            .onChange((value: string) => { this.resumeSummary = value; })
        }
        .width('100%')
        Row({ space: 8 }) {
          Button(this.ocrActive ? '本机 OCR 识别中…' : '从图库导入')
            .layoutWeight(1)
            .height(42)
            .fontSize(12)
            .fontColor('#1D4ED8')
            .backgroundColor('#DBEAFE')
            .borderRadius(8)
            .enabled(!this.ocrActive)
            .onClick(() => { void this.importResumeImage(); })
          Button(this.ocrActive ? '请稍候' : '从文件导入')
            .layoutWeight(1)
            .height(42)
            .fontSize(12)
            .fontColor('#0F766E')
            .backgroundColor('#CCFBF1')
            .borderRadius(8)
            .enabled(!this.ocrActive)
            .onClick(() => { void this.importResumeFile(); })
        }
        .width('100%')
        Text('图片只在本机读取，识别后仍需你确认。')
          .width('100%')
          .fontSize(11)
          .fontColor('#64748B')
          .lineHeight(17)
        Button('保存本机简历画像')
          .width('100%')
          .height(46)
          .fontColor('#FFFFFF')
          .backgroundColor('#2563EB')
          .borderRadius(8)
          .onClick(() => {
            this.rebuildEvidenceMatrix();
            this.profileMessage = '简历画像已保存到本机。';
            void this.saveWorkspace();
          })
        this.buildStatusMessage(this.profileMessage)
        NativeResumeVersionPanel({
          versions: this.resumeVersions,
          currentJobKey: this.applicationJobKey,
          currentJobTitle: this.trackedJobTitle,
          boundVersionId: this.applicationResumeVersionId,
          message: this.resumeVersionMessage,
          onCreateVersion: () => { this.saveNativeResumeVersion(); },
          onBindVersion: (versionId: string) => { this.bindNativeResumeVersion(versionId); },
          onDeleteVersion: (versionId: string) => { this.deleteNativeResumeVersion(versionId); },
        })
        Column({ space: 8 }) {
          Text('隐私与识别')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text('导入的图片先在本机读取；识别结果、岗位信息和模型输出都需要你确认后才会进入求职资料。')
            .fontSize(12)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(19)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(8)
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 24 })
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
            .fontColor('#0F172A')
          Text('只展示带有可追溯来源链接的岗位')
            .fontSize(11)
            .fontColor('#64748B')
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(this.publicJobsConfigured ? '服务已配置' : '支持离线降级')
          .fontSize(10)
          .fontColor(this.publicJobsConfigured ? '#047857' : '#B45309')
          .padding({ left: 8, right: 8, top: 5, bottom: 5 })
          .backgroundColor(this.publicJobsConfigured ? '#D1FAE5' : '#FEF3C7')
          .borderRadius(11)
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位关键词', `默认：${this.targetJob}`)
        TextInput({ placeholder: '输入岗位名称或技能关键词', text: this.jobQuery })
          .height(44)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.jobQuery = value; })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('城市', '选填')
        TextInput({ placeholder: '例如：上海', text: this.jobCity })
          .height(44)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.jobCity = value; })
      }
      .width('100%')
      Button(this.publicJobsLoading ? '正在读取官方岗位…' : '搜索官方岗位')
        .width('100%')
        .height(42)
        .fontSize(12)
        .fontColor('#FFFFFF')
        .backgroundColor(this.publicJobsLoading ? '#94A3B8' : '#2563EB')
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
      this.buildStatusMessage(this.publicJobsMessage)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .border({ width: 1, color: '#E2E8F0' })
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
            .fontColor('#0F172A')
            .maxLines(2)
          Text(job.company)
            .fontSize(12)
            .fontColor('#475569')
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(this.verificationLabel(job.verification))
          .fontSize(9)
          .fontColor('#047857')
          .padding({ left: 7, right: 7, top: 4, bottom: 4 })
          .backgroundColor('#D1FAE5')
          .borderRadius(9)
      }
      .width('100%')
      Row({ space: 8 }) {
        Text(job.city)
          .fontSize(10)
          .fontColor('#2563EB')
        Text(job.level)
          .fontSize(10)
          .fontColor('#7C3AED')
        Text(job.sourceName)
          .fontSize(10)
          .fontColor('#64748B')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      Text(job.summary)
        .fontSize(11)
        .fontColor('#64748B')
        .lineHeight(18)
        .maxLines(3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Row({ space: 8 }) {
        Button('查看详情')
          .layoutWeight(1)
          .height(38)
          .fontSize(11)
          .fontColor('#1D4ED8')
          .backgroundColor('#DBEAFE')
          .borderRadius(12)
          .onClick(() => { this.showPublicJob(job.id); })
        Button('保存追踪')
          .layoutWeight(1)
          .height(38)
          .fontSize(11)
          .fontColor('#FFFFFF')
          .backgroundColor('#2563EB')
          .borderRadius(12)
          .onClick(() => { this.trackPublicJob(job); })
      }
      .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .border({ width: 1, color: '#E2E8F0' })
    .borderRadius(8)
  }

  @Builder
  private buildPublicJobDetail(job: NativePublicJob): void {
    Scroll() {
      Column({ space: 12 }) {
        Button('返回岗位列表')
          .height(38)
          .fontSize(11)
          .fontColor('#1D4ED8')
          .backgroundColor('#DBEAFE')
          .borderRadius(12)
          .alignSelf(ItemAlign.Start)
          .onClick(() => { this.selectedPublicJobIndex = -1; })
        Column({ space: 10 }) {
          Row() {
            Text(this.verificationLabel(job.verification))
              .fontSize(10)
              .fontColor('#047857')
              .padding({ left: 8, right: 8, top: 5, bottom: 5 })
              .backgroundColor('#D1FAE5')
              .borderRadius(10)
            Blank()
            Text(job.level)
              .fontSize(11)
              .fontColor('#7C3AED')
          }
          .width('100%')
          Text(job.title)
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
            .width('100%')
          Text(`${job.company} · ${job.city}`)
            .fontSize(13)
            .fontColor('#475569')
            .width('100%')
          Text(job.summary)
            .fontSize(12)
            .fontColor('#334155')
            .lineHeight(20)
            .maxLines(6)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(18)
        .backgroundColor('#FFFFFF')
        .border({ width: 1, color: '#E2E8F0' })
        .borderRadius(8)

        Row({ space: 8 }) {
          Button('保存为追踪岗位')
            .layoutWeight(1)
            .height(44)
            .fontSize(11)
            .fontColor('#1D4ED8')
            .backgroundColor('#DBEAFE')
            .borderRadius(8)
            .onClick(() => { this.trackPublicJob(job); })
          Button('打开官方投递')
            .layoutWeight(1)
            .height(44)
            .fontSize(11)
            .fontColor('#FFFFFF')
            .backgroundColor('#2563EB')
            .borderRadius(8)
            .onClick(() => { void this.openPublicJob(job); })
        }
        .width('100%')
        this.buildStatusMessage(this.publicJobsMessage)

        Column({ space: 8 }) {
          Text('岗位职责与要求')
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
          Text(job.description)
            .fontSize(12)
            .fontColor('#475569')
            .lineHeight(21)
            .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor('#FFFFFF')
        .border({ width: 1, color: '#E2E8F0' })
        .borderRadius(8)

        Column({ space: 7 }) {
          Text('来源核验')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
          Text(`来源：${job.sourceName}`)
            .fontSize(11)
            .fontColor('#475569')
          if (job.publishedAt) {
            Text(`发布时间：${job.publishedAt}`)
              .fontSize(11)
              .fontColor('#64748B')
          }
          Text(job.sourceUrl)
            .fontSize(10)
            .fontColor('#2563EB')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor('#EFF6FF')
        .borderRadius(8)
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 24 })
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
          .fontColor('#0F172A')
        Blank()
        Text('仅保存在本机')
          .fontSize(10)
          .fontColor('#047857')
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor('#D1FAE5')
          .borderRadius(10)
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位名称', '必填')
        TextInput({ placeholder: '填写招聘页面中的岗位名称', text: this.trackedJobTitle })
          .height(44)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.trackedJobTitle = value; })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('公司名称', '必填')
        TextInput({ placeholder: '填写招聘主体或公司名称', text: this.trackedJobCompany })
          .height(44)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.trackedJobCompany = value; })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位来源', '必填')
        TextInput({ placeholder: '粘贴 http/https 招聘页面链接', text: this.trackedJobSource })
          .height(44)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.trackedJobSource = value; })
      }
      .width('100%')
      Column({ space: 6 }) {
        this.buildFieldLabel('岗位描述', '至少 30 字')
        TextArea({ placeholder: '粘贴真实 JD，用于识别技能、学历和成果要求。', text: this.trackedJobDescription })
          .height(128)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
          .onChange((value: string) => { this.trackedJobDescription = value; })
      }
      .width('100%')
      Row({ space: 8 }) {
        Button('保存并重建证据')
          .layoutWeight(1)
          .height(42)
          .fontSize(12)
          .fontColor('#FFFFFF')
          .backgroundColor('#2563EB')
          .borderRadius(8)
          .onClick(() => { this.saveTrackedJob(); })
        if (this.trackedJobs > 0) {
          Button('取消')
            .height(42)
            .fontSize(12)
            .fontColor('#475569')
            .backgroundColor('#E2E8F0')
            .borderRadius(8)
            .onClick(() => { this.showJobEditor = false; })
        }
      }
      .width('100%')
      this.buildStatusMessage(this.jobMessage)
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .border({ width: 1, color: '#E2E8F0' })
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
              .fontColor('#0F172A')
              .maxLines(2)
            Text(this.trackedJobCompany)
              .fontSize(12)
              .fontColor('#475569')
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text('本机追踪')
            .fontSize(10)
            .fontColor('#047857')
            .padding({ left: 8, right: 8, top: 5, bottom: 5 })
            .backgroundColor('#D1FAE5')
            .borderRadius(11)
        }
        .width('100%')
        Text(this.trackedJobSource)
          .fontSize(10)
          .fontColor('#2563EB')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        Text(this.trackedJobDescription)
          .fontSize(11)
          .fontColor('#64748B')
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
          currentAction: this.currentApplicationAction(),
          boundVersionName: this.boundResumeVersionName(),
          onStageChange: (stageId: string) => { this.updateApplicationStage(stageId); },
          onDeadlineChange: (value: string) => { this.applicationDeadline = value; },
          onInterviewChange: (value: string) => { this.nextInterviewAt = value; },
          onSaveSchedule: () => { this.saveApplicationSchedule(); },
          onCreateDeadlineReminder: () => { void this.openApplicationReminder('deadline'); },
          onCreateInterviewReminder: () => { void this.openApplicationReminder('interview'); },
        })
        Row({ space: 8 }) {
          Button('编辑岗位')
            .layoutWeight(1)
            .height(38)
            .fontSize(11)
            .fontColor('#1D4ED8')
            .backgroundColor('#DBEAFE')
            .borderRadius(12)
            .onClick(() => { this.showJobEditor = true; })
          Button('移除岗位')
            .layoutWeight(1)
            .height(38)
            .fontSize(11)
            .fontColor('#B91C1C')
            .backgroundColor('#FEE2E2')
            .borderRadius(12)
            .onClick(() => { this.removeTrackedJob(); })
        }
        .width('100%')
        this.buildStatusMessage(this.jobMessage)
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(16)
      .backgroundColor('#FFFFFF')
      .border({ width: 1, color: '#E2E8F0' })
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
          Column({ space: 6 }) {
            Text('岗位中心')
              .fontSize(20)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Text(`围绕“${this.targetJob}”发现真实岗位，并核对要求与个人证据。`)
              .fontSize(12)
              .fontColor($r('app.color.km_text_secondary'))
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')

          this.buildPublicJobSearch()

          if (this.publicJobs.length > 0) {
            Row() {
              Text('官方岗位结果')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .fontColor('#0F172A')
              Blank()
              Text(`${this.publicJobs.length}/${this.publicJobsTotal}`)
                .fontSize(11)
                .fontColor('#64748B')
            }
            .width('100%')
            ForEach(this.publicJobs, (job: NativePublicJob) => {
              this.buildPublicJobCard(job);
            }, (job: NativePublicJob) => job.id)
          } else if (this.publicJobsSearched && !this.publicJobsLoading) {
            Column({ space: 7 }) {
              SymbolGlyph($r('sys.symbol.magnifyingglass'))
                .fontSize(24)
                .fontColor([$r('app.color.km_text_tertiary')])
              Text('没有找到符合条件的官方岗位')
                .fontSize(14)
                .fontWeight(FontWeight.Medium)
                .fontColor($r('app.color.km_text_primary'))
              Text('可以调整关键词或城市后重试，也可以继续在下方录入真实岗位。')
                .fontSize(10)
                .fontColor($r('app.color.km_text_secondary'))
                .lineHeight(17)
                .textAlign(TextAlign.Center)
            }
            .alignItems(HorizontalAlign.Center)
            .width('100%')
            .padding(18)
            .backgroundColor($r('app.color.km_surface'))
            .border({ width: 1, color: $r('app.color.km_border') })
            .borderRadius(8)
          }

          Text('本机岗位与证据')
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
            .width('100%')

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
            .height(46)
            .fontColor('#FFFFFF')
            .backgroundColor('#2563EB')
            .borderRadius(8)
            .onClick(() => { this.activeTab = 3; })
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 14, bottom: 24 })
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
          .fontColor('#0F172A')
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
        .fontColor('#64748B')
        .lineHeight(19)
        .width('100%')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .border({ width: 1, color: '#E2E8F0' })
    .borderRadius(8)
  }

  @Builder
  private buildInterview(): void {
    Scroll() {
      Column({ space: 14 }) {
        Column({ space: 8 }) {
          Text('模拟面试')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text('围绕目标岗位完成三轮回答，复盘证据表达、职责边界和结果说明。')
            .fontSize(12)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(20)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        Row({ space: 8 }) {
          Button('综合面').layoutWeight(1).height(40).backgroundColor(this.interviewType === '综合面' ? '#2563EB' : '#E2E8F0').fontColor(this.interviewType === '综合面' ? '#FFFFFF' : '#334155').borderRadius(8).onClick(() => { this.interviewType = '综合面'; })
          Button('技术面').layoutWeight(1).height(40).backgroundColor(this.interviewType === '技术面' ? '#2563EB' : '#E2E8F0').fontColor(this.interviewType === '技术面' ? '#FFFFFF' : '#334155').borderRadius(8).onClick(() => { this.interviewType = '技术面'; })
          Button('HR 面').layoutWeight(1).height(40).backgroundColor(this.interviewType === 'HR面' ? '#2563EB' : '#E2E8F0').fontColor(this.interviewType === 'HR面' ? '#FFFFFF' : '#334155').borderRadius(8).onClick(() => { this.interviewType = 'HR面'; })
        }
        .width('100%')

        Row({ space: 12 }) {
          Checkbox({ name: 'native-model-consent', group: 'interview-privacy' })
            .select(this.modelConsent)
            .selectedColor('#2563EB')
            .onChange((value: boolean) => { this.updateModelConsent(value); })
          Column({ space: 3 }) {
            Text('本次训练使用智能增强')
              .fontSize(14)
              .fontWeight(FontWeight.Bold)
              .fontColor('#0F172A')
            Text('发送前隐藏手机号、邮箱、身份证号和详细地址；模型密钥仅保存在服务端。')
              .fontSize(11)
              .fontColor('#64748B')
              .lineHeight(18)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .alignItems(VerticalAlign.Top)
        .width('100%')
        .padding(14)
        .backgroundColor(this.modelConsent ? '#EFF6FF' : '#F8FAFC')
        .borderRadius(8)

        if (!this.interviewStarted) {
          Column({ space: 12 }) {
            Text('围绕真实项目回答，不自动编造经历。')
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor('#0F172A')
            Text(this.modelConsent
              ? '首题由本机准备；提交回答后，模型只基于已脱敏内容生成下一轮证据追问。'
              : '当前使用本机规则生成问题和反馈，不会发送简历或回答。')
              .fontSize(13)
              .fontColor('#64748B')
              .lineHeight(21)
            Button(this.modelConsent ? '开始 AI 增强面试' : '开始本机面试')
              .width('100%')
              .height(46)
              .fontColor('#FFFFFF')
              .backgroundColor('#2563EB')
              .borderRadius(8)
              .onClick(() => { this.startInterview(); })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(18)
          .backgroundColor('#FFFFFF')
          .border({ width: 1, color: '#E2E8F0' })
          .borderRadius(8)
        } else {
          Column({ space: 10 }) {
            Row() {
              Text(`${this.interviewType} · 第 ${Math.max(1, this.interviewRound)} 轮 / 3`)
                .fontSize(12)
                .fontColor('#2563EB')
              Blank()
              Text(this.interviewModelName)
                .fontSize(10)
                .fontColor(this.interviewModelName === '本机规则' ? '#475569' : '#047857')
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .backgroundColor(this.interviewModelName === '本机规则' ? '#E2E8F0' : '#D1FAE5')
                .borderRadius(10)
            }
            .width('100%')
            Text(this.interviewQuestion || this.fallbackInterviewQuestion(1))
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor('#0F172A')
              .lineHeight(25)
            if (this.interviewTurns.length > 0) {
              Text(`已在本机保留 ${this.interviewTurns.length} 轮回答`)
                .fontSize(11)
                .fontColor('#64748B')
            }
            this.buildFieldLabel('本轮回答', '仅保存在本机')
            TextArea({ placeholder: '输入真实回答，不要填写无法核验的成果。', text: this.interviewAnswer })
              .height(180)
              .backgroundColor('#F8FAFC')
              .border({ width: 1, color: '#E2E8F0' })
              .borderRadius(8)
              .enabled(!this.interviewLoading && this.interviewTurns.length < 3)
              .onChange((value: string) => { this.interviewAnswer = value; })
            Row({ space: 8 }) {
              Button('朗读问题')
                .layoutWeight(1)
                .height(40)
                .fontSize(12)
                .fontColor('#7C3AED')
                .backgroundColor('#EDE9FE')
                .borderRadius(8)
                .enabled(!this.interviewLoading)
                .onClick(() => { void this.speakInterviewPrompt(); })
              Button(this.speechActive ? '停止并填入语音' : '语音回答')
                .layoutWeight(1)
                .height(40)
                .fontSize(12)
                .fontColor(this.speechActive ? '#FFFFFF' : '#1D4ED8')
                .backgroundColor(this.speechActive ? '#DC2626' : '#DBEAFE')
                .borderRadius(8)
                .enabled(!this.interviewLoading && this.interviewTurns.length < 3)
                .onClick(() => { void this.toggleSpeechInput(); })
            }
            .width('100%')
            if (this.interviewTurns.length < 3) {
              Button(this.interviewLoading ? '正在生成岗位化追问…' : '提交回答并生成追问')
                .width('100%')
                .height(46)
                .fontColor('#1D4ED8')
                .backgroundColor('#DBEAFE')
                .borderRadius(8)
                .enabled(!this.interviewLoading)
                .onClick(() => { void this.submitInterviewAnswer(); })
            }
            Button(this.interviewLoading ? '正在生成反馈…' : '完成面试并生成反馈')
              .width('100%')
              .height(46)
              .fontColor('#FFFFFF')
              .backgroundColor('#2563EB')
              .borderRadius(8)
              .enabled(!this.interviewLoading)
              .onClick(() => { void this.finishInterview(); })
            this.buildStatusMessage(this.interviewMessage)
            if (this.interviewFeedback) {
              Divider().color('#CBD5E1')
              Text('本轮反馈')
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor('#0F172A')
              Text(this.interviewFeedback)
                .fontSize(12)
                .fontColor('#475569')
                .lineHeight(21)
                .width('100%')
              Row({ space: 8 }) {
                Button('查看成长任务')
                  .layoutWeight(1)
                  .height(40)
                  .fontSize(12)
                  .fontColor('#047857')
                  .backgroundColor('#D1FAE5')
                  .borderRadius(8)
                  .onClick(() => { this.activeTab = 4; })
                Button('重新开始')
                  .layoutWeight(1)
                  .height(40)
                  .fontSize(12)
                  .fontColor('#475569')
                  .backgroundColor('#E2E8F0')
                  .borderRadius(8)
                  .onClick(() => { this.resetInterview(); })
              }
              .width('100%')
            }
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(18)
          .backgroundColor('#FFFFFF')
          .border({ width: 1, color: '#E2E8F0' })
          .borderRadius(8)
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 24 })
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildGrowth(): void {
    Scroll() {
      Column({ space: 12 }) {
        Column({ space: 6 }) {
          Text('成长计划')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(`围绕“${this.targetJob}”把岗位缺口拆成可执行、可提交、可复盘的任务。`)
            .fontSize(12)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')

        Row({ space: 10 }) {
          NativeMetricCard({ label: '当前实证覆盖', value: `${this.empiricalCoverage}%`, detail: '通过审核后更新' })
          NativeMetricCard({ label: '完成后预测', value: `${this.projectedCoverage}%`, detail: '预测不等于掌握' })
        }
        .width('100%')

        if (this.growthTasks.length === 0) {
          Column({ space: 10 }) {
            Text('还没有成长计划')
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor('#0F172A')
            Text('先完成一次岗位面试，系统会根据岗位证据和回答表现生成任务。')
              .fontSize(13)
              .fontColor('#64748B')
              .lineHeight(20)
            Button('开始岗位面试')
              .width('100%')
              .height(44)
              .fontColor('#FFFFFF')
              .backgroundColor('#2563EB')
              .borderRadius(8)
              .onClick(() => { this.activeTab = 3; })
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(18)
          .backgroundColor('#FFFFFF')
          .border({ width: 1, color: '#E2E8F0' })
          .borderRadius(8)
        } else {
          NativeEvidenceLedger({
            tasks: this.growthTasks,
            records: this.growthEvidenceRecords,
            evidenceDraft: this.evidenceDraft,
            evidenceSourceUrl: this.evidenceSourceUrl,
            evidenceConfirmed: this.evidenceConfirmed,
            evidenceChecking: this.evidenceChecking,
            onDraftChange: (value: string) => { this.evidenceDraft = value; },
            onSourceChange: (value: string) => { this.evidenceSourceUrl = value; },
            onConfirmedChange: (value: boolean) => { this.evidenceConfirmed = value; },
            onSubmitEvidence: () => { void this.submitGrowthEvidence(); },
            onOpenSource: (sourceUrl: string) => { void this.openGrowthEvidenceSource(sourceUrl); },
            onRevokeEvidence: (taskId: string) => { this.revokeGrowthEvidence(taskId); },
          })
        }

        this.buildStatusMessage(this.growthMessage)
        if (this.growthHistory.length > 0) {
          Column({ space: 7 }) {
            Text('实证变化记录')
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor('#0F172A')
            ForEach(this.growthHistory.slice(0, 5), (item: string) => {
              Text(`• ${item}`)
                .fontSize(12)
                .fontColor('#64748B')
                .lineHeight(19)
                .width('100%')
            }, (item: string, index: number) => `${index}-${item}`)
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(16)
          .backgroundColor('#EFF6FF')
          .borderRadius(8)
        }
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 24 })
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }

  @Builder
  private buildNavigationItem(icon: Resource, label: string, tab: number): void {
    Column({ space: 3 }) {
      SymbolGlyph(icon)
        .fontSize(20)
        .fontColor([this.activeTab === tab ? $r('app.color.km_primary') : $r('app.color.km_text_secondary')])
      Text(label)
        .fontSize(10)
        .fontWeight(this.activeTab === tab ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(this.activeTab === tab ? $r('app.color.km_primary') : $r('app.color.km_text_secondary'))
        .maxLines(1)
    }
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .layoutWeight(1)
    .height(52)
    .backgroundColor(this.activeTab === tab ? $r('app.color.km_primary_soft') : '#00FFFFFF')
    .borderRadius(8)
    .onClick(() => {
      if (tab === 2) this.openJobsTab();
      else this.activeTab = tab;
    })
  }

  @Builder
  private buildBottomNavigation(): void {
    Column() {
      Divider()
        .color($r('app.color.km_border'))
        .strokeWidth(1)
      Row({ space: 4 }) {
        this.buildNavigationItem($r('sys.symbol.house'), '首页', 0)
        this.buildNavigationItem($r('sys.symbol.doc_text'), '简历', 1)
        this.buildNavigationItem($r('sys.symbol.briefcase'), '岗位', 2)
        this.buildNavigationItem($r('sys.symbol.mic'), '面试', 3)
        this.buildNavigationItem($r('sys.symbol.ranking'), '成长', 4)
      }
      .width('100%')
      .padding({ left: 8, right: 8, top: 6, bottom: 8 })
    }
    .width('100%')
    .backgroundColor($r('app.color.km_surface'))
  }

  build() {
    if (this.showIntro) {
      this.buildIntro()
    } else {
      Column() {
        this.buildHeader()
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
        this.buildBottomNavigation()
      }
      .width('100%')
      .height('100%')
      .backgroundColor($r('app.color.km_page_background'))
    }
  }
}
