# 成长闭环交付说明

执行日期：2026-09-20。

本轮优化按照竞品研究报告提出的核心方向，把产品从“岗位匹配与材料准备工具”推进为“证据驱动的职业成长智能体”。重点不是新增一个孤立的评分页，而是把已有的岗位证据、模拟面试和本地隐私能力串成可复测的成长循环。

## 1. 产品主循环

```text
简历解析 → 目标岗位 → 证据匹配 → 岗位面试 → 能力诊断 → 成长任务 → 证据提交 → 复测对比
```

| 环节 | 当前实现 | 证据位置 |
| --- | --- | --- |
| 岗位证据 | 从 `MatchResult.requirementMatrix` 读取未满足、部分满足和待确认要求 | `src/matchEngine.ts` |
| 原生真实岗位追踪 | 用户录入岗位、公司、来源链接和 JD；技能证据只读取简历正文；六阶段投递状态、截止/面试日程、追加式时间线和岗位专属简历版本由 ArkData 持久化；未绑定当前岗位版本时阻止进入已投递、面试或 Offer | `harmony/entry/src/main/ets/pages/NativeIndex.ets`、`harmony/entry/src/main/ets/components/NativeApplicationTracker.ets`、`harmony/entry/src/main/ets/components/NativeResumeVersionPanel.ets`、`harmony/entry/src/main/ets/common/NativeWorkspaceModel.ets` |
| 原生官方岗位检索 | Network Kit 读取可追溯官方岗位，按岗位意图过滤后展示列表和原生详情；服务不可用时保留手动录入 | `harmony/entry/src/main/ets/common/NativeJobService.ets`、`harmony/entry/src/main/ets/pages/NativeIndex.ets` |
| Web 面试诊断 | 面试完成时保留面试类型、回答轮次和反馈等级 | `src/types/interview.ts`、`src/pages/InterviewPage.tsx` |
| 原生 AI 面试诊断 | ArkUI 原生综合面、技术面和 HR 面；会话授权后由 Network Kit 调用 `/api/ark` 生成追问和反馈，发送前脱敏；未授权、未配置或请求失败时明确回退本机规则，并持久化问题、回答、反馈和来源 | `harmony/entry/src/main/ets/common/NativeAiService.ets`、`harmony/entry/src/main/ets/common/NativeWorkspaceModel.ets`、`harmony/entry/src/main/ets/pages/NativeIndex.ets` |
| 成长任务 | 将岗位缺口转换为最多三条实践、面试训练或简历证据任务 | `src/features/growth/growthEngine.ts` |
| 证据审核 | 本地检查个人行动、产出物/结果、文本长度和链接格式 | `src/features/growth/growthEngine.ts` |
| 实证覆盖 | 只有证据审核通过后才更新；预测覆盖与实证覆盖分开 | `src/features/growth/growthEngine.ts`、`src/pages/GrowthPlanPage.tsx` |
| 本地恢复 | 成长计划和审核结果保存到 `localStorage`，刷新后恢复 | `src/features/growth/growthRepository.ts` |
| 鸿蒙原生证据账本 | Network Kit 先核验公开 HTTPS 来源可访问并阻止本机、内网和自定义端口；通过后保存主机、HTTP 状态、核验时间和确定性内容指纹；撤销时任务与实证覆盖回退，但保留审计记录 | `harmony/entry/src/main/ets/common/NativeEvidenceService.ets`、`harmony/entry/src/main/ets/components/NativeEvidenceLedger.ets`、`harmony/entry/src/main/ets/common/NativeWorkspaceModel.ets`、`harmony/entry/src/main/ets/pages/NativeIndex.ets` |
| 鸿蒙原生闭环 | ArkUI 原生成长驾驶舱、投递看板与简历版本管理，ArkData 本机状态、Core Speech 语音交互，以及只同步阶段和摘要行动的 Form Kit 服务卡片 | `harmony/entry/src/main/ets/pages/NativeIndex.ets`、`harmony/entry/src/main/ets/components/NativeApplicationTracker.ets`、`harmony/entry/src/main/ets/components/NativeResumeVersionPanel.ets`、`harmony/entry/src/main/ets/common/NativeCapabilityService.ets` |

## 2. 可信性边界

- `实证覆盖` 不是能力分、录用概率或企业评价，只代表当前计划中已通过本地证据检查的任务增量。
- `预测覆盖` 只是完成剩余任务后的估计，不会被展示为已经掌握的能力。
- 证据审核仍是确定性启发式校验；Network Kit 的 `HTTP 200` 只证明核验时公开地址可访问，本机 `KM-XXXXXXXX` 指纹只用于发现提交内容变化。两者都不等同于数字签名、提交归属、人工审核或外部平台真实性认证。
- 当前实现沿用证据覆盖与岗位要求矩阵，不声称旧版本未实现的“五维能力评分”。
- 外部模型仍受会话级隐私授权控制；未同意时面试和其他模型增强流程必须本地降级，不能偷偷发送敏感内容。
- 模型密钥只在服务端保存；当前 2026-09-21 原生模拟器证据验证的是无密钥可信降级，不代表真实模型成功调用。

## 3. 鸿蒙原生评审演示路径

1. 打开原生 HAP，进入 ArkUI 原生工作台并填写姓名、目标岗位和真实经历。
2. 点击“保存本机简历画像”，展示 ArkData Preferences 持久化和岗位证据矩阵重建。
3. 在岗位页搜索目标岗位，展示官方来源状态、严格意图筛选、原生岗位详情和系统官方投递入口。
4. 将官方岗位保存为本机追踪岗位，或手动录入岗位、公司、来源链接和 JD，展示字段校验和事实约束证据矩阵。
5. 直接尝试进入“已投递”，展示未绑定当前岗位版本时的原生门禁；随后在简历页冻结两个版本，展示差异摘要、绑定切换和当前版本禁删。
6. 回到岗位卡进入“已投递”，填写截止或面试时间，展示绑定版本名称、追加式时间线与强制停止后的本机恢复。
7. 进入“模拟面试”，展示外部模型默认未授权、会话授权和发送前脱敏说明；点击“朗读问题”或“语音回答”，展示 Core Speech 原生能力，不可用时使用文字输入。
8. 完成一轮真实回答；模型服务可用时展示岗位化追问，不可用时展示“本机规则”来源和明确错误提示，再生成反馈与成长任务。
9. 在成长任务中先提交短文本，展示本机确定性证据检查拒绝且实证覆盖不变。
10. 先提交本机或内网 HTTPS 地址，展示来源策略拒绝且覆盖率不变；再提交公开 GitHub 来源，展示 Network Kit 返回状态、任务通过、实证覆盖更新、核验时间和内容指纹。
11. 强制停止并启动应用，展示覆盖率和有效账本记录恢复；随后撤销验证，展示任务与覆盖率回退且账本保留撤销时间。
12. 再次重启确认撤销记录恢复；返回首页点击“分享求职进展”，展示系统 Share Kit 面板。

## 4. 自动化证据

| 命令 | 验证内容 | 结果 |
| --- | --- | --- |
| `npm run verify:growth` | 计划生成、弱证据拒绝、强证据通过、实证/预测覆盖分离、面试复测记录 | 通过 |
| `npm run verify:growth:ui` | 浏览器完成面试、生成计划、提交两次证据、刷新恢复本地计划 | 通过 |
| `npm run verify:ui` | 原有隐私、岗位、简历版本、投递绑定、面试和助手回归 | 通过 |
| `npm run build` | TypeScript 与生产构建 | 通过 |
| `npm run verify:core` | 解析、证据、岗位、HarmonyOS 和发布声明检查 | 通过 |

API 24 模拟器另已完成人工原生回归：未绑定门禁、两版冻结与差异摘要、绑定切换、当前版本禁删、进入已投递，以及强制停止后版本、绑定、阶段和时间线恢复。原生 AI 面试另验证了默认未授权、无密钥明确降级、本机第 2 轮、反馈、成长任务和强制停止后记录恢复；会话授权在重启后按设计清除。原生成长账本验证了私网来源拒绝、GitHub `HTTP 200`、`42% → 51% → 42%` 的即时变化、`KM-543A7715` 指纹、有效/已撤销记录、撤销时间，以及来源元数据和账本状态的强制停止恢复。

本轮浏览器闭环的关键输出：

```text
growth tasks: 1
initial empirical coverage: 0%
rejected evidence coverage: 0%
verified evidence coverage: 9%
restored coverage after refresh: 9%
restored verified tasks: 1
mocked interview requests: 2
```

## 5. 下一阶段优先级

1. 在真实岗位数据和正式简历结构上增加成长任务质量样本，避免只依赖通用 fallback 任务。
2. 在现有公开来源可访问性、用户确认、内容指纹和撤销账本基础上，增加平台 API 提交归属、可信时间戳和人工复核状态。
3. 在桌面实际添加服务卡片，验证阶段、下一行动、杀进程刷新和精准跳转。
4. 在真机上验收账号、OCR、语音和后台恢复，避免把编译通过写成真机能力已验证。
5. 为比赛答辩准备一组同一用户的前后复测样本，展示覆盖率变化、证据引用和隐私授权轨迹，而不是只展示静态页面。
