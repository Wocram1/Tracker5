import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

/**
 * FinishingController
 * Steuert 121, Checkout Challenge etc. im X01-Layout
 */
export class FinishingController {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.modifier = 1;
        this.appContainer = document.getElementById('view-game-x01');
    }

    async init() {
        // Layout-Vorbereitung
        document.body.classList.add('game-active');
        document.body.classList.add('hide-app-header'); 
        
        if (this.appContainer) {
            this.appContainer.innerHTML = htmlX01;
            this.appContainer.classList.remove('hidden');
        }

        // Header initialisieren
        await this.updateHeaderInfo();

        // UI initial befüllen
        this.updateUI();
    }

    async updateHeaderInfo() {
        const nameEl = document.getElementById('x01-player-name');
        const titleEl = document.getElementById('x01-challenge-title');
        
        try {
            await LevelSystem.getUserStats();
            if (nameEl) nameEl.textContent = window.appState?.profile?.username || "Player 1";
        } catch (e) {
            if (nameEl) nameEl.textContent = "Player 1";
        }

        if (titleEl) {
            titleEl.textContent = this.game.isTraining ? "Training Mode" : `Level ${this.game.level || 1}`;
        }
    }

    handleInput(val, mult) {
        const throws = this.game.currentRoundThrows || [];
        // Nur registrieren, wenn noch keine 3 Darts geworfen wurden (außer Dummy-Darts nach Check)
        if (throws.filter(t => !t.isDummy).length >= 3) return; 

        const finalMult = this.modifier !== 1 ? this.modifier : mult;
        
        this.game.registerHit(parseInt(val), finalMult);

        this.modifier = 1; // Reset Modifier nach Wurf
        this.updateUI();
    }

    setModifier(m) {
        this.modifier = (this.modifier === m) ? 1 : m;
        this.updateModifierUI();
    }

    nextRound() {
        if (this.game.nextRound) {
            this.game.nextRound();
        }
        this.modifier = 1;
        this.updateUI();
    }

    undo() {
        if (this.game.undo) {
            this.game.undo();
        }
        this.modifier = 1;
        this.updateUI();
    }

    updateUI() {
        // 1. Haupt-Score (Restscore für das aktuelle Target)
        const scoreEl = document.getElementById('x01-score');
        if (scoreEl) scoreEl.textContent = this.game.currentScore; 

        // 2. Runden-Zähler (R 1/3)
        const roundEl = document.getElementById('x01-round');
        if (roundEl) {
            const currentRound = (this.game.roundsUsedForTarget || 0) + 1;
            const maxRounds = this.game.maxRoundsPerTarget || 3;
            roundEl.textContent = `R ${currentRound}/${maxRounds}`;
        }

        // 3. Target-Fortschritt (z.B. 2/5)
        const progressEl = document.getElementById('x01-target-progress');
        if (progressEl) {
            progressEl.textContent = `${this.game.targetsPlayed}/${this.game.totalTargetsToPlay}`;
        }

        // 4. Punkte & Malus (Nutzt IDs aus dem neuen Template)
        const totalPointsEl = document.getElementById('x01-total-points');
        if (totalPointsEl) totalPointsEl.textContent = this.game.points || 0;

        const malusEl = document.getElementById('x01-malus-val');
        if (malusEl) {
            // Zeigt entweder den aktuellen Malus-Score oder den Strafbetrag pro Fail
            malusEl.textContent = this.game.malusAmount || 0;
        }

        // 5. Mindestpunkte Anzeige (unten in der Status-Bar)
        const minPtsVal = document.getElementById('x01-min-pts-val');
        if (minPtsVal) {
            minPtsVal.textContent = this.game.minPointsRequired || 0;
        }

        // 6. Checkout-Modus Badge (S/O oder D/O)
        const modeBadge = document.getElementById('x01-checkout-badge');
        if (modeBadge) {
            const activeMode = this.game.getCurrentCheckMode(); 
            modeBadge.textContent = activeMode === 'double' ? 'D/O' : 'S/O';
            modeBadge.className = `mode-badge-compact ${activeMode === 'double' ? 'mode-double' : 'mode-single'}`;
        }

        // 7. Wurf-Historie (Throw Boxes)
        this.renderThrowBoxes();

        // 8. Stats Bar Updates (Lives etc.)
        this.updateStatsBar();

        // 9. Checkout-Hilfe (Weg-Vorschlag)
        const hintEl = document.getElementById('x01-checkout-hint');
        if (hintEl) hintEl.textContent = this.game.checkoutPath || "";

        // 10. Modifier UI Update
        this.updateModifierUI();

        // Spielende prüfen
        if (this.game.isFinished && window.GameManager?.completeGame) {
            window.GameManager.completeGame();
        }
    }

    renderThrowBoxes() {
        const throws = this.game.currentRoundThrows || [];
        for (let i = 1; i <= 3; i++) {
            const box = document.getElementById(`th-${i}`);
            if (!box) continue;
            
            box.className = 'throw-box'; 
            const t = throws[i-1];
            
            if (t) {
                if (t.isDummy) {
                    box.textContent = "-";
                } else {
                    const prefix = t.mult === 3 ? 'T' : (t.mult === 2 ? 'D' : '');
                    box.textContent = t.isBust ? "BUST" : `${prefix}${t.base}`;
                    if (t.isBust) box.classList.add('missed');
                    box.classList.add(`active-dart-${i}`);
                }
            } else {
                box.textContent = "-";
                // Markiere das nächste Feld, das befüllt wird
                const currentRealDarts = throws.filter(d => !d.isDummy).length;
                if (i === currentRealDarts + 1) box.classList.add('next-up');
            }
        }
    }

    updateStatsBar() {
        const livesContainer = document.getElementById('x01-lives-container');
        if (livesContainer && this.game.lives !== undefined) {
            livesContainer.classList.remove('hidden');
            livesContainer.innerHTML = this.generateIcons(this.game.lives, 'icon-heart', 'ri-heart-fill');
        }
    }

    generateIcons(count, activeClass, iconClass) {
        const max = this.game.maxLives || 3; 
        let html = '';
        for(let i=0; i<max; i++) {
            const isActive = i < count;
            html += `<i class="${iconClass} ${isActive ? activeClass : 'icon-empty'}"></i>`;
        }
        return html;
    }

    updateModifierUI() {
        // Unterstützt sowohl .modifier-btn als auch .mod-btn aus dem neuen SVG Template
        document.querySelectorAll('.modifier-btn, .mod-btn').forEach(btn => {
            const btnMult = parseInt(btn.dataset.mult);
            if (btnMult === this.modifier && this.modifier !== 1) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}