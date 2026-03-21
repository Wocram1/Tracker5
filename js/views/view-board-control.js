const dartNumbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const htmlBoardControl = (target, roundDarts, score, lives, bolts, malus, round, maxRounds, minPoints, playerName, displayLevel, gameName = 'Board Control') => {
    if (!document.body.classList.contains('hide-app-header')) {
        document.body.classList.add('hide-app-header');
    }

    const generateIcons = (count, max, activeClass, iconClass) => {
        let html = '';
        for (let i = 0; i < max; i++) {
            const isActive = i < count;
            html += `<i class="${iconClass} ${isActive ? activeClass : 'icon-empty'}"></i>`;
        }
        return html;
    };

    const dartDots = [0, 1, 2].map(i => {
        const val = roundDarts[i];
        const bgColors = ['var(--target-blue-1)', 'var(--target-blue-2)', 'var(--target-blue-3)'];

        if (val === undefined) return `<div id="bc-dart-${i + 1}" class="dart-dot empty" style="width: auto; padding: 0 12px;">-</div>`;

        let text = 'M';
        if (val > 0) {
            const prefix = val === 1 ? 'S' : (val === 2 ? 'D' : 'T');
            const tNum = target === 25 ? 'BULL' : target;
            text = `${prefix}-${tNum}`;
        }

        const bgColorStyle = val > 0 ? `background: ${bgColors[i]}; border-color: rgba(255,255,255,0.4);` : '';
        return `<div id="bc-dart-${i + 1}" class="dart-dot filled ${val > 0 ? 'hit' : 'miss'}" style="width: auto; padding: 0 12px; ${bgColorStyle}">${text}</div>`;
    }).join('');

    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) };
    };

    const describeSegment = (x, y, innerR, outerR, startAngle, endAngle) => {
        const startOuter = polarToCartesian(x, y, outerR, endAngle);
        const endOuter = polarToCartesian(x, y, outerR, startAngle);
        const startInner = polarToCartesian(x, y, innerR, endAngle);
        const endInner = polarToCartesian(x, y, innerR, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${startInner.x} ${startInner.y} Z`;
    };

    const isRoundOver = roundDarts.length >= 3;
    const pointsDisplay = `${score}`;
    const minPointsDisplay = minPoints > 0 ? `${minPoints}` : '--';

    const isUndoAction = window.lastBCAction === 'undo';
    const isNextAction = window.lastBCAction === 'next';
    setTimeout(() => { window.lastBCAction = null; }, 100);

    return `
    <div class="x01-main-display glass-card unified-game-shell ${isUndoAction ? 'ani-undo' : ''}">
        <div class="game-top-meta board-top-meta">
            <div class="game-top-meta-title-row">
                <div class="game-top-meta-title">
                    <button type="button" id="x01-game-name" class="game-name-pill game-name-info-btn" onclick="GameManager.openGameInfo()">${gameName}</button>
                </div>
            </div>

            <div class="game-top-meta-lower">
                <button class="bc-exit-mini" onclick="if(confirm('Abbrechen?')) { location.href='index.html'; }">
                    <i class="ri-close-line"></i>
                </button>

                <div class="game-top-meta-center">
                    <div class="game-top-meta-inline game-top-meta-identity">
                        <span id="x01-player-name" class="game-player-kicker">${playerName || 'PLAYER'}</span>
                        <span class="game-subline-dot"></span>
                        <span id="x01-challenge-title" class="game-mode-kicker">${displayLevel || 'BOARD CONTROL'}</span>
                    </div>
                </div>

                <div class="game-top-meta-side">
                    <div class="game-meta-pill board-score-pill">
                        <span class="meta-label">SCORE</span>
                        <span id="bc-points-display">${pointsDisplay}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="game-focus-stage">
            <div class="game-primary-card board-primary-card">
                <span class="game-primary-label">Target</span>
                <div class="bc-target-value" id="main-target">${target === 25 ? 'BULL' : target}</div>
                <div class="dart-indicator-row">${dartDots}</div>
                ${malus > 0 ? `<div class="bc-malus-display">Malus -${malus}</div>` : ''}
            </div>

            <div class="game-board-stage board-stage-solo">
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

        <div class="x01-status-bar-horizontal game-status-rail board-status-rail">
            <div class="status-item board-status-pill">
                <span class="label">Round</span>
                <span id="x01-round" class="${isNextAction ? 'ani-round-bounce' : ''}">${round}/${maxRounds}</span>
            </div>
            <div class="status-item board-status-pill">
                <span class="label">Min. Points</span>
                <span id="bc-min-points-display">${minPointsDisplay}</span>
            </div>
            <div class="status-item board-status-pill">
                <span class="label">Lives</span>
                <div id="bc-heart-container" class="icon-row">${generateIcons(lives, 3, 'icon-heart', 'ri-heart-fill')}</div>
            </div>
            <div class="status-item board-status-pill">
                <span class="label">Energy</span>
                <div id="bc-bolt-container" class="icon-row">${generateIcons(bolts, 3, 'icon-bolt', 'ri-flashlight-fill')}</div>
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
