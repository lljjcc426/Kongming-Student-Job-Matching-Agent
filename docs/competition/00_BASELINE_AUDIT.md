# 竞赛基线审计

审计日期：2026-09-20

## 结论

本轮已将 HarmonyOS 主工作台切换为 ArkUI/ArkTS 原生页面，首页、简历画像、岗位证据、模拟面试和成长任务均由 `NativeIndex.ets` 渲染，并使用 ArkData Preferences 保存本机工作区。旧 React/Web 资源已从默认 HAP 资源目录移除，不能再把当前主应用表述为 ArkWeb 套壳。

业务主链路已经从演示型评分改为可信求职工作台：岗位数据分层、硬性条件门控、要求证据矩阵、事实约束简历改写、隐私授权和本机求职追踪均有实现与测试。

原生岗位页现已支持用户保存真实岗位名称、公司、来源链接和 JD；同时使用 Network Kit 搜索可追溯的企业官方招聘源、打开 ArkUI 原生详情并调用系统打开官方投递链接。技能线索只从简历正文读取，目标岗位、搜索词或 JD 中的要求不会反向被当成候选人已经具备的事实。

## 工程基线

| 项目 | 当前值 |
| --- | --- |
| Bundle Name | `cn.kongming.jobmatch` |
| HarmonyOS SDK | `6.1.1(24)` |
| 设备类型 | default、tablet、2in1 |
| 原生入口 | `EntryAbility` + `pages/NativeIndex.ets` |
| 核心 UI | ArkUI/ArkTS 原生页面，由 `pages/NativeIndex.ets` 渲染 |
| 请求权限 | INTERNET、CAMERA、MICROPHONE（相机和麦克风仅使用时申请） |
| 正式签名 | 未配置 |
| 后端 | 仓库含 `/api/ark`、`/api/jobs`、`/api/job-sources`、`/api/health`；当前 HAP 注入本机联调地址，未注入生产 HTTPS 地址 |

## 已接入原生能力

| 能力 | 实现状态 | 验证状态 |
| --- | --- | --- |
| Account Kit | 华为账号登录、退出和本地调用来源校验 | ArkTS 构建通过；仍需正式签名指纹与真机复验 |
| Core Vision Kit | 图片/PDF 页面优先本机 OCR，失败后才考虑外部视觉模型 | ArkTS 构建通过；模拟器已验证图片 URI 读取和稳定降级，OCR 识别结果需支持该能力的真机复验 |
| Share Kit | 分析报告调用鸿蒙系统分享面板 | ArkTS 构建通过；需在支持该系统能力的设备上完成交互复验 |
| Camera | 原生页面后续接入相机预览，运行时请求 CAMERA | 原生迁移后需重新验收授权与拒绝逻辑 |
| Core Speech Kit | TTS 与短语音识别已接入，原生失败时降级浏览器/文字 | ArkTS 构建通过；真机权限、音频和网络异常待验 |
| Form Kit | 今日行动数据、卡片页面和 `ApplicationFormAbility` 已实现 | `bm dump` 确认 Extension 注册；桌面动态刷新待验 |
| Network Kit | 原生请求 `/api/jobs`，展示官方来源、验证状态、详情和投递入口 | 本机 API 经 `10.0.2.2` 在 API 24 模拟器联调通过；公网 HTTPS 待部署 |

## 原生迁移后的验证边界

- `npm run verify:harmony` 已改为检查 ArkUI 页面、ArkData Preferences、原生导航和默认 HAP 不包含 `resfile`。
- 当前工作机已安装 DevEco Studio/Hvigor；`npm run build:harmony` 已完成 ArkTS 编译和 HAP 打包，源码中文路径由 D 盘 ASCII staging 规避。
- `ApplicationCard.ets` 继续使用 Form Kit；下一步把成长驾驶舱的下一行动和完成度同步到原生服务卡片。

## 最新产物

- 路径：`harmony/entry/build/default/outputs/default/entry-default-unsigned.hap`
- 大小：1,348,090 bytes
- SHA-256：`E1E3D965770590624E1035789C83F794253D7B9D1DB11FBA744EFC19E3A9DFA2`
- API 24 模拟器覆盖安装：成功
- `EntryAbility` 首次和二次启动：成功
- 原生开场动效截图：`docs/evidence-screenshots/harmony-native-intro-20260920.jpeg`
- 运行截图：`docs/evidence-screenshots/harmony-native-emulator-home-20260920.jpeg`
- 真实岗位录入截图：`docs/evidence-screenshots/harmony-native-job-tracking-20260920.jpeg`
- 岗位字段校验截图：`docs/evidence-screenshots/harmony-native-job-validation-20260920.jpeg`
- 官方岗位列表截图：`docs/evidence-screenshots/harmony-native-official-jobs-20260920.jpeg`
- 原生岗位详情截图：`docs/evidence-screenshots/harmony-native-job-detail-20260920.jpeg`
- 岗位服务降级截图：`docs/evidence-screenshots/harmony-native-job-offline-fallback-20260920.jpeg`

## 官方能力依据

- [HarmonyOS 文档中心](https://developer.huawei.com/consumer/cn/doc/)
- [Core Vision Kit](https://developer.huawei.com/consumer/cn/sdk/core-vision-kit)
- [Core Speech Kit](https://developer.huawei.com/consumer/cn/sdk/core-speech-kit)
- [Form Kit](https://developer.huawei.com/consumer/cn/sdk/form-kit/)
- [Share Kit](https://developer.huawei.com/consumer/cn/sdk/share-kit/)
