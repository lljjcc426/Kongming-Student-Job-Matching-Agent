import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "error" | "unsupported";

export function useStudentCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");

  const attachStream = useCallback(async (stream: MediaStream) => {
    if (!videoRef.current) return;
    if (videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
    await videoRef.current.play().catch(() => undefined);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      await attachStream(stream);
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error");
    }
  }, [attachStream]);

  useEffect(() => {
    if (status === "ready" && streamRef.current) {
      void attachStream(streamRef.current);
    }
  }, [attachStream, status]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    videoRef,
    status,
    startCamera,
    stopCamera,
  };
}
