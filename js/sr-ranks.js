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
</svg>` },

      { min: 700, max: 799, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="silver_3" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F0F0F0"/>
      <stop offset="30%" stop-color="#E0E0E0"/>
      <stop offset="70%" stop-color="#C0C0C0"/>
      <stop offset="100%" stop-color="#606060"/>
    </linearGradient>
    <filter id="silver_glow"><feGaussianBlur stdDeviation="0.8" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <path d="M15 45 L5 55 L15 65 M105 45 L115 55 L105 65" fill="none" stroke="#A0A0A0" stroke-width="3" stroke-linecap="round"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#silver_3)"/>
  <path d="M60 15 L100 35 L60 55 L20 35 Z" fill="white" opacity="0.2" filter="url(#silver_glow)"/>
  <circle cx="60" cy="60" r="12" fill="#E0E0E0" stroke="#757575" stroke-width="2.5"/>
  <path d="M60 48 C65 48, 70 53, 70 60 C70 67, 65 72, 60 72 C55 72, 50 67, 50 60 C50 53, 55 48, 60 48 M60 50 L60 70 M50 60 L70 60" fill="none" stroke="#404040" stroke-width="2" opacity="0.8"/>
  <path d="M60 40 L65 50 L60 60 L55 50 Z" fill="#404040" opacity="0.6"/>
</svg>` },
      { min: 800, max: 849, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold_luxury" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="50%" stop-color="#FDB931"/>
      <stop offset="100%" stop-color="#9E7E1D"/>
    </linearGradient>
    <radialGradient id="gold_glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF5B7" stop-opacity="1"/>
      <stop offset="100%" stop-color="#FDB931" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M60 5 L110 30 V90 L60 115 L10 90 V30 Z" fill="none" stroke="#FDB931" stroke-width="1"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#gold_luxury)"/>
  <circle cx="60" cy="60" r="18" fill="url(#gold_glow)"/>
  <path d="M60 48 L72 60 L60 72 L48 60 Z" fill="#FFF" opacity="0.8">
    <animate attributeName="opacity" values="0.8;0.4;0.8" dur="3s" repeatCount="indefinite" />
  </path>
</svg>` },
      { min: 850, max: 899, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="platinum_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E6EBF0"/>
      <stop offset="50%" stop-color="#C0C8D0"/>
      <stop offset="100%" stop-color="#899099"/>
    </linearGradient>
    <radialGradient id="platinum_core_glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F2F7FF" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#C0C8D0" stop-opacity="0"/>
    </radialGradient>
    <filter id="platinum_soft_shadow">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#899099" flood-opacity="0.4"/>
    </filter>
  </defs>
  <path d="M60 10 L105 35 V85 L60 110 L15 85 V35 Z" fill="#6B737D" filter="url(#platinum_soft_shadow)"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#platinum_grad)"/>
  <path d="M60 25 L90 40 V80 L60 95 L30 80 V40 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" stroke-width="0.8"/>
  <path d="M60 30 L80 45 L60 60 L40 45 Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="0.6"/>
  <circle cx="60" cy="60" r="15" fill="url(#platinum_core_glow)"/>
</svg>` },
      { min: 900, max: 949, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="diamond_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8FEFFF"/>
      <stop offset="50%" stop-color="#4AD6E9"/>
      <stop offset="100%" stop-color="#006C7A"/>
    </linearGradient>
    <radialGradient id="diamond_core_glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#DCFFFF" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#4AD6E9" stop-opacity="0"/>
    </radialGradient>
    <filter id="diamond_soft_shadow">
      <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#006C7A" flood-opacity="0.5"/>
    </filter>
  </defs>
  <path d="M60 10 L105 35 V85 L60 110 L15 85 V35 Z" fill="#003D45" filter="url(#diamond_soft_shadow)"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#diamond_grad)"/>
  <path d="M60 20 L95 38 L60 55 L25 38 Z" fill="rgba(255,255,255,0.1)"/>
  <path d="M60 40 L80 50 L60 60 L40 50 Z" fill="rgba(255,255,255,0.2)"/>
  <path d="M60 60 L75 70 L60 80 L45 70 Z" fill="rgba(255,255,255,0.15)"/>
  <circle cx="60" cy="60" r="18" fill="url(#diamond_core_glow)"/>
</svg>` },
      { min: 950, max: 999, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="master_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFB3FF"/>
      <stop offset="50%" stop-color="#D45AFF"/>
      <stop offset="100%" stop-color="#7A00B3"/>
    </linearGradient>
    <radialGradient id="master_core_glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE8FF" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#D45AFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="master_soft_shadow">
      <feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#7A00B3" flood-opacity="0.6"/>
    </filter>
  </defs>
  <path d="M60 10 L105 35 V85 L60 110 L15 85 V35 Z" fill="#4B006B" filter="url(#master_soft_shadow)"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#master_grad)"/>
  <path d="M10 40 L30 50 L10 60 L35 50 Z" fill="url(#master_grad)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
  <path d="M110 40 L90 50 L110 60 L85 50 Z" fill="url(#master_grad)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
  <path d="M60 25 L85 45 L60 65 L35 45 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="0.7"/>
  <circle cx="60" cy="60" r="22" fill="url(#master_core_glow)"/>
</svg>` },
      { min: 1000, max: Infinity, svg: `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grandmaster_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFEB3B"/>
      <stop offset="25%" stop-color="#FFC107"/>
      <stop offset="50%" stop-color="#FF5722"/>
      <stop offset="75%" stop-color="#E91E63"/>
      <stop offset="100%" stop-color="#9C27B0"/>
    </linearGradient>
    <radialGradient id="grandmaster_core_glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFDE7" stop-opacity="1"/>
      <stop offset="100%" stop-color="#FFEB3B" stop-opacity="0"/>
    </radialGradient>
    <filter id="grandmaster_soft_shadow">
      <feDropShadow dx="0" dy="5" stdDeviation="10" flood-color="#FF5722" flood-opacity="0.7"/>
    </filter>
  </defs>
  <path d="M60 10 L105 35 V85 L60 110 L15 85 V35 Z" fill="#420606" filter="url(#grandmaster_soft_shadow)"/>
  <path d="M60 15 L100 35 V85 L60 105 L20 85 V35 Z" fill="url(#grandmaster_grad)"/>
  <path d="M-5 45 L15 55 L-5 65 Z" fill="url(#grandmaster_grad)" opacity="0.8"/>
  <path d="M125 45 L105 55 L125 65 Z" fill="url(#grandmaster_grad)" opacity="0.8"/>
  <path d="M60 -5 L70 15 L60 25 L50 15 Z" fill="url(#grandmaster_grad)" opacity="0.8"/>
  <path d="M60 125 L70 105 L60 95 L50 105 Z" fill="url(#grandmaster_grad)" opacity="0.8"/>

  <path d="M60 30 L80 45 L60 60 L40 45 Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
  <path d="M60 50 L70 60 L60 70 L50 60 Z" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
  
  <circle cx="60" cy="60" r="25" fill="url(#grandmaster_core_glow)"/>
</svg>` },
      

    // ... füge hier alle deine Stufen hinzu
];

export function getRankSvg(value) {
    // Findet den ersten Rang, bei dem der Wert größer/gleich min ist (von oben nach unten prüfen)
    // Oder wir nutzen die find-Logik:
    const rank = SR_LEVELS.slice().reverse().find(r => value >= r.min);
    return rank ? rank.svg : SR_LEVELS[0].svg;
}