import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, BriefcaseBusiness, Check, CheckCircle2, FileSearch, Lightbulb, Radar, UserRound } from "lucide-react";
import gsap from "gsap";

type EvidenceState = "有证据" | "部分证据" | "待确认";

type JobItem = {
  title: string;
  track: string;
  category: string;
  evidenceState: EvidenceState;
};

type SwapCardId = "match" | "jobs" | "resume" | "ability" | "suggestion";

const jobPool: JobItem[] = [
  { title: "前端开发实习生", track: "软件开发 / 前端", category: "frontend", evidenceState: "有证据" },
  { title: "后端开发实习生", track: "软件开发 / 后端", category: "backend", evidenceState: "部分证据" },
  { title: "移动端开发实习生", track: "软件开发 / 客户端", category: "mobile", evidenceState: "待确认" },
  { title: "测试开发实习生", track: "软件开发 / 测试", category: "testing", evidenceState: "部分证据" },
  { title: "大模型应用工程师", track: "AI / 大模型应用", category: "llm", evidenceState: "有证据" },
  { title: "算法工程师", track: "AI / 算法", category: "algorithm", evidenceState: "待确认" },
  { title: "数据分析实习生", track: "数据 / 分析", category: "analytics", evidenceState: "有证据" },
  { title: "数据工程实习生", track: "数据 / 工程", category: "data-engineering", evidenceState: "部分证据" },
  { title: "AI 产品实习生", track: "产品 / AI", category: "ai-product", evidenceState: "部分证据" },
  { title: "产品经理实习生", track: "产品 / 互联网", category: "product", evidenceState: "待确认" },
];

const strengths = ["技能有原文证据", "项目经历可追溯", "目标方向已确认", "硬性条件待核对"];
const resumeChecks: Array<[string, EvidenceState]> = [
  ["教育信息", "有证据"],
  ["技能证据", "部分证据"],
  ["项目证据", "有证据"],
  ["目标方向", "待确认"],
];
const evidenceMatrix: Array<[string, EvidenceState]> = [
  ["岗位要求", "有证据"],
  ["原文定位", "有证据"],
  ["用户确认", "部分证据"],
  ["缺口计划", "待确认"],
];
const suggestions = [
  "保留原文并逐条确认",
  "补充真实成果数据",
  "缺失技能进入学习计划",
  "投递前再次事实检查",
];
const cardList: Array<{ id: SwapCardId; label: string }> = [
  { id: "match", label: "证据匹配示例" },
  { id: "jobs", label: "职业方向示例" },
  { id: "resume", label: "简历证据示例" },
  { id: "ability", label: "证据矩阵示例" },
  { id: "suggestion", label: "优化建议" },
];

function pickDiverseJobs() {
  const shuffled = [...jobPool].sort(() => Math.random() - 0.5);
  const categories = new Set<string>();
  const result: JobItem[] = [];
  for (const job of shuffled) {
    if (categories.has(job.category)) continue;
    result.push(job);
    categories.add(job.category);
    if (result.length === 4) break;
  }
  return result;
}

function makeSlot(index: number, total: number) {
  return {
    x: index * 64,
    y: index * -42,
    z: index * -120,
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
      <span>{icon}{title}</span>
      <UserRound size={18} />
    </header>
  );
}

function StateBadge({ state }: { state: EvidenceState }) {
  return <b className={`evidence-state state-${state === "有证据" ? "covered" : state === "部分证据" ? "partial" : "unknown"}`}>{state}</b>;
}

function MatchSwapCard({ revealKey }: { revealKey: number }) {
  return (
    <article className="swap-card swap-match-card">
      <div className="swap-card-body match-body">
        <div className="swap-match-title"><span /><strong>证据匹配示例</strong><span /></div>
        <div className="swap-avatar-zone">
          <span className="swap-avatar-ring ring-one" />
          <span className="swap-avatar-ring ring-two" />
          <span className="swap-avatar-ring ring-three" />
          <div className="swap-avatar-core"><Check size={70} strokeWidth={1.75} /></div>
          <span className="swap-check-badge"><Check size={18} strokeWidth={3} /></span>
        </div>
        <div className="swap-match-score"><span>匹配结论</span><strong>逐项核验</strong></div>
        <section className={`swap-match-tags${revealKey > 0 ? " is-revealing" : ""}`}>
          <p>只展示可追溯事实</p>
          <div className="swap-match-tag-grid" key={revealKey}>
            {strengths.map((item) => <span key={item}><Check size={13} strokeWidth={2.8} />{item}</span>)}
          </div>
        </section>
      </div>
    </article>
  );
}

function JobsSwapCard({ items, revealKey }: { items: JobItem[]; revealKey: number }) {
  return (
    <article className={`swap-card swap-jobs-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<BriefcaseBusiness size={20} />} title="职业方向示例" />
      <div className="swap-card-body jobs-body">
        <div className="swap-job-list" key={revealKey}>
          {items.map((job, index) => (
            <section className="swap-job-item" key={job.title} style={{ "--item-index": index } as CSSProperties}>
              <span className="swap-job-icon"><BriefcaseBusiness size={18} /></span>
              <div><strong>{job.title}</strong><small>{job.track}</small></div>
              <StateBadge state={job.evidenceState} />
            </section>
          ))}
        </div>
        <button type="button" className="swap-card-link">查看更多岗位<ArrowUpRight size={15} /></button>
      </div>
    </article>
  );
}

function ChecklistCard({ revealKey }: { revealKey: number }) {
  return (
    <article className={`swap-card swap-resume-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<FileSearch size={20} />} title="简历事实检查" />
      <div className="swap-card-body resume-body">
        <div className="swap-score-ring"><div><strong>可追溯</strong><small>不计算能力分</small></div></div>
        <div className="swap-progress-list" key={revealKey}>
          {resumeChecks.map(([label, state], index) => (
            <section key={label} style={{ "--item-index": index } as CSSProperties}>
              <div><span>{label}</span><StateBadge state={state} /></div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

function EvidenceMatrixCard({ revealKey }: { revealKey: number }) {
  return (
    <article className={`swap-card swap-ability-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<Radar size={20} />} title="要求证据矩阵" />
      <div className="swap-card-body ability-body evidence-matrix-preview" key={revealKey}>
        {evidenceMatrix.map(([label, state], index) => (
          <section key={label} style={{ "--item-index": index } as CSSProperties}>
            <span>{label}</span><StateBadge state={state} />
          </section>
        ))}
      </div>
    </article>
  );
}

function SuggestionSwapCard({ revealKey }: { revealKey: number }) {
  return (
    <article className={`swap-card swap-suggestion-card${revealKey > 0 ? " is-revealing" : ""}`}>
      <SwapHeader icon={<Lightbulb size={20} />} title="事实约束建议" />
      <div className="swap-card-body suggestion-body">
        <div className="swap-suggestion-list" key={revealKey}>
          {suggestions.map((item, index) => (
            <button type="button" key={item} style={{ "--item-index": index } as CSSProperties}>
              <CheckCircle2 size={19} /><span>{item}</span>
            </button>
          ))}
        </div>
        <button type="button" className="swap-card-link">查看详细建议<ArrowUpRight size={15} /></button>
      </div>
    </article>
  );
}

export default function CardSwapShowcase() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<SwapCardId, HTMLDivElement | null>>({ match: null, jobs: null, resume: null, ability: null, suggestion: null });
  const orderRef = useRef<SwapCardId[]>(cardList.map((item) => item.id));
  const pausedRef = useRef(false);
  const animatingRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const [selectedJobs, setSelectedJobs] = useState(() => pickDiverseJobs());
  const [revealKeys, setRevealKeys] = useState<Record<SwapCardId, number>>({ match: 1, jobs: 0, resume: 0, ability: 0, suggestion: 0 });

  const reveal = (id: SwapCardId) => {
    if (id === "jobs") setSelectedJobs(pickDiverseJobs());
    setRevealKeys((current) => ({ ...current, [id]: current[id] + 1 }));
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
        const vars = { xPercent: -50, yPercent: -50, ...slot, transformOrigin: "50% 50%", transformPerspective: 1200, overwrite: "auto" as const };
        if (animate) gsap.to(target, { ...vars, duration: 0.9, ease: "power3.out" });
        else gsap.set(target, vars);
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
      gsap.to(leaving, { xPercent: -50, yPercent: -50, x: -150, y: 132, z: 110, rotationX: 7, rotationY: -18, rotationZ: -7, scale: 0.96, autoAlpha: 0, duration: 0.58, ease: "power3.in", overwrite: "auto" });
      nextOrder.slice(0, -1).forEach((id, slotIndex) => {
        const target = cardRefs.current[id];
        if (!target) return;
        gsap.to(target, { xPercent: -50, yPercent: -50, ...makeSlot(slotIndex, total), duration: 0.82, delay: 0.06, ease: "power3.out", overwrite: "auto" });
      });
      if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = window.setTimeout(() => reveal(nextOrder[0]), 180);
      window.setTimeout(() => {
        const lastSlot = makeSlot(total - 1, total);
        orderRef.current = nextOrder;
        gsap.set(leaving, { xPercent: -50, yPercent: -50, ...lastSlot, x: lastSlot.x + 70, y: lastSlot.y + 42, autoAlpha: 0 });
        gsap.to(leaving, { xPercent: -50, yPercent: -50, ...lastSlot, duration: 0.72, ease: "power3.out", overwrite: "auto", onComplete: () => { animatingRef.current = false; } });
      }, 610);
    };
    const ctx = gsap.context(() => {
      applySlots(orderRef.current, false);
      gsap.from(".card-swap-stage", { autoAlpha: 0, y: 22, duration: 0.8, ease: "power3.out" });
    }, root);
    const interval = window.setInterval(swap, 4000);
    return () => {
      window.clearInterval(interval);
      if (pauseTimeoutRef.current) window.clearTimeout(pauseTimeoutRef.current);
      if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
      ctx.revert();
    };
  }, []);

  const renderCard = (id: SwapCardId) => {
    if (id === "match") return <MatchSwapCard revealKey={revealKeys.match} />;
    if (id === "jobs") return <JobsSwapCard items={selectedJobs} revealKey={revealKeys.jobs} />;
    if (id === "resume") return <ChecklistCard revealKey={revealKeys.resume} />;
    if (id === "ability") return <EvidenceMatrixCard revealKey={revealKeys.ability} />;
    return <SuggestionSwapCard revealKey={revealKeys.suggestion} />;
  };

  const pauseBriefly = () => {
    pausedRef.current = true;
    if (pauseTimeoutRef.current) window.clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = window.setTimeout(() => { pausedRef.current = false; }, 1000);
  };

  return (
    <section className="card-swap-showcase" ref={rootRef} aria-label="首页卡片队列展示">
      <span className="showcase-demo-label">界面示例数据 · 不计算录用概率</span>
      <div className="card-swap-back-glow" aria-hidden="true" />
      <div className="card-swap-ground" aria-hidden="true" />
      <div className="card-swap-stage">
        {cardList.map((card) => (
          <div
            className="card-swap-item"
            data-card={card.id}
            key={card.id}
            ref={(node) => { cardRefs.current[card.id] = node; }}
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
            onClick={pauseBriefly}
            aria-label={card.label}
          >
            {renderCard(card.id)}
          </div>
        ))}
      </div>
    </section>
  );
}
