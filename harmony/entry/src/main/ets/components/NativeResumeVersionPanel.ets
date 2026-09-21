import { NativeResumeVersion } from '../common/NativeWorkspaceModel';

@Component
export struct NativeResumeVersionPanel {
  @Prop versions: NativeResumeVersion[] = [];
  @Prop currentJobKey: string = '';
  @Prop currentJobTitle: string = '';
  @Prop boundVersionId: string = '';
  @Prop message: string = '';
  onCreateVersion: () => void = () => {};
  onBindVersion: (versionId: string) => void = () => {};
  onDeleteVersion: (versionId: string) => void = () => {};

  build() {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 3 }) {
          Text('投递简历版本')
            .fontSize(17)
            .fontWeight(FontWeight.Bold)
            .fontColor('#0F172A')
          Text(this.currentJobKey ? `当前岗位：${this.currentJobTitle}` : '先保存真实岗位，再冻结投递版本')
            .fontSize(11)
            .fontColor('#64748B')
            .maxLines(2)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(`${this.versions.length} 版`)
          .fontSize(11)
          .fontColor('#1D4ED8')
          .padding({ left: 8, right: 8, top: 5, bottom: 5 })
          .backgroundColor('#DBEAFE')
          .borderRadius(8)
      }
      .width('100%')

      Text('每个版本保存当时的完整简历文本；后续修改画像不会覆盖已冻结内容。')
        .fontSize(11)
        .fontColor('#475569')
        .lineHeight(18)
        .width('100%')

      Button('保存并绑定当前投递版本')
        .width('100%')
        .height(42)
        .fontSize(12)
        .fontColor('#FFFFFF')
        .backgroundColor(this.currentJobKey ? '#2563EB' : '#94A3B8')
        .borderRadius(8)
        .enabled(Boolean(this.currentJobKey))
        .onClick(() => { this.onCreateVersion(); })

      Text(this.message)
        .fontSize(10)
        .fontColor('#64748B')
        .lineHeight(17)
        .width('100%')
        .padding(9)
        .backgroundColor('#F8FAFC')
        .border({ width: 1, color: '#E2E8F0' })
        .borderRadius(8)

      if (this.versions.length > 0) {
        ForEach(this.versions, (version: NativeResumeVersion) => {
          Column({ space: 7 }) {
            Row() {
              Column({ space: 2 }) {
                Text(version.name)
                  .fontSize(14)
                  .fontWeight(FontWeight.Bold)
                  .fontColor('#0F172A')
                  .maxLines(2)
                Text(`${version.jobTitle} · ${version.createdAt}`)
                  .fontSize(9)
                  .fontColor('#64748B')
                  .maxLines(2)
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              if (version.id === this.boundVersionId) {
                Text('当前绑定')
                  .fontSize(10)
                  .fontColor('#047857')
                  .padding({ left: 7, right: 7, top: 4, bottom: 4 })
                  .backgroundColor('#D1FAE5')
                  .borderRadius(8)
              }
            }
            .width('100%')
            Text(version.changeSummary)
              .fontSize(10)
              .fontColor('#475569')
              .lineHeight(17)
              .width('100%')
            Text(version.content)
              .fontSize(10)
              .fontColor('#64748B')
              .lineHeight(17)
              .maxLines(3)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .width('100%')
            Row({ space: 8 }) {
              if (version.jobKey === this.currentJobKey && version.id !== this.boundVersionId) {
                Button('绑定此版本')
                  .layoutWeight(1)
                  .height(36)
                  .fontSize(10)
                  .fontColor('#1D4ED8')
                  .backgroundColor('#DBEAFE')
                  .borderRadius(8)
                  .onClick(() => { this.onBindVersion(version.id); })
              }
              Button(version.id === this.boundVersionId ? '绑定中' : '删除版本')
                .layoutWeight(1)
                .height(36)
                .fontSize(10)
                .fontColor(version.id === this.boundVersionId ? '#64748B' : '#B91C1C')
                .backgroundColor(version.id === this.boundVersionId ? '#E2E8F0' : '#FEE2E2')
                .borderRadius(8)
                .enabled(version.id !== this.boundVersionId)
                .onClick(() => { this.onDeleteVersion(version.id); })
            }
            .width('100%')
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(13)
          .backgroundColor('#FFFFFF')
          .border({ width: 1, color: '#E2E8F0' })
          .borderRadius(8)
        }, (version: NativeResumeVersion) => version.id)
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }
}
