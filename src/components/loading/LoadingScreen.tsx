import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import doubaoLoadingVideo from "../../assets/doubao-loading.mp4";
import kongmingLogo from "../../assets/kongming-logo.png";

type LoadingScreenProps = {
  onFinish: () => void;
};

const OVERLAY_DURATION = 6000;
const OVERLAY_EXIT_DELAY = 650;
const FINISH_CHECK_DELAY = 10500;
const FINISH_RECHECK_DELAY = 500;
const VIDEO_END_EPSILON = 0.25;
const MAX_STALLED_WAIT = 22000;

export default function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const finishedRef = useRef(false);
  const overlayStartedRef = useRef(false);
  const playbackStartedAtRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const overlayExitTimerRef = useRef<number | null>(null);
  const overlayFrameRef = useRef<number | null>(null);

  const clearOverlayTimers = useCallback(() => {
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

    const startedAt = performance.now();

    const tick = (now: number) => {
      if (finishedRef.current) return;

      const video = videoRef.current;
      const elapsed = video && Number.isFinite(video.currentTime) ? video.currentTime * 1000 : now - startedAt;
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

  const scheduleFinishCheck = useCallback(
    (delay = FINISH_CHECK_DELAY) => {
      if (fallbackTimerRef.current !== null || finishedRef.current) return;

      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;

        if (finishedRef.current) return;

        const video = videoRef.current;
        const duration = video?.duration;
        const canReadDuration = typeof duration === "number" && Number.isFinite(duration) && duration > 0;
        const isVideoComplete = Boolean(video?.ended) || (video !== null && canReadDuration && video.currentTime >= duration - VIDEO_END_EPSILON);
        const playbackElapsed = playbackStartedAtRef.current === null ? 0 : performance.now() - playbackStartedAtRef.current;
        const isUnrecoverablyStalled = Boolean(video?.error) || (playbackElapsed > MAX_STALLED_WAIT && (!video || video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA));

        if (isVideoComplete || isUnrecoverablyStalled) {
          finish();
          return;
        }

        scheduleFinishCheck(FINISH_RECHECK_DELAY);
      }, delay);
    },
    [finish],
  );

  const handleVideoPlaying = useCallback(() => {
    if (playbackStartedAtRef.current === null) {
      playbackStartedAtRef.current = performance.now();
    }
    startOverlayProgress();
    scheduleFinishCheck();
  }, [scheduleFinishCheck, startOverlayProgress]);

  useEffect(() => {
    const video = videoRef.current;

    if (video) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // If autoplay with sound is blocked, the start button still lets the user enter the product.
        });
      }
    }

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
  }, [clearOverlayTimers]);

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
          ref={videoRef}
          src={doubaoLoadingVideo}
          autoPlay
          playsInline
          preload="auto"
          onPlay={handleVideoPlaying}
          onPlaying={handleVideoPlaying}
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

      <div className="loading-voltage-button">
        <button className="loading-start-button" type="button" onPointerDown={handleButtonPointerDown} onClick={finish}>
          <span>立刻开始</span>
        </button>
        <svg viewBox="0 0 234.6 61.3" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <filter id="loading-voltage-glow" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur className="blur" stdDeviation="2" result="coloredBlur" />
              <feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="1" result="turbulence" />
              <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="30" xChannelSelector="R" yChannelSelector="G" result="displace" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="displace" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path className="voltage line-1" d="m216.3 51.2c-3.7 0-3.7-1.1-7.3-1.1-3.7 0-3.7 6.8-7.3 6.8-3.7 0-3.7-4.6-7.3-4.6-3.7 0-3.7 3.6-7.3 3.6-3.7 0-3.7-0.9-7.3-0.9-3.7 0-3.7-2.7-7.3-2.7-3.7 0-3.7 7.8-7.3 7.8-3.7 0-3.7-4.9-7.3-4.9-3.7 0-3.7-7.8-7.3-7.8-3.7 0-3.7-1.1-7.3-1.1-3.7 0-3.7 3.1-7.3 3.1-3.7 0-3.7 10.9-7.3 10.9-3.7 0-3.7-12.5-7.3-12.5-3.7 0-3.7 4.6-7.3 4.6-3.7 0-3.7 4.5-7.3 4.5-3.7 0-3.7 3.6-7.3 3.6-3.7 0-3.7-10-7.3-10-3.7 0-3.7-0.4-7.3-0.4-3.7 0-3.7 2.3-7.3 2.3-3.7 0-3.7 7.1-7.3 7.1-3.7 0-3.7-11.2-7.3-11.2-3.7 0-3.7 3.5-7.3 3.5-3.7 0-3.7 3.6-7.3 3.6-3.7 0-3.7-2.9-7.3-2.9-3.7 0-3.7 8.4-7.3 8.4-3.7 0-3.7-14.6-7.3-14.6-3.7 0-3.7 5.8-7.3 5.8-2.2 0-3.8-0.4-5.5-1.5-1.8-1.1-1.8-2.9-2.9-4.8-1-1.8 1.9-2.7 1.9-4.8 0-3.4-2.1-3.4-2.1-6.8s-9.9-3.4-9.9-6.8 8-3.4 8-6.8c0-2.2 2.1-2.4 3.1-4.2 1.1-1.8 0.2-3.9 2-5 1.8-1 3.1-7.9 5.3-7.9 3.7 0 3.7 0.9 7.3 0.9 3.7 0 3.7 6.7 7.3 6.7 3.7 0 3.7-1.8 7.3-1.8 3.7 0 3.7-0.6 7.3-0.6 3.7 0 3.7-7.8 7.3-7.8h7.3c3.7 0 3.7 4.7 7.3 4.7 3.7 0 3.7-1.1 7.3-1.1 3.7 0 3.7 11.6 7.3 11.6 3.7 0 3.7-2.6 7.3-2.6 3.7 0 3.7-12.9 7.3-12.9 3.7 0 3.7 10.9 7.3 10.9 3.7 0 3.7 1.3 7.3 1.3 3.7 0 3.7-8.7 7.3-8.7 3.7 0 3.7 11.5 7.3 11.5 3.7 0 3.7-1.4 7.3-1.4 3.7 0 3.7-2.6 7.3-2.6 3.7 0 3.7-5.8 7.3-5.8 3.7 0 3.7-1.3 7.3-1.3 3.7 0 3.7 6.6 7.3 6.6s3.7-9.3 7.3-9.3c3.7 0 3.7 0.2 7.3 0.2 3.7 0 3.7 8.5 7.3 8.5 3.7 0 3.7 0.2 7.3 0.2 3.7 0 3.7-1.5 7.3-1.5 3.7 0 3.7 1.6 7.3 1.6s3.7-5.1 7.3-5.1c2.2 0 0.6 9.6 2.4 10.7s4.1-2 5.1-0.1c1 1.8 10.3 2.2 10.3 4.3 0 3.4-10.7 3.4-10.7 6.8s1.2 3.4 1.2 6.8 1.9 3.4 1.9 6.8c0 2.2 7.2 7.7 6.2 9.5-1.1 1.8-12.3-6.5-14.1-5.5-1.7 0.9-0.1 6.2-2.2 6.2z" />
          <path className="voltage line-2" d="m216.3 52.1c-3 0-3-0.5-6-0.5s-3 3-6 3-3-2-6-2-3 1.6-6 1.6-3-0.4-6-0.4-3-1.2-6-1.2-3 3.4-6 3.4-3-2.2-6-2.2-3-3.4-6-3.4-3-0.5-6-0.5-3 1.4-6 1.4-3 4.8-6 4.8-3-5.5-6-5.5-3 2-6 2-3 2-6 2-3 1.6-6 1.6-3-4.4-6-4.4-3-0.2-6-0.2-3 1-6 1-3 3.1-6 3.1-3-4.9-6-4.9-3 1.5-6 1.5-3 1.6-6 1.6-3-1.3-6-1.3-3 3.7-6 3.7-3-6.4-6-6.4-3 2.5-6 2.5h-6c-3 0-3-0.6-6-0.6s-3-1.4-6-1.4-3 0.9-6 0.9-3 4.3-6 4.3-3-3.5-6-3.5c-2.2 0-3.4-1.3-5.2-2.3-1.8-1.1-3.6-1.5-4.6-3.3s-4.4-3.5-4.4-5.7c0-3.4 0.4-3.4 0.4-6.8s2.9-3.4 2.9-6.8-0.8-3.4-0.8-6.8c0-2.2 0.3-4.2 1.3-5.9 1.1-1.8 0.8-6.2 2.6-7.3 1.8-1 5.5-2 7.7-2 3 0 3 2 6 2s3-0.5 6-0.5 3 5.1 6 5.1 3-1.1 6-1.1 3-5.6 6-5.6 3 4.8 6 4.8 3 0.6 6 0.6 3-3.8 6-3.8 3 5.1 6 5.1 3-0.6 6-0.6 3-1.2 6-1.2 3-2.6 6-2.6 3-0.6 6-0.6 3 2.9 6 2.9 3-4.1 6-4.1 3 0.1 6 0.1 3 3.7 6 3.7 3 0.1 6 0.1 3-0.6 6-0.6 3 0.7 6 0.7 3-2.2 6-2.2 3 4.4 6 4.4 3-1.7 6-1.7 3-4 6-4 3 4.7 6 4.7 3-0.5 6-0.5 3-0.8 6-0.8 3-3.8 6-3.8 3 6.3 6 6.3 3-4.8 6-4.8 3 1.9 6 1.9 3-1.9 6-1.9 3 1.3 6 1.3c2.2 0 5-0.5 6.7 0.5 1.8 1.1 2.4 4 3.5 5.8 1 1.8 0.3 3.7 0.3 5.9 0 3.4 3.4 3.4 3.4 6.8s-3.3 3.4-3.3 6.8 4 3.4 4 6.8c0 2.2-6 2.7-7 4.4-1.1 1.8 1.1 6.7-0.7 7.7-1.6 0.8-4.7-1.1-6.8-1.1z" />
        </svg>
        <span className="dots" aria-hidden="true">
          <i className="dot dot-1" />
          <i className="dot dot-2" />
          <i className="dot dot-3" />
          <i className="dot dot-4" />
          <i className="dot dot-5" />
        </span>
      </div>
    </main>
  );
}
