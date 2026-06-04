import type { PointerEvent as ReactPointerEvent } from "react";

const TITLE_TEXT = "孔明职配";

export default function KongmingTitle() {
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--title-spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--title-spot-y", `${event.clientY - rect.top}px`);
  };

  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.classList.add("is-title-active");
    handlePointerMove(event);
  };

  const handlePointerExit = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove("is-title-active");
    event.currentTarget.style.setProperty("--title-spot-x", "-999px");
    event.currentTarget.style.setProperty("--title-spot-y", "-999px");
  };

  return (
    <div
      className="kongming-title-wrap"
      aria-label={TITLE_TEXT}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerExit}
      onPointerCancel={handlePointerExit}
    >
      <svg className="kongming-orbit-bg" viewBox="0 0 760 240" aria-hidden="true" focusable="false">
        <path className="orbit-line orbit-line-main" d="M28 128 C158 34 362 14 548 58 C660 84 726 128 744 168" />
        <path className="orbit-line orbit-line-soft" d="M62 176 C206 116 414 104 620 126 C684 134 726 148 748 164" />
        <path className="orbit-line orbit-line-thin" d="M76 78 C212 132 438 146 650 90 C698 78 728 66 746 52" />
        <circle className="orbit-spark spark-a" cx="196" cy="62" r="5" />
        <circle className="orbit-spark spark-b" cx="596" cy="124" r="4" />
        <circle className="orbit-spark spark-c" cx="704" cy="72" r="3" />
      </svg>

      <h1 className="kongming-title" data-text={TITLE_TEXT}>
        {Array.from(TITLE_TEXT).map((char) => (
          <span className="kongming-title-char" key={char}>
            {char}
          </span>
        ))}
      </h1>
      <div className="kongming-title-reflection" aria-hidden="true" />
    </div>
  );
}
