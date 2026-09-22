import { NativeGrowthEvidenceRecord, NativeGrowthTask } from '../common/NativeWorkspaceModel';

@Component
export struct NativeEvidenceLedger {
  @Prop tasks: NativeGrowthTask[] = [];
  @Prop records: NativeGrowthEvidenceRecord[] = [];
  @Prop evidenceDraft: string = '';
  @Prop evidenceSourceUrl: string = '';
  @Prop evidenceConfirmed: boolean = false;
  @Prop evidenceChecking: boolean = false;
  @Prop evidenceDraftError: string = '';
  @Prop evidenceSourceError: string = '';
  onDraftChange: (value: string) => void = () => {};
  onSourceChange: (value: string) => void = () => {};
  onConfirmedChange: (value: boolean) => void = () => {};
  onSubmitEvidence: () => void = () => {};
  onOpenSource: (sourceUrl: string) => void = () => {};
  onRevokeEvidence: (taskId: string) => void = () => {};

  private nextPendingTaskId(): string {
    for (const task of this.tasks) {
      if (task.status !== 'verified') return task.id;
    }
    return '';
  }

  private activeRecord(taskId: string): NativeGrowthEvidenceRecord | undefined {
    for (const record of this.records) {
      if (record.taskId === taskId && record.status === 'verified') return record;
    }
    return undefined;
  }

  private activeRecordSummary(taskId: string): string {
    const record = this.activeRecord(taskId);
    return record ? record.summary : '旧版本只保留了通过状态，请撤销后重新提交可核验证据。';
  }

  private activeRecordSource(taskId: string): string {
    const record = this.activeRecord(taskId);
    return record ? record.sourceUrl : '';
  }

  private activeRecordMeta(taskId: string): string {
    const record = this.activeRecord(taskId);
    return record ? `${record.submittedAt} · ${record.fingerprint}` : '无证据指纹';
  }

  private sourceVerificationMeta(record: NativeGrowthEvidenceRecord | undefined): string {
    if (record && record.sourceVerification === 'reachable') {
      const method = record.sourceCheckMethod === 'GET_RANGE' ? 'GET Range' : (record.sourceCheckMethod || 'HEAD');
      return `来源可访问 · ${record.sourceHost} · ${method} · HTTP ${record.sourceHttpStatus} · ${record.sourceCheckedAt}`;
    }
    return '历史记录未保存来源在线核验结果';
  }

  private verifiedRecordCount(): number {
    let count = 0;
    for (const record of this.records) {
      if (record.status === 'verified') count += 1;
    }
    return count;
  }

  build() {
    Column({ space: 12 }) {
      ForEach(this.tasks, (task: NativeGrowthTask) => {
        Column({ space: 9 }) {
          Row({ space: 10 }) {
            Circle()
              .width(8)
              .height(8)
              .fill(task.status === 'verified'
                ? $r('app.color.km_success')
                : (task.id === this.nextPendingTaskId() ? $r('app.color.km_primary_action') : $r('app.color.km_text_tertiary')))
            Column({ space: 2 }) {
              Text(task.title)
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('app.color.km_text_primary'))
                .maxLines(2)
              Text(task.status === 'verified'
                ? '已形成可核验证据'
                : (task.id === this.nextPendingTaskId() ? '当前行动任务' : '完成前序任务后开始'))
                .fontSize(9)
                .fontColor($r('app.color.km_text_secondary'))
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Text(task.status === 'verified' ? '已验证' : `预计 +${task.projectedGain}%`)
              .fontSize(9)
              .fontWeight(FontWeight.Medium)
              .fontColor(task.status === 'verified' ? $r('app.color.km_success') : $r('app.color.km_primary_action'))
              .padding({ left: 8, right: 8, top: 5, bottom: 5 })
              .backgroundColor(task.status === 'verified' ? $r('app.color.km_success_soft') : $r('app.color.km_primary_soft'))
              .borderRadius(6)
          }
          .alignItems(VerticalAlign.Center)
          .width('100%')
          Text(task.description)
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(18)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
          Row({ space: 7 }) {
            SymbolGlyph($r('sys.symbol.info_circle'))
              .fontSize(13)
              .fontColor([$r('app.color.km_primary_action')])
            Text(task.evidenceRequirement)
              .fontSize(10)
              .fontColor($r('app.color.km_text_body'))
              .lineHeight(17)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .layoutWeight(1)
          }
          .alignItems(VerticalAlign.Top)
            .width('100%')
            .padding(9)
            .backgroundColor($r('app.color.km_surface_subtle'))
            .borderRadius(6)

          if (task.status !== 'verified' && task.id === this.nextPendingTaskId()) {
            Divider().color($r('app.color.km_border'))
            Row() {
              Text('证据说明')
                .fontSize(10)
                .fontWeight(FontWeight.Medium)
                .fontColor($r('app.color.km_text_body'))
              Blank()
              Text(`${this.evidenceDraft.length}/3000 · 至少 30 字`)
                .fontSize(9)
                .fontColor($r('app.color.km_text_tertiary'))
            }
            .width('100%')
            TextArea({ placeholder: '描述个人行动、产出物和结果数据。', text: this.evidenceDraft })
              .constraintSize({ minHeight: 96 })
              .maxLength(3000)
              .backgroundColor($r('app.color.km_surface_subtle'))
              .border({ width: 1, color: this.evidenceDraftError ? $r('app.color.km_danger') : $r('app.color.km_border') })
              .borderRadius(6)
              .onChange((value: string) => { this.onDraftChange(value); })
            if (this.evidenceDraftError) {
              Text(this.evidenceDraftError)
                .fontSize(9)
                .fontColor($r('app.color.km_danger'))
                .lineHeight(15)
                .width('100%')
            }
            Text('来源链接')
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_body'))
              .width('100%')
            TextInput({ placeholder: 'HTTPS 代码仓库、报告或演示链接', text: this.evidenceSourceUrl })
              .constraintSize({ minHeight: 42 })
              .fontSize(11)
              .maxLength(1000)
              .enterKeyType(EnterKeyType.Done)
              .backgroundColor($r('app.color.km_surface_subtle'))
              .border({ width: 1, color: this.evidenceSourceError ? $r('app.color.km_danger') : $r('app.color.km_border') })
              .borderRadius(6)
              .onChange((value: string) => { this.onSourceChange(value); })
            if (this.evidenceSourceError) {
              Text(this.evidenceSourceError)
                .fontSize(9)
                .fontColor($r('app.color.km_danger'))
                .lineHeight(15)
                .width('100%')
            }
            Row({ space: 10 }) {
              Checkbox({ name: `growth-evidence-${task.id}`, group: 'growth-evidence-confirm' })
                .select(this.evidenceConfirmed)
                .selectedColor($r('app.color.km_teal'))
                .onChange((value: boolean) => { this.onConfirmedChange(value); })
              Text('我确认内容真实，且来源链接可供核验')
                .fontSize(11)
                .fontColor($r('app.color.km_text_muted'))
                .layoutWeight(1)
            }
            .alignItems(VerticalAlign.Center)
            .width('100%')
            Button(this.evidenceChecking ? '正在核验 HTTPS 来源…' : '核验来源并提交')
              .width('100%')
              .constraintSize({ minHeight: 42 })
              .fontColor($r('app.color.km_text_on_primary'))
              .backgroundColor(this.evidenceChecking ? $r('app.color.km_disabled') : $r('app.color.km_primary_action'))
              .borderRadius(8)
              .enabled(!this.evidenceChecking)
              .onClick(() => { this.onSubmitEvidence(); })
          }

          if (task.status === 'verified') {
            Column({ space: 6 }) {
              Row({ space: 6 }) {
                SymbolGlyph($r('sys.symbol.checkmark_circle'))
                  .fontSize(14)
                  .fontColor([$r('app.color.km_success')])
                Text('已验证证据摘要')
                  .fontSize(10)
                  .fontWeight(FontWeight.Medium)
                  .fontColor($r('app.color.km_success'))
              }
              Text(this.activeRecordSummary(task.id))
                .fontSize(11)
                .fontColor($r('app.color.km_text_body'))
                .lineHeight(18)
                .maxLines(2)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .width('100%')
              Text(this.activeRecord(task.id)?.sourceVerification === 'reachable'
                ? `来源可访问 · ${this.activeRecord(task.id)?.sourceHost}`
                : '来源状态未记录')
                .fontSize(9)
                .fontColor(this.activeRecord(task.id)?.sourceVerification === 'reachable' ? $r('app.color.km_success') : $r('app.color.km_warning'))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .width('100%')
            }
            .alignItems(HorizontalAlign.Start)
            .width('100%')
            .padding(10)
            .backgroundColor($r('app.color.km_success_surface'))
            .borderRadius(6)
            Row({ space: 8 }) {
              if (this.activeRecordSource(task.id)) {
                Button('打开来源')
                  .layoutWeight(1)
                  .constraintSize({ minHeight: 36 })
                  .fontSize(10)
                  .fontColor($r('app.color.km_info'))
                  .backgroundColor($r('app.color.km_info_soft'))
                  .borderRadius(8)
                  .onClick(() => { this.onOpenSource(this.activeRecordSource(task.id)); })
              }
              Button('撤销验证')
                .layoutWeight(1)
                .constraintSize({ minHeight: 36 })
                .fontSize(10)
                .fontColor($r('app.color.km_danger'))
                .backgroundColor($r('app.color.km_danger_soft'))
                .borderRadius(8)
                .onClick(() => { this.onRevokeEvidence(task.id); })
            }
            .width('100%')
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(14)
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: task.status === 'verified' ? $r('app.color.km_success_border') : $r('app.color.km_border') })
        .borderRadius(8)
      }, (task: NativeGrowthTask) => `${task.id}-${task.status}`)

      if (this.records.length > 0) {
        Column({ space: 8 }) {
          Row() {
            Text('证据账本')
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.km_text_primary'))
            Blank()
            Text(`${this.verifiedRecordCount()} 有效 / ${this.records.length} 条`)
              .fontSize(10)
              .fontColor($r('app.color.km_teal'))
          }
          .width('100%')
          Text('账本保留公开 HTTPS 的核验方式、时间与状态码，不代表第三方真实性认证。')
            .fontSize(10)
            .fontColor($r('app.color.km_text_secondary'))
            .lineHeight(17)
            .maxLines(2)
            .width('100%')
          ForEach(this.records.slice(0, 6), (record: NativeGrowthEvidenceRecord) => {
            Column({ space: 4 }) {
              Row() {
                Text(record.taskTitle)
                  .fontSize(11)
                  .fontWeight(FontWeight.Medium)
                  .fontColor($r('app.color.km_text_body'))
                  .layoutWeight(1)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text(record.status === 'verified' ? '有效' : '已撤销')
                  .fontSize(9)
                  .fontColor(record.status === 'verified' ? $r('app.color.km_success') : $r('app.color.km_danger'))
              }
              .width('100%')
              Text(`${record.submittedAt} · ${record.fingerprint}`)
                .fontSize(9)
                .fontColor($r('app.color.km_text_tertiary'))
                .width('100%')
              Text(record.sourceVerification === 'reachable'
                ? `来源可访问 · ${record.sourceHost} · HTTP ${record.sourceHttpStatus}`
                : '来源状态未记录')
                .fontSize(9)
                .fontColor(record.sourceVerification === 'reachable' ? $r('app.color.km_success') : $r('app.color.km_warning'))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .width('100%')
              if (record.revokedAt) {
                Text(`撤销时间：${record.revokedAt}`)
                  .fontSize(9)
                  .fontColor($r('app.color.km_danger'))
                  .width('100%')
              }
            }
            .width('100%')
            .padding({ top: 7, bottom: 7 })
            .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
          }, (record: NativeGrowthEvidenceRecord) => `${record.id}-${record.status}`)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)
      }
    }
    .width('100%')
  }
}
