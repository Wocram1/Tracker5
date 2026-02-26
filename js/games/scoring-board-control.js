import { htmlBoardControl } from '../views/view-board-control.js';
import { LevelSystem } from '../supabase_client.js';

export class ScoringBoardControl {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.appContainer = document.getElementById('view-game-active');
        this.frozenTargetDisplay = null;
        this.playerName = "PLAYER";
        this.displayLevel = "CHALLENGE ACTIVE";
        
        // Cache für DOM-Elemente
        this.elements = {};
    }

    async init() {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        this.appContainer.classList.remove('hidden');
        this.frozenTargetDisplay = null;

        const appHeader = document.querySelector('.app-top-bar');
        if (appHeader) appHeader.classList.add('hidden');

        document.body.classList.add('game-active');

        const profile = LevelSystem.lastProfileData;
        if (profile && profile.username) {
            this.playerName = profile.username.toUpperCase();
        } else if (window.appState?.profile?.username) {
            this.playerName = window.appState.profile.username.toUpperCase();
        }

        if (this.game.isTraining) {
            this.displayLevel = `${this.game.name} (TRAINING)`;
        } else if (this.game.level || this.game.difficulty) {
            this.displayLevel = `LEVEL ${this.game.level || this.game.difficulty}`;
        } else {
            this.displayLevel = this.game.name || "CHALLENGE ACTIVE";
        }

        // Initiales Rendern des Grundgerüsts
        this.renderInitialLayout();
        this.updateView();
    }

    renderInitialLayout() {
        // Rendert das HTML einmalig, um die Struktur zu schaffen
        this.appContainer.innerHTML = htmlBoardControl(
            "", [], 0, 0, 0, 0, 1, 10, 0, 
            this.playerName, this.displayLevel
        );

        // Cache alle wichtigen Update-Elemente basierend auf den IDs in view-board-control.js
        const ids = [
            'main-target', 'bc-points-display', 'x01-round', 
            'bc-heart-container', 'bc-bolt-container',
            'bc-dart-1', 'bc-dart-2', 'bc-dart-3'
        ];
        
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    updateView() {
        // 1. TARGET LOGIK
        const currentTarget = this.game.targets ? this.game.targets[this.game.currentIndex] : (this.game.targetDisplay || "FIN");
        
        const target = (this.game.roundDarts.length === 3 && this.frozenTargetDisplay !== null)
            ? this.frozenTargetDisplay
            : currentTarget;

        // 2. DATEN AUS GAME-INSTANZ
        const roundDarts = this.game.roundDarts || []; 
        const score = this.game.points || 0;
        const malus = this.game.malusScore || 0;
        const lives = this.game.lives !== undefined ? this.game.lives : 0;
        const bolts = this.game.bolts !== undefined ? this.game.bolts : 0;
        const round = this.game.round || 1;
        const maxRounds = this.game.maxRounds || 10;

        // 3. DOM UPDATES
        if (this.elements['main-target']) {
            this.elements['main-target'].textContent = target === 25 ? 'BULL' : target;
        }

        if (this.elements['bc-points-display']) {
            const pointsDisplay = this.game.minPoints > 0 ? `${score} / ${this.game.minPoints}` : `${score}`;
            this.elements['bc-points-display'].innerHTML = `
                <span class="ani-next-score" style="font-weight: 900; font-size: 0.9rem; color: var(--target-blue-1);">${pointsDisplay}</span>
                ${malus > 0 ? `<span style="color: var(--neon-red); font-size: 0.75rem; font-weight: 800;">(-${malus})</span>` : ''}
            `;
        }

        if (this.elements['x01-round']) {
            this.elements['x01-round'].textContent = `${round}/${maxRounds}`;
        }

        // 4. DART PILLS (S-X / D-X / T-X Anzeige)
        for (let i = 0; i < 3; i++) {
            const el = this.elements[`bc-dart-${i+1}`];
            if (el) {
                const val = roundDarts[i]; // ATC liefert hier oft den Multiplikator als Zahl (0, 1, 2, 3)
                if (val !== undefined) {
                    let text = 'M';
                    if (val > 0) {
                        const prefix = val === 1 ? 'S' : (val === 2 ? 'D' : 'T');
                        const tNum = target === 25 ? 'BULL' : target;
                        text = `${prefix}-${tNum}`;
                    }
                    el.textContent = text;
                    el.className = `dart-dot filled ${val > 0 ? 'hit' : 'miss'}`;
                    // Hintergrundfarbe analog zur View setzen
                    const bgColors = ['var(--target-blue-1)', 'var(--target-blue-2)', 'var(--target-blue-3)'];
                    if (val > 0) el.style.background = bgColors[i];
                } else {
                    el.textContent = '-';
                    el.className = 'dart-dot empty';
                    el.style.background = '';
                }
            }
        }

        // 5. ICONS (HERZEN & BLITZE)
        if (this.elements['bc-heart-container']) {
            this.elements['bc-heart-container'].innerHTML = this.generateIconHtml(lives, 'ri-heart-fill', 'icon-heart');
        }
        if (this.elements['bc-bolt-container']) {
            this.elements['bc-bolt-container'].innerHTML = this.generateIconHtml(bolts, 'ri-flashlight-fill', 'icon-bolt');
        }

        // Highlights & Effekte
        requestAnimationFrame(() => {
            this.highlightBoard();
            this.highlightNextButton(roundDarts.length >= 3);
        });

        if (this.game.isFinished && window.GameManager?.completeGame) {
            setTimeout(() => {
                window.GameManager.completeGame();
            }, 600);
        }
    }

    generateIconHtml(count, iconClass, activeClass) {
        let html = '';
        for (let i = 0; i < 3; i++) {
            const isActive = i < count;
            html += `<i class="${iconClass} ${isActive ? activeClass : 'icon-empty'}"></i>`;
        }
        return html;
    }

    highlightBoard() {
        document.querySelectorAll('.segment-path').forEach(path => {
            path.classList.remove(
                'target-dart-1', 'target-dart-2', 'target-dart-3',
                'toggle-color-1-2', 'toggle-color-2-3', 'toggle-color-1-3', 'toggle-color-1-2-3'
            );
        });

        const throwsCount = (this.game.roundDarts || []).length;
        if (throwsCount >= 3 || this.frozenTargetDisplay !== null) return;

        const targets = this.game.currentTargets || [];
        if (targets.length === 0) return;

        const segmentMap = {};
        for (let i = throwsCount; i < 3; i++) {
            const num = targets[i];
            if (num === undefined) continue;
            if (!segmentMap[num]) segmentMap[num] = [];
            segmentMap[num].push(i + 1); 
        }

        for (const [num, dartIndices] of Object.entries(segmentMap)) {
            const segmentGroup = document.getElementById(`segment-${num}`);
            if (!segmentGroup) continue;

            const paths = segmentGroup.querySelectorAll('.segment-path');
            paths.forEach(path => {
                const sorted = dartIndices.sort((a, b) => a - b);
                if (sorted.length === 3) path.classList.add('toggle-color-1-2-3');
                else if (sorted.length === 2) path.classList.add(`toggle-color-${sorted[0]}-${sorted[1]}`);
                else if (sorted.length === 1) path.classList.add(`target-dart-${sorted[0]}`);
            });
        }
    }

    handleInput(multiplier) {
        if (this.game.roundDarts.length < 3 && !this.game.isFinished) {
            const displayBefore = this.game.targetDisplay || this.game.currentTargetNumber;
            const roundBefore = this.game.round;

            this.game.registerThrow(multiplier);

            if (this.game.roundDarts.length === 3) {
                this.frozenTargetDisplay = this.game.targetDisplay || displayBefore;
            }

            if (this.game.round > roundBefore && this.game.bolts === 0) {
                this.game.bolts = this.game.config?.startBlitz || 0;
                this.triggerBurnoutEffect();
            }

            this.triggerHitEffect(multiplier);
            this.updateView();
        }
    }

    nextRound() {
        if (!this.game) return;
        const btn = document.getElementById('bc-next-btn');
        if (btn) btn.classList.add('ani-next-score');

        this.game.nextRound();
        this.frozenTargetDisplay = null;

        if (this.game.bolts === 0 && this.game.config?.startBlitz > 0) {
            this.game.bolts = this.game.config.startBlitz;
            this.triggerBurnoutEffect();
        }

        this.updateView();
        
        setTimeout(() => {
            const scoreDisplay = document.getElementById('bc-points-display');
            if(scoreDisplay) scoreDisplay.classList.remove('ani-next-score');
        }, 500);
    }

    undo() {
        const btn = document.getElementById('bc-undo-btn');
        if (btn) btn.classList.add('ani-undo');

        this.frozenTargetDisplay = null;
        if (this.game.undo) this.game.undo();
        else if (this.game.roundDarts.length > 0) this.game.roundDarts.pop();
        
        this.updateView();

        setTimeout(() => {
            if(btn) btn.classList.remove('ani-undo');
        }, 400);
    }

    highlightNextButton(active) {
        const btn = document.getElementById('bc-next-btn');
        if (btn) btn.classList.toggle('confirm-next', active);
    }

    triggerBurnoutEffect() {
        this.appContainer.classList.add('burnout-active');
        setTimeout(() => this.appContainer.classList.remove('burnout-active'), 500);
    }

    triggerHitEffect(multiplier) {
        const overlay = document.getElementById('board-flash-overlay');
        if (!overlay) return;
        overlay.classList.remove('flash-active', 'flash-miss');
        void overlay.offsetWidth; 
        overlay.classList.add(multiplier > 0 ? 'flash-active' : 'flash-miss');
    }
}