import { LevelSystem } from '../supabase_client.js';

export const ShanghaiLevelMapper = (playerLevel) => {
    if (playerLevel < 5) return 1;
    if (playerLevel < 10) return 2;
    if (playerLevel < 15) return 3;
    if (playerLevel < 20) return 4;
    if (playerLevel < 30) return 5;
    if (playerLevel < 40) return 6;
    if (playerLevel < 50) return 7;
    if (playerLevel < 60) return 8;
    if (playerLevel < 70) return 9;
    if (playerLevel < 80) return 10;
    if (playerLevel < 85) return 11;
    if (playerLevel < 90) return 12;
    return 13;
};

export class Shanghai {
    static getTrainingConfig() {
        return {
            gameId: 'shanghai',
            title: 'Shanghai Training',
            options: [
                { id: 'combo', label: 'Ziel-Set', type: 'select', values: [ { label: '15 bis Bull', value: '15-B' }, { label: 'Großes Feld (1-Bull)', value: '1-B' } ] },
                { id: 'shanghaiOut', label: 'Shanghai-Sieg (S+D+T)', type: 'toggle', default: false }
            ]
        };
    }

    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "Shanghai";
        this.interfaceType = "board-control";
        this.srCategory = "boardcontrol";
        this.isTraining = isTraining;
        this.level = level;

        this.levelConfig = {
            1: { rounds: 5, targets: [15,16,17,18,19,20], startBlitz: 0, startHerz: 0, bM: 0, bH: 0, minPoints: 30 },
<<<<<<< HEAD
            2: { rounds: 5, targets: [15,16,17,18,19,20], startBlitz: 0, startHerz: 0, bM: 0, bH: 0, minPoints: 45 },
=======
            2: { rounds: 5, targets: [15,16,17,18,19,20], startBlitz: 0, startHerz: 0, bM: 0, bH: 0, minPoints: 50 },
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
            3: { rounds: 5, targets: [13,14,15,16,17,18,19,20], startBlitz: 0, startHerz: 0, bM: 0, bH: 0, minPoints: 65 },
            4: { rounds: 8,  targets: [13,14,15,16,17,18,19,20], startBlitz: 0, startHerz: 0, bM: 0, bH: 0, minPoints: 85 },
            5: { rounds: 9, targets: [13,14,15,16,17,18,19,20,25], startBlitz: 0, startHerz: 0, bM: 0, bH: 0, minPoints: 110 },
            6: { rounds: 27, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 3, startHerz: 0, bM: 2, bH: 2, minPoints: 360 },
            7: { rounds: 24, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 3, startHerz: 0, bM: 3, bH: 3, minPoints: 400 },
            8: { rounds: 22, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 3, startHerz: 0, bM: 3, bH: 3, minPoints: 450 },
            9: { rounds: 15, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 0, startHerz: 3, hM: 1, hH: 1, minPoints: 450 },
            10:{ rounds: 15, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 0, startHerz: 3, hM: 1, hH: 1, minPoints: 475 },
            11:{ rounds: 15, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 0, startHerz: 3, hM: 1, hH: 1, minPoints: 500 },
            12:{ rounds: 15, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 0, startHerz: 3, hM: 2, hH: 2, minPoints: 550 },
            13:{ rounds: 15, targets: [12,13,14,15,16,17,18,19,20,25], startBlitz: 0, startHerz: 3, hM: 3, hH: 3, minPoints: 575 },
            'daily': { rounds: 8, targets: [20,20,20,20,20,20,20,20], startBlitz: 0, startHerz: 0, bM: 0, bH: 0, minPoints: 100 } 
        };

        this.config = isTraining ? this.setupTraining(customSettings) : this.levelConfig[level];
        this.targets = this.config.targets;
        this.currentIndex = 0;
        this.round = 1;
        this.maxRounds = this.config.rounds; // <--- Diese Zeile hinzufügen
        this.points = 0;
        this.malusScore = 0;
        this.bolts = (this.config.startBlitz !== undefined) ? this.config.startBlitz : 0;
        this.lives = (this.config.startHerz !== undefined) ? this.config.startHerz : 0;
        this.isFinished = false;
        this.roundDarts = [];
        this.history = [];
        
        this.burnoutInCurrentRound = false;
        this._isProcessingNextRound = false;

        this.stats = {
            misses: 0, hits: 0, totalDarts: 0,
            singles: 0, doubles: 0, triples: 0,
            firstDartHits: 0, thirdDartHits: 0,
            currentStreak: 0, maxStreak: 0
        };
    }

 get currentTargets() {
    const t = this.currentTargetNumber;
    if (t === undefined) return [];
    
    // Gibt das Ziel 3-mal zurück. Der Controller greift jetzt auf die neuen 
    // CSS-Klassen zu und lässt das Feld in 3 Farben abwechselnd blinken!
    return [t, t, t];
}
    
renderDisplayStats() {}

get currentTargetNumber() { 
    // Nutzt den bereits vorhandenen Index aus der Shanghai-Logik
    return this.targets[this.currentIndex]; 
}
    

    setupTraining(settings) {
        const targets = (settings && settings.combo === "12-B") ? [12,13,14,15,16,17,18,19,20,25] : [15,16,17,18,19,20];
        return {
            name: "Training", rounds: 99, targets: targets, shanghaiOut: settings ? settings.shanghaiOut : false,
            startBlitz: 3, startHerz: 3, bM: 0, bH: 1, minPoints: 0
        };
    }

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
        
        if (this.config.shanghaiOut && multiplier > 0 && this.roundDarts.length === 3) {
            const hasS = this.roundDarts.includes(1), hasD = this.roundDarts.includes(2), hasT = this.roundDarts.includes(3);
            if (hasS && hasD && hasT) this.isFinished = true;
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
        if (this.roundDarts.length === 3) this.stats.thirdDartHits++;
        if (multiplier === 1) this.stats.singles++;
        if (multiplier === 2) this.stats.doubles++;
        if (multiplier === 3) this.stats.triples++;

        if (this.config.startBlitz > 0) this.bolts = Math.min(3, this.bolts + (this.config.bH || 0));
        if (this.config.startHerz > 0) this.lives = Math.min(3, this.lives + (this.config.hH || 0));
    }

    handleMiss() {
        this.stats.misses++;
        this.stats.currentStreak = 0;

        if (this.bolts > 0) {
            this.bolts = Math.max(0, this.bolts - (this.config.bM || 1));
            if (this.bolts === 0 && this.config.startBlitz > 0 && !this.burnoutInCurrentRound) {
                this.triggerBurnout();
            }
        } else if (this.lives > 0) {
            this.lives = Math.max(0, this.lives - (this.config.hM || 1));
            if (this.lives === 0 && !this.isTraining) this.isFinished = true;
        } else {
            this.malusScore += 5;
        }
    }

    triggerBurnout() {
        this.burnoutInCurrentRound = true;
        this.malusScore += 10;
        
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

        while (this.roundDarts.length < 3 && !this.isFinished) {
            this.registerThrow(0);
        }

        if (!this.isFinished) {
            // Check gegen Rundenlimit (1-7 oder 1-20 etc.)
            if (this.round >= this.config.rounds) {
                this.isFinished = true;
            } else {
                this.round++;
                this.currentIndex++;
            }
            this.roundDarts = [];
            
            if (this.currentIndex >= this.targets.length) {
                this.isFinished = true;
            }
        }
        this._isProcessingNextRound = false;
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points, malusScore: this.malusScore, bolts: this.bolts,
            lives: this.lives, stats: { ...this.stats }, roundDarts: [...this.roundDarts],
            currentIndex: this.currentIndex, round: this.round, isFinished: this.isFinished,
            burnoutInCurrentRound: this.burnoutInCurrentRound
        }));
    }

    undo() {
        if (this.history.length === 0) return;
        Object.assign(this, JSON.parse(this.history.pop()));
    }

    calculateMaxPoints() {
        return this.targets.reduce((acc, val) => acc + (val === 25 ? 75 : val * 9), 0);
    }

    getFinalStats() {
    const finalScore = this.points - this.malusScore;
    const hasWon = (finalScore >= this.config.minPoints && this.round <= this.config.rounds) || (this.config.shanghaiOut && this.isFinished);
    const hitRate = this.stats.hits / (this.stats.totalDarts || 1);
    const maxPoints = this.calculateMaxPoints();

    // 1. SR BERECHNUNG (Immer definieren, damit kein ReferenceError entsteht)
    const pointEfficiency = Math.min(1, finalScore / maxPoints); 
    const rawSR = (hitRate * 150) + (pointEfficiency * 30) + (this.level * 2);
    const finalSR = (this.isTraining || !hasWon) ? 0 : Math.min(180, Math.floor(rawSR));

    // 2. XP BERECHNUNG
        let baseXP = hasWon ? (700 + (this.level * 25)) : 100;
        let bonusXP = (this.stats.firstDartHits * 20) + (this.stats.thirdDartHits * 40) + (this.stats.doubles * 15) + (this.stats.triples * 30);
        if (this.stats.maxStreak >= 12) bonusXP += 400;
        else if (this.stats.maxStreak >= 8) bonusXP += 150;
        else if (this.stats.maxStreak >= 4) bonusXP += 50;

        if (this.isTraining) { baseXP = 100; bonusXP *= 0.1; }

// 3. RETURN (Nutzt jetzt die sicher definierte finalSR)
    return {
        xp: Math.floor(baseXP + bonusXP),
        sr: finalSR, 
        won: hasWon,
        stats: {
            ...this.stats,
            finalScore: finalScore,
            hitRate: (hitRate * 100).toFixed(1) + "%",
            mode: this.isTraining ? "Shanghai Training" : `Shanghai Level ${this.level}`
        }
    };
}
}