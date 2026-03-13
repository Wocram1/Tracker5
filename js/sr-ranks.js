// js/sr-ranks.js
export const SR_LEVELS = [
    { min: 0,   max: 199, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bronze_main" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8c5a3c"/>
      <stop offset="100%" stop-color="#4e2f1d"/>
    </linearGradient>
    <filter id="soft_shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#bronze_main)" filter="url(#soft_shadow)"/>
  <path d="M60 25 L90 40 V80 L60 95 L30 80 V40 Z" fill="none" stroke="#3d2614" stroke-width="0.5" opacity="0.4"/>
  <rect x="52" y="52" width="16" height="16" rx="2" transform="rotate(45 60 60)" fill="#3d2614" opacity="0.6"/>
</svg>` },

    { min: 200, max: 299, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bronze_1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8c5a3c"/><stop offset="100%" stop-color="#4e2f1d"/>
    </linearGradient>
  </defs>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#bronze_1)"/>
  <path d="M60 25 L90 40 V80 L60 95 L30 80 V40 Z" fill="none" stroke="#3d2614" stroke-width="1" opacity="0.3"/>
  <rect x="58" y="45" width="4" height="30" rx="2" fill="#3d2614" opacity="0.5"/>
</svg>` },

    { min: 300, max: 399, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bronze_2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9d6b4f"/><stop offset="100%" stop-color="#4e2f1d"/>
    </linearGradient>
  </defs>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#bronze_2)"/>
  <path d="M60 25 L90 40 V80 L60 95 L30 80 V40 Z" fill="none" stroke="#3d2614" stroke-width="1.5" opacity="0.4"/>
  <path d="M45 50 L60 65 L75 50" fill="none" stroke="#3d2614" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
  <path d="M45 65 L60 80 L75 65" fill="none" stroke="#3d2614" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
</svg>` },
    { min: 400, max: 499, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bronze_3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b07d5e"/><stop offset="50%" stop-color="#8c5a3c"/><stop offset="100%" stop-color="#3d2614"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="1.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#bronze_3)"/>
  <path d="M60 25 L90 40 V80 L60 95 L30 80 V40 Z" fill="none" stroke="#ffccaa" stroke-width="0.8" opacity="0.3" filter="url(#glow)"/>
  <path d="M60 40 V80 M40 60 H80" stroke="#2a1a0f" stroke-width="8" stroke-linecap="square" opacity="0.7"/>
  <rect x="52" y="52" width="16" height="16" rx="1" transform="rotate(45 60 60)" fill="#ffccaa" opacity="0.4"/>
</svg>` },
    { min: 400, max: 499, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="silver_main" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E0E0E0"/>
      <stop offset="50%" stop-color="#BDBDBD"/>
      <stop offset="100%" stop-color="#757575"/>
    </linearGradient>
  </defs>
  <path d="M15 45 L5 55 L15 65 M105 45 L115 55 L105 65" fill="none" stroke="#BDBDBD" stroke-width="3" stroke-linecap="round"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#silver_main)"/>
  <path d="M60 15 L100 35 L60 55 L20 35 Z" fill="white" opacity="0.15"/>
  <circle cx="60" cy="60" r="12" fill="#E0E0E0" stroke="#757575" stroke-width="2"/>
</svg>
` },
    { min: 500, max: 599, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="silver_1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#D0D0D0"/>
      <stop offset="50%" stop-color="#B0B0B0"/>
      <stop offset="100%" stop-color="#656565"/>
    </linearGradient>
  </defs>
  <path d="M15 45 L5 55 L15 65 M105 45 L115 55 L105 65" fill="none" stroke="#A0A0A0" stroke-width="2" stroke-linecap="round"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#silver_1)"/>
  <path d="M60 15 L100 35 L60 55 L20 35 Z" fill="white" opacity="0.1"/>
  <circle cx="60" cy="60" r="12" fill="#D0D0D0" stroke="#656565" stroke-width="1.5"/>
  <path d="M60 50 L65 60 L55 60 Z" fill="#656565"/>
</svg>` },
    { min: 600, max: 699, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="silver_2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E0E0E0"/>
      <stop offset="50%" stop-color="#C0C0C0"/>
      <stop offset="100%" stop-color="#757575"/>
    </linearGradient>
  </defs>
  <path d="M15 45 L5 55 L15 65 M105 45 L115 55 L105 65" fill="none" stroke="#BDBDBD" stroke-width="3" stroke-linecap="round"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#silver_2)"/>
  <path d="M60 15 L100 35 L60 55 L20 35 Z" fill="white" opacity="0.15"/>
  <circle cx="60" cy="60" r="12" fill="#E0E0E0" stroke="#757575" stroke-width="2"/>
  <path d="M50 55 C55 50, 65 50, 70 55 L60 60 Z" fill="#757575" opacity="0.7"/>
  <path d="M50 65 C55 70, 65 70, 70 65 L60 60 Z" fill="#757575" opacity="0.7"/>
</svg>
` },
    { min: 700, max: 799, svg: `<svg id="gold3">...</svg>` },
    { min: 800, max: 899, svg: `<svg id="gold4">...</svg>` },
    // ... füge hier alle deine Stufen hinzu
];

export function getRankSvg(value) {
    // Findet den ersten Rang, bei dem der Wert größer/gleich min ist (von oben nach unten prüfen)
    // Oder wir nutzen die find-Logik:
    const rank = SR_LEVELS.slice().reverse().find(r => value >= r.min);
    return rank ? rank.svg : SR_LEVELS[0].svg;
}