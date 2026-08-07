# 孔明职配

面向学生求职场景的 AI 岗位匹配与简历优化智能体 Demo。

## 目标

帮助学生在海量岗位中快速识别与自身背景、能力专长和职业兴趣匹配度高的机会，并针对目标岗位理解简历差距、获得可执行的优化建议，从而提升通过简历初筛的命中率。

## 交付物

- 可运行 Demo：公网可访问链接。
- 方案说明：1000 字以内，Markdown 初稿，后续由用户转为 DOC/PDF。
- 演示视频：非必需，若制作则控制在 3 分钟以内。

## 文档索引

- [项目任务书](docs/00-project-charter.md)
- [开源项目参考与对比](docs/01-open-source-benchmark.md)
- [技术方案与工具准备](docs/02-tech-stack-and-tools.md)
- [Git 协作规范](docs/03-git-workflow.md)
- [交付计划](docs/04-delivery-plan.md)
- [开源项目能力选择矩阵](docs/05-open-source-selection-matrix.md)
- [Skill、MCP 与部署准备](docs/06-skills-mcp-and-deployment-prep.md)
- [多智能体与多模态架构设计](docs/08-multi-agent-multimodal-architecture.md)
- [简历 OCR 坐标识别](docs/12-ocr-integration.md)
- [前端模块化拆分](docs/13-frontend-modularization.md)
- [岗位 RAG 知识库](docs/14-job-rag-knowledge-base.md)

## 本地开发

比赛模型调用使用 Gitee AI 模力方舟上的沐曦 Token 资源包。请参考 `.env.example` 在本地创建不提交的 `.env.local`，并通过安全方式填写访问令牌：

```text
ARK_BASE_URL=https://ai.gitee.com/v1
ARK_PACKAGE=1492
ARK_MODEL=Qwen3-4B
ARK_VISION_MODEL=Qwen3-VL-8B-Instruct
```

首次使用扫描版 PDF 或图片简历前，先在 D 盘建立本地 OCR 环境：

```powershell
npm run setup:ocr
```

首次构建岗位知识库时执行：

```powershell
npm run setup:rag
npm run build:job-index
npm run setup:job-reranker
npm run verify:job-rerank
```

重排模型约占 2.3 GB，默认缓存到
`D:\ai_models\kongming-rerankers\bge-reranker-v2-m3`。缓存完成后，本地岗位
检索会自动启用二阶段重排；页面请求不会联网下载模型。

启动前端和同源模型、OCR、岗位知识库代理：

```powershell
npm run dev
```

生产环境的 Vercel 函数通过 `/api/jobs/search` 转发到独立岗位 RAG 服务，不会
在 Serverless 函数中加载本地 Python、Qdrant 数据目录或重排模型。部署变量和
容器运行说明见 [岗位 RAG 独立服务](deploy/job-rag/README.md)，配置后可运行：

```powershell
npm run verify:job-remote
```

有文字层的 PDF 会继续使用 PDF.js；仅当文字层为空或质量不足时，系统才调用 RapidOCR，并把识别到的文字坐标用于简历字段高亮。OCR 置信度不足时，语义识别任务通过 Gitee AI / 沐曦视觉模型完成。
