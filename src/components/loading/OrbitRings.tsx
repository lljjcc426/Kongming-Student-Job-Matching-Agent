import type { CSSProperties } from "react";

const orbitConfigs = [
  { id: 1, dots: 5, duration: 3.4, delay: -0.2, className: "loading-orbit-wide" },
  { id: 2, dots: 4, duration: 4.6, delay: -1.1, className: "loading-orbit-tilt" },
  { id: 3, dots: 5, duration: 5.3, delay: -0.7, className: "loading-orbit-vertical reverse" },
  { id: 4, dots: 3, duration: 6.2, delay: -2.4, className: "loading-orbit-far" },
  { id: 5, dots: 4, duration: 4.1, delay: -1.7, className: "loading-orbit-cross reverse" },
  { id: 6, dots: 5, duration: 7.1, delay: -0.5, className: "loading-orbit-giant" },
  { id: 7, dots: 4, duration: 5.8, delay: -2.1, className: "loading-orbit-near reverse" },
];

export default function OrbitRings() {
  return (
    <div className="loading-orbits" aria-hidden="true">
      {orbitConfigs.map((orbit) => (
        <span
          key={orbit.id}
          className={`loading-orbit loading-orbit-${orbit.id} ${orbit.className}`}
          style={
            {
              "--orbit-duration": `${orbit.duration}s`,
              "--orbit-delay": `${orbit.delay}s`,
            } as CSSProperties
          }
        >
          {Array.from({ length: orbit.dots }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--dot-delay": `${orbit.delay - index * (orbit.duration / orbit.dots)}s`,
                  "--dot-scale": `${1 - index * 0.11}`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}
