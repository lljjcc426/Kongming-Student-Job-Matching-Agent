# 演示材料与证据指南

本文用于整理 Kongming Student Job Matching Agent 的演示材料、运行截图、调用日志和公开查看顺序。当前文件只记录可公开材料和待补充项，不包含虚假的视频链接或截图路径。

所有演示材料的最终路径统一汇总到 `docs/EVIDENCE_INDEX.md`，后续只需要在该索引中补充真实视频链接、截图路径和日志路径。

## 1. Demo 视频链接

后续补充：

```text
Demo 视频链接：待补充
```

建议视频时长控制在 3 分钟以内，优先展示完整求职闭环，而不是只展示首页动效。

## 2. 运行截图路径

当前仓库未包含正式运行截图目录。

建议后续补充以下截图：

| 截图 | 建议内容 | 建议文件名 |
| --- | --- | --- |
| 首页 | 产品名称、入口和核心定位 | `screenshots/01-home.png` |
| 简历解析 | 上传简历后的学生画像 | `screenshots/02-resume-profile.png` |
| 岗位推荐 | 推荐岗位和匹配评分 | `screenshots/03-job-matching.png` |
| JD 分析 | 自定义 JD 分析结果 | `screenshots/04-jd-analysis.png` |
| 报告导出 | Markdown 报告下载或内容预览 | `screenshots/05-report.png` |
| 模拟面试 | AI 面试官、问题和回答输入 | `screenshots/06-interview.png` |
| 面试反馈 | 评分、改进点和优化回答 | `screenshots/07-interview-feedback.png` |
| AI 助手 | 多轮求职问答 | `screenshots/08-ai-assistant.png` |

如果使用 `npm run verify:ui` 生成截图，默认输出目录为 `artifacts/`。该目录已被 `.gitignore` 排除，公开使用前需要复制合适截图并确认不含隐私信息。

## 3. 核心功能演示步骤

建议演示顺序：

1. 打开首页，说明项目定位：学生求职岗位匹配与简历优化智能体。
2. 进入简历解析页面，上传文本简历或粘贴简历内容。
3. 展示学生画像、结构化经历、技能和求职方向。
4. 展示系统生成的岗位推荐列表。
5. 选择一个岗位，展示匹配评分、关键词覆盖、优势、风险和行动建议。
6. 输入目标岗位 JD，展示二次岗位分析结果。
7. 下载 Markdown 分析报告。
8. 进入模拟面试页面，选择综合面、技术面或 HR 面。
9. 输入或语音转写一段回答，展示面试反馈。
10. 进入 AI 助手页面，基于当前简历和岗位提出求职问题。

## 4. 示例输入输出

### 示例简历输入

```text
姓名：陈雨
学校：华东师范大学
专业：心理学 本科
求职意向：用户研究实习生 / 心理测评产品实习生
项目经历：完成大学生压力与睡眠质量调查项目，使用 SPSS 分析 286 份问卷。
校园经历：担任心理协会活动负责人，组织心理健康主题沙龙。
技能：SPSS、问卷设计、访谈、数据分析。
```

### 示例 JD 输入

```text
岗位名称：用户研究实习生
岗位 JD：负责用户访谈、问卷设计、需求洞察和调研报告输出，要求具备数据分析能力。
```

### 预期展示结果

- 学生画像。
- 推荐岗位。
- 匹配评分。
- 关键词覆盖。
- 简历优化动作。
- 模拟面试问题和反馈。
- AI 助手求职建议。

## 5. 真实调用日志路径

当前仓库已补充可公开的 Gitee AI / 沐曦 Token 资源包调用证据。

如后续需要追加 JSONL 日志，可补充：

```text
logs/runtime-sanitized.jsonl
```

或单独提供脱敏后的日志文件。

日志格式和脱敏规则见：

```text
docs/RUNTIME_LOG_GUIDE.md
```

## 6. 性能测试报告路径

当前仓库记录已验证结果和待追加测试项：

```text
docs/PERFORMANCE_TEST_REPORT.md
```

后续可根据最终部署环境继续补充真实数据，例如：

- 首屏加载时间。
- 简历结构化耗时。
- 岗位推荐耗时。
- JD 分析耗时。
- 模拟面试反馈耗时。
- 模型调用成功率。

不要使用估算数据或未经验证的数据。

## 7. 资料查看顺序

建议按以下顺序查看材料：

1. `README.md`
2. `docs/PROJECT_ARCHITECTURE_AND_UNDERSTANDING.md`
3. `docs/TECHNICAL_DESIGN.md`
4. `docs/DEPLOYMENT_GUIDE.md`
5. `docs/EVIDENCE_INDEX.md`
6. `docs/REAL_MODEL_CALL_EVIDENCE.md`
7. `docs/PERFORMANCE_TEST_REPORT.md`
8. Demo 视频链接和运行截图。
9. 脱敏真实调用日志。
10. Git commit 历史。

## 8. 脱敏提醒

演示材料中不得出现：

- 真实 API Key。
- 用户手机号、邮箱、身份证号。
- 未授权的真实简历原文。
- 真实招聘账号、Cookie 或登录态。
- 未脱敏的模型请求体和响应体。

当前已补充 Gitee AI / 沐曦 Token 资源包真实调用证据，见 `docs/REAL_MODEL_CALL_EVIDENCE.md` 和 `docs/evidence-screenshots/gitee-ai-real-call-record-20260708.png`。后续展示真实调用时仍应使用摘要化字段，例如输入字符数、任务类型、模型名、耗时、成功状态和脱敏输出片段。
