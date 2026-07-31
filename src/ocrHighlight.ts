import type { StructuredResume } from "./modelParsers";
import type { OcrPage } from "./ocrTypes";
import { findResumeHighlightRanges, type ResumeFieldKey } from "./resumeHighlight";

export type NormalizedHighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const findOcrHighlightRects = (
  page: OcrPage | undefined,
  activeField: ResumeFieldKey | null,
  resume: StructuredResume,
): NormalizedHighlightRect[] => {
  if (!page || !activeField || !page.lines.length || page.width <= 0 || page.height <= 0) return [];

  let source = "";
  const pieces = page.lines.map((line) => {
    const separator = source ? "\n" : "";
    source += separator;
    const start = source.length;
    source += line.text;
    return { line, start, end: source.length };
  });
  const ranges = findResumeHighlightRanges(source, activeField, resume);
  if (!ranges.length) return [];

  return pieces
    .filter((piece) => ranges.some((range) => piece.end > range.start && piece.start < range.end))
    .map(({ line }) => {
      const xs = line.polygon.map((point) => point[0]);
      const ys = line.polygon.map((point) => point[1]);
      const left = Math.max(0, Math.min(...xs) - 4);
      const top = Math.max(0, Math.min(...ys) - 3);
      const right = Math.min(page.width, Math.max(...xs) + 4);
      const bottom = Math.min(page.height, Math.max(...ys) + 3);
      return {
        left: left / page.width,
        top: top / page.height,
        width: Math.max(0, right - left) / page.width,
        height: Math.max(0, bottom - top) / page.height,
      };
    });
};
