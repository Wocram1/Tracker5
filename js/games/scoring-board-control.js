import { htmlBoardControl } from '../views/view-board-control.js';
import { LevelSystem } from '../supabase_client.js';

export class ScoringBoardControl {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.appContainer = document.getElementById('view-game-active');
        this.frozenTargetDisplay = null;
        this.playerName = "PLAYER";
        this.displayLevel = "CHALLENGE ACTIVE";
    }

    async init() {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        this.appContainer.classList.remove('hidden');
        this.frozenTargetDisplay = null;

        const appHeader = document.querySelector('.app-top-bar');
        if (appHeader) appHeader.classList.add('hidden');

        document.body.classList.add('game-active');
        this.appContainer.classList.remove('hidden');
        this.frozenTargetDisplay = null;

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

        this.updateView();
    }

   updateView() {
    const target = (this.game.roundDarts.length === 3 && this.frozenTargetDisplay !== null)
        ? this.frozenTargetDisplay
        : (this.game.targetDisplay || this.game.currentTargetNumber);

    const roundDarts = this.game.roundDarts || [];
    const score = this.game.points || 0;
    const lives = this.game.lives;
    const bolts = this.game.bolts;
    const malus = this.game.malusScore || 0;
    const round = this.game.currentRound || this.game.round || 1;
    const maxRounds = this.game.config?.maxRounds || 10;
    const minPoints = this.game.config?.minPoints || 0;

    // Board neu zeichnen
    this.appContainer.innerHTML = htmlBoardControl(
        target, 
        roundDarts, 
        score,
        lives, 
        bolts,
        malus,
        round,
        maxRounds,
        minPoints,
        this.playerName,
        this.displayLevel
    );

    // WICHTIG: Erst jetzt existieren die Elemente im DOM wieder!
    requestAnimationFrame(() => {
    this.highlightBoard(); 
});
 if (this.game.isFinished && window.GameManager?.completeGame) {
            // Leicht verzögert, damit man den letzten Treffer noch kurz aufblinken sieht
            setTimeout(() => {
                window.GameManager.completeGame();
            }, 600);
        }
    }

 highlightBoard() {
    // 1. Alle alten Highlights sicher entfernen
    document.querySelectorAll('.segment-path').forEach(path => {
        path.classList.remove(
            'target-dart-1', 'target-dart-2', 'target-dart-3',
            'toggle-color-1-2', 'toggle-color-2-3', 'toggle-color-1-3', 'toggle-color-1-2-3'
        );
    });

    // Wieviele Darts wurden diese Runde schon geworfen?
    const throwsCount = (this.game.roundDarts || []).length;
    
    // Wenn 3 Darts geworfen wurden, blenden wir die Ziele aus, bis Next gedrückt wird
    if (throwsCount >= 3 || this.frozenTargetDisplay !== null) return;

    // Vorausschauende Ziele (ATC: [18,19,20] oder Shanghai: [20,20,20])
    const targets = this.game.currentTargets || [];
    if (targets.length === 0) return;

    // 2. Wir ordnen nur die noch NICHT geworfenen Darts den Zahlen zu
    const segmentMap = {};
    for (let i = throwsCount; i < 3; i++) {
        const num = targets[i];
        if (num === undefined) continue;
        if (!segmentMap[num]) segmentMap[num] = [];
        
        // i + 1 ist der Dart-Index (1 = Hellblau, 2 = Mittelblau, 3 = Dunkelblau)
        segmentMap[num].push(i + 1); 
    }

    // 3. CSS Klassen gezielt anwenden
    for (const [num, dartIndices] of Object.entries(segmentMap)) {
        const segmentGroup = document.getElementById(`segment-${num}`);
        if (!segmentGroup) continue;

        const paths = segmentGroup.querySelectorAll('.segment-path');
        paths.forEach(path => {
            const sorted = dartIndices.sort((a, b) => a - b);
            
            // Wenn mehrere Darts auf dieselbe Zahl gehen -> Blinken
            if (sorted.length === 3) {
                path.classList.add('toggle-color-1-2-3');
            } else if (sorted.length === 2) {
                path.classList.add(`toggle-color-${sorted[0]}-${sorted[1]}`);
            } 
            // Wenn nur 1 Dart auf diese Zahl geht -> Statische Farbe
            else if (sorted.length === 1) {
                path.classList.add(`target-dart-${sorted[0]}`);
            }
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
                this.game.bolts = this.game.config.startBlitz;
                this.game.roundDarts = [];
                this.triggerBurnoutEffect();
            }

            this.triggerHitEffect(multiplier);
            this.updateView();
        }
    }

   nextRound() {
        const btn = document.getElementById('bc-next-btn');
        if (btn) btn.classList.add('ani-next-score'); // Button Animation

        this.frozenTargetDisplay = null;
        this.game.nextRound(); 
        
        if (this.game.bolts === 0 && this.game.config.startBlitz > 0) {
            this.game.bolts = this.game.config.startBlitz;
            this.triggerBurnoutEffect();
        }
        
        this.highlightNextButton(false);
        this.updateView();
        
        // Animation nach 500ms entfernen für den nächsten Loop
        setTimeout(() => {
            const scoreDisplay = document.getElementById('bc-points-display');
            if(scoreDisplay) scoreDisplay.classList.remove('ani-next-score');
        }, 500);
    }

    nextRound() {
        if (!this.game) return;

        // 1. Die Logik im Hintergrund eine Runde weiterschalten (hier wird der Counter erhöht!)
        this.game.nextRound();

        // 2. Eingefrorenes Display (von der Vorrunde) lösen
        this.frozenTargetDisplay = null;

        // 3. UI updaten und Next-Button verstecken
        this.highlightNextButton(false);
        this.updateView();
    }

   undo() {
        const btn = document.getElementById('bc-undo-btn');
        if (btn) btn.classList.add('ani-undo');

        this.frozenTargetDisplay = null;
        if (this.game.undo) this.game.undo();
        else if (this.game.roundDarts.length > 0) this.game.roundDarts.pop();
        
        this.highlightNextButton(false);
        this.updateView();

        setTimeout(() => {
            if(btn) btn.classList.remove('ani-undo');
        }, 400);
    }

    highlightNextButton(active) {
        const btn = this.appContainer.querySelector('.bc-action-wide.next');
        if (!btn) return;
        btn.classList.toggle('confirm-next', active);
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