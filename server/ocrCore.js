import { createHash, createHmac } from "node:crypto";
import { runLocalOcr } from "./localOcrWorker.js";
import { readBoundedIntegerEnv } from "./runtimeConfig.js";

const MAX_IMAGE_DATA_URL_CHARS = 2_000_000;
const VOLC_HOST = "visual.volcengineapi.com";
const VOLC_REGION = "cn-north-1";
const VOLC_SERVICE = "cv";
const VOLC_ACTION = "MultiLanguageOCR";
const VOLC_VERSION = "2022-08-31";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const encodeQuery = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const normalizePolygon = (rect) => {
  if (!Array.isArray(rect) || rect.length !== 4) return null;
  const polygon = rect.map((point) => {
    if (Array.isArray(point) && point.length >= 2) return [Number(point[0]), Number(point[1])];
    if (point && typeof point === "object") return [Number(point.x ?? point.X), Number(point.y ?? point.Y)];
    return [Number.NaN, Number.NaN];
  });
  return polygon.every((point) => point.every(Number.isFinite)) ? polygon : null;
};

const normalizeResult = (result, pageNumber, provider) => ({
  provider,
  page: {
    pageNumber,
    width: Number(result.width) || 1,
    height: Number(result.height) || 1,
    lines: Array.isArray(result.lines) ? result.lines
      .map((line) => ({
        text: typeof line.text === "string" ? line.text.trim() : "",
        score: Math.max(0, Math.min(1, Number(line.score) || 0)),
        polygon: normalizePolygon(line.polygon),
      }))
      .filter((line) => line.text && line.polygon) : [],
  },
});

const volcAuthorization = ({ accessKey, secretKey, body, date }) => {
  const dateStamp = date.slice(0, 8);
  const query = `Action=${encodeQuery(VOLC_ACTION)}&Version=${encodeQuery(VOLC_VERSION)}`;
  const payloadHash = sha256(body);
  const canonicalHeaders = [
    "content-type:application/x-www-form-urlencoded",
    `host:${VOLC_HOST}`,
    `x-content-sha256:${payloadHash}`,
    `x-date:${date}`,
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalRequest = ["POST", "/", query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${VOLC_REGION}/${VOLC_SERVICE}/request`;
  const stringToSign = ["HMAC-SHA256", date, scope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(secretKey, dateStamp);
  const regionKey = hmac(dateKey, VOLC_REGION);
  const serviceKey = hmac(regionKey, VOLC_SERVICE);
  const signingKey = hmac(serviceKey, "request");
  const signature = hmac(signingKey, stringToSign, "hex");
  return {
    authorization: `HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    payloadHash,
    query,
  };
};

const runVolcengineOcr = async (imageDataUrl) => {
  const accessKey = process.env.VOLC_OCR_ACCESS_KEY;
  const secretKey = process.env.VOLC_OCR_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error("火山 OCR 未配置。请在服务端设置 VOLC_OCR_ACCESS_KEY 和 VOLC_OCR_SECRET_KEY。");
  }
  const imageBase64 = imageDataUrl.slice(imageDataUrl.indexOf(",") + 1);
  const body = new URLSearchParams({ image_base64: imageBase64, mode: "text_block", filter_thresh: "55" }).toString();
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const signed = volcAuthorization({ accessKey, secretKey, body, date });
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Date": date,
    "X-Content-Sha256": signed.payloadHash,
    Authorization: signed.authorization,
  };
  if (process.env.VOLC_OCR_SESSION_TOKEN) headers["X-Security-Token"] = process.env.VOLC_OCR_SESSION_TOKEN;

  const response = await fetch(`https://${VOLC_HOST}/?${signed.query}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(readBoundedIntegerEnv("VOLC_OCR_TIMEOUT_MS", 60_000)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ResponseMetadata?.Error) {
    const detail = data?.ResponseMetadata?.Error?.Message || data?.message || `HTTP ${response.status}`;
    throw new Error(`火山 OCR 调用失败：${String(detail).slice(0, 240)}`);
  }
  const infos = data?.data?.ocr_infos || data?.Result?.data?.ocr_infos || data?.Result?.ocr_infos || [];
  return {
    lines: infos.map((info) => ({ text: info.text, score: Number(info.prob) / (Number(info.prob) > 1 ? 100 : 1), polygon: info.rect })),
  };
};

const validate = (body) => {
  if (!body || typeof body !== "object") return "OCR 请求格式不正确。";
  if (!Number.isInteger(body.pageNumber) || body.pageNumber < 1 || body.pageNumber > 100) return "OCR 页码不正确。";
  if (typeof body.imageDataUrl !== "string" || !body.imageDataUrl.startsWith("data:image/")) return "OCR 页面必须是图片格式。";
  if (body.imageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS) return "OCR 页面图片过大。";
  return "";
};

export async function runOcrRequest(body, { allowLocal = true } = {}) {
  const validationError = validate(body);
  if (validationError) return { status: 400, payload: { ok: false, error: validationError } };

  const provider = String(process.env.OCR_PROVIDER || "local").toLowerCase();
  try {
    let raw;
    if (provider === "volcengine") {
      raw = await runVolcengineOcr(body.imageDataUrl);
    } else if (provider === "local" && allowLocal) {
      raw = await runLocalOcr(body.imageDataUrl);
    } else if (provider === "local") {
      throw new Error("当前部署环境不支持本地 OCR，请将 OCR_PROVIDER 配置为 volcengine。");
    } else {
      throw new Error(`不支持的 OCR_PROVIDER：${provider}`);
    }

    const dimensions = provider === "volcengine"
      ? { width: Number(body.width) || 1, height: Number(body.height) || 1 }
      : raw;
    const normalized = normalizeResult({ ...raw, ...dimensions }, body.pageNumber, provider);
    return { status: 200, payload: { ok: true, ...normalized } };
  } catch (error) {
    return {
      status: 503,
      payload: { ok: false, error: error instanceof Error ? error.message : "OCR 服务不可用。" },
    };
  }
}
