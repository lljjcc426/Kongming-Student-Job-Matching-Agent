function LoadingLogo() {
  return (
    <div className="loading-logo-mark" aria-hidden="true">
      <svg viewBox="0 0 72 72" role="img">
        <defs>
          <linearGradient id="loadingLogoGlowV2" x1="12" x2="60" y1="10" y2="62">
            <stop stopColor="#f8fafc" />
            <stop offset="0.42" stopColor="#67e8f9" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <path d="M17 31c0-9 7-16 19-16s19 7 19 16v14c0 9-8 15-19 15s-19-6-19-15V31Z" fill="rgba(2, 8, 23, 0.72)" stroke="url(#loadingLogoGlowV2)" strokeWidth="2.4" />
        <path d="M20 17 36 8l16 9-16 9-16-9Z" fill="rgba(56, 189, 248, 0.34)" stroke="#bfdbfe" strokeWidth="2" />
        <path d="M52 18v10" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="52" cy="31" r="3" fill="#38bdf8" />
        <circle cx="29" cy="38" r="4" fill="#e0f2fe" />
        <circle cx="43" cy="38" r="4" fill="#e0f2fe" />
        <path d="M29 49c4 3 10 3 14 0" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function LoadingBrand() {
  return (
    <header className="loading-brand">
      <LoadingLogo />
      <div>
        <h1>孔明职配</h1>
        <p>学生求职智能工作台</p>
      </div>
    </header>
  );
}
