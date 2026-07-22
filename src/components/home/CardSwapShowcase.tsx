import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, BriefcaseBusiness, Check, CheckCircle2, FileSearch, Lightbulb, Radar, UserRound } from "lucide-react";
import gsap from "gsap";

type JobItem = {
  title: string;
  track: string;
  category: string;
  score: number;
};

type SwapCardId = "match" | "jobs" | "resume" | "ability" | "suggestion";

type SwapCardData = {
  id: SwapCardId;
  label: string;
};

const jobPool: JobItem[] = [
  { title: "前端开发实习生", track: "软件开发 / 前端", category: "frontend", score: 78 },
  { title: "后端开发实习生", track: "软件开发 / 后端", category: "backend", score: 72 },
  { title: "移动端开发实习生", track: "软件开发 / 客户端", category: "mobile", score: 68 },
  { title: "测试开发实习生", track: "软件开发 / 测试", category: "testing", score: 64 },
  { title: "大模型应用工程师", track: "AI / 大模型应用", category: "llm", score: 76 },
  { title: "算法工程师", track: "AI / 算法", category: "algorithm", score: 70 },
  { title: "AI 工程师", track: "AI / 工程", category: "ai-engineering", score: 66 },
  { title: "数据分析实习生", track: "数据 / 分析", category: "analytics", score: 74 },
  { title: "数据工程实习生", track: "数据 / 工程", category: "data-engineering", score: 62 },
  { title: "商业分析实习生", track: "数据 / 商业分析", category: "business-analysis", score: 69 },
  { title: "AI 产品实习生", track: "产品 / AI", category: "ai-product", score: 73 },
  { title: "产品经理实习生", track: "产品 / 互联网", category: "product", score: 67 },
];

const strengths = ["专业技能匹配", "项目经验相关", "职业兴趣契合", "发展路径一致"];
const suggestions = [
  "突出项目成果数据化",
  "补充相关技能证书",
  "优化求职目标描述",
  "强化岗位关键词表达",
  "梳理经历 STAR 结构",
  "补齐目标岗位作品集",
];
const resumeMetricLabels = ["教育背景", "专业技能", "项目经验", "综合素质", "成长潜力"];
const radarValues = [88, 84, 78, 74, 82];
const radarLevels = [0.2, 0.4, 0.6, 0.8, 1];
const cardList: SwapCardData[] = [
  { id: "match", label: "证据覆盖示例" },
  { id: "jobs", label: "职业方向示例" },
  { id: "resume", label: "简历证据示例" },
  { id: "ability", label: "能力图谱" },
  { id: "suggestion", label: "优化建议" },
];

const radarCenter = { x: 180, y: 180 };
const radarAxes = [
  { label: "专业能力", x: 180, y: 42, labelX: 180, labelY: 22 },
  { label: "学习能力", x: 311.2, y: 137.4, labelX: 335, labelY: 134 },
  { label: "沟通能力", x: 261.1, y: 291.6, labelX: 288, labelY: 328 },
  { label: "执行能力", x: 98.9, y: 291.6, labelX: 72, labelY: 328 },
  { label: "创新能力", x: 48.8, y: 137.4, labelX: 25, labelY: 134 },
];

function makeScoreTarget() {
  return Math.floor(45 + Math.random() * 36);
}

function pickDiverseJobs() {
  const shuffled = [...jobPool].sort(() => Math.random() - 0.5);
  const usedCategories = new Set<string>();
  const selected: JobItem[] = [];

  for (const job of shuffled) {
    if (usedCategories.has(job.category)) continue;
    selected.push(job);
    usedCategories.add(job.category);
    if (selected.length === 4) break;
  }

  if (selected.length < 4) {
    for (const job of shuffled) {
      if (selected.includes(job)) continue;
      selected.push(job);
      if (selected.length === 4) break;
    }
  }

  return selected;
}

function buildRadarPoints(values: number[]) {
  return radarAxes
    .map((axis, index) => {
      const value = Math.min(Math.max(values[index] ?? 78, 0), 100) / 100;
      const x = radarCenter.x + (axis.x - radarCenter.x) * value;
      const y = radarCenter.y + (axis.y - radarCenter.y) * value;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildRadarLevelPoints(scale: number) {
  return radarAxes
    .map((axis) => {
      const x = radarCenter.x + (axis.x - radarCenter.x) * scale;
      const y = radarCenter.y + (axis.y - radarCenter.y) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function makeSlot(index: number, total: number) {
  return {
    x: index * 64,
    y: -index * 42,
    z: -index * 120,
    rotationY: -10,
    rotationX: 2,
    rotationZ: index * -1.5,
    scale: 1 - index * 0.045,
    autoAlpha: 1 - index * 0.1,
    zIndex: total - index,
  };
}

function SwapHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <header className="swap-card-header">
      <span>
        {icon}
        {title}
      </span>
      <ArrowUpRight size={18} />
    </header>
  );
}

function MatchSwapCard({ score, revealKey }: { score: number; revealKey: number }) {
  return (
    <article className="swap-card swap-match-card">
      <div className="swap-card-body match-body">
        <div className="swap-match-title">
          <span />
          <strong>证据覆盖演示</strong>
          <span />
        </div>

        <div className="swap-avatar-zone">
          <span className="swap-avatar-ring ring-one" />
          <span className="swap-avatar-ring ring-two" />
          <span className="swap-avatar-ring ring-three" />
          <div className="swap-avatar-core">
            <UserRound size={78} strokeWidth={1.75} />
          </div>
          <span className="swap-check-badge">
            <Check size={18} strokeWidth={3} />
          </span>
        </div>

        <div className="swap-match-score">
          <span>示例证据覆盖</span>
          <strong>{score}%</strong>
          <i>
            <em style={{ "--progress-value": score } as CSSProperties} />
          </i>
        </div>

        <section className={`swap-match-tags${revealKey > 0 ? " is-revealing" : ""}`}>
          <p>核心匹配优势</p>
          <div className="swap-match-tag-grid" key={revealKey}>
            {strengths.map((item) => (
              <span key={item}>
                <Check size={13} strokeWidth={2.8} />
                {item}
              </span>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function JobsSwapCard({ items, scores, revealKey }: { items: JobItem[]; scores: number[]; revealKey: number }) {
  return (
    <article className={`swap-card swap-jobs-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<BriefcaseBusiness size={20} />} title="职业方向示例" />
      <div className="swap-card-body jobs-body">
        <div className="swap-job-list" key={revealKey}>
          {items.map((job, index) => {
            const score = scores[index] ?? 0;

            return (
              <section className="swap-job-item" key={job.title} style={{ "--item-index": index } as CSSProperties}>
                <span className="swap-job-icon">
                  <BriefcaseBusiness size={18} />
                </span>
                <div>
                  <strong>{job.title}</strong>
                  <small>{job.track}</small>
                  <i>
                    <em style={{ "--progress-value": score } as CSSProperties} />
                  </i>
                </div>
                <b>证据{score}%</b>
              </section>
            );
          })}
        </div>
        <button type="button" className="swap-card-link">
          查看更多岗位
          <ArrowUpRight size={15} />
        </button>
      </div>
    </article>
  );
}

function ResumeSwapCard({ score, metrics, revealKey }: { score: number; metrics: number[]; revealKey: number }) {
  return (
    <article className={`swap-card swap-resume-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<FileSearch size={20} />} title="简历分析" />
      <div className="swap-card-body resume-body">
        <div className="swap-score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}>
          <div>
            <strong>{score}</strong>
            <span>分</span>
            <small>示例证据覆盖</small>
          </div>
        </div>
        <div className="swap-progress-list" key={revealKey}>
          {resumeMetricLabels.map((label, index) => {
            const value = metrics[index] ?? 0;

            return (
              <section key={label} style={{ "--item-index": index } as CSSProperties}>
                <div>
                  <span>{label}</span>
                  <b>{value}%</b>
                </div>
                <i>
                  <em style={{ "--progress-value": value } as CSSProperties} />
                </i>
              </section>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function AbilitySwapCard({ values, revealKey }: { values: number[]; revealKey: number }) {
  const points = useMemo(() => buildRadarPoints(values), [values]);

  return (
    <article className={`swap-card swap-ability-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<Radar size={20} />} title="能力图谱" />
      <div className="swap-card-body ability-body">
        <svg className="swap-radar-chart" viewBox="0 0 360 360" role="img" aria-label="能力雷达图">
          <g className="swap-radar-grid">
            {radarLevels.map((level) => (
              <polygon key={level} points={buildRadarLevelPoints(level)} />
            ))}
            {radarAxes.map((axis) => (
              <line key={axis.label} x1={radarCenter.x} y1={radarCenter.y} x2={axis.x} y2={axis.y} />
            ))}
          </g>
          <g className="swap-radar-area-stack">
            <polygon className="swap-radar-area layer-outer" points={points} />
            <polygon className="swap-radar-area layer-middle" points={buildRadarPoints(values.map((value) => value * 0.68))} />
            <polygon className="swap-radar-area layer-inner" points={buildRadarPoints(values.map((value) => value * 0.38))} />
          </g>
          <g className="swap-radar-points">
            {radarAxes.map((axis, index) => {
              const value = Math.min(Math.max(values[index] ?? 0, 0), 100) / 100;
              const x = radarCenter.x + (axis.x - radarCenter.x) * value;
              const y = radarCenter.y + (axis.y - radarCenter.y) * value;
              return <circle key={axis.label} cx={x} cy={y} r="4.5" />;
            })}
          </g>
          {radarAxes.map((axis) => (
            <text key={axis.label} x={axis.labelX} y={axis.labelY} textAnchor="middle">
              {axis.label}
            </text>
          ))}
        </svg>
      </div>
    </article>
  );
}

function SuggestionSwapCard({ revealKey }: { revealKey: number }) {
  return (
    <article className={`swap-card swap-suggestion-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<Lightbulb size={20} />} title="优化建议" />
      <div className="swap-card-body suggestion-body">
        <div className="swap-suggestion-list" key={revealKey}>
          {suggestions.map((item, index) => (
            <button type="button" key={item} style={{ "--item-index": index } as CSSProperties}>
              <CheckCircle2 size={19} />
              <span>{item}</span>
            </button>
          ))}
        </div>
        <button type="button" className="swap-card-link">
          查看详细建议
          <ArrowUpRight size={15} />
        </button>
      </div>
    </article>
  );
}

function renderCard(
  id: SwapCardId,
  matchScore: number,
  matchRevealKey: number,
  selectedJobs: JobItem[],
  jobScores: number[],
  jobsRevealKey: number,
  resumeScore: number,
  resumeMetrics: number[],
  resumeRevealKey: number,
  abilityValues: number[],
  abilityRevealKey: number,
  suggestionRevealKey: number,
) {
  switch (id) {
    case "match":
      return <MatchSwapCard score={matchScore} revealKey={matchRevealKey} />;
    case "jobs":
      return <JobsSwapCard items={selectedJobs} scores={jobScores} revealKey={jobsRevealKey} />;
    case "resume":
      return <ResumeSwapCard score={resumeScore} metrics={resumeMetrics} revealKey={resumeRevealKey} />;
    case "ability":
      return <AbilitySwapCard values={abilityValues} revealKey={abilityRevealKey} />;
    case "suggestion":
      return <SuggestionSwapCard revealKey={suggestionRevealKey} />;
    default:
      return null;
  }
}

export default function CardSwapShowcase() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<SwapCardId, HTMLDivElement | null>>({
    match: null,
    jobs: null,
    resume: null,
    ability: null,
    suggestion: null,
  });
  const orderRef = useRef<SwapCardId[]>(cardList.map((item) => item.id));
  const pausedRef = useRef(false);
  const animatingRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);
  const scoreTweenRef = useRef<gsap.core.Tween | null>(null);
  const jobScoreTweenRef = useRef<gsap.core.Tween | null>(null);
  const resumeScoreTweenRef = useRef<gsap.core.Tween | null>(null);
  const abilityTweenRef = useRef<gsap.core.Tween | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const jobsRevealTimeoutRef = useRef<number | null>(null);
  const resumeRevealTimeoutRef = useRef<number | null>(null);
  const abilityRevealTimeoutRef = useRef<number | null>(null);
  const suggestionRevealTimeoutRef = useRef<number | null>(null);
  const [matchScore, setMatchScore] = useState(0);
  const [matchRevealKey, setMatchRevealKey] = useState(0);
  const [selectedJobs, setSelectedJobs] = useState(() => pickDiverseJobs());
  const [jobScores, setJobScores] = useState(() => selectedJobs.map(() => 0));
  const [jobsRevealKey, setJobsRevealKey] = useState(0);
  const [resumeScore, setResumeScore] = useState(0);
  const [resumeMetrics, setResumeMetrics] = useState(() => resumeMetricLabels.map(() => 0));
  const [resumeRevealKey, setResumeRevealKey] = useState(0);
  const [abilityValues, setAbilityValues] = useState(() => radarValues.map(() => 0));
  const [abilityRevealKey, setAbilityRevealKey] = useState(0);
  const [suggestionRevealKey, setSuggestionRevealKey] = useState(0);

  const triggerMatchReveal = () => {
    scoreTweenRef.current?.kill();
    const targetScore = makeScoreTarget();
    const scoreState = { value: 0 };

    setMatchScore(0);
    setMatchRevealKey((value) => value + 1);
    scoreTweenRef.current = gsap.to(scoreState, {
      value: targetScore,
      duration: 1.35,
      ease: "power3.out",
      overwrite: true,
      onUpdate: () => {
        setMatchScore(Math.round(scoreState.value));
      },
      onComplete: () => {
        setMatchScore(targetScore);
      },
    });
  };

  const triggerJobsReveal = () => {
    jobScoreTweenRef.current?.kill();
    const nextJobs = pickDiverseJobs();
    const scoreState = { value: 0 };

    setSelectedJobs(nextJobs);
    setJobScores(nextJobs.map(() => 0));
    setJobsRevealKey((value) => value + 1);
    jobScoreTweenRef.current = gsap.to(scoreState, {
      value: 1,
      duration: 1.25,
      ease: "power3.out",
      overwrite: true,
      onUpdate: () => {
        setJobScores(nextJobs.map((job) => Math.round(job.score * scoreState.value)));
      },
      onComplete: () => {
        setJobScores(nextJobs.map((job) => job.score));
      },
    });
  };

  const triggerResumeReveal = () => {
    resumeScoreTweenRef.current?.kill();
    const targetMetrics = resumeMetricLabels.map(makeScoreTarget);
    const targetScore = Math.round(targetMetrics.reduce((sum, value) => sum + value, 0) / targetMetrics.length);
    const scoreState = { value: 0 };

    setResumeScore(0);
    setResumeMetrics(resumeMetricLabels.map(() => 0));
    setResumeRevealKey((value) => value + 1);
    resumeScoreTweenRef.current = gsap.to(scoreState, {
      value: 1,
      duration: 1.35,
      ease: "power3.out",
      overwrite: true,
      onUpdate: () => {
        const currentMetrics = targetMetrics.map((value) => Math.round(value * scoreState.value));
        const currentScore = Math.round(currentMetrics.reduce((sum, value) => sum + value, 0) / currentMetrics.length);
        setResumeScore(currentScore);
        setResumeMetrics(currentMetrics);
      },
      onComplete: () => {
        setResumeScore(targetScore);
        setResumeMetrics(targetMetrics);
      },
    });
  };

  const triggerAbilityReveal = () => {
    abilityTweenRef.current?.kill();
    const scoreState = { value: 0 };

    setAbilityValues(radarValues.map(() => 0));
    setAbilityRevealKey((value) => value + 1);
    abilityTweenRef.current = gsap.to(scoreState, {
      value: 1,
      duration: 1.35,
      ease: "power3.out",
      overwrite: true,
      onUpdate: () => {
        setAbilityValues(radarValues.map((value) => Math.round(value * scoreState.value)));
      },
      onComplete: () => {
        setAbilityValues(radarValues);
      },
    });
  };

  const triggerSuggestionReveal = () => {
    setSuggestionRevealKey((value) => value + 1);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const total = cardList.length;
    const applySlots = (order: SwapCardId[], animate: boolean) => {
      order.forEach((id, slotIndex) => {
        const target = cardRefs.current[id];
        if (!target) return;

        const slot = makeSlot(slotIndex, total);
        const vars = {
          xPercent: -50,
          yPercent: -50,
          x: slot.x,
          y: slot.y,
          z: slot.z,
          rotationX: slot.rotationX,
          rotationY: slot.rotationY,
          rotationZ: slot.rotationZ,
          scale: slot.scale,
          autoAlpha: slot.autoAlpha,
          zIndex: slot.zIndex,
          transformOrigin: "50% 50%",
          transformPerspective: 1200,
          overwrite: "auto" as const,
        };

        if (animate) {
          gsap.to(target, {
            ...vars,
            duration: 0.9,
            ease: "power3.out",
          });
        } else {
          gsap.set(target, vars);
        }
      });
    };

    const swap = () => {
      if (pausedRef.current || animatingRef.current) return;

      const currentOrder = orderRef.current;
      const leavingId = currentOrder[0];
      const nextOrder = [...currentOrder.slice(1), leavingId];
      const leaving = cardRefs.current[leavingId];
      if (!leaving) return;

      animatingRef.current = true;
      gsap.to(leaving, {
        xPercent: -50,
        yPercent: -50,
        x: -150,
        y: 132,
        z: 110,
        rotationX: 7,
        rotationY: -18,
        rotationZ: -7,
        scale: 0.96,
        autoAlpha: 0,
        duration: 0.58,
        ease: "power3.in",
        overwrite: "auto",
      });

      nextOrder.slice(0, -1).forEach((id, slotIndex) => {
        const target = cardRefs.current[id];
        if (!target) return;
        const slot = makeSlot(slotIndex, total);
        gsap.to(target, {
          xPercent: -50,
          yPercent: -50,
          x: slot.x,
          y: slot.y,
          z: slot.z,
          rotationX: slot.rotationX,
          rotationY: slot.rotationY,
          rotationZ: slot.rotationZ,
          scale: slot.scale,
          autoAlpha: slot.autoAlpha,
          zIndex: slot.zIndex,
          duration: 0.82,
          delay: 0.06,
          ease: "power3.out",
          overwrite: "auto",
        });
      });

      if (nextOrder[0] === "match") {
        if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = window.setTimeout(triggerMatchReveal, 180);
      }

      if (nextOrder[0] === "jobs") {
        if (jobsRevealTimeoutRef.current) window.clearTimeout(jobsRevealTimeoutRef.current);
        jobsRevealTimeoutRef.current = window.setTimeout(triggerJobsReveal, 180);
      }

      if (nextOrder[0] === "resume") {
        if (resumeRevealTimeoutRef.current) window.clearTimeout(resumeRevealTimeoutRef.current);
        resumeRevealTimeoutRef.current = window.setTimeout(triggerResumeReveal, 180);
      }

      if (nextOrder[0] === "ability") {
        if (abilityRevealTimeoutRef.current) window.clearTimeout(abilityRevealTimeoutRef.current);
        abilityRevealTimeoutRef.current = window.setTimeout(triggerAbilityReveal, 180);
      }

      if (nextOrder[0] === "suggestion") {
        if (suggestionRevealTimeoutRef.current) window.clearTimeout(suggestionRevealTimeoutRef.current);
        suggestionRevealTimeoutRef.current = window.setTimeout(triggerSuggestionReveal, 180);
      }

      window.setTimeout(() => {
        const lastSlot = makeSlot(total - 1, total);
        orderRef.current = nextOrder;
        gsap.set(leaving, {
          xPercent: -50,
          yPercent: -50,
          x: lastSlot.x + 70,
          y: lastSlot.y + 42,
          z: lastSlot.z - 80,
          rotationX: lastSlot.rotationX,
          rotationY: lastSlot.rotationY - 6,
          rotationZ: lastSlot.rotationZ - 2,
          scale: lastSlot.scale,
          autoAlpha: 0,
          zIndex: lastSlot.zIndex,
        });
        gsap.to(leaving, {
          xPercent: -50,
          yPercent: -50,
          x: lastSlot.x,
          y: lastSlot.y,
          z: lastSlot.z,
          rotationY: lastSlot.rotationY,
          rotationZ: lastSlot.rotationZ,
          autoAlpha: lastSlot.autoAlpha,
          duration: 0.72,
          ease: "power3.out",
          overwrite: "auto",
          onComplete: () => {
            animatingRef.current = false;
          },
        });
      }, 610);
    };

    const ctx = gsap.context(() => {
      applySlots(orderRef.current, false);
      triggerMatchReveal();
      gsap.from(".card-swap-stage", {
        autoAlpha: 0,
        y: 22,
        duration: 0.8,
        ease: "power3.out",
      });
    }, root);

    const interval = window.setInterval(swap, 4000);

    return () => {
      window.clearInterval(interval);
      if (pauseTimeoutRef.current) window.clearTimeout(pauseTimeoutRef.current);
      if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
      if (jobsRevealTimeoutRef.current) window.clearTimeout(jobsRevealTimeoutRef.current);
      if (resumeRevealTimeoutRef.current) window.clearTimeout(resumeRevealTimeoutRef.current);
      if (abilityRevealTimeoutRef.current) window.clearTimeout(abilityRevealTimeoutRef.current);
      if (suggestionRevealTimeoutRef.current) window.clearTimeout(suggestionRevealTimeoutRef.current);
      scoreTweenRef.current?.kill();
      jobScoreTweenRef.current?.kill();
      resumeScoreTweenRef.current?.kill();
      abilityTweenRef.current?.kill();
      ctx.revert();
    };
  }, []);

  const handleMouseEnter = () => {
    pausedRef.current = true;
  };

  const handleMouseLeave = () => {
    pausedRef.current = false;
  };

  const handleCardClick = () => {
    pausedRef.current = true;
    if (pauseTimeoutRef.current) window.clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 1000);
  };

  return (
    <section className="card-swap-showcase" ref={rootRef} aria-label="首页卡片队列展示">
      <span className="showcase-demo-label">界面示例数据 · 非录用概率</span>
      <div className="card-swap-back-glow" aria-hidden="true" />
      <div className="card-swap-ground" aria-hidden="true" />
      <div className="card-swap-stage">
        {cardList.map((card) => (
          <div
            className="card-swap-item"
            data-card={card.id}
            key={card.id}
            ref={(node) => {
              cardRefs.current[card.id] = node;
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleCardClick}
            aria-label={card.label}
          >
            {renderCard(
              card.id,
              matchScore,
              matchRevealKey,
              selectedJobs,
              jobScores,
              jobsRevealKey,
              resumeScore,
              resumeMetrics,
              resumeRevealKey,
              abilityValues,
              abilityRevealKey,
              suggestionRevealKey,
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
