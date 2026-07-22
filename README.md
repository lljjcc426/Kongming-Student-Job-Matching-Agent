# 孔明职配

面向高校学生的求职证据工作台。项目聚焦互联网与数字技术岗位，把简历原文、岗位要求、事实确认、定制简历版本和投递进度组织成可追溯的求职闭环。

HarmonyOS 端采用“ArkUI 原生容器 + ArkWeb 本地业务包 + 受信原生桥接”的混合架构。应用界面和核心业务随 HAP 本地打包；华为账号、Core Vision OCR、Share Kit、Core Speech 和 Form Kit 由 ArkTS 桥接。架构边界和迁移策略见 [HarmonyOS 原生 UI 映射](docs/HARMONYOS_ORIGINAL_UI_MAPPING.md)。

> 当前可交付状态：Web 构建、核心自动化、浏览器冷启动持久化、ArkTS 编译、unsigned HAP 打包、HarmonyOS 6.1.1(24) 模拟器安装及两次启动均已验证。正式签名、华为账号和部分 Kit 的真机运行仍待完成，不能把“编译通过”写成“真机通过”。

![HarmonyOS 模拟器首页](docs/evidence-screenshots/harmony-emulator-home-20260722.jpeg)

## 核心价值

- 区分企业官方岗位、用户导入 JD 和 AI 职业方向，三类数据不混排。
- 先判断学历、地点等硬性条件，再把每项岗位要求映射到简历原文 Evidence ID。
- 证据覆盖率只表示“可评估要求中有原文证据的比例”，不是录用率、通过率或能力分。
- 缺失技能只进入学习与补强计划，不自动写进简历。
- 修改建议保留原文、证据 ID、对应岗位要求和风险，并要求用户逐条接受。
- 投递稿在导出和保存前再次执行事实检查；占位符、无证据项和失效证据会被拦截。
- 每个投递版本记录名称、目标岗位、创建时间、差异摘要、事实确认项和原文指纹，可复制、恢复和删除。
- 投递记录绑定实际使用的简历版本；没有绑定版本时不能进入“已投递”。
- 简历、岗位缓存、修改记录、版本和投递进度默认保存在当前设备，可一键清除。

## 当前功能

| 模块 | 当前实现 |
| --- | --- |
| 简历输入 | 文本、PDF、图片；PDF 优先读取文本层，图片优先调用本机 OCR，必要时才在用户同意后使用外部模型。 |
| 简历结构化 | 提取教育、实习、项目、校园经历、技能和求职方向；结构化结果需用户确认。 |
| 真实岗位 | 聚合企业公开招聘入口和 ATS 适配器，保留来源 URL、更新时间、最近发现时间和验证状态。 |
| 证据匹配 | 硬性条件、满足/部分满足/无证据/待确认、Evidence ID、证据覆盖和风险等级。 |
| 事实约束改写 | 原文与建议并排、逐项接受/拒绝/编辑、导出前校验、缺失技能学习清单。 |
| 简历版本 | 本机保存、差异摘要、内容预览、恢复、删除、投递记录绑定。 |
| 求职追踪 | 收藏、材料准备、已投递、测评、面试、Offer、未通过和终止；保存追加式阶段事件。 |
| 模拟面试 | 综合面、技术面、HR 面；文本回答、语音输入、问题播报和证据等级反馈。 |
| AI 助手 | 基于当前简历、岗位和匹配上下文进行多轮求职问答。 |
| 隐私 | 会话级外部模型授权、敏感字段脱敏、本机数据清除、服务不可用时本地降级。 |
| HarmonyOS | 华为账号、OCR、系统分享、TTS、语音识别、服务卡片和能力检测桥接。 |

当前端到端回归中的版本管理与投递绑定：

![简历版本管理](docs/evidence-screenshots/resume-version-manager-20260722.png)

![投递记录绑定具体简历版本](docs/evidence-screenshots/application-version-binding-20260722.png)

## 可信性规则

系统不会输出综合能力分或录用概率。岗位排序只使用：

1. 硬性条件和投递建议等级；
2. 可追溯证据覆盖；
3. 来源是否为可验证的具体岗位。

首页演示卡也只展示“有证据、部分证据、待确认”等离散状态，不再生成随机百分比或能力雷达分。以下旧逻辑由自动化检查阻止重新进入源码和 HAP 静态资源：固定能力分、简历长度加分、城市偏好增加专业分、固定分数阈值决定投递建议等。

运行可信性测试：

```powershell
npm run verify:evidence
npm run verify:claims
```

`verify:evidence` 当前包含 20 组事实约束对抗样例，覆盖简历没有的技能、职责、量化结果、上线经历和无效 Evidence ID。

## 快速开始

要求：Node.js 20 或更新版本、npm。

```powershell
npm install
npm run dev
```

默认访问：`http://localhost:5173`。

Web 生产构建：

```powershell
npm run build
```

核心验证：

```powershell
npm run verify:core
```

UI 验证需要先保持 `npm run dev -- --port 5173 --strictPort` 运行，然后在另一个终端执行：

```powershell
npm run verify:ui
```

UI 脚本会验证隐私门禁、岗位分层、事实确认、版本保存、投递绑定以及刷新后的数据恢复，并将脱敏截图写入忽略提交的 `artifacts/`。

## HarmonyOS 构建与运行

工程要求：DevEco Studio 6.1.1、HarmonyOS SDK 6.1.1(24)。

不依赖本机接口的普通构建：

```powershell
npm run build:harmony
```

模拟器本地联调：

```powershell
npm run dev -- --port 5173 --strictPort
npm run build:harmony:local
npm run run:harmony:emulator
```

`build:harmony:local` 将 `http://127.0.0.1:5173/api/*` 写入调试 HAP；运行脚本通过 HDC 反向端口转发访问电脑上的服务。模拟器脚本默认冷启动，以规避部分快照启动后 HDC Offline 的问题。

当前产物位置：

```text
harmony/entry/build/default/outputs/default/entry-default-unsigned.hap
```

详细环境、HAP 大小、SHA-256、安装输出、两次启动结果和设备信息见 [2026-07-22 交付证据](docs/RELEASE_EVIDENCE_20260722.md)。更完整的构建说明见 [HarmonyOS 工程说明](harmony/README.md)。

## 联网服务配置

浏览器开发模式可以使用同源 `/api`；HAP 正式构建必须注入可公开访问的 HTTPS 地址。

| 配置 | 用途 |
| --- | --- |
| `ARK_API_KEY` | 仅服务端使用的模型密钥，禁止进入前端或 HAP。 |
| `ARK_BASE_URL` | Ark/OpenAI 兼容模型服务地址。 |
| `ARK_MODEL` | 文本模型。 |
| `ARK_VISION_MODEL` | 图片/PDF 视觉兜底模型。 |
| `VITE_ARK_API_URL` | HAP 可访问的 HTTPS 模型代理。 |
| `VITE_JOBS_API_URL` | HAP 可访问的 HTTPS 岗位聚合接口。 |
| `VITE_HEALTH_API_URL` | HAP 可访问的 HTTPS 健康检查。 |
| `JOB_STORE_PATH` | 可选的岗位 JSON 快照路径。 |
| `JOB_SOURCE_CONFIG_JSON` | 可选的额外 ATS 来源配置。 |

正式地址构建会拒绝非 HTTPS 地址：

```powershell
npm run build:harmony:release -- `
  -PublicApiBaseUrl https://your-domain.example/api
```

仓库不包含生产密钥、证书、Profile 或完整后端数据库。当前 `api/` 和 `server/` 可部署为轻量无服务器代理；正式运营仍需增加账号数据治理、监控、限流、关闭岗位对账和隐私合规流程。

## 数据与隐私边界

- 外部模型授权只在当前会话有效，应用重启后必须重新同意。
- 本机工作区保存简历文本、结构化结果、岗位缓存、修改决定和投递版本；投递追踪单独保存岗位阶段和绑定的版本 ID。
- 服务卡片只同步岗位数量、待办数量、下一行动和岗位名称，不同步简历正文。
- 华为账号本机只保存登录提示和 OpenID 尾部提示，不保存密码或访问令牌。
- 模型密钥只允许保存在服务端环境变量中。
- “清除本地求职数据”会删除工作区和投递追踪，不影响华为账号系统登录态。

## HarmonyOS 能力状态

| 能力 | 源码/构建 | 模拟器运行 | 真机待验 |
| --- | --- | --- | --- |
| ArkWeb 本地业务包 | 通过 | 安装、首次和二次启动通过 | 多设备布局 |
| Form Kit | 编译并注册扩展 | `bm dump` 确认 `ApplicationFormAbility` 已安装 | 桌面添加、杀进程后刷新和精准跳转 |
| 华为账号 | 已接入 | 未执行登录 | 包名、签名指纹和控制台授权 |
| Core Vision OCR | 已接入 | 未用真实图片触发 | 中文识别质量和取消流程 |
| Share Kit | 已接入 | 未触发系统面板 | 成功、取消和异常回调 |
| Core Speech | TTS/STT 已接入，浏览器能力可降级 | 当前模拟器未做麦克风质量验收 | 权限拒绝、中英混合、后台和超时 |

## 仓库结构

```text
api/        无服务器 API 入口与健康检查
docs/       架构、部署、测试、证据和竞赛材料
harmony/    HarmonyOS Stage 工程与本地 Web 资源
public/     图片、视频、PDF.js 和数字人资源
scripts/    构建、岗位、可信性、UI 和模拟器验证脚本
server/     模型代理与岗位采集服务
src/        React 业务、领域、存储、桥接和页面
```

`harmony/entry/src/main/resources/resfile/` 是构建生成目录，不应手工修改。

## 文档索引

- [2026-07-22 交付证据](docs/RELEASE_EVIDENCE_20260722.md)
- [HarmonyOS 工程说明](harmony/README.md)
- [测试计划与本轮报告](docs/competition/02_TEST_PLAN_AND_REPORT.md)
- [已知限制](docs/competition/03_KNOWN_LIMITATIONS.md)
- [竞赛提交清单](docs/competition/04_SUBMISSION_CHECKLIST.md)
- [部署指南](docs/DEPLOYMENT_GUIDE.md)
- [证据材料索引](docs/EVIDENCE_INDEX.md)
- [架构与竞赛策略](docs/competition/01_ARCHITECTURE_AND_STRATEGY.md)
- [开源来源说明](docs/OPEN_SOURCE_ATTRIBUTION.md)
- [第三方依赖与素材 License](docs/THIRD_PARTY_LICENSES.md)

代码采用 Apache License 2.0；第三方依赖、模型、媒体、品牌和演示素材仍遵循各自许可与授权边界。
