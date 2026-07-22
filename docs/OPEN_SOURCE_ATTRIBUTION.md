# 开源来源说明

本文用于记录 Kongming Student Job Matching Agent 涉及的开源参考来源、使用范围和原创性说明。公开发布前维护者应根据最终代码、素材和依赖再次核对 License。

第三方依赖和素材 License 的集中核对表见 `docs/THIRD_PARTY_LICENSES.md`。

## 1. 项目原创性说明

孔明职配不是对某个开源项目的直接复制或简单改名。当前仓库采用自研的 React/Vite Web 工作台、轻量智能体运行时、岗位证据推理、事实约束简历改写、JD 分析流程和模拟面试交互。

开源项目主要用于前期调研和能力拆解，帮助确定产品边界和功能取舍。

本项目为 Nanshan von Neumann Team 面向学生求职匹配场景开发的 AI 智能体 Demo。项目核心包括简历解析、岗位推荐、JD 分析、匹配解释、简历优化、模拟面试和 AI 求职助手等功能。

本仓库当前公开发布目的为本次竞赛提交、评审展示、可复现检查和学习参考。参赛、评审、商业展示、二次分发或修改版本应保留原始项目来源、Apache License 2.0 文本、NOTICE 文件和作者/团队署名。

## 2. 参考项目

| 参考项目 | 链接 | 参考范围 | 本项目改造与扩展 |
| --- | --- | --- | --- |
| Resume Matcher | https://github.com/srbhr/resume-matcher | 简历与 JD 匹配、关键词建议、简历优化闭环的产品思路 | 面向学生求职场景重构为画像、岗位推荐、JD 分析和模拟面试一体化工作台 |
| OpenResume | https://github.com/xitanggg/open-resume | 简历解析入口、隐私友好体验、无登录使用思路 | 当前项目未复用其代码，采用 PDF.js 与模型结构化解析实现简历理解 |
| Reactive Resume | https://github.com/AmruthPillai/Reactive-Resume | 简历工具的信息组织和自托管思路 | 当前项目不做完整简历模板编辑器，聚焦岗位匹配和求职建议 |
| ResumeLM | https://github.com/olyaiy/resume-lm | AI 简历助手、ATS/关键词优化的展示思路 | 当前项目将关键词优化扩展到岗位推荐、JD 分析和模拟面试 |
| AIHawk | https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk | 求职流程编排和行动链路思路 | 当前项目不做自动投递，保留人工确认和投递准备建议 |
| career-ops | https://github.com/santifer/career-ops | 岗位评估、材料定制、申请流程追踪思路 | 当前项目融合为岗位深度评估、要求匹配表和投递运营看板 |

## 3. 第三方依赖

当前项目依赖主要来自 npm，完整版本以 `package.json` 和 `package-lock.json` 为准。

| 类型 | 依赖 | 用途 |
| --- | --- | --- |
| 前端框架 | `react`、`react-dom`、`vite` | Web 应用和构建 |
| PDF 解析 | `pdfjs-dist` | PDF 简历文本层读取和页面渲染 |
| Markdown | `react-markdown`、`remark-gfm` | 模型分析内容渲染 |
| 图表 | `recharts` | 首页演示型可视化；业务结论以证据矩阵为准 |
| 视觉与动效 | `gsap`、`animejs`、`three`、`@react-three/fiber` | 首页、加载页和 AI 助手视觉效果 |
| Live2D | `pixi.js`、`pixi-live2d-display`、`@hazart-pkg/live2d-core` | 模拟面试数字人展示 |
| 图标 | `lucide-react`、Font Awesome | UI 图标 |
| 验证 | `playwright` | UI 自动化验证 |

后续建议维护者根据依赖许可证要求补充更细的第三方 License 列表。

## 4. 静态素材说明

当前仓库包含：

- `public/kongming-ip.png`
- `src/assets/*.png`
- `src/assets/*.mp4`
- `public/avatars/interviewer-2d/interviewer.png`
- `public/avatars/interviewer-live2d/*`
- `public/vendor/pdfjs/cmaps/*`
- `public/vendor/live2d/live2dcubismcore.min.js`

公开发布前需要确认：

- 图片和视频素材的生成来源或授权方式。
- Live2D 模型和 Cubism runtime 的授权边界。
- PDF.js CMap 资源的 License 要求。
- 是否需要在公开说明中补充素材来源。

## 5. License 注意事项

当前仓库根目录包含 `LICENSE`，内容为 Apache-2.0。该 License 适用于本仓库原创代码的开源授权。

第三方依赖和素材仍需遵循其各自许可证，不能仅用本仓库 License 覆盖外部资源授权。

当前仓库根目录包含 `NOTICE`，用于记录原始仓库、版权主体和项目贡献者署名。重新分发或修改版本应保留 `NOTICE` 和 Apache License 2.0 正文。

项目名称、截图、文档、PPT、演示材料、品牌标识和非代码素材不因原创代码采用 Apache-2.0 而自动放弃署名权或其他未明确授予的权利。

## 6. 后续补充项

建议继续补充以下内容：

- 正式第三方依赖 License 汇总。
- 自制或生成素材的来源说明。
- Live2D 模型素材来源和授权说明。
- 已接入 Gitee AI / 沐曦 Token 资源包的 OpenAI 兼容 API；当前实现未引入额外 SDK，仅使用标准 `fetch` 调用服务端代理。
