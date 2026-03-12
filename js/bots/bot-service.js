// js/bots/bot-service.js
export class BotService {
    constructor() {
        // Bot Profile: Leicht erweiterbar für z.B. "Phil Taylor" etc.
        this.profiles = {
            'rookie': { missChance: 0.30, tripleChance: 0.05, doubleChance: 0.10 },
            'pro':    { missChance: 0.10, tripleChance: 0.20, doubleChance: 0.15 },
            'legend': { missChance: 0.02, tripleChance: 0.40, doubleChance: 0.30 }
        };
    }

    // Haupt-Einstiegspunkt, wird vom GameManager aufgerufen
    async playTurn(gameManager, difficulty) {
        const stats = this.profiles[difficulty] || this.profiles['pro'];
        const controller = gameManager.currentGame;
        const game = controller.game || controller; // Fallback falls Logic direkt genutzt wird

        // Wirf 3 Darts mit menschlicher Verzögerung
        for (let i = 0; i < 3; i++) {
            if (game.isFinished) break;
            
            // Menschliche Pause vor dem Wurf (800ms - 1500ms)
            await new Promise(res => setTimeout(res, 800 + Math.random() * 700));
            
            const throwData = this.calculateThrow(game, controller.interfaceType, stats);

            // Simuliere den Input exakt so, wie es ein echter User tun würde
            if (controller.interfaceType === 'board-control') {
                gameManager.handleBCInput(throwData.multiplier);
            } else {
                gameManager.handleModifier(throwData.multiplier);
                gameManager.handleInputX01(throwData.value);
            }
        }

        // Runde beenden nach kurzem Warten
        await new Promise(res => setTimeout(res, 1200));
        if (controller.interfaceType === 'board-control') {
            gameManager.nextRoundBC();
        } else {
            gameManager.nextRoundX01();
        }
    }

    calculateThrow(game, interfaceType, stats) {
        const rand = Math.random();
        let targetValue = 20; // Default Scoring Target
        
        // Versuche das echte Ziel aus dem Spiel zu lesen (falls vorhanden)
        if (game.currentTargetNumber) targetValue = game.currentTargetNumber; // Board Control
        else if (game.currentTarget) targetValue = game.currentTarget; // Finishing
        
        if (rand < stats.missChance) return { value: 0, multiplier: 0 }; // Miss
        if (rand < stats.missChance + stats.tripleChance) return { value: targetValue, multiplier: 3 }; // Triple
        if (rand < stats.missChance + stats.tripleChance + stats.doubleChance) return { value: targetValue, multiplier: 2 }; // Double
        
        return { value: targetValue, multiplier: 1 }; // Single
    }
}

// Global verfügbar machen
window.BotService = new BotService();