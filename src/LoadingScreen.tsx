import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type LoadingScreenProps = {
  onFinish: () => void;
};

const stages = [
  { label: "解析简历", percent: 25 },
  { label: "岗位匹配", percent: 50 },
  { label: "生成建议", percent: 75 },
  { label: "模拟面试", percent: 100 },
];

const STAR_COUNT = 118;
const HAND_PARTICLE_COUNT = 330;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function LogoMark() {
  return (
    <div className="loading-logo-mark" aria-hidden="true">
      <svg viewBox="0 0 72 72" role="img">
        <defs>
          <linearGradient id="loadingLogoGlow" x1="12" x2="60" y1="10" y2="62">
            <stop stopColor="#e0f2fe" />
            <stop offset="0.46" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <path d="M17 30c0-9 7-16 19-16s19 7 19 16v14c0 9-8 15-19 15s-19-6-19-15V30Z" fill="rgba(15, 23, 42, 0.72)" stroke="url(#loadingLogoGlow)" strokeWidth="2.4" />
        <path d="M20 17 36 8l16 9-16 9-16-9Z" fill="rgba(56, 189, 248, 0.34)" stroke="#93c5fd" strokeWidth="2" />
        <path d="M52 18v10" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="52" cy="31" r="3" fill="#38bdf8" />
        <circle cx="29" cy="37" r="4" fill="#e0f2fe" />
        <circle cx="43" cy="37" r="4" fill="#e0f2fe" />
        <path d="M29 48c4 3 10 3 14 0" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, index) => {
        const seed = Math.sin((index + 7) * 19.17) * 10000;
        const fraction = seed - Math.floor(seed);
        return {
          id: index,
          x: (index * 37 + fraction * 31) % 100,
          y: (index * 61 + fraction * 43) % 100,
          size: 1 + ((index * 7) % 28) / 10,
          opacity: 0.18 + ((index * 11) % 54) / 100,
          duration: 6 + (index % 9) * 0.9,
          delay: -((index % 13) * 0.42),
        };
      }),
    [],
  );

  return (
    <div className="loading-stars" aria-hidden="true">
      {particles.map((particle) => (
        <i
          key={particle.id}
          style={
            {
              "--x": `${particle.x}%`,
              "--y": `${particle.y}%`,
              "--s": `${particle.size}px`,
              "--o": particle.opacity,
              "--d": `${particle.duration}s`,
              "--delay": `${particle.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function OrbitRings() {
  return (
    <div className="loading-orbits" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`loading-orbit loading-orbit-${index + 1}`}
          style={
            {
              "--orbit-duration": `${3.8 + index * 1.15}s`,
              "--orbit-delay": `${index * -0.36}s`,
            } as CSSProperties
          }
        >
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
}

function ParticleResumeHand() {
  const particles = useMemo(() => {
    return Array.from({ length: HAND_PARTICLE_COUNT }, (_, index) => {
      let x = 0;
      let y = 0;
      let type = "hand";

      if (index < 112) {
        const col = index % 14;
        const row = Math.floor(index / 14);
        x = 48 + col * 2.7 + Math.sin(index) * 0.45;
        y = 12 + row * 4.65 + Math.cos(index * 0.7) * 0.45;
        type = "resume";
      } else if (index < 158) {
        const local = index - 112;
        x = 50 + (local % 10) * 3.9;
        y = 23 + Math.floor(local / 10) * 7.2;
        type = local < 8 ? "avatar" : "resume-line";
      } else {
        const local = index - 158;
        if (local < 96) {
          const angle = (local / 96) * Math.PI * 2;
          const radiusX = 26 + (local % 7) * 1.2;
          const radiusY = 10 + (local % 5) * 0.8;
          x = 34 + Math.cos(angle) * radiusX + local * 0.07;
          y = 70 + Math.sin(angle) * radiusY + Math.sin(local * 0.28) * 1.3;
          type = "hand";
        } else {
          const fingerIndex = Math.floor((local - 96) / 19);
          const step = (local - 96) % 19;
          const baseX = 42 + fingerIndex * 7.2;
          const lift = Math.sin((step / 18) * Math.PI) * (8 + fingerIndex * 0.6);
          x = baseX + step * 0.9 + Math.sin(step * 0.8 + fingerIndex) * 0.7;
          y = 67 - lift + fingerIndex * 1.2;
          type = "finger";
        }
      }

      return {
        id: index,
        x: clamp(x, 8, 92),
        y: clamp(y, 8, 88),
        size: type === "resume" ? 3.2 : type === "avatar" ? 4.4 : 3,
        type,
        delay: -((index % 17) * 0.12),
      };
    });
  }, []);

  return (
    <div className="particle-resume-hand" aria-label="粒子手托举粒子简历">
      <div className="resume-glow-card" aria-hidden="true">
        <span className="resume-avatar-dot" />
        <span className="resume-line line-a" />
        <span className="resume-line line-b" />
        <span className="resume-line line-c" />
        <span className="resume-block block-a" />
        <span className="resume-block block-b" />
      </div>
      <div className="hand-glow-shape" aria-hidden="true" />
      {particles.map((particle) => (
        <i
          key={particle.id}
          className={`shape-particle ${particle.type}`}
          style={
            {
              "--x": `${particle.x}%`,
              "--y": `${particle.y}%`,
              "--s": `${particle.size}px`,
              "--delay": `${particle.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function LoadingProgress({ progress, currentStage }: { progress: number; currentStage: number }) {
  return (
    <div className="loading-progress-panel">
      <div className="loading-status-row">
        <span>AI 求职引擎加载中...</span>
        <strong>{Math.round(progress)}%</strong>
      </div>
      <div className="loading-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="loading-stage-list">
        {stages.map((stage, index) => {
          const done = progress >= stage.percent;
          const active = index === currentStage && !done;
          return (
            <div key={stage.label} className={`loading-stage ${done ? "done" : ""} ${active ? "active" : ""}`}>
              <span>{done ? "✓" : index + 1}</span>
              <em>{stage.label}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    const checkpoints = [
      { progress: 25, stage: 0, at: 1500 },
      { progress: 50, stage: 1, at: 3600 },
      { progress: 75, stage: 2, at: 5900 },
      { progress: 100, stage: 3, at: 8400 },
    ];

    checkpoints.forEach((checkpoint) => {
      const timer = window.setTimeout(() => {
        setCurrentStage(checkpoint.stage);
        setProgress(checkpoint.progress);
      }, checkpoint.at);
      timersRef.current.push(timer);
    });

    const finishTimer = window.setTimeout(finish, 10400);
    timersRef.current.push(finishTimer);

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [finish]);

  return (
    <main className="loading-screen" onDoubleClick={finish} aria-label="孔明职配加载页">
      <FloatingParticles />
      <span className="skip-hint">Double click to skip</span>
      <section className="loading-copy">
        <div className="loading-brand">
          <LogoMark />
          <div>
            <h1>孔明职配</h1>
            <p>学生求职智能工作台</p>
          </div>
        </div>
        <LoadingProgress progress={progress} currentStage={currentStage} />
        <footer className="loading-slogan">
          <strong>让每一份潜力，都有精准的舞台</strong>
          <span>KONGMING CAREER MATCHING</span>
        </footer>
      </section>
      <section className="loading-visual" aria-hidden="true">
        <OrbitRings />
        <ParticleResumeHand />
      </section>
    </main>
  );
}
