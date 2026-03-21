const dartNumbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const htmlX01 = `
    <div class="x01-main-display glass-card unified-game-shell">
        <div class="game-top-meta">
            <div class="game-top-meta-title-row">
                <div class="game-top-meta-title">
                    <button type="button" id="x01-game-name" class="game-name-pill game-name-info-btn" onclick="GameManager.openGameInfo()">X01</button>
                </div>
            </div>

            <div class="game-top-meta-lower">
                <button class="bc-exit-mini" onclick="if(confirm('Abbrechen?')) { location.href='index.html'; }">
                    <i class="ri-close-line"></i>
                </button>

                <div class="game-top-meta-center">
                    <div class="game-top-meta-inline game-top-meta-identity">
                        <span id="x01-player-name" class="game-player-kicker">PLAYER</span>
                        <span class="game-subline-dot"></span>
                        <span id="x01-challenge-title" class="game-mode-kicker">LEVEL 1</span>
                    </div>
                </div>

                <div class="game-top-meta-side game-top-meta-side-empty"></div>
            </div>
        </div>

        <div class="game-focus-stage">
            <div class="game-primary-card x01-primary-card">
                <span class="game-primary-label">Score</span>
                <div id="x01-score" class="mini-score-display">501</div>

                <div id="x01-challenge-header" class="score-sub-stats">
                    <div class="sub-stat-item stat-malus">
                        <i class="ri-error-warning-line"></i>
                        <span id="x01-malus-val"><span id="x01-malus">0</span></span>
                    </div>
                    <div class="sub-stat-item stat-points">
                        <i class="ri-medal-line"></i>
                        <span id="x01-total-points"><span id="x01-points">0</span></span>
                    </div>
                </div>

                <div id="x01-stats-bar" class="x01-inline-meta-grid">
                    <div class="status-item x01-status-pill">
                        <span class="label">Round</span>
                        <span id="x01-round">R1</span>
                    </div>

                    <div class="status-item x01-status-pill">
                        <span class="label">Out</span>
                        <span id="x01-checkout-badge" class="mode-badge-compact">S/O</span>
                    </div>

                    <div class="status-item" id="x01-avg-container" style="display: none;">
                        <span class="label">AVG</span>
                        <span id="x01-avg-val">0.0</span>
                    </div>

                    <div class="status-item" id="x01-last-container" style="display: none;">
                        <span class="label">LAST</span>
                        <span id="x01-last-val">0</span>
                    </div>

                    <div class="status-item" id="x01-target-progress-container" style="display: none;">
                        <span class="label">TRIES</span>
                        <span id="x01-target-progress">0/0</span>
                    </div>

                    <div class="status-item min-pts-badge" id="x01-min-pts-container" style="display: none;">
                        <span class="label">MIN</span>
                        <span id="x01-min-pts-val">0</span>
                    </div>

                    <div class="status-item hidden" id="x01-lives-container">
                        <span class="label">Lives</span>
                        <span id="lives-val">3</span>
                    </div>
                </div>
            </div>

            <div class="game-board-stage">
                <div class="board-visual-container">
                    <div id="board-flash-overlay"></div>
                    <svg viewBox="0 0 200 200" class="dartboard-svg">
                        <circle cx="100" cy="100" r="98" fill="rgba(0,0,0,0.3)" />
                        ${dartNumbers.map((num, i) => {
                            const angle = (i * 18) - 90;
                            const radStart = (angle - 9) * Math.PI / 180;
                            const radEnd = (angle + 9) * Math.PI / 180;
                            const isEven = i % 2 === 0;
                            const segmentClass = isEven ? 'segment-black' : 'segment-grey';
                            const ringClass = isEven ? 'segment-red' : 'segment-green';
                            const getX = (radius, angleRad) => 100 + radius * Math.cos(angleRad);
                            const getY = (radius, angleRad) => 100 + radius * Math.sin(angleRad);
                            return `
                                <g class="board-segment" id="segment-${num}" onclick="window.GameManager.handleInputX01(${num})">
                                    <path d="M ${getX(75, radStart)} ${getY(75, radStart)} A 75 75 0 0 1 ${getX(75, radEnd)} ${getY(75, radEnd)} L ${getX(8, radEnd)} ${getY(8, radEnd)} A 8 8 0 0 0 ${getX(8, radStart)} ${getY(8, radStart)} Z" class="segment-path ${segmentClass}" />
                                    <path d="M ${getX(82, radStart)} ${getY(82, radStart)} A 82 82 0 0 1 ${getX(82, radEnd)} ${getY(82, radEnd)} L ${getX(75, radEnd)} ${getY(75, radEnd)} A 75 75 0 0 0 ${getX(75, radStart)} ${getY(75, radStart)} Z" class="segment-path ${ringClass} double-path" onclick="window.GameManager.handleModifier(2); event.stopPropagation(); window.GameManager.handleInputX01(${num});" />
                                    <path d="M ${getX(52, radStart)} ${getY(52, radStart)} A 52 52 0 0 1 ${getX(52, radEnd)} ${getY(52, radEnd)} L ${getX(45, radEnd)} ${getY(45, radEnd)} A 45 45 0 0 0 ${getX(45, radStart)} ${getY(45, radStart)} Z" class="segment-path ${ringClass} triple-path" onclick="window.GameManager.handleModifier(3); event.stopPropagation(); window.GameManager.handleInputX01(${num});" />
                                    <text x="${getX(91, angle * Math.PI / 180)}" y="${getY(91, angle * Math.PI / 180) + 3}" class="segment-text" font-size="8" text-anchor="middle" style="fill: rgba(255,255,255,0.5);">${num}</text>
                                </g>`;
                        }).join('')}
                        <g id="segment-25" class="board-segment" style="cursor: pointer;">
                            <circle class="segment-path bull-outer" cx="100" cy="100" r="9" fill="#003311" stroke="#000" stroke-width="0.5" onclick="window.GameManager.handleModifier(1); event.stopPropagation(); window.GameManager.handleInputX01(25);" />
                            <circle class="segment-path bull-inner" cx="100" cy="100" r="4.5" fill="#4a0000" stroke="#000" stroke-width="0.5" onclick="window.GameManager.handleModifier(2); event.stopPropagation(); window.GameManager.handleInputX01(25);" />
                        </g>
                    </svg>
                </div>

                <div class="mini-throw-history-v">
                    <div class="throw-box" id="th-1">-</div>
                    <div class="throw-box" id="th-2">-</div>
                    <div class="throw-box" id="th-3">-</div>
                </div>
            </div>
        </div>

    </div>

    <div class="x01-controls-container">
        <div class="numpad-grid">
            ${[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(num =>
                `<button class="num-btn glass-btn" onclick="window.GameManager.handleInputX01(${num})">${num}</button>`
            ).join('')}
            <button class="num-btn glass-btn bull-btn" onclick="window.GameManager.handleInputX01(25)" style="grid-column: span 2;">BULL</button>
            <button class="num-btn glass-btn undo-btn" onclick="window.GameManager.undoX01()"><i class="ri-arrow-go-back-line"></i></button>
            <button class="num-btn glass-btn miss-btn" onclick="window.GameManager.handleInputX01(0)">M</button>
        </div>

        <div class="side-action-stack">
            <button class="mod-btn glass-btn" data-mult="3" onclick="window.GameManager.handleModifier(3)">T</button>
            <button class="mod-btn glass-btn" data-mult="2" onclick="window.GameManager.handleModifier(2)">D</button>
            <button id="x01-next-btn" class="next-btn-side" onclick="window.GameManager.nextRoundX01()">
                <i class="ri-arrow-right-line"></i>
            </button>
        </div>
    </div>
`;
