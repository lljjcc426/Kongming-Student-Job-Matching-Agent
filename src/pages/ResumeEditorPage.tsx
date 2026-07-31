import { FilePenLine, FileText, ScanText, Upload } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { OriginalResumePreview } from "../features/resume/types";
import type { StructuredResume } from "../modelParsers";
import { findOcrHighlightRects } from "../ocrHighlight";
import type { OcrDocument } from "../ocrTypes";
import { findResumeHighlightRanges, RESUME_FIELD_LABELS, type ResumeFieldKey } from "../resumeHighlight";

const ResumePdfPreview = lazy(() => import("./ResumePdfPreview"));

type ResumeEditorPageProps = {
  original: OriginalResumePreview;
  originalText: string;
  ocrDocument: OcrDocument | null;
  resume: StructuredResume | null;
  onChange: (resume: StructuredResume) => void;
  onUpload: (file?: File) => void | Promise<void>;
  uploadMessage: string;
  isUploading: boolean;
};

type ListField = ResumeFieldKey;

const EMPTY_RESUME: StructuredResume = {
  basicInfo: [],
  competitions: [],
  certificates: [],
  languages: [],
  socialAccounts: [],
  name: "",
  education: [],
  internships: [],
  projects: [],
  campus: [],
  honors: [],
  skills: [],
  targetRoles: [],
  summary: "",
};

const EDITOR_FIELDS: Array<{
  key: ListField;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  { key: "basicInfo", label: "基础信息", placeholder: "每行填写一项，例如：姓名：张明", rows: 6 },
  { key: "education", label: "教育经历", placeholder: "每行填写一段教育经历", rows: 5 },
  { key: "projects", label: "项目经历", placeholder: "每行填写一段项目经历", rows: 6 },
  { key: "competitions", label: "竞赛", placeholder: "每行填写一段竞赛经历", rows: 4 },
  { key: "certificates", label: "证书", placeholder: "每行填写一项证书或认证", rows: 4 },
  { key: "languages", label: "语言能力", placeholder: "每行填写一种语言及熟练度", rows: 4 },
];

function EditorColumn({
  eyebrow,
  title,
  description,
  status,
  icon,
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`resume-editor-column ${className}`.trim()}>
      <header className="resume-editor-column-head">
        <span className="resume-editor-step">{eyebrow}</span>
        <div className="resume-editor-column-title">
          <span className="resume-editor-column-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        <small>{status}</small>
      </header>
      <div className="resume-editor-column-body">{children}</div>
    </section>
  );
}

function ResumeUploadControl({
  onUpload,
  isUploading,
  compact = false,
}: Pick<ResumeEditorPageProps, "onUpload" | "isUploading"> & { compact?: boolean }) {
  return (
    <label className={`resume-editor-upload-control ${compact ? "compact" : ""} ${isUploading ? "loading" : ""}`.trim()}>
      <Upload size={compact ? 14 : 17} />
      <span>{isUploading ? "正在解析" : compact ? "替换简历" : "选择简历文件"}</span>
      <input
        type="file"
        accept=".txt,.md,.text,.pdf,application/pdf,image/*"
        aria-label={compact ? "替换原简历" : "上传原简历"}
        disabled={isUploading}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void onUpload(file);
        }}
      />
    </label>
  );
}

function EmptyResumeState({
  onUpload,
  uploadMessage,
  isUploading,
}: Pick<ResumeEditorPageProps, "onUpload" | "uploadMessage" | "isUploading">) {
  return (
    <div className="resume-editor-empty">
      <span><ScanText size={28} /></span>
      <strong>上传原简历</strong>
      <p>支持 PDF、图片和文本文件。上传后将自动识别内容，并同步生成结构化简历。</p>
      <ResumeUploadControl onUpload={onUpload} isUploading={isUploading} />
      <small>{uploadMessage}</small>
    </div>
  );
}

function HighlightGuide({ activeField, detail }: { activeField: ResumeFieldKey | null; detail?: string }) {
  return (
    <div className={`resume-highlight-guide ${activeField ? "active" : ""}`}>
      <span>{activeField ? "正在原简历中对照" : "字段定位"}</span>
      <strong>{activeField ? RESUME_FIELD_LABELS[activeField] : "点击中间任一字段"}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function HighlightedOriginalText({ text, activeField, resume }: { text: string; activeField: ResumeFieldKey | null; resume: StructuredResume }) {
  const markRef = useRef<HTMLElement | null>(null);
  const ranges = useMemo(() => findResumeHighlightRanges(text, activeField, resume), [activeField, resume, text]);
  const highlightedContent = useMemo(() => {
    if (!ranges.length) return text;
    const content: ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((range, index) => {
      if (range.start > cursor) content.push(text.slice(cursor, range.start));
      content.push(<mark key={`${range.start}-${range.end}`} ref={index === 0 ? markRef : undefined}>{text.slice(range.start, range.end)}</mark>);
      cursor = Math.max(cursor, range.end);
    });
    if (cursor < text.length) content.push(text.slice(cursor));
    return content;
  }, [ranges, text]);

  useEffect(() => {
    if (ranges.length && markRef.current) {
      markRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }, [activeField, ranges]);

  return (
    <div className="resume-original-text-preview">
      <HighlightGuide
        activeField={activeField}
        detail={activeField && !ranges.length ? "原文中未找到可定位的对应文字" : undefined}
      />
      <pre className="resume-original-text">{highlightedContent}</pre>
    </div>
  );
}

function OriginalResume({
  original,
  originalText,
  ocrDocument,
  onUpload,
  uploadMessage,
  isUploading,
  activeField,
  resume,
}: Pick<ResumeEditorPageProps, "original" | "originalText" | "ocrDocument" | "onUpload" | "uploadMessage" | "isUploading"> & {
  activeField: ResumeFieldKey | null;
  resume: StructuredResume;
}) {
  let preview: ReactNode = null;

  if (original.kind === "pdf" && original.url) {
    preview = (
      <Suspense fallback={<div className="resume-pdf-state">正在加载 PDF 定位组件</div>}>
        <ResumePdfPreview
          url={original.url}
          name={original.name}
          activeField={activeField}
          resume={resume}
          ocrDocument={ocrDocument}
        />
      </Suspense>
    );
  } else if (original.kind === "image" && original.url) {
    const ocrPage = ocrDocument?.pages.find((page) => page.pageNumber === 1);
    const highlights = findOcrHighlightRects(ocrPage, activeField, resume);
    preview = (
      <div className="resume-original-image-wrap">
        <HighlightGuide
          activeField={activeField}
          detail={activeField && !highlights.length
            ? ocrPage ? "OCR 文字中未找到该字段的对应内容" : "图片 OCR 尚未生成可用坐标"
            : undefined}
        />
        <div className={`resume-original-image-frame ${activeField ? "is-locating" : ""} ${highlights.length ? "has-highlight" : ""}`.trim()}>
          <img className="resume-original-image" src={original.url} alt={`原简历：${original.name}`} />
          <div className="resume-pdf-highlight-layer" aria-hidden="true">
            {highlights.map((rect, index) => (
              <span
                key={`image-highlight-${index}`}
                className="resume-pdf-highlight"
                style={{
                  "--highlight-index": index,
                  left: `${rect.left * 100}%`,
                  top: `${rect.top * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                } as CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
    );
  } else if (originalText.trim()) {
    preview = <HighlightedOriginalText text={originalText} activeField={activeField} resume={resume} />;
  }

  if (!preview) {
    return <EmptyResumeState onUpload={onUpload} uploadMessage={uploadMessage} isUploading={isUploading} />;
  }

  return (
    <div className="resume-original-workspace">
      <div className="resume-original-upload-bar">
        <div>
          <strong>{original.name || "文本简历"}</strong>
          <small>{isUploading ? "正在识别并生成结构化内容…" : uploadMessage}</small>
        </div>
        <ResumeUploadControl onUpload={onUpload} isUploading={isUploading} compact />
      </div>
      {preview}
    </div>
  );
}

export default function ResumeEditorPage({
  original,
  originalText,
  ocrDocument,
  resume,
  onChange,
  onUpload,
  uploadMessage,
  isUploading,
}: ResumeEditorPageProps) {
  const [activeField, setActiveField] = useState<ResumeFieldKey | null>(null);
  const currentResume = resume ?? EMPTY_RESUME;
  const originalStatus = original.name || (originalText.trim() ? "文本简历" : "等待上传");

  const updateListField = (key: ListField, value: string) => {
    const items = value.split("\n").map((item) => item.trim()).filter(Boolean);
    const nextResume = { ...currentResume, [key]: items };

    if (key === "basicInfo") {
      const readValue = (labels: string[]) => items
        .map((item) => {
          const separator = item.search(/[:：]/);
          if (separator < 0) return "";
          const label = item.slice(0, separator).trim();
          return labels.some((candidate) => label.includes(candidate)) ? item.slice(separator + 1).trim() : "";
        })
        .find(Boolean) || "";
      const name = readValue(["姓名", "名字", "Name"]);
      const target = readValue(["求职意向", "求职方向", "目标岗位", "应聘岗位"]);
      const summary = readValue(["个人简介", "个人总结", "自我评价", "简介"]);
      if (name) nextResume.name = name;
      if (target) nextResume.targetRoles = target.split(/[，,、/|；;]/).map((item) => item.trim()).filter(Boolean);
      if (summary) nextResume.summary = summary;
    }

    if (key === "competitions" || key === "certificates") {
      nextResume.honors = [
        ...(key === "competitions" ? items : currentResume.competitions),
        ...(key === "certificates" ? items : currentResume.certificates),
      ];
    }

    if (key === "languages") {
      const languagePattern = /英语|中文|汉语|普通话|日语|韩语|法语|德语|西班牙语|俄语|粤语|雅思|托福|CET|TEM|English|Japanese|Korean|French|German/i;
      nextResume.skills = [...currentResume.skills.filter((item) => !languagePattern.test(item)), ...items];
    }

    onChange(nextResume);
  };

  return (
    <section className="resume-editor-page" aria-label="简历编辑工作台">
      <header className="resume-editor-page-head">
        <div>
          <span><FilePenLine size={16} /> Resume Studio</span>
          <h1>简历编辑</h1>
        </div>
        <p>上传简历后，在右侧编辑识别出的字段；点击任一字段时，左侧简历文档会定位并高亮对应内容。</p>
      </header>

      <div className="resume-editor-grid">
        <EditorColumn
          eyebrow="01"
          title="简历文档"
          description="原始文件与字段位置对照"
          status={activeField ? `正在对照：${RESUME_FIELD_LABELS[activeField]}` : originalStatus}
          icon={<FileText size={18} />}
          className="resume-original-column"
        >
          <OriginalResume
            original={original}
            originalText={originalText}
            ocrDocument={ocrDocument}
            onUpload={onUpload}
            uploadMessage={uploadMessage}
            isUploading={isUploading}
            activeField={activeField}
            resume={currentResume}
          />
        </EditorColumn>

        <EditorColumn
          eyebrow="02"
          title="简历字段"
          description="六组结构化内容，可直接修改"
          status={resume ? "已载入解析字段" : "可直接开始填写"}
          icon={<ScanText size={18} />}
          className="resume-structured-column"
        >
          <form className="resume-structured-form" onSubmit={(event) => event.preventDefault()}>
            {EDITOR_FIELDS.map((field) => (
              <label
                key={field.key}
                className={activeField === field.key ? "is-active" : ""}
                onClick={() => setActiveField(field.key)}
              >
                <span>{field.label}<small>每行一项</small></span>
                <textarea
                  rows={field.rows}
                  value={currentResume[field.key].join("\n")}
                  onFocus={() => setActiveField(field.key)}
                  onChange={(event) => updateListField(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
              </label>
            ))}
          </form>
        </EditorColumn>
      </div>
    </section>
  );
}
