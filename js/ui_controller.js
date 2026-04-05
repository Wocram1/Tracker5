import { htmlX01 } from './views/view-x01.js';
import { LevelSystem } from './supabase_client.js'; // Import fÃ¼r XP-Berechnung hinzugefÃ¼gt
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
const HAPTIC_CLICK_SELECTOR = '.primary-btn, .secondary-btn, .icon-only-btn, .back-nav-btn, .glass-btn, .adaptive-nav-btn, .opt-btn, .stat-pill, .overview-chip, .app-menu-trigger, .app-header-menu-item';

function restartAnimatedEntry(element) {
    if (!element) return;
    element.classList.remove('animated-in');
    void element.offsetWidth;
    element.classList.add('animated-in');
}

function triggerNativeClickFeedback() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

    const prefersReducedMotion = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    const isCoarsePointer = typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;

    if (prefersReducedMotion || !isCoarsePointer) return;
    navigator.vibrate(8);
}

function resetScrollableDescendants(root) {
    if (!root) return;
    root.scrollTop = 0;
    root.querySelectorAll('.online-flow-stack, .category-list, .stats-body, .scrollable-content').forEach(node => {
        node.scrollTop = 0;
    });
}

function buildOnlineLobbyRenderKey(viewModel) {
    if (!viewModel) return 'online-lobby:none';

    return JSON.stringify({
        roomId: viewModel.roomId || '',
        roomCode: viewModel.roomCode || '',
        gameId: viewModel.gameId || '',
        gameLabel: viewModel.gameLabel || '',
        status: viewModel.status || '',
        statusLabel: viewModel.statusLabel || '',
        isHost: !!viewModel.isHost,
        playerCount: viewModel.playerCount || 0,
        allReady: !!viewModel.allReady,
        currentUserReady: !!viewModel.currentUserReady,
        error: viewModel.error || '',
        settings: viewModel.settings || {},
        players: Array.isArray(viewModel.players)
            ? viewModel.players.map(player => ({
                id: player.id || '',
                name: player.name || '',
                seat: player.seat || 0,
                ready: !!player.ready,
                connected: !!player.connected,
                isHost: !!player.isHost,
                isSelf: !!player.isSelf
            }))
            : []
    });
}

const UIController = {
    DAILY_WORKOUT_IDS: ['numbers-warmup', 'XXonXX', 'catch40', 'game121', 'x01'],
    DAILY2_WORKOUT_IDS: ['numbers-warmup', 'XXonXX', 'catch40', 'game121', 'x01'],
    CUSTOM_QUICKPLAY_COUNT: 3,
    onlineLobbyRenderKey: '',
    profileHudMetricMode: 'darts',
    profileHudMetricTimer: null,
    profileHudSnapshot: null,
    profileHudPaneMode: 'profile',
    profileHudPaneTimer: null,
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

    syncAdaptiveNav(target) {
        const appScreen = document.getElementById('app-screen');
        if (appScreen) {
            appScreen.dataset.view = target || 'dashboard';
        }

        const group = target === 'online-setup' || target === 'online-lobby'
            ? 'online'
            : target === 'stats'
                ? 'stats'
                : target === 'training'
                    ? 'training'
                    : target === 'challenge'
                        ? 'challenge'
                        : target === 'dashboard'
                            ? 'dashboard'
                            : '';

        document.querySelectorAll('.adaptive-nav-btn').forEach(btn => {
            btn.classList.toggle('active', group !== '' && btn.dataset.navGroup === group);
        });
    },

    openHeaderMenu() {
        const menu = document.getElementById('app-header-menu');
        const trigger = document.getElementById('btn-app-menu');
        if (!menu || !trigger) return;
        menu.classList.remove('hidden');
        trigger.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
    },

    closeHeaderMenu() {
        const menu = document.getElementById('app-header-menu');
        const trigger = document.getElementById('btn-app-menu');
        if (!menu || !trigger) return;
        menu.classList.add('hidden');
        trigger.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
    },

    toggleHeaderMenu() {
        const menu = document.getElementById('app-header-menu');
        if (!menu) return;
        if (menu.classList.contains('hidden')) {
            this.openHeaderMenu();
            return;
        }
        this.closeHeaderMenu();
    },

    handleHeaderMenuAction(target) {
        this.closeHeaderMenu();
        if (target === 'online') {
            this.showOnlineSetup();
            return;
        }
        this.navigate(target);
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
            const statsView = document.getElementById('view-stats');
            statsView?.classList.remove('hidden');
            restartAnimatedEntry(statsView);
            resetScrollableDescendants(document.getElementById('content-area'));
            resetScrollableDescendants(statsView);
            this.syncAdaptiveNav('stats');
            this.closeHeaderMenu();
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
            restartAnimatedEntry(targetView);
            resetScrollableDescendants(document.getElementById('content-area'));
            resetScrollableDescendants(targetView);
        }

        this.syncAdaptiveNav(target);
        this.closeHeaderMenu();

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
        this.onlineLobbyRenderKey = '';
        this.closeOnlineGamePicker();
        this.closeOnlineSetupInfos();
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

    toggleOnlineGamePicker() {
        const panel = document.getElementById('online-game-picker-panel');
        const trigger = document.getElementById('online-game-picker-trigger');
        if (!panel || !trigger) return;

        const shouldOpen = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !shouldOpen);
        trigger.classList.toggle('active', shouldOpen);
        trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    },

    closeOnlineGamePicker() {
        const panel = document.getElementById('online-game-picker-panel');
        const trigger = document.getElementById('online-game-picker-trigger');
        if (!panel || !trigger) return;
        panel.classList.add('hidden');
        trigger.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
    },

    toggleOnlineSetupInfo(infoId) {
        const target = document.getElementById(infoId);
        if (!target) return;

        const shouldOpen = target.classList.contains('hidden');
        this.closeOnlineSetupInfos(infoId);
        target.classList.toggle('hidden', !shouldOpen);

        document.querySelectorAll(`.online-info-toggle[aria-controls="${infoId}"]`).forEach(btn => {
            btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
            btn.classList.toggle('active', shouldOpen);
        });
    },

    closeOnlineSetupInfos(exceptId = '') {
        document.querySelectorAll('#view-online-setup .online-info-popover, #view-online-lobby .online-info-popover').forEach(popover => {
            if (exceptId && popover.id === exceptId) return;
            popover.classList.add('hidden');
        });

        document.querySelectorAll('#view-online-setup .online-info-toggle, #view-online-lobby .online-info-toggle').forEach(btn => {
            if (exceptId && btn.getAttribute('aria-controls') === exceptId) return;
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('active');
        });
    },

    selectOnlineGame(gameId) {
        const normalizedGameId = this.normalizeOnlineGameId(gameId);
        const gameConfig = this.getOnlineGameConfig(normalizedGameId);
        const input = document.getElementById('online-game-id');
        const heroTitle = document.getElementById('online-setup-hero-title');
        const heroCopy = document.getElementById('online-setup-hero-copy');
        const pickerValue = document.getElementById('online-game-picker-value');

        if (input) input.value = normalizedGameId;
        if (pickerValue) pickerValue.textContent = gameConfig.label;

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

        this.closeOnlineGamePicker();
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
        this.onlineLobbyRenderKey = '';
        this.navigate('dashboard');
    },

    renderOnlineLobby(viewModel) {
        const container = document.getElementById('online-lobby-content');
        if (!container) return;

        const vm = viewModel || OnlineRoomService.getLobbyViewModel();
        const renderKey = buildOnlineLobbyRenderKey(vm);
        if (this.onlineLobbyRenderKey === renderKey && container.childElementCount > 0) {
            OnlineVideoService.mountLobbyElements();
            return;
        }

        this.onlineLobbyRenderKey = renderKey;

        const existingVideoRoot = container.querySelector('#online-video-root');
        if (existingVideoRoot) {
            existingVideoRoot.remove();
        }

        const playersHtml = vm.players.map(player => `
            <div class="online-player-card menu-card menu-card-level-3 ${player.isSelf ? 'online-player-self' : ''}">
                <div class="online-player-head">
                    <div>
                        <span class="online-seat-badge">Seat ${player.seat}</span>
                        <h3>${player.name}</h3>
                    </div>
                    <span class="online-ready-pill ${player.ready ? 'ready' : 'waiting'}">${player.ready ? 'Ready' : 'Wartet'}</span>
                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayCustomBuilder()">
                        <div class="qp-card-row">
                            <div class="qp-card-copy">
                                <h3 class="qp-card-title">Custom Queue</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">WÃ¤hle selbst 3 Spiele fÃ¼r deine Session</p>
                            </div>
                            <i class="ri-list-check-3 qp-card-icon"></i>
                        </div>
                    </div>
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
            <div class="glass-panel online-room-card menu-card menu-card-level-2">
                <div class="online-room-topline">
                    <div>
                        <span class="online-eyebrow">Privater Raum</span>
                        <h3>${lobbyTitle}</h3>
                    </div>
                    <div class="online-card-head-actions">
                        <button class="online-info-toggle" onclick="UIController.toggleOnlineSetupInfo('online-lobby-room-info')" aria-controls="online-lobby-room-info" aria-expanded="false">
                            <i class="ri-information-line"></i>
                        </button>
                        <span class="online-status-pill status-${vm.status}">${vm.statusLabel}</span>
                    </div>
                </div>

                <div class="online-room-code-block">
                    <span class="online-room-code-label">Room Code</span>
                    <div class="online-room-code">${vm.roomCode || '------'}</div>
                    <button class="glass-btn online-copy-btn" onclick="UIController.copyOnlineRoomCode()">Code kopieren</button>
                </div>

                <div class="online-room-settings">
                    ${settingsHtml}
                </div>

                <div id="online-lobby-room-info" class="online-info-popover hidden">
                    <p class="online-room-copy">${lobbyCopy}</p>
                </div>
                ${vm.error ? `<div class="error-msg">${vm.error}</div>` : ''}
            </div>

            <div class="online-player-grid">
                ${playersHtml}
            </div>

            <div id="online-video-slot"></div>

            <div class="glass-panel online-room-card online-cta-card menu-card menu-card-level-2">
                <div class="online-room-topline">
                    <div>
                        <span class="online-eyebrow">Aktionen</span>
                        <h3>${vm.gameLabel} Lobby Controls</h3>
                    </div>
                    <button class="online-info-toggle" onclick="UIController.toggleOnlineSetupInfo('online-lobby-action-info')" aria-controls="online-lobby-action-info" aria-expanded="false">
                        <i class="ri-information-line"></i>
                    </button>
                </div>
                <div id="online-lobby-action-info" class="online-info-popover hidden">
                    <p class="online-room-copy online-cta-copy">${canStart ? 'Beide Spieler sind bereit. Der Host kann das Match jetzt direkt starten.' : 'Setze zuerst deinen Ready-Status. Sobald beide Spieler bereit sind, wird der Start freigeschaltet.'}</p>
                </div>
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
        this.profileHudSnapshot = profile;

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
            
            const previousPercent = Number.parseFloat(xpFill.dataset.progress || '0') || 0;
            const percent = Math.max(0, Math.min(100, Math.floor((progressInLevel / neededForNext) * 100)));
            xpFill.dataset.progress = `${percent}`;
            xpFill.style.width = `${percent}%`;
            xpText.textContent = `${progressInLevel} / ${neededForNext} XP`;

            if (percent !== previousPercent) {
                xpFill.classList.remove('xp-fill-progressing');
                xpText.classList.remove('xp-label-progressing');
                void xpFill.offsetWidth;
                xpFill.classList.add('xp-fill-progressing');
                xpText.classList.add('xp-label-progressing');
            }
        }

        this.renderProfileHudMetric(profile);
        this.ensureProfileHudMetricRotator();
        this.ensureProfileHudPaneRotator();
    },

    renderProfileHudMetric(profile = this.profileHudSnapshot) {
        if (!profile) return;

        const metricEl = document.querySelector('.stat-mini-rotating');
        const iconEl = document.getElementById('profile-kpi-icon');
        const valueEl = document.getElementById('profile-kpi-value');
        const labelEl = document.getElementById('profile-kpi-label');
        if (!metricEl || !iconEl || !valueEl || !labelEl) return;

        const isGamesMode = this.profileHudMetricMode === 'games';
        metricEl.classList.remove('profile-hud-metric-anim');
        iconEl.className = isGamesMode ? 'ri-trophy-line' : 'ri-send-plane-fill';
        valueEl.textContent = isGamesMode
            ? (profile.total_games_played || 0).toLocaleString()
            : (profile.total_darts_thrown || 0).toLocaleString();
        labelEl.textContent = isGamesMode ? 'Games Played' : 'Darts Thrown';
        requestAnimationFrame(() => {
            metricEl.classList.add('profile-hud-metric-anim');
        });
    },

    ensureProfileHudMetricRotator() {
        if (this.profileHudMetricTimer) return;

        this.profileHudMetricTimer = window.setInterval(() => {
            this.profileHudMetricMode = this.profileHudMetricMode === 'darts' ? 'games' : 'darts';
            this.renderProfileHudMetric();
        }, 3000);
    },

    applyProfileHudPaneState() {
        const profilePane = document.getElementById('user-profile-header');
        const ratingsPane = document.getElementById('profile-sr-strip');
        if (!profilePane || !ratingsPane) return;

        const showRatings = this.profileHudPaneMode === 'ratings';
        profilePane.classList.toggle('dashboard-profile-pane-hidden', showRatings);
        ratingsPane.classList.toggle('dashboard-profile-pane-hidden', !showRatings);
    },

    scheduleNextProfileHudPaneSwitch() {
        window.clearTimeout(this.profileHudPaneTimer);
        const delay = this.profileHudPaneMode === 'profile' ? 7000 : 3000;
        this.profileHudPaneTimer = window.setTimeout(() => {
            this.profileHudPaneMode = this.profileHudPaneMode === 'profile' ? 'ratings' : 'profile';
            this.applyProfileHudPaneState();
            this.scheduleNextProfileHudPaneSwitch();
        }, delay);
    },

    ensureProfileHudPaneRotator() {
        this.applyProfileHudPaneState();
        if (this.profileHudPaneTimer) return;
        this.scheduleNextProfileHudPaneSwitch();
    },

    showChallengeCategories() {
        const container = document.getElementById('view-challenge').querySelector('.category-list') || 
                          document.getElementById('view-challenge').querySelector('.category-grid');
        if (!container) return;

        container.className = "category-list animated-in";
        container.innerHTML = `
            <div class="wide-card glass-card menu-card menu-card-level-2" onclick="UIController.prepareAndRenderGames('board', false)">
                <div class="wide-icon-left"><i class="ri-focus-3-line"></i></div>
                <div class="wide-content-center"><h3>Board Control</h3><p class="menu-card-copy">PrÃ¤zision und Segmentkontrolle.</p></div>
                <div class="wide-info-right"><i class="ri-information-line"></i></div>
            </div>
            <div class="wide-card glass-card menu-card menu-card-level-2" onclick="UIController.prepareAndRenderGames('finishing', false)">
                <div class="wide-icon-left"><i class="ri-check-double-line"></i></div>
                <div class="wide-content-center"><h3>Finishing</h3><p class="menu-card-copy">Checkouts, Wege und Drucksituationen.</p></div>
                <div class="wide-info-right"><i class="ri-information-line"></i></div>
            </div>
            <div class="wide-card glass-card menu-card menu-card-level-2" onclick="UIController.prepareAndRenderGames('scoring', false)">
                <div class="wide-icon-left"><i class="ri-numbers-line"></i></div>
                <div class="wide-content-center"><h3>Scoring</h3><p class="menu-card-copy">Rhythmus, Power und Konstanz.</p></div>
                <div class="wide-info-right"><i class="ri-information-line"></i></div>
            </div>
            <div class="wide-card glass-card menu-card menu-card-level-2" onclick="UIController.prepareAndRenderGames('warmup', false)">
                <div class="wide-icon-left"><i class="ri-fire-line"></i></div>
                <div class="wide-content-center"><h3>Warmup</h3><p class="menu-card-copy">Schnell reinfinden und locker starten.</p></div>
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
                <div class="sub-page-header-copy">
                    <h2 style="text-transform: capitalize;">${categoryKey} ${isTrainingMode ? '(Training)' : '(Challenge)'}</h2>
                    <p>${isTrainingMode ? 'WÃ¤hle dein nÃ¤chstes Trainingsspiel.' : 'WÃ¤hle deine nÃ¤chste Challenge.'}</p>
                </div>
            </div>
            <div id="games-container" class="category-list animated-in">
        `;

        games.forEach(game => {
            html += `
                <div class="wide-card glass-card menu-card menu-card-level-2 ${game.active ? '' : 'locked gray-scale'}" 
                     onclick="${game.active ? `selectGame('${game.id}')` : ''}">
                    <div class="wide-icon-left">
                        <i class="${game.icon}"></i>
                    </div>
                    <div class="wide-content-center">
                        <h3>${game.name}</h3>
                        ${!game.active ? '<p class="menu-card-status">Coming Soon</p>' : ''}
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

    // Hilfsfunktion um das Auswahl-MenÃ¼ wieder anzuzeigen
    showQuickplayOptions() {
        this.initQuickplay();
    },

    initQuickplay() {
        const modal = document.getElementById('modal-game-setup');
        const allGameIds = Object.values(this.gamesData).flat().filter(g => g.active).map(g => g.id);
        const randomQueue = [...allGameIds].sort(() => 0.5 - Math.random()).slice(0, 3);
        
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="document.getElementById('modal-game-setup').classList.add('hidden')"></div>
            <div class="setup-container glass-panel menu-modal animate-pop">
                <div class="setup-header">
                    <h2>Quickplay</h2>
                    <p>WÃ¤hle dein Trainingsformat</p>
                </div>

                <div class="qp-options-grid">
                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayPreview(['${this.DAILY_WORKOUT_IDS.join("','")}'], 'Daily Workout', 'daily')">
                        <div class="qp-card-row">
                            <div class="qp-card-copy">
                                <h3 class="qp-card-title qp-card-title-primary">Daily Workout</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">5 feste Spiele â€¢ ca 10-15mins</p>
                            </div>
                            <i class="ri-calendar-check-line qp-card-icon qp-card-icon-primary"></i>
                        </div>
                    </div>

                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayPreview(['${this.DAILY2_WORKOUT_IDS.join("','")}'], 'Daily 2', 'daily2')">
                        <div class="qp-card-row">
                            <div class="qp-card-copy">
                                <h3 class="qp-card-title">Daily 2</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">5 feste Spiele â€¢ eigener Daily2-Configpfad</p>
                            </div>
                            <i class="ri-calendar-event-line qp-card-icon"></i>
                        </div>
                    </div>

                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayPreview(['${randomQueue.join("','")}'], 'Random Mix', 'random')">
                        <div class="qp-card-row">
                            <div class="qp-card-copy">
                                <h3 class="qp-card-title">Random Mix</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">3 zufÃ¤llige Spiele â€¢ Kurze Session</p>
                            </div>
                            <i class="ri-shuffle-line qp-card-icon"></i>
                        </div>
                    </div>

                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayCustomBuilder()">
                        <div class="qp-card-row">
                            <div class="qp-card-copy">
                                <h3 class="qp-card-title">Custom Queue</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">WÃ¤hle selbst 3 Spiele fÃ¼r deine Session</p>
                            </div>
                            <i class="ri-list-check-3 qp-card-icon"></i>
                        </div>
                    </div>
                </div>

                <div class="qp-actions">
                    <button class="glass-btn menu-btn-secondary" onclick="document.getElementById('modal-game-setup').classList.add('hidden')">Abbrechen</button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },

    showQuickplayCustomBuilder() {
        const modal = document.getElementById('modal-game-setup');
        const allGames = Object.values(this.gamesData).flat().filter(g => g.active);
        const optionsHtml = allGames.map(game => `
            <button
                type="button"
                class="qp-custom-option glass-btn"
                data-qp-game-id="${game.id}"
                data-qp-game-name="${game.name}"
                data-qp-game-icon="${game.icon}"
                onclick="UIController.toggleCustomQuickplayOption(this)"
            >
                <span class="qp-custom-option-main">
                    <i class="${game.icon} qp-custom-option-icon"></i>
                    <span class="qp-custom-option-copy">
                        <strong>${game.name}</strong>
                        <small>${game.id}</small>
                    </span>
                </span>
                <span class="qp-custom-option-check">
                    <i class="ri-add-line"></i>
                </span>
            </button>
        `).join('');

        modal.innerHTML = `
            <div class="modal-backdrop" onclick="document.getElementById('modal-game-setup').classList.add('hidden')"></div>
            <div class="setup-container glass-panel menu-modal animate-pop">
                <div class="setup-header">
                    <h2>Custom Queue</h2>
                    <p>WÃ¤hle genau ${this.CUSTOM_QUICKPLAY_COUNT} Spiele fÃ¼r deine Quickplay-Session.</p>
                </div>

                <div class="qp-custom-toolbar">
                    <span id="qp-custom-counter" class="qp-custom-counter">0/${this.CUSTOM_QUICKPLAY_COUNT} gewÃ¤hlt</span>
                    <button class="glass-btn qp-custom-clear" type="button" onclick="UIController.clearCustomQuickplaySelection()">Auswahl leeren</button>
                </div>

                <div class="qp-custom-grid">
                    ${optionsHtml}
                </div>

                <div class="qp-actions qp-actions-split">
                    <button class="glass-btn" style="flex: 1;" onclick="UIController.showQuickplayOptions()">ZurÃ¼ck</button>
                    <button id="qp-custom-start" class="primary-btn flash-btn qp-btn-start disabled" type="button" onclick="UIController.startCustomQuickplay()" disabled>
                        QUEUE STARTEN <i class="ri-play-fill"></i>
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    toggleCustomQuickplayOption(button) {
        if (!button) return;

        const selected = Array.from(document.querySelectorAll('.qp-custom-option.is-selected'));
        const isSelected = button.classList.contains('is-selected');
        const maxSelections = this.CUSTOM_QUICKPLAY_COUNT;

        if (isSelected) {
            button.classList.remove('is-selected');
        } else {
            if (selected.length >= maxSelections) return;
            button.classList.add('is-selected');
        }

        this.updateCustomQuickplaySelectionUi();
    },

    clearCustomQuickplaySelection() {
        document.querySelectorAll('.qp-custom-option.is-selected').forEach(option => {
            option.classList.remove('is-selected');
        });
        this.updateCustomQuickplaySelectionUi();
    },

    updateCustomQuickplaySelectionUi() {
        const selected = Array.from(document.querySelectorAll('.qp-custom-option.is-selected'));
        const counter = document.getElementById('qp-custom-counter');
        const startButton = document.getElementById('qp-custom-start');
        const maxSelections = this.CUSTOM_QUICKPLAY_COUNT;

        document.querySelectorAll('.qp-custom-option').forEach(option => {
            const check = option.querySelector('.qp-custom-option-check i');
            const isSelected = option.classList.contains('is-selected');
            const selectionLimitReached = selected.length >= maxSelections;

            option.classList.toggle('is-locked', !isSelected && selectionLimitReached);
            if (check) {
                check.className = isSelected ? 'ri-check-line' : 'ri-add-line';
            }
        });

        if (counter) {
            counter.textContent = `${selected.length}/${maxSelections} gewÃ¤hlt`;
        }

        if (startButton) {
            const ready = selected.length === maxSelections;
            startButton.disabled = !ready;
            startButton.classList.toggle('disabled', !ready);
        }
    },

    startCustomQuickplay() {
        const selectedQueue = Array.from(document.querySelectorAll('.qp-custom-option.is-selected'))
            .slice(0, this.CUSTOM_QUICKPLAY_COUNT)
            .map(option => option.dataset.qpGameId)
            .filter(Boolean);

        if (selectedQueue.length !== this.CUSTOM_QUICKPLAY_COUNT) return;

        this.showQuickplayPreview(selectedQueue, 'Custom Queue', 'custom');
    },

    showQuickplaySessionSetup(queueIds, title, qpMode) {
        const modal = document.getElementById('modal-game-setup');

        modal.innerHTML = `
            <div class="modal-backdrop" onclick="document.getElementById('modal-game-setup').classList.add('hidden')"></div>
            <div class="setup-container glass-panel menu-modal animate-pop">
                <div class="setup-header">
                    <h2>${title}</h2>
                    <p>Wähle, wie du diese Queue spielen möchtest.</p>
                </div>

                <div class="setup-group">
                    <label>Spielmodus</label>
                    <div class="option-grid">
                        <button class="opt-btn active" onclick="selectModalOption(this, 'quickplay-mode', 'solo')">Solo</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'quickplay-mode', 'bot')">Vs Bot</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'quickplay-mode', 'local')">Local Coop</button>
                    </div>
                    <input type="hidden" id="setup-quickplay-mode" value="solo">
                </div>

                <div id="qp-bot-settings" class="setup-group hidden">
                    <label>Bot Schwierigkeit</label>
                    <div class="option-grid">
                        <button class="opt-btn active" onclick="selectModalOption(this, 'quickplay-bot-diff', 'rookie')">Rookie</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'quickplay-bot-diff', 'pro')">Pro</button>
                        <button class="opt-btn" onclick="selectModalOption(this, 'quickplay-bot-diff', 'legend')">Legend</button>
                    </div>
                    <input type="hidden" id="setup-quickplay-bot-diff" value="rookie">
                </div>

                <div id="qp-local-settings" class="setup-group hidden">
                    <label>Spieler 2 (Quick Login oder Leer = Gast)</label>
                    <input type="email" id="qp-p2-email" placeholder="E-Mail" class="glass-input" style="margin-bottom: 5px; padding: 10px;">
                    <input type="password" id="qp-p2-password" placeholder="Passwort" class="glass-input" style="padding: 10px;">
                    <p style="font-size: 0.78rem; opacity: 0.75; margin-top: 8px;">Beide Spieler spielen alle Spiele der Queue nacheinander. Ohne Login wird Spieler 2 als Gast geführt.</p>
                </div>

                <div class="qp-actions qp-actions-split">
                    <button class="glass-btn" style="flex: 1;" onclick="UIController.showQuickplayPreview(['${queueIds.join("','")}'], '${title}', '${qpMode}')">Zurück</button>
                    <button class="primary-btn flash-btn qp-btn-start" onclick="UIController.startQuickplayWithSession(['${queueIds.join("','")}'], '${qpMode}')">
                        QUEUE STARTEN <i class="ri-play-fill"></i>
                    </button>
                </div>
            </div>
        `;

        const modeInput = document.getElementById('setup-quickplay-mode');
        const syncQuickplayModePanels = () => {
            document.getElementById('qp-bot-settings')?.classList.toggle('hidden', modeInput.value !== 'bot');
            document.getElementById('qp-local-settings')?.classList.toggle('hidden', modeInput.value !== 'local');
        };
        syncQuickplayModePanels();
        new MutationObserver(syncQuickplayModePanels).observe(modeInput, {
            attributes: true,
            attributeFilter: ['value']
        });

        modal.classList.remove('hidden');
    },

    startQuickplayWithSession(queueIds, qpMode) {
        const sessionConfig = {
            mode: document.getElementById('setup-quickplay-mode')?.value || 'solo',
            botDifficulty: document.getElementById('setup-quickplay-bot-diff')?.value || 'rookie',
            p2Email: document.getElementById('qp-p2-email')?.value?.trim() || '',
            p2Pass: document.getElementById('qp-p2-password')?.value || ''
        };

        GameManager.startQuickplaySequenceWithSession(queueIds, qpMode, sessionConfig);
    },
    showQuickplayPreview(queueIds, title, qpMode) {
        const modal = document.getElementById('modal-game-setup');
        const allGames = Object.values(this.gamesData).flat();
        
        const gamesListHtml = queueIds.map((id, index) => {
            const game = allGames.find(g => g.id === id) || { name: id, icon: 'ri-play-line' };
            return `
                <div class="preview-item qp-preview-item">
                    <div class="qp-number">
                        ${index + 1}
                    </div>
                    <i class="${game.icon} qp-icon"></i>
                    <span class="qp-name">${game.name}</span>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-backdrop" onclick="document.getElementById('modal-game-setup').classList.add('hidden')"></div>
            <div class="setup-container glass-panel menu-modal animate-pop">
                <div class="setup-header">
                    <h2>${title}</h2>
                    <p>Folgende Challenges warten auf dich:</p>
                </div>

                <div class="preview-list qp-preview-list">
                    ${gamesListHtml}
                </div>

                <div class="qp-actions qp-actions-split">
                    <button class="glass-btn" style="flex: 1;" onclick="UIController.showQuickplayOptions()">ZurÃ¼ck</button>
                    <button class="primary-btn flash-btn qp-btn-start" onclick="UIController.showQuickplaySessionSetup(['${queueIds.join("','")}'], '${title}', '${qpMode}')">
                        JETZT STARTEN <i class="ri-play-fill"></i>
                    </button>
                </div>
            </div>
        `;
    }
};

// Globale Funktionen fÃ¼r HTML Access
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

document.addEventListener('click', (event) => {
    if (!event.target.closest(HAPTIC_CLICK_SELECTOR)) return;
    triggerNativeClickFeedback();
}, { passive: true });

document.addEventListener('click', (event) => {
    const menu = document.getElementById('app-header-menu');
    const shell = event.target.closest('.app-menu-shell');
    if (!menu || shell) return;
    UIController.closeHeaderMenu();
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    UIController.closeHeaderMenu();
});

document.getElementById('btn-app-menu')?.addEventListener('click', () => {
    UIController.toggleHeaderMenu();
});

