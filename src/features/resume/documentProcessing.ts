import type { PdfReadResult } from "../../pdfResumeReader";
import { recognizeOcrDocument } from "../../ocrClient";
import {
  textFromOcrDocument,
  type OcrDocument,
  type OcrPageInput,
} from "../../ocrTypes";
import {
  isUsableResumeText,
  readImageAsCompressedDataUrl,
} from "./fileProcessing";
import {
  recognizeResumeVisionImage,
  recognizeResumeVisionPages,
} from "./resumeVision";

type VisionResult = {
  ok: boolean;
  content?: string;
  error?: string;
};

type CompressedImage = {
  imageDataUrl: string;
  width: number;
  height: number;
};

export type ResumeDocumentProcessingResult =
  | {
      ok: true;
      text: string;
      insight?: string;
      ocrDocument?: OcrDocument;
      modelMessage: string;
      uploadMessage: string;
      source: string;
    }
  | {
      ok: false;
      ocrDocument?: OcrDocument;
      modelMessage: string;
      uploadMessage: string;
      source?: string;
    };

export type ResumeDocumentProcessingDependencies = {
  compressImage: (file: File) => Promise<CompressedImage>;
  recognizeOcr: (
    inputs: OcrPageInput[],
    onProgress?: (completed: number, total: number) => void,
  ) => Promise<OcrDocument>;
  ocrText: (document: OcrDocument) => string;
  isUsableText: (text: string) => boolean;
  recognizeVisionImage: (imageDataUrl: string) => Promise<VisionResult>;
  recognizeVisionPages: (
    imageDataUrls: string[],
    extractedText?: string,
    onBatch?: (firstPage: number, lastPage: number) => void,
    pageNumbers?: number[],
  ) => Promise<VisionResult>;
  readPdf: (file: File) => Promise<PdfReadResult>;
};

const defaultDependencies: ResumeDocumentProcessingDependencies = {
  compressImage: readImageAsCompressedDataUrl,
  recognizeOcr: recognizeOcrDocument,
  ocrText: textFromOcrDocument,
  isUsableText: isUsableResumeText,
  recognizeVisionImage: recognizeResumeVisionImage,
  recognizeVisionPages: recognizeResumeVisionPages,
  readPdf: async (file) => {
    const { readPdfResume } = await import("../../pdfResumeReader");
    return readPdfResume(file);
  },
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export async function processImageResume(
  file: File,
  onProgress?: (message: string) => void,
  dependencies: ResumeDocumentProcessingDependencies = defaultDependencies,
): Promise<ResumeDocumentProcessingResult> {
  let image: CompressedImage;
  try {
    image = await dependencies.compressImage(file);
  } catch (error) {
    const message = errorMessage(error, "图片读取失败");
    return {
      ok: false,
      modelMessage: `${message}，请尝试上传更清晰的图片。`,
      uploadMessage: `未能读取 ${file.name}，请检查图片格式后重试。`,
    };
  }

  let ocrDocument: OcrDocument | undefined;
  try {
    ocrDocument = await dependencies.recognizeOcr([{ pageNumber: 1, ...image }]);
    const ocrText = dependencies.ocrText(ocrDocument);
    if (dependencies.isUsableText(ocrText)) {
      let analysisText = ocrText;
      let insight = ocrText;
      if (ocrDocument.averageScore < 0.72) {
        const vision = await dependencies.recognizeVisionImage(image.imageDataUrl);
        if (vision.ok && vision.content) {
          analysisText = `${ocrText}\n\n【视觉模型交叉识别】\n${vision.content}`;
          insight = vision.content;
        }
      }
      return {
        ok: true,
        text: analysisText,
        insight,
        ocrDocument,
        modelMessage: `已完成图片 OCR，平均置信度 ${Math.round(ocrDocument.averageScore * 100)}%`,
        uploadMessage: `已识别 ${file.name}，OCR 坐标已用于字段高亮。`,
        source: `${ocrDocument.provider === "local" ? "本地" : "火山"} OCR 识别`,
      };
    }
  } catch (error) {
    onProgress?.(`${errorMessage(error, "本地 OCR 不可用")}，正在改用视觉模型`);
  }

  const response = await dependencies.recognizeVisionImage(image.imageDataUrl);
  if (response.ok && response.content) {
    return {
      ok: true,
      text: response.content,
      insight: response.content,
      ocrDocument,
      modelMessage: "已完成图片简历识别",
      uploadMessage: `已识别 ${file.name}，画像、岗位排序和匹配结果已更新。`,
      source: "图片视觉识别",
    };
  }

  return {
    ok: false,
    ocrDocument,
    modelMessage: response.error || "图片简历识别失败，请检查模型环境变量。",
    uploadMessage: response.error || `未能识别 ${file.name}，请尝试上传更清晰的图片。`,
  };
}

export async function processPdfResume(
  file: File,
  onProgress?: (message: string) => void,
  dependencies: ResumeDocumentProcessingDependencies = defaultDependencies,
): Promise<ResumeDocumentProcessingResult> {
  let pdfResult: PdfReadResult;
  try {
    pdfResult = await dependencies.readPdf(file);
  } catch (error) {
    const message = errorMessage(error, "PDF 读取失败");
    return {
      ok: false,
      modelMessage: message,
      uploadMessage: `未能读取 ${file.name}，请检查 PDF 文件后重试。`,
      source: "PDF 识别失败",
    };
  }

  if (pdfResult.method === "text-layer") {
    return {
      ok: true,
      text: pdfResult.text,
      modelMessage: `已从 PDF 文本层提取 ${pdfResult.text.length} 字`,
      uploadMessage: `已解析 ${file.name}，共 ${pdfResult.pageCount} 页，画像、岗位排序和匹配结果已更新。`,
      source: `PDF 文本层识别，质量 ${Math.round(pdfResult.quality * 100)}%`,
    };
  }

  let ocrDocument: OcrDocument | undefined;
  if (pdfResult.pageImages.length > 0) {
    try {
      ocrDocument = await dependencies.recognizeOcr(
        pdfResult.pageImages,
        (completed, total) => onProgress?.(`正在 OCR 识别 PDF 第 ${completed}/${total} 页`),
      );
      const ocrText = dependencies.ocrText(ocrDocument);
      if (dependencies.isUsableText(ocrText)) {
        let visionContent = "";
        if (ocrDocument.averageScore < 0.72) {
          const vision = await dependencies.recognizeVisionPages(
            pdfResult.imageDataUrls,
            ocrText,
            (firstPage, lastPage) => onProgress?.(`正在识别简历图片第 ${firstPage}-${lastPage} 页`),
            pdfResult.pageImages.map((page) => page.pageNumber),
          );
          if (vision.ok && vision.content) visionContent = vision.content;
        }
        const combinedText = [
          dependencies.isUsableText(pdfResult.text) ? pdfResult.text : "",
          ocrText,
          visionContent ? `【视觉模型交叉识别】\n${visionContent}` : "",
        ].filter(Boolean).join("\n\n");
        return {
          ok: true,
          text: combinedText,
          insight: visionContent || ocrText,
          ocrDocument,
          modelMessage: `已完成 PDF OCR，平均置信度 ${Math.round(ocrDocument.averageScore * 100)}%`,
          uploadMessage: `已识别 ${file.name}，共 ${ocrDocument.pages.length} 页，OCR 坐标已用于字段高亮。`,
          source: `${ocrDocument.provider === "local" ? "本地" : "火山"} OCR，文本层质量 ${Math.round(pdfResult.quality * 100)}%`,
        };
      }
    } catch (error) {
      onProgress?.(`${errorMessage(error, "OCR 不可用")}，正在改用视觉模型`);
    }

    const response = await dependencies.recognizeVisionPages(
      pdfResult.imageDataUrls,
      pdfResult.text,
      (firstPage, lastPage) => onProgress?.(`正在识别简历图片第 ${firstPage}-${lastPage} 页`),
      pdfResult.pageImages.map((page) => page.pageNumber),
    );
    if (response.ok && response.content) {
      const combinedText = [
        dependencies.isUsableText(pdfResult.text) ? pdfResult.text : "",
        response.content,
      ].filter(Boolean).join("\n\n");
      return {
        ok: true,
        text: combinedText,
        insight: response.content,
        ocrDocument,
        modelMessage: "PDF 文本层质量较低，已完成视觉识别",
        uploadMessage: `已识别 ${file.name}，画像、岗位排序和匹配结果已更新。`,
        source: `PDF 视觉识别，文本层质量 ${Math.round(pdfResult.quality * 100)}%`,
      };
    }
    if (dependencies.isUsableText(pdfResult.text)) {
      return {
        ok: true,
        text: pdfResult.text,
        ocrDocument,
        modelMessage: "PDF 视觉识别未完成，已使用可读取文本层继续分析",
        uploadMessage: `已读取 ${file.name} 的 PDF 文本层，视觉识别不稳定，已继续生成岗位和建议。`,
        source: `PDF 文本层兜底，质量 ${Math.round(pdfResult.quality * 100)}%`,
      };
    }
    return {
      ok: false,
      ocrDocument,
      modelMessage: response.error || "PDF 文本层质量较低，视觉识别未完成。",
      uploadMessage: `未能稳定识别 ${file.name}，请尝试上传清晰图片或可复制文字的 PDF。`,
      source: `PDF 识别失败，文本层质量 ${Math.round(pdfResult.quality * 100)}%`,
    };
  }

  if (dependencies.isUsableText(pdfResult.text)) {
    return {
      ok: true,
      text: pdfResult.text,
      modelMessage: "PDF 页面渲染失败，已使用可读取文本层继续分析",
      uploadMessage: `已读取 ${file.name} 的 PDF 文本层，页面渲染不稳定，已继续生成岗位和建议。`,
      source: `PDF 文本层兜底，质量 ${Math.round(pdfResult.quality * 100)}%`,
    };
  }

  return {
    ok: false,
    modelMessage: "PDF 文本层为空，且无法渲染页面用于视觉识别。",
    uploadMessage: `未能识别 ${file.name}，请上传清晰图片或文本版简历。`,
    source: "PDF 识别失败",
  };
}
