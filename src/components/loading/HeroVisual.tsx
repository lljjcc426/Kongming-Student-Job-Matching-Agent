import { useEffect, useRef } from "react";
import heroPosterUrl from "../../assets/particle-hand-resume-clean.png";
import heroVideoUrl from "../../assets/loading-particle-hand.mp4";

export default function HeroVisual() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => undefined);
  }, []);

  return (
    <div className="loading-video-backdrop" aria-hidden="true">
      <video
        ref={videoRef}
        src={heroVideoUrl}
        poster={heroPosterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="loading-video-tint" />
    </div>
  );
}
