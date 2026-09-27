# 讯飞星火 API 接入说明

## 接入边界

当前实现支持讯飞星火两种服务端鉴权：

```text
APIPassword -> https://spark-api-open.xf-yun.com/v1/chat/completions
APPID/APIKey/APISecret -> wss://spark-api.xf-yun.com/...（HMAC WebSocket）
```

调用链为：

```text
HarmonyOS NativeAiService / Web arkClient
  -> 项目服务端 /api/gateway?operation=model
  -> server/publicGateway.js
  -> server/modelProvider.js
  -> 讯飞星火 HTTP 或 WebSocket 接口
```

所有讯飞凭证和供应商端点只保存在服务端环境变量与服务端模块中，不进入 Web 构建、HAP、日志或截图。客户端只知道一个公共业务网关；网关返回产品层服务名称，但不返回内部 Provider ID、鉴权方式、上游地址或底层错误。

## 服务端配置

在项目根目录创建不提交 Git 的 `.env.local`。控制台提供 `APPID/APIKey/APISecret` 时使用以下配置：

```bash
AI_MODEL_PROVIDER=iflytek-spark
IFLYTEK_SPARK_APP_ID=替换为APPID
IFLYTEK_SPARK_API_KEY=替换为APIKey
IFLYTEK_SPARK_API_SECRET=替换为APISecret
IFLYTEK_SPARK_MODEL=4.0Ultra
IFLYTEK_SPARK_REQUEST_TIMEOUT_MS=65000
```

如果控制台另行提供 OpenAI 兼容接口 `APIPassword`，也可改用：

```bash
IFLYTEK_SPARK_API_PASSWORD=替换为APIPassword
IFLYTEK_SPARK_BASE_URL=https://spark-api-open.xf-yun.com/v1
```

`APIPassword` 优先级高于 WebSocket 三元组。不要把普通 `APIKey` 填入 `IFLYTEK_SPARK_API_PASSWORD`。三元组模式会在服务端生成短时 HMAC 鉴权 URL，不向客户端返回签名或密钥。

`IFLYTEK_SPARK_MODEL` 必须与账号已开通的模型名称一致。示例中的 `4.0Ultra` 不是对账号权限的承诺。

官方文本接口文档：<https://www.xfyun.cn/doc/spark/Web.html>

## 语音与数字人边界

- `APPID/APIKey/APISecret` 是应用级凭证，但不能证明所有服务都已开通。星火文本、语音听写和在线语音合成必须分别在同一应用下获得授权或额度。
- 语音听写使用独立 WebSocket 协议 `wss://iat-api.xfyun.cn/v2/iat`，文档：<https://www.xfyun.cn/doc/asr/voicedictation/API.html>。
- 在线语音合成使用独立 WebSocket 协议 `wss://tts-api.xfyun.cn/v2/tts`，具体 `vcn` 发音人必须在应用下开通，文档：<https://www.xfyun.cn/doc/tts/online_tts/API.html>。
- “离线数字人合成”是独立 SDK、模型资源和授权产品，不等同于星火文本或在线 TTS API。控制台入口：<https://console.xfyun.cn/services/offline_digital_human>。
- 当前原生应用继续使用 ArkGraphics3D 数字人和 HarmonyOS Core Speech，避免把供应商密钥打入 HAP。接入讯飞语音时应新增服务端语音代理，离线数字人只有在确认 HarmonyOS/ARM64 SDK、授权文件、包体和模型许可后再迁移。

## 视觉模型

模拟面试、简历文本解析、岗位分析和 AI 助手都属于文本任务，可直接使用 `IFLYTEK_SPARK_MODEL`。图片简历不会默认发送给文本模型。

只有账号确实提供兼容的视觉模型时，才配置：

```bash
IFLYTEK_SPARK_VISION_MODEL=账号实际开通的视觉模型名称
```

未配置时，图片简历继续使用 HarmonyOS Core Vision、本机文本层或手动输入，不伪装为星火视觉识别结果。

## 本地验证

```powershell
npm run verify:model-provider
npm run dev -- --port 5173 --strictPort
```

健康检查：

```powershell
Invoke-RestMethod 'http://localhost:5173/api/gateway?operation=status'
```

预期 `services.model` 至少包含：

```json
{
  "configured": true,
  "visionConfigured": false
}
```

真实文本调用可以继续通过现有代理验证：

```powershell
$body = @{
  task = 'career-chat'
  resumeText = '候选人参与过推荐系统项目。'
  userMessage = '请生成一个追问个人行动与验证结果的面试问题。'
  chatMessages = @()
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri 'http://localhost:5173/api/gateway?operation=model' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body
```

成功响应只返回 `content`。Provider ID、供应商名称、模型名称、上游 URL、鉴权模式与供应商错误均不透传到客户端；原生面试档案只记录“标准题库/个性化追问”等产品模式。

## HarmonyOS 联调

服务端启动并完成真实调用验证后：

```powershell
npm run build:harmony:local
npm run run:harmony:emulator
```

本地 HAP 通过 `http://10.0.2.2:5173/api/gateway` 访问宿主机网关。比赛或真机安装包必须先部署公网 HTTPS 网关，再执行 `build:harmony:release` 注入唯一地址。

## 当前验证结论

- 星火 Provider 选择、APIPassword Bearer 鉴权、APPID/APIKey/APISecret HMAC 签名、WebSocket 请求参数、文本模型响应解析、视觉模型门禁和密钥不泄露已通过 Mock 验证。
- 星火公网端点已做无效测试令牌探测并返回预期 `401 Unauthorized`，说明协议路径可达。
- 当前仓库不保存用户提供的真实凭证；凭证只存在于已忽略的本地 `.env.local`。2026-09-23 已确认目标应用可调用 `4.0Ultra`，并在 API 24 模拟器完成原生首题、基于回答追问和结构化反馈验收。
