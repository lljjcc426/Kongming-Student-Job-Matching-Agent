import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getDocument, GlobalWorkerOptions, Util, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { StructuredResume } from "../modelParsers";
import { findOcrHighlightRects } from "../ocrHighlight";
import type { OcrDocument, OcrPage } from "../ocrTypes";
import { fieldForResumeSectionHeading, findResumeHighlightRanges, isResumeSectionHeading, RESUME_FIELD_LABELS, type ResumeFieldKey } from "../resumeHighlight";

GlobalWorkerOptions.workerSrc = workerSrc;

type ResumePdfPreviewProps = {
  url: string;
  name: string;
  activeField: ResumeFieldKey | null;
  resume: StructuredResume;
  ocrDocument: OcrDocument | null;
};

type TextPiece = {
  text: string;
  start: number;
  end: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const PDF_SCALE = 1.45;

const mergeHighlightRects = (rects: HighlightRect[]) => {
  const sorted = [...rects].sort((left, right) => left.top - right.top || left.left - right.left);
  return sorted.reduce<HighlightRect[]>((merged, rect) => {
    const previous = merged[merged.length - 1];
    if (!previous) return [rect];

    const sameLine = Math.abs(previous.top - rect.top) <= Math.max(4, Math.min(previous.height, rect.height) * 0.45);
    const previousRight = previous.left + previous.width;
    if (sameLine && rect.left - previousRight < 22) {
      const right = Math.max(previousRight, rect.left + rect.width);
      const bottom = Math.max(previous.top + previous.height, rect.top + rect.height);
      previous.left = Math.min(previous.left, rect.left);
      previous.top = Math.min(previous.top, rect.top);
      previous.width = right - previous.left;
      previous.height = bottom - previous.top;
      return merged;
    }

    merged.push(rect);
    return merged;
  }, []);
};

function PdfPage({
  page,
  activeField,
  resume,
  ocrPage,
  onFirstMatch,
  onTextReady,
}: {
  page: PDFPageProxy;
  activeField: ResumeFieldKey | null;
  resume: StructuredResume;
  ocrPage?: OcrPage;
  onFirstMatch: (element: HTMLElement) => void;
  onTextReady: (pageNumber: number, hasText: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const matchRef = useRef<HTMLDivElement | null>(null);
  const viewport = useMemo(() => page.getViewport({ scale: PDF_SCALE }), [page]);
  const [textPieces, setTextPieces] = useState<TextPiece[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const renderTask = page.render({ canvas, canvasContext: context, viewport });
    void renderTask.promise.catch(() => undefined);
    return () => {
      renderTask.cancel();
    };
  }, [page, viewport]);

  useEffect(() => {
    let cancelled = false;
    void page.getTextContent().then((textContent) => {
      if (cancelled) return;
      let source = "";
      const pieces: TextPiece[] = [];
      textContent.items.forEach((item) => {
        if (!("str" in item) || !item.str) return;
        const textItem = item;
        const separator = source ? "\n" : "";
        source += separator;
        const start = source.length;
        source += textItem.str;
        const transform = Util.transform(viewport.transform, textItem.transform);
        const fontHeight = Math.max(4, Math.hypot(transform[2], transform[3]));
        pieces.push({
          text: textItem.str,
          start,
          end: source.length,
          left: transform[4],
          top: transform[5] - fontHeight,
          width: Math.max(4, textItem.width * viewport.scale),
          height: fontHeight,
        });
      });
      setTextPieces(pieces);
      onTextReady(page.pageNumber, pieces.length > 0);
    }).catch(() => {
      if (!cancelled) {
        setTextPieces([]);
        onTextReady(page.pageNumber, false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [onTextReady, page, viewport]);

  const highlights = useMemo(() => {
    if (!activeField) return [];
    const rectForPiece = (piece: TextPiece): HighlightRect => ({
      left: Math.max(0, piece.left - 4),
      top: Math.max(0, piece.top - 2),
      width: Math.min(viewport.width - piece.left + 4, piece.width + 8),
      height: piece.height + 4,
    });
    const ocrHighlights = findOcrHighlightRects(ocrPage, activeField, resume).map((rect) => ({
      left: rect.left * viewport.width,
      top: rect.top * viewport.height,
      width: rect.width * viewport.width,
      height: rect.height * viewport.height,
    }));
    if (!textPieces.length) return ocrHighlights;
    const source = textPieces.map((piece) => piece.text).join("\n");
    const evidenceRanges = findResumeHighlightRanges(source, activeField, resume);
    const contentRanges = evidenceRanges.filter((range) => range.strategy !== "section");
    if (contentRanges.length) {
      return mergeHighlightRects(
        textPieces
          .filter((piece) => contentRanges.some((range) => piece.end > range.start && piece.start < range.end))
          .map(rectForPiece),
      );
    }
    if (ocrHighlights.length) return mergeHighlightRects(ocrHighlights);
    const headings = textPieces
      .map((piece) => ({ piece, field: fieldForResumeSectionHeading(piece.text), isHeading: isResumeSectionHeading(piece.text) }))
      .filter((entry) => entry.isHeading);
    const activeHeading = headings.find((entry) => entry.field === activeField);

    if (activeHeading) {
      const headingXs = headings.map((entry) => entry.piece.left);
      const minHeadingX = Math.min(...headingXs);
      const maxHeadingX = Math.max(...headingXs);
      const hasColumns = maxHeadingX - minHeadingX > viewport.width * 0.3;
      const splitX = hasColumns ? (minHeadingX + maxHeadingX) / 2 : null;
      const inActiveColumn = (piece: TextPiece) => {
        if (splitX === null) return true;
        const centerX = piece.left + piece.width / 2;
        return activeHeading.piece.left < splitX ? centerX < splitX : centerX >= splitX;
      };
      const nextHeading = headings
        .filter((entry) => entry.piece !== activeHeading.piece)
        .filter((entry) => inActiveColumn(entry.piece))
        .filter((entry) => entry.piece.top > activeHeading.piece.top + activeHeading.piece.height * 0.45)
        .sort((left, right) => left.piece.top - right.piece.top)[0];
      const sectionBottom = nextHeading?.piece.top ?? Number.POSITIVE_INFINITY;
      const sectionPieces = textPieces.filter((piece) => (
        inActiveColumn(piece)
        && piece.top >= activeHeading.piece.top - 3
        && piece.top < sectionBottom - 2
      ));
      if (sectionPieces.length) return mergeHighlightRects(sectionPieces.map(rectForPiece));
    }

    if (!evidenceRanges.length) return [];
    return mergeHighlightRects(
      textPieces
        .filter((piece) => evidenceRanges.some((range) => piece.end > range.start && piece.start < range.end))
        .map(rectForPiece),
    );
  }, [activeField, ocrPage, resume, textPieces, viewport.height, viewport.width]);

  useEffect(() => {
    if (highlights.length && matchRef.current) onFirstMatch(matchRef.current);
  }, [highlights.length, onFirstMatch]);

  return (
    <article
      className={`resume-pdf-page ${highlights.length ? "has-highlight" : ""}`}
      style={{ aspectRatio: `${viewport.width} / ${viewport.height}` }}
      aria-label={`原简历第 ${page.pageNumber} 页`}
    >
      <canvas ref={canvasRef} />
      <div className="resume-pdf-highlight-layer" aria-hidden="true">
        {highlights.map((rect, index) => (
          <span
            key={`${page.pageNumber}-${index}`}
            ref={index === 0 ? matchRef : undefined}
            className="resume-pdf-highlight"
            style={{
              "--highlight-index": index,
              left: `${(rect.left / viewport.width) * 100}%`,
              top: `${(rect.top / viewport.height) * 100}%`,
              width: `${(rect.width / viewport.width) * 100}%`,
              height: `${(rect.height / viewport.height) * 100}%`,
            } as CSSProperties}
          />
        ))}
      </div>
      <span className="resume-pdf-page-number">{page.pageNumber}</span>
    </article>
  );
}

export default function ResumePdfPreview({ url, name, activeField, resume, ocrDocument }: ResumePdfPreviewProps) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [textLayerPages, setTextLayerPages] = useState<Record<number, boolean>>({});
  const [matchedField, setMatchedField] = useState<ResumeFieldKey | null>(null);
  const scrolledFieldRef = useRef<ResumeFieldKey | null>(null);

  useEffect(() => {
    scrolledFieldRef.current = null;
  }, [activeField]);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument({ url, cMapUrl: "/vendor/pdfjs/cmaps/", cMapPacked: true });
    setStatus("loading");
    setPages([]);
    setTextLayerPages({});

    void loadingTask.promise
      .then(async (pdf) => {
        const loadedPages = await Promise.all(
          Array.from({ length: pdf.numPages }, (_, index) => pdf.getPage(index + 1)),
        );
        if (cancelled) return;
        setDocument(pdf);
        setPages(loadedPages);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [url]);

  const handleFirstMatch = useCallback((element: HTMLElement) => {
    if (!activeField || scrolledFieldRef.current === activeField) return;
    scrolledFieldRef.current = activeField;
    setMatchedField(activeField);
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [activeField]);

  const handleTextReady = useCallback((pageNumber: number, hasText: boolean) => {
    setTextLayerPages((current) => current[pageNumber] === hasText ? current : { ...current, [pageNumber]: hasText });
  }, []);

  const activeLabel = activeField ? RESUME_FIELD_LABELS[activeField] : "尚未选择字段";
  const allTextLayersReady = pages.length > 0 && Object.keys(textLayerPages).length === pages.length;
  const hasReadableTextLayer = Object.values(textLayerPages).some(Boolean);
  const hasOcrCoordinates = Boolean(ocrDocument?.pages.some((page) => page.lines.length > 0));
  const locateDetail = activeField && allTextLayersReady && matchedField !== activeField
    ? hasReadableTextLayer || hasOcrCoordinates
      ? "未在 PDF 文本层或 OCR 结果中找到该字段的对应文字"
      : "该 PDF 没有可读取的文字坐标，OCR 也未返回可用位置"
    : "";

  return (
    <div
      className="resume-pdf-preview"
      data-pdf-pages={document?.numPages ?? 0}
      data-ocr-provider={ocrDocument?.provider || "none"}
    >
      <div className={`resume-highlight-guide ${activeField ? "active" : ""}`}>
        <span>{activeField ? "正在原简历中定位" : "字段定位"}</span>
        <strong>{activeLabel}</strong>
        {locateDetail ? <small>{locateDetail}</small> : null}
      </div>
      {status === "loading" ? <div className="resume-pdf-state">正在加载 {name}</div> : null}
      {status === "error" ? <div className="resume-pdf-state error">PDF 加载失败，请在简历文档栏重新上传。</div> : null}
      {status === "ready" ? (
        <div className="resume-pdf-pages">
          {pages.map((page) => (
            <PdfPage
              key={page.pageNumber}
              page={page}
              activeField={activeField}
              resume={resume}
              ocrPage={ocrDocument?.pages.find((ocrPage) => ocrPage.pageNumber === page.pageNumber)}
              onFirstMatch={handleFirstMatch}
              onTextReady={handleTextReady}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
