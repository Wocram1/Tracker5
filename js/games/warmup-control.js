import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

export class WarmupController {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.modifier = 1;
        this.appContainer = document.getElementById('view-game-x01');
        this.ui = {}; // Cache für DOM-Elemente
    }

    async init() {
        document.body.classList.add('game-active');
        
        if (this.appContainer) {
            // Grundgerüst nur einmalig setzen
            this.appContainer.innerHTML = htmlX01;
            this.appContainer.classList.remove('hidden');

            // DOM-Elemente einmalig suchen und "cachen"
            this.ui = {
                score: document.getElementById('x01-score'),
                round: document.getElementById('x01-round'),
                playerName: document.getElementById('x01-player-name'),
                challengeTitle: document.getElementById('x01-challenge-title'),
                scoringStats: document.getElementById('x01-scoring-stats'),
                targetContainer: document.getElementById('x01-target-progress-container'),
                statsBar: document.getElementById('x01-stats-bar'),
                points: document.getElementById('x01-points'),
                malus: document.getElementById('x01-malus'),
                pointsContainer: document.getElementById('x01-points-container'),
                malusContainer: document.getElementById('x01-malus-container'),
                flashOverlay: document.getElementById('board-flash-overlay'),
                // Throw-Boxes als Array
                throws: [
                    document.getElementById('th-1'),
                    document.getElementById('th-2'),
                    document.getElementById('th-3')
                ],
                // Dart-Icons (3 Darts Anzeige)
                dartIcons: [
                    document.getElementById('dart-1'),
                    document.getElementById('dart-2'),
                    document.getElementById('dart-3')
                ]
            };
        }
        
        if (this.ui.scoringStats) this.ui.scoringStats.classList.add('hidden'); // Verstecke AVG/LAST
        if (this.ui.targetContainer) this.ui.targetContainer.classList.remove('hidden'); // Zeige 0/15 etc.

        // Header mit Name und Spiel-Schwierigkeit setzen
        await this.updateHeaderInfo();

        this.updateUI();
    }

    /**
     * Aktualisiert den Header: Echter Name + Aktuelles Spiel-Level
     */
    async updateHeaderInfo() {
        if (!this.ui.playerName && !this.ui.challengeTitle) return;

        let displayName = "PLAYER";
        const profile = LevelSystem.lastProfileData;
        
        if (profile && profile.username) {
            displayName = profile.username;
        } else if (window.appState?.profile?.username) {
            displayName = window.appState.profile.username;
        }

        let displayLevel = "CHALLENGE ACTIVE";
        if (this.game && this.game.level) {
            displayLevel = `LEVEL ${this.game.level}`;
        } else if (this.game && this.game.difficulty) {
            displayLevel = `LEVEL ${this.game.difficulty}`;
        }

        if (this.ui.playerName) this.ui.playerName.textContent = displayName.toUpperCase();
        if (this.ui.challengeTitle) this.ui.challengeTitle.textContent = displayLevel;
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
        if (!this.ui.flashOverlay) return;
        let flashClass = mult === 3 ? 'flash-triple' : (val === 0 ? 'flash-miss' : 'flash-active');
        this.ui.flashOverlay.classList.add(flashClass);
        setTimeout(() => this.ui.flashOverlay.classList.remove(flashClass), 400);
        
        const segment = document.getElementById(`segment-${val}`);
        if (segment) {
            segment.classList.add('hit-flash');
            setTimeout(() => segment.classList.remove('hit-flash'), 400);
        }
    }

    setModifier(m) { 
        this.modifier = this.modifier === m ? 1 : m; 
        this.updateModifierUI(); 
    }

    nextRound() { 
        if (this.game.nextRound) this.game.nextRound(); 
        this.modifier = 1; 
        this.updateUI(); 
    }

    undo() { 
        if (this.game.undo) this.game.undo(); 
        this.modifier = 1; 
        this.updateUI(); 
    }

    updateUI() {
        if (!this.game) return;

        const throws = this.game.currentRoundThrows || [];
        const targets = this.game.currentTargets || [];
        const currentTarget = targets[throws.length];

        // 1. Haupt-Target Anzeige (z.B. "20")
        if (this.ui.score) {
            this.ui.score.textContent = currentTarget ?? "-";
            this.ui.score.style.color = "#00f2ff"; 
        }

        // 2. Runde
        if (this.ui.round) this.ui.round.textContent = `Runde ${this.game.round ?? 1}`;

        // 3. Stats (Punkte, Malus, Ziel)
        this.renderDisplayStats();

        // 4. Throw Boxes
        this.ui.throws.forEach((box, index) => {
            if (!box) return;
            
            box.className = 'throw-box';
            const dartData = throws[index];
            const i = index + 1;
            
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
        });

        // 5. Dart-Icons (Verfügbare Darts Anzeige)
        this.ui.dartIcons.forEach((icon, index) => {
            if (icon) {
                const i = index + 1;
                icon.style.opacity = i <= (3 - throws.length) ? '1' : '0.2';
            }
        });

        // 6. Board Highlighting & Modifier
        this.highlightBoard();
        this.updateModifierUI();

        if (this.game.isFinished && window.GameManager?.completeGame) {
            window.GameManager.completeGame();
        }
    }

    renderDisplayStats() {
        if (this.ui.statsBar) this.ui.statsBar.style.display = 'flex';
        if (this.ui.points) this.ui.points.textContent = this.game.points;
        if (this.ui.malus) this.ui.malus.textContent = `-${this.game.malusTotal || 0}`;
        
        // Ziel-Anzeige (Dynamisches Element erhalten)
        let goalDisplay = document.getElementById('warmup-goal-display');
        if (!goalDisplay) {
            goalDisplay = document.createElement('div');
            goalDisplay.id = 'warmup-goal-display';
            goalDisplay.style.marginLeft = "15px";
            goalDisplay.innerHTML = `<span class="label">ZIEL</span> <span class="value" style="color:#f1c40f; font-weight:bold; margin-left:5px;">${this.game.minPointsRequired}</span>`;
            this.ui.malusContainer?.parentElement.appendChild(goalDisplay);
        } else {
            const valEl = goalDisplay.querySelector('.value');
            if (valEl) valEl.textContent = this.game.minPointsRequired;
        }

        if (this.ui.pointsContainer) this.ui.pointsContainer.classList.remove('hidden');
        if (this.ui.malusContainer) this.ui.malusContainer.classList.remove('hidden');
    }

    highlightBoard() {
        // Performance-Optimierung: Alle aktiven Klassen auf einmal entfernen
        document.querySelectorAll('.segment-path.target-dart-1, .segment-path.target-dart-2, .segment-path.target-dart-3, .segment-path.toggle-color-1-2, .segment-path.toggle-color-2-3, .segment-path.toggle-color-1-3, .segment-path.toggle-color-1-2-3')
            .forEach(path => {
                path.classList.remove(
                    'target-dart-1', 'target-dart-2', 'target-dart-3',
                    'toggle-color-1-2', 'toggle-color-2-3', 'toggle-color-1-3', 'toggle-color-1-2-3'
                );
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
            const btnMult = parseInt(btn.dataset.mult);
            btn.classList.toggle('active', btnMult === this.modifier && this.modifier !== 1);
        });
    }
}