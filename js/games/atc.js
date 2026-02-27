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

        // --- LEVEL KONFIGURATION ---
        // regainBlitz/regainHerz: Wieviel man pro Hit zurückerhält (z.B. 1 oder 0.5)
        // startWert 0 deaktiviert das System für dieses Level komplett
        this.levelConfigs = {
            1:  { targets: [10,11,12,13,14,15,16,17,18,19,20], rounds: 35, startBlitz: 3, regainBlitz: 1, startHerz: 3, regainHerz: 1, minPoints: 45, hitsPerTarget: 1 },
            2:  { targets: [10,11,12,13,14,15,16,17,18,19,20], rounds: 32, startBlitz: 3, regainBlitz: 1, startHerz: 3, regainHerz: 1, minPoints: 70, hitsPerTarget: 1 },
            4:  { targets: [11,12,13,14,15,16,17,18,19,20], rounds: 30, startBlitz: 2, regainBlitz: 1, startHerz: 0, regainHerz: 0, minPoints: 145, hitsPerTarget: 2 },
            5:  { targets: [10,11,12,13,14,15,16,17,18,19,20], rounds: 30, startBlitz: 3, regainBlitz: 1, startHerz: 3, regainHerz: 1, minPoints: 145, hitsPerTarget: 1 },
            10: { targets: [10,11,12,13,14,15,16,17,18,19,20], rounds: 25, startBlitz: 3, regainBlitz: 1, startHerz: 2, regainHerz: 1, minPoints: 270, hitsPerTarget: 1 },
            15: { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25], rounds: 20, startBlitz: 2, regainBlitz: 0.5, startHerz: 1, regainHerz: 0.5, minPoints: 395, hitsPerTarget: 1 },
            20: { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25], rounds: 15, startBlitz: 1, regainBlitz: 0.5, startHerz: 1, regainHerz: 0, minPoints: 520, hitsPerTarget: 1 }
        }

        const configTemplate = this.levelConfigs[level] || this.levelConfigs[1];
        this.config = isTraining ? this.setupTraining(customSettings) : configTemplate;
        
        this.targets = [...this.config.targets];
        this.targetHitsNeeded = this.config.hitsPerTarget || 1; 
        this.currentHitsOnTarget = 0; 
        
        this.currentIndex = 0;
        this.round = 1;
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
                {
                    id: 'range',
                    label: 'Bereich',
                    type: 'select',
                    values: [
                        { label: '10 - 20', value: '10-20' },
                        { label: '1 - 20', value: '1-20' }
                    ]
                },
                {
                    id: 'hits',
                    label: 'Treffer pro Zahl',
                    type: 'select',
                    values: [
                        { label: '1', value: '1' },
                        { label: '2', value: '2' },
                        { label: '3', value: '3' }
                    ]
                },
                {
                    id: 'bull',
                    label: 'Inkl. Bull',
                    type: 'toggle',
                    default: false
                }
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
            if (isFirstDart) this.stats.firstDartHits = (this.stats.firstDartHits || 0) + 1;
            this.handleHit(multiplier);
        } else {
            this.handleMiss();
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
        
        // Regain Logik: Nur auffüllen, wenn das System aktiv ist (start > 0)
        if (this.config.startBlitz > 0) {
            this.bolts = Math.min(3, this.bolts + (this.config.regainBlitz || 1));
        }
        if (this.config.startHerz > 0) {
            this.lives = Math.min(3, this.lives + (this.config.regainHerz || 1));
        }

        if (this.currentHitsOnTarget >= this.targetHitsNeeded) this.moveToNextTarget();
    }

    handleMiss() {
        this.stats.misses++;
        this.stats.currentStreak = 0;

        // Blitz System (nur wenn startBlitz > 0)
        if (this.config.startBlitz > 0 && this.bolts > 0) {
            this.bolts--;
            if (this.bolts === 0 && !this.burnoutInCurrentRound) {
                this.triggerBurnout();
            }
            return; // Blitz schützt Herz
        } 
        
        // Herz System (nur wenn startHerz > 0)
        if (this.config.startHerz > 0) {
            if (this.lives > 0) {
                this.lives--;
                this.malusScore += 25;
                if (this.lives === 0 && !this.isTraining) this.isFinished = true;
            } else {
                this.malusScore += 50;
            }
        } else {
            // Fallback wenn weder Blitz noch Herz aktiv sind (einfacher Malus)
            this.malusScore += 10;
        }
    }

    triggerBurnout() {
        this.burnoutInCurrentRound = true;
        while (this.roundDarts.length < 3) {
            this.roundDarts.push(0);
            this.stats.totalDarts++;
            this.stats.misses++;
            this.stats.currentStreak = 0;
        }
        if (!this._isProcessingNextRound) {
            this.nextRound();
        }
    }

    moveToNextTarget() {
        this.currentHitsOnTarget = 0;
        this.currentIndex++;
        if (this.currentIndex >= this.targets.length) this.isFinished = true;
    }

    nextRound() {
        if (this.isFinished || this._isProcessingNextRound) return;
        this._isProcessingNextRound = true;

        while (this.roundDarts.length < 3 && !this.isFinished && !this.burnoutInCurrentRound) {
            this.registerThrow(0);
        }

        this._isProcessingNextRound = false;

        if (!this.isFinished) {
            // Limit-Check BEVOR hochgezählt wird
            if (this.round >= this.config.rounds) {
                this.isFinished = true;
            } else {
                this.round++; 
                if (this.burnoutInCurrentRound) this.round++; 
            }

            this.roundDarts = [];
            this.burnoutInCurrentRound = false; 
            this.roundStartIndex = this.currentIndex;
            this.roundStartHits = this.currentHitsOnTarget;

            // Failsafe Anzeige-Clamp
            if (this.round > this.config.rounds) {
                this.round = this.config.rounds;
                this.isFinished = true;
            }
        }
    }

    getFinalStats() {
        const netScore = this.points - this.malusScore;
        
    const won = netScore >= this.config.minPoints && this.currentIndex >= this.targets.length && this.round <= this.config.rounds;
        const hitRate = this.stats.hits / this.stats.totalDarts || 0;
        
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
                ...this.stats, finalScore: netScore, 
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