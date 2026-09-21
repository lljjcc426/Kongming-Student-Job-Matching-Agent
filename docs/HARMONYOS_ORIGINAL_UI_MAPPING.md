# 孔明职配原版到鸿蒙版映射

## 迁移原则

鸿蒙版采用 ArkUI/ArkTS 原生优先架构，不再把 Web 页面作为 HAP 主界面：

1. `harmony/entry/src/main/ets/pages/NativeIndex.ets` 是 HarmonyOS 主界面和核心交互的唯一入口。
2. ArkData Preferences 保存简历画像、岗位证据、面试记录和成长任务；原生页面不依赖远程网页。
3. `src/` 和 `public/` 作为 Web 产品参考与迁移素材保留，只有显式执行 Web 兼容构建时才生成 `resfile`。
4. 功能拓展必须优先进入 ArkUI/ArkTS 原生模块，并保持原有信息架构，不另造一套风格或一级导航。

## 设计基准

鸿蒙版不重新发明一套视觉语言。以下元素以现有 Web 产品为基准：

- 浅蓝科技背景、蓝青渐变主色、白色半透明卡片和细蓝描边。
- 孔明机器人 IP、`孔明职配 / 学生求职智能工作台` 品牌组合。
- 首页、简历解析、岗位推荐、模拟面试、AI 助手五个一级入口。
- 中文主标题配英文功能眉题，例如 `Profile / 学生画像`、`Matching / 岗位匹配工作台`。
- 功能页采用“状态概览 + 工作区 + AI 结论/操作”的信息层次。

原版运行截图保存在 `docs/evidence/web-original-*-desktop.png` 和
`docs/evidence/web-original-home-mobile.png`，作为后续视觉回归基线。

## 功能映射

| 原版模块 | 当前原生实现 | 后续原生拓展位置 |
| --- | --- | --- |
| 首页 | ArkUI 原生职业成长驾驶舱、覆盖率和今日行动 | 与账号、本机简历和服务卡片联动 |
| 简历画像 | ArkUI 原生事实输入、目标岗位和 ArkData 持久化 | 系统文件选择、Core Vision OCR、分享/导出 |
| 岗位证据 | ArkUI 原生官方岗位搜索、来源状态、岗位列表、详情、系统投递入口，以及真实岗位表单、JD 本机保存和事实约束要求矩阵 | 公网 HTTPS 服务、分页与收藏历史 |
| 模拟面试 | ArkUI 原生综合面/技术面/HR 面、回答、本机复盘、Core Speech 朗读和语音输入 | 相机权限、后台中断恢复 |
| 成长任务 | ArkUI 原生成长任务、证据提交和实证覆盖 | 原生模型服务、文件/仓库证据和复测历史 |
| AI 助手 | 后续以 ArkUI 原生对话页实现 | 网络状态、授权提示和安全的服务端模型调用 |

## 当前验收边界

- 已完成原生静态入口检查：`NativeIndex.ets` 不包含 `Web({})`、`ArkWeb` 或远程页面加载调用。
- 已完成原生状态检查：ArkData Preferences 保存简历画像、岗位证据、面试和成长任务，Form Kit 只同步摘要数据。
- 已完成原生能力接线：Account Kit、Share Kit、Core Speech 已从原生页面触发；Core Vision OCR 服务已保留在原生服务层，图库 `PhotoViewPicker` 和文件 `DocumentViewPicker` 均已接入。
- 已完成原生岗位链路：Network Kit 请求官方岗位 API，ArkUI 展示列表与详情，系统 Want 打开官方投递链接；服务不可用时明确降级为本机录入。
- 当前工作机已在 D 盘安装 DevEco Studio 6.1.1.290，原生 ArkTS 编译、unsigned HAP 打包、模拟器安装和图片 URI 读取已通过；由于源码路径含中文，构建脚本使用 D 盘 ASCII staging。当前仍缺支持 Core Vision 的真机 OCR 和正式签名证据。
- 旧混合版本截图仍保存在 `docs/evidence/kongming-hybrid-*.jpeg`，仅作为迁移前基线。

## 信息架构约束

- “真实岗位雷达”属于“岗位推荐”页，不替代原来的岗位推荐模块。
- “隐私”不再占用一级导航；授权状态、数据边界和清除操作放在涉及个人数据的页面内。
- “可解释匹配”属于岗位推荐结果，不再单独占用一级导航。
- 企业端不进入本阶段，产品仍以互联网方向求职者为主。
- 示例内容只能用于解释界面，不得伪装成真实招聘信息；真实岗位必须保留来源与官网入口。
