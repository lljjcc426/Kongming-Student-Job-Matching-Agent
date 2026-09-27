import { NativeJobMaterialService, NativeMaterialCheck } from '../common/NativeJobMaterialService';
import { NativeJobMaterialRecord, NativeJobStory } from '../common/NativeWorkspaceModel';

@Component
struct NativeJobStoryEditor {
  @Prop story: NativeJobStory = new NativeJobStory();
  @Prop requirements: string[] = [];
  private materialService: NativeJobMaterialService = new NativeJobMaterialService();
  onStoryChange: (storyId: string, field: string, value: string) => void = () => {};
  onDeleteStory: (storyId: string) => void = () => {};

  @Builder
  private buildStoryField(story: NativeJobStory, field: string, label: string, value: string, hint: string): void {
    Column({ space: 5 }) {
      Text(label)
        .fontSize(11)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.km_text_primary'))
      TextArea({ text: value, placeholder: hint })
        .width('100%')
        .height(90)
        .fontSize(12)
        .fontColor($r('app.color.km_text_primary'))
        .backgroundColor($r('app.color.km_surface_subtle'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(6)
        .accessibilityText(`${story.title || '案例'} ${label}`)
        .onChange((content: string) => { this.onStoryChange(story.id, field, content); })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  build() {
    Column({ space: 10 }) {
      Row({ space: 8 }) {
        Text(`案例 · ${this.materialService.storyCompletedFields(this.story)}/5 项已填写`)
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.km_teal'))
          .layoutWeight(1)
        Button() {
          SymbolGlyph($r('sys.symbol.trash'))
            .fontSize(17)
            .fontColor([$r('app.color.km_danger')])
        }
        .width(36)
        .height(36)
        .backgroundColor($r('app.color.km_danger_soft'))
        .borderRadius(6)
        .accessibilityText(`删除案例 ${this.story.title}`)
        .onClick(() => { this.onDeleteStory(this.story.id); })
      }
      .width('100%')
      TextInput({ text: this.story.title, placeholder: '案例名称' })
        .height(42)
        .fontSize(13)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .borderRadius(6)
        .accessibilityText('案例名称')
        .onChange((value: string) => { this.onStoryChange(this.story.id, 'title', value); })
      Text('对应岗位要求')
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
      Select(this.requirements.map((requirement: string): SelectOption => { return { value: requirement }; }))
        .value(this.story.requirement || '选择岗位要求')
        .font({ size: 12 })
        .height(38)
        .onSelect((_index: number, value: string) => { this.onStoryChange(this.story.id, 'requirement', value); })
      if (this.story.sourceAnswer) {
        Column({ space: 5 }) {
          Text('来自已完成面试的原回答')
            .fontSize(10)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_info'))
          Text(this.story.sourceQuestion)
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
          Text(this.story.sourceAnswer)
            .fontSize(11)
            .lineHeight(18)
            .fontColor($r('app.color.km_text_primary'))
            .copyOption(CopyOptions.LocalDevice)
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        .padding({ top: 8, bottom: 8 })
        .border({ width: { top: 1, bottom: 1 }, color: $r('app.color.km_border') })
      }
      this.buildStoryField(this.story, 'situation', '背景 S', this.story.situation, '项目场景、遇到的问题和约束')
      this.buildStoryField(this.story, 'task', '任务 T', this.story.task, '你的具体职责与目标')
      this.buildStoryField(this.story, 'action', '行动 A', this.story.action, '你亲自做了什么，为什么选择这个方案')
      this.buildStoryField(this.story, 'result', '结果 R', this.story.result, '真实结果、指标口径与复盘')
      this.buildStoryField(this.story, 'evidence', '支持证据', this.story.evidence, '项目链接、作品、报告或可说明的验证方法')
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(14)
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: $r('app.color.km_border') })
    .borderRadius(8)
  }
}

@Component
export struct NativeJobMaterialWorkspace {
  @Prop material: NativeJobMaterialRecord = new NativeJobMaterialRecord();
  @Prop jobTitle: string = '';
  @Prop company: string = '';
  @Prop requirements: string[] = [];
  @Prop boundVersionName: string = '';
  @Prop dirty: boolean = false;
  @Prop saving: boolean = false;
  @Prop message: string = '';
  @Prop resumeError: string = '';
  @Prop horizontalPadding: number = 16;
  @Prop contentMaxWidth: number = 920;
  @Prop checks: NativeMaterialCheck[] = [];
  @Link section: number;
  @State changesExpanded: boolean = false;
  private materialService: NativeJobMaterialService = new NativeJobMaterialService();
  onBack: () => void = () => {};
  onSave: () => void = () => {};
  onFreeze: () => void = () => {};
  onExport: () => void = () => {};
  onPreviewPdf: () => void = () => {};
  onIdentityChange: (field: string, value: string) => void = () => {};
  onConfirmResume: (confirmed: boolean) => void = () => {};
  onResetResume: () => void = () => {};
  onResumeChange: (content: string) => void = () => {};
  onAddStory: (requirement: string) => void = () => {};
  onImportStory: () => void = () => {};
  onStoryChange: (storyId: string, field: string, value: string) => void = () => {};
  onDeleteStory: (storyId: string) => void = () => {};

  @Builder
  private buildResume(): void {
    Column({ space: 10 }) {
      Text('简历姓名')
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
      TextInput({ text: this.material.candidateName, placeholder: '实际投递时使用的姓名' })
        .height(42)
        .fontSize(13)
        .maxLength(64)
        .borderRadius(6)
        .backgroundColor($r('app.color.km_surface'))
        .accessibilityText('投递简历姓名')
        .onChange((value: string) => { this.onIdentityChange('candidateName', value); })
      Text('联系方式')
        .fontSize(11)
        .fontColor($r('app.color.km_text_secondary'))
      TextInput({ text: this.material.contact, placeholder: '电话、邮箱，可补充作品链接' })
        .height(42)
        .fontSize(13)
        .maxLength(200)
        .borderRadius(6)
        .backgroundColor($r('app.color.km_surface'))
        .accessibilityText('投递简历联系方式')
        .onChange((value: string) => { this.onIdentityChange('contact', value); })
      Row({ space: 8 }) {
        Text('岗位专属草稿')
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
          .layoutWeight(1)
        Button('载入当前画像')
          .fontSize(10)
          .height(34)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .fontColor($r('app.color.km_text_secondary'))
          .borderRadius(6)
          .onClick(() => { this.onResetResume(); })
      }
      .width('100%')
      TextArea({ text: this.material.resumeContent, placeholder: '填写本岗位实际准备投递的简历正文' })
        .width('100%')
        .height(300)
        .fontSize(13)
        .fontColor($r('app.color.km_text_primary'))
        .backgroundColor($r('app.color.km_surface'))
        .border({ width: 1, color: $r('app.color.km_border') })
        .borderRadius(8)
        .accessibilityText('岗位专属简历草稿')
        .onChange((content: string) => { this.onResumeChange(content); })
      if (this.resumeError) {
        Text(this.resumeError)
          .fontSize(11)
          .fontColor($r('app.color.km_danger'))
      }
      Row() {
        Text(`${this.material.resumeContent.trim().length} 字`)
          .fontSize(10)
          .fontColor($r('app.color.km_text_tertiary'))
        Blank()
        Text(this.boundVersionName ? `已绑定：${this.boundVersionName}` : '尚未绑定投递版本')
          .fontSize(10)
          .fontColor($r('app.color.km_text_secondary'))
          .maxLines(2)
          .constraintSize({ maxWidth: '75%' })
      }
      .width('100%')
      Button() {
        Row({ space: 8 }) {
          Text(this.materialService.resumeChanges(this.material.baseResumeContent, this.material.resumeContent).changed
            ? `相对起始正文：新增 ${this.materialService.resumeChanges(this.material.baseResumeContent, this.material.resumeContent).added.length} 段，移除 ${this.materialService.resumeChanges(this.material.baseResumeContent, this.material.resumeContent).removed.length} 段`
            : '正文与起始版本一致')
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
            .layoutWeight(1)
          SymbolGlyph($r('sys.symbol.chevron_right'))
            .fontSize(12)
            .fontColor([$r('app.color.km_text_tertiary')])
            .rotate({ angle: this.changesExpanded ? 90 : 0 })
        }
      }
      .width('100%')
      .constraintSize({ minHeight: 40 })
      .padding(9)
      .backgroundColor($r('app.color.km_surface_subtle'))
      .borderRadius(6)
      .onClick(() => { this.changesExpanded = !this.changesExpanded; })
      if (this.changesExpanded) {
        ForEach(this.materialService.resumeChanges(this.material.baseResumeContent, this.material.resumeContent).removed,
          (line: string, index: number) => {
            Text(`移除：${line}`)
              .fontSize(11)
              .lineHeight(18)
              .fontColor($r('app.color.km_danger'))
              .width('100%')
          }, (line: string, index: number) => `removed-${index}-${line}`)
        ForEach(this.materialService.resumeChanges(this.material.baseResumeContent, this.material.resumeContent).added,
          (line: string, index: number) => {
            Text(`新增：${line}`)
              .fontSize(11)
              .lineHeight(18)
              .fontColor($r('app.color.km_success'))
              .width('100%')
          }, (line: string, index: number) => `added-${index}-${line}`)
      }
      Button('冻结并绑定此草稿')
        .width('100%')
        .constraintSize({ minHeight: 44 })
        .fontSize(12)
        .fontColor($r('app.color.km_text_on_primary'))
        .backgroundColor($r('app.color.km_primary_action'))
        .borderRadius(8)
        .enabled(!this.saving)
        .onClick(() => { this.onFreeze(); })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildStories(): void {
    Column({ space: 12 }) {
      Row({ space: 8 }) {
        Text(`项目与故事 · ${this.material.stories.length}`)
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
          .layoutWeight(1)
        Button('导入面试原回答')
          .fontSize(10)
          .constraintSize({ minHeight: 36 })
          .fontColor($r('app.color.km_info'))
          .backgroundColor($r('app.color.km_info_soft'))
          .borderRadius(6)
          .onClick(() => { this.onImportStory(); })
      }
      .width('100%')
      ForEach(this.requirements, (requirement: string) => {
        Row({ space: 8 }) {
          Text(requirement)
            .fontSize(11)
            .fontColor($r('app.color.km_text_primary'))
            .layoutWeight(1)
          Text(`${this.material.stories.filter((story: NativeJobStory) => story.requirement === requirement).length} 个案例`)
            .fontSize(10)
            .fontColor($r('app.color.km_text_tertiary'))
          Button() {
            SymbolGlyph($r('sys.symbol.plus'))
              .fontSize(14)
              .fontColor([$r('app.color.km_primary_action')])
          }
          .width(34)
          .height(34)
          .backgroundColor($r('app.color.km_primary_soft'))
          .borderRadius(6)
          .accessibilityText(`为${requirement}新增案例`)
          .onClick(() => { this.onAddStory(requirement); })
        }
        .width('100%')
        .padding({ top: 5, bottom: 5 })
        .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
      }, (requirement: string) => requirement)
      if (this.material.stories.length === 0) {
        Text('尚未整理项目案例')
          .fontSize(13)
          .fontColor($r('app.color.km_text_secondary'))
          .width('100%')
          .padding({ top: 20, bottom: 20 })
          .textAlign(TextAlign.Center)
      }
      ForEach(this.material.stories, (story: NativeJobStory, index: number) => {
        NativeJobStoryEditor({
          story: this.material.stories[index],
          requirements: this.requirements,
          onStoryChange: this.onStoryChange,
          onDeleteStory: this.onDeleteStory,
        })
      }, (story: NativeJobStory) => story.id)
      Button('新增项目案例')
        .width('100%')
        .constraintSize({ minHeight: 42 })
        .fontSize(12)
        .fontColor($r('app.color.km_primary_action'))
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(8)
        .onClick(() => { this.onAddStory(this.requirements[0] || '责任边界与成果证据'); })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  @Builder
  private buildPreflight(): void {
    Column({ space: 14 }) {
      Text(this.checks.some((check: NativeMaterialCheck) => check.state === 'block')
        ? `还有 ${this.checks.filter((check: NativeMaterialCheck) => check.state === 'block').length} 项需处理`
        : '可以预览投递简历')
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.km_text_primary'))
      ForEach(this.checks, (check: NativeMaterialCheck) => {
        Row({ space: 10 }) {
          SymbolGlyph(check.state === 'pass' ? $r('sys.symbol.checkmark_circle') : $r('sys.symbol.exclamationmark_circle'))
            .fontSize(18)
            .fontColor([check.state === 'pass' ? $r('app.color.km_teal') : $r('app.color.km_warning')])
          Column({ space: 5 }) {
            Text(check.label)
              .fontSize(12)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
            Text(check.detail)
              .fontSize(11)
              .lineHeight(17)
              .fontColor($r('app.color.km_text_secondary'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          if (check.state !== 'pass' && check.action) {
            Button(check.action === 'save' ? '保存' : (check.action === 'freeze' ? '绑定版本' : '去完善'))
              .fontSize(10)
              .height(34)
              .borderRadius(6)
              .backgroundColor($r('app.color.km_primary_soft'))
              .fontColor($r('app.color.km_primary_action'))
              .enabled(!this.saving)
              .onClick(() => {
                if (check.action === 'save') this.onSave();
                else if (check.action === 'freeze') this.onFreeze();
                else this.section = check.action === 'stories' ? 1 : 0;
              })
          }
        }
        .width('100%')
        .padding({ top: 10, bottom: 10 })
        .border({ width: { bottom: 1 }, color: $r('app.color.km_border') })
      }, (check: NativeMaterialCheck) => `${check.id}-${check.state}-${check.detail}`)
      Row({ space: 8 }) {
        Checkbox()
          .select(this.materialService.isResumeConfirmed(this.material))
          .selectedColor($r('app.color.km_teal'))
          .enabled(!this.saving)
          .accessibilityText('确认简历经历与联系方式真实准确')
          .onChange((selected: boolean) => { this.onConfirmResume(selected); })
        Text('我已核对本次简历，经历与联系方式真实准确')
          .fontSize(12)
          .lineHeight(19)
          .fontColor($r('app.color.km_text_primary'))
          .layoutWeight(1)
      }
      .width('100%')
      Button(this.saving ? '正在处理' : '预览投递简历 PDF')
        .width('100%')
        .height(44)
        .fontSize(12)
        .borderRadius(8)
        .backgroundColor($r('app.color.km_primary_action'))
        .fontColor($r('app.color.km_text_on_primary'))
        .enabled(!this.saving && !this.checks.some((check: NativeMaterialCheck) => check.state === 'block'))
        .onClick(() => { this.onPreviewPdf(); })
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }

  build() {
    Scroll() {
      Column({ space: 14 }) {
        Row({ space: 8 }) {
          Button() {
            Row({ space: 5 }) {
              SymbolGlyph($r('sys.symbol.chevron_right'))
                .fontSize(13)
                .rotate({ angle: 180 })
                .fontColor([$r('app.color.km_text_secondary')])
              Text('返回岗位')
                .fontSize(11)
                .fontColor($r('app.color.km_text_secondary'))
            }
          }
          .height(36)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .borderRadius(6)
          .onClick(() => { this.onBack(); })
          Blank()
          Button('导出准备材料')
            .height(36)
            .fontSize(11)
            .fontColor($r('app.color.km_info'))
            .backgroundColor($r('app.color.km_info_soft'))
            .borderRadius(6)
            .enabled(!this.saving)
            .onClick(() => { this.onExport(); })
        }
        .width('100%')
        Column({ space: 4 }) {
          Text('投递材料工作台')
            .fontSize(21)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(`${this.company} · ${this.jobTitle}`)
            .fontSize(13)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
        Row({ space: 6 }) {
          Button('投递简历')
            .layoutWeight(1)
            .height(40)
            .fontSize(12)
            .fontColor(this.section === 0 ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_secondary'))
            .backgroundColor(this.section === 0 ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
            .borderRadius(6)
            .onClick(() => { this.section = 0; })
          Button('项目与故事')
            .layoutWeight(1)
            .height(40)
            .fontSize(12)
            .fontColor(this.section === 1 ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_secondary'))
            .backgroundColor(this.section === 1 ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
            .borderRadius(6)
            .onClick(() => { this.section = 1; })
          Button('投递检查')
            .layoutWeight(1)
            .height(40)
            .fontSize(12)
            .fontColor(this.section === 2 ? $r('app.color.km_text_on_primary') : $r('app.color.km_text_secondary'))
            .backgroundColor(this.section === 2 ? $r('app.color.km_primary_action') : $r('app.color.km_surface_subtle'))
            .borderRadius(6)
            .onClick(() => { this.section = 2; })
        }
        .width('100%')
        if (this.section === 0) {
          this.buildResume()
        } else if (this.section === 1) {
          this.buildStories()
        } else {
          this.buildPreflight()
        }
        Button(this.saving ? '正在保存' : (this.dirty ? '保存岗位材料' : '材料已保存'))
          .width('100%')
          .constraintSize({ minHeight: 44 })
          .fontSize(12)
          .fontColor($r('app.color.km_text_on_primary'))
          .backgroundColor(this.dirty ? $r('app.color.km_teal') : $r('app.color.km_disabled'))
          .borderRadius(8)
          .enabled(this.dirty && !this.saving)
          .onClick(() => { this.onSave(); })
        if (this.message) {
          Text(this.message)
            .fontSize(11)
            .lineHeight(18)
            .fontColor($r('app.color.km_text_secondary'))
            .width('100%')
        }
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .constraintSize({ maxWidth: this.contentMaxWidth })
      .enabled(!this.saving)
      .alignSelf(ItemAlign.Center)
      .padding({ left: this.horizontalPadding, right: this.horizontalPadding, top: 14, bottom: 24 })
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
  }
}
