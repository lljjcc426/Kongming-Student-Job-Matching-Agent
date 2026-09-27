import {
  Animation,
  EnvironmentBackgroundType,
  Geometry,
  LightType,
  Morpher,
  Node,
  NodeType,
  Quaternion,
  Scene,
  Vec3,
} from '@kit.ArkGraphics3D';
import {
  DEFAULT_INTERVIEWER_PROFILE,
  NativeAvatarProfile,
  NativeAvatarState,
} from '../common/NativeAvatarProfile';

function subtract(left: Vec3, right: Vec3): Vec3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function dot(left: Vec3, right: Vec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function normalize(vector: Vec3): Vec3 {
  const magnitude = Math.sqrt(dot(vector, vector));
  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude };
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function scaleQuaternion(quaternion: Quaternion, multiplier: number): Quaternion {
  return {
    x: quaternion.x * multiplier,
    y: quaternion.y * multiplier,
    z: quaternion.z * multiplier,
    w: quaternion.w * multiplier,
  };
}

function multiplyQuaternion(left: Quaternion, right: Quaternion): Quaternion {
  return {
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
  };
}

function motionQuaternion(pitch: number, yaw: number): Quaternion {
  const halfPitch = pitch * 0.5;
  const halfYaw = yaw * 0.5;
  return {
    x: Math.sin(halfPitch) * Math.cos(halfYaw),
    y: Math.cos(halfPitch) * Math.sin(halfYaw),
    z: -Math.sin(halfPitch) * Math.sin(halfYaw),
    w: Math.cos(halfPitch) * Math.cos(halfYaw),
  };
}

const SPEECH_VISEMES: string[] = [
  'viseme_aa',
  'viseme_E',
  'viseme_O',
  'viseme_PP',
  'viseme_I',
  'viseme_U',
  'viseme_CH',
];

const ALL_VISEMES: string[] = [
  'viseme_sil',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
];

const EXPRESSION_MORPHS: string[] = [
  'mouthOpen',
  'jawOpen',
  'mouthSmile',
  'mouthPressLeft',
  'mouthPressRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'eyeWideLeft',
  'eyeWideRight',
  'eyesLookDown',
];

function lookAt(node: Node, eye: Vec3, center: Vec3, up: Vec3): void {
  const forward = normalize(subtract(center, eye));
  const side = normalize(cross(forward, up));
  const correctedUp = cross(side, forward);
  const backwards: Vec3 = { x: -forward.x, y: -forward.y, z: -forward.z };
  let trace: number;
  let quaternion: Quaternion;

  if (backwards.z < 0) {
    if (side.x > correctedUp.y) {
      trace = 1 + side.x - correctedUp.y - backwards.z;
      quaternion = {
        x: trace,
        y: side.y + correctedUp.x,
        z: backwards.x + side.z,
        w: correctedUp.z - backwards.y,
      };
    } else {
      trace = 1 - side.x + correctedUp.y - backwards.z;
      quaternion = {
        x: side.y + correctedUp.x,
        y: trace,
        z: correctedUp.z + backwards.y,
        w: backwards.x - side.z,
      };
    }
  } else if (side.x < -correctedUp.y) {
    trace = 1 - side.x - correctedUp.y + backwards.z;
    quaternion = {
      x: backwards.x + side.z,
      y: correctedUp.z + backwards.y,
      z: trace,
      w: side.y - correctedUp.x,
    };
  } else {
    trace = 1 + side.x + correctedUp.y + backwards.z;
    quaternion = {
      x: correctedUp.z - backwards.y,
      y: backwards.x - side.z,
      z: side.y - correctedUp.x,
      w: trace,
    };
  }

  node.position = eye;
  node.rotation = scaleQuaternion(quaternion, 0.5 / Math.sqrt(trace));
}

@Component
export struct NativeDigitalInterviewer {
  @Prop @Watch('onAvatarStateChanged') avatarState: NativeAvatarState = 'idle';
  @Prop compact: boolean = false;
  @Prop viewportHeight: number = 0;
  @Prop fullStage: boolean = false;
  @Prop showIdentity: boolean = true;
  @Prop profile: NativeAvatarProfile = DEFAULT_INTERVIEWER_PROFILE;
  @State private scene: Scene | undefined = undefined;
  @State private loadState: string = 'loading';
  @State private activeAnimationName: string = '';
  private loadSequence: number = 0;
  private talkingIndex: number = 0;
  private renderTimer: number = -1;
  private motionStartedAt: number = 0;
  private morphers: Morpher[] = [];
  private avatarRootNode: Node | undefined = undefined;
  private avatarBasePosition: Vec3 = { x: 0, y: 0, z: 0 };
  private avatarBaseRotation: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

  aboutToAppear(): void {
    void this.loadAvatar();
  }

  aboutToDisappear(): void {
    this.loadSequence += 1;
    this.stopRenderLoop();
    this.scene?.destroy();
    this.scene = undefined;
    this.morphers = [];
    this.avatarRootNode = undefined;
  }

  private onAvatarStateChanged(): void {
    console.info(`Native avatar state changed to ${this.avatarState}.`);
    this.playStateAnimation(this.avatarState);
  }

  private async loadAvatar(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.loadState = 'loading';
    try {
      const modelResource = {
        id: 0,
        bundleName: 'cn.kongming.jobmatch',
        moduleName: 'entry',
        type: 30000,
        params: [this.profile.modelPath],
      } as Resource;
      const loadedScene = await Scene.load(modelResource);
      if (sequence !== this.loadSequence) {
        loadedScene.destroy();
        return;
      }
      await this.configureScene(loadedScene);
      this.scene = loadedScene;
      this.loadState = 'ready';
      this.playStateAnimation(this.avatarState);
      this.startRenderLoop(loadedScene, sequence);
    } catch (error) {
      this.loadState = 'failed';
      console.error(`Native avatar scene load failed: ${String(error)}`);
    }
  }

  private animationNameForState(state: NativeAvatarState): string {
    if (state === 'greeting') return this.profile.greetingAnimation;
    if (state === 'listening' || state === 'interrupted') return this.profile.listeningAnimation;
    if (state === 'talking') {
      const animations = this.profile.talkingAnimations;
      if (animations.length === 0) return this.profile.idleAnimation;
      const animationName = animations[this.talkingIndex % animations.length];
      this.talkingIndex += 1;
      return animationName;
    }
    return this.profile.idleAnimation;
  }

  private animationIndexForState(state: NativeAvatarState): number {
    if (state === 'greeting') return this.profile.greetingAnimationIndex;
    if (state === 'listening' || state === 'interrupted') return this.profile.listeningAnimationIndex;
    if (state === 'talking') {
      const indexes = this.profile.talkingAnimationIndexes;
      if (indexes.length === 0) return this.profile.idleAnimationIndex;
      return indexes[Math.max(0, this.talkingIndex - 1) % indexes.length];
    }
    return this.profile.idleAnimationIndex;
  }

  private async configureScene(scene: Scene): Promise<void> {
    if (!scene.root) throw new Error('Avatar scene has no root node.');
    this.morphers = [];
    this.collectMorphers(scene.root);
    console.info(`Native avatar discovered ${this.morphers.length} morpher resources.`);
    const avatarRootNode = scene.root.children.get(0);
    if (avatarRootNode) {
      this.avatarRootNode = avatarRootNode;
      this.avatarBasePosition = {
        x: avatarRootNode.position.x,
        y: avatarRootNode.position.y,
        z: avatarRootNode.position.z,
      };
      this.avatarBaseRotation = {
        x: avatarRootNode.rotation.x,
        y: avatarRootNode.rotation.y,
        z: avatarRootNode.rotation.z,
        w: avatarRootNode.rotation.w,
      };
    }
    this.resetFacialMorphs();
    this.motionStartedAt = Date.now();
    const usesRocketboxFraming = this.profile.modelPath.includes('professional-interviewer-v4.glb') ||
      this.profile.modelPath.includes('professional-interviewer-v5.glb');
    const focusHeight = usesRocketboxFraming ? 1.55 : 0.54;
    const cameraDistance = usesRocketboxFraming ? 1.18 : 1.12;
    const factory = scene.getResourceFactory();
    const camera = await factory.createCamera({ name: 'KongMingInterviewCamera' });
    lookAt(
      camera,
      { x: 0, y: focusHeight, z: cameraDistance },
      { x: 0, y: focusHeight, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    camera.fov = usesRocketboxFraming ? 0.52 : 0.56;
    camera.nearPlane = 0.02;
    camera.farPlane = 100;
    camera.clearColor = { r: 0, g: 0, b: 0, a: 0 };
    camera.enabled = true;
    scene.root.children.append(camera);

    const keyLight = await factory.createLight({ name: 'KongMingKeyLight' }, LightType.DIRECTIONAL);
    lookAt(
      keyLight,
      { x: -1.2, y: focusHeight + 0.7, z: 1.7 },
      { x: 0, y: focusHeight, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    keyLight.color = { r: 1, g: 0.98, b: 0.94, a: 1 };
    keyLight.intensity = 2.7;
    keyLight.shadowEnabled = false;
    keyLight.enabled = true;
    scene.root.children.append(keyLight);

    const fillLight = await factory.createLight({ name: 'KongMingFillLight' }, LightType.DIRECTIONAL);
    lookAt(
      fillLight,
      { x: 1.4, y: focusHeight + 0.3, z: 1.4 },
      { x: 0, y: focusHeight, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    fillLight.color = { r: 0.82, g: 0.9, b: 1, a: 1 };
    fillLight.intensity = 1.4;
    fillLight.shadowEnabled = false;
    fillLight.enabled = true;
    scene.root.children.append(fillLight);

    const rimLight = await factory.createLight({ name: 'KongMingRimLight' }, LightType.DIRECTIONAL);
    lookAt(
      rimLight,
      { x: 0.8, y: focusHeight + 0.6, z: -1.2 },
      { x: 0, y: focusHeight, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    rimLight.color = { r: 0.84, g: 0.93, b: 1, a: 1 };
    rimLight.intensity = 0.9;
    rimLight.shadowEnabled = false;
    rimLight.enabled = true;
    scene.root.children.append(rimLight);

    scene.environment.backgroundType = EnvironmentBackgroundType.BACKGROUND_NONE;
    scene.environment.indirectDiffuseFactor = { x: 0.9, y: 0.9, z: 0.9, w: 1 };
    scene.environment.indirectSpecularFactor = { x: 0.12, y: 0.12, z: 0.12, w: 1 };
    console.info(
      `Native avatar scene ready with ${scene.root.children.count()} root children and ${scene.animations.length} animations.`,
    );
    for (let index = 0; index < scene.animations.length; index += 1) {
      console.info(`Native avatar animation ${index}: ${scene.animations[index].name}`);
    }
  }

  private collectMorphers(node: Node): void {
    if (node.nodeType === NodeType.GEOMETRY) {
      const geometry = node as Geometry;
      console.info(`Native avatar geometry ${node.path} exposes morpher=${geometry.morpher ? 'yes' : 'no'}.`);
      if (geometry.morpher) this.morphers.push(geometry.morpher);
    }
    for (let index = 0; index < node.children.count(); index += 1) {
      const child = node.children.get(index);
      if (child) this.collectMorphers(child);
    }
  }

  private usesBakedFacialMotion(): boolean {
    return this.profile.modelPath.includes('professional-interviewer-v3.glb');
  }

  private writeMorph(name: string, value: number): void {
    for (const morpher of this.morphers) {
      morpher.targets[name] = value;
    }
  }

  private resetFacialMorphs(): void {
    if (this.usesBakedFacialMotion()) return;
    for (const name of ALL_VISEMES) this.writeMorph(name, 0);
    for (const name of EXPRESSION_MORPHS) this.writeMorph(name, 0);
    this.writeMorph('eyeBlinkLeft', 0);
    this.writeMorph('eyeBlinkRight', 0);
  }

  private applyFacialState(elapsed: number): void {
    if (this.morphers.length === 0 || this.usesBakedFacialMotion()) return;
    for (const name of ALL_VISEMES) this.writeMorph(name, 0);
    for (const name of EXPRESSION_MORPHS) this.writeMorph(name, 0);

    if (this.avatarState === 'talking') {
      const speechStep = elapsed / 150;
      const speechIndex = Math.floor(speechStep) % SPEECH_VISEMES.length;
      const speechPhase = speechStep - Math.floor(speechStep);
      const nextSpeechIndex = (speechIndex + 1) % SPEECH_VISEMES.length;
      const speechPulse = 0.18 + Math.sin(speechPhase * Math.PI) * 0.62;
      this.writeMorph(SPEECH_VISEMES[speechIndex], speechPulse * (1 - speechPhase) * 0.62);
      this.writeMorph(SPEECH_VISEMES[nextSpeechIndex], speechPulse * speechPhase * 0.62);
      this.writeMorph('jawOpen', 0.04 + speechPulse * 0.12);
      this.writeMorph('mouthOpen', 0.02 + speechPulse * 0.08);
    } else if (this.avatarState === 'greeting') {
      this.writeMorph('mouthSmile', 0.3);
      this.writeMorph('browOuterUpLeft', 0.1);
      this.writeMorph('browOuterUpRight', 0.1);
    } else if (this.avatarState === 'listening') {
      this.writeMorph('mouthSmile', 0.07);
      this.writeMorph('browInnerUp', 0.045);
    } else if (this.avatarState === 'thinking') {
      this.writeMorph('eyesLookDown', 0.15);
      this.writeMorph('browInnerUp', 0.1);
      this.writeMorph('mouthPressLeft', 0.07);
      this.writeMorph('mouthPressRight', 0.07);
    } else if (this.avatarState === 'interrupted') {
      this.writeMorph('eyeWideLeft', 0.14);
      this.writeMorph('eyeWideRight', 0.14);
      this.writeMorph('browInnerUp', 0.16);
    } else {
      this.writeMorph('mouthSmile', 0.035);
    }

    const blinkPhase = elapsed % 4400;
    const blink = blinkPhase < 160 ? Math.sin(blinkPhase / 160 * Math.PI) : 0;
    this.writeMorph('eyeBlinkLeft', blink);
    this.writeMorph('eyeBlinkRight', blink);
  }

  private applyAvatarMotion(elapsed: number): void {
    if (!this.avatarRootNode) return;
    const talkingStrength = this.avatarState === 'talking' ? 1 : 0.45;
    const listeningPitch = this.avatarState === 'listening' ? 0.006 : 0;
    const yaw = Math.sin(elapsed / 1450) * 0.012 * talkingStrength;
    const pitch = listeningPitch + Math.sin(elapsed / 2100) * 0.004;
    this.avatarRootNode.position = {
      x: this.avatarBasePosition.x + Math.sin(elapsed / 2300) * 0.0018,
      y: this.avatarBasePosition.y + Math.sin(elapsed / 980) * 0.0025,
      z: this.avatarBasePosition.z,
    };
    this.avatarRootNode.rotation = multiplyQuaternion(
      this.avatarBaseRotation,
      motionQuaternion(pitch, yaw),
    );
  }

  private updateAvatarFrame(): void {
    const elapsed = Date.now() - this.motionStartedAt;
    this.applyFacialState(elapsed);
    this.applyAvatarMotion(elapsed);
  }

  private startRenderLoop(scene: Scene, sequence: number): void {
    this.stopRenderLoop();
    this.renderTimer = setInterval(() => {
      if (sequence !== this.loadSequence || this.scene !== scene) return;
      this.updateAvatarFrame();
      scene.renderFrame({ alwaysRender: true });
    }, 33);
  }

  private stopRenderLoop(): void {
    if (this.renderTimer < 0) return;
    clearInterval(this.renderTimer);
    this.renderTimer = -1;
  }

  private stopAnimations(): void {
    if (!this.scene) return;
    for (const animation of this.scene.animations) {
      if (animation.running || animation.enabled) animation.stop();
      animation.enabled = false;
    }
  }

  private playStateAnimation(state: NativeAvatarState): void {
    if (!this.scene || this.loadState !== 'ready') return;
    this.stopAnimations();
    const animationName = this.animationNameForState(state);
    if (animationName.length === 0) {
      this.activeAnimationName = '';
      return;
    }
    const animation = this.findAnimation(animationName, this.animationIndexForState(state));
    if (!animation) {
      this.activeAnimationName = '';
      console.warn(`Native avatar animation not found: ${animationName}`);
      return;
    }
    this.activeAnimationName = animationName;
    animation.enabled = true;
    animation.onFinished(() => {
      if (this.activeAnimationName !== animationName) return;
      if (state === 'greeting') {
        this.playStateAnimation('idle');
        return;
      }
      animation.restart();
    });
    animation.start();
  }

  private findAnimation(name: string, fallbackIndex: number): Animation | undefined {
    if (!this.scene) return undefined;
    for (const animation of this.scene.animations) {
      if (animation.name === name || animation.name.toLowerCase().includes(name.toLowerCase())) return animation;
    }
    if (fallbackIndex >= 0 && fallbackIndex < this.scene.animations.length) {
      return this.scene.animations[fallbackIndex];
    }
    return undefined;
  }

  @Builder
  private buildOfficeBackdrop(): void {
    Stack() {
      Image($r('app.media.interviewOfficeV3'))
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Cover)
      Row()
        .width('100%')
        .height('100%')
        .backgroundColor('#0D071118')
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  private buildDeskForeground(): void {
    Image($r('app.media.interviewDeskForeground'))
      .width('100%')
      .height('100%')
      .objectFit(ImageFit.Cover)
  }

  @Builder
  private buildFallback(): void {
    Column({ space: 8 }) {
      SymbolGlyph($r('sys.symbol.person_crop_circle_fill'))
        .fontSize(this.compact ? 56 : 76)
        .fontColor(['#304B57'])
      Text(this.loadState === 'failed' ? '面试官画面暂时不可用' : '正在准备面试官')
        .fontSize(12)
        .fontColor('#435861')
      if (this.loadState === 'loading') {
        LoadingProgress().width(20).height(20).color('#176B87')
      }
    }
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      this.buildOfficeBackdrop()
      if (this.scene) {
        Component3D({ scene: this.scene, modelType: ModelType.TEXTURE })
          .width('100%')
          .height('100%')
          .renderWidth(this.fullStage ? (this.compact ? 960 : 1600) : (this.compact ? 900 : 1100))
          .renderHeight(this.fullStage ? (this.compact ? 540 : 720) : (this.compact ? 720 : 760))
      } else {
        this.buildFallback()
      }
      this.buildDeskForeground()
      if (this.showIdentity) {
        Row({ space: 7 }) {
          Blank()
            .width(7)
            .height(7)
            .backgroundColor(this.loadState === 'ready' ? '#19A974' : '#D68C24')
            .borderRadius(4)
          Text(`${this.profile.displayName} · ${this.profile.roleLabel}`)
            .fontSize(10)
            .fontColor('#F8FBFC')
            .maxLines(1)
        }
        .position({ x: 12, y: 12 })
        .padding({ left: 9, right: 10, top: 6, bottom: 6 })
        .backgroundColor('#B3233036')
        .borderRadius(6)
      }
    }
    .width('100%')
    .height(this.fullStage ? '100%' : (this.viewportHeight > 0 ? this.viewportHeight : (this.compact ? 300 : 430)))
    .clip(true)
    .backgroundColor('#DDE7EA')
    .borderRadius(8)
  }
}
