import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfReadResult = {
  text: string;
  method: "text-layer" | "vision-needed";
  pageCount: number;
  quality: number;
  imageDataUrls: string[];
};

const MAX_VISION_PAGES = 2;

const normalizeText = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .trim();

const getTextQuality = (text: string) => {
  if (!text.trim()) return 0;
  const readableChars = (text.match(/[\u4e00-\u9fa5A-Za-z0-9，。；：、,.:%/+\-#()（）]/g) ?? []).length;
  const replacementChars = (text.match(/[�□■◇◆]/g) ?? []).length;
  const base = readableChars / Math.max(text.length, 1);
  const penalty = Math.min(0.5, replacementChars / Math.max(text.length, 1));
  return Math.max(0, Math.min(1, base - penalty));
};

const renderPageToImage = async (page: PDFPageProxy) => {
  const viewport = page.getViewport({ scale: 1.7 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return "";

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
};

export async function readPdfResume(file: File): Promise<PdfReadResult> {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pageTexts: string[] = [];
  const imageDataUrls: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(text);
  }

  const normalized = normalizeText(pageTexts.join("\n"));
  const quality = getTextQuality(normalized);

  if (normalized.length >= 80 && quality >= 0.62) {
    return {
      text: normalized,
      method: "text-layer",
      pageCount: pdf.numPages,
      quality,
      imageDataUrls,
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
    imageDataUrls,
  };
}
