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
import { LevelSystem } from '../supabase_client.js';

const GAME_CLASSES = {
    'atc': AroundTheClock,
    'shanghai': Shanghai,
    'bermuda': Bermuda,
    'sectionhit': SectionHit,
    'game121': Game121,
    'checkoutchallenge': CheckoutChallenge,
    'numbers-warmup': NumbersWarmup,
    'x01': ScoringX01Logic
};

const LEVEL_MAPPERS = {
    'atc': ATCLevelMapper,
    'shanghai': ShanghaiLevelMapper,
    'bermuda': BermudaLevelMapper,
    'sectionhit': SectionHitLevelMapper,
    'game121': Game121LevelMapper,
    'checkoutchallenge': CheckoutChallengeLevelMapper,
    'numbers-warmup': NumbersWarmupLevelMapper
};

export const GameManager = {
    currentGame: null,
    isTrainingMode: false,

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
        } else if (category === 'finishing') {
            games.push({ id: 'game121', name: '121 Challenge', icon: 'ri-focus-2-line', active: true });
            games.push({ id: 'checkoutchallenge', name: 'Checkout Challenge', icon: 'ri-target-line', active: true });
        } else if (category === 'warmup') {
            games.push({ id: 'numbers-warmup', name: '20, 19, 18 Warmup', icon: 'ri-fire-line', active: true });
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
    // --- GAME SELECTION & SETUP ---
async handleGameSelection(gameId) {
    const GameClass = GAME_CLASSES[gameId];
    if (!GameClass) return;

    if (this.isTrainingMode) {
        // X01 nutzt nun denselben generischen Weg wie 121
        if (GameClass.getTrainingConfig) {
            this.hideAllViews();
            const config = GameClass.getTrainingConfig();
            this.showTrainingSetupModal(config, gameId); // gameId mitgeben, um den Start-Button zu binden
        } else {
            this.loadGame(gameId, 1, true);
        }
    } else {
        // Challenge Modus Logik bleibt (direkter Start)
        this.loadGame(gameId, 1, false);
    }
},

   showTrainingSetupModal(config, gameId) {
        const modal = document.getElementById('modal-game-setup');
        
        // Generiere das HTML für die Optionen
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
                    <button class="glass-btn" onclick="document.getElementById('modal-game-setup').classList.add('hidden')">Abbrechen</button>
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

    // --- GAME ENGINE ---
  // Ersetze loadGame mit dieser Version (unterstützt forceLevel für "Level -1")
    async loadGame(gameId, requestedLevel = 1, isTraining = false, customSettings = null, forceLevel = false) {
        const GameClass = GAME_CLASSES[gameId];
        if (!GameClass) return;

        let finalLevel = requestedLevel;

        // Wenn nicht forciert, ermittle Level über die XP des Spielers
        if (!isTraining && LEVEL_MAPPERS[gameId] && !forceLevel) {
            try {
                const stats = await LevelSystem.getUserStats();
                finalLevel = LEVEL_MAPPERS[gameId](stats.level);
            } catch (e) { console.error(e); }
        }

        // Zustand merken (für Retry/Level Down)
        this.lastGameId = gameId;
        this.lastGameLevel = finalLevel;
        this.lastIsTraining = isTraining;

        const instance = new GameClass(finalLevel, isTraining, customSettings);
        this.initInterface(instance);
        
        const targetView = (instance.interfaceType === 'board-control') ? 'view-game-active' : 'view-game-x01';
        this.hideAllViews();
        document.getElementById(targetView)?.classList.remove('hidden');
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
    nextRoundBC()   { this.currentGame?.nextRound?.(); },
    undoBC()         { this.currentGame?.undo?.(); },
    
nextRoundX01() { 
    if (this.currentGame && this.currentGame.nextRound) {
        this.currentGame.nextRound(); 
    } else if (this.currentGame && this.currentGame.game && this.currentGame.game.nextRound) {
        // Falls die Logik direkt angesprochen werden muss
        this.currentGame.game.nextRound();
    }
},

    handleInputX01(val) {
        if (!this.currentGame) return;
        if (this.currentGame.handleInput) this.currentGame.handleInput(val, this.currentGame.modifier || 1);
        else if (this.currentGame.registerHit) this.currentGame.registerHit(val);
    },

    handleModifier(m) {
        if (this.currentGame && this.currentGame.setModifier) this.currentGame.setModifier(m);
    },

    undoX01() { this.currentGame?.undo?.(); },

  // --- FINISH & STATS ---
   async completeGame() {
        const logic = this.currentGame.game || this.currentGame;
        const res = logic.getFinalStats();
        const stats = res.stats || {};
        const earnedXP = parseInt(res.xp) || 0; // Fix für NaN Bug bei XP
        
        // 1. Sync & HUD Update
        if (window.syncMatchToDatabase) {
            await window.syncMatchToDatabase(earnedXP, stats, res.sr || 0, logic.srCategory || 'scoring', logic.isTraining);
        }
        
        const modal = document.getElementById('modal-game-result');
        if (!modal) {
            window.navigate('dashboard');
            return;
        }

        // 2. HUD in Modal verschieben
        const profileHeader = document.getElementById('user-profile-header');
        const hudPlaceholder = document.getElementById('modal-hud-placeholder');
        if (profileHeader && hudPlaceholder) {
            hudPlaceholder.appendChild(profileHeader);
        }

        // 3. Header & Titel
        const titleEl = document.getElementById('res-title');
        titleEl.textContent = res.won ? "MISSION ACCOMPLISHED" : "MISSION FAILED";
        titleEl.style.color = res.won ? "var(--neon-green)" : "var(--neon-red)";
        
        if (res.won) {
            titleEl.classList.add('neon-glow');
            this.launchConfetti();
        } else {
            titleEl.classList.remove('neon-glow');
        }

        // 4. "Level -1" Button Logik
        const btnLevelDown = document.getElementById('btn-level-down');
        if (btnLevelDown) {
            // Nur anzeigen wenn: Verloren, Level > 1 und KEIN Training
            if (!res.won && this.lastGameLevel > 1 && !logic.isTraining) {
                btnLevelDown.classList.remove('hidden');
            } else {
                btnLevelDown.classList.add('hidden');
            }
        }

        // 5. Dynamische Stats rastern (Helfer-Funktion bleibt unangetastet)
        if(this.renderDynamicStats) this.renderDynamicStats(stats);

        this.hideAllViews(); 
        modal.classList.remove('hidden');

        // Sicherheitshalber Display auf 0 setzen bevor die Animation startet
        document.getElementById('xp-total').innerHTML = "0 XP";

        // 6. XP Animation & Particles
        this.animateValue('xp-total', 0, earnedXP, 1000, " XP");
        
        if (earnedXP > 0 && this.triggerFloatingXP) {
            setTimeout(() => this.triggerFloatingXP(earnedXP), 600);
        }
    },

    closeResultModal() {
        // HUD zurück ins Dashboard schieben
        const profileHeader = document.getElementById('user-profile-header');
        const dashboardView = document.getElementById('view-dashboard');
        if (profileHeader && dashboardView) {
            dashboardView.insertBefore(profileHeader, dashboardView.firstChild);
        }

        // INTERFACE REFRESH: Zwingend diese beiden Klassen löschen!
        document.body.classList.remove('game-active', 'hide-app-header');
        
        document.getElementById('modal-game-result').classList.add('hidden');
        window.navigate('dashboard');
    },

    retryLowerLevel() {
        // HUD zurück ins Dashboard schieben
        const profileHeader = document.getElementById('user-profile-header');
        const dashboardView = document.getElementById('view-dashboard');
        if (profileHeader && dashboardView) {
            dashboardView.insertBefore(profileHeader, dashboardView.firstChild);
        }

        // Interface Refresh (Fullscreen beenden)
        document.body.classList.remove('game-active', 'hide-app-header');
        document.getElementById('modal-game-result').classList.add('hidden');

        // Spiel mit 1 Level niedriger neustarten (forceLevel = true umgeht den XP Calculator)
        if (this.lastGameId && this.lastGameLevel > 1) {
            this.loadGame(this.lastGameId, this.lastGameLevel - 1, this.lastIsTraining, null, true);
        }
    },

    renderDynamicStats(stats) {
        const grid = document.getElementById('dynamic-stats-grid');
        grid.innerHTML = ''; // Clear old stats
        
        // Mapping für schönere Namen (alles andere wird ignoriert oder formatiert)
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
            
            // Kleine Einblend-Animation
            box.style.opacity = '0';
            box.style.transform = 'translateY(10px)';
            setTimeout(() => {
                box.style.transition = 'all 0.4s ease-out';
                box.style.opacity = '1';
                box.style.transform = 'translateY(0)';
            }, Math.random() * 500 + 300);
        });
    },

    // In game-manager.js einfügen:

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
            // Stelle sicher, dass am Ende der genaue Wert steht
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

        // Spawne 8-15 Partikel für den "Gaming-Effekt"
        const particleCount = Math.min(15, Math.max(5, Math.floor(xpAmount / 50))); 

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'xp-particle';
            particle.textContent = '+XP';
            document.body.appendChild(particle);

            // Startposition (leicht um den Ursprung gestreut)
            const startX = startRect.left + (Math.random() * startRect.width);
            const startY = startRect.top + (Math.random() * 20 - 10);
            
            particle.style.left = `${startX}px`;
            particle.style.top = `${startY}px`;

            // Flugeigenschaften generieren
            const duration = Math.random() * 0.4 + 0.6; // 0.6s - 1.0s
            
            setTimeout(() => {
                // Fliegt zur Mitte des XP Balkens
                const endX = endRect.left + (endRect.width / 2);
                const endY = endRect.top + (endRect.height / 2);
                
                particle.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}s ease-in`;
                particle.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.3)`;
                particle.style.opacity = '0';
            }, 50);

            // Aufräumen
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

// Globaler Helper
window.selectModalOption = (btn, fieldId, value) => {
    btn.parentNode.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const hiddenInput = document.getElementById(`setup-${fieldId}`);
    if (hiddenInput) hiddenInput.value = value;
};

window.GameManager = GameManager;