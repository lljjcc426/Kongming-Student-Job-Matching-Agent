const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const nativePage = read("harmony/entry/src/main/ets/pages/NativeIndex.ets");
const nativeHistory = read("harmony/entry/src/main/ets/components/NativeInterviewHistoryWorkspace.ets");
const nativeCapability = read("harmony/entry/src/main/ets/common/NativeCapabilityService.ets");
const nativeJobService = read("harmony/entry/src/main/ets/common/NativeJobService.ets");
const webApp = read("src/App.tsx");
const webInterview = read("src/pages/InterviewPage.tsx");
const webClient = read("src/arkClient.ts");
const webJobApi = read("src/jobApi.ts");
const harmonyBridge = read("src/harmonyBridge.ts");
const publicGateway = read("server/publicGateway.js");

assert.match(nativePage, /启用个性化追问/);
assert.match(nativePage, /关闭时使用标准题库，回答仅保存在本机/);
assert.match(nativePage, /个性化追问暂时不可用，已为你准备标准问题，可继续训练/);
assert.doesNotMatch(nativePage, /Text\([^\n]*(?:interviewModelName|interviewModelServiceMessage|speechProvider\.providerName)/);
assert.doesNotMatch(nativePage, /模型密钥仅保存在服务端|外部模型未授权|模型实时调用失败|支持离线降级|官方 API|官方 ATS/);
assert.doesNotMatch(nativePage, /refreshInterviewModelService|interviewModelServiceTitle|interviewModelServiceState|markInterviewModel|检测服务|重新检测/);
assert.doesNotMatch(nativeHistory, /Text\([^\n]*(?:modelName|assessmentSource|assessmentVersion|jobKey|resumeVersionId)/);
assert.doesNotMatch(nativeHistory, /Text\(\s*session\.videoUri|\$\{\s*session\.videoUri\s*\}/);
assert.doesNotMatch(nativeCapability, /message:\s*['"][^'"]*(?:Core Speech|Core Vision|OCR|模型服务|模型代理)/);

assert.match(nativeJobService, /已找到 \$\{total\} 个相关岗位，当前展示 \$\{jobs\.length\} 个/);
assert.doesNotMatch(nativeJobService, /岗位服务返回状态|个官方来源可用，本次收集/);

assert.match(webApp, /隐私与云端处理/);
assert.doesNotMatch(webApp, /serviceHealth|在线功能：|重新检查|隐私与外部模型说明|模型增强分析|模型增强结果|等待模型解析|模型状态|模型解析进度|Core Vision|Core Speech|后续可接入/);

assert.match(webInterview, /当前浏览器无法使用语音输入，请改用文字回答/);
assert.doesNotMatch(webInterview, /Digital Interview|AI 数字人模拟面试|动态形象暂时不可用|LiveTalking 服务|Web Speech API|模型返回未通过结构校验|已降级/);

assert.doesNotMatch(webClient, /serviceLabel|模型密钥仅保存在服务端|统一业务网关|模型服务暂不可用/);
assert.doesNotMatch(webJobApi, /throw new Error\(payload\.error/);
assert.doesNotMatch(harmonyBridge, /Core Speech|Core Vision|本机 OCR/);
assert.doesNotMatch(publicGateway, /serviceLabel/);

console.log("Product copy boundary verification passed.");
