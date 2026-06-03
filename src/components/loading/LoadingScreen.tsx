import { useCallback, useEffect, useRef, useState } from "react";
import HeroVisual from "./HeroVisual";
import LoadingBrand from "./LoadingBrand";
import LoadingParticles from "./LoadingParticles";
import LoadingProgress from "./LoadingProgress";
import OrbitOverlay from "./OrbitOverlay";
import { loadingStages } from "./stageData";

type LoadingScreenProps = {
  onFinish: () => void;
};

const pause = (duration: number, timers: number[]) =>
  new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, duration);
    timers.push(timer);
  });

export default function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setLeaving(true);
    const timer = window.setTimeout(onFinish, 700);
    timersRef.current.push(timer);
  }, [onFinish]);

  useEffect(() => {
    let cancelled = false;

    const animateTo = (target: number, duration: number) =>
      new Promise<void>((resolve) => {
        const from = progressRef.current;
        const start = performance.now();

        const tick = (now: number) => {
          if (cancelled || finishedRef.current) return;
          const ratio = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - ratio, 3);
          const next = from + (target - from) * eased;
          progressRef.current = next;
          setProgress(next);
          if (ratio < 1) {
            frameRef.current = window.requestAnimationFrame(tick);
          } else {
            progressRef.current = target;
            setProgress(target);
            resolve();
          }
        };

        frameRef.current = window.requestAnimationFrame(tick);
      });

    const run = async () => {
      for (let index = 0; index < loadingStages.length; index += 1) {
        if (cancelled || finishedRef.current) return;
        setCurrentStage(index);
        await animateTo(loadingStages[index].percent, index === 0 ? 1500 : 1300);
        await pause(index === loadingStages.length - 1 ? 2000 : 1000, timersRef.current);
      }
      finish();
    };

    void run();

    return () => {
      cancelled = true;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [finish]);

  return (
    <main className={`loading-screen loading-screen-asset ${leaving ? "leaving" : ""}`} onDoubleClick={finish} aria-label="孔明职配加载页">
      <LoadingParticles />
      <span className="skip-hint">Double click to skip</span>
      <section className="loading-copy">
        <LoadingBrand />
        <LoadingProgress progress={progress} currentStage={currentStage} />
        <footer className="loading-slogan">
          <strong>让每一份潜力，都有精准的舞台</strong>
          <span>KONGMING CAREER MATCHING</span>
        </footer>
      </section>
      <section className="loading-visual" aria-hidden="true">
        <OrbitOverlay />
        <HeroVisual />
        <div className="loading-data-flow data-flow-a" />
        <div className="loading-data-flow data-flow-b" />
      </section>
    </main>
  );
}
