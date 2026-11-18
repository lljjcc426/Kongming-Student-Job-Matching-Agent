import { BriefcaseBusiness, Check, ContactRound, MessagesSquare, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import ProductAvatar from "../brand/ProductAvatar";

const routes = [
  { d: "M81 230H136.5", from: .65, to: 1.65 },
  { d: "M235.5 230H260Q281 230 281 209V122Q281 101.2 302 101.2H308.1", from: 2.1, to: 3.05 },
  { d: "M235.5 230H308.1", from: 2.45, to: 3.45 },
  { d: "M235.5 230H260Q281 230 281 251V338Q281 358.8 302 358.8H308.1", from: 2.8, to: 3.85 },
  { d: "M399.9 101.2H422Q445 101.2 445 124.2V207Q445 230 468 230H490.5", from: 4.7, to: 5.95 },
  { d: "M399.9 230H490.5", from: 5.35, to: 6.65 },
  { d: "M399.9 358.8H422Q445 358.8 445 335.8V253Q445 230 468 230H490.5", from: 6, to: 7.35 },
  { d: "M528 282.5V405Q528 423 510 423H204Q186 423 186 405V284", from: 8, to: 10.1, gold: true },
];
const starts = [3.05, 3.45, 3.85];
const ends = [4.7, 5.35, 6];
const arrivals = [5.95, 6.65, 7.35];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const motionQuery = "(prefers-reduced-motion: reduce), (max-width: 740px)";

export default function AuthFlowDiagram() {
  const rootRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const glowId = useId();
  const [motionAllowed, setMotionAllowed] = useState(() => !window.matchMedia(motionQuery).matches);
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const media = window.matchMedia(motionQuery);
    const update = () => setMotionAllowed(!media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const root = rootRef.current!;
    const packets = Array.from(root.querySelectorAll<SVGGElement>("[data-packet]"));
    const paths = Array.from(root.querySelectorAll<SVGPathElement>("[data-track]"));
    const lights = Array.from(root.querySelectorAll<SVGPathElement>(".kn-route-lit"));
    const animatedRoutes = routes.map((route, index) => ({
      ...route,
      path: paths[index],
      length: paths[index].getTotalLength(),
      light: lights[index],
      group: packets[index],
      trail: packets[index].querySelector<SVGPathElement>("path")!,
      dots: Array.from(packets[index].querySelectorAll("circle")),
    }));
    const workers = Array.from(root.querySelectorAll<HTMLElement>(".kn-worker"));
    const progressBars = workers.map(worker => worker.querySelector<HTMLElement>(".kn-worker-progress i")!);
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".kn-output-row"));
    const wave = Array.from(root.querySelectorAll<HTMLElement>(".kn-mini-wave i"));
    const output = root.querySelector<HTMLElement>(".kn-output")!;
    const check = root.querySelector<HTMLElement>(".kn-output-check")!;
    const ping = root.querySelector<HTMLElement>(".kn-core-ping")!;
    const scan = root.querySelector<HTMLElement>(".kn-scan")!;

    function paint(time: number) {
      const fading = time > 10.6 ? clamp((11.7 - time) / 1.1) : 1;
      root.dataset.phase = time < 1.7 ? "input" : time < 3.9 ? "dispatch" : time < 7.4 ? "merge" : time < 10.2 ? "feedback" : "rest";
      animatedRoutes.forEach(route => {
        const progress = (time - route.from) / (route.to - route.from);
        const active = progress >= 0 && progress <= 1;
        route.group.style.opacity = active ? "1" : "0";
        route.light.style.opacity = time >= route.to ? String(.28 * fading) : "0";
        if (!active) return;
        const distance = route.length * progress;
        const tail = Math.min(50, distance);
        route.trail.setAttribute("stroke-dasharray", `${tail} ${route.length + 80}`);
        route.trail.setAttribute("stroke-dashoffset", String(-(distance - tail)));
        route.trail.style.opacity = String(Math.min(1, progress * 8, (1 - progress) * 10));
        const point = route.path.getPointAtLength(distance);
        route.dots.forEach(dot => {
          dot.setAttribute("cx", String(point.x));
          dot.setAttribute("cy", String(point.y));
        });
      });
      workers.forEach((worker, index) => {
        const progress = clamp((time - starts[index]) / (ends[index] - starts[index]));
        worker.dataset.state = time < starts[index] || fading < .2 ? "idle" : time < ends[index] ? "active" : "done";
        progressBars[index].style.transform = `scaleX(${progress * fading})`;
      });
      wave.forEach((bar, index) => {
        bar.style.transform = `scaleY(${time >= starts[2] && time <= ends[2] ? .45 + .55 * Math.abs(Math.sin(time * 7 - index * .8)) : .55})`;
      });
      rows.forEach((row, index) => {
        const arrived = clamp((time - arrivals[index]) / .35);
        row.style.opacity = String(.25 + .75 * arrived * fading);
        row.style.transform = `translateX(${(1 - arrived) * 2}px)`;
      });
      const completed = clamp((time - 7.45) / .4) * fading;
      check.style.opacity = String(completed);
      check.style.transform = `scale(${.65 + .35 * completed})`;
      output.dataset.complete = String(completed > .7);
      const pulse = time > 1.65 && time < 2.6 ? (time - 1.65) / .95 : time > 10.1 && time < 11 ? (time - 10.1) / .9 : -1;
      ping.style.opacity = pulse >= 0 ? String(.65 * (1 - pulse)) : "0";
      ping.style.transform = `scale(${pulse >= 0 ? 1 + pulse * .23 : 1})`;
      const scanning = time < 1.5 ? clamp(time / 1.5) : 0;
      scan.style.opacity = time < 1.5 ? String(Math.sin(scanning * Math.PI)) : "0";
      scan.style.transform = `translateY(${scanning * 180}%)`;
    }

    paint(motionAllowed ? elapsed.current : 7.9);
    if (!motionAllowed || paused) return;
    let previous = performance.now();
    let frame: number;
    function animate(now: number) {
      const delta = Math.min((now - previous) / 1000, .1);
      previous = now;
      if (!document.hidden) {
        elapsed.current = (elapsed.current + delta) % 12;
        paint(elapsed.current);
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [motionAllowed, paused, replay]);

  return <div ref={rootRef} className="auth-flow" role="group" aria-label="流程示意：简历输入后分发至画像、岗位和面试模块，结果汇合为准备清单，再反馈至孔明。">
    <div className="kn-grid" aria-hidden="true" />
    <svg className="kn-wires" viewBox="0 0 600 460" aria-hidden="true">
      <defs><filter id={glowId} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3" /></filter></defs>
      {routes.map((route, index) => <path key={index} data-track className={`kn-track${route.gold ? " kn-feedback" : ""}`} d={route.d} />)}
      <circle className="kn-junction" cx="260" cy="230" r="3" /><circle className="kn-junction" cx="468" cy="230" r="3" />
      {routes.map((route, index) => <g key={index}>
        <path className="kn-route-lit" d={route.d} />
        <g data-packet style={{ opacity: 0 }}>
          <path className="kn-packet-trail" d={route.d} stroke={route.gold ? "#d6ae63" : "#82b4e2"} />
          <circle r="7" fill={route.gold ? "#d6ae63" : "#82b4e2"} opacity=".45" filter={`url(#${glowId})`} />
          <circle r="2.6" fill={route.gold ? "#d6ae63" : "#6d9fce"} />
        </g>
      </g>)}
    </svg>
    <div className="kn-anchor kn-source" aria-hidden="true">
      <div className="kn-paper back" /><div className="kn-paper front"><div className="kn-paper-person" /><div className="kn-paper-line" /><div className="kn-paper-line short" /><div className="kn-paper-line" /><div className="kn-scan" /></div><span className="kn-node-label">简历</span>
    </div>
    <div className="kn-anchor kn-core" aria-hidden="true"><div className="kn-core-layer" /><div className="kn-core-layer second" /><div className="kn-core-face"><ProductAvatar /></div><div className="kn-core-ping" /></div>
    <div className="kn-anchor kn-worker profile" aria-hidden="true"><span className="kn-worker-state" /><div className="kn-worker-head"><ContactRound /><span>画像</span></div><div className="kn-mini-profile"><i /><span><b /><b /></span></div><div className="kn-worker-progress"><i /></div></div>
    <div className="kn-anchor kn-worker match" aria-hidden="true"><span className="kn-worker-state" /><div className="kn-worker-head"><BriefcaseBusiness /><span>岗位</span></div><div className="kn-mini-match"><b /><b /><b /></div><div className="kn-worker-progress"><i /></div></div>
    <div className="kn-anchor kn-worker interview" aria-hidden="true"><span className="kn-worker-state" /><div className="kn-worker-head"><MessagesSquare /><span>面试</span></div><div className="kn-mini-wave">{[5, 11, 16, 8, 13, 6].map((height, index) => <i key={index} style={{ height }} />)}</div><div className="kn-worker-progress"><i /></div></div>
    <div className="kn-anchor kn-output" aria-hidden="true"><div className="kn-output-back" /><div className="kn-output-face"><div className="kn-output-head"><i /><i /></div>{arrivals.map((_, index) => <div key={index} className="kn-output-row"><i /><b /></div>)}</div><div className="kn-output-check"><Check /></div><span className="kn-node-label">准备清单</span></div>
    <div className="kn-controls">
      <button className="kn-icon-button" type="button" disabled={!motionAllowed} aria-label={paused ? "播放动效" : "暂停动效"} aria-pressed={motionAllowed && !paused} onClick={() => setPaused(!paused)}>{paused ? <Play /> : <Pause />}</button>
      <button className="kn-icon-button" type="button" disabled={!motionAllowed} aria-label="重新播放" onClick={() => { elapsed.current = 0; setPaused(false); setReplay(value => value + 1); }}><RotateCcw /></button>
    </div>
  </div>;
}
