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
    // Top Bar & Stats (Alle lokal suchen!)
    score: this.appContainer.querySelector('#x01-score'),
    round: this.appContainer.querySelector('#x01-round'),
    progress: this.appContainer.querySelector('#x01-target-progress'),
    totalPoints: this.appContainer.querySelector('#x01-total-points'),
    malus: this.appContainer.querySelector('#x01-malus-val'),
    minPts: this.appContainer.querySelector('#x01-min-pts-val'),
    livesContainer: this.appContainer.querySelector('#x01-lives-container'),
    modeBadge: this.appContainer.querySelector('#x01-checkout-badge'),
    hint: this.appContainer.querySelector('#x01-checkout-hint'),
    playerName: this.appContainer.querySelector('#x01-player-name'),
    challengeTitle: this.appContainer.querySelector('#x01-challenge-title'),
    
    // Header-Sichtbarkeitselemente
    challengeHeader: this.appContainer.querySelector('#x01-challenge-header'),
    avgContainer: this.appContainer.querySelector('#x01-avg-container'),
    lastContainer: this.appContainer.querySelector('#x01-last-container'),
    
    // Container für Finishing-Spezifika
    minPtsContainer: this.appContainer.querySelector('#x01-min-pts-container'),
    targetContainer: this.appContainer.querySelector('#x01-target-progress-container'),

    // Throw-Boxes (Sehr wichtig: Auch hier lokal suchen!)
    throws: [
        this.appContainer.querySelector('#th-1'),
        this.appContainer.querySelector('#th-2'),
        this.appContainer.querySelector('#th-3')
    ]
};
        }

        // Interface-Anpassung: Finishing benötigt Malus/Punkte, kein Average
        if (this.ui.challengeHeader) this.ui.challengeHeader.style.display = 'flex';
        if (this.ui.avgContainer) this.ui.avgContainer.style.display = 'none';
        if (this.ui.lastContainer) this.ui.lastContainer.style.display = 'none';
        
        // Neue Elemente einblenden, falls sie für dieses Spiel relevant sind
        if (this.ui.minPtsContainer) this.ui.minPtsContainer.style.display = 'flex';
        if (this.ui.targetContainer) this.ui.targetContainer.style.display = 'flex';

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
        if (throws.filter(t => !t.isDummy).length >= 3) return; 

        const finalMult = this.modifier !== 1 ? this.modifier : mult;
        this.game.registerHit(parseInt(val), finalMult);
        
        // SOUND
        window.SoundManager?.play(parseInt(val) === 0 ? 'miss' : 'hit');

        this.modifier = 1; 
        this.updateUI();

       // AUTO-NEXT LOGIK (Spezifisch für Finishing mit Dummy-Filter)
        const currentThrows = this.game.currentRoundThrows || [];
        const realDarts = currentThrows.filter(t => !t.isDummy).length;
        
        if (realDarts === 3 && !this.game.isFinished) {
            // Button finden (X01 Interface nutzt meist .next-btn-side)
            const nextBtn = document.querySelector('.next-btn-side');
            
            if (nextBtn) {
                // Animation zurücksetzen und neu starten
                nextBtn.classList.remove('auto-next-anim');
                void nextBtn.offsetWidth; // Force Reflow für sauberen Animations-Restart
                nextBtn.classList.add('auto-next-anim');
            }

            clearTimeout(this.autoNextTimeout);
            this.autoNextTimeout = setTimeout(() => {
                // Animation entfernen nach Ablauf
                if (nextBtn) nextBtn.classList.remove('auto-next-anim');

                // Sicherheitcheck: Sind es immer noch 3 Darts? (Kein Undo passiert?)
                const checkThrows = this.game.currentRoundThrows || [];
                if (checkThrows.filter(t => !t.isDummy).length === 3) {
                    window.GameManager.nextRoundX01();
                }
            }, 1100); // Erhöht auf 1100ms für besseres visuelles Feedback
        }
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
        // 1. Auto-Next Timer sofort stoppen
        if (this.autoNextTimeout) {
            clearTimeout(this.autoNextTimeout);
        }

        // 2. Animation visuell abbrechen
        const nextBtn = document.querySelector('.next-btn-side') || document.getElementById('bc-next-btn');
        if (nextBtn) {
            nextBtn.classList.remove('auto-next-anim');
        }
        
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

        if (this.ui.round) {
            this.ui.round.textContent = this.game.getRoundProgress ? this.game.getRoundProgress() : this.game.round;

            if (this.game.currentRoundDisplay) {
                this.ui.round.textContent = this.game.currentRoundDisplay;
            } else {
                const currentRound = (this.game.roundsUsedForTarget || 0) + 1;
                const config = this.game.levelConfig ? this.game.levelConfig[this.game.level] : null;
                const maxRounds = config?.rounds || config?.roundsPerTarget || 3;
                this.ui.round.textContent = `${currentRound}/${maxRounds}`;
            }
        }

        // 3. Target-Fortschritt (z.B. 2/5)
        if (this.ui.progress) {
            const current = (this.game.currentIndex !== undefined) ? (this.game.currentIndex + 1) : (this.game.targetsPlayed || 0);
            const total = this.game.totalTargetsToPlay || 0;
            this.ui.progress.textContent = `${current}/${total}`;
        }

        // 4. Punkte & Malus
        if (this.ui.totalPoints) this.ui.totalPoints.textContent = this.game.points || 0;
        if (this.ui.malus) this.ui.malus.textContent = this.game.malusScore || this.game.malusTotal || 0;

        // 5. Mindestpunkte Anzeige
        if (this.ui.minPts) {
            this.ui.minPts.textContent = this.game.minPointsRequired || 0;
        }

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