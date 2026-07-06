# 真实调用日志说明

本文说明 Kongming Student Job Matching Agent 的运行日志整理方式、脱敏规则和提交建议。当前仓库未包含可公开的真实模型调用日志，本文件提供模板和生成规范。

## 1. 日志类型

建议区分以下日志：

| 日志类型 | 用途 | 是否建议公开 |
| --- | --- | --- |
| 模型调用日志 | 证明模型服务真实调用、统计耗时和成功率 | 仅公开脱敏版 |
| 前端交互日志 | 记录用户完成哪些功能路径 | 可选，需脱敏 |
| 错误日志 | 排查超时、解析失败、接口失败 | 可公开摘要 |
| 性能统计日志 | 支撑性能测试报告 | 可公开聚合结果 |
| 部署平台日志 | 证明线上环境运行 | 可公开截图或脱敏摘要 |

## 2. 当前仓库日志现状

当前仓库未实现持久化运行日志文件。已有日志来源包括：

- `vite.config.ts` 中本地代理异常日志：`console.error("[ark-dev-proxy]", error)`。
- `scripts/verify-parsers.cjs` 的解析器验证输出。
- `scripts/verify-ui.cjs` 的 UI 验证 JSON 输出和截图。
- 部署平台可能提供的函数日志。

因此，提交前如果需要真实调用日志，应从最终部署环境、模型代理层或人工记录中整理脱敏版本。

## 3. 建议日志保存路径

如需将脱敏日志纳入提交材料，可使用：

```text
logs/runtime-sanitized.jsonl
logs/model-calls-sanitized.jsonl
```

注意：当前 `.gitignore` 会忽略 `*.log`，但不会默认忽略 `.jsonl`。提交前请确认日志已经脱敏。

如果日志中包含任何隐私或密钥，不要提交到仓库，可改为在提交平台上传脱敏文件。

## 4. 日志字段模板

```json
{
  "requestId": "request-id",
  "task": "job-recommendations",
  "model": "model-name",
  "provider": "provider-name",
  "startedAt": "2026-07-06T00:00:00.000+08:00",
  "endedAt": "2026-07-06T00:00:01.000+08:00",
  "durationMs": 1000,
  "status": "success",
  "httpStatus": 200,
  "inputSummary": {
    "resumeChars": 1200,
    "jdChars": 300,
    "imageCount": 0,
    "messageCount": 2
  },
  "outputSummary": {
    "contentChars": 800,
    "jsonParsed": true
  },
  "errorType": "",
  "errorMessage": ""
}
```

以上为日志模板，不是真实调用记录。

## 5. 日志生成方式建议

当前可选方案：

1. 在 `server/arkCore.js` 的 `runArkCompletion` 中增加 requestId、开始时间、结束时间和状态记录。
2. 在部署平台查看 `/api/ark` 函数日志，并人工整理脱敏摘要。
3. 使用浏览器 DevTools Network 记录请求耗时，但不要导出包含敏感请求体的 HAR 文件。
4. 对关键演示流程进行人工计时，并记录到性能测试报告中。

如果需要将日志能力写入代码，应确保：

- 不记录完整简历原文。
- 不记录完整 JD 原文。
- 不记录 API Key 或 Authorization header。
- 不记录用户手机号、邮箱、证件号。
- 不记录浏览器 Cookie。

## 6. 日志脱敏规则

必须脱敏：

- API Key、token、Authorization header。
- 用户姓名、手机号、邮箱、身份证号。
- 学校、公司、住址等可识别个人身份的信息，按提交需要决定是否保留泛化描述。
- 完整简历原文。
- 完整模型响应原文中包含的个人信息。

建议保留：

- 任务类型。
- 模型名称。
- 供应商或算力环境名称。
- 输入字符数。
- 图片数量。
- 响应字符数。
- 是否解析成功。
- 耗时。
- 错误类型。

## 7. 可公开日志样例

```json
{
  "requestId": "demo-001",
  "task": "resume-structure",
  "model": "model-name",
  "provider": "provider-name",
  "durationMs": 0,
  "status": "success",
  "inputSummary": {
    "resumeChars": 980,
    "imageCount": 0
  },
  "outputSummary": {
    "contentChars": 620,
    "jsonParsed": true
  }
}
```

该样例是格式示意，不代表真实测试数据。

## 8. 不可公开字段

不要公开：

```text
Authorization
ARK_API_KEY
完整 prompt
完整简历
完整 JD
浏览器 Cookie
部署平台 token
未脱敏模型响应
```

## 9. 评审查看方式

建议提交材料中提供：

- 一份脱敏 JSONL 日志文件或截图。
- 一份性能测试报告。
- 一段说明，解释日志字段和脱敏规则。
- 如使用目标国产算力环境，需要在日志中保留供应商、模型名、任务类型和调用时间，但不要公开密钥。
