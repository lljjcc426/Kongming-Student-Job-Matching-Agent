import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfReadResult = {
  text: string;
  method: "text-layer" | "vision-needed";
  pageCount: number;
  quality: number;
  coverage: number;
  imageDataUrls: string[];
  pageTexts: string[];
};

const MAX_VISION_PAGES = 4;
const MIN_TEXT_LENGTH = 70;
const MIN_PAGE_TEXT_CHARS = 12;
const MIN_TEXT_QUALITY = 0.56;
const MIN_TEXT_COVERAGE = 0.35;
const MAX_PAGE_IMAGE_CHARS = 760_000;

const normalizeText = (text: string) =>
  text
    .replace(/\r/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, "$1$2")
    .trim();

const normalizePageText = (text: string) =>
  normalizeText(text)
    .replace(/\n\s+/g, "\n")
    .trim();

const getTextQuality = (text: string) => {
  const compact = text.replace(/\s/g, "");
  if (!compact) return 0;

  const readableChars = (compact.match(/[\u3400-\u9fffA-Za-z0-9，。；：、？！《》（）【】「」"'“”‘’·•\[\].,:;!?%/+\-#@_&()]/g) ?? []).length;
  const replacementChars = (compact.match(/[�锟]/g) ?? []).length;
  const weirdChars = (compact.match(/[^\u3400-\u9fffA-Za-z0-9，。；：、？！《》（）【】「」"'“”‘’·•\[\].,:;!?%/+\-#@_&()]/g) ?? []).length;
  const base = readableChars / compact.length;
  const penalty = Math.min(0.58, (replacementChars * 2.2 + weirdChars * 0.35) / compact.length);
  return Math.max(0, Math.min(1, base - penalty));
};

const compressCanvas = (canvas: HTMLCanvasElement) => {
  const attempts = [
    { type: "image/jpeg", quality: 0.72 },
    { type: "image/jpeg", quality: 0.6 },
    { type: "image/jpeg", quality: 0.5 },
    { type: "image/jpeg", quality: 0.42 },
  ];

  for (const attempt of attempts) {
    const dataUrl = canvas.toDataURL(attempt.type, attempt.quality);
    if (dataUrl.length <= MAX_PAGE_IMAGE_CHARS) return dataUrl;
  }

  return canvas.toDataURL("image/jpeg", 0.36);
};

const renderPageToImage = async (page: PDFPageProxy) => {
  const baseViewport = page.getViewport({ scale: 1 });
  const maxSide = 1280;
  const scale = Math.min(1.25, maxSide / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return "";

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return compressCanvas(canvas);
};

const extractPageText = async (page: PDFPageProxy) => {
  const textContent = await page.getTextContent();
  const lines: string[] = [];
  let currentLine = "";

  textContent.items.forEach((item) => {
    const value = "str" in item ? item.str : "";
    if (!value) return;
    currentLine = currentLine ? `${currentLine} ${value}` : value;
    if ("hasEOL" in item && item.hasEOL) {
      lines.push(currentLine);
      currentLine = "";
    }
  });

  if (currentLine) lines.push(currentLine);
  return normalizePageText(lines.join("\n"));
};

export async function readPdfResume(file: File): Promise<PdfReadResult> {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pageTexts: string[] = [];
  const imageDataUrls: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    pageTexts.push(await extractPageText(page));
  }

  const normalized = normalizeText(pageTexts.map((text, index) => `【第 ${index + 1} 页】\n${text}`).join("\n\n"));
  const quality = getTextQuality(normalized);
  const readablePageCount = pageTexts.filter((text) => text.replace(/\s/g, "").length >= MIN_PAGE_TEXT_CHARS && getTextQuality(text) >= MIN_TEXT_QUALITY).length;
  const coverage = pdf.numPages > 0 ? readablePageCount / pdf.numPages : 0;

  if (normalized.length >= MIN_TEXT_LENGTH && quality >= MIN_TEXT_QUALITY && coverage >= MIN_TEXT_COVERAGE) {
    return {
      text: normalized,
      method: "text-layer",
      pageCount: pdf.numPages,
      quality,
      coverage,
      imageDataUrls,
      pageTexts,
    };
  }

  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_VISION_PAGES); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const image = await renderPageToImage(page);
    if (image) imageDataUrls.push(image);
  }

  return {
    text: normalized,
    method: "vision-needed",
    pageCount: pdf.numPages,
    quality,
    coverage,
    imageDataUrls,
    pageTexts,
  };
}
