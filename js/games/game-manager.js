/**
 * GAME CLASSES
 */
class AroundTheClock {
    constructor() {
        this.name = "Around the Clock";
        this.targets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];
        this.currentIndex = 0;
        this.totalThrows = 0;
        this.isFinished = false;
        this.firstDartHits = 0;
        this.isFirstDartOfTarget = true;
    }
    get currentTarget() { return this.targets[this.currentIndex]; }
    registerThrow(isHit) {
        this.totalThrows++;
        if (isHit) {
            if (this.isFirstDartOfTarget) this.firstDartHits++;
            this.currentIndex++;
            this.isFirstDartOfTarget = true;
            if (this.currentIndex >= this.targets.length) this.isFinished = true;
        } else {
            this.isFirstDartOfTarget = false;
        }
    }
    getInfoHTML() { return `Ziel: ${this.currentIndex + 1}/21 | Würfe: ${this.totalThrows}`; }
    getFinalStats() {
        return {
            xp: 100 + (this.firstDartHits * 10),
            stats: { mode: 'atc', total_throws: this.totalThrows, first_dart_hits: this.firstDartHits }
        };
    }
}

class Shanghai {
    constructor() {
        this.name = "Shanghai";
        this.round = 1;
        this.points = 0;
        this.dartsInRound = 0;
        this.isFinished = false;
    }
    get currentTarget() { return `Runde ${this.round}`; }
    registerThrow(isHit) {
        this.dartsInRound++;
        if (isHit) this.points += this.round;
        if (this.dartsInRound >= 3) {
            this.round++;
            this.dartsInRound = 0;
            if (this.round > 7) this.isFinished = true;
        }
    }
    getInfoHTML() { return `Punkte: ${this.points} | Dart: ${this.dartsInRound + 1}/3`; }
    getFinalStats() {
        return { xp: this.points * 5, stats: { mode: 'shanghai', score: this.points } };
    }
}

/**
 * GAME MANAGER
 */
export const GameManager = {
    currentGame: null,

    loadGame(gameId) {
        if (gameId === 'atc') this.currentGame = new AroundTheClock();
        else if (gameId === 'shanghai') this.currentGame = new Shanghai();
        
        document.getElementById('game-title').textContent = this.currentGame.name;
        this.updateUI();
    },

    handleInput(isHit) {
        if (!this.currentGame || this.currentGame.isFinished) return;
        this.currentGame.registerThrow(isHit);
        this.updateUI();
        if (this.currentGame.isFinished) this.completeGame();
    },

    updateUI() {
        document.getElementById('main-target').textContent = this.currentGame.currentTarget;
        document.getElementById('game-info').innerHTML = this.currentGame.getInfoHTML();
    },

    async completeGame() {
        const results = this.currentGame.getFinalStats();
        // Aufruf der globalen Sync-Funktion aus app.js
        if (window.syncMatchToDatabase) {
            await window.syncMatchToDatabase(results.xp, results.stats);
        }
        alert(`Spiel beendet! XP: +${results.xp}`);
        window.navigate('dashboard');
    }
};