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
      <h1 className="kongming-title" data-text={TITLE_TEXT}>
        {Array.from(TITLE_TEXT).map((char, index) => (
          <span className="kongming-title-char" data-index={index} key={`${char}-${index}`}>
            {char}
          </span>
        ))}
      </h1>
    </div>
  );
}
