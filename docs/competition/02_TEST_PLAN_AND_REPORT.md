# 测试计划与本轮报告

执行日期：2026-07-22。完整命令输出、环境和 HAP 哈希见 [构建与运行证据](../RELEASE_EVIDENCE_20260722.md)。

## 自动化矩阵

| 命令 | 覆盖 | 结果 |
| --- | --- | --- |
| `npm run build` | TypeScript、React/Vite 生产构建 | 通过 |
| `npm run verify:parsers` | 简历、JD 和模型输出解析 | 通过 |
| `npm run verify:evidence` | 硬条件、证据矩阵、20 组对抗样例、脱敏、工作区、版本和投递绑定 | 通过 |
| `npm run verify:jobs` | 岗位采集、字段归一化、去重与分页 | 通过 |
| `npm run verify:job-sources` | 官方来源和 ATS 适配器 | 通过 |
| `npm run verify:harmony` | Harmony 工程、权限、账号/OCR/分享/语音/Form 桥接与资源路径 | 通过 |
| `npm run verify:claims` | 源码和 HAP 静态资源中的旧伪评分残留 | 通过 |
| `npm run verify:ui` | 隐私、岗位分层、证据确认、版本保存、投递绑定、刷新恢复、面试和助手 | 通过 |
| `npm run build:harmony:local` | Web 同步、ArkTS 编译、HAP 打包和哈希 | 通过 |
| `npm run run:harmony:emulator` | HDC、反向端口、安装和首次启动 | 通过（冷启动） |
| `aa force-stop` 后再次 `aa start` | 二次启动 | 通过 |

## 事实约束断言

- 未确认简历不能直接通过硬性学历门槛。
- “尚未使用 Python”不能被识别为掌握 Python。
- 重复无关文字不能提高证据覆盖。
- 城市偏好不能改变专业证据覆盖。
- 简历没有的技能、职责、量化结果、上线经历、奖项和管理经历不得进入自动生成修改稿。
- 20 组缺失能力必须进入学习计划，而不是技能栏。
- 无修改、占位符、空内容、无 Evidence ID、失效 Evidence ID 都会阻止投递稿生成。
- 用户编辑修改项后，原接受状态会立即撤销，必须重新确认。
- 分析报告只把验证通过的修改放入“已确认投递稿”，其他建议明确标记为不得直接投递。

## 版本与投递闭环

已验证：

1. 保存版本前必须通过事实检查；
2. 版本包含名称、岗位、创建时间、差异摘要、证据确认项和原文指纹；
3. 同岗位、同原文的版本可恢复到修改区；
4. 原文或岗位变化时拒绝直接恢复，只允许复制查看；
5. 版本可删除；已绑定投递记录的版本禁止直接删除；
6. 投递记录必须绑定当前岗位的版本后才能进入“已投递”；
7. 页面刷新后简历、版本、投递阶段和版本绑定仍存在；
8. 损坏的工作区 JSON 会安全回退到空工作区。

## UI 回归摘要

本轮实际输出：

```text
外部模型隐私选项：5
隐私同意前模型请求：0
测试敏感数据泄漏：false
测试已验证岗位：1
测试职业方向：6
修改建议：3
接受修改：1
保存版本：2
删除未绑定旧版本后剩余：1
版本差异摘要：相较上一版本新增 1 行、移除 0 行
刷新后恢复版本：1
投递阶段：applied
投递版本绑定：存在
```

UI 测试使用 Mock API，只证明页面与本机数据闭环；不证明公网岗位或真实模型服务可用。

## HarmonyOS 验收摘要

```text
HAP bytes: 34,324,777
SHA-256: 728B5635495DB019DC5C9D34E72CB4745584D4FBAA98F78500C8D6AE7C265A28
install bundle successfully
first start: successfully
force stop: successfully
second start: successfully
```

模拟器：Pura 90 Pro，HarmonyOS 6.1.1(24)，API 24，x86_64。

本轮首先复现了快照启动后 Guest OS 已完成启动但 HDC 仍为 Offline。改为 cold boot 后 HDC 连接和安装恢复。运行脚本现已默认冷启动，并会自动恢复运行中但 HDC 离线的实例。

`bm dump` 已确认 `EntryAbility` 和 `ApplicationFormAbility` 注册，但桌面卡片动态刷新仍需人工添加卡片后验证。

## 尚需人工/真机测试

- 华为账号真实登录、取消、退出和签名指纹校验；
- 真实中文简历图片 OCR；
- Share Kit 成功、取消和异常回调；
- 麦克风首次授权、拒绝、录音、停止、中英混合、后台和网络异常；
- TTS 播放停止以及与录音互斥；
- 服务卡片添加、动态刷新、杀进程后存续和精准跳转；
- 手机、平板和 2in1 布局；
- 公网 HTTPS 岗位与模型服务注入后的 HAP 端到端链路；
- 正式签名和发布包安装。
