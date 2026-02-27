import { LevelSystem } from '../supabase_client.js';

export const BermudaLevelMapper = (playerLevel) => {
    if (playerLevel < 8) return 1;
    if (playerLevel < 15) return 2;
    if (playerLevel < 25) return 3;
    if (playerLevel < 35) return 4;
    if (playerLevel < 50) return 5;
    return 6; 
};

export class Bermuda {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.name = "Bermuda";
        this.interfaceType = "board-control";
        this.srCategory = "boardcontrol";
        this.isTraining = isTraining;
        this.level = level;

        // --- LEVEL KONFIGURATION ---
        this.levelConfigs = {
            1: { targets: [12, 13, 14, 'D', 15, 16, 17, 'T', 18, 19, 20, 'B'], rounds: 40, startHerz: 3, startBlitz: 3, minPoints: 150 },
            2: { targets: [13, 14, 15, 'D', 16, 17, 18, 'T', 19, 20, 'B'], rounds: 35, startHerz: 2, startBlitz: 2, minPoints: 250 },
            3: { targets: [10, 11, 12, 13, 14, 'D', 15, 16, 17, 18, 19, 'T', 20, 'B'], rounds: 30, startHerz: 2, startBlitz: 1, minPoints: 400 },
            4: { targets: [1, 5, 20, 'D', 9, 12, 14, 'T', 11, 8, 16, 'B'], rounds: 25, startHerz: 1, startBlitz: 1, minPoints: 550 },
            5: { targets: [20, 19, 18, 'D', 17, 16, 15, 'T', 14, 13, 12, 'B'], rounds: 20, startHerz: 1, startBlitz: 0, minPoints: 700 },
            6: { targets: [20, 19, 18, 'D18', 17, 16, 15, 'T15', 14, 13, 12, 'B'], rounds: 18, startHerz: 1, startBlitz: 0, minPoints: 900 }
        };

        const configTemplate = this.levelConfigs[level] || this.levelConfigs[1];
        this.config = isTraining ? this.setupTraining(customSettings) : configTemplate;

        this.targets = [...this.config.targets];
        this.currentIndex = 0;
        this.round = 1;
        this.points = 0;
        this.lives = this.config.startHerz;
        this.bolts = this.config.startBlitz;
        this.isFinished = false;
        this.roundDarts = [];
        this.history = [];
        this.hitInRound = false; 
        
        this.burnoutInCurrentRound = false;
        this._isProcessingNextRound = false;

        this.stats = {
            misses: 0, hits: 0, totalDarts: 0,
            singles: 0, doubles: 0, triples: 0,
            halvings: 0, firstDartHits: 0
        };
    }

    // --- TRAININGS KONFIG (Analog 121 / ATC) ---
    static getTrainingConfig() {
        return {
            gameId: 'bermuda',
            title: 'Bermuda Training',
            options: [
                {
                    id: 'mode',
                    label: 'Ziel-Set',
                    type: 'select',
                    values: [
                        { label: 'Standard (12-B)', value: 'std' },
                        { label: 'Full Board', value: 'full' }
                    ]
                },
                {
                    id: 'lives',
                    label: 'Start-Herzen',
                    type: 'select',
                    values: [
                        { label: '3', value: '3' },
                        { label: '5', value: '5' },
                        { label: '99', value: '99' }
                    ]
                }
            ]
        };
    }

    setupTraining(s) {
        let targets = [12, 13, 14, 'D', 15, 16, 17, 'T', 18, 19, 20, 'B'];
        if (s?.mode === 'full') targets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'D', 11, 12, 13, 14, 15, 'T', 16, 17, 18, 19, 20, 'B'];
        
        return {
            targets: targets,
            rounds: 999,
            startHerz: parseInt(s?.lives) || 3,
            startBlitz: 3,
            minPoints: 0
        };
    }

    get currentTargets() {
        const t = this.targets[this.currentIndex];
        return [t, t, t];
    }

    get currentTargetNumber() {
        const t = this.targets[this.currentIndex];
        if (t === 'D') return "Double (Any)";
        if (t === 'T') return "Triple (Any)";
        if (t === 'B') return "Bullseye";
        return t;
    }

    registerThrow(multiplier) {
        if (this.isFinished || this.roundDarts.length >= 3) return;
        this.saveHistory();

        const isFirstDart = this.roundDarts.length === 0;
        this.stats.totalDarts++;
        this.roundDarts.push(multiplier);

        const target = this.targets[this.currentIndex];
        let isHit = false;

        // Bermuda Hit-Logik
        if (target === 'D') isHit = (multiplier === 2);
        else if (target === 'T') isHit = (multiplier === 3);
        else if (target === 'B') isHit = (multiplier > 0);
        else if (target.toString().startsWith('D')) isHit = (multiplier === 2);
        else if (target.toString().startsWith('T')) isHit = (multiplier === 3);
        else isHit = (multiplier > 0);

        if (isHit) {
            if (isFirstDart) this.stats.firstDartHits++;
            this.handleHit(multiplier);
        } else {
            this.handleMiss();
        }
    }

    handleHit(multiplier) {
        this.hitInRound = true;
        this.stats.hits++;
        let value = 0;
        const target = this.targets[this.currentIndex];

        if (target === 'D' || target === 'T' || target === 'B') {
            value = 25 * multiplier;
        } else {
            const base = parseInt(target.toString().replace('D', '').replace('T', ''));
            value = base * multiplier;
        }

        this.points += value;
        if (multiplier === 1) this.stats.singles++;
        if (multiplier === 2) this.stats.doubles++;
        if (multiplier === 3) this.stats.triples++;

        // Regeneration (ATC Style)
        if (this.config.startBlitz > 0) this.bolts = Math.min(this.config.startBlitz, this.bolts + 1);
        if (this.config.startHerz > 0) this.lives = Math.min(this.config.startHerz, this.lives + 1);

        // Bei Bermuda rückt man erst am Rundenende vor (Bermuda Core)
        // Aber wir markieren, dass das Ziel "erledigt" ist
    }

    handleMiss() {
        this.stats.misses++;
        if (this.bolts > 0) {
            this.bolts--;
            if (this.bolts === 0 && !this.burnoutInCurrentRound) {
                this.triggerBurnout();
            }
        } else if (this.lives > 0) {
            this.lives--;
            this.points = Math.floor(this.points / 2); // Bermuda Strafe
            this.stats.halvings++;
            if (this.lives === 0 && !this.isTraining) this.isFinished = true;
        }
    }

    triggerBurnout() {
        this.burnoutInCurrentRound = true;
        this.points = Math.floor(this.points / 2); // Bermuda Strafe
        this.stats.halvings++;
        
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

        while (this.roundDarts.length < 3 && !this.isFinished && !this.burnoutInCurrentRound) {
            this.registerThrow(0);
        }

        this._isProcessingNextRound = false;

        if (!this.isFinished) {
            if (this.hitInRound) this.currentIndex++;

            if (this.round >= this.config.rounds) {
                this.isFinished = true;
            } else {
                this.round++;
                if (this.burnoutInCurrentRound) this.round++; 
            }

            this.hitInRound = false;
            this.roundDarts = [];
            this.burnoutInCurrentRound = false;

            if (this.currentIndex >= this.targets.length || this.round > this.config.rounds) {
                this.round = Math.min(this.round, this.config.rounds);
                this.isFinished = true;
            }
        }
    }

    getFinalStats() {
        const won = this.points >= this.config.minPoints && this.currentIndex >= this.targets.length && this.round <= this.config.rounds;
        const hitRate = this.stats.hits / (this.stats.totalDarts || 1);
        
        // SR System auf max 180 angepasst
        const pointEfficiency = Math.min(1, this.points / 1200); 
        const finalSR = Math.min(180, Math.floor((hitRate * 150) + (pointEfficiency * 30)));

        let baseXP = won ? (640 + (this.level * 60)) : 100;
        const totalXP = baseXP + (this.stats.triples * 50) + (this.stats.doubles * 25) + (hitRate * 250);

        return {
            xp: Math.floor(this.isTraining ? totalXP * 0.1 : totalXP),
            sr: finalSR,
            won: won,
            stats: { 
                ...this.stats, 
                finalScore: this.points, 
                accuracy: (hitRate * 100).toFixed(1) + "%", 
                mode: this.isTraining ? "Bermuda Training" : `Bermuda Level ${this.level}` 
            }
        };
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points, lives: this.lives, bolts: this.bolts,
            currentIndex: this.currentIndex, round: this.round,
            hitInRound: this.hitInRound, stats: { ...this.stats },
            roundDarts: [...this.roundDarts], burnoutInCurrentRound: this.burnoutInCurrentRound
        }));
    }

    undo() {
        if (this.history.length === 0) return;
        Object.assign(this, JSON.parse(this.history.pop()));
    }
}