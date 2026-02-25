const dartNumbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const htmlBoardControl = (target, roundDarts, score, lives, bolts, malus, round, maxRounds, minPoints, playerName, displayLevel) => {
    // Header sauber verstecken, falls er noch da ist
    if (!document.body.classList.contains('hide-app-header')) {
        document.body.classList.add('hide-app-header');
    }

    // Hilfsfunktion für Icons
    const generateIcons = (count, max, activeClass, iconClass) => {
        let html = '';
        for(let i = 0; i < max; i++) {
            const isActive = i < count;
            html += `<i class="${iconClass} ${isActive ? activeClass : 'icon-empty'}"></i>`;
        }
        return html;
    };

    // Dart-Punkte (Pills Style) Anzeige mit S-X, D-X, T-X
   const dartDots = [0, 1, 2].map(i => {
        const val = roundDarts[i];
        const bgColors = ['var(--target-blue-1)', 'var(--target-blue-2)', 'var(--target-blue-3)'];
        
        if (val === undefined) return '<div class="dart-dot empty" style="width: auto; padding: 0 12px;">-</div>';
        
        let text = 'M';
        if (val > 0) {
            const prefix = val === 1 ? 'S' : (val === 2 ? 'D' : 'T');
            const tNum = target === 25 ? 'BULL' : target;
            text = `${prefix}-${tNum}`;
        }
        
        // Dynamischer Hintergrund je nach Dart-Index (0, 1, oder 2)
        const bgColorStyle = val > 0 ? `background: ${bgColors[i]}; border-color: rgba(255,255,255,0.4);` : '';
        
        return `<div class="dart-dot filled ${val > 0 ? 'hit' : 'miss'}" style="width: auto; padding: 0 12px; ${bgColorStyle}">${text}</div>`;
    }).join('');

    // --- SVG Helper ---
    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) };
    };

    const describeSegment = (x, y, innerR, outerR, startAngle, endAngle) => {
        const startOuter = polarToCartesian(x, y, outerR, endAngle);
        const endOuter = polarToCartesian(x, y, outerR, startAngle);
        const startInner = polarToCartesian(x, y, innerR, endAngle);
        const endInner = polarToCartesian(x, y, innerR, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${startInner.x} ${startInner.y} Z`;
    };

    const isRoundOver = roundDarts.length >= 3;
    const pointsDisplay = minPoints > 0 ? `${score} / ${minPoints}` : `${score}`;
    
    // --- ANIMATIONS-LOGIK ---
    const isUndoAction = window.lastBCAction === 'undo';
    const isNextAction = window.lastBCAction === 'next';
    setTimeout(() => { window.lastBCAction = null; }, 100);

    return `
    <div class="x01-main-display glass-card ${isUndoAction ? 'ani-undo' : ''}">
        
        <div class="bc-top-info-bar" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 15px; margin-bottom: 5px; border: 1px solid rgba(255,255,255,0.05); position: relative;">
            
            <button class="bc-exit-mini" style="position: relative; top: 0; right: 0; margin-right: 15px;" onclick="document.body.classList.remove('hide-app-header', 'game-active'); navigate('dashboard')" title="Exit">
                <i class="ri-close-line"></i>
            </button>

            <div style="display: flex; flex-direction: column; flex-grow: 1;">
                <span id="x01-player-name" style="font-size:0.7rem; color:rgba(255,255,255,0.6); font-weight:800; text-transform:uppercase;">${playerName || 'PLAYER'}</span>
                <span id="x01-challenge-title" style="font-size:0.85rem; color:var(--neon-cyan); font-weight:700;">${displayLevel || 'BOARD CONTROL'}</span>
            </div>
            
            <div style="display: flex; gap: 15px; align-items: center;">
                <div class="sidebar-stat" style="display: flex; flex-direction: column; align-items: center;" title="Round">
                    <span style="font-size: 0.6rem; color: #94a3b8; font-weight: 700;">RND</span>
                    <span id="x01-round" class="${isNextAction ? 'ani-round-bounce' : ''}" style="font-weight: 900; font-size: 0.9rem;">${round}/${maxRounds}</span>
                </div>
                
                <div class="sidebar-stat" style="display: flex; flex-direction: column; align-items: center;" title="Points">
                    <span style="font-size: 0.6rem; color: #94a3b8; font-weight: 700;">PTS</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span id="bc-points-display" class="ani-next-score" style="font-weight: 900; font-size: 0.9rem; color: var(--target-blue-1);">${pointsDisplay}</span>
                        ${malus > 0 ? `<span style="color: var(--neon-red); font-size: 0.75rem; font-weight: 800;">(-${malus})</span>` : ''}
                    </div>
                </div>

                <div class="sidebar-stat" style="display: flex; flex-direction: column; align-items: center;" title="Lives">
                    <span style="font-size: 0.6rem; color: #94a3b8; font-weight: 700;">LIVES</span>
                    <div class="icon-row" style="display: flex; gap: 2px;">${generateIcons(lives, 3, 'icon-heart', 'ri-heart-fill')}</div>
                </div>

                <div class="sidebar-stat" style="display: flex; flex-direction: column; align-items: center;" title="Energy">
                    <span style="font-size: 0.6rem; color: #94a3b8; font-weight: 700;">ENGY</span>
                    <div class="icon-row" style="display: flex; gap: 2px;">${generateIcons(bolts, 3, 'icon-bolt', 'ri-flashlight-fill')}</div>
                </div>
            </div>
        </div>

        <div class="x01-score-section">
            <div class="bc-target-display" style="padding-top: 5px;">
                <div class="bc-label">TARGET</div>
                <div class="bc-target-value" id="main-target">${target === 25 ? 'BULL' : target}</div>
                <div class="dart-indicator-row">${dartDots}</div>
            </div>

            <div class="bc-svg-container">
                <div id="board-flash-overlay"></div>
                <svg viewBox="0 0 200 200" class="dartboard-svg">
                    <circle cx="100" cy="100" r="98" fill="#05080f" stroke="#1e293b" stroke-width="0.5"/>
                    ${dartNumbers.map((num, i) => {
                        const startAngle = i * 18 - 9;
                        const endAngle = i * 18 + 9;
                        const textPos = polarToCartesian(100, 100, 90, i * 18);
                        const colorClass = i % 2 === 0 ? 'dark' : 'light';
                        const ringClass = i % 2 === 0 ? 'red' : 'green';
                        return `
                        <g class="board-segment" id="segment-${num}">
                            <path d="${describeSegment(100, 100, 8, 80, startAngle, endAngle)}" class="segment-path base-path ${colorClass}"/>
                            <path d="${describeSegment(100, 100, 72, 80, startAngle, endAngle)}" class="segment-path double-path ${ringClass}"/>
                            <path d="${describeSegment(100, 100, 45, 53, startAngle, endAngle)}" class="segment-path triple-path ${ringClass}"/>
                            <text x="${textPos.x}" y="${textPos.y}" font-size="7" text-anchor="middle" alignment-baseline="middle" class="segment-text">${num}</text>
                        </g>`;
                    }).join('')}
                    <g class="board-segment" id="segment-25">
                        <circle cx="100" cy="100" r="8" class="segment-path bull-outer green"/> 
                        <circle cx="100" cy="100" r="4" class="segment-path bull-inner red"/>
                    </g>
                </svg>
            </div>
        </div>
    </div>

    <div class="x01-controls">
        <div class="bc-multi-row">
            <button class="bc-btn-small single" onclick="GameManager.handleBCInput(1)">S</button>
            <button class="bc-btn-small double" onclick="GameManager.handleBCInput(2)">D</button>
            <button class="bc-btn-small triple" onclick="GameManager.handleBCInput(3)">T</button>
            <button class="bc-btn-small miss" onclick="GameManager.handleBCInput(0)">M</button>
        </div>

        <div class="bc-main-actions">
            <button id="bc-undo-btn" class="bc-action-wide undo" onclick="window.lastBCAction='undo'; GameManager.undoBC()">
                <i class="ri-arrow-go-back-line"></i> UNDO
            </button>
            <button id="bc-next-btn" class="bc-action-wide next ${isRoundOver ? 'confirm-next' : ''}" onclick="window.lastBCAction='next'; GameManager.nextRoundBC()">
                NEXT <i class="ri-arrow-right-s-line"></i>
            </button>
        </div>
    </div>`;
};