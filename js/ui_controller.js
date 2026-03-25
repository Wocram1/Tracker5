import { htmlX01 } from './views/view-x01.js';
import { LevelSystem } from './supabase_client.js'; // Import für XP-Berechnung hinzugefügt
import { StatsController } from './stats-controller.js';
import { OnlineRoomService } from './online/online-room-service.js';
import { OnlineVideoService } from './online/online-video-service.js';

const ONLINE_GAME_UI_CONFIG = {
    x01: {
        label: 'X01',
        heroTitle: 'Privater Raum fuer 1v1 X01',
        heroCopy: 'Erstelle einen Raumcode oder tritt einem bestehenden Raum bei. Fuer den Start stehen X01, Shanghai, ATC, 121 und JDC als private Duelle bereit.',
        liveViewLabel: 'Finishing-/X01-Ansicht',
        createSettings: () => ({
            startScore: 501,
            doubleOut: false,
            doubleIn: false
        }),
        renderSettings: (settings) => `
                <div class="online-setting-pill"><span>Mode</span><strong>X01</strong></div>
                <div class="online-setting-pill"><span>Start</span><strong>${settings.startScore}</strong></div>
                <div class="online-setting-pill"><span>Out</span><strong>${settings.doubleOut ? 'Double' : 'Single'}</strong></div>
            `
    },
    shanghai: {
        label: 'Shanghai',
        levelWrapId: 'online-shanghai-level-wrap',
        heroTitle: 'Privater Raum fuer 1v1 Shanghai',
        heroCopy: 'Erstelle einen privaten Shanghai-Raum, waehle das Start-Level und starte das Board-Control-Duell aus der Lobby.',
        liveViewLabel: 'Board-Control-Ansicht',
        createSettings: () => ({
            level: parseInt(document.getElementById('online-shanghai-level')?.value || '1', 10)
        }),
        renderSettings: (settings) => `
                <div class="online-setting-pill"><span>Mode</span><strong>Shanghai</strong></div>
                <div class="online-setting-pill"><span>Level</span><strong>${settings.level || 1}</strong></div>
                <div class="online-setting-pill"><span>Min</span><strong>${settings.minPoints || '--'}</strong></div>
            `
    },
    atc: {
        label: 'ATC',
        levelWrapId: 'online-atc-level-wrap',
        heroTitle: 'Privater Raum fuer 1v1 ATC',
        heroCopy: 'Erstelle einen privaten ATC-Raum, waehle das Start-Level und starte das Board-Control-Duell aus der Lobby.',
        liveViewLabel: 'Board-Control-Ansicht',
        createSettings: () => ({
            level: parseInt(document.getElementById('online-atc-level')?.value || '1', 10)
        }),
        renderSettings: (settings) => `
                <div class="online-setting-pill"><span>Mode</span><strong>ATC</strong></div>
                <div class="online-setting-pill"><span>Level</span><strong>${settings.level || 1}</strong></div>
                <div class="online-setting-pill"><span>Hits</span><strong>${settings.hitsPerTarget || 1}x</strong></div>
            `
    },
    game121: {
        label: '121',
        levelWrapId: 'online-121-level-wrap',
        heroTitle: 'Privater Raum fuer 1v1 121',
        heroCopy: 'Erstelle einen privaten 121-Raum, waehle das Start-Level und starte das Finishing-Duell direkt aus der Lobby.',
        liveViewLabel: 'Finishing-/X01-Ansicht',
        createSettings: () => ({
            level: parseInt(document.getElementById('online-121-level')?.value || '1', 10)
        }),
        renderSettings: (settings) => `
                <div class="online-setting-pill"><span>Mode</span><strong>121</strong></div>
                <div class="online-setting-pill"><span>Level</span><strong>${settings.level || 1}</strong></div>
                <div class="online-setting-pill"><span>Start</span><strong>${settings.start || '--'}</strong></div>
            `
    },
    'jdc-warmup': {
        label: 'JDC',
        levelWrapId: 'online-jdc-level-wrap',
        heroTitle: 'Privater Raum fuer 1v1 JDC',
        heroCopy: 'Erstelle einen privaten JDC-Raum, waehle das Start-Level und starte das Warmup-/X01-Duell direkt aus der Lobby.',
        liveViewLabel: 'Warmup-/X01-Ansicht',
        createSettings: () => ({
            level: parseInt(document.getElementById('online-jdc-level')?.value || '1', 10)
        }),
        renderSettings: (settings) => `
                <div class="online-setting-pill"><span>Mode</span><strong>JDC</strong></div>
                <div class="online-setting-pill"><span>Level</span><strong>${settings.level || 1}</strong></div>
                <div class="online-setting-pill"><span>Double</span><strong>${settings.pointsPerDouble || '--'}</strong></div>
                <div class="online-setting-pill"><span>Min</span><strong>${settings.minPoints || '--'}</strong></div>
                <div class="online-setting-pill"><span>Runs</span><strong>${settings.maxRounds || '--'}</strong></div>
            `
    }
};

const ONLINE_GAME_IDS = Object.keys(ONLINE_GAME_UI_CONFIG);

const UIController = {
    DAILY_WORKOUT_IDS: ['numbers-warmup', 'XXonXX', 'catch40', 'game121', 'x01'],
    // KORRIGIERTE IDs passend zu game-manager.js imports
    gamesData: {
        board: [
            { id: 'atc', name: 'Around the Clock', icon: 'ri-time-line', active: true },
            { id: 'shanghai', name: 'Shanghai', icon: 'ri-building-line', active: true },
            { id: 'bermuda', name: 'Bermuda', icon: 'ri-ink-bottle-line', active: true },
            { id: 'sectionhit', name: 'Section Hit', icon: 'ri-focus-3-line', active: true }
        ],
        finishing: [
            { id: 'game121', name: '121 Challenge', icon: 'ri-focus-2-line', active: true },
            { id: 'checkoutchallenge', name: 'Checkout Challenge', icon: 'ri-target-line', active: true },
            { id: 'catch40', name: 'Catch 40', icon: 'ri-catch-line', active: true }
        ], 
        scoring: [
            { id: 'x01', name: 'X01 Training', icon: 'ri-numbers-line', active: true },
            { id: 'countup', name: 'Count Up', icon: 'ri-bar-chart-line', active: true },
                { id: 'XXonXX', name: 'XXonXX', icon: 'ri-shuffle-line', active: true }
        ], 
        warmup: [
            { id: 'numbers-warmup', name: '20, 19, 18 Warmup', icon: 'ri-fire-line', active: true },
            { id: 'doubles-warmup', name: 'Double Mastery (16,8,4)', icon: 'ri-focus-3-line', active: true },
            { id: 'jdc-warmup', name: 'JDC Warmup', icon: 'ri-flashlight-line', active: true },
            { id: 'bulls-warmup', name: 'Bulls Mastery', icon: 'ri-record-circle-line', active: true }
        ]
    },

    navigate(target) {
        const views = [
            'view-dashboard', 
            'view-training', 
            'view-games-list', 
            'view-challenge', 
            'view-online-setup',
            'view-online-lobby',
            'view-stats', 
            'view-game-active', 
            'view-game-x01',
            'modal-game-setup',
            'modal-game-info',
            'modal-game-result'
        ];
        
        if (target === 'stats') {
            views.forEach(v => document.getElementById(v)?.classList.add('hidden'));
            document.getElementById('view-stats').classList.remove('hidden');
            if(window.StatsController) window.StatsController.loadStats();
            return;
        }

        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.classList.add('hidden');
        });

        const targetView = document.getElementById(`view-${target}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('animated-in');
        }

        window.OnlineVideoService?.syncUiVisibility?.();

        if (target === 'challenge') {
            this.showChallengeCategories();
        }
    },

    showOnlineSetup() {
        const errorEl = document.getElementById('online-setup-error');
        const codeInput = document.getElementById('online-room-code-input');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
        if (codeInput) codeInput.value = '';
        this.selectOnlineGame(this.getSelectedOnlineGame());
        this.navigate('online-setup');
    },

    getSelectedOnlineGame() {
        return document.getElementById('online-game-id')?.value || 'x01';
    },

    normalizeOnlineGameId(gameId) {
        return ONLINE_GAME_IDS.includes(gameId) ? gameId : 'x01';
    },

    getOnlineGameConfig(gameId) {
        return ONLINE_GAME_UI_CONFIG[this.normalizeOnlineGameId(gameId)];
    },

    selectOnlineGame(gameId) {
        const normalizedGameId = this.normalizeOnlineGameId(gameId);
        const gameConfig = this.getOnlineGameConfig(normalizedGameId);
        const input = document.getElementById('online-game-id');
        const heroTitle = document.getElementById('online-setup-hero-title');
        const heroCopy = document.getElementById('online-setup-hero-copy');

        if (input) input.value = normalizedGameId;

        ONLINE_GAME_IDS.forEach(optionGameId => {
            const option = document.getElementById(`online-game-${optionGameId}`);
            if (option) {
                option.classList.toggle('active', optionGameId === normalizedGameId);
            }
        });

        ONLINE_GAME_IDS.forEach(optionGameId => {
            const wrapId = ONLINE_GAME_UI_CONFIG[optionGameId].levelWrapId;
            if (!wrapId) return;

            const wrap = document.getElementById(wrapId);
            if (wrap) {
                wrap.classList.toggle('hidden', optionGameId !== normalizedGameId);
            }
        });

        if (heroTitle) {
            heroTitle.textContent = gameConfig.heroTitle;
        }

        if (heroCopy) {
            heroCopy.textContent = gameConfig.heroCopy;
        }
    },

    showOnlineSetupError(message) {
        const errorEl = document.getElementById('online-setup-error');
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    },

    async createOnlineRoom() {
        try {
            const gameId = this.normalizeOnlineGameId(this.getSelectedOnlineGame());
            const settings = this.getOnlineGameConfig(gameId).createSettings();

            await OnlineRoomService.createRoom(settings, gameId);
            this.navigate('online-lobby');
            this.renderOnlineLobby(OnlineRoomService.getLobbyViewModel());
        } catch (error) {
            console.error(error);
            this.showOnlineSetupError(error.message || 'Raum konnte nicht erstellt werden.');
        }
    },

    async joinOnlineRoom() {
        const input = document.getElementById('online-room-code-input');
        const code = input?.value?.trim()?.toUpperCase();
        if (!code) {
            this.showOnlineSetupError('Bitte gib einen 6-stelligen Raumcode ein.');
            return;
        }

        try {
            await OnlineRoomService.joinRoom(code);
            this.navigate('online-lobby');
            this.renderOnlineLobby(OnlineRoomService.getLobbyViewModel());
        } catch (error) {
            console.error(error);
            this.showOnlineSetupError(error.message || 'Raum konnte nicht betreten werden.');
        }
    },

    async toggleOnlineReady() {
        try {
            const vm = OnlineRoomService.getLobbyViewModel();
            await OnlineRoomService.setReady(!vm.currentUserReady);
        } catch (error) {
            console.error(error);
            this.renderOnlineLobby(OnlineRoomService.getLobbyViewModel(error.message || 'Ready-Status konnte nicht aktualisiert werden.'));
        }
    },

    async startOnlineMatch() {
        try {
            await OnlineRoomService.startMatch();
        } catch (error) {
            console.error(error);
            this.renderOnlineLobby(OnlineRoomService.getLobbyViewModel(error.message || 'Match konnte nicht gestartet werden.'));
        }
    },

    async leaveOnlineRoom() {
        const vm = OnlineRoomService.getLobbyViewModel();
        if (vm.status === 'live') {
            const shouldLeave = window.confirm('Das Match laeuft bereits. Wenn du den Raum jetzt verlaesst, wirst du als offline markiert und dein Gegner sieht den Disconnect. Wirklich verlassen?');
            if (!shouldLeave) return;
        }
        try {
            await OnlineRoomService.leaveRoom();
        } catch (error) {
            console.error(error);
        }
        this.navigate('dashboard');
    },

    renderOnlineLobby(viewModel) {
        const container = document.getElementById('online-lobby-content');
        if (!container) return;
        const existingVideoRoot = container.querySelector('#online-video-root');
        if (existingVideoRoot) {
            existingVideoRoot.remove();
        }

        const vm = viewModel || OnlineRoomService.getLobbyViewModel();
        const playersHtml = vm.players.map(player => `
            <div class="online-player-card ${player.isSelf ? 'online-player-self' : ''}">
                <div class="online-player-head">
                    <div>
                        <span class="online-seat-badge">Seat ${player.seat}</span>
                        <h3>${player.name}</h3>
                    </div>
                    <span class="online-ready-pill ${player.ready ? 'ready' : 'waiting'}">${player.ready ? 'Ready' : 'Wartet'}</span>
                </div>
                <div class="online-player-meta">
                    <span>${player.isHost ? 'Host' : 'Gastspieler'}</span>
                    <span>${player.connected ? 'Verbunden' : 'Offline'}</span>
                </div>
            </div>
        `).join('');

        const canStart = vm.isHost && vm.playerCount === 2 && vm.allReady && vm.status !== 'live';
        const disconnectedOpponent = vm.players.find(player => !player.isSelf && !player.connected);
        const gameConfig = this.getOnlineGameConfig(vm.gameId);
        const lobbyTitle = `${vm.gameLabel} Duel Lobby`;
        const liveViewLabel = gameConfig.liveViewLabel;
        const lobbyCopy = vm.status === 'live'
            ? (disconnectedOpponent
                ? 'Dein Gegner ist gerade offline. Sobald er zurueckkommt, laeuft das Match im selben Raum weiter.'
                : `Das Match laeuft. Beide Browser sollten automatisch in der ${liveViewLabel} landen.`)
            : (disconnectedOpponent
                ? 'Ein Spieler ist momentan offline. Der Raum bleibt bestehen und kann nach Reload wieder aufgenommen werden.'
                : 'Sobald beide Spieler bereit sind, kann der Host das Match starten.');

        const settingsHtml = gameConfig.renderSettings(vm.settings || {});

        container.innerHTML = `
            <div class="glass-panel online-room-card">
                <div class="online-room-topline">
                    <div>
                        <span class="online-eyebrow">Privater Raum</span>
                        <h3>${lobbyTitle}</h3>
                    </div>
                    <span class="online-status-pill status-${vm.status}">${vm.statusLabel}</span>
                </div>

                <div class="online-room-code-block">
                    <span class="online-room-code-label">Room Code</span>
                    <div class="online-room-code">${vm.roomCode || '------'}</div>
                    <button class="glass-btn online-copy-btn" onclick="UIController.copyOnlineRoomCode()">Code kopieren</button>
                </div>

                <div class="online-room-settings">
                    ${settingsHtml}
                </div>

                <p class="online-room-copy">${lobbyCopy}</p>
                ${vm.error ? `<div class="error-msg">${vm.error}</div>` : ''}
            </div>

            <div class="online-player-grid">
                ${playersHtml}
            </div>

            <div id="online-video-slot"></div>

            <div class="glass-panel online-room-card online-cta-card">
                <div class="online-room-topline">
                    <div>
                        <span class="online-eyebrow">Aktionen</span>
                        <h3>${vm.gameLabel} Lobby Controls</h3>
                    </div>
                </div>
                <p class="online-room-copy online-cta-copy">${canStart ? 'Beide Spieler sind bereit. Der Host kann das Match jetzt direkt starten.' : 'Setze zuerst deinen Ready-Status. Sobald beide Spieler bereit sind, wird der Start freigeschaltet.'}</p>
                <div class="online-lobby-actions">
                    <button class="glass-btn online-ready-btn" onclick="UIController.toggleOnlineReady()">${vm.currentUserReady ? 'Ready entfernen' : 'Ready setzen'}</button>
                    <button class="primary-btn online-start-btn ${canStart ? 'flash-btn' : ''}" ${canStart ? '' : 'disabled'} onclick="UIController.startOnlineMatch()">Match starten</button>
                </div>
                <button class="glass-btn online-leave-btn online-secondary-btn" onclick="UIController.leaveOnlineRoom()">Raum verlassen</button>
            </div>
        `;

        const videoSlot = container.querySelector('#online-video-slot');
        if (videoSlot) {
            if (existingVideoRoot) {
                videoSlot.replaceWith(existingVideoRoot);
            } else {
                videoSlot.outerHTML = OnlineVideoService.getLobbyMarkup();
            }
        }

        OnlineVideoService.mountLobbyElements();
    },

    async copyOnlineRoomCode() {
        const code = OnlineRoomService.getLobbyViewModel().roomCode;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
        } catch (error) {
            console.error('Clipboard failed', error);
        }
    },

    updateProfileDisplay(profile) {
        if (!profile) return;

        const nameEl = document.getElementById('display-name');
        const levelEl = document.getElementById('display-level'); 
        const xpFill = document.getElementById('display-xp-fill');
        const xpText = document.getElementById('display-xp');
        const headerContainer = document.getElementById('user-profile-header');
        
        if (nameEl) nameEl.textContent = profile.username;
        
        const lvl = LevelSystem.calcLevel(profile.xp || 0);
        if (levelEl) levelEl.textContent = lvl;

        let tierClass = 'tier-rookie';
        if (lvl > 60) tierClass = 'tier-legend';
        else if (lvl > 30) tierClass = 'tier-elite';
        else if (lvl > 10) tierClass = 'tier-pro';

        if (headerContainer) {
            headerContainer.classList.remove('tier-rookie', 'tier-pro', 'tier-elite', 'tier-legend');
            headerContainer.classList.add(tierClass);
        }

        if (xpFill && xpText) {
            const currentLvlXp = LevelSystem.xpForLevel(lvl);
            const nextLvlXp = LevelSystem.xpForLevel(lvl + 1);
            
            const neededForNext = nextLvlXp - currentLvlXp;
            const progressInLevel = (profile.xp || 0) - currentLvlXp;
            
            let percent = Math.floor((progressInLevel / neededForNext) * 100);
            xpFill.style.width = `${percent}%`;
            xpText.textContent = `${progressInLevel} / ${neededForNext} XP`;
        }
    },

    showChallengeCategories() {
        const container = document.getElementById('view-challenge').querySelector('.category-list') || 
                          document.getElementById('view-challenge').querySelector('.category-grid');
        if (!container) return;

        container.className = "category-list animated-in";
        container.innerHTML = `
            <div class="wide-card glass-card" onclick="UIController.prepareAndRenderGames('board', false)">
                <div class="wide-icon-left"><i class="ri-focus-3-line"></i></div>
                <div class="wide-content-center"><h3>Board Control</h3></div>
                <div class="wide-info-right"><i class="ri-information-line"></i></div>
            </div>
            <div class="wide-card glass-card" onclick="UIController.prepareAndRenderGames('finishing', false)">
                <div class="wide-icon-left"><i class="ri-check-double-line"></i></div>
                <div class="wide-content-center"><h3>Finishing</h3></div>
                <div class="wide-info-right"><i class="ri-information-line"></i></div>
            </div>
            <div class="wide-card glass-card" onclick="UIController.prepareAndRenderGames('scoring', false)">
                <div class="wide-icon-left"><i class="ri-numbers-line"></i></div>
                <div class="wide-content-center"><h3>Scoring</h3></div>
                <div class="wide-info-right"><i class="ri-information-line"></i></div>
            </div>
            <div class="wide-card glass-card" onclick="UIController.prepareAndRenderGames('warmup', false)">
                <div class="wide-icon-left"><i class="ri-fire-line"></i></div>
                <div class="wide-content-center"><h3>Warmup</h3></div>
                <div class="wide-info-right"><i class="ri-information-line"></i></div>
            </div>
        `;
    },

    prepareAndRenderGames(categoryKey, isTraining) {
        if (window.GameManager) {
            window.GameManager.isTrainingMode = isTraining;
        }
        this.renderGamesList(categoryKey, isTraining);
    },

    renderGamesList(categoryKey, isTrainingMode) {
        const container = document.getElementById('view-games-list');
        const games = this.gamesData[categoryKey];
        if (!container || !games) return;

        const backTarget = isTrainingMode ? 'training' : 'challenge';

        let html = `
            <div class="sub-page-header">
                <button class="back-nav-btn" onclick="navigate('${backTarget}')">
                    <i class="ri-arrow-left-s-line"></i>
                </button>
                <h2 style="text-transform: capitalize;">${categoryKey} ${isTrainingMode ? '(Training)' : '(Challenge)'}</h2>
            </div>
            <div id="games-container" class="category-list animated-in">
        `;

        games.forEach(game => {
            html += `
                <div class="wide-card glass-card ${game.active ? '' : 'locked gray-scale'}" 
                     onclick="${game.active ? `selectGame('${game.id}')` : ''}">
                    <div class="wide-icon-left">
                        <i class="${game.icon}"></i>
                    </div>
                    <div class="wide-content-center">
                        <h3>${game.name}</h3>
                        ${!game.active ? '<p style="font-size:0.7rem; color:red;">Coming Soon</p>' : ''}
                    </div>
                    <div class="wide-info-right">
                        <i class="ri-information-line"></i>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
        this.navigate('games-list');
    },

    showGamesByCategory(category) {
        this.prepareAndRenderGames(category, true);
    },

    // Hilfsfunktion um das Auswahl-Menü wieder anzuzeigen
    showQuickplayOptions() {
        this.initQuickplay();
    },

    initQuickplay() {
        const modal = document.getElementById('modal-game-setup');
        const allGameIds = Object.values(this.gamesData).flat().filter(g => g.active).map(g => g.id);
        const randomQueue = [...allGameIds].sort(() => 0.5 - Math.random()).slice(0, 3);
        
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="document.getElementById('modal-game-setup').classList.add('hidden')"></div>
            <div class="setup-container glass-panel animate-pop">
                <div class="setup-header">
                    <h2>Quickplay</h2>
                    <p>Wähle dein Trainingsformat</p>
                </div>

                <div class="qp-options-grid" style="display: grid; gap: 15px; margin-bottom: 20px;">
                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayPreview(['${this.DAILY_WORKOUT_IDS.join("','")}'], 'Daily Workout', 'daily')" style="padding: 20px; text-align: left;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 style="color: var(--neon-cyan); margin: 0;">Daily Workout</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">5 feste Spiele • ca 10-15mins</p>
                            </div>
                            <i class="ri-calendar-check-line" style="font-size: 2rem; color: var(--neon-cyan);"></i>
                        </div>
                    </div>

                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayPreview(['${randomQueue.join("','")}'], 'Random Mix', 'random')" style="padding: 20px; text-align: left;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 style="margin: 0;">Random Mix</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">3 zufällige Spiele • Kurze Session</p>
                            </div>
                            <i class="ri-shuffle-line" style="font-size: 2rem; opacity: 0.5;"></i>
                        </div>
                    </div>
                </div>

                <div class="qp-actions">
                    <button class="glass-btn" onclick="document.getElementById('modal-game-setup').classList.add('hidden')">Abbrechen</button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },

    showQuickplayPreview(queueIds, title, qpMode) {
        const modal = document.getElementById('modal-game-setup');
        const allGames = Object.values(this.gamesData).flat();
        
        const gamesListHtml = queueIds.map((id, index) => {
            const game = allGames.find(g => g.id === id) || { name: id, icon: 'ri-play-line' };
            return `
                <div class="preview-item" style="display: flex; align-items: center; gap: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-bottom: 8px;">
                    <div style="width: 30px; height: 30px; border-radius: 50%; background: var(--neon-cyan); color: black; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem;">
                        ${index + 1}
                    </div>
                    <i class="${game.icon}" style="font-size: 1.2rem; color: var(--neon-cyan);"></i>
                    <span style="font-weight: 600;">${game.name}</span>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-backdrop" onclick="document.getElementById('modal-game-setup').classList.add('hidden')"></div>
            <div class="setup-container glass-panel animate-pop">
                <div class="setup-header">
                    <h2 style="color: var(--neon-cyan);">${title}</h2>
                    <p>Folgende Challenges warten auf dich:</p>
                </div>

                <div class="preview-list" style="margin: 20px 0;">
                    ${gamesListHtml}
                </div>

                <div class="qp-actions" style="display: flex; gap: 10px;">
                    <button class="glass-btn" style="flex: 1;" onclick="UIController.showQuickplayOptions()">Zurück</button>
                    <button class="primary-btn flash-btn" style="flex: 2;" onclick="GameManager.startQuickplaySequence(['${queueIds.join("','")}'], '${qpMode}')">
                        JETZT STARTEN <i class="ri-play-fill"></i>
                    </button>
                </div>
            </div>
        `;
    }
};

// Globale Funktionen für HTML Access
window.navigate = (t) => UIController.navigate(t);
window.showGames = (c) => UIController.showGamesByCategory(c);
window.UIController = UIController;
window.closeSetupModal = () => {
    document.getElementById('modal-game-setup').classList.add('hidden');
    UIController.navigate('dashboard');
};

window.closeGameInfoModal = () => {
    document.getElementById('modal-game-info')?.classList.add('hidden');
};

window.selectGame = (id) => {
    if (window.GameManager) {
        window.GameManager.handleGameSelection(id);
    } else {
        console.error("GameManager not loaded");
    }
};

window.selectModalOption = (btn, fieldId, value) => {
    const parent = btn.parentNode;
    parent.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const hiddenInput = document.getElementById(`setup-${fieldId}`);
    if (hiddenInput) hiddenInput.value = value;
};
