import {
  NativeApplicationListItem,
  NativeApplicationFilter,
  NativeApplicationWorkspaceService,
} from '../common/NativeApplicationWorkspaceService';

@Component
export struct NativeApplicationWorkspace {
  @Prop items: NativeApplicationListItem[] = [];
  @Prop activeJobKey: string = '';
  @Prop now: number = 0;
  @Link search: string;
  @Link stage: string;
  @Link sort: string;
  private service: NativeApplicationWorkspaceService = new NativeApplicationWorkspaceService();
  private sortIds: string[] = ['schedule', 'recent', 'company'];
  private sortLabels: string[] = ['按日程', '最近更新', '按公司'];
  onSelectJob: (key: string) => void = () => {};
  onNewJob: () => void = () => {};
  onDiscover: () => void = () => {};
  onCompare: () => void = () => {};
  onSearchEditing: (editing: boolean) => void = () => {};

  private visibleItems(): NativeApplicationListItem[] {
    return this.service.query(this.items, this.search, this.stage, this.sort, this.now);
  }

  private stageIndex(): number {
    return Math.max(0, this.service.filters(this.items).findIndex((filter: NativeApplicationFilter) => filter.id === this.stage));
  }

  private clearFilters(): void {
    this.search = '';
    this.stage = 'all';
  }

  @Builder
  private buildCount(label: string, stage: string): void {
    Button() {
      Column({ space: 5 }) {
        Text(`${this.service.count(this.items, stage)}`)
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(stage === 'offer' ? $r('app.color.km_teal') : $r('app.color.km_text_primary'))
        Text(label)
          .fontSize(11)
          .fontColor(this.stage === stage ? $r('app.color.km_primary_action') : $r('app.color.km_text_secondary'))
      }
      .width('100%')
      .padding({ top: 10, bottom: 12 })
      .border({ width: { bottom: this.stage === stage ? 2 : 1 },
        color: this.stage === stage ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
    }
    .layoutWeight(1)
    .backgroundColor(Color.Transparent)
    .borderRadius(0)
    .accessibilityText(`${label} ${this.service.count(this.items, stage)} 个岗位`)
    .onClick(() => { this.stage = stage; })
  }

  @Builder
  private buildJob(item: NativeApplicationListItem): void {
    Button() {
      Column({ space: 9 }) {
        Row({ space: 8 }) {
          Column({ space: 4 }) {
            Text(item.record.company || '未填写公司')
              .fontSize(11)
              .fontColor($r('app.color.km_text_secondary'))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            Text(item.record.title)
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor($r('app.color.km_text_primary'))
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(this.service.stageLabel(item.record.applicationStage))
            .fontSize(10)
            .fontColor(item.record.applicationStage === 'offer' ? $r('app.color.km_teal') : $r('app.color.km_text_secondary'))
            .padding({ left: 8, right: 8, top: 5, bottom: 5 })
            .backgroundColor(item.record.applicationStage === 'offer' ? $r('app.color.km_teal_soft') : $r('app.color.km_surface_subtle'))
            .borderRadius(4)
          SymbolGlyph($r('sys.symbol.chevron_right'))
            .fontSize(13)
            .fontColor([$r('app.color.km_text_tertiary')])
        }
        .alignItems(VerticalAlign.Top)
        .width('100%')
        if (this.service.schedule(item.record, this.now).label) {
          Row({ space: 6 }) {
            SymbolGlyph($r('sys.symbol.clock'))
              .fontSize(12)
              .fontColor([this.service.schedule(item.record, this.now).overdue ? $r('app.color.km_warning') : $r('app.color.km_info')])
            Text(this.service.schedule(item.record, this.now).label)
              .fontSize(11)
              .fontColor(this.service.schedule(item.record, this.now).overdue ? $r('app.color.km_warning') : $r('app.color.km_info'))
              .maxLines(2)
              .layoutWeight(1)
          }
          .width('100%')
        }
        Row({ space: 8 }) {
          Text(this.service.schedule(item.record, this.now).overdue ? '核对岗位状态并更新日程' : item.nextAction)
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
          Text(`准备 ${item.readiness}/5`)
            .fontSize(10)
            .fontColor(item.readiness === 5 ? $r('app.color.km_success') : $r('app.color.km_text_tertiary'))
          if (item.record.key === this.activeJobKey) {
            Text('当前')
              .fontSize(10)
              .fontColor($r('app.color.km_primary_action'))
          }
        }
        .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .padding(14)
    }
    .width('100%')
    .backgroundColor($r('app.color.km_surface'))
    .border({ width: 1, color: item.record.key === this.activeJobKey ? $r('app.color.km_primary_action') : $r('app.color.km_border') })
    .borderRadius(8)
    .accessibilityText(`查看投递详情 ${item.record.company} ${item.record.title}`)
    .onClick(() => { this.onSelectJob(item.record.key); })
  }

  build() {
    Column({ space: 12 }) {
      Row({ space: 8 }) {
        Text('我的投递')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.km_text_primary'))
          .layoutWeight(1)
        if (this.items.length >= 2) {
          Button() {
            SymbolGlyph($r('sys.symbol.square_grid_2x2'))
              .fontSize(17)
              .fontColor([$r('app.color.km_text_secondary')])
          }
          .width(38)
          .height(38)
          .backgroundColor($r('app.color.km_surface_subtle'))
          .borderRadius(6)
          .accessibilityText('对比岗位')
          .onClick(() => { this.onCompare(); })
        }
        Button() {
          Row({ space: 5 }) {
            SymbolGlyph($r('sys.symbol.plus'))
              .fontSize(13)
              .fontColor([$r('app.color.km_primary_action')])
            Text('新增岗位')
              .fontSize(11)
              .fontColor($r('app.color.km_primary_action'))
          }
        }
        .height(38)
        .padding({ left: 10, right: 10 })
        .backgroundColor($r('app.color.km_primary_soft'))
        .borderRadius(6)
        .onClick(() => { this.onNewJob(); })
      }
      .width('100%')
      if (this.items.length > 0) {
        Row() {
          this.buildCount('全部', 'all')
          this.buildCount('进行中', 'active')
          this.buildCount('Offer', 'offer')
          this.buildCount('已结束', 'closed')
        }
        .width('100%')
        Search({ value: this.search, placeholder: '搜索公司、岗位或技能' })
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
          Select(this.service.filters(this.items).map((filter: NativeApplicationFilter): SelectOption => { return { value: filter.label }; }))
            .selected(this.stageIndex())
            .value(this.service.filters(this.items)[this.stageIndex()].label)
            .font({ size: 12 })
            .height(38)
            .borderRadius(6)
            .layoutWeight(1)
            .onSelect((index: number) => { this.stage = this.service.filters(this.items)[index].id; })
          Select(this.sortLabels.map((label: string): SelectOption => { return { value: label }; }))
            .selected(this.sortIds.indexOf(this.sort))
            .value(this.sortLabels[this.sortIds.indexOf(this.sort)])
            .font({ size: 12 })
            .height(38)
            .borderRadius(6)
            .onSelect((index: number) => { this.sort = this.sortIds[index]; })
        }
        .width('100%')
        Text(`${this.visibleItems().length} 个岗位`)
          .fontSize(11)
          .fontColor($r('app.color.km_text_tertiary'))
          .width('100%')
        if (this.visibleItems().length === 0) {
          Column({ space: 12 }) {
            SymbolGlyph($r('sys.symbol.magnifyingglass'))
              .fontSize(26)
              .fontColor([$r('app.color.km_text_tertiary')])
            Text('没有符合条件的岗位')
              .fontSize(14)
              .fontColor($r('app.color.km_text_secondary'))
            Button('清除筛选')
              .height(38)
              .fontSize(12)
              .fontColor($r('app.color.km_primary_action'))
              .backgroundColor($r('app.color.km_primary_soft'))
              .borderRadius(6)
              .onClick(() => { this.clearFilters(); })
          }
          .width('100%')
          .padding({ top: 34, bottom: 34 })
        } else {
          ForEach(this.visibleItems(), (item: NativeApplicationListItem) => {
            this.buildJob(item)
          }, (item: NativeApplicationListItem) => item.record.key)
        }
      } else {
        Column({ space: 14 }) {
          SymbolGlyph($r('sys.symbol.briefcase'))
            .fontSize(30)
            .fontColor([$r('app.color.km_text_tertiary')])
          Text('还没有保存的岗位')
            .fontSize(15)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.km_text_primary'))
          Button('发现岗位')
            .height(42)
            .fontSize(13)
            .fontColor($r('app.color.km_text_on_primary'))
            .backgroundColor($r('app.color.km_primary_action'))
            .borderRadius(6)
            .onClick(() => { this.onDiscover(); })
        }
        .width('100%')
        .padding({ top: 46, bottom: 46 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
