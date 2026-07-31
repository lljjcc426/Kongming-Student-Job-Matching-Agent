import { callArkAgent } from "../../arkClient";

const RESUME_VISION_TIMEOUT_MS = 72_000;
const RESUME_VISION_PARALLEL_LIMIT = 2;

export async function recognizeResumeVisionPages(
  imageDataUrls: string[],
  extractedText = "",
  onBatch?: (firstPage: number, lastPage: number) => void,
) {
  const pageResults: string[] = [];
  const errors: string[] = [];
  const pages = imageDataUrls.map((imageDataUrl, index) => ({ imageDataUrl, index }));

  for (let start = 0; start < pages.length; start += RESUME_VISION_PARALLEL_LIMIT) {
    const batch = pages.slice(start, start + RESUME_VISION_PARALLEL_LIMIT);
    onBatch?.(batch[0].index + 1, batch[batch.length - 1].index + 1);
    const responses = await Promise.allSettled(
      batch.map((page) =>
        callArkAgent(
          {
            task: "resume-vision",
            imageDataUrls: [page.imageDataUrl],
            resumeText: extractedText,
          },
          { timeoutMs: RESUME_VISION_TIMEOUT_MS },
        ),
      ),
    );

    responses.forEach((response, offset) => {
      const pageNumber = batch[offset].index + 1;
      if (response.status === "fulfilled" && response.value.ok && response.value.content?.trim()) {
        pageResults.push(`【视觉识别第 ${pageNumber} 页】\n${response.value.content.trim()}`);
      } else {
        errors.push(response.status === "fulfilled" ? response.value.error || `第 ${pageNumber} 页识别失败` : `第 ${pageNumber} 页识别失败`);
      }
    });
  }

  return {
    ok: pageResults.length > 0,
    content: pageResults.join("\n\n"),
    error: errors[0],
  };
}

export const recognizeResumeVisionImage = (imageDataUrl: string) =>
  callArkAgent(
    { task: "resume-vision", imageDataUrl },
    { timeoutMs: RESUME_VISION_TIMEOUT_MS },
  );
