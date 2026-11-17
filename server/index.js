import { createApp } from "./app.js";
import { closeLocalOcrWorker } from "./localOcrWorker.js";
import { closeLocalJobKnowledgeWorker, warmLocalJobKnowledge } from "./localJobKnowledgeWorker.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const server = createApp().listen(port, host, () => {
  console.info(`[http] listening on http://${host}:${port}`);
  if (process.env.JOB_RAG_DATA_PATH && process.env.JOB_RAG_SKIP_WARMUP !== "true") {
    warmLocalJobKnowledge().catch(() => console.warn("[job-rag] 岗位知识库预热失败"));
  }
});

const shutdown = () => server.close(() => {
  closeLocalOcrWorker();
  closeLocalJobKnowledgeWorker();
});
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
