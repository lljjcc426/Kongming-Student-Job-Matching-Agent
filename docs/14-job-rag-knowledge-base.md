# 岗位 RAG 职业知识库

## 目标

将 D 盘的 500 条官方岗位种子数据构建为可持久化、可过滤、可评测的本地职业知识库，为岗位推荐和简历匹配提供真实岗位证据。

首版只负责“检索”，不直接让大模型生成岗位。检索结果保留官方岗位链接和核验时间；后续如需生成匹配解释，再把召回结果作为上下文交给火山方舟模型。

## 架构

```text
D:\Kongming-RAG\jobs-v1\jobs-500.jsonl
              │
              ▼
     job_knowledge_worker.py
       ├─ LlamaIndex 索引编排
       ├─ bge-small-zh-v1.5
       ├─ 每个岗位拆分为概览、职责、要求 3 个语义节点
       ├─ jieba + BM25
       └─ 岗位级聚合、RRF 融合与元数据过滤
              ├──────────────┐
              ▼              ▼
 D:\Kongming-RAG\...\database\qdrant
  （向量 + 完整岗位 JSON）   D:\Kongming-RAG\...\index
                           （清单 + BM25）
              │
              ▼
 localJobKnowledgeWorker.js（持久 Python 进程）
              │
              ▼
 POST /api/jobs/search
              │
              ▼
 jobKnowledgeClient.ts
```

## 为什么采用混合检索

向量检索适合识别“AI 应用研发”和“大模型工程”等语义相近表达，但对 `C++`、`RAG`、城市和招聘类型等短关键词不够稳定。BM25 可以补充精确词命中，RRF 用排名融合两种结果，避免直接比较不同量纲的分数。

## 数据与索引位置

- 原始统一数据：`D:\Kongming-RAG\jobs-v1\jobs-500.jsonl`
- Qdrant 数据库：`D:\Kongming-RAG\jobs-v1\database\qdrant`
- 索引根目录：`D:\Kongming-RAG\jobs-v1\index`
- Hugging Face 模型缓存：由 `HF_HOME` 指定；当前机器为 `D:\ai_models\huggingface`
- Conda 环境：`D:\conda_envs\kongming-rag`

当前活动集合把 500 个岗位拆为 1500 个向量节点：

- `overview`：岗位名称、公司、招聘类型、地点、职类、技能、学历和经验；
- `responsibilities`：岗位公共标题信息和全部职责的预算化表达；
- `requirements`：岗位公共标题信息、全部任职要求和优先条件的预算化表达。

每个节点都保存岗位 ID、分区类型和完整岗位 JSON 元数据。各条职责或要求会
共享可用文本预算，避免只保留列表前几项；当前 1500 个节点均未超过嵌入模型
的 512-token 上限。JSONL 仍是可审计、可重建的权威数据源，BM25 词法索引
继续单独持久化。

索引版本由“数据集 SHA-256 + 嵌入模型名称 + 向量后端 + 分区策略”确定。
当前活动版本为 `807dcda612e0-fb38bc02-qdrant-sections-v1`。重新采集岗位后
必须重新构建索引；旧版 SimpleVectorStore 和旧 Qdrant 集合不会被自动删除，
因此可通过修改 `active-index.json` 回滚，但修改前必须停止本地岗位工作进程。

## 初始化

```powershell
npm run setup:rag
npm run build:job-index
npm run setup:job-reranker
npm run verify:job-db
npm run verify:job-rag
npm run verify:job-rerank
npm run verify:job-remote
```

首次初始化需要下载 Python 依赖、本地嵌入模型和约 2.3 GB 的重排模型。之后启动前端时，Vite 会在后台预热常驻 Python 工作进程，并同时加载嵌入模型与已启用的重排模型；CPU 冷启动在不同系统负载下可能需要几十秒至两分钟，预热完成后的岗位检索通常不再承担模型加载时间。

Qdrant 本地模式使用目录锁。重新构建索引或单独运行数据库验证前，应先停止
正在运行的前端开发服务，避免两个 Python 进程同时打开同一数据库目录。

`JOB_RAG_SKIP_WARMUP=true` 只用于已隔离岗位接口的前端 UI 回归或低资源故障
排查；正常开发启动不设置该变量，Vite 仍会预热岗位模型。

## 本地接口

状态检查：

```http
GET /api/jobs/search
```

岗位检索：

```http
POST /api/jobs/search
Content-Type: application/json

{
  "query": "北京大模型算法实习生，熟悉 Python 和 RAG",
  "queries": [
    "Python、RAG、AI Agent 能力",
    "模型训练与评测项目经历"
  ],
  "topK": 10,
  "rerank": false,
  "bypassCache": false,
  "filters": {
    "sources": ["字节跳动"],
    "cities": ["北京"],
    "recruitmentTypes": ["实习"],
    "jobFamilies": ["算法"],
    "skills": ["Python", "RAG"],
    "studentOnly": true
  }
}
```

`queries` 为可选的补充检索视角，连同主查询最多保留 3 条。所有过滤字段均可
省略；`studentOnly` 为 `true` 时只保留实习和校园招聘岗位。`rerank` 只能
关闭服务端已经允许的重排，不能绕过环境配置自行开启；`bypassCache` 只用于
评测和故障排查。

## 与岗位推荐页面的衔接

简历完成结构化解析后，前端会构建 3 条相互补充的检索查询：

1. 目标岗位查询：求职方向、目标 JD、教育背景；
2. 能力查询：专业技能、证书竞赛、语言能力；
3. 经历查询：实习、项目、校园经历和个人简介。

系统默认启用 `studentOnly`，只从实习和校园招聘岗位中召回最多 30 条候选岗位。
每路向量查询先召回语义节点，再按岗位 ID 去重：同一岗位在同一路查询中只占
一个排名位置，绝对相似度取其最佳节点分数，同时记录所有命中的节点分区。
三路岗位级向量结果和三路 BM25 结果分别以加权 RRF 聚合，再进行向量 65%、
词法 35% 的二次融合。随后对全部候选计算“简历匹配 72% + 检索置信度 28%”
的个性化排序分数，再执行公司、岗位方向和标题去重，页面最终展示 6 条真实
岗位。

城市、公司、招聘类型等过滤条件会先转换为候选岗位 UUID，并通过 Qdrant
`HasIdCondition` 下推到向量数据库，其中每个候选岗位对应 3 个节点 UUID。
向量库每条查询只召回
`min(候选岗位数 × 3, max(60, topK × 3 × 2))` 个节点，不再固定扫描全部
1500 个向量节点；BM25 仍在过滤后的候选岗位集合内计算，以保留精确关键词
召回。

## 查询缓存

常驻 Python 工作进程使用内存 LRU 缓存保存完整检索结果。默认最多保存 64 项，
TTL 为 900 秒；索引版本、三路查询、Top-K、规范化过滤条件和重排配置共同构成
缓存键。缓存命中会返回深拷贝，因此调用方不能修改缓存中的原始对象。索引版本
变化或工作进程重启后不会复用旧结果。

可通过以下环境变量调整：

- `JOB_RAG_CACHE_MAX_ENTRIES`：默认 `64`，设为 `0` 可关闭；
- `JOB_RAG_CACHE_TTL_SECONDS`：默认 `900`，设为 `0` 可关闭。

`retrievalDiagnostics` 会返回 `cacheHit`、`cacheAgeMs`、当前缓存项数、容量和
TTL。当前重复检索回归由首次 1529.59ms 降至 0.38ms，岗位 ID 与顺序完全一致。

## 二阶段重排

系统使用 `BAAI/bge-reranker-v2-m3` CrossEncoder 重排层。运行
`npm run setup:job-reranker` 后，模型保存在稳定的 D 盘目录并执行一次相关、
无关岗位排序冒烟测试。运行时只从本地目录加载，不会由页面请求触发联网下载。
本地模型存在时重排默认启用，仅重排混合检索头部候选，默认候选数为
`max(topK, 8)`、最大 30 条；最终使用“原混合排名 35% + 重排排名 65%”的
加权 RRF，避免重排模型单次异常彻底覆盖稳定基线。

配置项：

- `JOB_RAG_RERANK_ENABLED=true`：允许重排；
- `JOB_RAG_RERANK_MODEL`：默认 `BAAI/bge-reranker-v2-m3`；
- `JOB_RAG_RERANK_MODEL_PATH`：默认
  `D:\ai_models\kongming-rerankers\bge-reranker-v2-m3`；
- `JOB_RAG_RERANK_DEVICE`：默认 `cpu`；
- `JOB_RAG_RERANK_TOP_N`：默认 `8`，范围 1–30；
- `JOB_RAG_RERANK_MAX_LENGTH`：默认 `384`，范围 128–2048；
- `JOB_RAG_RERANK_BATCH_SIZE`：默认 `4`；
- `JOB_RAG_RERANK_LOCAL_FILES_ONLY`：默认 `true`，防止页面请求隐式下载权重；
- `JOB_RAG_RERANK_STRICT`：默认 `false`，模型缺失或推理失败时回退混合检索。

当前 `kongming-rag` 环境安装的是 CPU 版 PyTorch，因此默认使用 CPU 推理。
业务运行时 `JOB_RAG_RERANK_STRICT=false`，模型损坏或推理失败时仍会安全回退
到混合检索；但 `npm run verify:job-rerank` 会强制启用严格模式，只有本地模型
真实加载、执行重排并返回有效分数时才通过，降级检索不再计为验证成功。

检索返回的主要证据字段包括：

- `retrieval.score`：RRF 排名相对于本次第一名的归一化分数，仅用于表达排序；
- `retrieval.confidence`：由绝对向量相似度和关键词证据覆盖度构成的检索置信度。
- `retrieval.matchedSections`：本岗位被向量检索命中的概览、职责或要求分区。
- `retrieval.rerankScore` / `rerankRank`：仅在实际应用重排后返回有效值。

`retrievalDiagnostics` 还会返回每路节点上限、实际命中节点数、聚合后的岗位数、
每个岗位的节点数、过滤是否已下推、缓存命中状态和重排状态。

页面的高、中、低优先级由简历匹配分数决定，不再把“本次第一名”自动解释为
高匹配岗位。

知识库岗位会显示：

- 数据来源企业；
- 最近核验日期；
- 检索命中词；
- 官方岗位详情链接。

如果本地知识库未安装、索引过期或服务不可用，系统才回退到原有的模型岗位方向建议，并明确提示当前结果未连接职业知识库。

## 质量验证

`npm run verify:job-db` 会检查 Qdrant 集合是否存在、1500 个节点是否对应
500 个岗位、是否位于 D 盘，以及抽样 payload 是否包含完整岗位 JSON。
验证结果写入：

`D:\Kongming-RAG\jobs-v1\database\database-verification.json`

`npm run verify:job-rag` 当前覆盖 10 类检索场景：

1. 北京大模型实习岗位；
2. 前端实习岗位；
3. 深圳游戏开发岗位；
4. 数据分析与运营岗位；
5. 腾讯云销售岗位；
6. Java 后端实习岗位；
7. 产品经理实习岗位；
8. 测试开发实习岗位；
9. 设计实习岗位；
10. 数据开发实习岗位。

验证内容包括索引新鲜度、结果非空、Top 5 相关命中、岗位 ID 唯一性、学生岗位
过滤合规性、三路查询数量、Qdrant 过滤下推、节点与岗位聚合诊断、命中分区、
检索分数边界和官方链接域名；报告同时记录 Hit@5、MRR 和 nDCG@5。

2026-08-07 在 CPU 重排配置 `topN=8`、`maxLength=384` 下，当前活动索引
10/10 场景通过，Hit@5、MRR 和 nDCG@5 均为 1。10 组请求耗时约
3.23–6.52 秒，重复查询缓存命中约 0.84ms；单独严格链路验证的重排阶段约
4.09 秒。

`npm run verify:ui` 使用固定岗位知识库响应验证页面请求与渲染，避免把模型冷
启动的内存波动误报为前端失败；真实 Qdrant、嵌入、缓存和排序链路由
`verify:job-db`、`verify:job-rag` 和 `verify:job-rerank` 分别覆盖。
UI 回归截图保存到 `D:\Kongming-RAG\jobs-v1\test-artifacts`。

评测结果写入：

`D:\Kongming-RAG\jobs-v1\index\retrieval-evaluation.json`

重排验证结果写入：

`D:\Kongming-RAG\jobs-v1\index\reranker-verification.json`

模型缓存和独立冒烟测试结果写入：

`D:\Kongming-RAG\jobs-v1\index\reranker-cache-verification.json`

远程服务、Vercel 网关和认证回归结果写入：

`D:\Kongming-RAG\jobs-v1\index\remote-rag-verification.json`

## 生产部署

Vercel 已提供以下 Node.js 网关接口：

- `GET /api/jobs/status`
- `GET /api/jobs/search`
- `POST /api/jobs/search`

网关只负责请求规范化、私有服务认证、45 秒超时、HTTPS 限制、响应大小限制和
上游错误脱敏。LlamaIndex、嵌入模型、Qdrant、BM25 和可选重排器运行在独立
Python 服务中，前端数据契约保持不变。

Vercel 环境变量：

```text
JOB_RAG_BACKEND=remote
JOB_RAG_REMOTE_BASE_URL=https://<私有岗位服务域名>
JOB_RAG_REMOTE_TOKEN=<通过 Vercel Secret 注入>
JOB_RAG_REMOTE_TIMEOUT_MS=45000
```

远程容器使用相同值配置 `JOB_RAG_SERVICE_TOKEN`。服务令牌不得提交到仓库、
前端变量或构建日志。完整容器说明见 `deploy/job-rag/README.md`。

当前容器继续使用 Qdrant Local 与持久磁盘，因此只运行一个服务副本。该方式
适合比赛和中小规模演示；需要水平扩展时，把相同集合迁移到 Qdrant Cloud 或
独立 Qdrant 集群，LlamaIndex 查询和岗位返回结构可以继续复用。
