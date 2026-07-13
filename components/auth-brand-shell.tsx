"use client";

/**
 * Auth shell: Bank of Africa palette (#0A3C74, #00BDBB) + white,
 * sober professional frame with a light futuristic transformation backdrop.
 */
export function AuthBrandShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell relative flex min-h-dvh items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Base white + soft brand wash */}
      <div aria-hidden className="auth-shell-bg absolute inset-0" />

      {/* Animated layers */}
      <div aria-hidden className="auth-grid absolute inset-0" />
      <div aria-hidden className="auth-orb auth-orb-a absolute" />
      <div aria-hidden className="auth-orb auth-orb-b absolute" />
      <div aria-hidden className="auth-orb auth-orb-c absolute" />

      {/* Network / transformation motif */}
      <svg
        aria-hidden
        className="auth-network pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="auth-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0A3C74" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#00BDBB" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0A3C74" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {/* Abstract node graph — banking transformation / digital rails */}
        <g className="auth-network-lines" stroke="url(#auth-line)" strokeWidth="1" fill="none">
          <path d="M-40 120 C 180 80, 320 200, 520 140 S 820 60, 1100 160" />
          <path d="M-20 320 C 200 280, 360 400, 560 340 S 860 260, 1200 380" />
          <path d="M 80 -20 C 140 160, 100 300, 220 480 S 400 700, 280 900" />
          <path d="M 900 -30 C 860 180, 980 320, 900 480 S 960 720, 880 900" />
          <path d="M 520 920 C 580 700, 480 520, 620 360 S 540 120, 640 -20" />
        </g>
        <g className="auth-network-nodes" fill="#00BDBB">
          <circle className="auth-node" cx="12%" cy="22%" r="3" />
          <circle className="auth-node auth-node-delay" cx="28%" cy="48%" r="2.5" />
          <circle className="auth-node" cx="52%" cy="18%" r="3.5" />
          <circle className="auth-node auth-node-delay" cx="68%" cy="42%" r="2.5" />
          <circle className="auth-node" cx="82%" cy="28%" r="3" />
          <circle className="auth-node auth-node-delay" cx="18%" cy="72%" r="2.5" />
          <circle className="auth-node" cx="44%" cy="68%" r="3" />
          <circle className="auth-node auth-node-delay" cx="76%" cy="76%" r="2.5" />
          <circle className="auth-node" cx="90%" cy="58%" r="3" />
        </g>
      </svg>

      {/* Soft white veil (no backdrop-blur — expensive with animated/full-screen layers) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white/60"
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">{children}</div>

      {/* Footer brand strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-4">
        <p className="text-[11px] font-medium tracking-wide text-[#0A3C74]/70">
          Bank Of Africa — {new Date().getFullYear()} © — Program Office
        </p>
      </div>
    </div>
  );
}
