import { useId } from "react";

// All ten upgrades are additive: old purchases become visible without buying again.
export const MIZ_COSMETIC_STYLES = `
  .miz-coin { overflow: visible; flex: 0 0 auto; }
  .miz-cosmetic-frame {
    border: 2px solid #a995c3 !important;
    background: linear-gradient(135deg, #414655, #352340) !important;
    box-shadow: inset 0 0 0 2px #676578, 0 3px 12px #0005;
  }
  .miz-cosmetic-aura { isolation: isolate; }
  .myst-store-wallet.miz-cosmetic-aura { position: relative; }
  .miz-cosmetic-aura::after {
    content: ""; position: absolute; inset: -4px; border-radius: inherit;
    border: 2px solid #a78bfa; box-shadow: 0 0 12px #a78bfa88;
    pointer-events: none; opacity: .4;
    animation: mizAura 5s ease-in-out infinite;
  }
  .miz-orbit { transform-origin: 18px 18px; animation: mizOrbit 9s linear infinite; }
  .miz-glint { transform-origin: 28px 8px; animation: mizGlint 4s ease-in-out infinite; }
  @keyframes mizOrbit { to { transform: rotate(360deg); } }
  @keyframes mizGlint { 0%, 100% { opacity: .55; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.1); } }
  @keyframes mizAura { 0%, 100% { opacity: .35; } 50% { opacity: .65; } }
  @media (prefers-reduced-motion: reduce) {
    .miz-orbit, .miz-glint, .miz-cosmetic-aura::after { animation: none; }
  }
`;

export function mizCosmeticClasses(cosmetics = {}) {
  return [
    cosmetics.mystCounterFrame && "miz-cosmetic-frame",
    cosmetics.pulseAura && "miz-cosmetic-aura",
  ].filter(Boolean).join(" ");
}

export function MizCoin({ cosmetics = {} }) {
  const id = useId();
  const faceId = `${id}-face`;
  const haloId = `${id}-halo`;
  const smoke = cosmetics.smokeCoinFace;
  return (
    <svg className="miz-coin" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <radialGradient id={faceId} cx="34%" cy="27%">
          <stop offset="0%" stopColor={smoke ? "#ede2f5" : "#f8fafc"} />
          <stop offset="32%" stopColor={smoke ? "#b5a3c4" : "#d1d5db"} />
          <stop offset="70%" stopColor={smoke ? "#81708f" : "#9ca3af"} />
          <stop offset="100%" stopColor={smoke ? "#443650" : "#4b5563"} />
        </radialGradient>
        <radialGradient id={haloId}>
          <stop offset="60%" stopColor="#8b6dac" stopOpacity=".55" />
          <stop offset="100%" stopColor="#8b6dac" stopOpacity="0" />
        </radialGradient>
      </defs>
      {cosmetics.shadowHalo && <circle data-miz-cosmetic="shadowHalo" cx="18" cy="18" r="22" fill={`url(#${haloId})`} />}
      <circle data-miz-cosmetic={smoke ? "smokeCoinFace" : undefined} cx="18" cy="18" r="16" fill={`url(#${faceId})`} stroke="#e9d5ff" strokeWidth="1.5" />
      {cosmetics.frostedCoin && (
        <g data-miz-cosmetic="frostedCoin" stroke="#e0f2fe" strokeWidth=".6" opacity=".65">
          <path d="M10 7H26M6 12H30M4 17H32M5 22H31M8 27H28" />
          <path d="M7 10L11 6M25 30L30 25" strokeWidth="1.4" />
        </g>
      )}
      {cosmetics.violetCoinEdge && <circle data-miz-cosmetic="violetCoinEdge" cx="18" cy="18" r="15.4" fill="none" stroke="#a855f7" strokeWidth="2.2" />}
      <circle cx="18" cy="18" r="11.5" fill="none" stroke="#6b647c" strokeWidth="1" />
      {cosmetics.doubleRim && <circle data-miz-cosmetic="doubleRim" cx="18" cy="18" r="13.4" fill="none" stroke="#e9d5ff" strokeWidth=".85" />}
      <circle cx="18" cy="18" r="8.3" fill={smoke ? "#594568" : "#59546a"} stroke="#c4b5fd" strokeWidth=".8" />
      {cosmetics.engravedM && <text data-miz-cosmetic="engravedM" x="18.6" y="23" textAnchor="middle" fontFamily="Inter,system-ui,sans-serif" fontSize="12" fontWeight="900" fill="#21182e" stroke="#21182e" strokeWidth="1.2">M</text>}
      <text x="18" y="22.2" textAnchor="middle" fontFamily="Inter,system-ui,sans-serif" fontSize="12" fontWeight="900" fill={cosmetics.engravedM ? "#fff7d6" : "#fff"}>M</text>
      {cosmetics.orbitingSpecks && (
        <g className="miz-orbit" data-miz-cosmetic="orbitingSpecks">
          <circle cx="1" cy="18" r="1.8" fill="#c4b5fd" stroke="#7c698e" strokeWidth=".5" />
          <circle cx="35" cy="18" r="1.5" fill="#cbd5e1" stroke="#7c698e" strokeWidth=".5" />
        </g>
      )}
      {cosmetics.starGlint && <path className="miz-glint" data-miz-cosmetic="starGlint" d="M28 3L29.2 6.8L33 8L29.2 9.2L28 13L26.8 9.2L23 8L26.8 6.8Z" fill="#f8fafc" stroke="#ddd6fe" strokeWidth=".5" />}
    </svg>
  );
}
