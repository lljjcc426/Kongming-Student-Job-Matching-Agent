import { webview } from '@kit.ArkWeb';
import { authentication } from '@kit.AccountKit';
import { systemShare } from '@kit.ShareKit';
import { textRecognition } from '@kit.CoreVisionKit';
import { image } from '@kit.ImageKit';
import { util } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';

const CAMERA_PERMISSION: Permissions = 'ohos.permission.CAMERA';
const WEB_VIDEO_CAPTURE: string = 'TYPE_VIDEO_CAPTURE';

interface HuaweiAuthPayload {
  nativeAvailable: boolean;
  signedIn: boolean;
  displayName: string;
  accountHint: string;
  message: string;
  errorCode?: number;
}

class HuaweiAccountBridge {
  private signedIn: boolean = false;
  private accountHint: string = '';
  private context: common.UIAbilityContext;
  private controller: webview.WebviewController;

  constructor(context: common.UIAbilityContext, controller: webview.WebviewController) {
    this.context = context;
    this.controller = controller;
  }

  private serialize(message: string, errorCode?: number): string {
    const payload: HuaweiAuthPayload = {
      nativeAvailable: true,
      signedIn: this.signedIn,
      displayName: this.signedIn ? `华为用户 · ${this.accountHint}` : '',
      accountHint: this.accountHint,
      message,
      errorCode,
    };
    return JSON.stringify(payload);
  }

  private isTrustedCaller(): boolean {
    try {
      return this.controller.getLastJavascriptProxyCallingFrameUrl().startsWith('file://');
    } catch (error) {
      return false;
    }
  }

  async getHuaweiAuthState(): Promise<string> {
    if (!this.isTrustedCaller()) {
      return this.serialize('已拒绝非本地页面访问账号能力。');
    }
    return this.serialize(this.signedIn ? '华为账号已登录。' : '尚未登录华为账号。');
  }

  async loginWithHuawei(): Promise<string> {
    if (!this.isTrustedCaller()) {
      return this.serialize('已拒绝非本地页面调用华为账号登录。');
    }

    const requestState = `kongming_${Date.now()}`;
    try {
      const provider = new authentication.HuaweiIDProvider();
      const request = provider.createLoginWithHuaweiIDRequest();
      request.forceLogin = true;
      request.state = requestState;
      request.nonce = requestState;
      request.idTokenSignAlgorithm = authentication.IdTokenSignAlgorithm.PS256;

      const authController = new authentication.AuthenticationController(this.context);
      const response = await authController.executeRequest(request) as authentication.LoginWithHuaweiIDResponse;
      if (response.state !== requestState || !response.data?.openID) {
        return this.serialize('华为账号返回结果校验失败，请重试。');
      }

      const openID = response.data.openID;
      this.accountHint = openID.length > 6 ? openID.slice(openID.length - 6) : openID;
      this.signedIn = true;
      return this.serialize('华为账号登录成功。');
    } catch (error) {
      const businessError = error as BusinessError;
      if (businessError.code === authentication.AuthenticationErrorCode.USER_CANCELED) {
        return this.serialize('已取消华为账号登录。', businessError.code);
      }
      if (businessError.code === authentication.AuthenticationErrorCode.APP_NOT_AUTHORIZED) {
        return this.serialize('当前应用尚未在 AppGallery Connect 授权华为账号服务。', businessError.code);
      }
      if (businessError.code === authentication.AuthenticationErrorCode.PACKAGE_FINGERPRINT_CHECK_ERROR) {
        return this.serialize('应用签名指纹与 AppGallery Connect 配置不一致。', businessError.code);
      }
      console.error(`Huawei account login failed: ${businessError.code} ${businessError.message}`);
      return this.serialize('华为账号登录失败，请检查网络与应用配置。', businessError.code);
    }
  }

  async logoutHuawei(): Promise<string> {
    if (!this.isTrustedCaller()) {
      return this.serialize('已拒绝非本地页面访问账号能力。');
    }
    this.signedIn = false;
    this.accountHint = '';
    return this.serialize('已退出孔明职配账号；设备上的华为账号保持登录。');
  }

  async shareText(payload: string): Promise<string> {
    if (!this.isTrustedCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '已拒绝非本地页面调用系统分享。' });
    }

    try {
      const parsed = JSON.parse(payload) as Record<string, string>;
      const title = typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : '孔明职配分析报告';
      const content = typeof parsed.content === 'string' ? parsed.content.slice(0, 100000) : '';
      if (!content.trim()) {
        return JSON.stringify({ nativeAvailable: true, ok: false, message: '没有可分享的内容。' });
      }
      const data = new systemShare.SharedData({
        utd: 'general.plain-text',
        title,
        content,
      });
      const shareController = new systemShare.ShareController(data);
      await shareController.show(this.context, {});
      return JSON.stringify({ nativeAvailable: true, ok: true, message: '已打开鸿蒙系统分享面板。' });
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Harmony share failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, message: '鸿蒙系统分享暂时不可用。', errorCode: businessError.code });
    }
  }

  async recognizeResumeImage(dataUrl: string): Promise<string> {
    if (!this.isTrustedCaller()) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '已拒绝非本地页面调用本机 OCR。' });
    }
    if (!dataUrl.startsWith('data:image/') || dataUrl.length > 11000000) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '图片格式无效或超过本机 OCR 大小限制。' });
    }

    const separator = dataUrl.indexOf(',');
    if (separator < 0) {
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '无法读取图片数据。' });
    }

    let source: image.ImageSource | undefined = undefined;
    let pixelMap: image.PixelMap | undefined = undefined;
    try {
      const bytes = new util.Base64Helper().decodeSync(dataUrl.slice(separator + 1));
      source = image.createImageSource(bytes.buffer);
      pixelMap = await source.createPixelMap();
      const initialized = await textRecognition.init();
      if (!initialized) {
        return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: 'Core Vision OCR 初始化失败。' });
      }
      const result = await textRecognition.recognizeText({ pixelMap });
      const text = result.value.trim();
      return JSON.stringify({
        nativeAvailable: true,
        ok: text.length > 0,
        text,
        message: text.length > 0 ? '已使用 Core Vision 在本机完成文字识别。' : '本机 OCR 未识别到文字。',
      });
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Core Vision OCR failed: ${businessError.code} ${businessError.message}`);
      return JSON.stringify({ nativeAvailable: true, ok: false, text: '', message: '本机 OCR 暂时不可用。', errorCode: businessError.code });
    } finally {
      if (pixelMap) {
        await pixelMap.release().catch(() => {});
      }
      if (source) {
        await source.release().catch(() => {});
      }
      await textRecognition.release().catch(() => {});
    }
  }
}

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private uiContext: UIContext = this.getUIContext();
  private accountBridge: HuaweiAccountBridge = new HuaweiAccountBridge(
    this.uiContext.getHostContext() as common.UIAbilityContext,
    this.controller,
  );
  @State loadProgress: number = 0;
  @State loadMessage: string = '正在载入孔明职配…';

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Web({ src: '', controller: this.controller })
        .javaScriptAccess(true)
        .javaScriptProxy({
          object: this.accountBridge,
          name: 'kongmingNative',
          methodList: [],
          asyncMethodList: ['getHuaweiAuthState', 'loginWithHuawei', 'logoutHuawei', 'shareText', 'recognizeResumeImage'],
          controller: this.controller,
        })
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
