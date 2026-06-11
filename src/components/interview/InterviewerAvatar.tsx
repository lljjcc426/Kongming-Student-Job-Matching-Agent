import type { AvatarSpeechState } from "../../types/interview";
import Live2DInterviewerAvatar from "./Live2DInterviewerAvatar";

type InterviewerAvatarProps = {
  state: AvatarSpeechState;
};

export default function InterviewerAvatar({ state }: InterviewerAvatarProps) {
  return <Live2DInterviewerAvatar status={state} className="interviewer-avatar" />;
}
