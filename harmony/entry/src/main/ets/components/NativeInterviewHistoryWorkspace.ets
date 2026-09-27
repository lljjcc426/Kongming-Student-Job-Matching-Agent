import {
  NativeInterviewHistoryFilter,
  NativeInterviewHistoryService,
  NativeInterviewScoreComparison,
} from '../common/NativeInterviewHistoryService';
import { NativeInterviewCompetencyResult, NativeInterviewSessionRecord, NativeInterviewTurn } from '../common/NativeWorkspaceModel';

@Component
export struct NativeInterviewHistoryWorkspace {
  @Prop sessions: NativeInterviewSessionRecord[] = [];
  @Prop currentJobKey: string = '';
  @Prop practiceJobKeys: string[] = [];
  @Prop horizontalPadding: number = 16;
  @Prop contentMaxWidth: number = 960;
  @Link search: string;
  @Link scope: string;
  @Link kind: string;
  @Link recordId: string;
  @Link compareIds: string[];
  @Link comparing: boolean;
  @State detailSection: number = 0;
  private service: NativeInterviewHistoryService = new NativeInterviewHistoryService();
  private scroller: Scroller = new Scroller();
  private kindIds: string[] = ['all', '综合面', '技术面', 'HR面'];
  private kindLabels: string[] = ['全部类型', '综合面', '技术面', 'HR 面'];
  onBack: () => void = () => {};
  onNewTraining: () => void = () => {};
  onPractice: (session: NativeInterviewSessionRecord) => void = () => {};
  onDeleteVideo: (session: NativeInterviewSessionRecord) => void = () => {};
  onNotice: (message: string) => void = () => {};
  onSearchEditing: (editing: boolean) => void = () => {};

  private visibleSessions(): NativeInterviewSessionRecord[] {
    return this.service.query(this.sessions, this.currentJobKey, this.scope, this.kind, this.search);
  }

  private scopeIndex(): number {
    return Math.max(0, this.service.filters(this.sessions, this.currentJobKey)
      .findIndex((filter: NativeInterviewHistoryFilter) => filter.id === this.scope));
  }

  private durationLabel(seconds: number): string {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '未记录';
    const wholeSeconds = Math.floor(seconds);
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
  }

  private openRecord(id: string): void {
    this.recordId = id;
    this.detailSection = 0;
    this.getUIContext().getFocusController().clearFocus();
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  private selectComparison(id: string): void {
    const selection = this.service.toggleComparison(this.sessions, this.compareIds, id);
    this.compareIds = selection.ids;
    if (selection.message) this.onNotice(selection.message);
  }

  private statValue(label: string): number {
    const sessions = this.visibleSessions();
    if (label === '训练次数') return sessions.length;
    if (label === '回答轮次') return sessions.reduce((count: number, session: NativeInterviewSessionRecord) => count + (session.turns || []).length, 0);
    return sessions.filter((session: NativeInterviewSessionRecord) => session.videoRecorded && session.videoUri).length;
  }

  @Builder
  private buildBackHeading(title: string): void {
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
      .accessibilityText('返回面试记录')
      .onClick(() => { this.onBack(); })
      Text(title)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
        .layoutWeight(1)
    }
    .width('100%')
  }

  @Builder
  private buildStat(label: string): void {
    Column({ space: 4 }) {
      Text(`${this.statValue(label)}`)
        .fontSize(22)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
      Text(label)
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
    }
    .layoutWeight(1)
    .padding({ top: 10, bottom: 12 })
  }

  @Builder
  private buildSessionRow(session: NativeInterviewSessionRecord): void {
    Row({ space: 10 }) {
      Checkbox({ name: session.id })
        .select(this.compareIds.includes(session.id))
        .selectedColor($r('app.color.km_primary_action'))
        .width(20)
        .height(20)
        .accessibilityText(`选择对比 ${this.service.dateLabel(session)} ${this.service.jobLabel(session)}`)
        .onChange(() => { this.selectComparison(session.id); })
      Button() {
        Row({ space: 10 }) {
          Column({ space: 5 }) {
            Text(this.service.jobLabel(session))
              .fontSize(14)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            Text(`${session.interviewType} · ${session.difficulty} · ${(session.turns || []).length} 轮`)
              .fontSize(11)
              .fontColor($r('app.color.km_text_secondary'))
            Text(`${this.service.dateLabel(session)}${session.videoRecorded && session.videoUri ? ' · 含录像' : ''}`)
              .fontSize(10)
              .fontColor($r('app.color.km_text_tertiary'))
              .maxLines(2)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(this.service.scoreText(session.overallScore))
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_primary_action'))
          SymbolGlyph($r('sys.symbol.chevron_right'))
            .fontSize(13)
            .fontColor([$r('app.color.km_text_tertiary')])
        }
        .width('100%')
      }
      .layoutWeight(1)
      .backgroundColor(Color.Transparent)
      .borderRadius(0)
      .onClick(() => { this.openRecord(session.id); })
    }
    .width('100%')
    .padding(14)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: this.compareIds.includes(session.id) ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
    .borderRadius(8)
  }

  @Builder
  private buildList(): void {
    Row({ space: 8 }) {
      Text('面试记录')
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
        .layoutWeight(1)
      if (this.compareIds.length > 0) {
        Text(`已选 ${this.compareIds.length}/2`)
          .fontSize(11)
          .fontColor($r('app.color.km_primary_action'))
        Button() {
          SymbolGlyph($r('sys.symbol.xmark'))
            .fontSize(15)
            .fontColor([$r('app.color.km_text_secondary')])
        }
        .width(36)
        .height(36)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .borderRadius(6)
        .accessibilityText('清除对比选择')
        .onClick(() => { this.compareIds = []; })
      }
      Button() {
        Row({ space: 5 }) {
          SymbolGlyph($r('sys.symbol.square_grid_2x2'))
            .fontSize(15)
            .fontColor([$r('app.color.km_primary_action')])
          Text('对比训练')
            .fontSize(11)
            .fontColor($r('app.color.km_primary_action'))
        }
      }
      .height(38)
      .padding({ left: 10, right: 10 })
      .backgroundColor($r('app.color.km_primary_soft'))
      .borderRadius(6)
      .enabled(this.service.compare(this.sessions, this.compareIds).metrics.length > 0)
      .onClick(() => {
        this.comparing = true;
        this.getUIContext().getFocusController().clearFocus();
        this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
      })
    }
    .width('100%')
    Row() {
      this.buildStat('训练次数')
      this.buildStat('回答轮次')
      this.buildStat('含录像')
    }
    .width('100%')
    .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
    Search({ value: this.search, placeholder: '搜索岗位、问题或回答' })
      .height(44)
      .maxLength(80)
      .textFont({ size: 13 })
      .placeholderFont({ size: 13 })
      .fontColor($r('app.color.km_text_primary'))
      .backgroundColor($r('app.color.km_surface'))
      .borderRadius(6)
      .onChange((value: string) => { this.search = value; })
      .onEditChange((editing: boolean) => { this.onSearchEditing(editing); })
      .onSubmit(() => { this.getUIContext().getFocusController().clearFocus(); })
    Row({ space: 10 }) {
      Select(this.service.filters(this.sessions, this.currentJobKey).map((filter: NativeInterviewHistoryFilter): SelectOption => {
        return { value: filter.label };
      }))
        .selected(this.scopeIndex())
        .value(this.service.filters(this.sessions, this.currentJobKey)[this.scopeIndex()].label)
        .font({ size: 11 })
        .height(40)
        .borderRadius(6)
        .layoutWeight(1)
        .onSelect((index: number) => { this.scope = this.service.filters(this.sessions, this.currentJobKey)[index].id; })
      Select(this.kindLabels.map((label: string): SelectOption => { return { value: label }; }))
        .selected(Math.max(0, this.kindIds.indexOf(this.kind)))
        .value(this.kindLabels[Math.max(0, this.kindIds.indexOf(this.kind))])
        .font({ size: 11 })
        .height(40)
        .borderRadius(6)
        .onSelect((index: number) => { this.kind = this.kindIds[index]; })
    }
    .width('100%')
    Text(`${this.visibleSessions().length} 次训练`)
      .fontSize(11)
      .fontColor($r('app.color.km_text_tertiary'))
    if (this.visibleSessions().length === 0) {
      Column({ space: 14 }) {
        SymbolGlyph($r('sys.symbol.doc_text'))
          .fontSize(30)
          .fontColor([$r('app.color.km_text_tertiary')])
        Text(this.sessions.length === 0 ? '还没有完成的面试记录' : '没有符合条件的训练记录')
          .fontSize(14)
          .fontColor($r('app.color.km_text_secondary'))
        if (this.sessions.length > 0) {
          Button('查看全部记录')
            .height(38)
            .fontSize(12)
            .fontColor($r('app.color.km_primary_action'))
            .backgroundColor($r('app.color.km_primary_soft'))
            .borderRadius(6)
            .onClick(() => { this.search = ''; this.scope = 'all'; this.kind = 'all'; })
        } else {
          Button('准备一场面试')
            .height(40)
            .fontSize(12)
            .fontColor($r('app.color.km_text_on_primary'))
            .backgroundColor($r('app.color.km_primary_action'))
            .borderRadius(6)
            .onClick(() => { this.onNewTraining(); })
        }
      }
      .width('100%')
      .padding({ top: 36, bottom: 36 })
    } else {
      ForEach(this.visibleSessions(), (session: NativeInterviewSessionRecord) => {
        this.buildSessionRow(session)
      }, (session: NativeInterviewSessionRecord) => session.id)
    }
  }

  @Builder
  private buildTextSection(title: string, content: string): void {
    Column({ space: 8 }) {
      Text(title)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
      Text(content || '未记录')
        .fontSize(13)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(22)
        .copyOption(CopyOptions.LocalDevice)
        .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ top: 12, bottom: 12 })
    .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
  }

  @Builder
  private buildScore(label: string, value: number): void {
    Column({ space: 4 }) {
      Text(this.service.scoreText(value))
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor(label === '综合' ? $r('app.color.km_primary_action') : $r('app.color.km_text_primary'))
      Text(label)
        .fontSize(10)
        .fontColor($r('app.color.km_text_secondary'))
    }
    .layoutWeight(1)
  }

  @Builder
  private buildDetail(session: NativeInterviewSessionRecord): void {
    this.buildBackHeading('训练复盘')
    Text(this.service.jobLabel(session))
      .fontSize(15)
      .fontWeight(FontWeight.Medium)
      .fontColor($r('app.color.km_text_primary'))
      .width('100%')
    Text(`${this.service.dateLabel(session)} · ${session.interviewType} · ${session.difficulty}`)
      .fontSize(11)
      .fontColor($r('app.color.km_text_secondary'))
    Row({ space: 4 }) {
      this.buildScore('综合', session.overallScore)
      this.buildScore('结构', session.structureScore)
      this.buildScore('证据', session.evidenceScore)
      this.buildScore('关联', session.relevanceScore)
      this.buildScore('表达', session.clarityScore)
    }
    .width('100%')
    .padding({ top: 10, bottom: 12 })
    .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
    Text(`${(session.turns || []).length} 轮回答 · 用时 ${this.durationLabel(session.elapsedSeconds)}`)
      .fontSize(11)
      .fontColor($r('app.color.km_text_tertiary'))
    Row({ space: 4 }) {
      ForEach(['逐题复盘', '综合反馈', '训练资料'], (label: string, index: number) => {
        Button(label)
          .height(40)
          .layoutWeight(1)
          .fontSize(12)
          .fontColor(this.detailSection === index ? $r('app.color.km_primary_action') : $r('app.color.km_text_secondary'))
          .backgroundColor(this.detailSection === index ? $r('app.color.km_primary_soft') : Color.Transparent)
          .borderRadius(6)
          .onClick(() => { this.detailSection = index; })
      }, (label: string) => label)
    }
    .width('100%')
    if (this.detailSection === 0) {
      if ((session.turns || []).length === 0) {
        this.buildTextSection('问答记录', '这次训练没有保留逐题回答。')
      }
      ForEach(session.turns || [], (turn: NativeInterviewTurn, index: number) => {
        Column({ space: 10 }) {
          Text(`问题 ${index + 1}`)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_primary_action'))
          Text(turn.question || '问题未记录')
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_text_primary'))
            .lineHeight(22)
            .copyOption(CopyOptions.LocalDevice)
            .width('100%')
          Text('我的回答')
            .fontSize(11)
            .fontColor($r('app.color.km_text_tertiary'))
          Text(turn.answer || '回答未记录')
            .fontSize(13)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(22)
            .copyOption(CopyOptions.LocalDevice)
            .width('100%')
          ForEach((session.competencyResults || []).filter((result: NativeInterviewCompetencyResult) => result.round === index + 1).slice(0, 1), (result: NativeInterviewCompetencyResult) => {
            Divider().color($r('app.color.km_border'))
            Text(`${result.label} · ${this.service.scoreText(result.score)}`)
              .fontSize(11)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
            if (result.evidenceExcerpt) {
              Text(`回答线索：${result.evidenceExcerpt}`)
                .fontSize(12)
                .fontColor($r('app.color.km_text_secondary'))
                .lineHeight(20)
                .width('100%')
            }
            if (result.gap) {
              Text(`待补充：${result.gap}`)
                .fontSize(12)
                .fontColor($r('app.color.km_warning'))
                .lineHeight(20)
                .width('100%')
            }
          }, (result: NativeInterviewCompetencyResult) => `${session.id}-competency-${result.round}`)
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(14)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)
      }, (_turn: NativeInterviewTurn, index: number) => `${session.id}-turn-${index}`)
    } else if (this.detailSection === 1) {
      this.buildTextSection('优先改进', session.priorityLabel)
      this.buildTextSection('本次反馈', session.feedback)
      if (session.improvedAnswer) {
        this.buildTextSection('参考改写', session.improvedAnswer)
      }
      if (session.videoRecorded && session.videoUri) {
        Row({ space: 8 }) {
          Column({ space: 4 }) {
            Text('候选人录像')
              .fontSize(13)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
            Text(`${this.durationLabel(session.videoDurationSeconds)} · 本机无声画面`)
              .fontSize(11)
              .fontColor($r('app.color.km_text_secondary'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Button() {
            SymbolGlyph($r('sys.symbol.trash'))
              .fontSize(16)
              .fontColor([$r('app.color.km_danger')])
          }
          .width(36)
          .height(36)
          .backgroundColor($r('app.color.km_danger_soft'))
          .borderRadius(6)
          .accessibilityText('删除候选人录像')
          .onClick(() => { this.onDeleteVideo(session); })
        }
        .width('100%')
        Video({ src: session.videoUri })
          .width('100%')
          .aspectRatio(16 / 9)
          .controls(true)
          .autoPlay(false)
          .muted(true)
          .objectFit(ImageFit.Contain)
          .backgroundColor('#111827')
          .borderRadius(6)
      }
    } else {
      this.buildTextSection('本次简历版本', session.resumeVersionName || '未绑定投递版本')
      this.buildTextSection('岗位要求', session.jobDescriptionSnapshot || '这次训练未保留岗位说明。')
      if ((session.requirementFocuses || []).length > 0) {
        this.buildTextSection('考察重点', session.requirementFocuses.join('、'))
      }
      if ((session.competencyLabels || []).length > 0) {
        this.buildTextSection('题谱覆盖', `${session.competencyCoveredCount || 0}/${session.competencyLabels.length} · ${session.competencyLabels.join('、')}`)
      }
    }
    Button('按此岗位再练一次')
      .width('100%')
      .height(44)
      .fontSize(13)
      .fontColor($r('app.color.km_text_on_primary'))
      .backgroundColor($r('app.color.km_primary_action'))
      .borderRadius(6)
      .enabled(this.practiceJobKeys.includes(session.jobKey))
      .onClick(() => { this.onPractice(session); })
    if (!this.practiceJobKeys.includes(session.jobKey)) {
      Text('岗位资料已移除，历史复盘仍保留。')
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
    }
  }

  @Builder
  private buildComparison(): void {
    this.buildBackHeading('训练对比')
    if (this.service.compare(this.sessions, this.compareIds).metrics.length === 0) {
      this.buildTextSection('无法对比', '请返回记录列表，选择同一岗位的两次训练。')
    } else {
      Text(this.service.jobLabel(this.service.compare(this.sessions, this.compareIds).records[0]))
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
        .width('100%')
      if (!this.service.compare(this.sessions, this.compareIds).comparable) {
        Text(`训练条件不同，仅并列展示评分：${this.service.compare(this.sessions, this.compareIds).reasons.join('、')}。`)
          .fontSize(12)
          .fontColor($r('app.color.km_warning'))
          .lineHeight(20)
          .width('100%')
          .padding(12)
          .backgroundColor($r('app.color.km_warning_soft'))
          .borderRadius(6)
      }
      Row({ space: 12 }) {
        ForEach(this.service.compare(this.sessions, this.compareIds).records, (session: NativeInterviewSessionRecord, index: number) => {
          Column({ space: 6 }) {
            Text(this.service.compare(this.sessions, this.compareIds).chronological
              ? (index === 0 ? '训练 A · 较早' : '训练 B · 较近') : (index === 0 ? '训练 A' : '训练 B'))
              .fontSize(12)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_primary_action'))
            Text(this.service.dateLabel(session))
              .fontSize(11)
              .fontColor($r('app.color.km_text_secondary'))
            Text(`${session.interviewType} · ${session.difficulty} · ${session.durationMinutes} 分钟`)
              .fontSize(11)
              .fontColor($r('app.color.km_text_secondary'))
            Text(session.resumeVersionName || '未绑定投递版本')
              .fontSize(11)
              .fontColor($r('app.color.km_text_tertiary'))
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start)
        }, (session: NativeInterviewSessionRecord) => session.id)
      }
      .width('100%')
      .padding({ top: 10, bottom: 12 })
      Row({ space: 8 }) {
        Text('维度').width(44).fontSize(11).fontColor($r('app.color.km_text_secondary'))
        Text('训练 A').layoutWeight(1).textAlign(TextAlign.Center).fontSize(11).fontColor($r('app.color.km_text_secondary'))
        Text('训练 B').layoutWeight(1).textAlign(TextAlign.Center).fontSize(11).fontColor($r('app.color.km_text_secondary'))
        Text('变化').width(48).textAlign(TextAlign.End).fontSize(11).fontColor($r('app.color.km_text_secondary'))
      }
      .width('100%')
      ForEach(this.service.compare(this.sessions, this.compareIds).metrics, (metric: NativeInterviewScoreComparison) => {
        Row({ space: 8 }) {
          Text(metric.label).width(44).fontSize(12).fontColor($r('app.color.km_text_primary'))
          Text(this.service.scoreText(metric.earlier)).layoutWeight(1).textAlign(TextAlign.Center).fontSize(18).fontColor($r('app.color.km_text_primary'))
          Text(this.service.scoreText(metric.later)).layoutWeight(1).textAlign(TextAlign.Center).fontSize(18).fontColor($r('app.color.km_text_primary'))
          Text(metric.delta).width(48).textAlign(TextAlign.End).fontSize(13).fontColor(metric.delta.startsWith('+') ? $r('app.color.km_teal') : $r('app.color.km_text_secondary'))
        }
        .width('100%')
        .height(48)
        .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
      }, (metric: NativeInterviewScoreComparison) => metric.label)
      ForEach(this.service.compare(this.sessions, this.compareIds).records, (session: NativeInterviewSessionRecord, index: number) => {
        this.buildTextSection(index === 0 ? '训练 A · 优先改进' : '训练 B · 优先改进', session.priorityLabel)
        Button(index === 0 ? '查看训练 A 复盘' : '查看训练 B 复盘')
          .width('100%')
          .height(40)
          .fontSize(12)
          .fontColor($r('app.color.km_primary_action'))
          .backgroundColor($r('app.color.km_primary_soft'))
          .borderRadius(6)
          .onClick(() => { this.openRecord(session.id); })
      }, (session: NativeInterviewSessionRecord) => `comparison-${session.id}`)
    }
  }

  build() {
    Scroll(this.scroller) {
      Column({ space: 12 }) {
        if (this.recordId) {
          if (this.service.find(this.sessions, [this.recordId]).length === 0) {
            this.buildBackHeading('训练复盘')
            this.buildTextSection('记录不可用', '这次记录已不在训练档案中。')
          }
          ForEach(this.service.find(this.sessions, [this.recordId]), (session: NativeInterviewSessionRecord) => {
            this.buildDetail(session)
          }, (session: NativeInterviewSessionRecord) => `detail-${session.id}`)
        } else if (this.comparing) {
          this.buildComparison()
        } else {
          this.buildList()
        }
        Text('训练评分仅供复盘参考，不代表招聘结论。')
          .fontSize(10)
          .fontColor($r('app.color.km_text_tertiary'))
          .lineHeight(17)
      }
      .width('100%')
      .constraintSize({ maxWidth: this.contentMaxWidth })
      .padding({ left: this.horizontalPadding, right: this.horizontalPadding, top: 14, bottom: 24 })
      .alignItems(HorizontalAlign.Start)
      .alignSelf(ItemAlign.Center)
    }
    .layoutWeight(1)
    .align(Alignment.Top)
    .scrollBar(BarState.Off)
  }
}
