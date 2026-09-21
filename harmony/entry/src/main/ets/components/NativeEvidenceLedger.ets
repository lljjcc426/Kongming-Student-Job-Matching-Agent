import { NativeGrowthEvidenceRecord, NativeGrowthTask } from '../common/NativeWorkspaceModel';

@Component
export struct NativeEvidenceLedger {
  @Prop tasks: NativeGrowthTask[] = [];
  @Prop records: NativeGrowthEvidenceRecord[] = [];
  @Prop evidenceDraft: string = '';
  @Prop evidenceSourceUrl: string = '';
  @Prop evidenceConfirmed: boolean = false;
  @Prop evidenceChecking: boolean = false;
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
        Column({ space: 8 }) {
          Row() {
            Text(task.title)
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor('#0F172A')
              .layoutWeight(1)
            Text(task.status === 'verified' ? '证据已通过' : `+${task.projectedGain}%`)
              .fontSize(11)
              .fontColor(task.status === 'verified' ? '#047857' : '#2563EB')
          }
          .width('100%')
          Text(task.description)
            .fontSize(12)
            .fontColor('#64748B')
            .lineHeight(19)
            .width('100%')
          Text(`证据要求：${task.evidenceRequirement}`)
            .fontSize(12)
            .fontColor('#334155')
            .lineHeight(19)
            .width('100%')

          if (task.status !== 'verified' && task.id === this.nextPendingTaskId()) {
            Text('证据说明')
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor('#334155')
              .width('100%')
            TextArea({ placeholder: '描述个人行动、产出物和结果数据。', text: this.evidenceDraft })
              .height(110)
              .backgroundColor('#F8FAFC')
              .border({ width: 1, color: '#E2E8F0' })
              .borderRadius(8)
              .onChange((value: string) => { this.onDraftChange(value); })
            Text('来源链接')
              .fontSize(10)
              .fontWeight(FontWeight.Medium)
              .fontColor('#334155')
              .width('100%')
            TextInput({ placeholder: 'HTTPS 代码仓库、报告或演示链接', text: this.evidenceSourceUrl })
              .height(42)
              .fontSize(11)
              .backgroundColor('#F8FAFC')
              .border({ width: 1, color: '#E2E8F0' })
              .borderRadius(8)
              .onChange((value: string) => { this.onSourceChange(value); })
            Row({ space: 10 }) {
              Checkbox({ name: `growth-evidence-${task.id}`, group: 'growth-evidence-confirm' })
                .select(this.evidenceConfirmed)
                .selectedColor('#0F766E')
                .onChange((value: boolean) => { this.onConfirmedChange(value); })
              Text('我确认内容真实，且来源链接可供核验')
                .fontSize(11)
                .fontColor('#475569')
                .layoutWeight(1)
            }
            .alignItems(VerticalAlign.Center)
            .width('100%')
            Button(this.evidenceChecking ? '正在核验 HTTPS 来源…' : '核验来源并提交')
              .width('100%')
              .height(42)
              .fontColor('#FFFFFF')
              .backgroundColor(this.evidenceChecking ? '#94A3B8' : '#2563EB')
              .borderRadius(8)
              .enabled(!this.evidenceChecking)
              .onClick(() => { this.onSubmitEvidence(); })
          }

          if (task.status === 'verified') {
            Divider().color('#A7F3D0')
            Text(this.activeRecordSummary(task.id))
              .fontSize(11)
              .fontColor('#334155')
              .lineHeight(18)
              .maxLines(3)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .width('100%')
            Text(this.activeRecordMeta(task.id))
              .fontSize(9)
              .fontColor('#64748B')
              .width('100%')
            Text(this.sourceVerificationMeta(this.activeRecord(task.id)))
              .fontSize(9)
              .fontColor(this.activeRecord(task.id)?.sourceVerification === 'reachable' ? '#047857' : '#B45309')
              .width('100%')
            if (this.activeRecordSource(task.id)) {
              Text(this.activeRecordSource(task.id))
                .fontSize(9)
                .fontColor('#2563EB')
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .width('100%')
            }
            Row({ space: 8 }) {
              if (this.activeRecordSource(task.id)) {
                Button('打开来源')
                  .layoutWeight(1)
                  .height(36)
                  .fontSize(10)
                  .fontColor('#1D4ED8')
                  .backgroundColor('#DBEAFE')
                  .borderRadius(8)
                  .onClick(() => { this.onOpenSource(this.activeRecordSource(task.id)); })
              }
              Button('撤销验证')
                .layoutWeight(1)
                .height(36)
                .fontSize(10)
                .fontColor('#B91C1C')
                .backgroundColor('#FEE2E2')
                .borderRadius(8)
                .onClick(() => { this.onRevokeEvidence(task.id); })
            }
            .width('100%')
          }
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor(task.status === 'verified' ? '#ECFDF5' : '#FFFFFF')
        .border({ width: 1, color: task.status === 'verified' ? '#A7F3D0' : '#E2E8F0' })
        .borderRadius(8)
      }, (task: NativeGrowthTask) => `${task.id}-${task.status}`)

      if (this.records.length > 0) {
        Column({ space: 8 }) {
          Row() {
            Text('证据账本')
              .fontSize(16)
              .fontWeight(FontWeight.Bold)
              .fontColor('#0F172A')
            Blank()
            Text(`${this.verifiedRecordCount()} 有效 / ${this.records.length} 条`)
              .fontSize(10)
              .fontColor('#0F766E')
          }
          .width('100%')
          Text('Network Kit 使用 HEAD 优先、流式 Range GET 降级核验公开 HTTPS；账本保留方式、时间和状态码，但不代表内容归属或第三方真实性认证。')
            .fontSize(10)
            .fontColor('#64748B')
            .lineHeight(17)
            .width('100%')
          ForEach(this.records.slice(0, 6), (record: NativeGrowthEvidenceRecord) => {
            Column({ space: 3 }) {
              Row() {
                Text(record.taskTitle)
                  .fontSize(11)
                  .fontWeight(FontWeight.Medium)
                  .fontColor('#334155')
                  .layoutWeight(1)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text(record.status === 'verified' ? '有效' : '已撤销')
                  .fontSize(9)
                  .fontColor(record.status === 'verified' ? '#047857' : '#B91C1C')
              }
              .width('100%')
              Text(`${record.submittedAt} · ${record.fingerprint}`)
                .fontSize(9)
                .fontColor('#94A3B8')
                .width('100%')
              Text(this.sourceVerificationMeta(record))
                .fontSize(9)
                .fontColor(record.sourceVerification === 'reachable' ? '#047857' : '#B45309')
                .width('100%')
              if (record.revokedAt) {
                Text(`撤销时间：${record.revokedAt}`)
                  .fontSize(9)
                  .fontColor('#B91C1C')
                  .width('100%')
              }
            }
            .width('100%')
            .padding({ top: 5, bottom: 5 })
          }, (record: NativeGrowthEvidenceRecord) => `${record.id}-${record.status}`)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding(16)
        .backgroundColor('#F8FAFC')
        .border({ width: 1, color: '#E2E8F0' })
        .borderRadius(8)
      }
    }
    .width('100%')
  }
}
