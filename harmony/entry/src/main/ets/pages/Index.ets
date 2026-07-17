import { webview } from '@kit.ArkWeb';
import { BusinessError } from '@kit.BasicServicesKit';
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';

const CAMERA_PERMISSION: Permissions = 'ohos.permission.CAMERA';
const WEB_VIDEO_CAPTURE: string = 'TYPE_VIDEO_CAPTURE';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private uiContext: UIContext = this.getUIContext();
  @State loadProgress: number = 0;
  @State loadMessage: string = '正在载入孔明职配…';

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Web({ src: '', controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .onlineImageAccess(true)
        .zoomAccess(false)
        .backgroundColor('#EAF4FF')
        .onControllerAttached(() => {
          try {
            const resourceDir = this.uiContext.getHostContext()!.resourceDir;
            this.controller.setPathAllowingUniversalAccess([resourceDir]);
            this.controller.loadUrl(`file://${resourceDir}/index.html`);
          } catch (error) {
            const businessError = error as BusinessError;
            this.loadMessage = `本地页面加载失败：${businessError.code}`;
            console.error(`ArkWeb local package load failed: ${businessError.code} ${businessError.message}`);
          }
        })
        .onProgressChange((event) => {
          this.loadProgress = event.newProgress;
          this.loadMessage = event.newProgress >= 100 ? '' : `正在载入孔明职配 · ${event.newProgress}%`;
        })
        .onPageEnd(() => {
          this.loadProgress = 100;
          this.loadMessage = '';
          this.controller.runJavaScript('window.scrollTo({ top: 0, left: 0, behavior: "instant" });')
            .catch((error: BusinessError) => {
              console.error(`ArkWeb initial scroll reset failed: ${error.code} ${error.message}`);
            });
        })
        .onPermissionRequest((event) => {
          const request = event.request;
          const requestedResources = request.getAccessibleResource();
          const isLocalPage = request.getOrigin().startsWith('file://');
          const isVideoOnly = requestedResources.length === 1 &&
            requestedResources[0] === WEB_VIDEO_CAPTURE;

          if (!isLocalPage || !isVideoOnly) {
            request.deny();
            return;
          }

          const context = this.uiContext.getHostContext() as common.UIAbilityContext;
          const accessManager = abilityAccessCtrl.createAtManager();
          accessManager.requestPermissionsFromUser(context, [CAMERA_PERMISSION])
            .then((result) => {
              if (result.authResults.length === 1 && result.authResults[0] === 0) {
                request.grant([WEB_VIDEO_CAPTURE]);
                return;
              }
              request.deny();
            })
            .catch((error: BusinessError) => {
              request.deny();
              console.error(`Camera permission request failed: ${error.code} ${error.message}`);
            });
        })
        .width('100%')
        .height('100%')

      if (this.loadProgress > 0 && this.loadProgress < 100) {
        Row({ space: 8 }) {
          LoadingProgress().width(16).height(16).color('#1677FF')
          Text(this.loadMessage).fontSize(11).fontColor('#0A3FA2')
        }
        .padding({ left: 12, right: 12, top: 8, bottom: 8 })
        .margin({ top: 10, left: 10 })
        .backgroundColor('#EFFFFFFF')
        .borderRadius(16)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#EAF4FF')
  }
}
