import { LevelSystem } from '../supabase_client.js';

export const DoublesWarmupLevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

const LEVEL_CONFIG = {
    1:  { rounds: 6,  minPoints: 20, malus: 1, targets: [16, 8, 4],  pointsPerHit: 10, xpBase: 350 },
    2:  { rounds: 7,  minPoints: 30, malus: 1, targets: [16, 8, 4],  pointsPerHit: 10, xpBase: 370 },
    3:  { rounds: 7,  minPoints: 40, malus: 1, targets: [20, 10, 5],  pointsPerHit: 10, xpBase: 390 },
    4:  { rounds: 8,  minPoints: 50, malus: 2, targets: [20, 10, 5],  pointsPerHit: 12, xpBase: 410 },
    5:  { rounds: 8,  minPoints: 60, malus: 2, targets: [16, 8, 4],   pointsPerHit: 12, xpBase: 430 }
};

export class DoublesWarmup {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.id = 'doubles-warmup';
        this.name = "Double Mastery";
        this.interfaceType = "x01-warmup";
        this.srCategory = "boardcontrol";
        this.isTraining = isTraining;
        this.level = level;

        const config = isTraining ? this.setupTraining(customSettings) : (LEVEL_CONFIG[level] || LEVEL_CONFIG[1]);
        
        this.maxRounds = config.rounds;
        this.minPointsRequired = config.minPoints;
        this.malusPerMiss = config.malus;
        this.fixedTargets = config.targets;
        this.pointsPerHit = config.pointsPerHit || 10;
        
        this.targetRing = 'D'; 
        this.currentTargetRings = ['D', 'D', 'D']; // WICHTIG für UI Dart-Anzeige

        this.reset();
    }

    getInfoBlock() {
        const targets = (this.fixedTargets || []).join(' / ');
        return {
            title: this.name,
            subtitle: this.isTraining ? 'Training Mode' : `Level ${this.level}`,
            summary: 'Double Mastery fokussiert sich komplett auf feste Doppel-Felder und belohnt sauberes Wiederholen unter leichtem Druck.',
            facts: [`${this.maxRounds} Runden`, `Ziele ${targets}`, `Mind. ${this.minPointsRequired} Punkte`],
            sections: [
                { label: 'Ziel', text: `Spiele wiederholt auf die Doppel ${targets} und sammle damit Punkte.` },
                { label: 'Ablauf', text: 'Die Zielreihe bleibt pro Modus fest. Jeder Dart muss auf das aktuell markierte Double gespielt werden.' },
                { label: 'Wertung', text: `Jeder Treffer bringt ${this.pointsPerHit} Punkte. Misses erzeugen den jeweiligen Malus des Levels.` },
                { label: 'Sieg', text: `Nach allen Runden brauchst du mindestens ${this.minPointsRequired} Punkte für einen erfolgreichen Run.` }
            ]
        };
    }

    static getTrainingConfig() {
        return {
            gameId: 'doubles-warmup',
            title: 'Double Mastery Training',
            options: [
                {
                    id: 'rounds',
                    label: 'Runden',
                    type: 'select',
                    values: [
                        { label: '6 Runden', value: '6' },
                        { label: '12 Runden', value: '12' },
                        { label: '20 Runden', value: '20' }
                    ]
                },
                {
                    id: 'targetSet',
                    label: 'Ziel-Reihe',
                    type: 'select',
                    values: [
                        { label: '16 - 8 - 4', value: '16' },
                        { label: '20 - 10 - 5', value: '20' }
                    ]
                },
                {
                    id: 'hitValue',
                    label: 'Punkte pro Treffer',
                    type: 'select',
                    values: [
                        { label: '10 Punkte', value: '10' },
                        { label: '15 Punkte', value: '15' },
                        { label: '20 Punkte', value: '20' }
                    ]
                }
            ]
        };
    }

    setupTraining(settings) {
        return {
            rounds: parseInt(settings?.rounds) || 6,
            targets: settings?.targetSet === '20' ? [20, 10, 5] : [16, 8, 4],
            pointsPerHit: parseInt(settings?.hitValue) || 10,
            minPoints: 0,
            malus: 0,
            xpBase: 300
        };
    }

    // FIX: Sorgt dafür, dass updateUI im Controller nicht abbricht -> Numpad leuchtet blau
    get displayStats() {
        return [
            { label: 'Punkte', value: this.points, color: 'text-success' },
            { label: 'Abzug', value: `-${this.malusTotal}`, color: 'text-danger' },
            { label: 'Ziel', value: this.minPointsRequired, color: 'text-warning' }
        ];
    }

    // FIX: Erlaubt dem Controller das Highlighting der Segmente
    get highlights() {
        if (this.isFinished) return [];
        return this.currentTargets.map((num, idx) => ({
            value: num,
            multiplier: 2,
            dartIndex: idx
        }));
    }

    reset() {
        this.round = 1;
        this.points = 0;
        this.malusTotal = 0;
        this.currentRoundThrows = [];
        this.currentTargets = [...this.fixedTargets];
        this.isGameOver = false;
        this.isFinished = false;
        this.history = [];
        this.stats = { hits: 0, misses: 0, doubles: 0, totalDarts: 0, streaks: 0, currentStreak: 0 };
    }

    registerHit(val, mult) {
        if (this.isFinished || this.currentRoundThrows.length >= 3) return;

        // History Speicherung VOR dem Wurf (wie in Numbers)
        this.saveHistory();

        const target = this.currentTargets[this.currentRoundThrows.length];
        const isCorrectSegment = (val === target);
        const isDoubleHit = isCorrectSegment && (mult === 2);

        let pointsGained = 0;
        if (isDoubleHit) {
            pointsGained = this.pointsPerHit;
            this.stats.doubles++;
            this.stats.hits++;
            this.stats.currentStreak++;
        } else if (isCorrectSegment) {
            pointsGained = 2; // Trostpunkt für Single
            this.stats.hits++;
            this.stats.currentStreak = 0;
        } else {
            this.points = Math.max(0, this.points - this.malusPerMiss);
            this.malusTotal += this.malusPerMiss;
            this.stats.misses++;
            this.stats.currentStreak = 0;
        }

        this.points += pointsGained;
        this.stats.totalDarts++;

        this.currentRoundThrows.push({
            val, mult, target,
            displayValue: val,
            isHit: isDoubleHit,
            pointsGained,
            wasMiss: !isCorrectSegment
        });

        if (this.currentRoundThrows.length === 3 && this.stats.currentStreak >= 3) {
            this.stats.streaks++;
        }
    }

    nextRound() {
        if (this.isFinished) return;

        // Falls weniger als 3 Darts geworfen wurden
        while (this.currentRoundThrows.length < 3) {
            this.registerHit(0, 1);
        }

        if (this.round < this.maxRounds) {
            this.round++;
            this.currentRoundThrows = [];
            this.currentTargets = [...this.fixedTargets];
        } else {
            this.isGameOver = true;
            this.isFinished = true;
        }
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            // Innerhalb der Runde wie im Original
            const last = this.currentRoundThrows.pop();
            if (last.wasMiss) {
                this.malusTotal -= this.malusPerMiss;
                this.points += this.malusPerMiss;
                this.stats.misses--;
            } else {
                this.points -= last.pointsGained;
                this.stats.hits--;
                if (last.mult === 2) {
                    this.stats.doubles--;
                    this.stats.currentStreak = Math.max(0, this.stats.currentStreak - 1);
                }
            }
            this.stats.totalDarts--;
        } else if (this.history.length > 0) {
            // Rundenübergreifend via History-Snapshot
            const state = JSON.parse(this.history.pop());
            this.points = state.points;
            this.malusTotal = state.malusTotal;
            this.round = state.round;
            this.stats = state.stats;
            this.currentRoundThrows = state.throws;
            this.isFinished = false;
            this.isGameOver = false;
        }
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points,
            malusTotal: this.malusTotal,
            round: this.round,
            stats: { ...this.stats },
            throws: [...this.currentRoundThrows]
        }));
        if (this.history.length > 20) this.history.shift();
    }

    getFinalStats() {
        const hitRate = this.stats.hits / (this.stats.totalDarts || 1);
        const doubleRate = this.stats.doubles / (this.stats.totalDarts || 1);
        
        let sr = (hitRate * 100) + (doubleRate * 80) + (this.stats.streaks * 15);
        sr = Math.min(180, Math.max(0, Math.floor(sr)));

        const hasWon = this.points >= this.minPointsRequired;
        let finalXP = (LEVEL_CONFIG[this.level] || LEVEL_CONFIG[1]).xpBase;

        if (hasWon) {
            finalXP += (this.stats.doubles * 25) + (this.stats.streaks * 60);
            if (doubleRate > 0.4) finalXP *= 1.5;
        } else {
            finalXP = Math.max(40, Math.floor(finalXP * 0.25));
        }

        const displayXP = this.isTraining ? Math.floor(finalXP * 0.1) : Math.floor(finalXP);

        return {
            id: this.id,
            xp: displayXP,
            xpEarned: displayXP,
            sr: this.isTraining ? 0 : sr,
            srGained: this.isTraining ? 0 : sr,
            won: hasWon,
            hasWon: hasWon,
            stats: {
                ...this.stats,
                finalScore: this.points,
                points: this.points,
                malus: this.malusTotal,
                mode: this.isTraining ? "Double Training" : `Doubles Lvl ${this.level}`
            }
        };
    }
}
