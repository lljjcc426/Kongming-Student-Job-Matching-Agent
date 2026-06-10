import type { AvatarSpeechState } from "../../types/interview";

type InterviewerAvatarProps = {
  state: AvatarSpeechState;
};

export default function InterviewerAvatar({ state }: InterviewerAvatarProps) {
  return (
    <div className={`interviewer-avatar ${state}`} aria-label="AI 面试官数字人">
      <div className="avatar-halo" />
      <div className="avatar-shoulders" />
      <div className="avatar-head">
        <div className="avatar-hair" />
        <div className="avatar-face-soft-light" />
        <span className="avatar-eye left" />
        <span className="avatar-eye right" />
        <span className="avatar-brow left" />
        <span className="avatar-brow right" />
        <span className="avatar-nose" />
        <span className="avatar-mouth" />
        <span className="avatar-ear left" />
        <span className="avatar-ear right" />
      </div>
      <div className="avatar-neck" />
      <div className="avatar-suit">
        <span />
        <i />
      </div>
      <div className="avatar-status-orbit">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
