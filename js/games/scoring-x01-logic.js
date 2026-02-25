/**
 * SCORING X01 LOGIC
 * Vollständige Logik, angepasst an die GameManager-Struktur.
 */
export class ScoringX01Logic {
    // Der GameManager übergibt (requestedLevel, isTraining, customSettings)
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "X01";
        this.interfaceType = "x01"; 
        this.srCategory = "scoring";
        this.isTraining = isTraining;

        // Settings aus dem Modal oder Standardwerte
        const settings = customSettings || {};
        this.startScore = parseInt(settings.score) || 501;
        this.isDoubleOut = settings.doubleOut !== undefined ? settings.doubleOut : true;
        this.isDoubleIn = settings.doubleIn !== undefined ? settings.doubleIn : false;
        
        // Spielstatus
        this.currentScore = this.startScore;
        this.scoreAtRoundStart = this.startScore;
        this.round = 1;
        this.dartsThrown = 0;
        this.totalDarts = 0;
        this.currentRoundThrows = [];
        this.history = [];
        this.isFinished = false;
        this.hasStartedScoring = !this.isDoubleIn;

        this.stats = {
            totalPoints: 0,
            first9Points: 0,
            hundredPlus: 0,
            oneFortyPlus: 0,
            oneEighty: 0,
            highestVisit: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            checkoutAttempts: 0,
            distribution: {} 
        };
        this.initDistribution();
    }

    /**
     * WICHTIG: Diese Methode triggert das Fenster im GameManager!
     */
    static getTrainingConfig() {
        return {
            gameId: 'x01',
            title: 'X01 Training Setup',
            options: [
                {
                    id: 'score',
                    label: 'Start-Score',
                    type: 'select',
                    values: [
                        { label: '301', value: '301' },
                        { label: '501', value: '501' },
                        { label: '701', value: '701' }
                    ]
                },
                {
                    id: 'doubleOut',
                    label: 'Double Out (Finish)',
                    type: 'toggle',
                    default: true
                },
                {
                    id: 'doubleIn',
                    label: 'Double In (Start)',
                    type: 'toggle',
                    default: false
                }
            ]
        };
    }

    initDistribution() {
        const sectors = [...Array(21).keys(), 25]; 
        sectors.forEach(s => {
            this.stats.distribution[s] = [0, 0, 0]; 
        });
    }

    registerHit(val, mult) {
        if (this.isFinished || this.dartsThrown >= 3) return;

        const dartIndexInRound = this.currentRoundThrows.length; 
        let points = val * mult;
        
        if (this.totalDarts < 9) this.stats.first9Points += points;
        if (this.stats.distribution[val] !== undefined) {
            this.stats.distribution[val][dartIndexInRound]++;
        }

        if (mult === 1 && val > 0) this.stats.singles++;
        if (mult === 2) this.stats.doubles++;
        if (mult === 3) this.stats.triples++;

        if (this.isDoubleOut && this.currentScore <= 50 && this.currentScore % 2 === 0) {
            this.stats.checkoutAttempts++;
        }

        if (!this.hasStartedScoring) {
            if (mult === 2) this.hasStartedScoring = true;
            else points = 0;
        }

        const tempScore = this.currentScore - points;
        let isBust = false;

        if (tempScore < 0) isBust = true; 
        else if (this.isDoubleOut) {
            if (tempScore === 1) isBust = true; 
            if (tempScore === 0 && mult !== 2) isBust = true; 
        }

        const throwData = { 
            base: val, 
            mult: mult, 
            points: isBust ? 0 : points, 
            scoreBefore: this.currentScore, 
            isBust: isBust 
        };

        this.totalDarts++;

        if (isBust) {
            this.currentRoundThrows.push(throwData);
            this.currentScore = this.scoreAtRoundStart; 
            this.dartsThrown = 3; 
        } else {
            this.currentScore = tempScore;
            this.currentRoundThrows.push(throwData);
            this.dartsThrown++;
            this.stats.totalPoints += points;
        }

        if (this.currentScore === 0 && !isBust) {
            this.isFinished = true;
        }
    }

    nextRound() {
        if (this.isFinished) return;
        const roundPoints = this.currentRoundThrows.reduce((sum, t) => sum + (t.points || 0), 0);
        
        if (roundPoints >= 180) this.stats.oneEighty++;
        else if (roundPoints >= 140) this.stats.oneFortyPlus++;
        else if (roundPoints >= 100) this.stats.hundredPlus++;
        
        if (roundPoints > this.stats.highestVisit) this.stats.highestVisit = roundPoints;

        while (this.dartsThrown < 3) { 
            this.currentRoundThrows.push({ base: 0, mult: 1, points: 0, scoreBefore: this.currentScore, isBust: false });
            this.dartsThrown++;
        }

        this.history.push(JSON.stringify({ 
            scoreStart: this.scoreAtRoundStart, 
            stats: {...this.stats},
            totalDarts: this.totalDarts
        }));
        
        this.scoreAtRoundStart = this.currentScore; 
        this.currentRoundThrows = [];
        this.dartsThrown = 0;
        this.round++;
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const lastThrow = this.currentRoundThrows.pop();
            this.currentScore = lastThrow.scoreBefore;
            this.stats.totalPoints -= lastThrow.points;
            this.dartsThrown--;
            this.totalDarts--;
            this.isFinished = false;
            return;
        }
        
        if (this.history.length > 0) {
            const lastState = JSON.parse(this.history.pop());
            this.scoreAtRoundStart = lastState.scoreStart;
            this.currentScore = lastState.scoreStart;
            this.currentRoundThrows = [];
            this.dartsThrown = 0;
            this.round--;
            this.stats = lastState.stats;
            this.totalDarts = lastState.totalDarts;
        }
    }

    getFinalStats() {
        const totalDarts = this.totalDarts || 1;
        const avg = (this.stats.totalPoints / totalDarts) * 3;
        
        let finalXP = (this.startScore / 2) + (this.stats.oneEighty * 150);
        if (this.isTraining) finalXP *= 0.1;

        return {
            xp: Math.floor(finalXP),
            sr: Math.floor(avg),
            won: this.isFinished,
            stats: {
                mode: `X01 ${this.startScore}`,
                points: this.stats.totalPoints,
                avg: avg.toFixed(1),
                darts: this.totalDarts,
                "180s": this.stats.oneEighty
            }
        };
    }
}