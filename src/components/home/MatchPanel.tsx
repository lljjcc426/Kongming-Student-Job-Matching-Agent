import { useState } from "react";
import { Check, UserRound } from "lucide-react";
import type { CSSProperties } from "react";

type MatchPanelProps = {
  score: number;
  strengths: string[];
};

export default function MatchPanel({ score, strengths }: MatchPanelProps) {
  const [activeStrengths, setActiveStrengths] = useState(() => strengths.map(() => true));

  const toggleStrength = (index: number) => {
    setActiveStrengths((current) => current.map((item, itemIndex) => (itemIndex === index ? !item : item)));
  };

  return (
    <article className="km-match-panel km-card-swap-motion">
      <div className="km-match-title">
        <span />
        <strong>AI 智能匹配中</strong>
        <span />
      </div>

      <div className="km-avatar-orbit">
        <span className="km-orbit-ring ring-1" />
        <span className="km-orbit-ring ring-2" />
        <span className="km-orbit-ring ring-3" />
        <div className="km-avatar-core">
          <UserRound size={62} strokeWidth={1.8} />
        </div>
        <span className="km-check-badge">
          <Check size={18} strokeWidth={3} />
        </span>
      </div>

      <div className="km-match-score">
        <span>匹配度</span>
        <strong>{score}%</strong>
        <div className="km-score-track">
          <i style={{ "--progress": `${score}%` } as CSSProperties} />
        </div>
      </div>

      <div className="km-strengths">
        <p>核心匹配优势</p>
        {strengths.map((item, index) => (
          <button
            key={item}
            type="button"
            className={activeStrengths[index] ? "is-active" : ""}
            onClick={() => toggleStrength(index)}
            aria-pressed={activeStrengths[index]}
          >
            <Check size={13} strokeWidth={2.8} />
            <span>{item}</span>
          </button>
        ))}
      </div>
    </article>
  );
}
