import { ScoringX01Logic } from './scoring-x01-logic.js';
import { ScoringX01Control } from './scoring-x01-control.js';
import { ScoringBoardControl } from './scoring-board-control.js';
import { AroundTheClock, ATCLevelMapper } from './atc.js';
import { Shanghai, ShanghaiLevelMapper } from './shanghai.js';
import { Bermuda, BermudaLevelMapper } from './bermuda.js';
import { SectionHit, SectionHitLevelMapper } from './section-hit.js';
import { Game121, Game121LevelMapper } from './game-121.js';
import { CheckoutChallenge, CheckoutChallengeLevelMapper } from './checkout-challenge.js';
import { NumbersWarmup, NumbersWarmupLevelMapper } from './warmup-numbers.js';
import { WarmupController } from './warmup-control.js';
import { FinishingController } from './finishing-control.js';
import { DoublesWarmup, DoublesWarmupLevelMapper } from './doubles-warmup.js';
import { JDCWarmup, JDCWarmupLevelMapper } from './jdc-warmup.js';
import { BullsWarmup, BullsWarmupLevelMapper } from './bulls-warmup.js';
import { CountUpLogic, CountUpLevelMapper } from './countup-logic.js';
import { Catch40, Catch40LevelMapper } from './catch40.js'; 
import { XXonXX, XXonXXLevelMapper } from './XXonXX.js';
import { LevelSystem, CoopService } from '../supabase_client.js';


const GAME_CLASSES = {
    'atc': AroundTheClock,
    'shanghai': Shanghai,
    'bermuda': Bermuda,
    'sectionhit': SectionHit,
    'game121': Game121,
    'checkoutchallenge': CheckoutChallenge,
    'numbers-warmup': NumbersWarmup,
    'doubles-warmup': DoublesWarmup,
    'jdc-warmup': JDCWarmup,
    'bulls-warmup': BullsWarmup,
    'countup': CountUpLogic,
    'catch40': Catch40,
    'XXonXX': XXonXX,
    'x01': ScoringX01Logic
};

const LEVEL_MAPPERS = {
    'atc': ATCLevelMapper,
    'shanghai': ShanghaiLevelMapper,
    'bermuda': BermudaLevelMapper,
    'sectionhit': SectionHitLevelMapper,
    'game121': Game121LevelMapper,
    'checkoutchallenge': CheckoutChallengeLevelMapper,
    'numbers-warmup': NumbersWarmupLevelMapper,
    'doubles-warmup': DoublesWarmupLevelMapper,
    'jdc-warmup': JDCWarmupLevelMapper,
    'countup': CountUpLevelMapper,
    'catch40': Catch40LevelMapper,
    'XXonXX': XXonXXLevelMapper,
    'bulls-warmup': BullsWarmupLevelMapper
};

// --WAKELOCK--
let wakeLock = null;

const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Screen Wake Lock aktiv');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
};

// Reaktivieren, wenn man kurz die App wechselt und zurückkommt
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

export const GameManager = {
    currentGame: null,
    isTrainingMode: false,
    quickplayQueue: [],
    quickplayIndex: 0,
    isQuickplayActive: false,
    quickplayMode: null,
    
    // --- NEU: Multiplayer & Bot State ---
    players: [],
    activePlayerIndex: 0,
    isMultiplayer: false,

    // --- NAVIGATION & VIEWS ---
    hideAllViews() {
        const views = ['view-dashboard', 'view-training', 'view-challenge', 'view-games-list', 'view-game-active', 'view-game-x01', 'view-stats'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    },

    showCategoryGames(category, isTraining) {
        this.isTrainingMode = isTraining;
        const container = document.getElementById('view-games-list');
        const backTarget = isTraining ? 'training' : 'challenge';
        
        let title = category.toUpperCase();
        if(category === 'board') title = "Board Control";
        if(category === 'scoring') title = "Scoring";
        if(category === 'finishing') title = "Finishing";
        if(category === 'warmup') title = "Warmup";

        container.innerHTML = `
            <div class="nav-header">
                <button class="back-btn" onclick="window.navigate('${backTarget}')">
                    <i class="ri-arrow-left-s-line"></i> Zurück
                </button>
                <h2 class="view-title">${title} ${isTraining ? '(Training)' : '(Challenge)'}</h2>
            </div>
            <div class="category-grid animated-in"></div>
        `;
        
        const grid = container.querySelector('.category-grid');
        const games = [];

        if (category === 'board') {
            games.push({ id: 'atc', name: 'Around The Clock', icon: 'ri-time-line', active: true });
            games.push({ id: 'shanghai', name: 'Shanghai', icon: 'ri-building-line', active: true });
            games.push({ id: 'bermuda', name: 'Bermuda', icon: 'ri-ink-bottle-line', active: true });
            games.push({ id: 'sectionhit', name: 'Section Hit', icon: 'ri-focus-3-line', active: true });
        } else if (category === 'scoring') {
            games.push({ id: 'x01', name: 'X01 Training', icon: 'ri-numbers-line', active: true });
                games.push({ id: 'countup', name: 'Count Up', icon: 'ri-bar-chart-line', active: true });
            
        } else if (category === 'finishing') {
            games.push({ id: 'game121', name: '121 Challenge', icon: 'ri-focus-2-line', active: true });
            games.push({ id: 'checkoutchallenge', name: 'Checkout Challenge', icon: 'ri-target-line', active: true });
            games.push({ id: 'catch40', name: 'Catch 40', icon: 'ri-catch-line', active: true });
        } else if (category === 'warmup') {
            games.push({ id: 'numbers-warmup', name: '20, 19, 18 Warmup', icon: 'ri-fire-line', active: true });
            games.push({ id: 'doubles-warmup', name: 'Doubles Warmup', icon: 'ri-shield-line', active: true });
            games.push({ id: 'jdc-warmup', name: 'JDC Warmup', icon: 'ri-cup-line', active: true });
            games.push({ id: 'bulls-warmup', name: 'Bulls Warmup', icon: 'ri-record-circle-line', active: true });
        }

        games.forEach(g => {
            const card = document.createElement('div');
            card.className = `cat-card glass-panel ${!g.active ? 'locked' : ''}`;
            card.innerHTML = `<i class="${g.icon}"></i><span>${g.name}</span>`;
            if (g.active) card.onclick = () => this.handleGameSelection(g.id);
            grid.appendChild(card);
        });

        window.navigate('games-list');
    },

    // --- GAME SELECTION & SETUP ---
    async handleGameSelection(gameId) {
        const GameClass = GAME_CLASSES[gameId];
        if (!GameClass) return;

        if (this.isTrainingMode) {
            if (GameClass.getTrainingConfig) {
                this.hideAllViews();
                const config = GameClass.getTrainingConfig();
                this.showTrainingSetupModal(config, gameId);
            } else {
                this.loadGame(gameId, 1, true);
            }
        } else {
            // NEU: Opponent Modal für Challenge Mode zeigen anstatt direkt zu starten
            this.showOpponentSetupModal(gameId);
        }
    },

    showTrainingSetupModal(config, gameId) {
        const modal = document.getElementById('modal-game-setup');
        
        const fieldsHtml = config.options.map(opt => {
            if (opt.type === 'select') {
                return `
                    <div class="setup-group">
                        <label>${opt.label}</label>
                        <div class="option-grid">
                            ${opt.values.map((v, i) => `
                                <button class="opt-btn ${i === 0 ? 'active' : ''}" 
                                    onclick="selectModalOption(this, '${opt.id}', '${v.value}')">
                                    ${v.label}
                                </button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="setup-${opt.id}" value="${opt.values[0].value}">
                    </div>`;
            }
            if (opt.type === 'toggle') {
                return `
                    <div class="setup-group">
                        <div class="toggle-row">
                            <span>${opt.label}</span>
                            <label class="switch">
                                <input type="checkbox" id="setup-${opt.id}" ${opt.default ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>`;
            }
            if (opt.type === 'number') {
                return `
                    <div class="setup-group">
                        <label>${opt.label}</label>
                        <input type="number" id="setup-${opt.id}" value="${opt.default}" 
                               min="${opt.min}" max="${opt.max}" class="glass-input">
                    </div>`;
            }
        }).join('');

        modal.innerHTML = `
            <div class="setup-card glass-panel animated-in">
                <h2>${config.title}</h2>
                <div class="setup-fields">${fieldsHtml}</div>
                <div class="setup-actions">
                    <button class="glass-btn" onclick="window.closeSetupModal()">Cancel</button>
                    <button class="glass-btn primary" onclick="GameManager.confirmTrainingStart('${gameId}')">Start</button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },

    confirmTrainingStart(gameId) {
        const GameClass = GAME_CLASSES[gameId];
        const config = GameClass.getTrainingConfig();
        const settings = {};

        config.options.forEach(opt => {
            const el = document.getElementById(`setup-${opt.id}`);
            if (opt.type === 'toggle') {
                settings[opt.id] = el.checked;
            } else if (opt.type === 'number') {
                settings[opt.id] = parseInt(el.value);
            } else {
                settings[opt.id] = el.value;
            }
        });

        document.getElementById('modal-game-setup').classList.add('hidden');
        this.loadGame(gameId, 1, true, settings);
    },

    // --- NEU: OPPONENT MODAL & MULTIPLAYER START LOGIK ---
    showOpponentSetupModal(gameId) {
        const modal = document.getElementById('modal-game-setup');
        
        modal.innerHTML = `
            <div class="setup-card glass-panel animated-in">
                <h2 style="color: var(--neon-cyan); margin-bottom: 20px;">GEGNER WÄHLEN</h2>
                
                <div class="setup-group">
                    <label>Spielmodus</label>
                    <div class="option-grid">
                        <button class="opt-btn active" onclick="selectModalOption(this, 'opponent-mode', 'solo')">Solo</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'opponent-mode', 'bot')">Vs Bot</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'opponent-mode', 'local')">Local Coop</button>
                    </div>
                    <input type="hidden" id="setup-opponent-mode" value="solo">
                </div>

                <div id="bot-settings" class="setup-group hidden">
                    <label>Bot Schwierigkeit</label>
                    <div class="option-grid">
                        <button class="opt-btn active" onclick="selectModalOption(this, 'bot-diff', 'rookie')">Rookie</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'bot-diff', 'pro')">Pro</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'bot-diff', 'legend')">Legend</button>
                    </div>
                    <input type="hidden" id="setup-bot-diff" value="rookie">
                </div>

                <div id="local-settings" class="setup-group hidden">
                    <label>Spieler 2 (Quick Login oder Leer = Gast)</label>
                    <input type="email" id="p2-email" placeholder="E-Mail" class="glass-input" style="margin-bottom: 5px; padding: 10px;">
                    <input type="password" id="p2-password" placeholder="Passwort" class="glass-input" style="padding: 10px;">
                </div>

                <div class="setup-actions" style="margin-top: 20px;">
                    <button class="glass-btn" onclick="window.closeSetupModal()">Abbrechen</button>
                    <button class="glass-btn primary" onclick="GameManager.confirmOpponentStart('${gameId}')">Start</button>
                </div>
            </div>
        `;
        
        // Dynamisches Einblenden der Optionen
        const modeInput = document.getElementById('setup-opponent-mode');
        const observer = new MutationObserver(() => {
            document.getElementById('bot-settings').classList.toggle('hidden', modeInput.value !== 'bot');
            document.getElementById('local-settings').classList.toggle('hidden', modeInput.value !== 'local');
        });
        observer.observe(modeInput, { attributes: true, attributeFilter: ['value'] });

        modal.classList.remove('hidden');
    },

    async confirmOpponentStart(gameId) {
        const mode = document.getElementById('setup-opponent-mode').value;
        const botDiff = document.getElementById('setup-bot-diff').value;
        const p2Email = document.getElementById('p2-email')?.value;
        const p2Pass = document.getElementById('p2-password')?.value;

        document.getElementById('modal-game-setup').classList.add('hidden');
        this.isMultiplayer = (mode !== 'solo');
        this.players = [];

        // Spieler 1 (Hauptspieler)
        let finalLevel = 1;
        if (LEVEL_MAPPERS[gameId]) {
            try {
                const stats = await LevelSystem.getUserStats();
                finalLevel = LEVEL_MAPPERS[gameId](stats.level);
            } catch (e) { console.error(e); }
        }
        
        this.players.push({
            id: 1, 
            name: window.appState?.profile?.username || "Player 1", 
            gameId: gameId,
            level: finalLevel,
            isBot: false 
        });

        if (mode === 'solo') {
            this.loadGame(gameId, finalLevel, false);
            return;
        }

        // Spieler 2 Setup (Bot oder Lokaler Coop)
        if (mode === 'bot') {
            this.players.push({
                id: 2, 
                name: `Bot (${botDiff.toUpperCase()})`, 
                gameId: gameId,
                level: finalLevel,
                isBot: true, 
                botDifficulty: botDiff 
            });
       } else if (mode === 'local') {
            let p2Name = "Gast";
            
            // Prüfen, ob bereits ein Co-Op Partner aus dem vorherigen Spiel eingeloggt ist
            const existingPartner = CoopService.getCoopPartner();
            
            if (p2Email && p2Pass) {
                try {
                    // Nutze den vorbereiteten Service. Das setzt den globalen coopClient für den späteren Sync!
                    const profile = await CoopService.loginCoopPartner(p2Email, p2Pass);
                    if (profile) p2Name = profile.username;
                } catch (err) { 
                    console.error("P2 Login failed", err); 
                }
            } else if (existingPartner) {
                // Wenn die Felder leer sind, aber noch ein Partner eingeloggt ist
                p2Name = existingPartner.username;
            } else {
                // Wenn bewusst als Gast gespielt wird, alten Co-Op State bereinigen
                CoopService.logoutCoop();
            }

            this.players.push({ id: 2, name: p2Name, gameId: gameId, level: finalLevel, isBot: false });
        }
        this.activePlayerIndex = 0;
        this.startMultiplayerSequence(gameId, finalLevel, false);
    },

    async startMultiplayerSequence(gameId, level, isTraining) {
        // Instanziiere die Spiele für alle Spieler und speichere sie
        for (let p of this.players) {
            const GameClass = GAME_CLASSES[gameId];
            p.logicInstance = new GameClass(p.level, isTraining);
            
            // Controller für jeden Spieler anlegen, aber noch nicht init() aufrufen
            const type = p.logicInstance.interfaceType;
            if (type === "board-control") p.controller = new ScoringBoardControl(p.logicInstance);
            else if (type === "x01") p.controller = new ScoringX01Control(p.logicInstance);
            else if (type === "x01-warmup") p.controller = new WarmupController(p.logicInstance);
            else if (type === "finishing") p.controller = new FinishingController(p.logicInstance);
            else p.controller = p.logicInstance;
            
            this.lastGameId = gameId;
            this.lastGameLevel = level;
            this.lastIsTraining = isTraining;
        }

        this.activePlayerIndex = 0;
        this.applyActivePlayerView();
    },

    // --- NEU: RENDER FUNKTIONEN FÜR SPIELERWECHSEL ---
    applyActivePlayerView() {
        const activePlayer = this.players[this.activePlayerIndex];
        this.currentGame = activePlayer.controller;
        
        // Vollständiger Re-Render der UI für den aktuellen Spieler
        if (this.currentGame.init) this.currentGame.init();
        else if (this.currentGame.updateUI) this.currentGame.updateUI();

        // Sichtbar machen
        const targetView = (activePlayer.logicInstance.interfaceType === 'board-control') ? 'view-game-active' : 'view-game-x01';
        this.hideAllViews();
        const targetEl = document.getElementById(targetView);
        if (targetEl) targetEl.classList.remove('hidden');

        // Overlays & Bot Trigger
        if (this.isMultiplayer) {
            this.showPlayerSwitchOverlay(activePlayer.name);
            if (activePlayer.isBot && window.BotService) {
                // Den Bot etwas verzögert starten, damit das Overlay weg ist
                setTimeout(() => window.BotService.playTurn(this, activePlayer.botDifficulty), 2000);
            }
        }
    },

    showPlayerSwitchOverlay(playerName) {
        let overlay = document.getElementById('player-switch-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'player-switch-overlay';
            document.body.appendChild(overlay);
        }
        
        overlay.innerHTML = `<h1 style="font-family: 'Orbitron'; font-size: 3rem; text-shadow: 0 0 20px var(--neon-cyan);">${playerName.toUpperCase()}<br><span style="font-size: 1rem; color: #fff;">IST DRAN</span></h1>`;
        overlay.className = 'switch-overlay-active';
        
        setTimeout(() => overlay.className = 'switch-overlay-hidden', 1500);
    },

    switchTurn() {
        if (!this.isMultiplayer) return;
        this.activePlayerIndex = 1 - this.activePlayerIndex;
        this.applyActivePlayerView();
    },

    // --- GAME ENGINE ---
    async loadGame(gameId, requestedLevel = 1, isTraining = false, customSettings = null, forceLevel = false) {
        const GameClass = GAME_CLASSES[gameId];
        requestWakeLock();
        if (typeof requestWakeLock === 'function') {
            await requestWakeLock();
        }
        if (!GameClass) return;

        let finalLevel = requestedLevel;

        // --- Daily Workout Check ---
        if (this.isQuickplayActive && this.quickplayMode === 'daily' && !isTraining) { // <--- GEÄNDERT
            finalLevel = 'daily';
        } 
        else if (!isTraining && LEVEL_MAPPERS[gameId] && !forceLevel) {
            try {
                const stats = await LevelSystem.getUserStats();
                finalLevel = LEVEL_MAPPERS[gameId](stats.level);
            } catch (e) { console.error(e); }
        }

        this.lastGameId = gameId;
        this.lastGameLevel = finalLevel;
        this.lastIsTraining = isTraining;

        let instance;
        try {
            instance = new GameClass(finalLevel, isTraining, customSettings);
        } catch (error) {
            console.warn(`GameManager Fallback: ${gameId} unterstützt Level '${finalLevel}' nicht. Starte Level 1.`);
            instance = new GameClass(1, isTraining, customSettings);
            this.lastGameLevel = 1;
        }
        this.initInterface(instance);
        
        const targetView = (instance.interfaceType === 'board-control') ? 'view-game-active' : 'view-game-x01';
        this.hideAllViews();
        const targetEl = document.getElementById(targetView);
        if (targetEl) targetEl.classList.remove('hidden');
    },

    startQuickplaySequence(gameIds, mode= 'daily') {
        this.quickplayQueue = gameIds;
        this.quickplayIndex = 0;
        this.isQuickplayActive = true;
        this.quickplayMode = mode;
        
        document.getElementById('modal-game-setup').classList.add('hidden');
        this.loadGame(this.quickplayQueue[0], 1, false);
    },

    nextQuickplayGame() {
        this.quickplayIndex++;

 
        document.getElementById('modal-game-result').classList.add('hidden');
        document.body.classList.remove('game-active', 'hide-app-header'); 
       
        if (this.quickplayIndex < this.quickplayQueue.length) {
            const nextGameId = this.quickplayQueue[this.quickplayIndex];
            setTimeout(() => {
                this.loadGame(nextGameId, 1, false);
            }, 50);
        } else {
            this.closeResultModal();
        }
    },

    initInterface(gameInstance) {
        const type = gameInstance.interfaceType;
        if (type === "board-control") this.currentGame = new ScoringBoardControl(gameInstance);
        else if (type === "x01") this.currentGame = new ScoringX01Control(gameInstance);
        else if (type === "x01-warmup") this.currentGame = new WarmupController(gameInstance);
        else if (type === "finishing") this.currentGame = new FinishingController(gameInstance);
        else this.currentGame = gameInstance;
        
        if (this.currentGame.init) this.currentGame.init();
        else if (this.currentGame.updateUI) this.currentGame.updateUI();
    },

    // --- INPUTS ---
    handleBCInput(m) { this.currentGame?.handleInput?.(m); },
    
    // ANGEPASST FÜR TURN-SWITCH
<<<<<<< HEAD
    nextRoundBC() { 
        window.SoundManager?.play('next');
=======
   nextRoundBC() { 
        window.SoundManager?.play('next'); // NEU
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        this.currentGame?.nextRound?.(); 
        if (this.isMultiplayer && !this.currentGame.game.isFinished) {
            this.switchTurn();
        }
    },
<<<<<<< HEAD

  
    undoBC() { window.SoundManager?.play('undo'); this.currentGame?.undo?.(); },
    
    
    // ANGEPASST FÜR TURN-SWITCH
    nextRoundX01() { 
        window.SoundManager?.play('next');
=======
    
    undoBC() { window.SoundManager?.play('undo'); this.currentGame?.undo?.(); },
    
    // ANGEPASST FÜR TURN-SWITCH
    nextRoundX01() { 
        window.SoundManager?.play('next'); // NEU
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        if (this.currentGame && this.currentGame.nextRound) {
            this.currentGame.nextRound(); 
        } else if (this.currentGame && this.currentGame.game && this.currentGame.game.nextRound) {
            this.currentGame.game.nextRound();
        }
        
        if (this.isMultiplayer && !this.currentGame.game?.isFinished && !this.currentGame.isFinished) {
            this.switchTurn();
        }
    },

    handleInputX01(val) {
        if (!this.currentGame) return;
        if (this.currentGame.handleInput) this.currentGame.handleInput(val, this.currentGame.modifier || 1);
        else if (this.currentGame.registerHit) this.currentGame.registerHit(val);
    },

<<<<<<< HEAD
    handleModifier(m) { window.SoundManager?.play('click');
=======
    handleModifier(m) {
        window.SoundManager?.fastaudio.play('click');
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        if (this.currentGame && this.currentGame.setModifier) this.currentGame.setModifier(m);
    },

    undoX01() { window.SoundManager?.play('undo');this.currentGame?.undo?.(); },

    // --- FINISH & STATS ---
    async completeGame() {
        const activeLogic = this.currentGame.game || this.currentGame;
        const res = activeLogic.getFinalStats();
        
<<<<<<< HEAD
=======
        
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
        let p1FinalData = { xp: res.xp, stats: res.stats, sr: res.sr };
        let p2SyncPayload = null;

        // --- NEU: CO-OP LOGIK FÜR GETRENNTE STATS ---
        if (this.isMultiplayer && this.players.length >= 2) {
            const p1Logic = this.players[0].logicInstance;
            const p2Logic = this.players[1].logicInstance;
            
            if (p1Logic && p2Logic) {
                const statsP1 = p1Logic.getFinalStats();
                const statsP2 = p2Logic.getFinalStats();

                // ELO Logik für Spieler 1
                let srP1 = statsP1.sr || 0;
                const srCategory = activeLogic.srCategory || 'boardcontrol';

                if (window.appState.profile && !activeLogic.isTraining && LevelSystem.calculateElo) {
                    const srKey = `sr_${srCategory}`;
                    const currentSR = window.appState.profile[srKey] || 0;
                    const eloResult = LevelSystem.calculateElo(currentSR, statsP1.sr || 0);
                    srP1 = eloResult.newSR;
                }
                
                p1FinalData = { xp: statsP1.xp, stats: statsP1.stats, sr: srP1 };
                
                // Payload für Spieler 2 vorbereiten, sofern kein Bot
                if (!this.players[1].isBot) {
                    p2SyncPayload = {
                        xpGained: statsP2.xp,
                        matchStats: statsP2.stats,
                        srGained: statsP2.sr // SR wird bei P2 im RPC/Backend berechnet oder hier übernommen
                    };
                }
            }
        } else {
            // Solo Logik (Bestand)
            const srCategory = activeLogic.srCategory || 'boardcontrol';
            if (window.appState.profile && !activeLogic.isTraining && LevelSystem.calculateElo) {
                const srKey = `sr_${srCategory}`;
                const currentSR = window.appState.profile[srKey] || 0;
                const eloResult = LevelSystem.calculateElo(currentSR, res.sr || 0);
                p1FinalData.sr = eloResult.newSR;
            }
        }
<<<<<<< HEAD
=======
    


>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2

        const srCategory = activeLogic.srCategory || 'boardcontrol';

        // DB Sync mit dem neuen p2SyncPayload Argument
        const activePlayer = this.isMultiplayer ? this.players[this.activePlayerIndex] : null;
        const isBotPlaying = activePlayer && activePlayer.isBot;

        if (window.syncMatchToDatabase && !isBotPlaying) {
            await window.syncMatchToDatabase(
                p1FinalData.xp, 
                p1FinalData.stats, 
                p1FinalData.sr, 
                srCategory, 
                activeLogic.isTraining || false,
                p2SyncPayload
            );
        }
        
        // --- UI & MODAL ---
        const modal = document.getElementById('modal-game-result');
        if (!modal) {
            window.navigate('dashboard');
            return;
        }

        const profileHeader = document.getElementById('user-profile-header');
        const hudPlaceholder = document.getElementById('modal-hud-placeholder');
        if (profileHeader && hudPlaceholder) {
            hudPlaceholder.appendChild(profileHeader);
        }

        const titleEl = document.getElementById('res-title');
        titleEl.textContent = res.won ? "MISSION ACCOMPLISHED" : "MISSION FAILED";
        if (this.isMultiplayer) {
            titleEl.textContent = `${activePlayer.name.toUpperCase()} WINS!`;
        }
        titleEl.style.color = res.won ? "var(--neon-green)" : "var(--neon-red)";
        
        if (res.won) {
            titleEl.classList.add('neon-glow');
            this.launchConfetti();
        } else {
            titleEl.classList.remove('neon-glow');
        }

        const btnDone = document.querySelector('button[onclick="GameManager.closeResultModal()"]');
        const btnNext = document.getElementById('btn-quickplay-next');
        const btnLevelDown = document.getElementById('btn-level-down');

        if (this.isQuickplayActive) {
            if (this.quickplayIndex < this.quickplayQueue.length - 1) {
                if (btnNext) {
                    btnNext.classList.remove('hidden');
                    // GEÄNDERT: Zieht sich dynamisch die Länge der Queue (3 oder 5)
                    btnNext.innerHTML = `NEXT CHALLENGE (${this.quickplayIndex + 2}/${this.quickplayQueue.length}) <i class="ri-skip-forward-line"></i>`; 
                }
                if (btnDone) btnDone.classList.add('hidden');
            } else {
                if (btnNext) btnNext.classList.add('hidden');
                if (btnDone) {
                    btnDone.classList.remove('hidden');
                    btnDone.innerHTML = `FINISH QUICKPLAY <i class="ri-check-double-line"></i>`;
                }
            }
            if (btnLevelDown) btnLevelDown.classList.add('hidden');
        } else {
            if (btnNext) btnNext.classList.add('hidden');
            if (btnDone) {
                btnDone.classList.remove('hidden');
                btnDone.innerHTML = `WEITER <i class="ri-arrow-right-double-line"></i>`;
            }
            if (btnLevelDown) {
                if (!res.won && this.lastGameLevel > 1 && !activeLogic.isTraining && !this.isMultiplayer) {
                    btnLevelDown.classList.remove('hidden');
                } else {
                    btnLevelDown.classList.add('hidden');
                }
            }
        }

        if(this.renderDynamicStats) this.renderDynamicStats(res.stats);

        this.hideAllViews(); 
        modal.classList.remove('hidden');

        document.getElementById('xp-total').innerHTML = isBotPlaying ? "0 XP (Bot)" : "0 XP";
        if (!isBotPlaying) {
            this.animateValue('xp-total', 0, p1FinalData.xp, 1000, " XP");
        }
        
        if (p1FinalData.xp > 0 && this.triggerFloatingXP && !isBotPlaying) {
            setTimeout(() => this.triggerFloatingXP(p1FinalData.xp), 600);
        }
    },

   closeResultModal() {
        const profileHeader = document.getElementById('user-profile-header');
        const dashboardView = document.getElementById('view-dashboard');
        if (profileHeader && dashboardView) {
            dashboardView.insertBefore(profileHeader, dashboardView.firstChild);
        }

        this.isQuickplayActive = false;
        this.quickplayMode = null;
        this.quickplayQueue = [];
        this.quickplayIndex = 0;
        
        // Multiplay State aufräumen
        this.isMultiplayer = false;
        this.players = [];

        document.body.classList.remove('game-active', 'hide-app-header');
        
        document.getElementById('modal-game-result').classList.add('hidden');
        window.navigate('dashboard');
    },

    retryLowerLevel() {
        const profileHeader = document.getElementById('user-profile-header');
        const dashboardView = document.getElementById('view-dashboard');
        if (profileHeader && dashboardView) {
            dashboardView.insertBefore(profileHeader, dashboardView.firstChild);
        }
        document.body.classList.remove('game-active', 'hide-app-header');
        document.getElementById('modal-game-result').classList.add('hidden');

        if (this.lastGameId && this.lastGameLevel > 1) {
            this.loadGame(this.lastGameId, this.lastGameLevel - 1, this.lastIsTraining, null, true);
        }
    },

    renderDynamicStats(stats) {
        const grid = document.getElementById('dynamic-stats-grid');
        if (!grid) return;
        grid.innerHTML = ''; 
        
        const statLabels = {
            totalDarts: "Darts Thrown", darts: "Darts Thrown",
            hits: "Hits", misses: "Misses",
            doubles: "Doubles", triples: "Triples",
            singles: "Singles", maxStreak: "Max Streak",
            firstDartHits: "1st Dart Hits", avg: "Average",
            "180s": "180s Hit", completedSections: "Sections Cleared",
            checks: "Checkouts"
        };

        const ignoreKeys = ['mode', 'finalScore', 'points', 'malus', 'distribution', 'history', 'roundDarts', 'accuracy', 'hitRate'];

        Object.entries(stats).forEach(([key, value]) => {
            if (ignoreKeys.includes(key) || value === 0 || value === undefined) return;
            const labelName = statLabels[key] || key.toUpperCase();
            const box = document.createElement('div');
            box.className = 'res-dyn-stat';
            box.innerHTML = `
                <span class="label">${labelName}</span>
                <span class="value">${value}</span>
            `;
            grid.appendChild(box);
            box.style.opacity = '0';
            box.style.transform = 'translateY(10px)';
            setTimeout(() => {
                box.style.transition = 'all 0.4s ease-out';
                box.style.opacity = '1';
                box.style.transform = 'translateY(0)';
            }, Math.random() * 500 + 300);
        });
    },

    animateValue(id, start, end, duration, suffix = "") {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start) + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = end + suffix; 
            }
        };
        window.requestAnimationFrame(step);
    },

    triggerFloatingXP(xpAmount) {
        const xpBarTarget = document.getElementById('xp-bar');
        const originPoint = document.getElementById('xp-total');
        if (!xpBarTarget || !originPoint) return;

        const startRect = originPoint.getBoundingClientRect();
        const endRect = xpBarTarget.getBoundingClientRect();
        const particleCount = Math.min(15, Math.max(5, Math.floor(xpAmount / 50))); 

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'xp-particle';
            particle.textContent = '+XP';
            document.body.appendChild(particle);

            const startX = startRect.left + (Math.random() * startRect.width);
            const startY = startRect.top + (Math.random() * 20 - 10);
            particle.style.left = `${startX}px`;
            particle.style.top = `${startY}px`;

            const duration = Math.random() * 0.4 + 0.6; 
            setTimeout(() => {
                const endX = endRect.left + (endRect.width / 2);
                const endY = endRect.top + (endRect.height / 2);
                particle.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}s ease-in`;
                particle.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.3)`;
                particle.style.opacity = '0';
            }, 50);
            setTimeout(() => particle.remove(), duration * 1000 + 100);
        }
    },

    launchConfetti() {
        const colors = ['#4ade80', '#3b82f6', '#facc15', '#ff453a'];
        for(let i = 0; i < 60; i++) {
            const p = document.createElement('div');
            p.style.cssText = `position:fixed; width:${Math.random()*8+4}px; height:${Math.random()*8+4}px; background:${colors[Math.floor(Math.random()*colors.length)]}; top:-10px; left:${Math.random()*100}vw; z-index:9999; animation:confetti-fall ${Math.random()*3+2}s linear forwards;`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 5000);
        }
    }
};

window.selectModalOption = (btn, fieldId, value) => {
    btn.parentNode.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const hiddenInput = document.getElementById(`setup-${fieldId}`);
    if (hiddenInput) hiddenInput.value = value;
};

window.GameManager = GameManager;