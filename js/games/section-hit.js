import { LevelSystem } from '../supabase_client.js';

export const SectionHitLevelMapper = (playerLevel) => {
    if (playerLevel < 10) return 1;
    if (playerLevel < 20) return 2;
    if (playerLevel < 35) return 3;
    if (playerLevel < 50) return 4;
    if (playerLevel < 70) return 5;
    return 6;
};

export class SectionHit {
    static getTrainingConfig() {
        return {
            gameId: 'sectionhit',
            title: 'Section Hit Training',
            options: [
                { id: 'startHerz', label: 'Leben', type: 'number', default: 5, min: 0, max: 10 },
                { id: 'startBlitz', label: 'Blitze', type: 'number', default: 10, min: 0, max: 20 },
                { id: 'requiredHits', label: 'Treffer pro Zahl', type: 'number', default: 3, min: 1, max: 5 },
                { id: 'maxRounds', label: 'Rundenlimit', type: 'number', default: 30, min: 5, max: 99 }
            ]
        };
    }

    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "Section Hit";
        this.interfaceType = "board-control";
        this.srCategory = "boardcontrol";
        this.isTraining = isTraining;
        this.level = level;

        this.levelConfig = {
            1: { targets: [10,11,12,13,14,15], rounds: 20, startHerz: 3, startBlitz: 3, minPoints: 12, requiredHits: 3 },
            2: { targets: [10,11,12,13,14,15,16,17,18], rounds: 25, startHerz: 3, startBlitz: 3, minPoints: 27, requiredHits: 3 },
            3: { targets: [1,2,3,4,5,6,7,8,9,10,11,12], rounds: 30, startHerz: 2, startBlitz: 5, minPoints: 36, requiredHits: 3 },
            4: { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], rounds: 40, startHerz: 2, startBlitz: 4, minPoints: 45, requiredHits: 3 },
            5: { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], rounds: 45, startHerz: 1, startBlitz: 3, minPoints: 60, requiredHits: 3 },
            6: { targets: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25], rounds: 50, startHerz: 1, startBlitz: 2, minPoints: 70, requiredHits: 3 }
        };

        this.config = isTraining ? this.setupTraining(customSettings) : (this.levelConfig[level] || this.levelConfig[1]);

        this.round = 1;
        this.maxRounds = this.config.rounds;
        this.points = 0; 
        this.malusScore = 0;
        this.lives = this.config.startHerz;
        this.bolts = this.config.startBlitz;
        this.isFinished = false;
        this.roundDarts = [];
        this.history = [];
        
        this.targets = this.config.targets ? [...this.config.targets] : this.generateRandomTargets(100);
        this.currentIndex = 0;
        this.hitsOnTarget = 0; 
        this.REQUIRED_HITS = this.config.requiredHits || 3; 

        this.stats = {
            hits: 0, misses: 0, totalDarts: 0,
            singles: 0, doubles: 0, triples: 0,
            maxStreak: 0, currentStreak: 0,
            completedSections: 0,
            firstDartHits: 0
        };
    }

    setupTraining(s) {
        return { 
            rounds: s?.maxRounds ?? 99, 
            startHerz: s?.startHerz ?? 5, 
            startBlitz: s?.startBlitz ?? 10, 
            minPoints: 0,
            requiredHits: s?.requiredHits ?? 3
        };
    }

    generateRandomTargets(count) {
        const pool = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 25];
        return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
    }

    get currentTargetNumber() {
        if (this.isFinished || this.currentIndex >= this.targets.length) return undefined;
        return this.targets[this.currentIndex];
    }

    // FIX: Liefert eine vorausschauende Liste von Targets für die Board-Hervorhebung
    get currentTargets() {
        if (this.isFinished) return [];
        
        let displayTargets = [];
        let tempIndex = this.currentIndex;
        let tempHits = this.hitsOnTarget;

        // Wir füllen das Array auf, bis wir genug Ziele für 3 Darts haben
        while (displayTargets.length < 3 && tempIndex < this.targets.length) {
            const needed = this.REQUIRED_HITS - tempHits;
            const toAdd = Math.min(needed, 3 - displayTargets.length);
            
            for (let i = 0; i < toAdd; i++) {
                displayTargets.push(this.targets[tempIndex]);
            }
            
            tempIndex++;
            tempHits = 0; // Für das nächste Segment fangen wir bei 0 Hits an
        }
        return displayTargets;
    }

    get targetDisplay() {
        const targetNum = this.currentTargetNumber;
        if (targetNum === undefined) return "DONE";
        return targetNum === 25 ? "BULL" : targetNum.toString();
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

        if (this.hitsOnTarget >= this.REQUIRED_HITS) {
            this.stats.completedSections++;
            this.currentIndex++;
            this.hitsOnTarget = 0;
            
            if (this.currentIndex >= this.targets.length) {
                this.isFinished = true;
            }
        }
    }

    handleHit(multiplier) {
        this.stats.hits++;
        this.stats.currentStreak++;
        this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.currentStreak);
        
        this.points += multiplier;
        this.hitsOnTarget++;
        
        if (multiplier === 1) this.stats.singles++;
        if (multiplier === 2) this.stats.doubles++;
        if (multiplier === 3) this.stats.triples++;

        this.bolts = Math.min(this.isTraining ? 20 : 10, this.bolts + 1);
    }

    handleMiss() {
        this.stats.misses++;
        this.stats.currentStreak = 0;

        if (this.bolts > 0) {
            this.bolts--;
        } else if (this.lives > 0) {
            this.lives--;
            this.malusScore += 10; 
            if (this.lives === 0 && !this.isTraining) this.isFinished = true;
        } else {
            this.malusScore += 20; 
        }
    }

    nextRound() {
        if (this.isFinished) return;
        this.round++;
        this.roundDarts = [];
        if (this.round > this.maxRounds) this.isFinished = true;
    }

    getFinalStats() {
        const finalNetPoints = Math.max(0, this.points - this.malusScore);
        const allTargetsCleared = this.currentIndex >= this.targets.length;
        const won = allTargetsCleared && finalNetPoints >= this.config.minPoints && this.round <= this.maxRounds;

        if (this.isTraining) {
            return {
                xp: Math.floor(this.stats.hits * 4),
                sr: 0, won: true,
                stats: { ...this.stats, finalScore: finalNetPoints, mode: "Section Hit Training" }
            };
        }

        let baseXP = won ? (700 + (this.level * 50)) : 100;
        const streakBonus = this.stats.maxStreak * 25; 
        const precisionBonus = (this.stats.triples * 50) + (this.stats.doubles * 25);
        const firstDartBonus = this.stats.firstDartHits * 15;

        let totalXP = Math.max(100, baseXP + streakBonus + precisionBonus + firstDartBonus - (this.malusScore * 5));

        let sr = 0;
        if (won) {
            const hitRate = this.stats.hits / (this.stats.totalDarts || 1);
            const speedFactor = Math.max(0, (this.maxRounds - this.round) / this.maxRounds);
            sr = Math.min(180, Math.floor(100 + (hitRate * 50) + (speedFactor * 30)));
        }

        return {
            xp: Math.floor(totalXP),
            sr: sr,
            won: won,
            stats: {
                ...this.stats,
                points: this.points,
                malus: this.malusScore,
                finalScore: finalNetPoints,
                completed: `${this.currentIndex}/${this.targets.length}`,
                mode: `Section Hit Lvl ${this.level}`
            }
        };
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points, malusScore: this.malusScore, 
            lives: this.lives, bolts: this.bolts,
            currentIndex: this.currentIndex, round: this.round,
            hitsOnTarget: this.hitsOnTarget, 
            stats: { ...this.stats }, roundDarts: [...this.roundDarts]
        }));
    }

    undo() {
        if (this.history.length === 0) return;
        Object.assign(this, JSON.parse(this.history.pop()));
    }
}