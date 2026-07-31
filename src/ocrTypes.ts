export type OcrPoint = [number, number];

export type OcrLine = {
  text: string;
  score: number;
  polygon: [OcrPoint, OcrPoint, OcrPoint, OcrPoint];
};

export type OcrPage = {
  pageNumber: number;
  width: number;
  height: number;
  lines: OcrLine[];
};

export type OcrDocument = {
  provider: "local" | "volcengine";
  pages: OcrPage[];
  averageScore: number;
};

export type OcrPageInput = {
  pageNumber: number;
  imageDataUrl: string;
  width: number;
  height: number;
};

export const textFromOcrDocument = (document: OcrDocument) => document.pages
  .map((page) => `【OCR 第 ${page.pageNumber} 页】\n${page.lines.map((line) => line.text).join("\n")}`)
  .join("\n\n")
  .trim();
