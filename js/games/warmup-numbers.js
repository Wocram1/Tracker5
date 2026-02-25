import { LevelSystem } from '../supabase_client.js';

/**
 * NumbersWarmup LevelMapper (1-20)
 * Skaliert nun feiner über 20 Level.
 */
export const NumbersWarmupLevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

export class NumbersWarmup {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "Numbers Warmup";
        this.interfaceType = "x01-warmup"; 
        this.srCategory = "warmup";
        this.isTraining = isTraining;
        this.level = level;

        // --- KONFIGURATION LADEN ---
        const config = this._getEffectiveConfig(level, customSettings);
        
        this.config = config;
        this.maxRounds = config.rounds;
        this.minPointsRequired = config.minPoints;
        this.malusAmount = config.malus || 2;

        this.points = 0;           // Aktueller Gesamt-Score
        this.malusTotal = 0;       // Summe aller Malus-Abzüge
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

        this.currentTargets = this._generateTargetsForRound();
    }

    /**
     * DYNAMISCHE STATUS-ANZEIGE (Dashboard)
     */
    get displayStats() {
        return [
            { label: 'Punkte', value: this.points, color: 'text-success' },
            { label: 'Abzug', value: `-${this.malusTotal}`, color: 'text-danger' },
            { label: 'Ziel', value: this.minPointsRequired, color: 'text-warning' }
        ];
    }

    /**
     * HIGHLIGHTS FÜR DAS BOARD
     * Gibt alle Ziele der aktuellen Runde zurück
     */
    get targetNumbers() {
        if (this.isFinished) return [];
        return this.currentTargets || [];
    }

    /**
     * Liefert die Highlights inklusive Dart-Index für die Farbsteuerung/Blinken
     */
    get highlights() {
        const targets = this.targetNumbers;
        if (targets.length === 0) return [];
        
        return targets.map((num, idx) => ({
            value: num, 
            multiplier: 1, 
            dartIndex: idx, // Wichtig für die Unterscheidung im Controller
            // Fallback-Farben, falls CSS-Klassen nicht greifen:
            color: idx === 0 ? 'rgba(0, 242, 255, 0.5)' : (idx === 1 ? 'rgba(255, 0, 255, 0.5)' : 'rgba(0, 255, 0, 0.5)')
        }));
    }

    static getTrainingConfig() {
        return {
            gameId: 'numbers-warmup',
            title: 'Numbers Warmup',
            options: [
                {
                    id: 'rounds',
                    label: 'Runden',
                    type: 'select',
                    values: [
                        { label: '6 Runden', value: '6' },
                        { label: '12 Runden', value: '12' },
                        { label: '18 Runden', value: '18' }
                    ]
                },
                {
                    id: 'mode',
                    label: 'Reihenfolge',
                    type: 'select',
                    values: [
                        { label: 'Zufällig (18-20)', value: 'random' },
                        { label: 'Fix: 20-19-18', value: 'desc' },
                        { label: 'Fix: 18-19-20', value: 'asc' }
                    ]
                }
            ]
        };
    }

    setupTraining(settings) {
        return {
            rounds: parseInt(settings?.rounds) || 9,
            mode: settings?.mode || 'random',
            minPoints: 0,
            malus: 0,
            xpBase: 300
        };
    }

    _getEffectiveConfig(level, custom) {
        if (custom) return this.setupTraining(custom);
        
        const rounds = 6 + Math.floor(level / 2);
        const minPoints = 20 + (level * 15);
        const malus = 1 + Math.floor(level / 5);

        return {
            rounds: rounds,
            mode: level > 10 ? 'random' : 'desc',
            minPoints: minPoints,
            malus: malus,
            xpBase: 300 + (level * 15)
        };
    }

    _generateTargetsForRound() {
        const mode = this.config.mode;
        const possible = [20, 19, 18];
        if (mode === 'desc') return [20, 19, 18];
        if (mode === 'asc') return [18, 19, 20];
        return [
            possible[Math.floor(Math.random() * 3)],
            possible[Math.floor(Math.random() * 3)],
            possible[Math.floor(Math.random() * 3)]
        ];
    }

    registerHit(val, mult) {
        if (this.isFinished || this.currentRoundThrows.length >= 3) return;

        const dartIndex = this.currentRoundThrows.length;
        const target = this.currentTargets[dartIndex];
        const isHit = (val === target);

        let pointsForDart = 0;
        if (isHit) {
            pointsForDart = mult; 
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
            target: target,
            val: val,
            mult: mult,
            score: pointsForDart, 
            isHit: isHit,
            displayValue: val === 0 ? '0' : val
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
            this.currentTargets = this._generateTargetsForRound();
        } else {
            this.isFinished = true;
        }
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const last = this.currentRoundThrows.pop();
            this.points -= last.score;
            if (!last.isHit) {
                this.malusTotal -= this.malusAmount;
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
            this.currentTargets = state.targets;
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
            targets: [...this.currentTargets]
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
        if (this.isTraining) finalXP *= 0.1;
        return {
            xp: Math.floor(finalXP),
            sr: sr,
            won: hasWon,
            stats: { 
                ...this.stats, 
                finalScore: this.points, 
                points: this.points, 
                malus: this.malusTotal, 
                mode: this.isTraining ? "Warmup Training" : `Numbers Lvl ${this.level}` 
            }
        };
    }
}