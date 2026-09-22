export type NativeAvatarState = 'idle' | 'greeting' | 'listening' | 'thinking' | 'talking' | 'interrupted';

export class NativeAvatarProfile {
  readonly id: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly voiceProviderId: string;
  readonly modelPath: string;
  readonly idleAnimation: string;
  readonly greetingAnimation: string;
  readonly listeningAnimation: string;
  readonly talkingAnimations: string[];
  readonly idleAnimationIndex: number;
  readonly greetingAnimationIndex: number;
  readonly listeningAnimationIndex: number;
  readonly talkingAnimationIndexes: number[];

  constructor(
    id: string,
    displayName: string,
    roleLabel: string,
    voiceProviderId: string,
    modelPath: string,
    idleAnimation: string,
    greetingAnimation: string,
    listeningAnimation: string,
    talkingAnimations: string[],
    idleAnimationIndex: number,
    greetingAnimationIndex: number,
    listeningAnimationIndex: number,
    talkingAnimationIndexes: number[],
  ) {
    this.id = id;
    this.displayName = displayName;
    this.roleLabel = roleLabel;
    this.voiceProviderId = voiceProviderId;
    this.modelPath = modelPath;
    this.idleAnimation = idleAnimation;
    this.greetingAnimation = greetingAnimation;
    this.listeningAnimation = listeningAnimation;
    this.talkingAnimations = talkingAnimations;
    this.idleAnimationIndex = idleAnimationIndex;
    this.greetingAnimationIndex = greetingAnimationIndex;
    this.listeningAnimationIndex = listeningAnimationIndex;
    this.talkingAnimationIndexes = talkingAnimationIndexes;
  }
}

export const DEFAULT_INTERVIEWER_PROFILE: NativeAvatarProfile = new NativeAvatarProfile(
  'professional-man-v1',
  '孔明面试官',
  'AI 岗位面试官',
  'huawei-core-speech',
  'avatar/kongming-interviewer.glb',
  'Idle',
  'Waving',
  'Listening',
  ['Talking1', 'Talking2', 'Talking3'],
  0,
  5,
  1,
  [2, 3, 4],
);
