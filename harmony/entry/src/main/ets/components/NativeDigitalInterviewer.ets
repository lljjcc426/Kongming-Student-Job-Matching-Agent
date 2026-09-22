import {
  Animation,
  EnvironmentBackgroundType,
  LightType,
  Node,
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
  @Prop profile: NativeAvatarProfile = DEFAULT_INTERVIEWER_PROFILE;
  @State private scene: Scene | undefined = undefined;
  @State private loadState: string = 'loading';
  @State private activeAnimationName: string = '';
  private loadSequence: number = 0;
  private talkingIndex: number = 0;
  private renderTimer: number = -1;

  aboutToAppear(): void {
    void this.loadAvatar();
  }

  aboutToDisappear(): void {
    this.loadSequence += 1;
    this.stopRenderLoop();
    this.scene?.destroy();
    this.scene = undefined;
  }

  private onAvatarStateChanged(): void {
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
    const factory = scene.getResourceFactory();
    const camera = await factory.createCamera({ name: 'KongMingInterviewCamera' });
    lookAt(camera, { x: 0, y: 0.95, z: 3.6 }, { x: 0, y: 0.95, z: 0 }, { x: 0, y: 1, z: 0 });
    camera.fov = 0.72;
    camera.nearPlane = 0.1;
    camera.farPlane = 100;
    camera.clearColor = { r: 0, g: 0, b: 0, a: 0 };
    camera.enabled = true;
    scene.root.children.append(camera);

    const keyLight = await factory.createLight({ name: 'KongMingKeyLight' }, LightType.DIRECTIONAL);
    lookAt(keyLight, { x: -1.8, y: 2.4, z: 3.2 }, { x: 0, y: 0.9, z: 0 }, { x: 0, y: 1, z: 0 });
    keyLight.color = { r: 1, g: 0.95, b: 0.88, a: 1 };
    keyLight.intensity = 2.8;
    keyLight.shadowEnabled = false;
    keyLight.enabled = true;
    scene.root.children.append(keyLight);

    const fillLight = await factory.createLight({ name: 'KongMingFillLight' }, LightType.DIRECTIONAL);
    lookAt(fillLight, { x: 2, y: 1.1, z: 2.2 }, { x: 0, y: 0.9, z: 0 }, { x: 0, y: 1, z: 0 });
    fillLight.color = { r: 0.72, g: 0.86, b: 1, a: 1 };
    fillLight.intensity = 1.2;
    fillLight.shadowEnabled = false;
    fillLight.enabled = true;
    scene.root.children.append(fillLight);

    scene.environment.backgroundType = EnvironmentBackgroundType.BACKGROUND_NONE;
    scene.environment.indirectDiffuseFactor = { x: 1, y: 1, z: 1, w: 1 };
    scene.environment.indirectSpecularFactor = { x: 0.35, y: 0.35, z: 0.35, w: 1 };
    console.info(
      `Native avatar scene ready with ${scene.root.children.count()} root children and ${scene.animations.length} animations.`,
    );
    for (let index = 0; index < scene.animations.length; index += 1) {
      console.info(`Native avatar animation ${index}: ${scene.animations[index].name}`);
    }
  }

  private startRenderLoop(scene: Scene, sequence: number): void {
    this.stopRenderLoop();
    this.renderTimer = setInterval(() => {
      if (sequence !== this.loadSequence || this.scene !== scene) return;
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
    const animationName = this.animationNameForState(state);
    this.stopAnimations();
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
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Blank()
          .width('100%')
          .height('68%')
          .backgroundColor('#DDE7EA')
        Blank()
          .width('100%')
          .layoutWeight(1)
          .backgroundColor('#637177')
      }
      .width('100%')
      .height('100%')

      Row({ space: 18 }) {
        Stack({ alignContent: Alignment.Bottom }) {
          Row()
            .width('100%')
            .height('100%')
            .backgroundColor('#B9D7E2')
          Row({ space: 5 }) {
            Blank().width(16).height('38%').backgroundColor('#8DAEBB')
            Blank().width(20).height('56%').backgroundColor('#7697A4')
            Blank().width(14).height('32%').backgroundColor('#A0BAC3')
            Blank().width(24).height('48%').backgroundColor('#829FAA')
          }
          .alignItems(VerticalAlign.Bottom)
          .width('100%')
          .height('46%')
          .padding({ left: 8, right: 8, bottom: 6 })
          Row() {
            Blank().width(4).height('100%').backgroundColor('#8198A2')
          }
          .width('100%')
          .height('100%')
          .justifyContent(FlexAlign.Center)
          Column() {
            Blank().width('100%').height(4).backgroundColor('#8198A2')
          }
          .width('100%')
          .height('100%')
          .justifyContent(FlexAlign.Center)
        }
        .width('38%')
        .height('72%')
        .border({ width: 5, color: '#8AA0AA' })
        .shadow({ radius: 10, color: '#22000000', offsetY: 3 })

        Blank()
          .layoutWeight(1)

        Column() {
          Row({ space: 4 }) {
            Blank().width(10).height(28).backgroundColor('#B4544C')
            Blank().width(13).height(34).backgroundColor('#315E7A')
            Blank().width(9).height(24).backgroundColor('#D19B4D')
          }
          .alignItems(VerticalAlign.Bottom)
          .width('100%')
          .layoutWeight(1)
          .padding({ left: 10, right: 8, bottom: 6 })
          Blank().width('100%').height(5).backgroundColor('#71838A')
          Row({ space: 4 }) {
            Blank().width(12).height(25).backgroundColor('#5E806F')
            Blank().width(9).height(31).backgroundColor('#D4B06B')
            Blank().width(14).height(22).backgroundColor('#496C86')
          }
          .alignItems(VerticalAlign.Bottom)
          .width('100%')
          .layoutWeight(1)
          .padding({ left: 9, right: 8, bottom: 6 })
        }
        .width('23%')
        .height('62%')
        .backgroundColor('#AEBFC4')
        .border({ width: 4, color: '#7F9299' })
      }
      .width('100%')
      .height('61%')
      .padding({ left: 24, right: 24, top: 24 })

      Column({ space: 0 }) {
        Row({ space: 0 }) {
          Blank().width(24).height(24).backgroundColor('#4D7766').borderRadius(12)
          Blank().width(30).height(30).backgroundColor('#608A76').borderRadius(15)
        }
        Blank().width(7).height(22).backgroundColor('#526B5D')
        Blank()
          .width(40)
          .height(32)
          .backgroundColor('#9A755B')
          .borderRadius({ bottomLeft: 8, bottomRight: 8 })
      }
      .position({ x: '80%', y: '54%' })
      .alignItems(HorizontalAlign.Center)

      Row()
        .width('100%')
        .height(2)
        .margin({ bottom: '31%' })
        .backgroundColor('#536168')
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  private buildOfficeForeground(): void {
    Stack({ alignContent: Alignment.Bottom }) {
      Row()
        .width('84%')
        .height('12%')
        .margin({ bottom: '-3%' })
        .backgroundColor('#C99E6C')
        .borderRadius({ topLeft: 7, topRight: 7 })
        .shadow({ radius: 14, color: '#38000000', offsetY: -3 })
      Row()
        .width('88%')
        .height(7)
        .margin({ bottom: '8%' })
        .backgroundColor('#8D6947')
        .borderRadius(3)
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  private buildFallback(): void {
    Column({ space: 8 }) {
      SymbolGlyph($r('sys.symbol.person_crop_circle_fill'))
        .fontSize(this.compact ? 56 : 76)
        .fontColor(['#304B57'])
      Text(this.loadState === 'failed' ? '数字人暂时不可用' : '正在准备面试官')
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
          .renderWidth(this.compact ? 420 : 720)
          .renderHeight(this.compact ? 420 : 720)
      } else {
        this.buildFallback()
      }
      this.buildOfficeForeground()
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
    .width('100%')
    .height(this.viewportHeight > 0 ? this.viewportHeight : (this.compact ? 300 : 430))
    .clip(true)
    .backgroundColor('#DDE7EA')
    .borderRadius(8)
  }
}
