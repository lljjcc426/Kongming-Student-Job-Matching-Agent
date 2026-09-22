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
  @Prop applicationDeadlineError: string = '';
  @Prop nextInterviewAtError: string = '';
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

  private stageColor(stageId: string): ResourceColor {
    if (stageId === 'offer') return $r('app.color.km_success');
    if (stageId === 'closed') return $r('app.color.km_text_secondary');
    if (stageId === 'interview') return $r('app.color.km_purple');
    if (stageId === 'applied') return $r('app.color.km_teal');
    return $r('app.color.km_info');
  }

  private stageBackground(stageId: string): ResourceColor {
    if (stageId === 'offer') return $r('app.color.km_success_soft');
    if (stageId === 'closed') return $r('app.color.km_disabled_soft');
    if (stageId === 'interview') return $r('app.color.km_purple_soft');
    if (stageId === 'applied') return $r('app.color.km_teal_soft');
    return $r('app.color.km_info_soft');
  }

  @Builder
  private buildFieldLabel(label: string, hint: string): void {
    Row() {
      Text(label)
        .fontSize(10)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_body'))
      Blank()
      Text(hint)
        .fontSize(9)
        .fontColor($r('app.color.km_text_tertiary'))
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
            .fontColor($r('app.color.km_text_primary'))
          Text(this.applicationUpdatedAt ? `最近更新 ${this.applicationUpdatedAt}` : '阶段只保存在本机')
            .fontSize(10)
            .fontColor($r('app.color.km_text_secondary'))
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
        .fontColor($r('app.color.km_text_body'))
        .lineHeight(19)
        .width('100%')
        .padding(10)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .borderRadius(8)

      Row() {
        Text('实际投递版本')
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
        Blank()
        Text(this.boundVersionName || '未绑定')
          .fontSize(10)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.boundVersionName ? $r('app.color.km_success') : $r('app.color.km_warning'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')

      Grid() {
        ForEach(APPLICATION_STAGES, (stage: NativeApplicationStageOption) => {
          GridItem() {
            Button(stage.label)
              .width('100%')
              .constraintSize({ minHeight: 36 })
              .fontSize(11)
              .fontWeight(stage.id === this.applicationStage ? FontWeight.Bold : FontWeight.Regular)
              .fontColor(stage.id === this.applicationStage ? this.stageColor(stage.id) : $r('app.color.km_text_muted'))
              .backgroundColor(stage.id === this.applicationStage ? this.stageBackground(stage.id) : $r('app.color.km_neutral_soft'))
              .borderRadius(8)
              .onClick(() => { this.onStageChange(stage.id); })
          }
        }, (stage: NativeApplicationStageOption) => stage.id)
      }
      .columnsTemplate('1fr 1fr 1fr')
      .columnsGap(8)
      .rowsGap(8)
      .constraintSize({ minHeight: 80 })
      .width('100%')

      Column({ space: 8 }) {
        Column({ space: 5 }) {
          this.buildFieldLabel('投递截止', '选填')
          TextInput({ placeholder: '例如：2026-09-30 18:00', text: this.applicationDeadline })
            .constraintSize({ minHeight: 40 })
            .fontSize(11)
            .maxLength(16)
            .enterKeyType(EnterKeyType.Next)
            .backgroundColor($r('app.color.km_surface_subtle'))
            .border({ width: 1, color: this.applicationDeadlineError ? $r('app.color.km_danger') : $r('app.color.km_border') })
            .borderRadius(8)
            .onChange((value: string) => { this.onDeadlineChange(value); })
          if (this.applicationDeadlineError) {
            Text(this.applicationDeadlineError)
              .fontSize(9)
              .fontColor($r('app.color.km_danger'))
              .lineHeight(15)
              .width('100%')
          }
        }
        .width('100%')
        Column({ space: 5 }) {
          this.buildFieldLabel('下一场面试', '选填')
          TextInput({ placeholder: '例如：2026-10-08 14:30', text: this.nextInterviewAt })
            .constraintSize({ minHeight: 40 })
            .fontSize(11)
            .maxLength(16)
            .enterKeyType(EnterKeyType.Done)
            .backgroundColor($r('app.color.km_surface_subtle'))
            .border({ width: 1, color: this.nextInterviewAtError ? $r('app.color.km_danger') : $r('app.color.km_border') })
            .borderRadius(8)
            .onChange((value: string) => { this.onInterviewChange(value); })
          if (this.nextInterviewAtError) {
            Text(this.nextInterviewAtError)
              .fontSize(9)
              .fontColor($r('app.color.km_danger'))
              .lineHeight(15)
              .width('100%')
          }
        }
        .width('100%')
        Button('保存投递日程')
          .width('100%')
          .constraintSize({ minHeight: 38 })
          .fontSize(11)
          .fontColor($r('app.color.km_teal'))
          .backgroundColor($r('app.color.km_teal_soft'))
          .borderRadius(8)
          .onClick(() => { this.onSaveSchedule(); })
        if ((this.applicationDeadline && !this.applicationDeadlineError) ||
          (this.nextInterviewAt && !this.nextInterviewAtError)) {
          Row({ space: 8 }) {
            if (this.applicationDeadline && !this.applicationDeadlineError) {
              Button('添加截止提醒')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(11)
                .fontColor($r('app.color.km_info'))
                .backgroundColor($r('app.color.km_info_soft'))
                .borderRadius(8)
                .onClick(() => { this.onCreateDeadlineReminder(); })
            }
            if (this.nextInterviewAt && !this.nextInterviewAtError) {
              Button('添加面试提醒')
                .layoutWeight(1)
                .constraintSize({ minHeight: 38 })
                .fontSize(11)
                .fontColor($r('app.color.km_purple'))
                .backgroundColor($r('app.color.km_purple_soft'))
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
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(17)
        .width('100%')
        .padding(9)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

      if (this.applicationEvents.length > 0) {
        Column({ space: 8 }) {
          Text('阶段时间线')
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
            .width('100%')
          ForEach(this.applicationEvents.slice(0, 6), (event: NativeApplicationEvent) => {
            Row({ space: 9 }) {
              Text('●')
                .fontSize(9)
                .fontColor(this.stageColor(event.stage))
              Column({ space: 2 }) {
                Text(event.label)
                  .fontSize(11)
                  .fontColor($r('app.color.km_text_body'))
                  .maxLines(2)
                  .width('100%')
                Text(event.occurredAt)
                  .fontSize(9)
                  .fontColor($r('app.color.km_text_tertiary'))
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
