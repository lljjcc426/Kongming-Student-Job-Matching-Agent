import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Lightbulb } from "lucide-react";

type SuggestionCardProps = {
  suggestions: string[];
};

export default function SuggestionCard({ suggestions }: SuggestionCardProps) {
  const [checked, setChecked] = useState(() => suggestions.map(() => true));
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    setChecked(suggestions.map(() => true));
  }, [suggestions]);

  return (
    <article className="km-glass-card km-suggestion-card">
      <header className="km-card-title">
        <span>
          <Lightbulb size={19} />
          优化建议
        </span>
        <ArrowUpRight size={18} />
      </header>

      <div className="km-suggestion-list">
        {suggestions.map((item, index) => (
          <button
            key={item}
            type="button"
            className={checked[index] ? "is-active" : ""}
            onClick={() => setChecked((current) => current.map((value, itemIndex) => (itemIndex === index ? !value : value)))}
            aria-pressed={checked[index]}
          >
            <CheckCircle2 size={18} />
            <span>{item}</span>
          </button>
        ))}
      </div>

      <button type="button" className="km-card-link" onClick={() => setOpened((value) => !value)}>
        {opened ? "已展开建议" : "查看详细建议"}
        <ArrowUpRight size={15} />
      </button>
    </article>
  );
}
