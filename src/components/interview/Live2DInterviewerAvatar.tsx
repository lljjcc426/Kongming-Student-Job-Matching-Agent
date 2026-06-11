import { useEffect, useRef, useState } from "react";
import type { AvatarSpeechState } from "../../types/interview";

const CUBISM_CORE_SRC = "/vendor/live2d/live2dcubismcore.min.js";
const FALLBACK_AVATAR_SRC = "/avatars/interviewer-2d/interviewer.png";
const MODEL_CANDIDATES = [
  "/avatars/interviewer-live2d/interviewer.model3.json",
  "/avatars/interviewer-live2d/interviewer_live2d_v1.model3.json",
];

const mouthParameterIds = ["ParamMouthOpenY", "ParamMouthOpen"];
const leftEyeParameterIds = ["ParamEyeLOpen", "ParamEyeOpenL", "ParamEyeOpenLeft"];
const rightEyeParameterIds = ["ParamEyeROpen", "ParamEyeOpenR", "ParamEyeOpenRight"];

type Live2DInterviewerAvatarProps = {
  status?: AvatarSpeechState;
  className?: string;
};

type Live2DRefs = {
  app?: any;
  model?: any;
};

const scriptLoaders = new Map<string, Promise<void>>();

const loadScriptOnce = (src: string) => {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as Window & { Live2DCubismCore?: unknown }).Live2DCubismCore) return Promise.resolve();
  const existing = scriptLoaders.get(src);
  if (existing) return existing;

  const loader = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (current) {
      current.addEventListener("load", () => resolve(), { once: true });
      current.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

  scriptLoaders.set(src, loader);
  return loader;
};

const resolveModelPath = async () => {
  for (const candidate of MODEL_CANDIDATES) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) continue;
      await response.clone().json();
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("No Live2D model3.json found.");
};

const findParameterIndex = (coreModel: any, ids: string[]) => {
  for (const id of ids) {
    try {
      const index = coreModel?.getParameterIndex?.(id);
      if (Number.isInteger(index) && index >= 0) return { id, index };
    } catch {
      // Continue trying aliases.
    }
  }
  return null;
};

const setParameter = (model: any, ids: string[], value: number) => {
  const coreModel = model?.internalModel?.coreModel;
  if (!coreModel) return;

  const parameter = findParameterIndex(coreModel, ids);
  try {
    if (parameter) {
      coreModel.setParameterValueByIndex?.(parameter.index, value, 1);
      return;
    }

    for (const id of ids) {
      coreModel.setParameterValueById?.(id, value, 1);
    }
  } catch {
    // Parameter names vary across exports; missing params should not break the page.
  }
};

const setMouthOpen = (model: any, value: number) => setParameter(model, mouthParameterIds, value);

const setEyeOpen = (model: any, value: number) => {
  setParameter(model, leftEyeParameterIds, value);
  setParameter(model, rightEyeParameterIds, value);
};

const fitModelToContainer = (model: any, container: HTMLElement) => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!model || width <= 0 || height <= 0) return;

  const bounds = model.getLocalBounds?.();
  const rawWidth = Math.max(bounds?.width || model.width || 1, 1);
  const rawHeight = Math.max(bounds?.height || model.height || 1, 1);
  const scale = Math.min((width * 0.82) / rawWidth, (height * 0.9) / rawHeight);

  if (model.anchor?.set) {
    model.anchor.set(0.5, 1);
  } else if (model.pivot?.set && bounds) {
    model.pivot.set(bounds.x + rawWidth / 2, bounds.y + rawHeight);
  }

  model.scale?.set?.(scale);
  model.position?.set?.(width / 2, height * 0.96);
};

export default function Live2DInterviewerAvatar({ status = "idle", className = "" }: Live2DInterviewerAvatarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const live2dRef = useRef<Live2DRefs>({});
  const [mode, setMode] = useState<"loading" | "ready" | "fallback">("loading");
  const normalizedStatus: AvatarSpeechState = mode === "fallback" ? "error" : status;

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    const setup = async () => {
      const host = canvasHostRef.current;
      if (!host) return;

      try {
        await loadScriptOnce(CUBISM_CORE_SRC);
        const PIXI = await import("pixi.js");
        (window as Window & { PIXI?: unknown }).PIXI = PIXI;
        const { Live2DModel } = await import("pixi-live2d-display/cubism4");
        const modelPath = await resolveModelPath();

        if (disposed) return;

        const app = new PIXI.Application({
          width: host.clientWidth,
          height: host.clientHeight,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
        });

        const model = await Live2DModel.from(modelPath, { autoInteract: false });
        if (disposed) {
          app.destroy(true, true);
          return;
        }

        host.replaceChildren();
        host.appendChild(app.view as HTMLCanvasElement);
        app.stage.addChild(model);
        live2dRef.current = { app, model };
        setMouthOpen(model, 0);
        setEyeOpen(model, 1);
        fitModelToContainer(model, host);
        resizeObserver = new ResizeObserver(() => {
          app.renderer.resize?.(host.clientWidth, host.clientHeight);
          fitModelToContainer(model, host);
        });
        resizeObserver.observe(host);
        setMode("ready");
      } catch (error) {
        console.warn("[Live2DInterviewerAvatar] fallback to PNG", error);
        if (!disposed) setMode("fallback");
      }
    };

    void setup();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      live2dRef.current.app?.destroy?.(true, true);
      live2dRef.current = {};
    };
  }, []);

  useEffect(() => {
    const model = live2dRef.current.model;
    if (!model || mode !== "ready") return undefined;

    setMouthOpen(model, 0);
    if (status !== "speaking") return undefined;

    const timer = window.setInterval(() => {
      const value = 0.15 + Math.random() * 0.75;
      setMouthOpen(model, value);
    }, 130);

    return () => {
      window.clearInterval(timer);
      setMouthOpen(model, 0);
    };
  }, [mode, status]);

  useEffect(() => {
    const model = live2dRef.current.model;
    if (!model || mode !== "ready") return undefined;

    let blinkTimer = 0;
    let closingTimer = 0;
    let openingTimer = 0;

    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        setEyeOpen(model, 0.08);
        closingTimer = window.setTimeout(() => setEyeOpen(model, 0.58), 90);
        openingTimer = window.setTimeout(() => {
          setEyeOpen(model, 1);
          scheduleBlink();
        }, 170);
      }, 3000 + Math.random() * 3000);
    };

    setEyeOpen(model, 1);
    scheduleBlink();

    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(closingTimer);
      window.clearTimeout(openingTimer);
      setEyeOpen(model, 1);
    };
  }, [mode]);

  return (
    <div className={`live2d-interviewer-avatar ${normalizedStatus} ${className}`.trim()} aria-label="AI 面试官数字人" ref={rootRef}>
      <div className="live2d-avatar-aura" />
      <div className="live2d-avatar-stage">
        {mode === "fallback" ? (
          <img className="live2d-avatar-fallback-image" src={FALLBACK_AVATAR_SRC} alt="AI 面试官" draggable={false} />
        ) : (
          <>
            <div className="live2d-canvas-host" ref={canvasHostRef} />
            {mode === "loading" ? <span className="live2d-loading-dot" aria-hidden="true" /> : null}
          </>
        )}
      </div>
      {normalizedStatus === "thinking" ? (
        <div className="live2d-thinking-indicator" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      ) : null}
      {normalizedStatus === "listening" ? <div className="live2d-listening-ring" aria-hidden="true" /> : null}
    </div>
  );
}
