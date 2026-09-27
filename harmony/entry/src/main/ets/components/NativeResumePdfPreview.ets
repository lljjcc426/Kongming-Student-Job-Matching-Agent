import { NativeResumePdfPage } from '../common/NativeResumeLayoutService';

@Component
struct NativeResumePaper {
  @Prop page: NativeResumePdfPage = new NativeResumePdfPage();
  private drawing: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));

  private draw(): void {
    const scale = this.drawing.width / 595.28;
    this.drawing.clearRect(0, 0, this.drawing.width, this.drawing.height);
    this.drawing.fillStyle = '#FFFFFF';
    this.drawing.fillRect(0, 0, this.drawing.width, this.drawing.height);
    this.drawing.save();
    this.drawing.scale(scale, scale);
    this.drawing.textBaseline = 'alphabetic';
    for (const line of this.page.lines) {
      this.drawing.font = `${this.getUIContext().vp2px(line.size)}px HarmonyOS Sans SC`;
      this.drawing.fillStyle = `#${line.color.toString(16).padStart(6, '0')}`;
      this.drawing.fillText(line.text, line.left, 841.89 - line.baseline);
    }
    this.drawing.restore();
  }

  build() {
    Canvas(this.drawing)
      .width('100%')
      .aspectRatio(595.28 / 841.89)
      .onReady(() => { this.draw(); })
      .onAreaChange(() => { this.draw(); })
  }
}

@Component
export struct NativeResumePdfPreview {
  @Prop pages: NativeResumePdfPage[] = [];
  @Prop saving: boolean = false;
  @State zoom: number = 1;
  @State viewportWidth: number = 360;
  onBack: () => void = () => {};
  onSave: () => void = () => {};

  build() {
    Column({ space: 10 }) {
      Row({ space: 10 }) {
        Button() {
          SymbolGlyph($r('sys.symbol.chevron_left'))
            .fontSize(18)
            .fontColor([$r('app.color.km_text_secondary')])
        }
        .width(40)
        .height(40)
        .borderRadius(6)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .accessibilityText('返回投递检查')
        .enabled(!this.saving)
        .onClick(() => { this.onBack(); })
        Column({ space: 3 }) {
          Text('投递简历预览')
            .fontSize(16)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('app.color.km_text_primary'))
          Text(`A4 · ${this.pages.length} 页`)
            .fontSize(11)
            .fontColor($r('app.color.km_text_secondary'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Button(this.saving ? '正在保存' : '保存 PDF')
          .fontSize(12)
          .height(40)
          .borderRadius(6)
          .backgroundColor($r('app.color.km_primary_action'))
          .fontColor($r('app.color.km_text_on_primary'))
          .enabled(!this.saving)
          .onClick(() => { this.onSave(); })
      }
      .width('100%')
      .padding({ left: 16, right: 16 })
      Row({ space: 8 }) {
        Button() {
          SymbolGlyph($r('sys.symbol.minus'))
            .fontSize(16)
            .fontColor([$r('app.color.km_text_secondary')])
        }
        .width(36)
        .height(36)
        .borderRadius(6)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .accessibilityText('缩小简历')
        .enabled(this.zoom > 1)
        .onClick(() => { this.zoom = Math.max(1, this.zoom - 0.5); })
        Text(`${Math.round(this.zoom * 100)}%`)
          .fontSize(11)
          .width(45)
          .textAlign(TextAlign.Center)
          .fontColor($r('app.color.km_text_secondary'))
        Button() {
          SymbolGlyph($r('sys.symbol.plus'))
            .fontSize(16)
            .fontColor([$r('app.color.km_text_secondary')])
        }
        .width(36)
        .height(36)
        .borderRadius(6)
        .backgroundColor($r('app.color.km_surface_subtle'))
        .accessibilityText('放大简历')
        .enabled(this.zoom < 3)
        .onClick(() => { this.zoom = Math.min(3, this.zoom + 0.5); })
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
      Scroll() {
        Scroll() {
          Column({ space: 16 }) {
            ForEach(this.pages, (page: NativeResumePdfPage, index: number) => {
              NativeResumePaper({ page: this.pages[index] })
            }, (_page: NativeResumePdfPage, index: number) => `paper-${index}`)
          }
          .width('100%')
          .padding({ top: 8, bottom: 24 })
        }
        .width(Math.max(200, this.viewportWidth - 32) * this.zoom)
        .height('100%')
        .scrollable(ScrollDirection.Vertical)
        .scrollBar(BarState.Auto)
      }
      .width('100%')
      .layoutWeight(1)
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Auto)
    }
    .padding({ top: 12 })
    .width('100%')
    .layoutWeight(1)
    .onAreaChange((_oldArea: Area, newArea: Area) => { this.viewportWidth = Number(newArea.width); })
  }
}
