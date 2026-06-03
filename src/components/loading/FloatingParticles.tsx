import { useMemo, type CSSProperties } from "react";

const STAR_COUNT = 420;
const LINE_COUNT = 18;

const pseudoRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

export default function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, index) => ({
        id: index,
        x: pseudoRandom(index + 1) * 100,
        y: pseudoRandom(index + 97) * 100,
        size: 0.8 + pseudoRandom(index + 211) * 3.2,
        opacity: 0.12 + pseudoRandom(index + 503) * 0.58,
        duration: 7 + pseudoRandom(index + 809) * 10,
        delay: -pseudoRandom(index + 1301) * 8,
      })),
    [],
  );

  const lines = useMemo(
    () =>
      Array.from({ length: LINE_COUNT }, (_, index) => ({
        id: index,
        x: 18 + pseudoRandom(index + 1701) * 78,
        y: 8 + pseudoRandom(index + 1901) * 78,
        width: 90 + pseudoRandom(index + 2101) * 260,
        rotate: -28 + pseudoRandom(index + 2301) * 56,
        opacity: 0.06 + pseudoRandom(index + 2501) * 0.16,
        duration: 9 + pseudoRandom(index + 2701) * 8,
        delay: -pseudoRandom(index + 2901) * 7,
      })),
    [],
  );

  return (
    <div className="loading-stars" aria-hidden="true">
      <div className="loading-nebula nebula-a" />
      <div className="loading-nebula nebula-b" />
      <div className="loading-nebula nebula-c" />
      {lines.map((line) => (
        <span
          key={line.id}
          className="loading-bg-line"
          style={
            {
              "--x": `${line.x}%`,
              "--y": `${line.y}%`,
              "--w": `${line.width}px`,
              "--r": `${line.rotate}deg`,
              "--o": line.opacity,
              "--d": `${line.duration}s`,
              "--delay": `${line.delay}s`,
            } as CSSProperties
          }
        />
      ))}
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
