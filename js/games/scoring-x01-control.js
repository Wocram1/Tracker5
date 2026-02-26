import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

export class ScoringX01Control {
    constructor(gameInstance) {
        this.game = gameInstance; 
        this.appContainer = document.getElementById('view-game-x01');
        this.modifier = 1;
        // Cache für UI Elemente
        this.ui = {};
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
                avg: document.getElementById('x01-avg-val'),
                last: document.getElementById('x01-last-val'),
                round: document.getElementById('x01-round'),
                playerName: document.getElementById('x01-player-name'),
                challengeTitle: document.getElementById('x01-challenge-title'),
                scoringStats: document.getElementById('x01-scoring-stats'),
                // Throw-Boxes als Array für schnellen Zugriff
                throws: [
                    document.getElementById('th-1'),
                    document.getElementById('th-2'),
                    document.getElementById('th-3')
                ]
            };
        }
        
        // Stats einblenden
        if (this.ui.scoringStats) this.ui.scoringStats.classList.remove('hidden');

        // Header initialisieren
        await this.updateHeaderInfo();

        this.updateUI();
    }

    /**
     * Lädt den Spielernamen aus dem LevelSystem und setzt den Challenge-Titel
     */
    async updateHeaderInfo() {
        try {
            await LevelSystem.getUserStats();
            if (this.ui.playerName) {
                this.ui.playerName.textContent = window.appState?.profile?.username || "Player 1";
            }
        } catch (e) {
            if (this.ui.playerName) this.ui.playerName.textContent = "Player 1";
        }

        if (this.ui.challengeTitle) {
            this.ui.challengeTitle.textContent = this.game.isTraining ? "Training Mode" : `Level ${this.game.level || 1}`;
        }
    }

    nextRound() {
        if (this.game.nextRound) {
            this.game.nextRound();
            this.updateUI();
        }
    }

    undo() {
        if (this.game.undo) {
            this.game.undo();
            this.updateUI();
        }
    }

    handleInput(val, mult) {
        if (this.game.isFinished || this.game.dartsThrown >= 3) return;
        const finalMult = this.modifier !== 1 ? this.modifier : mult;
        this.game.registerHit(parseInt(val), finalMult);
        this.modifier = 1; 
        this.updateUI();
    }

    setModifier(mod) {
        this.modifier = parseInt(mod);
        this.updateModifierUI();
    }

    updateUI() {
        // Direkter Zugriff auf den Cache statt document.getElementById
        if (this.ui.score) this.ui.score.textContent = this.game.currentScore;
        if (this.ui.round) this.ui.round.textContent = `R${this.game.round}`;
        
        if (this.ui.avg) {
            const avg = this.game.totalDarts > 0 
                ? ((this.game.stats.totalPoints / this.game.totalDarts) * 3).toFixed(1) 
                : "0.0";
            this.ui.avg.textContent = avg;
        }
        
        if (this.ui.last) {
            this.ui.last.textContent = this.game.lastScore || 0;
        }

        // Throw Boxes effizient aktualisieren
        const throws = this.game.currentRoundThrows || [];
        this.ui.throws.forEach((box, index) => {
            if (box) {
                const t = throws[index];
                // Nur textContent ändern - minimaler Rechenaufwand
                box.textContent = t ? (t.isBust ? "BST" : `${t.mult > 1 ? (t.mult === 3 ? 'T' : 'D') : ''}${t.base}`) : "-";
            }
        });

        this.updateModifierUI();
        
        if (this.game.isFinished && window.GameManager) {
            window.GameManager.completeGame();
        }
    }

    updateModifierUI() {
        // Hier nutzen wir weiterhin querySelectorAll, da die Buttons im Template 
        // oft als Liste vorliegen, aber das CSS sorgt für Performance (touch-action)
        document.querySelectorAll('.modifier-btn, .mod-btn').forEach(btn => {
            const m = parseInt(btn.dataset.mult);
            btn.classList.toggle('active', m === this.modifier && this.modifier !== 1);
        });
    }
}