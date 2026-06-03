import { useMemo, type CSSProperties } from "react";

type ParticleKind = "resume-edge" | "resume-fill" | "resume-data" | "hand-core" | "hand-edge" | "energy";

type Particle = {
  id: number;
  x: number;
  y: number;
  r: number;
  opacity: number;
  kind: ParticleKind;
  delay: number;
  jitterX: number;
  jitterY: number;
};

let particleId = 0;

const random = (seed: number) => {
  const value = Math.sin(seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const addParticle = (particles: Particle[], kind: ParticleKind, x: number, y: number, seed: number, strong = false) => {
  particles.push({
    id: particleId++,
    x,
    y,
    r: strong ? 1.7 + random(seed + 11) * 1.6 : 0.8 + random(seed + 17) * 1.8,
    opacity: strong ? 0.7 + random(seed + 23) * 0.3 : 0.48 + random(seed + 29) * 0.42,
    kind,
    delay: -random(seed + 31) * 4.6,
    jitterX: -2.2 + random(seed + 37) * 4.4,
    jitterY: -2.2 + random(seed + 41) * 4.4,
  });
};

const addEllipseCloud = (particles: Particle[], kind: ParticleKind, cx: number, cy: number, rx: number, ry: number, count: number, seedBase: number, edgeBias = false) => {
  for (let index = 0; index < count; index += 1) {
    const seed = seedBase + index;
    const angle = random(seed) * Math.PI * 2;
    const radius = edgeBias ? 0.72 + random(seed + 1) * 0.3 : Math.sqrt(random(seed + 2));
    addParticle(particles, kind, cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius, seed, edgeBias);
  }
};

const addBezierRibbon = (
  particles: Particle[],
  kind: ParticleKind,
  start: [number, number],
  control: [number, number],
  end: [number, number],
  width: number,
  count: number,
  seedBase: number,
) => {
  for (let index = 0; index < count; index += 1) {
    const seed = seedBase + index;
    const t = random(seed);
    const oneMinus = 1 - t;
    const x = oneMinus * oneMinus * start[0] + 2 * oneMinus * t * control[0] + t * t * end[0];
    const y = oneMinus * oneMinus * start[1] + 2 * oneMinus * t * control[1] + t * t * end[1];
    const offset = (random(seed + 3) - 0.5) * width;
    addParticle(particles, kind, x + offset, y + (random(seed + 5) - 0.5) * width * 0.5, seed, true);
  }
};

const createParticleField = () => {
  particleId = 0;
  const particles: Particle[] = [];

  const resume = { x: 472, y: 78, width: 238, height: 330 };
  for (let index = 0; index < 900; index += 1) {
    const side = index % 4;
    const t = random(index + 101);
    const offset = (random(index + 109) - 0.5) * 8;
    if (side === 0) addParticle(particles, "resume-edge", resume.x + t * resume.width, resume.y + offset, index + 120, true);
    if (side === 1) addParticle(particles, "resume-edge", resume.x + resume.width + offset, resume.y + t * resume.height, index + 140, true);
    if (side === 2) addParticle(particles, "resume-edge", resume.x + t * resume.width, resume.y + resume.height + offset, index + 160, true);
    if (side === 3) addParticle(particles, "resume-edge", resume.x + offset, resume.y + t * resume.height, index + 180, true);
  }

  for (let index = 0; index < 760; index += 1) {
    const seed = index + 500;
    addParticle(
      particles,
      "resume-fill",
      resume.x + 18 + random(seed) * (resume.width - 36),
      resume.y + 18 + random(seed + 7) * (resume.height - 36),
      seed,
      false,
    );
  }

  addEllipseCloud(particles, "resume-data", resume.x + 54, resume.y + 56, 20, 20, 130, 900, true);
  const lineYs = [42, 64, 112, 138, 166, 214, 240, 268];
  lineYs.forEach((lineY, lineIndex) => {
    const width = lineIndex < 2 ? 116 : 152 - (lineIndex % 3) * 20;
    for (let index = 0; index < 76; index += 1) {
      const seed = 1200 + lineIndex * 100 + index;
      addParticle(particles, "resume-data", resume.x + 92 + random(seed) * width, resume.y + lineY + (random(seed + 4) - 0.5) * 7, seed, true);
    }
  });

  addEllipseCloud(particles, "hand-core", 405, 552, 198, 72, 980, 2200, false);
  addEllipseCloud(particles, "hand-edge", 405, 552, 210, 78, 560, 3300, true);
  addEllipseCloud(particles, "hand-core", 572, 636, 170, 38, 360, 3900, false);

  const fingerStarts: Array<[[number, number], [number, number], [number, number]]> = [
    [[295, 516], [330, 438], [428, 438]],
    [[352, 505], [388, 414], [500, 424]],
    [[414, 500], [452, 414], [578, 432]],
    [[476, 508], [532, 444], [644, 464]],
  ];
  fingerStarts.forEach((points, index) => addBezierRibbon(particles, "hand-edge", points[0], points[1], points[2], 24, 260, 4600 + index * 400));
  addBezierRibbon(particles, "hand-edge", [242, 558], [286, 486], [385, 506], 34, 320, 6500);
  addBezierRibbon(particles, "energy", [252, 654], [400, 604], [660, 648], 52, 420, 7200);

  return particles;
};

export default function ParticleResumeHand() {
  const particles = useMemo(createParticleField, []);

  return (
    <div className="particle-resume-hand" aria-label="粒子手托举粒子简历">
      <svg className="particle-hand-svg" viewBox="0 0 900 760" role="img" aria-label="由蓝白粒子组成的手托简历">
        <defs>
          <filter id="particleGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="resumeShell" x1="470" x2="710" y1="80" y2="410" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f8fafc" stopOpacity="0.18" />
            <stop offset="0.52" stopColor="#38bdf8" stopOpacity="0.08" />
            <stop offset="1" stopColor="#1d4ed8" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path className="resume-energy-shell" d="M472 94c0-15 13-26 28-24l183 20c15 2 26 16 25 31l-19 264c-1 16-15 28-31 26l-176-19c-16-2-28-16-27-32l17-266Z" fill="url(#resumeShell)" />
        <path className="hand-energy-shell" d="M220 565c78-84 174-107 288-84 42 8 85 24 125 39 33 13 70 28 104 31-39 42-94 60-164 57-48-2-85-16-128-19-69-4-133 20-225-24Z" fill="rgba(56, 189, 248, 0.075)" />
        <path className="hand-edge-glow" d="M248 560c59-66 124-83 208-61 48 13 79 43 138 52 42 6 83 4 120-6" fill="none" stroke="rgba(191, 219, 254, 0.52)" strokeWidth="2" />
        {particles.map((particle) => (
          <circle
            key={particle.id}
            className={`shape-particle loading-shape-particle ${particle.kind}`}
            cx={particle.x}
            cy={particle.y}
            r={particle.r}
            opacity={particle.opacity}
            style={
              {
                "--delay": `${particle.delay}s`,
                "--jx": `${particle.jitterX}px`,
                "--jy": `${particle.jitterY}px`,
              } as CSSProperties
            }
          />
        ))}
      </svg>
      <div className="hand-energy-mist" aria-hidden="true" />
    </div>
  );
}
