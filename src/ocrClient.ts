import type { OcrDocument, OcrPage, OcrPageInput } from "./ocrTypes";

type OcrApiResponse = {
  ok: boolean;
  provider?: OcrDocument["provider"];
  page?: OcrPage;
  error?: string;
};

const OCR_TIMEOUT_MS = 100_000;

const recognizeOcrPage = async (input: OcrPageInput): Promise<{ provider: OcrDocument["provider"]; page: OcrPage }> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as OcrApiResponse;
    if (!response.ok || !data.ok || !data.page || !data.provider) {
      throw new Error(data.error || `OCR 服务返回异常（HTTP ${response.status}）`);
    }
    return { provider: data.provider, page: data.page };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("OCR 识别超时，请稍后重试或上传更清晰的文件。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export async function recognizeOcrDocument(
  inputs: OcrPageInput[],
  onProgress?: (completed: number, total: number) => void,
): Promise<OcrDocument> {
  if (!inputs.length) throw new Error("没有可供 OCR 识别的页面。");

  const pages: OcrPage[] = [];
  let provider: OcrDocument["provider"] = "local";
  for (const input of inputs) {
    const result = await recognizeOcrPage(input);
    provider = result.provider;
    pages.push(result.page);
    onProgress?.(pages.length, inputs.length);
  }

  const scores = pages.flatMap((page) => page.lines.map((line) => line.score)).filter(Number.isFinite);
  return {
    provider,
    pages: pages.sort((left, right) => left.pageNumber - right.pageNumber),
    averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
  };
}
