import { useState } from "react";
import type { AvatarSpeechState } from "../../types/interview";

const AVATAR_IMAGE_SRC = "/avatars/interviewer-2d/interviewer.png";

const avatarMouthConfig = {
  top: "42%",
  left: "55%",
  width: "6%",
  height: "2.8%",
};

type TwoDInterviewerAvatarProps = {
  status?: AvatarSpeechState;
  className?: string;
};

export default function TwoDInterviewerAvatar({ status = "idle", className = "" }: TwoDInterviewerAvatarProps) {
  const [imageReady, setImageReady] = useState(true);
  const normalizedStatus: AvatarSpeechState = imageReady ? status : "error";

  return (
    <div className={`two-d-interviewer-avatar ${normalizedStatus} ${className}`.trim()} aria-label="AI 面试官数字人">
      <div className="two-d-avatar-aura" />
      <div className="two-d-avatar-stage">
        {imageReady ? (
          <>
            <img
              className="two-d-avatar-image"
              src={AVATAR_IMAGE_SRC}
              alt="AI 面试官"
              draggable={false}
              onError={() => setImageReady(false)}
            />
            <span className="two-d-avatar-mouth" style={avatarMouthConfig} aria-hidden="true" />
          </>
        ) : (
          <div className="two-d-avatar-fallback">
            <strong>AI 面试官</strong>
            <span>数字人形象待加载</span>
          </div>
        )}
      </div>
      {normalizedStatus === "thinking" ? (
        <div className="two-d-avatar-thinking" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      ) : null}
      {normalizedStatus === "listening" ? <div className="two-d-avatar-listening" aria-hidden="true" /> : null}
    </div>
  );
}
