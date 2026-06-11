import type { AvatarSpeechState } from "../../types/interview";
import TwoDInterviewerAvatar from "./TwoDInterviewerAvatar";

type InterviewerAvatarProps = {
  state: AvatarSpeechState;
};

export default function InterviewerAvatar({ state }: InterviewerAvatarProps) {
  return <TwoDInterviewerAvatar status={state} className="interviewer-avatar" />;
}
