/**
 * SCORING X01 LOGIC
 * Jetzt mit Level-Konfiguration fÃ¼r Rundenlimits und Checkout-Modi.
 */

export const ScoringX01LevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

/**
 * LEVEL CONFIGURATION
 * sScore: Startwert (301, 501, etc.)
 * maxRounds: Maximale Runden (wie in CountUp)
 * doubleOut: true fÃ¼r Double Out, false fÃ¼r Single Out
 * xpBase: Basis XP fÃ¼r das Level
 */
const LEVEL_CONFIG = {

    1:  { sScore: 301, maxRounds: 10, doubleOut: false, xpBase: 350 }, 
    2:  { sScore: 301, maxRounds: 9, doubleOut: false,  xpBase: 400 },
    3:  { sScore: 301, maxRounds: 8, doubleOut: false,  xpBase: 500 }, 
    5:  { sScore: 301, maxRounds: 7, doubleOut: false,  xpBase: 600 },
    6:  { sScore: 301, maxRounds: 8, doubleOut: true,  xpBase: 799 }, 
    10: { sScore: 501, maxRounds: 15, doubleOut: false,  xpBase: 900 },
    15: { sScore: 701, maxRounds: 25, doubleOut: true,  xpBase: 1300 },
    20: { sScore: 1001, maxRounds: 30, doubleOut: true, xpBase: 2000 },
    'daily': { sScore: 301, maxRounds: 7, doubleOut: false, xpBase: 750 },
    'daily2': { sScore: 301, maxRounds: 7, doubleOut: false, xpBase: 750 }
};

export class ScoringX01Logic {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "X01";
        this.displayName = "X01";
        this.interfaceType = "x01"; 
        this.srCategory = "scoring";
        this.isTraining = isTraining;
        this.level = level;

        // Level Config laden
        const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
        this.config = config;

        // Settings PrioritÃ¤t: Custom Settings > Level Config > Default
        const settings = customSettings || {};
        this.startScore = parseInt(settings.score) || config.sScore || 501;
        this.maxRounds = parseInt(settings.maxRounds) || config.maxRounds || 99;
        this.isDoubleOut = settings.doubleOut !== undefined ? settings.doubleOut : config.doubleOut;
        this.isDoubleIn = settings.doubleIn !== undefined ? settings.doubleIn : false;
        
        // Spielstatus
        this.currentScore = this.startScore;
        this.scoreAtRoundStart = this.startScore;
        this.lastScore = 0; 
        this.round = 1;
        this.dartsThrown = 0;
        this.totalDarts = 0;
        this.currentRoundThrows = [];
        this.history = [];
        this.isFinished = false;
        this.hasStartedScoring = !this.isDoubleIn;

        this.stats = {
            totalPoints: 0,
            hits: 0,
            misses: 0,
            triples: 0,
            doubles: 0,
            oneEighty: 0,
            checkoutAttempts: 0
        };
    }

    getInfoBlock() {
        return {
            title: this.displayName,
            subtitle: this.isTraining ? 'Training Mode' : `Level ${this.level}`,
            summary: 'Klassisches X01: Du spielst deinen Startscore auf exakt 0 herunter und musst dabei das jeweilige Checkout-Format respektieren.',
            facts: [`Startscore ${this.startScore}`, `${this.maxRounds} Runden`, this.isDoubleOut ? 'Double Out' : 'Single Out'],
            sections: [
                { label: 'Ziel', text: 'Bringe deinen Score exakt auf 0, bevor das Rundenlimit erreicht ist.' },
                { label: 'Ablauf', text: 'Jeder Dart zieht Punkte vom Restscore ab. Busts setzen die Aufnahme effektiv auf den Stand zu Beginn der Runde zurÃ¼ck.' },
                { label: 'Checkout', text: this.isDoubleOut ? 'Das letzte Dart muss ein Double sein, sonst zÃ¤hlt der Checkout nicht.' : 'Das Spiel endet, sobald du exakt 0 erreichst.' },
                { label: 'Sieg', text: 'Gewonnen ist die Partie, wenn du 0 sauber checkst. Alles andere endet als verlorene Challenge oder Trainingsresultat.' }
            ]
        };
    }

    get displayStats() {
        return [
            { label: 'AVG', value: ((this.stats.totalPoints / (this.totalDarts || 1)) * 3).toFixed(1), color: 'text-primary' },
            { label: 'Darts', value: this.totalDarts, color: 'text-info' },
            { label: 'Runde', value: `${this.round}/${this.maxRounds}`, color: 'text-warning' }
        ];
    }

    registerHit(val, mult) {
        if (this.isFinished || this.dartsThrown >= 3) return;

        const points = val * mult;
        const potentialNewScore = this.currentScore - points;

        // Double In Logik
        if (!this.hasStartedScoring) {
            if (mult === 2) {
                this.hasStartedScoring = true;
            } else {
                this._recordThrow(val, mult, 0, false);
                return;
            }
        }

        // Checkout & Bust Logik
        const isBust = this._checkBust(potentialNewScore, val, mult);
        
        if (isBust) {
            this._recordThrow(val, mult, 0, false);
            this.dartsThrown = 3; // Runde beenden bei Bust
        } else {
            this.currentScore = potentialNewScore;
            this._recordThrow(val, mult, points, true);
            
            if (this.currentScore === 0) {
                this.isFinished = true;
                this.dartsThrown = 3;
            }
        }
    }

    _checkBust(score, val, mult) {
        // Unter 0 immer Bust
        if (score < 0) return true;
        // 1 Rest bei Double Out ist Bust
        if (score === 1 && this.isDoubleOut) return true;
        // 0 Rest aber kein Double bei Double Out ist Bust
        if (score === 0 && this.isDoubleOut && mult !== 2) return true;
        return false;
    }

    _recordThrow(val, mult, points, isValid) {
        this.currentRoundThrows.push({
            base: val, mult, points, // Hier 'base: val' statt nur 'val'
            scoreBefore: isValid ? this.currentScore + points : this.currentScore,
            isDoubleAttempt: this._isCheckoutRange()
        });

        if (isValid) {
            this.stats.totalPoints += points;
            if (mult === 3) this.stats.triples++;
            if (mult === 2) this.stats.doubles++;
        }
        
        this.totalDarts++;
        this.dartsThrown++;
        
        if (this.currentRoundThrows.length === 3) {
            const roundTotal = this.currentRoundThrows.reduce((sum, t) => sum + t.points, 0);
            if (roundTotal === 180) this.stats.oneEighty++;
        }
    }

    _isCheckoutRange() {
        if (this.isDoubleOut) return this.currentScore <= 50;
        return this.currentScore <= 60;
    }

    nextRound() {
        if (this.isFinished) return;
        
        this.saveHistory();
        this.lastScore = this.currentRoundThrows.reduce((sum, t) => sum + t.points, 0);
        
        if (this.round >= this.maxRounds) {
            this.isFinished = true; // Spiel beendet durch Rundenlimit
        } else {
            this.round++;
            this.dartsThrown = 0;
            this.currentRoundThrows = [];
            this.scoreAtRoundStart = this.currentScore;
        }
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const last = this.currentRoundThrows.pop();
            this.currentScore = last.scoreBefore;
            this.stats.totalPoints -= last.points;
            this.totalDarts--;
            this.dartsThrown--;
            this.isFinished = false;
            return;
        }
        
        if (this.history.length > 0) {
            const lastState = JSON.parse(this.history.pop());
            this.currentScore = lastState.scoreStart;
            this.scoreAtRoundStart = lastState.scoreStart;
            this.round--;
            this.stats = lastState.stats;
            this.totalDarts = lastState.totalDarts;
            this.currentRoundThrows = [];
            this.dartsThrown = 0;
            this.isFinished = false;
        }
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            scoreStart: this.scoreAtRoundStart,
            stats: { ...this.stats },
            totalDarts: this.totalDarts
        }));
    }

    getFinalStats() {
        const totalDarts = this.totalDarts || 1;
        const avg = (this.stats.totalPoints / totalDarts) * 3;
        const hasWon = this.currentScore === 0;
        
        let sr = Math.floor(avg);
        if (hasWon) sr += 10; // Bonus fÃ¼r Finish

        let finalXP = this.config.xpBase;
        if (hasWon) {
            finalXP += (this.stats.oneEighty * 150) + (this.stats.doubles * 20);
            // Bonus fÃ¼r Effizienz (Runden-Faktor)
            const speedBonus = Math.max(1, (this.maxRounds - this.round) * 10);
            finalXP += speedBonus;
        } else {
            finalXP = Math.max(50, Math.floor(finalXP * 0.25));
        }

        if (this.isTraining) finalXP *= 0.1;

        return {
            xp: Math.floor(finalXP),
            sr: Math.min(180, sr),
            won: hasWon,
            stats: {
                ...this.stats,
                avg: avg.toFixed(1),
                lastScore: this.currentScore,
                mode: `X01 Lvl ${this.level} (${this.startScore})`
            }
        };
    }
}


