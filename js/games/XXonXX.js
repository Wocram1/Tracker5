import { LevelSystem } from '../supabase_client.js';

/**
 * XXonXX LevelMapper (1-20)
 */
export const XXonXXLevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

/**
 * LEVEL CONFIGURATION TABLE
 */
const LEVEL_CONFIG = {
<<<<<<< HEAD
    1:  { rounds: 6,  minPoints: 35,  malus: 1, targets: [{v:20, m:0}, {v:20, m:0}, {v:20, m:0}], pointsPerHit: 1, xpBase: 315 },
    2:  { 
        rounds: 7,  
=======
    1:  { rounds: 6,  minPoints: 35,  malus: 1, targets: [{v:20, m:1}, {v:19, m:1}, {v:18, m:1}], pointsPerHit: 1, xpBase: 315 },
    2:  { 
        rounds: 10,  
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        minPoints: 50,  
        malus: 1, 
        pointsPerHit: 1, 
        xpBase: 330,
        targets: {
<<<<<<< HEAD
            1: [{v:20, m:0}, {v:20, m:0}, {v:20, m:0}], 
            5: [{v:20, m:0}, {v:20, m:0}, {v:20, m:0}], 
            7: [{v:25, m:1}, {v:25, m:1}, {v:25, m:1}]  
=======
            1: [{v:11, m:1}, {v:25, m:1}, {v:6, m:1}], 
            5: [{v:17, m:1}, {v:16, m:1}, {v:15, m:1}], 
            8: [{v:20, m:2}, {v:19, m:2}, {v:18, m:2}]  
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        }
    },
    5:  { rounds: 8,  minPoints: 95,  malus: 2, targets: [{v:20, m:3}, {v:19, m:3}, {v:18, m:3}], pointsPerHit: 5, xpBase: 375 },
    10: { rounds: 11, minPoints: 170, malus: 3, targets: [{v:20, m:1}, {v:18, m:2}, {v:13, m:1}], pointsPerHit: 10, xpBase: 450 },
    20: { rounds: 16, minPoints: 320, malus: 5, targets: null, mode: 'random', pointsPerHit: 10, xpBase: 600 },
    'daily':  { 
        rounds: 7,  
        minPoints: 3,  
        malus: 1, 
        pointsPerHit: 1, 
        xpBase: 630,
        targets: {
<<<<<<< HEAD
            1: [{v:20, m:0}, {v:20, m:0}, {v:20, m:0}]  
=======
            1: [{v:20, m:0}, {v:20, m:0}, {v:20, m:0}], 
            8: [{v:20, m:1}, {v:10, m:1}, {v:5, m:1}]
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        }
    },
};

export class XXonXX {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.id = 'XXonXX';
        this.name = "XXonXX";
        this.interfaceType = "x01-warmup"; 
        this.srCategory = "finishing";
        this.isTraining = isTraining;
        this.level = level;

        const config = this._getEffectiveConfig(level, customSettings);
        
        this.config = config;
        this.maxRounds = config.rounds;
        this.minPointsRequired = config.minPoints;
        this.malusAmount = config.malus || 2;
        this.pointsPerHit = config.pointsPerHit || 1; 

        this.points = 0;           
        this.malusTotal = 0;       
        this.round = 1;
        this.isFinished = false;
        this.currentRoundThrows = [];
        this.history = []; 

        this.stats = {
            totalDarts: 0,
            hits: 0,
            misses: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            streaks: 0
        };

        this.activeTargets = this._generateTargetsForRound();
    }

    get currentTargets() {
        if (this.isFinished || !this.activeTargets) return [];
        return this.activeTargets.map(t => t.v);
    }

    get currentTargetRings() {
        if (this.isFinished || !this.activeTargets) return ['S', 'S', 'S'];
        return this.activeTargets.map(t => {
            if (t.m === 0) return 'A'; 
            if (t.m === 3) return 'T';
            if (t.m === 2) return 'D';
            return 'S';
        });
    }

    get displayStats() {
        return [
            { label: 'Punkte', value: this.points, color: 'text-success' },
            { label: 'Abzug', value: `-${this.malusTotal}`, color: 'text-danger' },
            { label: 'Ziel', value: this.minPointsRequired, color: 'text-warning' }
        ];
    }

    get highlights() {
        if (this.isFinished || !this.activeTargets) return [];
        return this.activeTargets.map((target, idx) => ({
            value: target.v, 
            multiplier: target.m, 
            dartIndex: idx,
            color: idx === 0 ? 'rgba(0, 242, 255, 0.5)' : (idx === 1 ? 'rgba(255, 0, 255, 0.5)' : 'rgba(0, 255, 0, 0.5)')
        }));
    }

    _getEffectiveConfig(level, custom) {
        if (custom) return this.setupTraining(custom);
        const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
        return { ...config };
    }

    _generateTargetsForRound() {
        const configTargets = this.config.targets;

        if (configTargets) {
            if (!Array.isArray(configTargets) && typeof configTargets === 'object') {
                const rounds = Object.keys(configTargets).map(Number).sort((a, b) => b - a);
                const currentSettingKey = rounds.find(r => r <= this.round) || rounds[rounds.length - 1];
                return [...configTargets[currentSettingKey]];
            }
            return [...configTargets];
        }

        const mode = this.config.mode;
        const possible = [20, 19, 18];
        let values = [];

        if (mode === 'desc') values = [20, 19, 18];
        else if (mode === 'asc') values = [18, 19, 20];
        else values = [
            possible[Math.floor(Math.random() * 3)],
            possible[Math.floor(Math.random() * 3)],
            possible[Math.floor(Math.random() * 3)]
        ];

        return values.map(v => ({ v: v, m: 1 }));
    }

    registerHit(val, mult) {
        if (this.isFinished || this.currentRoundThrows.length >= 3) return;

        const dartIndex = this.currentRoundThrows.length;
        const target = this.activeTargets[dartIndex];
        
        const isHit = (target.m === 0) 
            ? (val === target.v && mult > 0) 
            : (val === target.v && mult === target.m);

        let pointsForDart = 0;
        if (isHit) {
            const effectiveMultiplier = (target.m === 0) ? mult : 1;
            pointsForDart = this.pointsPerHit * effectiveMultiplier; 

            this.stats.hits++;
            if (mult === 1) this.stats.singles++;
            if (mult === 2) this.stats.doubles++;
            if (mult === 3) this.stats.triples++;
        } else {
            this.malusTotal += this.malusAmount;
            this.stats.misses++;
            pointsForDart = 0; 
        }

        this.currentRoundThrows.push({
            target: target.v,
            targetMult: target.m,
            val: val,
            mult: mult,
            score: pointsForDart, 
            isHit: isHit,
            displayValue: val === 0 ? '0' : (val === 25 ? 'DB' : val)
        });

        this.points += pointsForDart;
        this.stats.totalDarts++;
    }

    nextRound() {
        if (this.isFinished) return;
        while (this.currentRoundThrows.length < 3) {
            this.registerHit(0, 1);
        }
        if (this.currentRoundThrows.filter(t => t.isHit).length === 3) {
            this.stats.streaks++;
        }
        this.saveHistory();
        if (this.round < this.maxRounds) {
            this.round++;
            this.currentRoundThrows = [];
            this.activeTargets = this._generateTargetsForRound();
        } else {
            this.isFinished = true;
        }
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const last = this.currentRoundThrows.pop();
            this.points -= last.score;
            if (!last.isHit) {
                this.malusTotal -= last.val === 0 && last.mult === 1 && this.currentRoundThrows.length >= 3 ? 0 : this.malusAmount;
                this.stats.misses--;
            } else {
                this.stats.hits--;
                if (last.mult === 1) this.stats.singles--;
                if (last.mult === 2) this.stats.doubles--;
                if (last.mult === 3) this.stats.triples--;
            }
            this.stats.totalDarts--;
            return;
        }
        if (this.history.length > 0) {
            const state = JSON.parse(this.history.pop());
            this.points = state.points;
            this.malusTotal = state.malusTotal || 0;
            this.round = state.round;
            this.stats = state.stats;
            this.currentRoundThrows = state.throws;
            this.activeTargets = state.targets;
            this.isFinished = false;
        }
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points,
            malusTotal: this.malusTotal,
            round: this.round,
            stats: { ...this.stats },
            throws: [...this.currentRoundThrows],
            targets: [...this.activeTargets]
        }));
    }

    getFinalStats() {
        const hitRate = this.stats.hits / (this.stats.totalDarts || 1);
        const multiFactor = (this.stats.doubles * 1.5 + this.stats.triples * 2.5) / (this.stats.hits || 1);
        let sr = (hitRate * 120) + (multiFactor * 30) + (this.stats.streaks * 10);
        sr = Math.min(180, Math.max(0, Math.floor(sr)));
        
        const hasWon = this.points >= this.minPointsRequired;
        let finalXP = this.config.xpBase;

        if (hasWon) {
            finalXP += (this.stats.triples * 20) + (this.stats.doubles * 10) + (this.stats.streaks * 50);
            if (hitRate > 0.6) finalXP *= 1.8;
        } else {
            finalXP = Math.max(50, Math.floor(finalXP * 0.3)); 
        }

        const displayXP = this.isTraining ? Math.floor(finalXP * 0.1) : Math.floor(finalXP);

        return {
            id: this.id,
            xp: displayXP,
            sr: this.isTraining ? 0 : sr,
            won: hasWon,
            stats: { 
                ...this.stats, 
                finalScore: this.points, 
                points: this.points, 
                malus: this.malusTotal, 
                mode: this.isTraining ? "XXonXX Training" : `XXonXX Lvl ${this.level}` 
            }
        };
    }
}