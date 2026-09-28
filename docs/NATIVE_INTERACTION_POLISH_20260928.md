# 鸿蒙原生交互打磨记录

日期：2026-09-28（北京时间）。本轮只修改 ArkTS / ArkUI 原生端及其回归检查，没有重新调整网页版或部署后端。

## 本轮修改

1. 横屏文字回答使用键盘紧凑布局：缩小间距和问题摘要，降低输入框最小高度，压缩提交区；校验信息与字数复用底部提示区，避免额外错误行把提交按钮推出视口。
2. 保留唯一输入面板和稳定输入节点；失焦只做回答校验，不提前重置键盘状态。实际键盘高度事件或主动关闭操作负责收起布局，减少点击提交时的目标位移。
3. 简历和回答字数、企业偏好、默认岗位、面试轮数及难度提示，改为在 Builder 内通过回调读取当前状态，避免使用被冻结的初始字符串。
4. 麦克风未授权或识别失败时展示明确的产品提示，提供“改用文字回答”入口；不清空已输入的回答，不展示服务商或后台错误码。
5. 修复全屏提示、镜头及控制层的触摸拦截，使镜头入口可以被点击。镜头入口使用原生 Button；权限失败后停止加载动画，提供重试和关闭入口；开启与资源释放状态可响应更新，避免关闭后按钮一直不可用，录像仍须用户主动开启。

## 已完成验证

- Release 构建成功，仍有既有异常处理、弃用 API 和正式签名未配置警告。
- `npm run verify:core`、原生项目回归及 27 个面试模式契约组合通过；契约组合并非 27 场设备联网面试。
- 独立测试实例 `KongMing_Cloud_API24` / `127.0.0.1:10555` 实测：匿名简历 143 字修改为 157 字时，提示立即刷新为 `157/4000`，保存和升级后仍正确。
- 点击镜头可触发系统相机授权；选择“不允许”后显示“相机未授权，可继续面试”，没有持续加载动画，重试和关闭均可操作。最终包复核关闭后的开启按钮重新启用，再次开启仍可正确展示权限提示。
- 已拒绝的麦克风权限被准确提示，点击“改用文字回答”可继续录入。短答案 2 字时提交禁用；有效答案 86 字时字数同步、焦点保留、提交启用，点击提交进入下一轮。
- 标准题库的单轮交互测试可提前结束并生成本机报告；两次此前的匿名云端面试记录及 3 项成长任务仍保留。此次没有开启新增的云端个性化面试生成。
- 最终覆盖安装前后，独立测试实例持久化文件的聚合 SHA256 一致；启动后仍保留 3 次匿名训练记录和 157 字资料。
- 本轮原模拟器未连接，没有启动、覆盖安装或清空原模拟器资料；此前的其他未提交修改保留，未执行提交或推送。

## 明确的验收限制

键盘紧凑布局已实现、编译并加入结构性回归，但不能宣称软键盘展开后的提交区实测通过。

本轮测试时，模拟器输入法没有显示键盘窗口，并出现输入会话为空的系统日志。重启隔离设备并检查输入法配置后仍未恢复。系统设置“添加其他网络”的输入框也出现相同情况：输入框已聚焦，但没有输入法窗口。因此本轮使用程序化文字输入验证了计数、校验和提交，没有将其冒充成软键盘验收。

需要在输入法正常的模拟器或鸿蒙真机上补测：键盘展开时字数与提交区是否可见、点击提交是否稳定、连续输入与关闭再打开是否保留草稿。不得通过隐藏模拟器问题或强行修改生产状态来宣称通过。

相机和麦克风仅验证授权拒绝及恢复路径，没有授权真实采集；真实语音、摄像头预览、录像、真机弱网及进行中面试的再次联网授权仍待后续验收。

## 安装包

`output/native-interaction-polish-20260928/kongming-harmony-cloud-unsigned.hap`

- 原生 Release，已安装到独立测试实例；未配置正式签名，不是正式上架包。
- 大小：13,030,437 字节。
- SHA256：`9d27eab1d80977e244f01f0c587d572b68a3a90ee9c3e8a4e1f7043466db7a53`。
- 使用既有云端 HTTPS 网关，未扩大发布或来源放行范围。

## 证据

D 盘 `tmp/native-interaction-polish-20260928/` 保存构建、回归、布局和匿名状态文件，不进入 Git：

- `resume-count-updated.json`、`resume-saved.json`、`final-package-resume.json`、`final-package-resume.jpeg`。
- `camera-permission-request.json`、`camera-denied-recoverable.json`、`camera-retry-result.json`、`camera-closed.json`。
- `camera-final-closed-enabled.json`、`camera-final-reopened.json`、`camera-final-reopened.jpeg`、`synthetic-after-camera-final.xml`。
- `final-microphone-notice.json`、`final-valid-answer.json`、`final-answer-submitted.json`。
- `system-keyboard-comparison-result.json`：系统输入框聚焦且无输入法窗口的对照证据。
- `release-camera-state-build.txt`、`core-final-regression.txt`、`native-contracts-final.txt`。
- `synthetic-final-workspace.xml`、`test-workspace-before-final-install.sha256`、`test-workspace-after-final-install.sha256`。
