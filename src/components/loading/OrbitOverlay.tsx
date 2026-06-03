import type { CSSProperties } from "react";

const orbits = [
  { id: 1, dots: 4, duration: 9.5, className: "orbit-wide" },
  { id: 2, dots: 3, duration: 12, className: "orbit-tilt reverse" },
  { id: 3, dots: 4, duration: 10.8, className: "orbit-vertical" },
  { id: 4, dots: 2, duration: 14, className: "orbit-far reverse" },
  { id: 5, dots: 3, duration: 11.2, className: "orbit-cross" },
];

export default function OrbitOverlay() {
  return (
    <div className="loading-orbits" aria-hidden="true">
      {orbits.map((orbit) => (
        <span
          key={orbit.id}
          className={`loading-orbit loading-orbit-${orbit.id} ${orbit.className}`}
          style={{ "--orbit-duration": `${orbit.duration}s` } as CSSProperties}
        >
          {Array.from({ length: orbit.dots }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--dot-delay": `${-(index * orbit.duration) / orbit.dots}s`,
                  "--dot-scale": `${1 - index * 0.14}`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}
