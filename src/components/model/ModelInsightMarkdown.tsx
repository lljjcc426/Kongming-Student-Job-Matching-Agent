import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ModelInsightMarkdown({ content }: { content: string }) {
  return (
    <div className="model-insight-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
