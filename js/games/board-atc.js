class AroundTheClock {
    constructor(config) {
        this.name = "Around the Clock";
        this.targets = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25];
        this.currentIndex = 0;
        this.totalThrows = 0;
        this.isFinished = false;
        this.firstDartHits = 0;
        this.isFirstDartOfTarget = true;
    }

    get currentTarget() {
        return this.targets[this.currentIndex];
    }

    registerThrow(isHit) {
        this.totalThrows++;
        
        if (isHit) {
            if (this.isFirstDartOfTarget) this.firstDartHits++;
            this.currentIndex++;
            this.isFirstDartOfTarget = true; // Neues Ziel, neuer erster Dart
            if (this.currentIndex >= this.targets.length) this.isFinished = true;
        } else {
            this.isFirstDartOfTarget = false;
        }
    }

    getInfoHTML() {
        return `Fortschritt: ${this.currentIndex} / ${this.targets.length}<br>Würfe: ${this.totalThrows}`;
    }

    getFinalStats() {
        const accuracy = ((this.targets.length / this.totalThrows) * 100).toFixed(1);
        return {
            xp: 100 + (this.firstDartHits * 10), // Bonus für 1. Dart Treffer
            stats: { 
                accuracy: accuracy, 
                total_throws: this.totalThrows,
                first_dart_hits: this.firstDartHits 
            }
        };
    }
}