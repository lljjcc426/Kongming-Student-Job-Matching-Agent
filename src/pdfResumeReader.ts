import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { OcrPageInput } from "./ocrTypes";

GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfReadResult = {
  text: string;
  method: "text-layer" | "vision-needed";
  pageCount: number;
  quality: number;
  coverage: number;
  imageDataUrls: string[];
  pageImages: OcrPageInput[];
  pageTexts: string[];
};

const MIN_TEXT_LENGTH = 70;
const MIN_PAGE_TEXT_CHARS = 12;
const MIN_TEXT_QUALITY = 0.56;
const MIN_TEXT_COVERAGE = 0.35;
const MAX_PAGE_IMAGE_CHARS = 1_450_000;
const PDF_CMAP_URL = "/vendor/pdfjs/cmaps/";
const PDF_PAGE_CONCURRENCY = 2;

const RESUME_SIGNAL_TERMS = [
  "姓名",
  "教育",
  "学历",
  "本科",
  "硕士",
  "博士",
  "学校",
  "学院",
  "专业",
  "绩点",
  "排名",
  "实习",
  "项目",
  "经历",
  "校园",
  "社团",
  "学生会",
  "竞赛",
  "荣誉",
  "证书",
  "技能",
  "求职",
  "意向",
  "邮箱",
  "电话",
  "GPA",
  "Education",
  "Experience",
  "Internship",
  "Project",
  "Skills",
  "Awards",
  "Certificate",
  "Email",
  "Phone",
  "GitHub",
];

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

const getResumeSignalScore = (text: string) => {
  const compact = text.replace(/\s/g, "");
  const cjkCount = (compact.match(/[\u3400-\u9fff]/g) ?? []).length;
  const signalCount = RESUME_SIGNAL_TERMS.reduce((count, term) => {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), /[A-Za-z]/.test(term) ? "i" : "");
    return count + (pattern.test(text) ? 1 : 0);
  }, 0);
  const meaningfulLines = text.split(/\n+/).filter((line) => line.replace(/\s/g, "").length >= 8).length;
  const contactSignals = Number(/1[3-9]\d{9}/.test(text)) + Number(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text));

  return {
    cjkCount,
    signalCount,
    meaningfulLines,
    contactSignals,
  };
};

const isTextLayerCompleteEnough = (text: string, quality: number, coverage: number) => {
  if (text.length < MIN_TEXT_LENGTH || quality < MIN_TEXT_QUALITY || coverage < MIN_TEXT_COVERAGE) return false;
  const signal = getResumeSignalScore(text);
  if (signal.signalCount >= 4 && signal.meaningfulLines >= 6) return true;
  if (signal.cjkCount >= 80 && signal.signalCount >= 2) return true;
  if (signal.signalCount >= 3 && signal.contactSignals >= 1 && signal.meaningfulLines >= 8) return true;
  return false;
};

const compressCanvas = (canvas: HTMLCanvasElement) => {
  const attempts = [
    { type: "image/jpeg", quality: 0.82 },
    { type: "image/jpeg", quality: 0.7 },
    { type: "image/jpeg", quality: 0.58 },
    { type: "image/jpeg", quality: 0.46 },
  ];

  for (const attempt of attempts) {
    const dataUrl = canvas.toDataURL(attempt.type, attempt.quality);
    if (dataUrl.length <= MAX_PAGE_IMAGE_CHARS) return dataUrl;
  }

  return canvas.toDataURL("image/jpeg", 0.36);
};

const renderPageToImage = async (page: PDFPageProxy) => {
  const baseViewport = page.getViewport({ scale: 1 });
  const maxSide = 1600;
  const scale = Math.min(2, maxSide / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return {
    pageNumber: page.pageNumber,
    imageDataUrl: compressCanvas(canvas),
    width: canvas.width,
    height: canvas.height,
  } satisfies OcrPageInput;
};

const mapWithConcurrency = async <T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
) => {
  const output = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return output;
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
  const pdf = await getDocument({ data, cMapUrl: PDF_CMAP_URL, cMapPacked: true }).promise;
  const pageTexts: string[] = [];
  const imageDataUrls: string[] = [];
  const pageImages: OcrPageInput[] = [];
  const pageNumbers = Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  pageTexts.push(...await mapWithConcurrency(pageNumbers, PDF_PAGE_CONCURRENCY, async (pageNumber) => {
    const page = await pdf.getPage(pageNumber);
    return extractPageText(page);
  }));

  const normalized = normalizeText(pageTexts.map((text, index) => `【第 ${index + 1} 页】\n${text}`).join("\n\n"));
  const quality = getTextQuality(normalized);
  const readablePageCount = pageTexts.filter((text) => text.replace(/\s/g, "").length >= MIN_PAGE_TEXT_CHARS && getTextQuality(text) >= MIN_TEXT_QUALITY).length;
  const coverage = pdf.numPages > 0 ? readablePageCount / pdf.numPages : 0;

  if (isTextLayerCompleteEnough(normalized, quality, coverage)) {
    return {
      text: normalized,
      method: "text-layer",
      pageCount: pdf.numPages,
      quality,
      coverage,
      imageDataUrls,
      pageImages,
      pageTexts,
    };
  }

  const unreadablePageNumbers = pageNumbers.filter((pageNumber) => {
    const pageText = pageTexts[pageNumber - 1] || "";
    return pageText.replace(/\s/g, "").length < MIN_PAGE_TEXT_CHARS
      || getTextQuality(pageText) < MIN_TEXT_QUALITY;
  });
  const pagesToRender = unreadablePageNumbers.length ? unreadablePageNumbers : pageNumbers;
  const renderedPages = await mapWithConcurrency(pagesToRender, PDF_PAGE_CONCURRENCY, async (pageNumber) => {
    const page = await pdf.getPage(pageNumber);
    return renderPageToImage(page);
  });
  renderedPages.forEach((image) => {
    if (!image) return;
    pageImages.push(image);
    imageDataUrls.push(image.imageDataUrl);
  });

  return {
    text: normalized,
    method: "vision-needed",
    pageCount: pdf.numPages,
    quality,
    coverage,
    imageDataUrls,
    pageImages,
    pageTexts,
  };
}
