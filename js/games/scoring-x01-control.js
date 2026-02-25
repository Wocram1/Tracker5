import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

export class ScoringX01Control {
    constructor(gameInstance) {
        this.game = gameInstance; 
        this.appContainer = document.getElementById('view-game-x01');
        this.modifier = 1;
    }

    async init() {
        document.body.classList.add('game-active');
        if (this.appContainer) {
            this.appContainer.innerHTML = htmlX01;
            this.appContainer.classList.remove('hidden');
        }
        
        // Stats einblenden
        const scoringStats = document.getElementById('x01-scoring-stats');
        if (scoringStats) scoringStats.classList.remove('hidden');

        // Header mit Name und Spiel-Schwierigkeit setzen (wie in Warmup)
        await this.updateHeaderInfo();

        this.updateUI();
    }

    /**
     * Lädt den Spielernamen aus dem LevelSystem und setzt den Challenge-Titel
     */
    async updateHeaderInfo() {
        const nameEl = document.getElementById('x01-player-name');
        const titleEl = document.getElementById('x01-challenge-title');
        
        try {
            // Versuche echten Namen aus dem Profil zu laden
            await LevelSystem.getUserStats();
            if (nameEl) nameEl.textContent = window.appState?.profile?.username || "Player 1";
        } catch (e) {
            if (nameEl) nameEl.textContent = "Player 1";
        }

        if (titleEl) {
            // Zeigt "Training Mode" oder das aktuelle Level des Spiels
            titleEl.textContent = this.game.isTraining ? "Training Mode" : `Level ${this.game.level || 1}`;
        }
    }

    // Durchreiche an die Logik-Datei
    nextRound() {
        if (this.game.nextRound) {
            this.game.nextRound();
            this.updateUI();
        }
    }

    // Durchreiche an die Logik-Datei
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
        const scoreEl = document.getElementById('x01-score');
        const avgValEl = document.getElementById('x01-avg-val');
        const lastValEl = document.getElementById('x01-last-val');
        const roundEl = document.getElementById('x01-round');

        if (scoreEl) scoreEl.textContent = this.game.currentScore;
        if (roundEl) roundEl.textContent = `R${this.game.round}`;
        
        if (avgValEl) {
            const avg = this.game.totalDarts > 0 
                ? ((this.game.stats.totalPoints / this.game.totalDarts) * 3).toFixed(1) 
                : "0.0";
            avgValEl.textContent = avg;
        }
        if (lastValEl) lastValEl.textContent = this.game.lastScore || 0;

        // Throw Boxes Logik aktualisieren
        const throws = this.game.currentRoundThrows || [];
        for (let i = 1; i <= 3; i++) {
            const box = document.getElementById(`th-${i}`);
            if (box) {
                const t = throws[i - 1];
                box.textContent = t ? (t.isBust ? "BST" : `${t.mult > 1 ? (t.mult === 3 ? 'T' : 'D') : ''}${t.base}`) : "-";
            }
        }

        this.updateModifierUI();
        
        // SPIELENDE: Triggert das Resultat-Modal im GameManager
        if (this.game.isFinished && window.GameManager) {
            window.GameManager.completeGame();
        }
    }

    updateModifierUI() {
        document.querySelectorAll('.modifier-btn, .mod-btn').forEach(btn => {
            const m = parseInt(btn.dataset.mult);
            btn.classList.toggle('active', m === this.modifier && this.modifier !== 1);
        });
    }
}