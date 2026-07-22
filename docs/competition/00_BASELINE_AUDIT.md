# 竞赛基线审计

审计日期：2026-07-22

## 结论

当前项目已经是可重复构建、可安装并可启动的 HarmonyOS HAP，但产品形态属于“ArkUI 原生容器 + ArkWeb 本地业务包 + 原生能力桥接”的混合架构，不能表述为五个核心页面均已 ArkUI 原生实现。

业务主链路已经从演示型评分改为可信求职工作台：岗位数据分层、硬性条件门控、要求证据矩阵、事实约束简历改写、隐私授权和本机求职追踪均有实现与测试。

## 工程基线

| 项目 | 当前值 |
| --- | --- |
| Bundle Name | `cn.kongming.jobmatch` |
| HarmonyOS SDK | `6.1.1(24)` |
| 设备类型 | default、tablet、2in1 |
| 原生入口 | `EntryAbility` + `pages/Index.ets` |
| 核心 UI | React/Vite 静态资源随 HAP 打包，由 ArkWeb 本地加载 |
| 请求权限 | INTERNET、CAMERA、MICROPHONE（相机和麦克风仅使用时申请） |
| 正式签名 | 未配置 |
| 后端 | 仓库含 `/api/ark`、`/api/jobs`、`/api/job-sources`、`/api/health`；当前 HAP 注入本机联调地址，未注入生产 HTTPS 地址 |

## 已接入原生能力

| 能力 | 实现状态 | 验证状态 |
| --- | --- | --- |
| Account Kit | 华为账号登录、退出和本地调用来源校验 | ArkTS 构建通过；仍需正式签名指纹与真机复验 |
| Core Vision Kit | 图片/PDF 页面优先本机 OCR，失败后才考虑外部视觉模型 | ArkTS 构建通过；模拟器是否具备运行时系统能力需用实际图片复验 |
| Share Kit | 分析报告调用鸿蒙系统分享面板 | ArkTS 构建通过；需在支持该系统能力的设备上完成交互复验 |
| Camera | ArkWeb 视频采集只对本地页面授权，运行时请求 CAMERA | 既有模拟器流程已覆盖授权与拒绝逻辑 |
| Core Speech Kit | TTS 与短语音识别已接入，原生失败时降级浏览器/文字 | ArkTS 构建通过；真机权限、音频和网络异常待验 |
| Form Kit | 今日行动数据、卡片页面和 `ApplicationFormAbility` 已实现 | `bm dump` 确认 Extension 注册；桌面动态刷新待验 |

## 最新产物

- 路径：`harmony/entry/build/default/outputs/default/entry-default-unsigned.hap`
- 大小：34,324,777 bytes
- SHA-256：`728B5635495DB019DC5C9D34E72CB4745584D4FBAA98F78500C8D6AE7C265A28`
- API 24 模拟器覆盖安装：成功
- `EntryAbility` 首次和二次启动：成功
- 运行截图：`docs/evidence-screenshots/harmony-emulator-home-20260722.jpeg`

## 官方能力依据

- [HarmonyOS 文档中心](https://developer.huawei.com/consumer/cn/doc/)
- [Core Vision Kit](https://developer.huawei.com/consumer/cn/sdk/core-vision-kit)
- [Core Speech Kit](https://developer.huawei.com/consumer/cn/sdk/core-speech-kit)
- [Form Kit](https://developer.huawei.com/consumer/cn/sdk/form-kit/)
- [Share Kit](https://developer.huawei.com/consumer/cn/sdk/share-kit/)
