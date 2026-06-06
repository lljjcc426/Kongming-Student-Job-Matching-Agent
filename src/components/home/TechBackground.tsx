import FloatingLines from "./FloatingLines";

const binaryRows = [
  "0101 1100 1011 0010 1100 0110 0101 1001 0011 1010 1110 0101 1010 0101 0011 1100",
  "1100 0101 0110 1001 0101 1110 0011 0100 1011 0010 0101 1100 0010 1110 1001 0101",
];
const makeBinaryStream = (row: string) => Array.from({ length: 40 }, () => row).join(" ");
const cityBars = [36, 82, 48, 124, 70, 150, 58, 108, 88, 136, 62, 96, 72, 118, 54, 86, 142, 68];

export default function TechBackground() {
  return (
    <div className="km-tech-background" aria-hidden="true">
      <div className="km-binary-cloud">
        {binaryRows.map((row, index) => (
          <span key={row} className={`stream-${index + 1}`}>
            {makeBinaryStream(row)}
            <i>{makeBinaryStream(row)}</i>
          </span>
        ))}
      </div>

      <svg className="km-hud-lines" viewBox="0 0 1000 260" preserveAspectRatio="none">
        <path d="M24 80H180L222 38H410" />
        <path d="M520 46H742L792 92H968" />
        <path d="M120 180H284L326 136H512L560 180H720" />
        <circle cx="222" cy="38" r="5" />
        <circle cx="792" cy="92" r="5" />
        <circle cx="560" cy="180" r="5" />
      </svg>

      <div className="km-dot-matrix km-dot-left" />
      <div className="km-dot-matrix km-dot-right" />

      <div className="km-light-trails">
        <FloatingLines
          enabledWaves={["bottom", "middle", "top"]}
          lineCount={[7, 9, 11]}
          lineDistance={[46, 40, 34]}
          bottomWavePosition={{ x: 1.8, y: -0.98, rotate: -0.75 }}
          middleWavePosition={{ x: 4.7, y: -0.58, rotate: 0.18 }}
          topWavePosition={{ x: 9.2, y: -0.28, rotate: -0.34 }}
          animationSpeed={0.86}
          interactive
          bendRadius={5.4}
          bendStrength={-0.48}
          mouseDamping={0.055}
          parallax
          parallaxStrength={0.12}
          linesGradient={["#38bdf8", "#22d3ee", "#ffffff"]}
          mixBlendMode="screen"
        />
      </div>

      <div className="km-data-grid">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="km-city-silhouette">
        {cityBars.map((height, index) => (
          <span key={`${height}-${index}`} style={{ height }} />
        ))}
      </div>
    </div>
  );
}
