import { LevelSystem } from '../supabase_client.js';

/**
 * BullsWarmup LevelMapper (1-20)
 */
export const BullsWarmupLevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

/**
 * LEVEL CONFIGURATION
 * Steigert Rundenanzahl und Punktanforderungen.
 */
const LEVEL_CONFIG = {
    'daily': { rounds: 1, minPoints: 50, ptsDouble: 2, ptsSingle: 1, xpBase: 400 },
    1:  { rounds: 5, minPoints: 5,  ptsDouble: 2, ptsSingle: 1, xpBase: 350 },
    2:  { rounds: 5, minPoints: 5,  ptsDouble: 2, ptsSingle: 1, xpBase: 370 },
    3:  { rounds: 6, minPoints: 6,  ptsDouble: 2, ptsSingle: 1, xpBase: 390 },
    4:  { rounds: 6, minPoints: 8,  ptsDouble: 2, ptsSingle: 1, xpBase: 410 },
    5:  { rounds: 12, minPoints: 50,  ptsDouble: 2, ptsSingle: 1, xpBase: 430 },
    6:  { rounds: 12, minPoints: 55,  ptsDouble: 2, ptsSingle: 1, xpBase: 450 },
    7:  { rounds: 12, minPoints: 60,  ptsDouble: 3, ptsSingle: 1, xpBase: 470 }, 
    8:  { rounds: 15, minPoints: 70,  ptsDouble: 3, ptsSingle: 1, xpBase: 490 },
    9:  { rounds: 15, minPoints: 75,  ptsDouble: 3, ptsSingle: 1, xpBase: 510 },
    10: { rounds: 15, minPoints: 80,  ptsDouble: 3, ptsSingle: 1, xpBase: 530 },
    15: { rounds: 15, minPoints: 110, ptsDouble: 3, ptsSingle: 1, xpBase: 650 },
    20: { rounds: 20, minPoints: 160, ptsDouble: 3, ptsSingle: 1, xpBase: 800 }
};

export class BullsWarmup {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.id = 'bulls-warmup';
        this.name = "Bulls Warmup";
        this.interfaceType = "x01-warmup";
        this.srCategory = "boardcontrol";
        this.isTraining = isTraining;
        this.level = level;

        const config = isTraining ? this.setupTraining(customSettings) : (LEVEL_CONFIG[level] || LEVEL_CONFIG[1]);
        
        this.maxRounds = config.rounds;
        this.minPointsRequired = config.minPoints;
        
        // Punktwerte für Segment-Phase
        this.pointsDouble = config.ptsDouble || 2;
        this.pointsSingle = config.ptsSingle || 1;

        this.reset();
    }

    static getTrainingConfig() {
        return {
            gameId: 'bulls-warmup',
            title: 'Bulls Warmup Training',
            options: [
                {
                    id: 'rounds',
                    label: 'Runden',
                    type: 'select',
                    values: [
                        { label: '10 Runden', value: '10' },
                        { label: '15 Runden', value: '15' },
                        { label: '20 Runden', value: '20' }
                    ]
                },
                {
                    id: 'ptsDouble',
                    label: 'Punkte: Doppel',
                    type: 'select',
                    values: [
                        { label: '2 Punkte', value: '2' },
                        { label: '3 Punkte', value: '3' },
                        { label: '5 Punkte', value: '5' }
                    ]
                },
                {
                    id: 'ptsSingle',
                    label: 'Punkte: Single/Triple',
                    type: 'select',
                    values: [
                        { label: '1 Punkt', value: '1' },
                        { label: '2 Punkte', value: '2' }
                    ]
                }
            ]
        };
    }

    setupTraining(settings) {
        return {
            rounds: parseInt(settings?.rounds) || 10,
            ptsDouble: parseInt(settings?.ptsDouble) || 2,
            ptsSingle: parseInt(settings?.ptsSingle) || 1,
            minPoints: 0,
            xpBase: 350
        };
    }

    get displayStats() {
        return [
            { label: 'Punkte', value: this.points, color: 'text-success' },
            { label: 'Runde', value: `${this.round}/${this.maxRounds}`, color: 'text-info' },
            { label: 'Ziel', value: this.minPointsRequired, color: 'text-warning' }
        ];
    }

    /**
     * ZENTRALE LOGIK: Bestimmt die Ziele für Dart 1, 2 und 3
     * Basierend auf den vorherigen Würfen der aktuellen Runde.
     */
    get currentTargets() {
        // Dart 1 ist IMMER Bull
        const t1 = 25;
        
        // Dart 2 Berechnung
        let t2 = 25; // Default
        if (this.currentRoundThrows.length > 0) {
            const throw1 = this.currentRoundThrows[0];
            // Wenn Dart 1 NICHT Bull war (und kein Miss), ist das neue Ziel dieses Segment
            if (throw1.val !== 25 && throw1.val > 0) {
                t2 = throw1.val;
            }
        }

        // Dart 3 Berechnung
        let t3 = t2; // Default: Gleiches Ziel wie Dart 2
        if (this.currentRoundThrows.length > 1) {
            const throw2 = this.currentRoundThrows[1];
            // Wenn wir auf Bull geworfen haben (t2 war 25), aber verfehlt haben -> Switch
            if (t2 === 25) {
                if (throw2.val !== 25 && throw2.val > 0) {
                    t3 = throw2.val;
                }
            } else {
                // Wir waren schon im Segment-Modus -> Bleiben beim Segment (t2)
                t3 = t2;
            }
        }

        return [t1, t2, t3];
    }

    /**
     * Sagt dem Controller, welches Segment leuchten soll
     */
    get highlights() {
        if (this.isFinished) return [];
        
        const dartIndex = this.currentRoundThrows.length;
        const targets = this.currentTargets;
        const activeTarget = targets[dartIndex];
        
        if (!activeTarget) return [];

        return [{
            value: activeTarget,
            multiplier: 1, // Controller highlighted das ganze Segment
            dartIndex: dartIndex
        }];
    }

    reset() {
        this.round = 1;
        this.points = 0;
        this.currentRoundThrows = [];
        this.history = [];
        this.stats = { 
            hits: 0, 
            misses: 0, 
            bulls: 0, 
            outerBulls: 0,
            switches: 0, 
            totalDarts: 0 
        };
        this.isFinished = false;
    }

    registerHit(val, mult) {
        if (this.isFinished || this.currentRoundThrows.length >= 3) return;

        this.saveHistory();

        const dartIndex = this.currentRoundThrows.length;
        // WICHTIG: Das Ziel für DIESEN Wurf holen wir uns dynamisch
        const currentTarget = this.currentTargets[dartIndex];
        
        let pointsGained = 0;
        let isHit = false;

        // --- PHASE 1: WIR ZIELEN AUF BULL ---
        if (currentTarget === 25) {
            if (val === 25) {
                isHit = true;
                const isInner = (mult === 2);
                
                // Bonus-Check für den 3. Dart (Nur wenn D1 & D2 auch Bull getroffen haben)
                const isThirdDart = (dartIndex === 2);
                const prevWereBulls = isThirdDart && this.currentRoundThrows.every(t => t.val === 25);

                if (isThirdDart && prevWereBulls) {
                    // Bonus: 6 für Bullseye, 3 für Outer
                    pointsGained = isInner ? 6 : 3;
                } else {
                    // Standard: 4 für Bullseye, 2 für Outer
                    pointsGained = isInner ? 4 : 2;
                }

                if (isInner) this.stats.bulls++;
                else this.stats.outerBulls++;
                this.stats.hits++;
            } else {
                // Verfehlt -> Nächster Dart geht auf das getroffene Segment (Switch Logic im Getter)
                this.stats.misses++;
                if (val > 0) this.stats.switches++;
            }
        } 
        // --- PHASE 2: WIR ZIELEN AUF EIN SEGMENT ---
        else {
            if (val === currentTarget) {
                isHit = true;
                pointsGained = (mult === 2) ? this.pointsDouble : this.pointsSingle;
                this.stats.hits++;
            } else {
                this.stats.misses++;
            }
        }

        this.points += pointsGained;
        this.stats.totalDarts++;

        this.currentRoundThrows.push({
            val, mult, 
            target: currentTarget, // Speichern, worauf wir gezielt haben
            pointsGained,
            isHit,
            displayValue: val === 25 ? (mult === 2 ? 'DB' : 'B') : val
        });
    }

    nextRound() {
        if (this.isFinished) return;

        while (this.currentRoundThrows.length < 3) {
            this.registerHit(0, 1);
        }

        if (this.round < this.maxRounds) {
            this.round++;
            this.currentRoundThrows = [];
        } else {
            this.isFinished = true;
        }
    }

    undo() {
        if (this.currentRoundThrows.length > 0) {
            const last = this.currentRoundThrows.pop();
            this.points -= last.pointsGained;
            this.stats.totalDarts--;
            
            if (last.isHit) {
                this.stats.hits--;
                if (last.target === 25) {
                    if (last.pointsGained >= 4) this.stats.bulls--; // War DB
                    else this.stats.outerBulls--; // War B
                }
            } else {
                this.stats.misses--;
                if (last.target === 25 && last.val > 0) this.stats.switches--;
            }
        } else if (this.history.length > 0) {
            const state = JSON.parse(this.history.pop());
            this.points = state.points;
            this.round = state.round;
            this.stats = state.stats;
            this.currentRoundThrows = state.throws;
            this.isFinished = false;
        }
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points,
            round: this.round,
            stats: { ...this.stats },
            throws: [...this.currentRoundThrows]
        }));
        if (this.history.length > 20) this.history.shift();
    }

    getFinalStats() {
        const hasWon = this.points >= this.minPointsRequired;
        
        // Skill Rating Berechnung
        let sr = (this.points / (this.minPointsRequired || 50)) * 100;
        sr += (this.stats.bulls * 5); 
        sr = Math.min(180, Math.max(0, Math.floor(sr)));

        let finalXP = (LEVEL_CONFIG[this.level] || LEVEL_CONFIG[1]).xpBase;
        
        if (hasWon) {
            finalXP += (this.stats.bulls * 15) + (this.stats.outerBulls * 5);
            finalXP += (this.points * 2);
        } else {
            finalXP = Math.max(50, Math.floor(finalXP * 0.25));
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
                bulls: this.stats.bulls,
                switches: this.stats.switches,
                mode: this.isTraining ? "Bulls Training" : `Bulls Lvl ${this.level}`
            }
        };
    }
}