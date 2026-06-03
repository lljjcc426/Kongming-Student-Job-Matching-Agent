import { useMemo, type CSSProperties } from "react";

const PARTICLE_COUNT = 260;
const LINE_COUNT = 16;

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

export default function LoadingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
        id: index,
        x: random(index + 3) * 100,
        y: random(index + 89) * 100,
        size: 0.8 + random(index + 233) * 3.1,
        opacity: 0.16 + random(index + 377) * 0.5,
        duration: 7 + random(index + 521) * 9,
        delay: -random(index + 701) * 8,
      })),
    [],
  );

  const lines = useMemo(
    () =>
      Array.from({ length: LINE_COUNT }, (_, index) => ({
        id: index,
        x: 18 + random(index + 1001) * 76,
        y: 8 + random(index + 1201) * 82,
        width: 120 + random(index + 1401) * 280,
        rotate: -30 + random(index + 1601) * 60,
        opacity: 0.05 + random(index + 1801) * 0.14,
        duration: 9 + random(index + 2001) * 8,
        delay: -random(index + 2201) * 7,
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
