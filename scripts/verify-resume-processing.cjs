const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

const source = readFileSync("src/features/resume/documentProcessing.ts", "utf8");
const compiled = transformSync(source, {
  loader: "ts",
  format: "cjs",
  target: "es2022",
}).code;

const moduleExports = {};
const compiledModule = { exports: moduleExports };
const requireStub = () => ({});
new Function("exports", "module", "require", compiled)(moduleExports, compiledModule, requireStub);

const { processImageResume, processPdfResume } = compiledModule.exports;

const pageInput = {
  pageNumber: 1,
  imageDataUrl: "data:image/jpeg;base64,mock",
  width: 1200,
  height: 1600,
};

const ocrDocument = (averageScore, provider = "local") => ({
  provider,
  averageScore,
  pages: [{
    pageNumber: 1,
    width: 1200,
    height: 1600,
    lines: [{
      text: "姓名：陈雨 教育经历 华东师范大学 心理学 项目经历 用户访谈 问卷研究 SPSS 数据分析",
      score: averageScore,
      polygon: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }],
  }],
});

const usableText = "【OCR 第 1 页】\n姓名：陈雨\n教育经历：华东师范大学心理学本科\n项目经历：完成用户访谈、问卷研究和 SPSS 数据分析。";

const baseDependencies = {
  compressImage: async () => ({
    imageDataUrl: pageInput.imageDataUrl,
    width: pageInput.width,
    height: pageInput.height,
  }),
  recognizeOcr: async () => ocrDocument(0.92),
  ocrText: () => usableText,
  isUsableText: (text) => text.replace(/\s/g, "").length >= 30,
  recognizeVisionImage: async () => ({ ok: false, error: "vision should not run" }),
  recognizeVisionPages: async () => ({ ok: false, error: "vision should not run" }),
  readPdf: async () => {
    throw new Error("pdf should not run");
  },
};

async function main() {
  let imageVisionCalls = 0;
  const imageResult = await processImageResume(
    { name: "resume.png", type: "image/png" },
    undefined,
    {
      ...baseDependencies,
      recognizeVisionImage: async () => {
        imageVisionCalls += 1;
        return { ok: true, content: "unused" };
      },
    },
  );
  if (!imageResult.ok || imageResult.text !== usableText || imageResult.source !== "本地 OCR 识别" || imageVisionCalls !== 0) {
    throw new Error("High-confidence image OCR path failed.");
  }

  const crossVisionResult = await processImageResume(
    { name: "low-score.jpg", type: "image/jpeg" },
    undefined,
    {
      ...baseDependencies,
      recognizeOcr: async () => ocrDocument(0.51, "volcengine"),
      recognizeVisionImage: async () => ({ ok: true, content: "视觉模型补充：获奖经历和技能证书。" }),
    },
  );
  if (
    !crossVisionResult.ok ||
    !crossVisionResult.text.includes("【视觉模型交叉识别】") ||
    crossVisionResult.insight !== "视觉模型补充：获奖经历和技能证书。" ||
    crossVisionResult.source !== "火山 OCR 识别"
  ) {
    throw new Error("Low-confidence image cross-vision path failed.");
  }

  const pdfText = "姓名：陈雨\n教育经历：华东师范大学心理学本科\n项目经历：用户研究项目与问卷分析。\n技能：SPSS、访谈、数据分析。";
  const textLayerResult = await processPdfResume(
    { name: "text-resume.pdf", type: "application/pdf" },
    undefined,
    {
      ...baseDependencies,
      readPdf: async () => ({
        text: pdfText,
        method: "text-layer",
        pageCount: 2,
        quality: 0.91,
        coverage: 0.88,
        imageDataUrls: [],
        pageImages: [],
        pageTexts: [pdfText],
      }),
    },
  );
  if (!textLayerResult.ok || textLayerResult.text !== pdfText || !textLayerResult.source.includes("91%")) {
    throw new Error("PDF text-layer path failed.");
  }

  const progressMessages = [];
  const pdfVisionResult = await processPdfResume(
    { name: "scanned-resume.pdf", type: "application/pdf" },
    (message) => progressMessages.push(message),
    {
      ...baseDependencies,
      recognizeOcr: async (_pages, onProgress) => {
        onProgress?.(2, 2);
        return ocrDocument(0.55);
      },
      recognizeVisionPages: async (_images, _text, onBatch) => {
        onBatch?.(1, 2);
        return { ok: true, content: "视觉模型补充：竞赛一等奖。" };
      },
      readPdf: async () => ({
        text: "",
        method: "vision-needed",
        pageCount: 2,
        quality: 0.42,
        coverage: 0.2,
        imageDataUrls: ["page-1", "page-2"],
        pageImages: [pageInput, { ...pageInput, pageNumber: 2 }],
        pageTexts: ["", ""],
      }),
    },
  );
  if (
    !pdfVisionResult.ok ||
    !pdfVisionResult.text.includes("视觉模型补充：竞赛一等奖。") ||
    !progressMessages.some((message) => message.includes("2/2")) ||
    !progressMessages.some((message) => message.includes("1-2"))
  ) {
    throw new Error("PDF OCR and cross-vision path failed.");
  }

  const failedPdfResult = await processPdfResume(
    { name: "empty.pdf", type: "application/pdf" },
    undefined,
    {
      ...baseDependencies,
      readPdf: async () => ({
        text: "",
        method: "vision-needed",
        pageCount: 1,
        quality: 0,
        coverage: 0,
        imageDataUrls: [],
        pageImages: [],
        pageTexts: [""],
      }),
    },
  );
  if (failedPdfResult.ok || failedPdfResult.source !== "PDF 识别失败") {
    throw new Error("Unusable PDF failure path failed.");
  }

  console.log(JSON.stringify({
    ok: true,
    imageOcr: imageResult.source,
    imageCrossVision: crossVisionResult.source,
    pdfTextLayer: textLayerResult.source,
    pdfCrossVision: pdfVisionResult.source,
    failedPdf: failedPdfResult.source,
    progressMessages,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
