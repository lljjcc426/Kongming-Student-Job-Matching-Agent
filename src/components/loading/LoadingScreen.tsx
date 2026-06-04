import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import doubaoLoadingVideo from "../../assets/doubao-loading.mp4";
import kongmingLogo from "../../assets/kongming-logo.png";

type LoadingScreenProps = {
  onFinish: () => void;
};

const OVERLAY_DURATION = 6000;
const OVERLAY_EXIT_DELAY = 650;
const FALLBACK_DURATION = 10500;
const PROGRESS_START_FALLBACK = 1200;

export default function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const finishedRef = useRef(false);
  const overlayStartedRef = useRef(false);
  const finishTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const overlayStartFallbackRef = useRef<number | null>(null);
  const overlayExitTimerRef = useRef<number | null>(null);
  const overlayFrameRef = useRef<number | null>(null);

  const clearOverlayTimers = useCallback(() => {
    if (overlayStartFallbackRef.current !== null) {
      window.clearTimeout(overlayStartFallbackRef.current);
      overlayStartFallbackRef.current = null;
    }
    if (overlayFrameRef.current !== null) {
      window.cancelAnimationFrame(overlayFrameRef.current);
      overlayFrameRef.current = null;
    }
    if (overlayExitTimerRef.current !== null) {
      window.clearTimeout(overlayExitTimerRef.current);
      overlayExitTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);

    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    clearOverlayTimers();

    finishTimerRef.current = window.setTimeout(onFinish, 700);
  }, [clearOverlayTimers, onFinish]);

  const startOverlayProgress = useCallback(() => {
    if (overlayStartedRef.current || finishedRef.current) return;
    overlayStartedRef.current = true;
    setOverlayProgress(0);
    setShowOverlay(true);

    if (overlayStartFallbackRef.current !== null) {
      window.clearTimeout(overlayStartFallbackRef.current);
      overlayStartFallbackRef.current = null;
    }

    const startedAt = performance.now();

    const tick = (now: number) => {
      if (finishedRef.current) return;

      const elapsed = now - startedAt;
      const progress = Math.min(100, (elapsed / OVERLAY_DURATION) * 100);
      setOverlayProgress(progress);

      if (elapsed < OVERLAY_DURATION) {
        overlayFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        setOverlayProgress(100);
        overlayFrameRef.current = null;
        overlayExitTimerRef.current = window.setTimeout(() => {
          setShowOverlay(false);
          overlayExitTimerRef.current = null;
        }, OVERLAY_EXIT_DELAY);
      }
    };

    overlayFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    fallbackTimerRef.current = window.setTimeout(finish, FALLBACK_DURATION);
    overlayStartFallbackRef.current = window.setTimeout(startOverlayProgress, PROGRESS_START_FALLBACK);

    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      clearOverlayTimers();
    };
  }, [clearOverlayTimers, finish, startOverlayProgress]);

  const handleButtonPointerDown = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--ripple-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--ripple-y", `${event.clientY - rect.top}px`);
  };

  const roundedProgress = Math.round(overlayProgress);

  return (
    <main className={`loading-screen loading-video-only ${leaving ? "leaving" : ""}`} aria-label="孔明职配加载页">
      <div className="loading-video-stage" aria-hidden="true">
        <video
          src={doubaoLoadingVideo}
          autoPlay
          playsInline
          preload="auto"
          onLoadedData={startOverlayProgress}
          onCanPlay={startOverlayProgress}
          onEnded={finish}
        />
      </div>

      {showOverlay && (
        <section className="loading-brand-progress" aria-label="加载进度">
          <div className="loading-brand-progress-head">
            <img src={kongmingLogo} alt="" aria-hidden="true" />
            <div>
              <h1>孔明职配</h1>
              <p>学生求职智能工作台</p>
            </div>
          </div>
          <div className="loading-brand-progress-status">
            <span>AI 求职引擎加载中...</span>
            <strong>{roundedProgress}%</strong>
          </div>
          <div
            className="loading-brand-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={roundedProgress}
          >
            <i style={{ width: `${overlayProgress}%` }} />
          </div>
          <div className="loading-brand-progress-nodes" aria-hidden="true">
            <span className={overlayProgress >= 25 ? "done" : ""}>简历解析</span>
            <span className={overlayProgress >= 50 ? "done" : ""}>岗位匹配</span>
            <span className={overlayProgress >= 75 ? "done" : ""}>求职建议</span>
            <span className={overlayProgress >= 100 ? "done" : ""}>模拟面试</span>
          </div>
        </section>
      )}

      <button className="loading-start-button" type="button" onPointerDown={handleButtonPointerDown} onClick={finish}>
        <span>立刻开始</span>
      </button>
    </main>
  );
}
