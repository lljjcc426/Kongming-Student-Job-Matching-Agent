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
            .fontColor($r('app.color.km_text_primary'))
          Text(this.currentJobKey ? `当前岗位：${this.currentJobTitle}` : '先保存真实岗位，再冻结投递版本')
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
            .maxLines(2)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Text(`${this.versions.length} 版`)
          .fontSize(11)
          .fontColor($r('app.color.km_info'))
          .padding({ left: 8, right: 8, top: 5, bottom: 5 })
          .backgroundColor($r('app.color.km_info_soft'))
          .borderRadius(8)
      }
      .width('100%')

      Text('每个版本保存当时的完整简历文本；后续修改画像不会覆盖已冻结内容。')
        .fontSize(11)
        .fontColor($r('app.color.km_text_muted'))
        .lineHeight(18)
        .width('100%')

      Button('保存并绑定当前投递版本')
        .width('100%')
        .constraintSize({ minHeight: 42 })
        .fontSize(12)
        .fontColor($r('app.color.km_text_on_primary'))
        .backgroundColor(this.currentJobKey ? $r('app.color.km_primary_action') : $r('app.color.km_disabled'))
        .borderRadius(8)
        .enabled(Boolean(this.currentJobKey))
        .onClick(() => { this.onCreateVersion(); })

      Text(this.message)
        .fontSize(10)
        .fontColor($r('app.color.km_text_secondary'))
        .lineHeight(17)
        .width('100%')
        .padding(9)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)

      if (this.versions.length > 0) {
        ForEach(this.versions, (version: NativeResumeVersion) => {
          Column({ space: 7 }) {
            Row() {
              Column({ space: 2 }) {
                Text(version.name)
                  .fontSize(14)
                  .fontWeight(FontWeight.Bold)
                  .fontColor($r('app.color.km_text_primary'))
                  .maxLines(2)
                Text(`${version.jobTitle} · ${version.createdAt}`)
                  .fontSize(9)
                  .fontColor($r('app.color.km_text_secondary'))
                  .maxLines(2)
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              if (version.id === this.boundVersionId) {
                Text('当前绑定')
                  .fontSize(10)
                  .fontColor($r('app.color.km_success'))
                  .padding({ left: 7, right: 7, top: 4, bottom: 4 })
                  .backgroundColor($r('app.color.km_success_soft'))
                  .borderRadius(8)
              }
            }
            .width('100%')
            Text(version.changeSummary)
              .fontSize(10)
              .fontColor($r('app.color.km_text_muted'))
              .lineHeight(17)
              .width('100%')
            Text(version.content)
              .fontSize(10)
              .fontColor($r('app.color.km_text_secondary'))
              .lineHeight(17)
              .maxLines(3)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .width('100%')
            Row({ space: 8 }) {
              if (version.jobKey === this.currentJobKey && version.id !== this.boundVersionId) {
                Button('绑定此版本')
                  .layoutWeight(1)
                  .constraintSize({ minHeight: 36 })
                  .fontSize(10)
                  .fontColor($r('app.color.km_info'))
                  .backgroundColor($r('app.color.km_info_soft'))
                  .borderRadius(8)
                  .onClick(() => { this.onBindVersion(version.id); })
              }
              Button(version.id === this.boundVersionId ? '绑定中' : '删除版本')
                .layoutWeight(1)
                .constraintSize({ minHeight: 36 })
                .fontSize(10)
                .fontColor(version.id === this.boundVersionId ? $r('app.color.km_text_secondary') : $r('app.color.km_danger'))
                .backgroundColor(version.id === this.boundVersionId ? $r('app.color.km_disabled_soft') : $r('app.color.km_danger_soft'))
                .borderRadius(8)
                .enabled(version.id !== this.boundVersionId)
                .onClick(() => { this.onDeleteVersion(version.id); })
            }
            .width('100%')
          }
          .alignItems(HorizontalAlign.Start)
          .width('100%')
          .padding(13)
          .backgroundColor($r('app.color.km_surface'))
          .border({ width: 1, color: $r('app.color.km_border') })
          .borderRadius(8)
        }, (version: NativeResumeVersion) => version.id)
      }
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }
}
