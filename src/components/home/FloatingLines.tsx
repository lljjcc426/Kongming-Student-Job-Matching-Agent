import { useEffect, useMemo, useRef, type CSSProperties } from "react";

type WaveName = "top" | "middle" | "bottom";

type WavePosition = {
  x: number;
  y: number;
  rotate: number;
};

type FloatingLinesProps = {
  linesGradient?: string[];
  gradientStart?: string;
  gradientMid?: string;
  gradientEnd?: string;
  enabledWaves?: WaveName[];
  lineCount?: number | number[];
  lineDistance?: number | number[];
  topWavePosition?: WavePosition;
  middleWavePosition?: WavePosition;
  bottomWavePosition?: WavePosition;
  animationSpeed?: number;
  interactive?: boolean;
  bendRadius?: number;
  bendStrength?: number;
  mouseDamping?: number;
  parallax?: boolean;
  parallaxStrength?: number;
  mixBlendMode?: CSSProperties["mixBlendMode"];
};

type WaveRuntimeConfig = {
  count: number;
  distance: number;
  position: WavePosition;
  amplitude: number;
  opacity: number;
  width: number;
  speed: number;
  phase: number;
};

const DEFAULT_GRADIENT = ["#38bdf8", "#22d3ee", "#ffffff"];
const MAX_CANVAS_DPR = 1.25;
const TARGET_FRAME_MS = 1000 / 36;
const WAVE_POINT_COUNT = 64;

function normalizeListValue(value: number | number[], index: number, fallback: number) {
  if (typeof value === "number") return value;
  return value[index] ?? fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createStrokeGradient(ctx: CanvasRenderingContext2D, width: number, colors: string[]) {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  const stops = colors.length > 0 ? colors : DEFAULT_GRADIENT;

  if (stops.length === 1) {
    gradient.addColorStop(0, stops[0]);
    gradient.addColorStop(1, stops[0]);
    return gradient;
  }

  stops.forEach((color, index) => {
    gradient.addColorStop(index / (stops.length - 1), color);
  });

  return gradient;
}

function getCssNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export default function FloatingLines({
  linesGradient,
  gradientStart,
  gradientMid,
  gradientEnd,
  enabledWaves = ["top", "middle", "bottom"],
  lineCount = [6],
  lineDistance = [5],
  topWavePosition,
  middleWavePosition,
  bottomWavePosition,
  animationSpeed = 1,
  interactive = true,
  bendRadius = 5.0,
  bendStrength = -0.5,
  mouseDamping = 0.05,
  parallax = true,
  parallaxStrength = 0.2,
  mixBlendMode = "screen",
}: FloatingLinesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetMouseRef = useRef({ x: -9999, y: -9999, active: 0 });
  const currentMouseRef = useRef({ x: -9999, y: -9999, active: 0 });
  const targetParallaxRef = useRef({ x: 0, y: 0 });
  const currentParallaxRef = useRef({ x: 0, y: 0 });

  const gradientColors = useMemo(() => {
    if (linesGradient && linesGradient.length > 0) return linesGradient;
    return [gradientStart, gradientMid, gradientEnd].filter(Boolean) as string[];
  }, [gradientEnd, gradientMid, gradientStart, linesGradient]);

  const waveConfig = useMemo(() => {
    const waveIndex = (waveType: WaveName) => enabledWaves.indexOf(waveType);
    const waveEnabled = (waveType: WaveName) => waveIndex(waveType) >= 0;

    const countFor = (waveType: WaveName) => {
      const index = waveIndex(waveType);
      if (index < 0) return 0;
      return clamp(Math.round(normalizeListValue(lineCount, index, 6)), 0, 64);
    };

    const distanceFor = (waveType: WaveName) => {
      const index = waveIndex(waveType);
      if (index < 0) return 0;
      return getCssNumber(normalizeListValue(lineDistance, index, 36), 36);
    };

    return {
      top: {
        count: waveEnabled("top") ? countFor("top") : 0,
        distance: distanceFor("top"),
        position: topWavePosition ?? { x: 9.6, y: -0.18, rotate: -0.34 },
        amplitude: 0.075,
        opacity: 0.18,
        width: 0.72,
        speed: 0.72,
        phase: 2.7,
      },
      middle: {
        count: waveEnabled("middle") ? countFor("middle") : 0,
        distance: distanceFor("middle"),
        position: middleWavePosition ?? { x: 4.8, y: -0.5, rotate: 0.18 },
        amplitude: 0.105,
        opacity: 0.34,
        width: 0.84,
        speed: 0.92,
        phase: 1.1,
      },
      bottom: {
        count: waveEnabled("bottom") ? countFor("bottom") : 0,
        distance: distanceFor("bottom"),
        position: bottomWavePosition ?? { x: 1.8, y: -0.9, rotate: -0.72 },
        amplitude: 0.13,
        opacity: 0.46,
        width: 0.96,
        speed: 1.08,
        phase: 0,
      },
    } satisfies Record<WaveName, WaveRuntimeConfig>;
  }, [bottomWavePosition, enabledWaves, lineCount, lineDistance, middleWavePosition, topWavePosition]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let active = true;
    let raf = 0;
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let lastRenderAt = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(container);

    const handlePointerMove = (event: PointerEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      targetMouseRef.current = { x, y, active: 1 };

      if (parallax) {
        targetParallaxRef.current = {
          x: ((x - rect.width / 2) / rect.width) * parallaxStrength * 32,
          y: ((y - rect.height / 2) / rect.height) * parallaxStrength * 24,
        };
      }
    };

    const handlePointerLeave = () => {
      targetMouseRef.current.active = 0;
      targetParallaxRef.current = { x: 0, y: 0 };
    };

    if (interactive) {
      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerleave", handlePointerLeave);
    }

    const drawWave = (config: WaveRuntimeConfig, time: number, order: number) => {
      if (config.count <= 0) return;

      const gradient = createStrokeGradient(ctx, width, gradientColors.length > 0 ? gradientColors : DEFAULT_GRADIENT);
      const centerX = width * 0.5 + config.position.x * 8 + currentParallaxRef.current.x;
      const centerY = height * (0.56 + config.position.y * 0.34) + currentParallaxRef.current.y;
      const lineGap = config.distance * 0.42;
      const amplitude = height * config.amplitude;
      const rotation = config.position.rotate;
      const halfCount = (config.count - 1) / 2;
      const pointCount = WAVE_POINT_COUNT;
      const mouse = currentMouseRef.current;
      const bendFalloff = Math.max(0.0001, bendRadius * 3600);
      const bendPower = bendStrength * 18 * mouse.active;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-width * 0.5, -height * 0.5);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 0; i < config.count; i += 1) {
        const lineOffset = (i - halfCount) * lineGap;
        const phase = config.phase + i * 0.18 + order * 0.42;
        const speed = time * animationSpeed * config.speed;
        const yBase = height * 0.54 + lineOffset;
        const path = new Path2D();

        for (let point = 0; point <= pointCount; point += 1) {
          const progress = point / pointCount;
          const x = -width * 0.16 + progress * width * 1.32;
          const primary = Math.sin(progress * Math.PI * 2.2 + speed * 0.82 + phase) * amplitude;
          const secondary = Math.sin(progress * Math.PI * 5.4 - speed * 0.36 + phase * 1.7) * amplitude * 0.22;
          const rawY = yBase + primary + secondary;

          const screenX = x + centerX - width * 0.5;
          const screenY = rawY + centerY - height * 0.5;
          const dx = screenX - mouse.x;
          const dy = screenY - mouse.y;
          const influence = Math.exp(-(dx * dx + dy * dy) / bendFalloff);
          const y = rawY + influence * bendPower;

          if (point === 0) {
            path.moveTo(x, y);
          } else {
            path.lineTo(x, y);
          }
        }

        const depth = 0.72 + (i / Math.max(config.count - 1, 1)) * 0.28;
        const baseAlpha = config.opacity * depth;

        ctx.strokeStyle = gradient;
        ctx.globalAlpha = baseAlpha * 0.13;
        ctx.lineWidth = config.width * 4.8;
        ctx.stroke(path);

        ctx.globalAlpha = baseAlpha * 0.22;
        ctx.lineWidth = config.width * 2.4;
        ctx.stroke(path);

        ctx.globalAlpha = baseAlpha * 0.82;
        ctx.lineWidth = config.width;
        ctx.stroke(path);

        if (i % 3 === 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.82)";
          ctx.globalAlpha = baseAlpha * 0.28;
          ctx.lineWidth = Math.max(0.65, config.width * 0.46);
          ctx.stroke(path);
        }
      }

      ctx.restore();
    };

    const render = (now: number) => {
      if (!active) return;
      if (now - lastRenderAt < TARGET_FRAME_MS) {
        raf = requestAnimationFrame(render);
        return;
      }
      lastRenderAt = now;

      const targetMouse = targetMouseRef.current;
      const currentMouse = currentMouseRef.current;
      currentMouse.x += (targetMouse.x - currentMouse.x) * mouseDamping;
      currentMouse.y += (targetMouse.y - currentMouse.y) * mouseDamping;
      currentMouse.active += (targetMouse.active - currentMouse.active) * mouseDamping;

      currentParallaxRef.current.x += (targetParallaxRef.current.x - currentParallaxRef.current.x) * mouseDamping;
      currentParallaxRef.current.y += (targetParallaxRef.current.y - currentParallaxRef.current.y) * mouseDamping;

      ctx.clearRect(0, 0, width, height);

      const time = now * 0.001;
      drawWave(waveConfig.top, time, 0);
      drawWave(waveConfig.middle, time, 1);
      drawWave(waveConfig.bottom, time, 2);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      if (interactive) {
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerleave", handlePointerLeave);
      }
      ctx.clearRect(0, 0, width, height);
    };
  }, [animationSpeed, bendRadius, bendStrength, gradientColors, interactive, mouseDamping, parallax, parallaxStrength, waveConfig]);

  return (
    <div ref={containerRef} className="floating-lines-container" style={{ mixBlendMode }}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
