import {
  createNativeApplicationStageOptions,
  NativeApplicationEvent,
  NativeApplicationStageOption,
} from '../common/NativeWorkspaceModel';

const APPLICATION_STAGES: NativeApplicationStageOption[] = createNativeApplicationStageOptions();

@Component
export struct NativeApplicationTracker {
  @Prop applicationStage: string = 'interested';
  @Prop applicationUpdatedAt: string = '';
  @Prop applicationDeadline: string = '';
  @Prop nextInterviewAt: string = '';
  @Prop applicationEvents: NativeApplicationEvent[] = [];
  @Prop applicationMessage: string = '';
  @Prop currentAction: string = '';
  @Prop boundVersionName: string = '';
  onStageChange: (stageId: string) => void = () => {};
  onDeadlineChange: (value: string) => void = () => {};
  onInterviewChange: (value: string) => void = () => {};
  onSaveSchedule: () => void = () => {};
  onCreateDeadlineReminder: () => void = () => {};
  onCreateInterviewReminder: () => void = () => {};

  private stageLabel(stageId: string): string {
    for (const stage of APPLICATION_STAGES) {
      if (stage.id === stageId) return stage.label;
    }
    return '已收藏';
  }

  private stageColor(stageId: string): string {
    if (stageId === 'offer') return '#047857';
    if (stageId === 'closed') return '#64748B';
    if (stageId === 'interview') return '#7C3AED';
    if (stageId === 'applied') return '#0F766E';
    return '#1D4ED8';
  }

  private stageBackground(stageId: string): string {
    if (stageId === 'offer') return '#D1FAE5';
    if (stageId === 'closed') return '#E2E8F0';
    if (stageId === 'interview') return '#EDE9FE';
    if (stageId === 'applied') return '#CCFBF1';
    return '#DBEAFE';
  }

  @Builder
  private buildFieldLabel(label: string, hint: string): void {
    Row() {
      Text(label)
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor('#334155')
      Blank()
      Text(hint)
        .fontSize(9)
        .fontColor('#94A3B8')
    }
    .width('100%')
  }

  build() {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 3 }) {
          Text('投递进度')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
          Text(this.applicationUpdatedAt ? `最近更新 ${this.applicationUpdatedAt}` : '阶段只保存在本机')
            .fontSize(10)
            .fontColor('#64748B')
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(this.stageLabel(this.applicationStage))
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.stageColor(this.applicationStage))
          .padding({ left: 9, right: 9, top: 5, bottom: 5 })
          .backgroundColor(this.stageBackground(this.applicationStage))
          .borderRadius(8)
      }
      .width('100%')

      Text(this.currentAction)
        .fontSize(12)
        .fontColor('#334155')
        .lineHeight(19)
        .width('100%')
        .padding(10)
        .backgroundColor('#F8FAFC')
        .borderRadius(8)

      Row() {
        Text('实际投递版本')
          .fontSize(10)
          .fontColor('#64748B')
        Blank()
        Text(this.boundVersionName || '未绑定')
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.boundVersionName ? '#047857' : '#B45309')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')

      Grid() {
        ForEach(APPLICATION_STAGES, (stage: NativeApplicationStageOption) => {
          GridItem() {
            Button(stage.label)
              .width('100%')
              .height(36)
              .fontSize(11)
              .fontWeight(stage.id === this.applicationStage ? FontWeight.Bold : FontWeight.Regular)
              .fontColor(stage.id === this.applicationStage ? this.stageColor(stage.id) : '#475569')
              .backgroundColor(stage.id === this.applicationStage ? this.stageBackground(stage.id) : '#F1F5F9')
              .borderRadius(8)
              .onClick(() => { this.onStageChange(stage.id); })
          }
        }, (stage: NativeApplicationStageOption) => stage.id)
      }
      .columnsTemplate('1fr 1fr 1fr')
      .columnsGap(8)
      .rowsGap(8)
      .height(80)
      .width('100%')

      Column({ space: 8 }) {
        Column({ space: 5 }) {
          this.buildFieldLabel('投递截止', '选填')
          TextInput({ placeholder: '例如：2026-09-30 18:00', text: this.applicationDeadline })
            .height(40)
            .fontSize(11)
            .backgroundColor('#F8FAFC')
            .border({ width: 1, color: '#E2E8F0' })
            .borderRadius(8)
            .onChange((value: string) => { this.onDeadlineChange(value); })
        }
        .width('100%')
        Column({ space: 5 }) {
          this.buildFieldLabel('下一场面试', '选填')
          TextInput({ placeholder: '例如：2026-10-08 14:30', text: this.nextInterviewAt })
            .height(40)
            .fontSize(11)
            .backgroundColor('#F8FAFC')
            .border({ width: 1, color: '#E2E8F0' })
            .borderRadius(8)
            .onChange((value: string) => { this.onInterviewChange(value); })
        }
        .width('100%')
        Button('保存投递日程')
          .width('100%')
          .height(38)
          .fontSize(11)
          .fontColor('#0F766E')
          .backgroundColor('#CCFBF1')
          .borderRadius(8)
          .onClick(() => { this.onSaveSchedule(); })
        if (this.applicationDeadline || this.nextInterviewAt) {
          Row({ space: 8 }) {
            if (this.applicationDeadline) {
              Button('添加截止提醒')
                .layoutWeight(1)
                .height(38)
                .fontSize(11)
                .fontColor('#1D4ED8')
                .backgroundColor('#DBEAFE')
                .borderRadius(8)
                .onClick(() => { this.onCreateDeadlineReminder(); })
            }
            if (this.nextInterviewAt) {
              Button('添加面试提醒')
                .layoutWeight(1)
                .height(38)
                .fontSize(11)
                .fontColor('#7C3AED')
                .backgroundColor('#EDE9FE')
                .borderRadius(8)
                .onClick(() => { this.onCreateInterviewReminder(); })
            }
          }
          .width('100%')
        }
      }
      .width('100%')

      Text(this.applicationMessage)
        .fontSize(10)
        .fontColor('#64748B')
        .lineHeight(17)
        .width('100%')
        .padding(9)
        .backgroundColor('#F8FAFC')
        .border({ width: 1, color: '#E2E8F0' })
        .borderRadius(8)

      if (this.applicationEvents.length > 0) {
        Column({ space: 8 }) {
          Text('阶段时间线')
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
            .width('100%')
          ForEach(this.applicationEvents.slice(0, 6), (event: NativeApplicationEvent) => {
            Row({ space: 9 }) {
              Text('●')
                .fontSize(9)
                .fontColor(this.stageColor(event.stage))
              Column({ space: 2 }) {
                Text(event.label)
                  .fontSize(11)
                  .fontColor('#334155')
                  .maxLines(2)
                  .width('100%')
                Text(event.occurredAt)
                  .fontSize(9)
                  .fontColor('#94A3B8')
                  .width('100%')
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
            }
            .alignItems(VerticalAlign.Top)
            .width('100%')
          }, (event: NativeApplicationEvent, index: number) => `${event.occurredAt}-${index}`)
        }
        .width('100%')
        .padding({ top: 2 })
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding({ top: 12 })
  }
}
