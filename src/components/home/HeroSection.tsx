import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { BarChart3, FileCheck2, Target } from "lucide-react";
import BorderGlow from "./BorderGlow";
import FeatureButton from "./FeatureButton";
import KongmingTitle from "./KongmingTitle";

type HomeTarget = "resume" | "jobs" | "interview" | "assistant";

type HeroSectionProps = {
  onNavigate: (target: HomeTarget) => void;
};

export default function HeroSection({ onNavigate }: HeroSectionProps) {
  const [titleActive, setTitleActive] = useState(false);

  const handleTitlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  const handleTitlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    setTitleActive(true);
    handleTitlePointerMove(event);
  };

  const handleTitlePointerExit = (event: ReactPointerEvent<HTMLDivElement>) => {
    setTitleActive(false);
    event.currentTarget.style.setProperty("--spot-x", "-999px");
    event.currentTarget.style.setProperty("--spot-y", "-999px");
  };

  const handleLocalTextPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--local-spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--local-spot-y", `${event.clientY - rect.top}px`);
  };

  const handleLocalTextPointerEnter = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.classList.add("is-local-active");
    handleLocalTextPointerMove(event);
  };

  const handleLocalTextPointerExit = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.classList.remove("is-local-active");
    event.currentTarget.style.setProperty("--local-spot-x", "-999px");
    event.currentTarget.style.setProperty("--local-spot-y", "-999px");
  };

  return (
    <section className="km-hero-left">
      <div
        className={`km-title-zone${titleActive ? " is-active" : ""}`}
        onPointerEnter={handleTitlePointerEnter}
        onPointerMove={handleTitlePointerMove}
        onPointerLeave={handleTitlePointerExit}
        onPointerCancel={handleTitlePointerExit}
      >
        <div
          className="km-hero-kicker"
          onPointerEnter={handleLocalTextPointerEnter}
          onPointerMove={handleLocalTextPointerMove}
          onPointerLeave={handleLocalTextPointerExit}
          onPointerCancel={handleLocalTextPointerExit}
        >
          高校学生求职证据工作台
        </div>
        <KongmingTitle />
        <p
          className="km-hero-subtitle"
          onPointerEnter={handleLocalTextPointerEnter}
          onPointerMove={handleLocalTextPointerMove}
          onPointerLeave={handleLocalTextPointerExit}
          onPointerCancel={handleLocalTextPointerExit}
        >
          Kongming-Student Job Matching Agent
        </p>
        <div className="km-hero-rule" aria-hidden="true" />
      </div>

      <BorderGlow
        className="km-hero-copy"
        edgeSensitivity={28}
        glowColor="195 96 70"
        backgroundColor="rgba(239, 248, 255, 0.68)"
        borderRadius={20}
        glowRadius={34}
        glowIntensity={0.82}
        coneSpread={24}
        animated
        colors={["#60a5fa", "#38bdf8", "#22d3ee"]}
        fillOpacity={0.22}
      >
        <p>
          聚焦互联网与数字技术岗位，区分官方岗位、用户导入 JD 与职业方向；用简历原文证据解释要求覆盖，并生成需要逐条确认的修改建议。
        </p>
      </BorderGlow>

      <div className="km-feature-row" aria-label="功能入口">
        <FeatureButton icon={Target} label="真实岗位与 JD" onClick={() => onNavigate("jobs")} />
        <FeatureButton icon={FileCheck2} label="事实约束改写" onClick={() => onNavigate("resume")} />
        <FeatureButton icon={BarChart3} label="证据矩阵" onClick={() => onNavigate("assistant")} />
      </div>
    </section>
  );
}
