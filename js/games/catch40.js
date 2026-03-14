import { LevelSystem } from '../supabase_client.js';

/**
 * Catch40 LevelMapper
 */
export const Catch40LevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

export class Catch40 {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "Catch 40";
        this.interfaceType = "finishing";
        this.srCategory = "finishing";
        this.isTraining = isTraining;
        this.level = level;

        // --- LEVEL CONFIGURATION (1-20) ---
        this.levelConfig = {
<<<<<<< HEAD
            1:  { start: 50, end: 55, step: 1, rounds: 2, totalTargets: 5, check: 'single', minPoints: 10, malus: 0 },
            5:  { start: 55, end: 60, step: 1, rounds: 2, totalTargets: 6, check: 'single', minPoints: 25, malus: 0 },
            // Beispiel für "Immer auf der 50 bleiben" für 10 Wiederholungen:
            'daily':  { start: 50, end: 50, step: 0, rounds: 2, totalTargets: 7, check: 'single', minPoints: 15, malus: 0 },
            10: { start: 61, end: 71, step: 1, rounds: 2, totalTargets: 26, check: 'double', minPoints: 30, malus: 0 },
            20: { start: 61, end: 101, step: 1, rounds: 2, totalTargets: 51, check: 'double', minPoints: 60, malus: 0 }
=======
            1:  { start: 50, end: 60, step: 1, rounds: 2, totalTargets: 11, check: 'single', minPoints: 10, malus: 0 },
            5:  { start: 50, end: 70, step: 1, rounds: 2, totalTargets: 21, check: 'single', minPoints: 25, malus: 0 },
            // Beispiel für "Immer auf der 50 bleiben" für 10 Wiederholungen:
            'daily':  { start: 50, end: 50, step: 0, rounds: 2, totalTargets: 7, check: 'single', minPoints: 15, malus: 0 },
            10: { start: 50, end: 100, step: 2, rounds: 2, totalTargets: 26, check: 'double', minPoints: 30, malus: 0 },
            20: { start: 50, end: 100, step: 1, rounds: 2, totalTargets: 51, check: 'double', minPoints: 60, malus: 0 }
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        };

        const config = this._getEffectiveConfig(level, customSettings);
        
        this.startTarget = parseInt(config.startTarget || config.start);
        this.endTarget = parseInt(config.endTarget || config.end || 100);
        this.step = parseInt(config.step !== undefined ? config.step : 1);
        this.maxRoundsPerTarget = parseInt(config.roundsPerTarget || config.rounds || 2);
        this.checkMode = config.checkMode || config.check || 'double';
        this.totalTargetsToPlay = parseInt(config.totalTargets);
        this.minPointsRequired = config.minPoints || 0;

        this.currentTarget = this.startTarget;
        this.currentScore = this.currentTarget;
        this.points = 0;
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
            perfectDartsNeeded: 0 
        };
    }

    static getTrainingConfig() {
        return {
            gameId: 'catch40',
            title: 'Catch 40 Training',
            options: [
                {
                    id: 'startTarget',
                    label: 'Startzahl',
                    type: 'select',
                    values: [
                        { label: '50', value: '50' },
                        { label: '61', value: '61' },
                        { label: '70', value: '70' },
                        { label: '80', value: '80' },
                        { label: '90', value: '90' }
                    ]
                },
                {
                    id: 'endTarget',
                    label: 'Endzahl (Ignoriert bei Schritt 0)',
                    type: 'select',
                    values: [
                        { label: '60', value: '60' },
                        { label: '70', value: '70' },
                        { label: '80', value: '80' },
                        { label: '90', value: '90' },
                        { label: '100', value: '100' }
                    ]
                },
                {
                    id: 'step',
                    label: 'Schrittweite',
                    type: 'select',
                    values: [
                        { label: 'Bleiben (+0)', value: '0' },
                        { label: 'Normal (+1)', value: '1' },
                        { label: 'Sprünge (+2)', value: '2' },
                        { label: 'Groß (+5)', value: '5' }
                    ]
                },
                {
                    id: 'totalTargets',
                    label: 'Anzahl Zahlen/Runden',
                    type: 'select',
                    values: [
                        { label: '5', value: '5' },
                        { label: '10', value: '10' },
                        { label: '20', value: '20' },
                        { label: '40', value: '40' }
                    ]
                },
                {
                    id: 'checkMode',
                    label: 'Checkout',
                    type: 'select',
                    values: [
                        { label: 'Double Out', value: 'double' },
                        { label: 'Single Out', value: 'single' }
                    ]
                },
                {
                    id: 'roundsPerTarget',
                    label: 'Darts pro Zahl',
                    type: 'select',
                    values: [
                        { label: '3 Darts (1 Aufnahme)', value: '1' },
                        { label: '6 Darts (2 Aufnahmen)', value: '2' },
                        { label: '9 Darts (3 Aufnahmen)', value: '3' }
                    ]
                }
            ]
        };
    }

    _getEffectiveConfig(level, custom) {
        if (custom) {
            // Wenn Schrittweite 0 ist, nutzen wir direkt die gewählte Anzahl an Targets
            const st = parseInt(custom.step);
            if (st === 0) {
                custom.totalTargets = parseInt(custom.totalTargets || 10);
            } else {
                const s = parseInt(custom.startTarget);
                const e = parseInt(custom.endTarget);
                custom.totalTargets = Math.floor((e - s) / st) + 1;
            }
            return custom;
        }
        if (this.levelConfig[level]) return this.levelConfig[level];
        
        const base = this.levelConfig[1];
        return { 
            ...base, 
            end: Math.min(100, 60 + (level * 2)), 
            totalTargets: Math.floor((60 + (level * 2) - 50) / 1) + 1 
        };
    }

    getCurrentCheckMode() {
        return this.checkMode;
    }

    registerHit(val, mult) {
        if (this.isFinished || this.roundDarts >= 3) return;

        if (mult === 2) this.stats.doubles++;
        if (mult === 3) this.stats.triples++;

        const points = val * mult;
        const scoreBefore = this.currentScore;
        const scoreAfter = scoreBefore - points;

        let isBust = false;
        if (scoreAfter < 0) isBust = true;
        else if (scoreAfter === 0) {
            if (this.checkMode === 'double' && mult !== 2 && val !== 25) isBust = true;
        } else if (scoreAfter === 1 && this.checkMode === 'double') isBust = true;

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
            if (this.currentScore === 0) this.targetChecked();
        }
    }

    getScoreAtStartOfRound() {
        return this.currentRoundThrows.length > 0 ? this.currentRoundThrows[0].scoreBefore : this.currentScore;
    }

    targetChecked() {
        const totalDartsUsed = (this.roundsUsedForTarget * 3) + this.roundDarts;
        
        if (totalDartsUsed === 1) this.points += 4;
        else if (totalDartsUsed === 2) this.points += 3;
        else if (totalDartsUsed === 3) this.points += 2;
        else if (totalDartsUsed <= 6) this.points += 1;

        this.stats.checks++;
        this.targetsPlayed++;
        this.stats.perfectDartsNeeded += Math.ceil(this.currentTarget / 30);

        // Nächste Zahl (bleibt gleich wenn step = 0)
        this.currentTarget += this.step;
        this.roundsUsedForTarget = -1; 
        
        while(this.currentRoundThrows.length < 3) {
            this.currentRoundThrows.push({ base: 0, mult: 0, isDummy: true, scoreBefore: 0 });
        }

        if (this.targetsPlayed >= this.totalTargetsToPlay || (this.step > 0 && this.currentTarget > this.endTarget)) {
            this.isFinished = true;
        }

        this.finishRound(true);
    }

    nextRound() {
        while (this.currentRoundThrows.length < 3) this.registerHit(0, 1);
        this.finishRound(false);
    }

    // ... (innerhalb von finishRound)
    finishRound(checked) {
        this.roundsUsedForTarget++;
        this.saveToHistory();

        let targetChanged = false; // Flag um zu prüfen, ob wir zur nächsten Zahl springen

        if (checked) {
            targetChanged = true;
        } else if (this.roundsUsedForTarget >= this.maxRoundsPerTarget) {
            this.targetsPlayed++;
            this.currentTarget += this.step;
            this.roundsUsedForTarget = 0;
            targetChanged = true;
        }

        if (this.targetsPlayed >= this.totalTargetsToPlay || (this.step > 0 && this.currentTarget > this.endTarget)) {
            this.isFinished = true;
        }

        if (!this.isFinished) {
            this.round++;
            this.roundDarts = 0;
            this.currentRoundThrows = [];
            // FIX: Nur zurücksetzen, wenn die Zahl gewechselt hat. 
            // Sonst bleibt der aktuelle currentScore für die nächste Runde erhalten.
            if (targetChanged) {
                this.currentScore = this.currentTarget;
            }
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
                this.targetsPlayed = state.targetsPlayed;
                this.roundsUsedForTarget = state.roundsUsed;
                this.currentRoundThrows = state.throws;
                this.stats = state.stats;
                this.roundDarts = this.currentRoundThrows.filter(t => !t.isDummy).length;
            } else {
                this.currentTarget = this.startTarget;
                this.currentScore = this.startTarget;
                this.points = 0;
                this.targetsPlayed = 0;
            }
            this.isFinished = false;
        }
    }

    getFinalStats() {
        let sr = 0;
        if (!this.isTraining) {
            const checkRate = this.stats.checks / (this.totalTargetsToPlay || 1);
            sr = (checkRate * 100) + (this.points * 0.5); 
            sr = Math.min(180, Math.floor(sr));
        }

        let baseXP = 700 + (this.level * 20);
        const win = this.points >= (this.minPointsRequired || 0);
        let totalXP = win ? baseXP * 1.5 : 250;
        if (this.isTraining) totalXP *= 0.1;

        return {
            xp: Math.floor(totalXP),
            sr: sr,
            won: win,
            stats: { ...this.stats, finalPoints: this.points, mode: `Catch 40 Lvl ${this.level}` }
        };
    }
}