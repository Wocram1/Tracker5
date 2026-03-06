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

    { min: 300, max: 399, svg: `<svg id="bronze3">...</svg>` },
    { min: 400, max: 499, svg: `<svg id="silver1">...</svg>` },
    // ... füge hier alle deine Stufen hinzu
];

export function getRankSvg(value) {
    // Findet den ersten Rang, bei dem der Wert größer/gleich min ist (von oben nach unten prüfen)
    // Oder wir nutzen die find-Logik:
    const rank = SR_LEVELS.slice().reverse().find(r => value >= r.min);
    return rank ? rank.svg : SR_LEVELS[0].svg;
}