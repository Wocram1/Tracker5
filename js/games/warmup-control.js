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
        document.body.classList.add('hide-app-header'); 
        
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
                challengeHeader: document.getElementById('x01-challenge-header'),
                
                // Neue Status-Elemente in der unteren Bar
                targetContainer: document.getElementById('x01-target-progress-container'),
                targetProgress: document.getElementById('x01-target-progress'),
                minPtsContainer: document.getElementById('x01-min-pts-container'),
                minPtsVal: document.getElementById('x01-min-pts-val'),
                
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
        
        // UI-Anpassung für Warmup: Scoring aus, Challenge ein
        if (this.ui.scoringStats) this.ui.scoringStats.classList.add('hidden'); 
        if (this.ui.challengeHeader) {
            this.ui.challengeHeader.style.display = 'flex';
            this.ui.challengeHeader.classList.remove('hidden');
        }

        // Neue Pill-Container einblenden
        if (this.ui.targetContainer) this.ui.targetContainer.style.display = 'flex';
        if (this.ui.minPtsContainer && this.game.minPointsRequired) {
            this.ui.minPtsContainer.style.display = 'flex';
        }

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
        
        // Malus Anzeige (im Challenge Header)
        const malusVal = document.getElementById('x01-malus-val');
        if (malusVal) malusVal.textContent = this.game.malusTotal || 0;
        
        // Punkte Anzeige (im Challenge Header)
        const totalPointsVal = document.getElementById('x01-total-points');
        if (totalPointsVal) totalPointsVal.textContent = this.game.points;

        // Ziel-Counter Fortschritt (z.B. Runde 1/10 oder Zahl 3/20)
        if (this.ui.targetProgress) {
            const current = this.game.round || 1;
            const total = this.game.maxRounds || 10;
            this.ui.targetProgress.textContent = `${current}/${total}`;
        }

        // Mindestpunkte Anzeige
        if (this.ui.minPtsVal) {
            this.ui.minPtsVal.textContent = this.game.minPointsRequired || 0;
        }

        // Legacy Support für alte Container
        if (this.ui.malus) this.ui.malus.textContent = `-${this.game.malusTotal || 0}`;
        if (this.ui.pointsContainer) this.ui.pointsContainer.classList.remove('hidden');
        if (this.ui.malusContainer) this.ui.malusContainer.classList.remove('hidden');
    }

    highlightBoard() {
        // Zuerst alle Highlights entfernen
        document.querySelectorAll('.segment-path').forEach(path => {
            path.classList.remove(
                'target-dart-1', 'target-dart-2', 'target-dart-3',
                'toggle-color-1-2', 'toggle-color-2-3', 'toggle-color-1-3', 'toggle-color-1-2-3'
            );
        });

        const targets = this.game.currentTargets || [];
        const targetRings = this.game.currentTargetRings || []; // Erwartet z.B. ['S', 'D', 'T']
        const throwsCount = (this.game.currentRoundThrows || []).length;

        // Wir berechnen die Zuweisung für die verbleibenden Darts der Runde
        const remainingIndices = [0, 1, 2].filter(i => i >= throwsCount);

        remainingIndices.forEach(index => {
            const num = targets[index];
            const ring = targetRings[index]; // 'S', 'D', 'T' oder undefined
            const dartPosition = index + 1; // 1, 2 oder 3

            if (num === undefined) return;

            const segmentGroup = this.appContainer.querySelector(`#segment-${num}`);
            if (!segmentGroup) return;

            const paths = segmentGroup.querySelectorAll('.segment-path');
            paths.forEach(path => {
                // Erkennung der Ringe basierend auf den Klassen in view-x01.js
                const isDouble = path.classList.contains('double-path');
                const isTriple = path.classList.contains('triple-path');
                const isSingle = !isDouble && !isTriple;

                // Prüfen, ob dieser Pfad zum gewünschten Ring gehört
                const isCorrectRing = !ring || 
                    (ring === 'S' && isSingle) ||
                    (ring === 'D' && isDouble) ||
                    (ring === 'T' && isTriple);

                if (isCorrectRing) {
                    // Da wir hier pro Dart einzeln durchgehen, prüfen wir auf existierende Klassen für Toggle-Effekte
                    if (path.classList.contains('target-dart-1') && dartPosition === 2) {
                        path.classList.remove('target-dart-1');
                        path.classList.add('toggle-color-1-2');
                    } else if (path.classList.contains('target-dart-1') && dartPosition === 3) {
                        path.classList.remove('target-dart-1');
                        path.classList.add('toggle-color-1-3');
                    } else if (path.classList.contains('target-dart-2') && dartPosition === 3) {
                        path.classList.remove('target-dart-2');
                        path.classList.add('toggle-color-2-3');
                    } else if (path.classList.contains('toggle-color-1-2') && dartPosition === 3) {
                        path.classList.remove('toggle-color-1-2');
                        path.classList.add('toggle-color-1-2-3');
                    } else {
                        path.classList.add(`target-dart-${dartPosition}`);
                    }
                }
            });
        });
    }

    updateModifierUI() {
        document.querySelectorAll('.mod-btn').forEach(btn => {
            const btnMult = parseInt(btn.dataset.mult);
            btn.classList.toggle('active', btnMult === this.modifier && this.modifier !== 1);
        });
    }
}