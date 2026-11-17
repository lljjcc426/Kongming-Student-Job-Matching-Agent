import { defineConfig, loadEnv, type Plugin } from "vite";
import { createApp } from "./server/app.js";
import react from "@vitejs/plugin-react";
import { closeAgentMemoryStore } from "./server/agentMemoryCore.js";
import { closeLocalOcrWorker } from "./server/localOcrWorker.js";
import { closeLocalJobKnowledgeWorker } from "./server/localJobKnowledgeWorker.js";

const apiDevProxy = (): Plugin => ({
  name: "application-api",
  configureServer(server) {
    server.httpServer?.once("close", () => {
      closeAgentMemoryStore();
      closeLocalOcrWorker();
      closeLocalJobKnowledgeWorker();
    });
    const api = createApp();
    server.middlewares.use((request, response, next) => {
      if (request.url?.startsWith("/api/")) api(request, response);
      else next();
    });
  },
});

const serverEnvPrefixes = ["MODEL_", "DEEPSEEK_", "ARK_", "JOB_RAG_", "OCR_", "VOLC_OCR_", "HF_", "MODELSCOPE_", "AGENT_MEMORY_"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (serverEnvPrefixes.some((prefix) => key.startsWith(prefix)) && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), apiDevProxy()],
    build: {
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        output: {
          entryFileNames: "assets/[hash].js",
          chunkFileNames: "assets/[hash].js",
          assetFileNames: "assets/[hash][extname]",
        },
      },
    },
  };
});
