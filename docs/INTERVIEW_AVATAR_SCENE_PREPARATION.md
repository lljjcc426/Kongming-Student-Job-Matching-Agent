# 模拟面试人物与场景素材准备规范

更新时间：2026-09-26

## 当前结论

默认人物已切换为 Microsoft Rocketbox `Business_Female_04`，采用“MIT 授权角色资产 + 自动化移动端处理 + HarmonyOS 原生实时驱动”的路线。新人物是更亲和的女性商务面试官，场景继续使用明确 CC0 许可的真实现代办公室照片，不建设完整 3D 办公室。

图片生成仅用于办公室背景和人物风格参考，不能代替最终实时人物模型。最终人物必须是 GLB/glTF 2.0，并具有骨骼和面部 Morph Target。

## 技术验证结果

| 项目 | AI-Avatar 旧人物 | Ready Player Me v3 | Rocketbox v5 |
| --- | ---: | ---: | ---: |
| 文件大小 | 12.34 MB | 5.73 MB | 8.52 MB |
| 三角面 | 180,346 | 9,160 | 8,270 |
| 骨骼 | 52 | 38 | 80 |
| 面部 Morph Target | 0 | 72 | 从 175 个中保留 28 个运行时目标 |
| Oculus Viseme | 0/15 | 15/15 | 15/15 |
| 授权状态 | 预设人物来源证据不足 | 生成平台条款需单独核验 | Microsoft Rocketbox MIT |

Ready Player Me v3 仅保留为本机技术对比资产，不进入发布包。旧的 `npm run build:avatar:lipsync` 命令依赖本机 `scripts/assets/professional-interviewer-v2.glb`；该历史素材不随公开仓库分发，也不是当前构建和校验的前置条件。Rocketbox v5 具备明确 MIT 授权、自然亲和的商务形象、完整面部绑定和移动端可控的面数；严格模型检查、原生构建、覆盖安装、材质与横屏构图均已通过 API 24 模拟器回归。证据见 `docs/evidence-screenshots/harmony-native-avatar-rocketbox-v5-20260926.jpeg`。

HarmonyOS 6.1 的 ArkGraphics3D 从 API 20 开始提供 `Geometry.morpher.targets`。v5 由 ArkTS 按面试状态实时写入 15 个 viseme、眨眼和克制表情权重，并以 30 FPS 驱动轻微头部运动；不依赖 WebView 或浏览器 3D 引擎。生成器会裁剪未使用的 FACS/追踪器目标、嵌入 1K 纹理，并补齐形变目标的零 `NORMAL/TANGENT` 增量和基础切线，避免 GPU morph 管线激活后破坏光照。

当前默认人物生成命令：

```powershell
npm run build:avatar:rocketbox
node scripts/inspect-avatar-glb.cjs harmony/entry/src/main/resources/rawfile/avatar/professional-interviewer-v5.glb --strict
```

来源与实现依据：

- [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox)：MIT 许可证，`Business_Female_04_facial` 包含 15 个 viseme、ARKit、FACS 和 tracker blendshape；来源固定到 commit `0943055db6ec570bcef9f2c8b41c9e5467c808f9`。
- [Ready Player Me Three.js 示例](https://github.com/egemenertugrul/wolf3d-readyplayerme-threejs-boilerplate)：MIT 代码仓库，包含带 72 个 Morph Target 的测试 GLB。
- [Ready Player Me 说话动画示例](https://github.com/crazyramirez/readyplayer-talk)：展示 ARKit Morph Target、音频幅度口型和身体动画混合方法。
- [Ready Player Me Blender 工具](https://github.com/RobeSantoro/ReadyPlayerMe-Blender-Tools)：公开列出 15 个 Oculus Viseme 和 52 个 ARKit BlendShape。
- 本机 HarmonyOS SDK：`@ohos.graphics.scene.d.ts` 与 `SceneResources.d.ts` 中的 `Geometry.morpher`、`Morpher.targets` 定义。

公开仓库许可证只自动覆盖相应仓库中的代码和明确包含的内容，不能代替角色生成平台当前服务条款。最终角色需要单独保存生成记录和授权证据。

## 人物视觉规格

- 东亚面孔，年龄感 28 至 38 岁，专业但不过度严肃。
- 半写实风格，比例接近真人，避免大头、卡通眼和明显游戏 NPC 质感。
- 商务休闲着装，深灰、藏蓝或低饱和中性色，材质以哑光为主。
- 默认胸像或坐姿半身构图，眼睛位于画面高度约 35%。
- 自然肤质，控制高光，避免当前人物的塑料感和镜面西装。
- 表情克制，主要通过眨眼、轻微点头、呼吸和小幅视线变化体现生命感。
- 不携带品牌、公司标识、文字、徽章或受保护制服元素。

## 人物技术门槛

- GLB 或 glTF 2.0，单文件优先。
- 至少一套 humanoid 骨骼，骨骼名称稳定。
- 必须包含 15 个 Oculus Viseme，推荐同时包含 52 个 ARKit BlendShape。
- 必须包含 `eyeBlinkLeft`、`eyeBlinkRight`、`jawOpen` 和 `mouthSmileLeft/Right`。
- 三角面不高于 100,000，推荐 30,000 至 70,000。
- 纹理最大 2K，优先 WebP/KTX2；材质数量不高于 8。
- 最终 GLB 不高于 20 MB，首次加载目标不超过 2 秒。
- 必须覆盖待机、问候、聆听、思考和说话五类状态；可以使用骨骼动画，也可以由原生状态机程序化驱动。
- 必须保留素材来源、作者、许可证、下载日期和允许范围。

使用以下命令验收候选模型：

```powershell
node scripts/inspect-avatar-glb.cjs path/to/avatar.glb --strict
```

## 候选来源决策

| 来源 | 技术适配 | 视觉上限 | 授权风险 | 当前决策 |
| --- | --- | --- | --- | --- |
| Microsoft Rocketbox | 高，175 个面部目标中保留产品所需 28 个 | 中高 | MIT，证据已随资源保存 | 已采用 `Business_Female_04` 为 v5 默认人物 |
| Ready Player Me 自定义角色 | 高，已验证完整 viseme | 中等 | 需核验当前服务条款 | v3 仅保留为本机技术对比，不进入发布包 |
| Avaturn / MetaPerson | 预期较高 | 中高 | 需账号与条款核验 | 备选 |
| Character Creator / ActorCore | 高 | 高 | 需要购买对应导出许可 | 决赛质量方案 |
| Sketchfab 随机免费模型 | 不稳定 | 不稳定 | 授权和绑定差异大 | 不采用 |
| AI 图生 3D 人物 | 低 | 不稳定 | 拓扑、骨骼和口型不可控 | 不采用 |
| Blender 从零建模 | 可控 | 取决于专业美术 | 周期和质量风险高 | 不采用 |

## 场景视觉规格

- 现代企业独立面试室，不使用开放工位大厅。
- 眼平机位，50 mm 左右自然透视，背景与人物方向一致。
- 中央为人物留出完整头肩安全区，避免灯具、窗框或桌沿穿过人物轮廓。
- 左前方柔和自然光，右侧轻微冷色补光，便于匹配原生 3D 灯光。
- 主色为中性灰、白和浅木色，并保留少量绿色植物或蓝色软装作为辅助色。
- 背景轻微景深但不模糊成色块，办公室结构仍可识别。
- 无人物、无文字、无品牌、无屏幕内容、无玻璃反射人影。
- 目标尺寸 2048 x 1152，人物安全区覆盖画面中心 35% 至 65%。

当前原生端使用 `interviewOfficeV3.jpg`，由 Wikimedia Commons 的 [Leather chairs in meeting room](https://commons.wikimedia.org/wiki/File:Leather_chairs_in_meeting_room_(Unsplash).jpg) 裁切调色而来，原作者为 Breather，许可证为 CC0 1.0。成品按原生横屏舞台裁切为 2560 x 1152，中央人物区保持干净，两侧桌椅和书架提供真实景深；`interviewDeskForeground.png` 继续作为近景层，避免人物悬浮。模拟器验证截图见 `docs/evidence-screenshots/harmony-native-interview-office-v3-20260925.jpeg`。

## 背景生成提示词

### 方案 A：稳重面试室

```text
Use case: photorealistic-natural
Asset type: full-screen background for a landscape AI interview application
Primary request: a premium modern corporate interview room in a Chinese technology company, empty and ready for a one-on-one interview
Scene/backdrop: quiet private meeting room with glass partitions, light oak details, neutral grey acoustic wall panels, a subtle plant, no people
Style/medium: realistic architectural interior photography, not a 3D render
Composition/framing: eye-level 50 mm camera, centered composition, open clean space in the middle for a seated chest-up digital interviewer, important details kept outside the central 35 to 65 percent safe area
Lighting/mood: soft daylight from the front-left, gentle cool fill from the right, calm professional mood, balanced exposure
Color palette: neutral grey, white, light wood, restrained green accent
Constraints: 2048 x 1152 landscape, sharp architectural details, believable scale, no text, no logo, no people, no screens, no watermark
Avoid: luxury hotel lobby, open-plan office, dramatic cinematic lighting, orange cast, blue monochrome, distorted furniture, duplicated objects, excessive depth blur
```

### 方案 B：科技园区会议室

```text
Use case: photorealistic-natural
Asset type: full-screen background for a landscape AI interview application
Primary request: a refined private meeting room inside a modern technology campus, empty and professional
Scene/backdrop: floor-to-ceiling side windows, matte concrete ceiling, pale wood conference table edge low in frame, restrained greenery, no people
Style/medium: high-end interior photography with natural materials and realistic reflections
Composition/framing: eye-level symmetrical view, generous negative space in the center for a digital interviewer, no strong lines crossing the head and shoulders
Lighting/mood: bright overcast daylight, soft shadows, trustworthy and focused
Color palette: white, graphite grey, pale oak, small muted blue and green accents
Constraints: 2048 x 1152 landscape, no text, no logo, no people, no visible monitor content, no watermark
Avoid: cyberpunk, neon, futuristic spaceship design, crowded furniture, wide-angle distortion, dark moody exposure
```

### 方案 C：温和 HR 洽谈室

```text
Use case: photorealistic-natural
Asset type: full-screen background for a landscape AI interview application
Primary request: a calm and welcoming human-resources interview room, modern and credible, empty
Scene/backdrop: soft upholstered chairs outside the center, acoustic panels, light wood shelving with minimal decor, one healthy plant
Style/medium: realistic editorial interior photography
Composition/framing: eye-level medium-wide frame, uncluttered center for a chest-up digital interviewer, balanced left and right visual weight
Lighting/mood: diffused morning daylight, subtle warm practical lights, calm and supportive without looking residential
Color palette: soft grey, off-white, light wood, muted teal accent
Constraints: 2048 x 1152 landscape, no text, no logo, no people, no watermark
Avoid: beige-dominated palette, home living room, cafe, hotel lounge, excessive decoration, artificial bokeh
```

## Blender 处理清单

1. 导入原始 GLB 并确认所有 Shape Key、骨骼和动画均存在。
2. 删除隐藏网格、相机、灯光和无关附件。
3. 合并重复材质，将金属度和粗糙度调整为移动端稳定值。
4. 将纹理限制为 2K，并建立单独的来源与许可记录。
5. 保留 viseme 与 ARKit Shape Key 名称，不进行自动重命名。
6. 检查坐姿、肩颈和眼睛方向，确保胸像机位自然。
7. 导出 GLB 时保留 Shape Key、Skinning 和 Animation。
8. 使用验收脚本复查，再进入 HarmonyOS 模拟器做 30 FPS 和加载时间测试。

## 发布前授权清单

- 角色模型原始来源和下载页面。
- 作者或服务商名称。
- 完整许可证文本或购买凭证。
- 是否允许商业应用、比赛演示、应用内分发和修改。
- 是否要求署名，以及署名放置位置。
- 背景图片来源、作者和许可。
- 所有生成式素材的生成工具、日期和最终提示词。
