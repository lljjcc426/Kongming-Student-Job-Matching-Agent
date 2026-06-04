import { ArrowUpRight, Radar } from "lucide-react";
import { useMemo } from "react";

type AbilityRadarCardProps = {
  values: number[];
};

const center = { x: 120, y: 98 };
const axes = [
  { x: 120, y: 20 },
  { x: 205, y: 82 },
  { x: 172, y: 168 },
  { x: 68, y: 168 },
  { x: 35, y: 82 },
];

function buildRadarPoints(values: number[]) {
  return axes
    .map((axis, index) => {
      const value = Math.min(Math.max(values[index] ?? 78, 0), 100) / 100;
      const x = center.x + (axis.x - center.x) * value;
      const y = center.y + (axis.y - center.y) * value;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function AbilityRadarCard({ values }: AbilityRadarCardProps) {
  const points = useMemo(() => buildRadarPoints(values), [values]);
  const dots = useMemo(
    () =>
      points.split(" ").map((point) => {
        const [x, y] = point.split(",").map(Number);
        return { x, y };
      }),
    [points],
  );

  return (
    <article className="km-glass-card km-ability-card km-card-swap-motion">
      <header className="km-card-title">
        <span>
          <Radar size={19} />
          能力图谱
        </span>
        <ArrowUpRight size={18} />
      </header>

      <svg className="km-radar-chart" viewBox="0 0 240 190" role="img" aria-label="能力雷达图">
        <g className="km-radar-grid">
          <polygon points="120,20 205,82 172,168 68,168 35,82" />
          <polygon points="120,48 178,91 156,145 84,145 62,91" />
          <polygon points="120,76 151,99 139,122 101,122 89,99" />
          <line x1="120" y1="20" x2="120" y2="168" />
          <line x1="35" y1="82" x2="172" y2="168" />
          <line x1="205" y1="82" x2="68" y2="168" />
        </g>
        <polygon className="km-radar-area" points={points} />
        {dots.map((dot, index) => (
          <circle className="km-radar-dot" cx={dot.x} cy={dot.y} r="4" key={`${dot.x}-${dot.y}-${index}`} />
        ))}
        <text x="120" y="16" textAnchor="middle">专业能力</text>
        <text x="208" y="82" textAnchor="middle">学习能力</text>
        <text x="166" y="180" textAnchor="middle">沟通协作</text>
        <text x="62" y="180" textAnchor="middle">执行能力</text>
        <text x="34" y="82" textAnchor="middle">创新能力</text>
      </svg>
    </article>
  );
}
