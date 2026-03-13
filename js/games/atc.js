import { LevelSystem } from '../supabase_client.js';

export const ATCLevelMapper = (playerLevel) => {
    if (playerLevel < 5) return 1;
    if (playerLevel < 10) return 2;
    if (playerLevel < 15) return 3;
    if (playerLevel < 20) return 4;
    if (playerLevel < 25) return 5;
    if (playerLevel < 30) return 6;
    if (playerLevel < 35) return 7;
    if (playerLevel < 40) return 8;
    if (playerLevel < 45) return 9;
    if (playerLevel < 50) return 10;
    if (playerLevel < 55) return 11;
    if (playerLevel < 60) return 12;
    if (playerLevel < 65) return 13;
    if (playerLevel < 70) return 14;
    if (playerLevel < 75) return 15;
    if (playerLevel < 80) return 16;
    if (playerLevel < 85) return 17;
    if (playerLevel < 90) return 18;
    if (playerLevel < 95) return 19;
    return 20;
};

export class AroundTheClock {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "Around The Clock";
        this.interfaceType = "board-control";
        this.srCategory = "boardcontrol";
        this.isTraining = isTraining;
        this.level = level;

        this.levelConfigs = {
            1:  { targets: [1,3,5,7,9,11,13,15,17,19], rounds: 25, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 20, hitsPerTarget: 1,  missPenalty: 1 },
            2:  { targets: [2,4,6,8,10,12,14,16,18,20], rounds: 25, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 20, hitsPerTarget: 1, missPenalty: 1 },
            3:  { targets: [1,2,3,4,5,6,7,8,9,10], rounds: 25, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 19, hitsPerTarget: 1, missPenalty: 1 },
            4:  { targets: [10,11,12,13,14,15,16,17,18,19,20], rounds: 25, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 85, hitsPerTarget: 1, missPenalty: 1 },
            5:  { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], rounds: 45, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 105, hitsPerTarget: 1 },
            6:  { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], rounds: 40, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 135, hitsPerTarget: 1 },
            7:  { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], rounds: 35, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 170, hitsPerTarget: 1 },
            8:  { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], rounds: 30, startBlitz: 0, regainBlitz: 0, startHerz: 1, regainHerz: 0.5, minPoints: 210, hitsPerTarget: 1 },
            9:  { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], rounds: 25, startBlitz: 0, regainBlitz: 0, startHerz: 0, regainHerz: 0, minPoints: 250, hitsPerTarget: 1 },
            10: { targets: [10,11,12,13,14,15,16,17,18,19,20], rounds: 25, startBlitz: 3, regainBlitz: 1, startHerz: 2, regainHerz: 1, minPoints: 270, hitsPerTarget: 1 },
            15: { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25], rounds: 20, startBlitz: 2, regainBlitz: 0.5, startHerz: 1, regainHerz: 0.5, minPoints: 395, hitsPerTarget: 1 },
            20: { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25], rounds: 15, startBlitz: 1, regainBlitz: 0.5, startHerz: 1, regainHerz: 0, minPoints: 520, hitsPerTarget: 1 }
        }

        const configTemplate = this.levelConfigs[level] || this.levelConfigs[1];
        this.config = isTraining ? this.setupTraining(customSettings) : configTemplate;
        
        this.targets = [...this.config.targets];
        this.targetHitsNeeded = this.config.hitsPerTarget || 1; 
        
        this.currentIndex = 0;
        this.currentHitsOnTarget = 0; 
        this.round = 1;
        this.maxRounds = this.config.rounds; // Korrekt zugewiesen
        this.points = 0;
        this.malusScore = 0;
        this.bolts = this.config.startBlitz || 0;
        this.lives = this.config.startHerz || 0;
        this.isFinished = false;
        this.roundDarts = [];
        this.history = [];

        this.roundStartIndex = 0;
        this.roundStartHits = 0;
        this.burnoutInCurrentRound = false;
        this._isProcessingNextRound = false;
        
        this.stats = {
            misses: 0, hits: 0, totalDarts: 0,
            singles: 0, doubles: 0, triples: 0,
            currentStreak: 0, maxStreak: 0,
            firstDartHits: 0
        };
    }

    static getTrainingConfig() {
        return {
            gameId: 'atc',
            title: 'ATC Training',
            options: [
                { id: 'range', label: 'Bereich', type: 'select', values: [ { label: '10 - 20', value: '10-20' }, { label: '1 - 20', value: '1-20' } ] },
                { id: 'hits', label: 'Treffer pro Zahl', type: 'select', values: [ { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' } ] },
                { id: 'bull', label: 'Inkl. Bull', type: 'toggle', default: false }
            ]
        };
    }

    setupTraining(s) {
        let targets = [];
        const start = s && s.range === "10-20" ? 10 : 1;
        for (let i = start; i <= 20; i++) targets.push(i);
        if (s && s.bull) targets.push(25);
        return {
            name: "Training", rounds: 999, targets: targets,
            hitsPerTarget: parseInt(s?.hits) || 1, 
            startBlitz: 3, regainBlitz: 1, 
            startHerz: 3, regainHerz: 1, 
            minPoints: 0
        };
    }

    get currentTargets() {
        const result = [];
        let tempIndex = this.roundStartIndex;
        let tempHits = this.roundStartHits;
        for (let i = 0; i < 3; i++) {
            if (tempIndex < this.targets.length) result.push(this.targets[tempIndex]);
            if (i < this.roundDarts.length) {
                if (this.roundDarts[i] > 0) {
                    tempHits++;
                    if (tempHits >= (this.targetHitsNeeded || 1)) { tempIndex++; tempHits = 0; }
                }
            } else {
                tempHits++;
                if (tempHits >= (this.targetHitsNeeded || 1)) { tempIndex++; tempHits = 0; }
            }
        }
        return result;
    }

    get currentTargetNumber() { return this.targets[this.currentIndex]; }

    registerThrow(multiplier) {
        if (this.isFinished || this.roundDarts.length >= 3) return;
        this.saveHistory();

        const isFirstDart = this.roundDarts.length === 0;
        this.stats.totalDarts++;
        this.roundDarts.push(multiplier);

        if (multiplier > 0) {
            if (isFirstDart) this.stats.firstDartHits++;
            this.handleHit(multiplier);
        } else {
            this.handleMiss();
        }

        if (this.currentIndex >= this.targets.length) {
            this.isFinished = true;
        }
    }

    handleHit(multiplier) {
        this.stats.hits++;
        this.stats.currentStreak++;
        this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.currentStreak);
        this.points += (this.currentTargetNumber * multiplier);
        this.currentHitsOnTarget++;
        
        if (multiplier === 1) this.stats.singles++;
        if (multiplier === 2) this.stats.doubles++;
        if (multiplier === 3) this.stats.triples++;
        
        if (this.config.startBlitz > 0) {
            this.bolts = Math.min(3, this.bolts + (this.config.regainBlitz || 1));
        }
        if (this.config.startHerz > 0) {
            this.lives = Math.min(3, this.lives + (this.config.regainHerz || 1));
        }

        if (this.currentHitsOnTarget >= this.targetHitsNeeded) {
            this.currentIndex++;
            this.currentHitsOnTarget = 0;
        }
    }

    handleMiss() {
    this.stats.misses++;
    this.stats.currentStreak = 0;
    
    // Dynamischer Malus aus der Config oder Fallback auf 10
    const penalty = this.config.missPenalty || 10;

    if (this.config.startBlitz > 0 && this.bolts > 0) {
        this.bolts--;
        if (this.bolts === 0 && !this.burnoutInCurrentRound) {
            this.triggerBurnout();
        }
        return;
    } 
    
    if (this.config.startHerz > 0) {
        if (this.lives > 0) {
            this.lives--;
            this.malusScore += 25; // Herz-Verlust Malus bleibt bei 25 (hartcodiert wie gewünscht)
            if (this.lives === 0 && !this.isTraining) this.isFinished = true;
        } else {
            this.malusScore += 50;
        }
    } else {
        this.malusScore += penalty; // Hier greift der konfigurierte Malus
    }
}

    triggerBurnout() {
        this.burnoutInCurrentRound = true;
        this.malusScore += 10; // Strafpunkte für Burnout
        while (this.roundDarts.length < 3) {
            this.roundDarts.push(0);
            this.stats.totalDarts++;
            this.stats.misses++;
        }
        if (!this._isProcessingNextRound) {
            this.nextRound();
        }
    }

    nextRound() {
        if (this.isFinished || this._isProcessingNextRound) return;
        this._isProcessingNextRound = true;

        // Auffüllen falls nötig
        while (this.roundDarts.length < 3 && !this.isFinished) {
            this.registerThrow(0);
        }

        if (!this.isFinished) {
            if (this.round >= this.maxRounds) {
                this.isFinished = true;
            } else {
                this.round++;
                // Bei Burnout eine zusätzliche Strafrunde überspringen
                if (this.burnoutInCurrentRound) this.round++;
            }

            this.roundDarts = [];
            this.burnoutInCurrentRound = false;
            this.roundStartIndex = this.currentIndex;
            this.roundStartHits = this.currentHitsOnTarget;

            if (this.round > this.maxRounds) {
                this.round = this.maxRounds;
                this.isFinished = true;
            }
        }
        this._isProcessingNextRound = false;
    }

    getFinalStats() {
        const netScore = Math.max(0, this.points - this.malusScore);
        const won = (this.currentIndex >= this.targets.length) && (netScore >= (this.config.minPoints || 0)) && (this.round <= this.maxRounds);
        const hitRate = this.stats.hits / (this.stats.totalDarts || 1);
        
        const pointEfficiency = Math.min(1, this.points / 1000); 
        const rawSR = (hitRate * 150) + (pointEfficiency * 30) + (this.level * 2);
        const finalSR = this.isTraining ? 0 : Math.min(180, Math.floor(rawSR));

        let baseXP = won ? (780 + (this.level * 21)) : 100;
        const totalXP = baseXP + (this.stats.maxStreak * 12) + (this.stats.triples * 20) + (hitRate * 250);
        
        return {
            xp: Math.floor(this.isTraining ? totalXP * 0.1 : totalXP),
            sr: finalSR,
            won: won,
            stats: { 
                ...this.stats, 
                points: this.points,
                malus: this.malusScore,
                finalScore: netScore, 
                hitRate: (hitRate * 100).toFixed(1) + "%",
                mode: this.isTraining ? "ATC Training" : `ATC Level ${this.level}`
            }
        };
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points, malusScore: this.malusScore, bolts: this.bolts,
            lives: this.lives, round: this.round, currentIndex: this.currentIndex,
            currentHitsOnTarget: this.currentHitsOnTarget, stats: {...this.stats},
            roundDarts: [...this.roundDarts], isFinished: this.isFinished,
            roundStartIndex: this.roundStartIndex, roundStartHits: this.roundStartHits,
            burnoutInCurrentRound: this.burnoutInCurrentRound
        }));
    }

    undo() {
        if (this.history.length === 0) return;
        const s = JSON.parse(this.history.pop());
        Object.assign(this, s);
    }
}