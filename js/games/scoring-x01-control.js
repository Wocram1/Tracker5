import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

export class ScoringX01Control {
    constructor(gameInstance) {
        this.game = gameInstance; 
        this.appContainer = document.getElementById('view-game-x01');
        this.modifier = 1;
        this.ui = {};
    }

    async init() {
        document.body.classList.add('game-active');
        if (this.appContainer) {
            this.appContainer.innerHTML = htmlX01;
            this.appContainer.classList.remove('hidden');
            
            // UI Referenzen cachen
            this.ui = {
                score: document.getElementById('x01-score'),
                playerName: document.getElementById('x01-player-name'),
                challengeTitle: document.getElementById('x01-challenge-title'),
                round: document.getElementById('x01-round'),
                
                // Scoring Elemente (X01)
                avgContainer: document.getElementById('x01-avg-container'),
                avgVal: document.getElementById('x01-avg-val'),
                lastContainer: document.getElementById('x01-last-container'),
                lastVal: document.getElementById('x01-last-val'),
                
                // Challenge Elemente (Warmup / Finishing)
                challengeHeader: document.getElementById('x01-challenge-header'),
                malusVal: document.getElementById('x01-malus-val'),
                pointsVal: document.getElementById('x01-total-points'),
                progressContainer: document.getElementById('x01-progress-container'),
                progressVal: document.getElementById('x01-target-progress'),
                minPtsContainer: document.getElementById('x01-min-pts-container'),
                minPtsVal: document.getElementById('x01-min-pts-val'),
                livesContainer: document.getElementById('x01-lives-container'),
                
                throws: [
                    document.getElementById('th-1'), document.getElementById('th-2'), document.getElementById('th-3')
                ]
            };

            this.configureLayout();
        }
        await this.updateHeaderInfo();
        this.updateUI();
    }

    /**
     * Entscheidet basierend auf dem Spielnamen, welches Layout gezeigt wird.
     * Nur "X01" bekommt das Clean Layout. Alle anderen (Warmup, Finishing, etc.)
     * bekommen das Challenge Layout.
     */
    configureLayout() {
        // Prüft strikt, ob es das Standard X01 Spiel ist
        const isStandardX01 = this.game.name === 'X01';

        if (isStandardX01) {
            // SCORING LAYOUT: Zeige AVG & LAST, verstecke den Rest
            if(this.ui.avgContainer) this.ui.avgContainer.style.display = 'flex';
            if(this.ui.lastContainer) this.ui.lastContainer.style.display = 'flex';
            
            if(this.ui.challengeHeader) this.ui.challengeHeader.style.display = 'none';
            if(this.ui.progressContainer) this.ui.progressContainer.style.display = 'none';
            if(this.ui.minPtsContainer) this.ui.minPtsContainer.style.display = 'none';
            if(this.ui.livesContainer) this.ui.livesContainer.classList.add('hidden');
        } else {
            // CHALLENGE LAYOUT: Verstecke AVG & LAST, zeige den Rest
            if(this.ui.avgContainer) this.ui.avgContainer.style.display = 'none';
            if(this.ui.lastContainer) this.ui.lastContainer.style.display = 'none';
            
            if(this.ui.challengeHeader) this.ui.challengeHeader.style.display = 'flex';
            if(this.ui.progressContainer) this.ui.progressContainer.style.display = 'flex';
            if(this.ui.minPtsContainer) this.ui.minPtsContainer.style.display = 'flex';
            
            // Leben Container nur zeigen, wenn das Spiel Leben hat
            if (this.game.lives !== undefined && this.ui.livesContainer) {
                this.ui.livesContainer.classList.remove('hidden');
            }
        }
    }

    updateUI() {
        if (!this.ui.score) return;
        this.ui.score.textContent = this.game.currentScore;

        const isStandardX01 = this.game.name === 'X01';

        if (isStandardX01) {
            // --- UPDATE FÜR X01 ---
            this.ui.round.textContent = `R${this.game.round}`;
            const avg = this.game.totalDarts > 0 ? ((this.game.stats.totalPoints / this.game.totalDarts) * 3).toFixed(1) : "0.0";
            if(this.ui.avgVal) this.ui.avgVal.textContent = avg;
            if(this.ui.lastVal) this.ui.lastVal.textContent = this.game.lastScore || 0;
        } else {
            // --- UPDATE FÜR WARMUP / FINISHING ---
            this.ui.round.textContent = this.game.currentRoundDisplay || `R${this.game.round}`;
            
            if(this.ui.malusVal) this.ui.malusVal.textContent = this.game.malus || 0;
            if(this.ui.pointsVal) this.ui.pointsVal.textContent = this.game.totalPoints || 0;
            if(this.ui.minPtsVal) this.ui.minPtsVal.textContent = this.game.minPointsRequired || 0;
            
            // Progress (z.B. 1/3 Versuche)
            if(this.ui.progressVal) {
                const currentTry = (this.game.roundsUsedForCurrentTarget || this.game.roundsUsedForTarget || 0) + 1;
                const maxTries = this.game.maxRoundsPerTarget || 3;
                this.ui.progressVal.textContent = `${currentTry}/${maxTries}`;
            }
            
            if (document.getElementById('lives-val')) {
                document.getElementById('lives-val').textContent = this.game.lives || 0;
            }
        }

        // Throws & Modifier (Immer gleich)
        const throws = this.game.currentRoundThrows || [];
        this.ui.throws.forEach((box, index) => {
            if (box) {
                const t = throws[index];
                box.textContent = t ? (t.isBust ? "BST" : `${t.mult > 1 ? (t.mult === 3 ? 'T' : 'D') : ''}${t.base}`) : "-";
            }
        });
        this.updateModifierUI();
        if (this.game.isFinished && window.GameManager) window.GameManager.completeGame();
    }

    // Standard Methoden bleiben unverändert
    handleInput(val, mult) {
        if (this.game.isFinished || this.game.dartsThrown >= 3) return;
        const finalMult = this.modifier !== 1 ? this.modifier : mult;
        this.game.registerHit(parseInt(val), finalMult);
        this.modifier = 1; 
        this.updateUI();
    }
    setModifier(m) { this.modifier = (this.modifier === m) ? 1 : m; this.updateModifierUI(); }
    nextRound() { if (this.game.nextRound) { this.game.nextRound(); this.updateUI(); } }
    undo() { 
        const btn = document.querySelector('.undo-btn'); 
        if (btn) { btn.classList.add('ani-undo'); setTimeout(() => btn.classList.remove('ani-undo'), 400); }
        if (this.game && typeof this.game.undo === 'function') { this.game.undo(); this.updateUI(); }
    }
    updateModifierUI() { document.querySelectorAll('.mod-btn').forEach(btn => { const m = parseInt(btn.dataset.mult); btn.classList.toggle('active', m === this.modifier && this.modifier !== 1); }); }
    async updateHeaderInfo() {
        try { await LevelSystem.getUserStats(); if(this.ui.playerName) this.ui.playerName.textContent = window.appState?.profile?.username || "Player 1"; } catch (e) { if(this.ui.playerName) this.ui.playerName.textContent = "Player 1"; }
        if(this.ui.challengeTitle) this.ui.challengeTitle.textContent = this.game.isTraining ? "Training Mode" : `Level ${this.game.level || 1}`;
    }
}