import { LevelSystem } from '../supabase_client.js';

/**
 * Game121 LevelMapper
 * Bestimmt das Spiellevel basierend auf dem Spieler-XP-Level
 */
export const Game121LevelMapper = (playerLevel) => {
    // 20 Level verfügbar, alle 5 XP-Level ein neues Spiellevel
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

export class Game121 {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "121";
        this.interfaceType = "finishing";
        this.srCategory = "finishing";
        this.isTraining = isTraining;
        this.level = level;

        // --- LEVEL CONFIGURATION (1-20) ---
        // 'single-double' bedeutet: Bis zu einer Zahl X Single Out, danach Double Out
        this.levelConfig = {
            1:  { start: 61,  rounds: 3, check: 'single', totalTargets: 5,  minPoints: 20, resetToStart: true,  malus: 5 },
            2:  { start: 61,  rounds: 3, check: 'double', totalTargets: 5,  minPoints: 25, resetToStart: true,  malus: 5 },
            3:  { start: 71,  rounds: 3, check: 'single', totalTargets: 6,  minPoints: 30, resetToStart: true,  malus: 5 },
            4:  { start: 71,  rounds: 3, check: 'double', totalTargets: 6,  minPoints: 35, resetToStart: true,  malus: 5 },
            5:  { start: 81,  rounds: 3, check: 'single-double', switchTarget: 82, totalTargets: 6,  minPoints: 35, resetToStart: true,  malus: 5 },
            // Beispiel für Hybrid-Modus: Bis 122 Single Out, ab 123 Double Out
            10: { start: 121, rounds: 9, check: 'single-double', switchTarget: 123, totalTargets: 7,  minPoints: 30, resetToStart: true,  malus: 6, minTargetToReach: 123 },
            20: { start: 121, rounds: 2, check: 'double', totalTargets: 10, minPoints: 60, resetToStart: true,  malus: 10, minTargetToReach: 125 }
        };

        const config = this._getEffectiveConfig(level, customSettings);
        
        this.startTarget = parseInt(config.startTarget || config.start);
        this.currentTarget = this.startTarget;
        this.currentScore = this.currentTarget;
        this.maxRoundsPerTarget = parseInt(config.roundsPerTarget || config.rounds);
        this.checkMode = config.checkMode || config.check; // Fallback für Training/Level
        this.switchTarget = config.switchTarget || 100; // Standardmäßig ab 100 Double Out bei Hybrid
        this.totalTargetsToPlay = parseInt(config.totalTargets);
        this.minPointsRequired = config.minPoints || 0;
        this.malusAmount = config.malus || 5;
        this.resetToStart = config.resetToStart ?? true;
        this.minTargetToReach = config.minTargetToReach || 0;

        this.points = 0;
        this.malusScore = 0;
        this.round = 1;
        this.roundDarts = 0; 
        this.roundsUsedForTarget = 0;
        this.targetsPlayed = 0;
        
        this.currentRoundThrows = [];
        this.roundHistory = [];
        this.isFinished = false;
        
        this.stats = { 
            checks: 0, 
            totalDarts: 0, 
            doubles: 0, 
            triples: 0, 
            t20FirstDart: 0, 
            t19FirstDart: 0,
            perfectDartsNeeded: 0 
        };
    }

    static getTrainingConfig() {
        return {
            gameId: 'game121',
            title: '121 Check Training',
            options: [
                {
                    id: 'startTarget',
                    label: 'Startzahl',
                    type: 'select',
                    values: [
                        { label: '61', value: '61' },
                        { label: '81', value: '81' },
                        { label: '121', value: '121' }
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
                    id: 'totalTargets',
                    label: 'Anzahl Zahlen',
                    type: 'select',
                    values: [
                        { label: '3', value: '3' },
                        { label: '5', value: '5' },
                        { label: '10', value: '10' },
                        { label: '20', value: '20' }
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
                    id: 'resetToStart',
                    label: 'Reset bei Fail',
                    type: 'toggle',
                    default: true
                }
            ]
        };
    }

    _getEffectiveConfig(level, custom) {
        if (custom) return custom;
        if (this.levelConfig[level]) return this.levelConfig[level];
        
        const base = this.levelConfig[1];
        if (level < 10) {
            return { ...base, start: 61 + (level * 5), totalTargets: 5 + Math.floor(level/5) };
        } else {
            return { ...this.levelConfig[10], rounds: Math.max(2, 10 - (level - 10)) };
        }
    }

    /**
     * Ermittelt den aktuell benötigten Checkout-Modus
     */
    getCurrentCheckMode() {
        if (this.checkMode === 'single-double') {
            return (this.currentTarget >= this.switchTarget) ? 'double' : 'single';
        }
        return this.checkMode;
    }

    registerHit(val, mult) {
        if (this.isFinished || this.roundDarts >= 3) return;

        if (mult === 2) this.stats.doubles++;
        if (mult === 3) this.stats.triples++;
        if (this.roundDarts === 0) {
            if (val === 20 && mult === 3) this.stats.t20FirstDart++;
            if (val === 19 && mult === 3) this.stats.t19FirstDart++;
        }

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

        const dart = { base: val, mult: mult, isBust: isBust, scoreBefore: scoreBefore };
        this.currentRoundThrows.push(dart);
        this.roundDarts++;
        this.stats.totalDarts++;

        if (isBust) {
            this.currentScore = this.getScoreAtStartOfRound();
            while(this.roundDarts < 3) {
                this.currentRoundThrows.push({ base: 0, mult: 1, isBust: true, scoreBefore: this.currentScore });
                this.roundDarts++;
                this.stats.totalDarts++;
            }
        } else {
            this.currentScore = scoreAfter;
            if (this.currentScore === 0) {
                this.targetChecked();
            }
        }
    }

    getScoreAtStartOfRound() {
        if (this.currentRoundThrows.length === 0) return this.currentScore;
        return this.currentRoundThrows[0].scoreBefore;
    }

    targetChecked() {
        this.points += 10;
        this.stats.checks++;
        this.targetsPlayed++;
        this.stats.perfectDartsNeeded += Math.ceil(this.currentTarget / 30);

        if (this.isTraining) {
            this.currentTarget += 1;
        } else {
            this.currentTarget += (this.level >= 10) ? 1 : 5;
        }

        this.roundsUsedForTarget = -1; 
        
        while(this.currentRoundThrows.length < 3) {
            this.currentRoundThrows.push({ base: 0, mult: 0, isDummy: true, scoreBefore: 0 });
        }

        if (this.targetsPlayed >= this.totalTargetsToPlay) {
            this.isFinished = true;
        }

        this.finishRound(true);
    }

    nextRound() {
        while (this.currentRoundThrows.length < 3) {
            this.registerHit(0, 1);
        }
        this.finishRound(false);
    }

    finishRound(checked) {
        this.roundsUsedForTarget++;
        this.saveToHistory();

        if (!checked && this.roundsUsedForTarget >= this.maxRoundsPerTarget) {
            this.handleFailedTarget();
        }

        if (!this.isFinished) {
            this.round++;
            this.roundDarts = 0;
            this.currentRoundThrows = [];
            if (checked || this.roundsUsedForTarget === 0) {
                this.currentScore = this.currentTarget;
            }
        }
    }

    handleFailedTarget() {
        if (!this.isTraining) this.points -= this.malusAmount;
        this.targetsPlayed++;

        if (this.resetToStart) {
            this.currentTarget = this.startTarget;
        }

        if (this.targetsPlayed >= this.totalTargetsToPlay) {
            this.isFinished = true;
        } else {
            this.roundsUsedForTarget = 0;
            this.currentScore = this.currentTarget; 
        }
    }

    saveToHistory() {
        this.roundHistory.push(JSON.stringify({
            score: this.currentScore,
            points: this.points,
            round: this.round,
            target: this.currentTarget,
            targetsPlayed: this.targetsPlayed,
            roundsUsed: this.roundsUsedForTarget,
            throws: [...this.currentRoundThrows],
            stats: {...this.stats}
        }));
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const lastDart = this.currentRoundThrows.pop();
            this.roundDarts--;
            this.stats.totalDarts--;
            
            if (lastDart.mult === 2) this.stats.doubles--;
            if (lastDart.mult === 3) this.stats.triples--;

            this.currentScore = lastDart.scoreBefore;
            return;
        }

        if (this.roundHistory.length > 0) {
            this.roundHistory.pop(); 
            const prevStateString = this.roundHistory[this.roundHistory.length - 1];
            
            if (prevStateString) {
                const state = JSON.parse(prevStateString);
                this.currentScore = state.score;
                this.points = state.points;
                this.round = state.round;
                this.currentTarget = state.target;
                this.targetsPlayed = state.targetsPlayed || 0;
                this.roundsUsedForTarget = state.roundsUsed;
                this.currentRoundThrows = state.throws;
                this.stats = state.stats;
                this.roundDarts = this.currentRoundThrows.filter(t => !t.isDummy).length;
            } else {
                this.resetToStartGame();
            }
            this.isFinished = false;
        }
    }

    resetToStartGame() {
        this.round = 1;
        this.currentScore = this.startTarget;
        this.currentTarget = this.startTarget;
        this.points = 0;
        this.targetsPlayed = 0;
        this.currentRoundThrows = [];
        this.roundDarts = 0;
        this.roundsUsedForTarget = 0;
    }

    getFinalStats() {
        let sr = 0;
        if (!this.isTraining) {
            const dartEfficiency = this.stats.perfectDartsNeeded / (this.stats.totalDarts || 1);
            sr = dartEfficiency * 100;
            sr += (this.stats.doubles * 2) + (this.stats.triples * 1);
            sr += (this.stats.t20FirstDart * 5) + (this.stats.t19FirstDart * 5);
            const pointsRatio = this.minPointsRequired > 0 ? Math.max(0, this.points / this.minPointsRequired) : 1;
            sr *= pointsRatio;
            sr = Math.min(180, Math.floor(sr));
        }

        let baseXP = 700 + (this.level * 20); 
        let bonusXP = 0;
        const win = this.points >= (this.minPointsRequired || 0);
        
        if (win) {
            bonusXP = baseXP * 0.5; 
            bonusXP += (this.stats.checks / (this.totalTargetsToPlay || 1)) * (baseXP * 0.3);
        } else {
            baseXP = 200; 
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
                mode: this.isTraining ? "121 Training" : `121 Level ${this.level}`
            }
        };
    }
}