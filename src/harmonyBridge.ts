export type HuaweiAuthState = {
  nativeAvailable: boolean;
  signedIn: boolean;
  displayName: string;
  accountHint: string;
  message: string;
  errorCode?: number;
};

type KongMingNativeBridge = {
  getHuaweiAuthState: () => Promise<string>;
  loginWithHuawei: () => Promise<string>;
  logoutHuawei: () => Promise<string>;
  shareText: (payload: string) => Promise<string>;
  recognizeResumeImage: (dataUrl: string) => Promise<string>;
};

export type NativeActionResult = {
  nativeAvailable: boolean;
  ok: boolean;
  message: string;
  errorCode?: number;
};

export type NativeOcrResult = NativeActionResult & {
  text: string;
};

declare global {
  interface Window {
    kongmingNative?: KongMingNativeBridge;
  }
}

const unavailableState = (message = "华为账号登录仅在鸿蒙安装包中可用。") : HuaweiAuthState => ({
  nativeAvailable: false,
  signedIn: false,
  displayName: "",
  accountHint: "",
  message,
});

const parseNativeState = (payload: string): HuaweiAuthState => {
  try {
    const parsed = JSON.parse(payload) as Partial<HuaweiAuthState>;
    return {
      nativeAvailable: parsed.nativeAvailable === true,
      signedIn: parsed.signedIn === true,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      accountHint: typeof parsed.accountHint === "string" ? parsed.accountHint : "",
      message: typeof parsed.message === "string" ? parsed.message : "",
      errorCode: typeof parsed.errorCode === "number" ? parsed.errorCode : undefined,
    };
  } catch {
    return unavailableState("无法读取鸿蒙账号服务返回结果。");
  }
};

export const initialHuaweiAuthState: HuaweiAuthState = unavailableState("");

export async function getHuaweiAuthState(): Promise<HuaweiAuthState> {
  const bridge = window.kongmingNative;
  if (!bridge?.getHuaweiAuthState) return unavailableState();
  try {
    return parseNativeState(await bridge.getHuaweiAuthState());
  } catch {
    return unavailableState("鸿蒙账号服务暂时不可用。");
  }
}

export async function loginWithHuawei(): Promise<HuaweiAuthState> {
  const bridge = window.kongmingNative;
  if (!bridge?.loginWithHuawei) return unavailableState();
  try {
    return parseNativeState(await bridge.loginWithHuawei());
  } catch {
    return unavailableState("华为账号登录调用失败，请稍后重试。");
  }
}

export async function logoutHuawei(): Promise<HuaweiAuthState> {
  const bridge = window.kongmingNative;
  if (!bridge?.logoutHuawei) return unavailableState();
  try {
    return parseNativeState(await bridge.logoutHuawei());
  } catch {
    return unavailableState("退出孔明职配账号失败，请稍后重试。");
  }
}

const parseNativeAction = (payload: string): NativeActionResult => {
  try {
    const parsed = JSON.parse(payload) as Partial<NativeActionResult>;
    return {
      nativeAvailable: parsed.nativeAvailable === true,
      ok: parsed.ok === true,
      message: typeof parsed.message === "string" ? parsed.message : "",
      errorCode: typeof parsed.errorCode === "number" ? parsed.errorCode : undefined,
    };
  } catch {
    return { nativeAvailable: true, ok: false, message: "无法读取鸿蒙原生能力返回结果。" };
  }
};

export async function shareTextWithHarmony(title: string, content: string): Promise<NativeActionResult> {
  const bridge = window.kongmingNative;
  if (bridge?.shareText) {
    try {
      return parseNativeAction(await bridge.shareText(JSON.stringify({ title, content })));
    } catch {
      return { nativeAvailable: true, ok: false, message: "鸿蒙系统分享调用失败，请稍后重试。" };
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text: content });
      return { nativeAvailable: false, ok: true, message: "已打开浏览器分享面板。" };
    } catch {
      return { nativeAvailable: false, ok: false, message: "已取消分享，或当前浏览器无法完成分享。" };
    }
  }
  return { nativeAvailable: false, ok: false, message: "系统分享仅在鸿蒙安装包或支持 Web Share 的浏览器中可用。" };
}

export async function recognizeImageWithHarmony(dataUrl: string): Promise<NativeOcrResult> {
  const bridge = window.kongmingNative;
  if (!bridge?.recognizeResumeImage) {
    return { nativeAvailable: false, ok: false, text: "", message: "当前环境没有鸿蒙本机 OCR。" };
  }
  try {
    const parsed = JSON.parse(await bridge.recognizeResumeImage(dataUrl)) as Partial<NativeOcrResult>;
    return {
      nativeAvailable: parsed.nativeAvailable === true,
      ok: parsed.ok === true,
      text: typeof parsed.text === "string" ? parsed.text : "",
      message: typeof parsed.message === "string" ? parsed.message : "",
      errorCode: typeof parsed.errorCode === "number" ? parsed.errorCode : undefined,
    };
  } catch {
    return { nativeAvailable: true, ok: false, text: "", message: "无法读取鸿蒙本机 OCR 返回结果。" };
  }
}
