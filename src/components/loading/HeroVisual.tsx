import { useEffect, useRef } from "react";
import heroPosterUrl from "../../assets/particle-hand-resume-clean.png";
import heroVideoUrl from "../../assets/loading-particle-hand.mp4";

export default function HeroVisual() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => undefined);
  }, []);

  return (
    <div className="loading-hero-visual" aria-label="粒子手托简历主视觉">
      <div className="hero-visual-aura" />
      <div className="hero-video-frame">
        <video
          ref={videoRef}
          src={heroVideoUrl}
          poster={heroPosterUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="蓝色粒子手托着一张简历的动态画面"
        />
        <div className="hero-video-edge" />
        <div className="hero-video-bottom-mask" />
      </div>
      <div className="hero-visual-scan scan-a" />
      <div className="hero-visual-scan scan-b" />
    </div>
  );
}
