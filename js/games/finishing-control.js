import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

/**
 * FinishingController
 * Steuert 121, Checkout Challenge etc. im X01-Layout
 * Optimiert für Performance durch DOM-Caching
 */
export class FinishingController {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.modifier = 1;
        this.appContainer = document.getElementById('view-game-x01');
        this.ui = {}; // Cache für DOM-Elemente
    }

    async init() {
        // Layout-Vorbereitung
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
                progress: document.getElementById('x01-target-progress'),
                totalPoints: document.getElementById('x01-total-points'),
                malus: document.getElementById('x01-malus-val'),
                minPts: document.getElementById('x01-min-pts-val'),
                modeBadge: document.getElementById('x01-checkout-badge'),
                hint: document.getElementById('x01-checkout-hint'),
                livesContainer: document.getElementById('x01-lives-container'),
                playerName: document.getElementById('x01-player-name'),
                challengeTitle: document.getElementById('x01-challenge-title'),
                // Throw-Boxes als Array für schnellen Zugriff
                throws: [
                    document.getElementById('th-1'),
                    document.getElementById('th-2'),
                    document.getElementById('th-3')
                ]
            };
        }

        // Header initialisieren
        await this.updateHeaderInfo();

        // UI initial befüllen
        this.updateUI();
    }

    async updateHeaderInfo() {
        try {
            await LevelSystem.getUserStats();
            if (this.ui.playerName) {
                this.ui.playerName.textContent = window.appState?.profile?.username?.toUpperCase() || "PLAYER 1";
            }
        } catch (e) {
            if (this.ui.playerName) this.ui.playerName.textContent = "PLAYER 1";
        }

        if (this.ui.challengeTitle) {
            this.ui.challengeTitle.textContent = this.game.isTraining ? "TRAINING MODE" : `LEVEL ${this.game.level || 1}`;
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
        if (!this.game) return;

        // 1. Haupt-Score (Restscore für das aktuelle Target)
        if (this.ui.score) this.ui.score.textContent = this.game.currentScore; 

        // 2. Runden-Zähler (R 1/3)
        if (this.ui.round) {
            const currentRound = (this.game.roundsUsedForTarget || 0) + 1;
            const maxRounds = this.game.maxRoundsPerTarget || 3;
            this.ui.round.textContent = `R ${currentRound}/${maxRounds}`;
        }

        // 3. Target-Fortschritt (z.B. 2/5)
        if (this.ui.progress) {
            this.ui.progress.textContent = `${this.game.targetsPlayed}/${this.game.totalTargetsToPlay}`;
        }

        // 4. Punkte & Malus
        if (this.ui.totalPoints) this.ui.totalPoints.textContent = this.game.points || 0;
        if (this.ui.malus) this.ui.malus.textContent = this.game.malusAmount || 0;

        // 5. Mindestpunkte Anzeige
        if (this.ui.minPts) this.ui.minPts.textContent = this.game.minPointsRequired || 0;

        // 6. Checkout-Modus Badge (S/O oder D/O)
        if (this.ui.modeBadge) {
            const activeMode = this.game.getCurrentCheckMode(); 
            this.ui.modeBadge.textContent = activeMode === 'double' ? 'D/O' : 'S/O';
            this.ui.modeBadge.className = `mode-badge-compact ${activeMode === 'double' ? 'mode-double' : 'mode-single'}`;
        }

        // 7. Wurf-Historie (Throw Boxes)
        this.renderThrowBoxes();

        // 8. Stats Bar Updates (Lives etc.)
        this.updateStatsBar();

        // 9. Checkout-Hilfe (Weg-Vorschlag)
        if (this.ui.hint) this.ui.hint.textContent = this.game.checkoutPath || "";

        // 10. Modifier UI Update
        this.updateModifierUI();

        // Spielende prüfen
        if (this.game.isFinished && window.GameManager?.completeGame) {
            window.GameManager.completeGame();
        }
    }

    renderThrowBoxes() {
        const throws = this.game.currentRoundThrows || [];
        this.ui.throws.forEach((box, index) => {
            if (!box) return;
            
            const i = index + 1; // 1-based index für IDs/Logik
            box.className = 'throw-box'; 
            const t = throws[index];
            
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
                const currentRealDarts = throws.filter(d => !d.isDummy).length;
                if (i === currentRealDarts + 1) box.classList.add('next-up');
            }
        });
    }

    updateStatsBar() {
        if (this.ui.livesContainer && this.game.lives !== undefined) {
            this.ui.livesContainer.classList.remove('hidden');
            
            // Optimiert: Nur Icons updaten, wenn nötig
            const icons = this.ui.livesContainer.querySelectorAll('i');
            if (icons.length === 0) {
                this.ui.livesContainer.innerHTML = this.generateIcons(this.game.lives, 'icon-heart', 'ri-heart-fill');
            } else {
                icons.forEach((icon, i) => {
                    const isActive = i < this.game.lives;
                    icon.className = `ri-heart-fill ${isActive ? 'icon-heart' : 'icon-empty'}`;
                });
            }
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
        document.querySelectorAll('.modifier-btn, .mod-btn').forEach(btn => {
            const btnMult = parseInt(btn.dataset.mult);
            btn.classList.toggle('active', btnMult === this.modifier && this.modifier !== 1);
        });
    }
}