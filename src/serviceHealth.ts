export type ServiceHealthState = {
  status: "checking" | "ready" | "degraded" | "offline";
  jobsConfigured: boolean;
  modelConfigured: boolean;
  message: string;
  checkedAt: string;
};

type HealthPayload = {
  ok?: boolean;
  checkedAt?: string;
  services?: {
    jobs?: { configured?: boolean };
    model?: { configured?: boolean };
  };
};

const configuredJobsEndpoint = () => import.meta.env.VITE_JOBS_API_URL?.trim() || (window.location.protocol === "file:" ? "" : "/api/jobs");
const configuredModelEndpoint = () => import.meta.env.VITE_ARK_API_URL?.trim() || (window.location.protocol === "file:" ? "" : "/api/ark");

const deriveHealthEndpoint = () => {
  const configured = import.meta.env.VITE_HEALTH_API_URL?.trim();
  if (configured) return configured;
  if (window.location.protocol !== "file:") return "/api/health";
  const jobsEndpoint = configuredJobsEndpoint();
  const modelEndpoint = configuredModelEndpoint();
  const candidate = jobsEndpoint || modelEndpoint;
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    url.pathname = url.pathname.replace(/\/api\/(?:jobs|ark)\/?$/, "/api/health");
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
};

export const initialServiceHealth: ServiceHealthState = {
  status: "checking",
  jobsConfigured: Boolean(typeof window !== "undefined" && configuredJobsEndpoint()),
  modelConfigured: Boolean(typeof window !== "undefined" && configuredModelEndpoint()),
  message: "正在检查联网服务",
  checkedAt: "",
};

export async function checkServiceHealth(): Promise<ServiceHealthState> {
  const jobsConfigured = Boolean(configuredJobsEndpoint());
  const modelEndpointConfigured = Boolean(configuredModelEndpoint());
  const healthEndpoint = deriveHealthEndpoint();
  if (!healthEndpoint) {
    return {
      status: "offline",
      jobsConfigured,
      modelConfigured: modelEndpointConfigured,
      message: "当前安装包未配置公网服务；本地简历、已缓存岗位和投递版本仍可使用。",
      checkedAt: new Date().toISOString(),
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(healthEndpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as HealthPayload;
    if (!response.ok || !payload.ok) throw new Error("HEALTH_CHECK_FAILED");
    const serverJobsConfigured = payload.services?.jobs?.configured !== false;
    const serverModelConfigured = payload.services?.model?.configured === true;
    const ready = jobsConfigured && serverJobsConfigured && modelEndpointConfigured && serverModelConfigured;
    return {
      status: ready ? "ready" : "degraded",
      jobsConfigured: jobsConfigured && serverJobsConfigured,
      modelConfigured: modelEndpointConfigured && serverModelConfigured,
      message: ready
        ? "岗位与模型服务可用。"
        : serverModelConfigured ? "部分联网地址未配置；本地功能不受影响。" : "岗位服务可用，模型服务尚未配置或不可用。",
      checkedAt: payload.checkedAt || new Date().toISOString(),
    };
  } catch {
    return {
      status: jobsConfigured || modelEndpointConfigured ? "degraded" : "offline",
      jobsConfigured,
      modelConfigured: modelEndpointConfigured,
      message: "无法连接服务健康检查；继续使用本地数据，并可稍后重试联网功能。",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
