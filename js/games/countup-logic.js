/**
 * COUNTUP LOGIC
 * Vollständig synchronisiert mit der Struktur von scoring-x01-logic.js
 */

export const CountUpLevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

const LEVEL_CONFIG = {
    1:  { maxRounds: 10, targetScore: 300, xpBase: 300 },
    2:  { maxRounds: 10, targetScore: 400, xpBase: 400 },
    5:  { maxRounds: 9,  targetScore: 500, xpBase: 600 },
    10: { maxRounds: 8,  targetScore: 600, xpBase: 900 },
    15: { maxRounds: 7,  targetScore: 700, xpBase: 1300 },
    20: { maxRounds: 6,  targetScore: 800, xpBase: 2000 }
};

export class CountUpLogic {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "X01"; // WICHTIG: Muss "X01" heißen, damit ScoringX01Control das Clean-Layout wählt
        this.displayName = "CountUp"; // Interner Bezeichner
        this.interfaceType = "x01";
        this.srCategory = "scoring";
        this.isTraining = isTraining;
        this.level = level;

        const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
        const settings = customSettings || {};

        // Parameter-Mapping analog zu X01
        this.maxRounds = parseInt(settings.rounds) || config.maxRounds;
        this.targetScore = parseInt(settings.target) || config.targetScore;
        // Diese Eigenschaft wird vom Controller für das Badge genutzt
        this.checkoutText = `${this.targetScore} P / ${this.maxRounds} R`;
        
        this.currentScore = 0;
        this.scoreAtRoundStart = 0;
        this.lastScore = 0; 
        this.round = 1;
        this.dartsThrown = 0;
        this.totalDarts = 0;
        this.currentRoundThrows = [];
        this.history = [];
        this.isFinished = false;

        // Stats-Keys exakt wie in X01 für konsistente Leaderboards/Stats-Grids
        this.stats = {
            totalPoints: 0,
            oneEighty: 0,
            oneFortyPlus: 0,
            hundredPlus: 0,
            highestVisit: 0,
            singles: 0,
            doubles: 0,
            triples: 0
        };
    }

    getInfoBlock() {
        return {
            title: this.displayName,
            subtitle: this.isTraining ? 'Training Mode' : `Level ${this.level}`,
            summary: 'Count Up ist die offensive Variante: Jeder Treffer addiert Punkte. Ziel ist es, in begrenzten Runden den Zielscore zu knacken.',
            facts: [`${this.maxRounds} Runden`, `Zielscore ${this.targetScore}`, 'Kein Bust'],
            sections: [
                { label: 'Ziel', text: `Sammle in ${this.maxRounds} Runden mindestens ${this.targetScore} Punkte.` },
                { label: 'Ablauf', text: 'Anders als in X01 wird hier nichts abgezogen. Jeder Treffer erhöht deinen Gesamtstand.' },
                { label: 'Wertung', text: 'Hohe Aufnahmen, 100+, 140+ und 180er werden separat getrackt und belohnen konstantes Scoring.' },
                { label: 'Sieg', text: 'Gewonnen ist die Challenge, wenn du den Zielscore innerhalb des vorgegebenen Rundenlimits erreichst.' }
            ]
        };
    }

    updateCheckouts(uiElement) {
        if (uiElement) {
            uiElement.textContent = this.checkoutText;
            uiElement.style.background = "var(--neon-blue)"; // Optische Abhebung von X01
        }
    }


    registerHit(val, mult) {
        if (this.isFinished || this.dartsThrown >= 3) return;

        const points = val * mult;
        const throwData = { 
            base: val, 
            mult: mult, 
            points: points, 
            scoreBefore: this.currentScore,
            isBust: false 
        };
        
        if (mult === 3) this.stats.triples++;
        if (mult === 2) this.stats.doubles++;
        if (mult === 1 && val > 0) this.stats.singles++;

        this.currentScore += points;
        this.stats.totalPoints += points;
        this.currentRoundThrows.push(throwData);
        this.dartsThrown++;
        this.totalDarts++;

        // Sieg-Bedingung
        if (this.currentScore >= this.targetScore) {
            this.isFinished = true;
        }
    }

    nextRound() {
        if (this.isFinished) return;
        
        const roundPoints = this.currentRoundThrows.reduce((sum, t) => sum + (t.points || 0), 0);
        this.lastScore = roundPoints;

        // Milestone-Stats tracken
        if (roundPoints >= 180) this.stats.oneEighty++;
        else if (roundPoints >= 140) this.stats.oneFortyPlus++;
        else if (roundPoints >= 100) this.stats.hundredPlus++;
        if (roundPoints > this.stats.highestVisit) this.stats.highestVisit = roundPoints;

        // Auffüllen auf 3 Darts (für saubere History/Stats)
        while (this.dartsThrown < 3) {
            this.dartsThrown++;
        }

        this.history.push(JSON.stringify({
            scoreStart: this.scoreAtRoundStart,
            lastScore: this.lastScore,
            stats: { ...this.stats },
            totalDarts: this.totalDarts
        }));

        if (this.round >= this.maxRounds) {
            this.isFinished = true;
        } else {
            this.round++;
            this.scoreAtRoundStart = this.currentScore;
            this.dartsThrown = 0;
            this.currentRoundThrows = [];
        }
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const lastThrow = this.currentRoundThrows.pop();
            this.currentScore = lastThrow.scoreBefore;
            this.stats.totalPoints -= lastThrow.points;
            this.dartsThrown--;
            this.totalDarts--;
            this.isFinished = false;
        } else if (this.history.length > 0) {
            const lastState = JSON.parse(this.history.pop());
            this.scoreAtRoundStart = lastState.scoreStart;
            this.currentScore = lastState.scoreStart;
            this.lastScore = lastState.lastScore;
            this.stats = lastState.stats;
            this.totalDarts = lastState.totalDarts;
            this.round--;
            this.dartsThrown = 0;
            this.currentRoundThrows = [];
            this.isFinished = false;
        }
    }

   getFinalStats() {
        const totalDarts = this.totalDarts || 1;
        const avg = (this.stats.totalPoints / totalDarts) * 3;
        const hasWon = this.currentScore >= this.targetScore;
        
        /**
         * NEUE SR-LOGIK (Analog zu Game 121 / Finishing)
         * Wir berechnen eine "Efficiency Ratio" statt nur den Average.
         */
        let sr = 0;
        if (!this.isTraining) {
            // Basis: Average-Leistung
            let baseSR = avg; 

            // Bonus für Treffgenauigkeit (Triples/Doubles) wie in Finishing-Games
            const accuracyBonus = (this.stats.triples * 2) + (this.stats.doubles * 1);
            
            // Malus/Bonus basierend auf Zielerreichung
            // Wenn gewonnen, zählt die Geschwindigkeit (Runden-Effizienz)
            const speedFactor = hasWon ? (this.maxRounds / this.round) : (this.currentScore / this.targetScore);
            
            sr = (baseSR * 0.8) + (accuracyBonus * 2); 
            sr *= speedFactor;

            // Cap bei 180 (ELO-Standard im System)
            sr = Math.min(180, Math.floor(sr));
        }

        // XP System (Konsistent mit config)
        const config = LEVEL_CONFIG[this.level] || LEVEL_CONFIG[1];
        let finalXP = config.xpBase;

        if (hasWon) {
            finalXP += (this.stats.triples * 30) + (this.stats.oneEighty * 100);
            const roundBonus = (this.maxRounds - this.round) * 40;
            finalXP += Math.max(0, roundBonus);
        } else {
            finalXP = Math.floor(finalXP * 0.25); // Teil-XP für Bemühung
        }

        if (this.isTraining) finalXP *= 0.1;

        return {
            xp: Math.floor(finalXP),
            sr: sr,
            won: hasWon,
            stats: {
                mode: `CountUp Lvl ${this.level}`,
                avg: avg.toFixed(1),
                darts: this.totalDarts,
                "180s": this.stats.oneEighty,
                highestVisit: this.stats.highestVisit
            }
        };
    }
}
