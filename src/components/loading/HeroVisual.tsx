import heroVisualUrl from "../../assets/particle-hand-resume-clean.png";

export default function HeroVisual() {
  return (
    <div className="loading-hero-visual" aria-label="粒子手托简历主视觉">
      <div className="hero-visual-aura" />
      <img src={heroVisualUrl} alt="蓝色粒子手托着一张简历" />
      <div className="hero-visual-scan scan-a" />
      <div className="hero-visual-scan scan-b" />
    </div>
  );
}
