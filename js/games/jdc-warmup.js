import { LevelSystem } from '../supabase_client.js';

/**
 * JDCWarmup LevelMapper (1-20)
 */
export const JDCWarmupLevelMapper = (playerLevel) => {
    return Math.min(20, Math.max(1, Math.floor(playerLevel / 5) + 1));
};

/**
 * LEVEL CONFIGURATION
 */
const LEVEL_CONFIG = {
    1:  { s1: [18, 20], targets: [20, 18, 10], s2: [18, 20], pointsPerDouble: 20, minPoints: 50,  xpBase: 400 },
    5:  { s1: [15, 20], targets: [20, 19, 18, 16, 10, 8], s2: [15, 20], pointsPerDouble: 30, minPoints: 150, xpBase: 600 },
    10: { s1: [12, 20], targets: [20, 19, 18, 17, 16, 15, 12, 10, 8, 4, 2, 1], s2: [12, 20], pointsPerDouble: 40, minPoints: 450, xpBase: 1000 },
    15: { s1: [10, 15], targets: null, s2: [15, 20], pointsPerDouble: 50, minPoints: 750, xpBase: 1300 },
    20: { s1: [10, 15], targets: null, s2: [15, 20], pointsPerDouble: 50, minPoints: 1000, xpBase: 1600 }
};

export class JDCWarmup {
    constructor(level = 1, isTraining = false, customSettings = null) {
        this.id = 'jdc-warmup';
        this.name = "JDC Challenge";
        this.interfaceType = "x01-warmup";
        this.srCategory = "boardcontrol";
        this.isTraining = isTraining;
        this.level = level;

        const config = this._getEffectiveConfig(level, customSettings);
        this.config = config;
        this.minPointsRequired = config.minPoints;
        this.pointsPerDouble = config.pointsPerDouble;

        this.reset();
    }

    _getEffectiveConfig(level, custom) {
        if (custom) return this.setupTraining(custom);
        const keys = Object.keys(LEVEL_CONFIG).map(Number).sort((a, b) => b - a);
        const closestLevel = keys.find(k => k <= level) || 1;
        return { ...LEVEL_CONFIG[closestLevel] };
    }

    static getTrainingConfig() {
        return {
            gameId: 'jdc-warmup',
            title: 'JDC Challenge Training',
            options: [
                {
                    id: 'mode',
                    label: 'Umfang',
                    type: 'select',
                    values: [
                        { label: 'Short (Big Wings)', value: 'easy' },
                        { label: 'Medium (Halb)', value: 'medium' },
                        { label: 'Full JDC', value: 'full' }
                    ]
                },
                {
                    id: 'doubleValue',
                    label: 'Punkte pro Doppel',
                    type: 'select',
                    values: [
                        { label: '50 Punkte', value: '50' },
                        { label: '25 Punkte', value: '25' }
                    ]
                }
            ]
        };
    }

    setupTraining(settings) {
        let targets = null;
        let s1 = [10, 15], s2 = [15, 20];

        if (settings?.mode === 'easy') {
            targets = [20, 18, 10];
            s1 = [18, 20]; s2 = [18, 20];
        } else if (settings?.mode === 'medium') {
            targets = [20, 19, 18, 17, 16, 15, 10, 8, 4];
            s1 = [15, 20]; s2 = [15, 20];
        }

        return {
            s1, s2, targets,
            pointsPerDouble: parseInt(settings?.doubleValue) || 50,
            minPoints: 0,
            xpBase: 400
        };
    }

    reset() {
        this.gamePlan = this._generateGamePlan();
        this.maxRounds = this.gamePlan.length;
        this.round = 1;
        this.points = 0;
        this.isFinished = false;
        this.currentRoundThrows = [];
        this.history = [];
        this.stats = { hits: 0, misses: 0, doubles: 0, triples: 0, totalDarts: 0, shanghais: 0, doubleHits: 0 };
    }

    _generateGamePlan() {
        let plan = [];
        const { s1, s2, targets } = this.config;

        // Phase 1: Shanghai (Ein Ziel pro Runde)
        for (let i = s1[0]; i <= s1[1]; i++) {
            plan.push({ target: [i, i, i], type: 'shanghai' });
        }

        // Phase 2: Doubles (Drei verschiedene Ziele pro Runde)
        let dList = [];
        if (targets) {
            dList = [...targets];
        } else {
            for (let i = 1; i <= 20; i++) dList.push(i);
            dList.push(25);
        }

        // Gruppiere Doppel in 3er Blöcke
        for (let i = 0; i < dList.length; i += 3) {
            let chunk = dList.slice(i, i + 3);
            // Falls am Ende weniger als 3 übrig sind, fülle mit dem letzten auf oder Bull
            while (chunk.length < 3) chunk.push(chunk[chunk.length - 1]);
            plan.push({ target: chunk, type: 'double' });
        }

        // Phase 3: Shanghai Ende
        for (let i = s2[0]; i <= s2[1]; i++) {
            plan.push({ target: [i, i, i], type: 'shanghai' });
        }

        return plan;
    }

    get currentStep() {
        return this.gamePlan[this.round - 1];
    }

    get currentTargets() {
        if (this.isFinished || !this.currentStep) return [];
        return this.currentStep.target; 
    }

    get currentTargetRings() {
        if (this.isFinished || !this.currentStep) return ['S', 'S', 'S'];
        const ring = this.currentStep.type === 'double' ? 'D' : 'S';
        return [ring, ring, ring];
    }

    get displayStats() {
        return [
            { label: 'Punkte', value: this.points, color: 'text-success' },
            { label: 'Ziel', value: this.minPointsRequired, color: 'text-warning' },
            { label: 'Runde', value: `${this.round}/${this.maxRounds}`, color: 'text-info' }
        ];
    }

    get highlights() {
        if (this.isFinished || !this.currentStep) return [];
        const step = this.currentStep;
        
        // Mappt alle 3 Ziele für das Board-Highlighting (wie in DoublesWarmup)
        return step.target.map((t, idx) => ({
            value: t,
            multiplier: step.type === 'double' ? 2 : 1,
            isFullSegment: step.type === 'shanghai',
            dartIndex: idx
        }));
    }

    registerHit(val, mult) {
        if (this.isFinished || this.currentRoundThrows.length >= 3) return;

        this.saveHistory();
        const step = this.currentStep;
        const dartIdx = this.currentRoundThrows.length;
        const targetForThisDart = step.target[dartIdx];
        
        const isCorrectNumber = (val === targetForThisDart);
        let pointsGained = 0;

        if (step.type === 'shanghai') {
            if (isCorrectNumber) {
                pointsGained = val * mult;
                this.stats.hits++;
                if (mult === 2) this.stats.doubles++;
                if (mult === 3) this.stats.triples++;
            } else {
                this.stats.misses++;
            }
        } else {
            // Doubles Phase
            if (isCorrectNumber && mult === 2) {
                pointsGained = this.pointsPerDouble;
                this.stats.doubleHits++;
                this.stats.hits++;
            } else {
                this.stats.misses++;
            }
        }

        this.points += pointsGained;
        this.stats.totalDarts++;

        this.currentRoundThrows.push({
            val, mult, target: targetForThisDart,
            pointsGained,
            isHit: isCorrectNumber && (step.type === 'shanghai' || mult === 2),
            displayValue: val === 25 ? 'DB' : val
        });
    }

    nextRound() {
        if (this.isFinished) return;

        while (this.currentRoundThrows.length < 3) this.registerHit(0, 1);

        if (this.currentStep.type === 'shanghai') {
            const hits = this.currentRoundThrows;
            const hasS = hits.some(h => h.isHit && h.mult === 1);
            const hasD = hits.some(h => h.isHit && h.mult === 2);
            const hasT = hits.some(h => h.isHit && h.mult === 3);
            if (hasS && hasD && hasT) {
                this.points += 100;
                this.stats.shanghais++;
            }
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
                if (last.mult === 2) (this.currentStep.type === 'double' ? this.stats.doubleHits-- : this.stats.doubles--);
                if (last.mult === 3) this.stats.triples--;
            } else {
                this.stats.misses--;
            }
        } else if (this.history.length > 0) {
            const state = JSON.parse(this.history.pop());
            Object.assign(this, state);
            this.isFinished = false;
        }
    }

    saveHistory() {
        this.history.push(JSON.stringify({
            points: this.points,
            round: this.round,
            stats: { ...this.stats },
            currentRoundThrows: [...this.currentRoundThrows]
        }));
        if (this.history.length > 20) this.history.shift();
    }

    getFinalStats() {
        const hasWon = this.points >= this.minPointsRequired;
        const hitRate = this.stats.hits / (this.stats.totalDarts || 1);
        
        let sr = (this.points / (this.minPointsRequired || 500)) * 100;
        sr += (this.stats.shanghais * 25) + (this.stats.triples * 2);
        sr = Math.min(180, Math.max(0, Math.floor(sr)));

        let finalXP = this.config.xpBase;
        if (hasWon) {
            let bonusXP = 0;
            bonusXP += (this.stats.shanghais * 150);
            bonusXP += (this.stats.doubleHits * 20);
            bonusXP += (this.stats.triples * 30);
            
            const maxBonus = this.config.xpBase * 0.8;
            finalXP += Math.min(bonusXP, maxBonus);
            
            if (hitRate > 0.4) finalXP *= 1.2;
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
                shanghais: this.stats.shanghais,
                mode: this.isTraining ? "JDC Training" : `JDC Lvl ${this.level}`
            }
        };
    }
}