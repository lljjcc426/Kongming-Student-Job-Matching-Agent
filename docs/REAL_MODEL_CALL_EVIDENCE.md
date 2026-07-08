# Gitee AI / 沐曦真实调用证据

## 1. 调用环境

| 项目 | 内容 |
| --- | --- |
| 调用平台 | Gitee AI 模力方舟 |
| 资源包 | 沐曦 Token 资源包 |
| 资源包编号 | 1492 |
| 文本模型 | Qwen3-4B |
| 视觉模型 | Qwen3-VL-8B-Instruct |
| 项目调用入口 | `/api/ark` 后端代理 |
| 证据截图 | `docs/evidence-screenshots/gitee-ai-real-call-record-20260708.png` |

## 2. 代码接入方式

项目保留原有 Ark/OpenAI 兼容代理入口，并通过环境变量切换到 Gitee AI：

```text
ARK_BASE_URL=https://ai.gitee.com/v1
ARK_API_KEY=your_gitee_ai_access_token
ARK_PACKAGE=1492
ARK_MODEL=Qwen3-4B
ARK_VISION_MODEL=Qwen3-VL-8B-Instruct
ARK_REQUEST_TIMEOUT_MS=90000
```

安全边界：

- 访问令牌只保存在本地 `.env.local` 或部署平台环境变量中。
- 仓库只提交 `.env.example` 占位模板。
- 前端不直接持有访问令牌。
- 公开证据不包含 Authorization header、API Key、Cookie、完整 IP、完整简历原文或完整模型响应。

## 3. 真实调用记录摘要

下表来自 Gitee AI 控制台“最近调用”页面的可见脱敏字段。

| 时间 | 访问令牌名称 | 模型 | API | 状态码 | 响应(ms) | 字节(KB) | 输入/输出 token | 价格(元) |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 2026-07-08 14:47 | konmgming | Qwen3-4B | 文本对话 | 200 | 638 | 0.51 | 12 / 20 | 0.00 |
| 2026-07-08 14:41 | konmgming | Qwen3-4B | 文本对话 | 200 | 24,828 | 5.16 | 2,171 / 1,046 | 0.00 |
| 2026-07-08 14:41 | konmgming | Qwen3-4B | 文本对话 | 200 | 23,499 | 4.89 | 2,127 / 1,004 | 0.00 |
| 2026-07-08 14:41 | konmgming | Qwen3-4B | 文本对话 | 200 | 23,522 | 4.83 | 2,129 / 982 | 0.00 |
| 2026-07-08 14:40 | konmgming | Qwen3-4B | 文本对话 | 200 | 12,838 | 2.42 | 1,446 / 524 | 0.00 |
| 2026-07-08 14:34 | konmgming | Qwen3-4B | 文本对话 | 200 | 1,300 | 0.69 | 335 / 58 | 0.00 |
| 2026-07-08 14:33 | konmgming | Qwen3-VL-8B-Instruct | 文本对话 | 200 | 1,481 | 0.79 | 322 / 50 | 0.0002 |
| 2026-07-08 14:33 | konmgming | Qwen3-4B | 文本对话 | 200 | 900 | 0.57 | 334 / 35 | 0.00 |

## 4. 证据说明

截图中可见：

- Gitee AI 工作台中的沐曦 Token 资源包处于正常状态。
- 最近调用记录包含 `Qwen3-4B` 与 `Qwen3-VL-8B-Instruct` 两类模型。
- 调用状态码均为 `200`。
- 请求 IP 在平台侧已显示为掩码形式。
- 截图未显示访问令牌明文、API Key、Cookie、完整简历内容或完整模型响应。
