import { Bot, Camera, CameraOff } from "lucide-react";
import type { RefObject } from "react";
import type { CameraStatus } from "./useStudentCamera";

type StudentCameraPreviewProps = {
  status: CameraStatus;
  videoRef: RefObject<HTMLVideoElement | null>;
  onStart: () => void;
  onStop: () => void;
};

const cameraLabel: Record<CameraStatus, string> = {
  idle: "摄像头未开启",
  requesting: "正在请求权限",
  ready: "摄像头已开启",
  denied: "权限未授权",
  error: "摄像头不可用",
  unsupported: "浏览器不支持",
};

export default function StudentCameraPreview({ status, videoRef, onStart, onStop }: StudentCameraPreviewProps) {
  const ready = status === "ready";

  return (
    <div className={`student-camera ${ready ? "ready" : ""}`}>
      <div className="student-camera-video">
        <video ref={videoRef} muted playsInline autoPlay aria-label="学生摄像头预览" />
        {!ready ? (
          <div className="student-camera-fallback">
            <Bot size={24} />
          </div>
        ) : null}
      </div>
      <div>
        <span>{cameraLabel[status]}</span>
        <button type="button" onClick={ready ? onStop : onStart}>
          {ready ? <CameraOff size={13} /> : <Camera size={13} />}
          {ready ? "关闭" : "开启"}
        </button>
      </div>
    </div>
  );
}
