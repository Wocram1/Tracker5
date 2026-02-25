import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

export class WarmupController {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.modifier = 1;
        this.appContainer = document.getElementById('view-game-x01');
    }

    async init() {
        document.body.classList.add('game-active');
        
        if (this.appContainer) {
            this.appContainer.innerHTML = htmlX01;
            this.appContainer.classList.remove('hidden');
        }
        const scoringStats = document.getElementById('x01-scoring-stats');
        const targetContainer = document.getElementById('x01-target-progress-container');
        
        if (scoringStats) scoringStats.classList.add('hidden'); // Verstecke AVG/LAST
        if (targetContainer) targetContainer.classList.remove('hidden'); // Zeige 0/15 etc.

        // Header mit Name und Spiel-Schwierigkeit setzen
        await this.updateHeaderInfo();

        this.updateUI();
    }

    /**
     * Aktualisiert den Header: Echter Name + Aktuelles Spiel-Level
     */
    async updateHeaderInfo() {
        const nameEl = document.getElementById('x01-player-name');
        const titleEl = document.getElementById('x01-challenge-title');
        
        if (!nameEl && !titleEl) return;

        // --- 1. NAME ERMITTELN ---
        let displayName = "PLAYER";
        const profile = LevelSystem.lastProfileData;
        
        if (profile && profile.username) {
            displayName = profile.username;
        } else if (window.appState?.profile?.username) {
            displayName = window.appState.profile.username;
        }

        // --- 2. SPIEL-LEVEL ERMITTELN ---
        // Wir nehmen das Level, das die gameInstance vom GameManager erhalten hat
        let displayLevel = "CHALLENGE ACTIVE";
        
        if (this.game && this.game.level) {
            displayLevel = `LEVEL ${this.game.level}`;
        } else if (this.game && this.game.difficulty) {
            displayLevel = `LEVEL ${this.game.difficulty}`;
        }

        // Werte ins UI schreiben
        if (nameEl) nameEl.textContent = displayName.toUpperCase();
        if (titleEl) titleEl.textContent = displayLevel;
    }

    handleInput(val, mult) {
        if (this.game.currentRoundThrows.length >= 3) return;
        const safeVal = parseInt(val) || 0;
        const finalMult = this.modifier !== 1 ? this.modifier : (parseInt(mult) || 1);
        this.triggerFlash(safeVal, finalMult);
        this.game.registerHit(safeVal, finalMult);
        this.modifier = 1; 
        this.updateUI();
    }

    triggerFlash(val, mult) {
        const overlay = document.getElementById('board-flash-overlay');
        if (!overlay) return;
        let flashClass = mult === 3 ? 'flash-triple' : (val === 0 ? 'flash-miss' : 'flash-active');
        overlay.classList.add(flashClass);
        setTimeout(() => overlay.classList.remove(flashClass), 400);
        
        const segment = document.getElementById(`segment-${val}`);
        if (segment) {
            segment.classList.add('hit-flash');
            setTimeout(() => segment.classList.remove('hit-flash'), 400);
        }
    }

    setModifier(m) { this.modifier = this.modifier === m ? 1 : m; this.updateModifierUI(); }
    nextRound() { if (this.game.nextRound) this.game.nextRound(); this.modifier = 1; this.updateUI(); }
    undo() { if (this.game.undo) this.game.undo(); this.modifier = 1; this.updateUI(); }

    updateUI() {
        const scoreEl = document.getElementById('x01-score');
        const roundEl = document.getElementById('x01-round');
        const throws = this.game.currentRoundThrows || [];
        const targets = this.game.currentTargets || [];
        const currentTarget = targets[throws.length];

        if (scoreEl) {
            scoreEl.textContent = currentTarget ?? "-";
            scoreEl.style.color = "#00f2ff"; 
        }
        if (roundEl) roundEl.textContent = `Runde ${this.game.round ?? 1}`;

        this.renderDisplayStats();

        // THROW BOXES LOGIK
        for (let i = 1; i <= 3; i++) {
            const box = document.getElementById(`th-${i}`);
            if (!box) continue;
            
            box.className = 'throw-box';
            const dartData = throws[i - 1];
            
            if (dartData) {
                box.classList.add(`target-dart-${i}`, `active-dart-${i}`); 
                const prefix = dartData.mult === 3 ? 'T' : (dartData.mult === 2 ? 'D' : '');
                box.textContent = `${prefix}${dartData.displayValue}`;
                if (!dartData.isHit) box.classList.add('missed');
            } else {
                box.classList.add(`target-dart-${i}`); 
                box.textContent = ""; 
                if (i === throws.length + 1) box.classList.add('next-up');
            }
        }

        for (let i = 1; i <= 3; i++) {
            const icon = document.getElementById(`dart-${i}`);
            if (icon) icon.style.opacity = i <= (3 - throws.length) ? '1' : '0.2';
        }

        this.highlightBoard();
        this.updateModifierUI();
        if (this.game.isFinished && window.GameManager?.completeGame) window.GameManager.completeGame();
    }

    renderDisplayStats() {
        const statsBar = document.getElementById('x01-stats-bar');
        if (statsBar) statsBar.style.display = 'flex';
        const pVal = document.getElementById('x01-points');
        if (pVal) pVal.textContent = this.game.points;
        const mVal = document.getElementById('x01-malus');
        if (mVal) mVal.textContent = `-${this.game.malusTotal || 0}`;
        
        let goalDisplay = document.getElementById('warmup-goal-display');
        if (!goalDisplay) {
            goalDisplay = document.createElement('div');
            goalDisplay.id = 'warmup-goal-display';
            goalDisplay.style.marginLeft = "15px";
            goalDisplay.innerHTML = `<span class="label">ZIEL</span> <span class="value" style="color:#f1c40f; font-weight:bold; margin-left:5px;">${this.game.minPointsRequired}</span>`;
            document.getElementById('x01-malus-container')?.parentElement.appendChild(goalDisplay);
        } else {
            const valEl = goalDisplay.querySelector('.value');
            if (valEl) valEl.textContent = this.game.minPointsRequired;
        }
        document.getElementById('x01-points-container')?.classList.remove('hidden');
        document.getElementById('x01-malus-container')?.classList.remove('hidden');
    }

    highlightBoard() {
        document.querySelectorAll('.segment-path').forEach(path => {
            path.classList.remove(
                'target-dart-1', 'target-dart-2', 'target-dart-3',
                'toggle-color-1-2', 'toggle-color-2-3', 'toggle-color-1-3', 'toggle-color-1-2-3'
            );
            path.style.fill = ''; 
        });

        const targets = this.game.currentTargets || []; 
        const throwsCount = (this.game.currentRoundThrows || []).length;
        const remaining = targets.slice(throwsCount);

        const segmentAssignment = {};
        remaining.forEach((num, index) => {
            const dartPosition = throwsCount + index + 1;
            if (!segmentAssignment[num]) segmentAssignment[num] = [];
            segmentAssignment[num].push(dartPosition);
        });

        Object.keys(segmentAssignment).forEach(num => {
            const darts = segmentAssignment[num];
            const segmentGroup = document.getElementById(`segment-${num}`);
            if (!segmentGroup) return;

            const paths = segmentGroup.querySelectorAll('.segment-path');
            
            paths.forEach(path => {
                if (darts.length === 1) {
                    path.classList.add(`target-dart-${darts[0]}`);
                } else if (darts.length === 2) {
                    const s = darts.sort((a, b) => a - b);
                    path.classList.add(`toggle-color-${s[0]}-${s[1]}`);
                } else if (darts.length === 3) {
                    path.classList.add('toggle-color-1-2-3');
                }
            });
        });
    }

    updateModifierUI() {
        document.querySelectorAll('.modifier-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.mult) === this.modifier && this.modifier !== 1);
        });
    }
}