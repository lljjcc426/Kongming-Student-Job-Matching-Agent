export default function ConnectionLines() {
  return (
    <svg className="km-connection-lines" viewBox="0 0 980 760" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="kmLineGradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(147,197,253,0.08)" />
          <stop offset="42%" stopColor="rgba(56,189,248,0.62)" />
          <stop offset="100%" stopColor="rgba(147,197,253,0.12)" />
        </linearGradient>
      </defs>
      <path d="M330 184C404 160 444 162 500 190" />
      <path d="M330 294C408 284 452 302 500 340" />
      <path d="M676 162C742 118 808 102 882 124" />
      <path d="M678 360C766 408 824 438 886 514" />
      <path d="M318 572C412 514 456 502 512 514" />
      <circle cx="330" cy="184" r="5" />
      <circle cx="500" cy="340" r="5" />
      <circle cx="882" cy="124" r="5" />
      <circle cx="886" cy="514" r="5" />
      <circle cx="318" cy="572" r="5" />
    </svg>
  );
}
