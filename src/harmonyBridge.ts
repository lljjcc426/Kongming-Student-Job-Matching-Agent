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
