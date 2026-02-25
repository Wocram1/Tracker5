import { LevelSystem } from '../supabase_client.js';

/**
 * CheckoutChallenge LevelMapper
 */
export const CheckoutChallengeLevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

export class CheckoutChallenge {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "Checkout Challenge";
        this.interfaceType = "finishing"; 
        this.srCategory = "finishing";
        this.isTraining = isTraining;
        this.level = level;

        // --- LEVEL CONFIGURATION (1-20) ---
        // Synchronisiert mit 121 Challenge Logik
        this.levelConfig = {
            1:  { range: [2, 40],   attempts: 10, check: 'single', minPoints: 40,  malus: 5,  roundsPerTarget: 3 },
            2:  { range: [10, 50],  attempts: 10, check: 'single', minPoints: 50,  malus: 5,  roundsPerTarget: 3 },
            3:  { range: [2, 50],   attempts: 10, check: 'double', minPoints: 40,  malus: 5,  roundsPerTarget: 3 },
            10: { range: [60, 100], attempts: 10, check: 'single-double', switchTarget: 90, minPoints: 50, malus: 10, roundsPerTarget: 3 },
            20: { range: [121, 170], attempts: 10, check: 'double', minPoints: 60,  malus: 15, roundsPerTarget: 4 }
        };

        const config = this._getEffectiveConfig(level, customSettings);
        
        this.config = config;
        this.range = config.range;
        this.attemptsTotal = config.attempts;
        this.attemptsLeft = config.attempts;
        this.checkMode = config.check;
        this.switchTarget = config.switchTarget || 100; // Hybrid-Switch
        this.minPointsRequired = config.minPoints || 0;
        this.malusAmount = config.malus || 0;
        this.maxRoundsPerTarget = config.roundsPerTarget || 3;

        this.points = 0;
        this.round = 1;
        this.roundsUsedForCurrentTarget = 0;
        this.isFinished = false;
        this.history = [];

        this.stats = {
            totalDarts: 0,
            hits: 0,
            misses: 0,
            doubles: 0,
            triples: 0,
            pointsCleared: 0,
            perfectDartsNeeded: 0 
        };

        this.generateNewTarget();
        this.currentRoundThrows = [];
        this.dartsInRound = 0;
    }

    // --- INTERFACE BRIDGE GETTERS ---
    get targetsPlayed() {
        return this.attemptsTotal - this.attemptsLeft;
    }

    get totalTargetsToPlay() {
        return this.attemptsTotal;
    }

    get roundsUsedForTarget() {
        return this.roundsUsedForCurrentTarget;
    }

    static getTrainingConfig() {
        return {
            gameId: 'checkoutchallenge',
            title: 'Checkout Training',
            options: [
                {
                    id: 'difficulty',
                    label: 'Bereich',
                    type: 'select',
                    values: [
                        { label: 'Einsteiger (2-40)', value: '2-40' },
                        { label: 'Amateur (41-80)', value: '41-80' },
                        { label: 'Pro (81-120)', value: '81-120' },
                        { label: 'Master (121-170)', value: '121-170' }
                    ]
                },
                {
                    id: 'checkMode',
                    label: 'Checkout',
                    type: 'select',
                    values: [
                        { label: 'Single Out', value: 'single' },
                        { label: 'Double Out', value: 'double' },
                        { label: 'Hybrid (S -> D)', value: 'single-double' }
                    ]
                },
                {
                    id: 'roundsPerTarget',
                    label: 'Runden pro Zahl',
                    type: 'select',
                    values: [
                        { label: '2', value: '2' },
                        { label: '3', value: '3' },
                        { label: '4', value: '4' }
                    ]
                },
                {
                    id: 'attempts',
                    label: 'Anzahl Zahlen',
                    type: 'select',
                    values: [
                        { label: '5', value: '5' },
                        { label: '10', value: '10' },
                        { label: '20', value: '20' }
                    ]
                }
            ]
        };
    }

    setupTraining(settings) {
        const rangeMap = {
            '2-40': [2, 40],
            '41-80': [41, 80],
            '81-120': [81, 120],
            '121-170': [121, 170]
        };
        return {
            range: rangeMap[settings?.difficulty] || [41, 80],
            attempts: parseInt(settings?.attempts) || 10,
            check: settings?.checkMode || 'double',
            switchTarget: 100, // Standard für Hybrid im Training
            roundsPerTarget: parseInt(settings?.roundsPerTarget) || 3,
            minPoints: 0,
            malus: 0
        };
    }

    _getEffectiveConfig(level, custom) {
        if (custom) return this.setupTraining(custom);
        if (this.levelConfig[level]) return this.levelConfig[level];
        
        const rangeMax = Math.min(170, 40 + (level * 6));
        return { 
            range: [Math.max(2, rangeMax - 40), rangeMax], 
            attempts: 10, 
            check: level > 5 ? 'double' : (level > 3 ? 'single-double' : 'single'),
            switchTarget: 80,
            minPoints: 30 + (level * 2),
            malus: 5 + Math.floor(level / 2),
            roundsPerTarget: 3
        };
    }

    getCurrentCheckMode() {
        if (this.checkMode === 'single-double') {
            return (this.currentTarget >= this.switchTarget) ? 'double' : 'single';
        }
        return this.checkMode;
    }

    generateNewTarget() {
        const [min, max] = this.range;
        this.currentTarget = Math.floor(Math.random() * (max - min + 1)) + min;
        this.currentScore = this.currentTarget;
        this.roundsUsedForCurrentTarget = 0;
    }

    registerHit(val, mult) {
        if (this.isFinished || this.dartsInRound >= 3) return;

        const points = val * mult;
        const scoreBefore = this.currentScore;
        const scoreAfter = scoreBefore - points;
        const activeCheckMode = this.getCurrentCheckMode();

        let isBust = false;

        if (scoreAfter < 0) {
            isBust = true;
        } else if (scoreAfter === 0) {
            if (activeCheckMode === 'double' && mult !== 2 && val !== 25) isBust = true;
            if (activeCheckMode === 'double' && val === 25 && mult === 1) isBust = true;
        } else if (scoreAfter === 1 && activeCheckMode === 'double') {
            isBust = true;
        }

        const dart = { 
            base: val, mult: mult, points: points, 
            isBust: isBust, scoreBefore: scoreBefore 
        };

        this.currentRoundThrows.push(dart);
        this.dartsInRound++;
        this.stats.totalDarts++;
        if (mult === 2) this.stats.doubles++;
        if (mult === 3) this.stats.triples++;

        if (isBust) {
            this.currentScore = this.currentRoundThrows[0].scoreBefore;
            while(this.dartsInRound < 3) {
                this.currentRoundThrows.push({ base: 0, mult: 1, points: 0, isBust: true, scoreBefore: this.currentScore });
                this.dartsInRound++;
                this.stats.totalDarts++;
            }
        } else {
            this.currentScore = scoreAfter;
        }
    }

    nextRound() {
        while (this.currentRoundThrows.length < 3) {
            const scoreBefore = this.currentScore;
            this.currentRoundThrows.push({ base: 0, mult: 1, points: 0, isBust: false, scoreBefore: scoreBefore });
            this.dartsInRound++;
            this.stats.totalDarts++;
        }

        const isChecked = (this.currentScore === 0);
        this.saveHistory();

        if (isChecked) {
            this.points += 10;
            this.stats.hits++;
            this.stats.pointsCleared += this.currentTarget;
            this.stats.perfectDartsNeeded += Math.ceil(this.currentTarget / 30);
            this.prepareNextTarget();
        } else {
            this.roundsUsedForCurrentTarget++;
            if (this.roundsUsedForCurrentTarget >= this.maxRoundsPerTarget) {
                this.stats.misses++;
                if (!this.isTraining) this.points -= this.malusAmount;
                this.prepareNextTarget();
            } else {
                this.round++;
                this.dartsInRound = 0;
                this.currentRoundThrows = [];
            }
        }
    }

    prepareNextTarget() {
        this.attemptsLeft--;
        if (this.attemptsLeft <= 0) {
            this.isFinished = true;
        } else {
            this.generateNewTarget();
            this.round++;
            this.dartsInRound = 0;
            this.currentRoundThrows = [];
        }
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const last = this.currentRoundThrows.pop();
            this.dartsInRound--;
            this.stats.totalDarts--;
            if (last.mult === 2) this.stats.doubles--;
            if (last.mult === 3) this.stats.triples--;
            this.currentScore = last.scoreBefore;
            return;
        }

        if (this.history.length > 0) {
            const state = JSON.parse(this.history.pop());
            this.currentTarget = state.target;
            this.currentScore = state.score;
            this.points = state.points;
            this.attemptsLeft = state.attemptsLeft;
            this.round = state.round;
            this.roundsUsedForCurrentTarget = state.roundsUsed;
            this.stats = state.stats;
            this.currentRoundThrows = state.throws;
            this.dartsInRound = this.currentRoundThrows.length;
            this.isFinished = false;
        }
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            target: this.currentTarget,
            score: this.currentScore,
            points: this.points,
            attemptsLeft: this.attemptsLeft,
            round: this.round,
            roundsUsed: this.roundsUsedForCurrentTarget,
            stats: { ...this.stats },
            throws: [...this.currentRoundThrows]
        }));
    }

    getFinalStats() {
        let sr = 0;
        if (!this.isTraining) {
            const checkRate = this.stats.hits / (this.attemptsTotal || 1);
            const dartEfficiency = this.stats.perfectDartsNeeded / (this.stats.totalDarts || 1);
            
            // SR Formel: Check-Rate + Dart-Effizienz + Schwierigkeit der Zahlen
            sr = (checkRate * 100) + (dartEfficiency * 50) + (this.stats.doubles * 2);
            
            const pointRatio = this.minPointsRequired > 0 ? Math.max(0, this.points / this.minPointsRequired) : 1;
            sr *= pointRatio;
            sr = Math.min(180, Math.max(0, Math.floor(sr)));
        }

        let baseXP = 700 + (this.level * 20);
        let bonusXP = 0;
        const win = this.points >= this.minPointsRequired; 

        if (win) {
            bonusXP = baseXP * 0.5; 
            bonusXP += (this.stats.hits / (this.attemptsTotal || 1)) * (baseXP * 0.3); 
        } else {
            baseXP = 250;
        }

        let totalXP = baseXP + bonusXP;
        if (this.isTraining) totalXP *= 0.10;

        return {
            xp: Math.floor(totalXP),
            sr: sr,
            won: win,
            stats: {
                ...this.stats,
                finalPoints: this.points,
                finalScore: this.points,
                mode: this.isTraining ? "Checkout Training" : `Checkout Lvl ${this.level}`
            }
        };
    }
}