import DashboardShowcase from "../components/home/DashboardShowcase";
import HeroSection from "../components/home/HeroSection";
import TechBackground from "../components/home/TechBackground";

type HomeTarget = "resume" | "jobs" | "interview" | "assistant";

type HomePageProps = {
  onNavigate: (target: HomeTarget) => void;
};

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <section className="km-home-page" aria-label="孔明职配首页">
      <TechBackground />
      <div className="km-home-canvas">
        <HeroSection onNavigate={onNavigate} />
        <DashboardShowcase />
      </div>
    </section>
  );
}
