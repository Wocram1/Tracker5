import { supabase } from '../supabase_client.js';

const STATUS_LABELS = {
    waiting: 'Wartet',
    ready: 'Bereit',
    live: 'Live',
    finished: 'Beendet',
    cancelled: 'Abgebrochen'
};

const ONLINE_GAME_SERVICE_CONFIG = {
    x01: {
        label: 'X01',
        startRpc: 'start_online_match',
        submitRpc: 'submit_x01_turn',
        syncRpc: 'sync_my_online_room_result',
        startHandler: 'startOnlineX01Match',
        isBoardControl: false,
        buildSettings: (roomSettings, stateSettings) => ({
            startScore: roomSettings?.startScore || stateSettings?.startScore || 501,
            doubleOut: !!(roomSettings?.doubleOut || stateSettings?.doubleOut),
            doubleIn: !!(roomSettings?.doubleIn || stateSettings?.doubleIn)
        })
    },
    shanghai: {
        label: 'Shanghai',
        startRpc: 'start_online_shanghai_match',
        submitRpc: 'submit_shanghai_turn',
        syncRpc: 'sync_my_online_shanghai_result',
        startHandler: 'startOnlineShanghaiMatch',
        isBoardControl: true,
        buildSettings: (roomSettings, stateSettings) => ({
            level: roomSettings?.level || stateSettings?.level || 1,
            minPoints: stateSettings?.minPoints || null,
            rounds: stateSettings?.rounds || null
        })
    },
    atc: {
        label: 'ATC',
        startRpc: 'start_online_atc_match',
        submitRpc: 'submit_atc_turn',
        syncRpc: 'sync_my_online_atc_result',
        startHandler: 'startOnlineATCMatch',
        isBoardControl: true,
        buildSettings: (roomSettings, stateSettings) => ({
            level: roomSettings?.level || stateSettings?.level || 1,
            minPoints: stateSettings?.minPoints || null,
            rounds: stateSettings?.rounds || null,
            hitsPerTarget: stateSettings?.hitsPerTarget || 1
        })
    },
    game121: {
        label: '121',
        startRpc: 'start_online_121_match',
        submitRpc: 'submit_121_turn',
        syncRpc: 'sync_my_online_121_result',
        startHandler: 'startOnline121Match',
        isBoardControl: false,
        buildSettings: (roomSettings, stateSettings) => ({
            level: roomSettings?.level || stateSettings?.level || 1,
            start: stateSettings?.start || null,
            rounds: stateSettings?.rounds || null,
            check: stateSettings?.check || 'single',
            totalTargets: stateSettings?.totalTargets || null
        })
    },
    'jdc-warmup': {
        label: 'JDC',
        startRpc: 'start_online_jdc_match',
        submitRpc: 'submit_jdc_turn',
        syncRpc: 'sync_my_online_jdc_result',
        startHandler: 'startOnlineJDCMatch',
        isBoardControl: false,
        buildSettings: (roomSettings, stateSettings) => ({
            level: roomSettings?.level || stateSettings?.level || 1,
            minPoints: stateSettings?.minPoints || null,
            pointsPerDouble: stateSettings?.pointsPerDouble || null,
            maxRounds: stateSettings?.maxRounds || null
        })
    }
};

export const OnlineRoomService = {
    storageKey: 'ocram-online-room-session',
    room: null,
    players: [],
    state: null,
    stateVersion: null,
    roomResults: [],
    subscription: null,
    pollTimer: null,
    activePollingIntervalMs: null,
    currentUserId: null,
    lastError: '',
    refreshPromise: null,
    refreshRequestId: 0,
    startHandled: false,
    lobbyPollingIntervalMs: 1500,
    inMatchPollingIntervalMs: 1200,
    isRestoringSession: false,

    normalizeId(id) {
        return typeof id === 'string' ? id.toLowerCase() : id;
    },

    getResolvedCurrentUserId() {
        const userId = this.currentUserId || window.appState?.user?.id || null;
        return this.normalizeId(userId);
    },

    persistSession() {
        if (!this.room?.id) return;
        try {
            const payload = {
                roomId: this.room.id,
                roomCode: this.room.room_code || '',
                status: this.room.status || 'waiting',
                savedAt: Date.now()
            };
            window.localStorage?.setItem(this.storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('online session persist failed', error);
        }
    },

    clearPersistedSession() {
        try {
            window.localStorage?.removeItem(this.storageKey);
        } catch (error) {
            console.warn('online session clear failed', error);
        }
    },

    readPersistedSession() {
        try {
            const raw = window.localStorage?.getItem(this.storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.roomId) return null;
            return parsed;
        } catch (error) {
            console.warn('online session read failed', error);
            return null;
        }
    },

    getReconnectPromptMessage(persisted) {
        const code = persisted?.roomCode || '------';
        const status = persisted?.status || 'waiting';

        if (status === 'live') {
            return `Dein Online-Match in Raum ${code} scheint noch aktiv zu sein.\n\nOK = wieder verbinden\nAbbrechen = Match nicht fortsetzen und Raum verlassen`;
        }

        if (status === 'waiting' || status === 'ready') {
            return `Dein Online-Raum ${code} ist noch gespeichert.\n\nOK = wieder zur Lobby verbinden\nAbbrechen = Raum verlassen und nicht fortsetzen`;
        }

        return `Dein letzter Online-Raum ${code} ist noch gespeichert.\n\nOK = wieder verbinden\nAbbrechen = nicht fortsetzen`;
    },

    async abandonPersistedRoom(persisted) {
        if (!persisted?.roomId) {
            this.clearPersistedSession();
            return;
        }

        this.room = {
            id: persisted.roomId,
            room_code: persisted.roomCode || '',
            status: persisted.status || 'waiting'
        };

        await this.leaveRoom();
    },

    async restorePersistedRoom() {
        if (this.isRestoringSession || this.room?.id) return null;
        const persisted = this.readPersistedSession();
        if (!persisted?.roomId) return null;

        this.isRestoringSession = true;
        try {
            await this.ensureCurrentUser();

             if (['waiting', 'ready', 'live'].includes(persisted.status || 'waiting')) {
                const shouldReconnect = window.confirm(this.getReconnectPromptMessage(persisted));
                if (!shouldReconnect) {
                    await this.abandonPersistedRoom(persisted);
                    return null;
                }
            }

            this.room = {
                id: persisted.roomId,
                room_code: persisted.roomCode || '',
                status: persisted.status || 'waiting'
            };
            await this.subscribeToRoom(persisted.roomId);
            await this.refreshSnapshot();

            if (this.room?.status === 'waiting' || this.room?.status === 'ready') {
                window.UIController?.navigate?.('online-lobby');
                window.UIController?.renderOnlineLobby?.(this.getLobbyViewModel());
            } else if (this.room?.status === 'finished' || this.room?.status === 'cancelled') {
                window.GameManager?.renderOnlineMatchResult?.();
            }

            return this.getLobbyViewModel();
        } catch (error) {
            console.error('restorePersistedRoom failed', error);
            this.clearPersistedSession();
            this.room = null;
            this.players = [];
            this.state = null;
            this.subscription = null;
            return null;
        } finally {
            this.isRestoringSession = false;
        }
    },

    async ensureCurrentUser() {
        if (window.appState?.user?.id) {
            this.currentUserId = window.appState.user.id;
            return this.currentUserId;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        this.currentUserId = data?.user?.id || null;
        if (!this.currentUserId) throw new Error('Bitte zuerst einloggen.');
        return this.currentUserId;
    },

    getGameId() {
        return this.room?.game_id || this.state?.gameId || 'x01';
    },

    getGameConfig(gameId = this.getGameId()) {
        return ONLINE_GAME_SERVICE_CONFIG[gameId] || ONLINE_GAME_SERVICE_CONFIG.x01;
    },

    getGameLabel() {
        return this.getGameConfig().label;
    },

    getGameRpcName(type, gameId = this.getGameId()) {
        return this.getGameConfig(gameId)[`${type}Rpc`];
    },

    buildLobbySettings(gameId = this.getGameId()) {
        const roomSettings = this.room?.settings || {};
        const stateSettings = this.state?.settings || {};
        return this.getGameConfig(gameId).buildSettings(roomSettings, stateSettings);
    },

    createTurnPayload(gameId, throws) {
        if (this.getGameConfig(gameId).isBoardControl) {
            return {
                throws: throws.map(throwValue => {
                    if (typeof throwValue === 'number') return throwValue;
                    return throwValue?.mult ?? throwValue?.multiplier ?? 0;
                })
            };
        }

        return {
            throws: throws.map(throwData => ({
                val: throwData.base ?? throwData.val ?? 0,
                mult: throwData.mult ?? 1
            }))
        };
    },

    startOnlineGameView(gameId = this.getGameId()) {
        const startHandler = this.getGameConfig(gameId).startHandler;
        window.GameManager?.[startHandler]?.();
    },

    async createRoom(settings, gameId = 'x01') {
        await this.ensureCurrentUser();
        const { data, error } = await supabase.rpc('create_online_room', {
            p_game_id: gameId,
            p_settings: settings || {}
        });
        if (error) throw new Error(error.message || 'Raum konnte nicht erstellt werden.');

        this.room = {
            id: data.room_id,
            room_code: data.room_code,
            status: data.status,
            settings: settings || {},
            game_id: gameId
        };
        this.persistSession();
        await this.subscribeToRoom(data.room_id);
        await this.refreshSnapshot();
        return data;
    },

    async joinRoom(code) {
        await this.ensureCurrentUser();
        const { data, error } = await supabase.rpc('join_online_room', {
            p_room_code: code
        });
        if (error) throw new Error(error.message || 'Raum konnte nicht betreten werden.');

        this.room = {
            id: data.room_id,
            room_code: data.room_code,
            status: data.status
        };
        this.persistSession();
        await this.subscribeToRoom(data.room_id);
        await this.refreshSnapshot();
        return data;
    },

    async setReady(ready) {
        if (!this.room?.id) throw new Error('Kein aktiver Raum.');
        const { error } = await supabase.rpc('set_online_ready', {
            p_room_id: this.room.id,
            p_ready: ready
        });
        if (error) throw new Error(error.message || 'Ready-Status konnte nicht gesetzt werden.');
        await this.refreshSnapshot();
    },

    async startMatch() {
        if (!this.room?.id) throw new Error('Kein aktiver Raum.');
        const rpcName = this.getGameRpcName('start');
        const { error } = await supabase.rpc(rpcName, {
            p_room_id: this.room.id
        });
        if (error) throw new Error(error.message || 'Match konnte nicht gestartet werden.');
        await this.refreshSnapshot();
    },

    async leaveRoom() {
        try {
            if (this.room?.id) {
                await supabase.rpc('leave_online_room', { p_room_id: this.room.id });
            }
        } catch (error) {
            console.error('leaveRoom failed', error);
        }

        if (this.subscription) {
            await supabase.removeChannel(this.subscription);
        }

        this.stopPolling();

        this.room = null;
        this.players = [];
        this.state = null;
        this.stateVersion = null;
        this.roomResults = [];
        this.subscription = null;
        this.lastError = '';
        this.startHandled = false;
        this.clearPersistedSession();
    },

    async subscribeToRoom(roomId) {
        if (this.subscription) {
            await supabase.removeChannel(this.subscription);
        }

        this.startPolling(this.lobbyPollingIntervalMs);

        this.subscription = supabase
            .channel(`online-room-${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'online_rooms',
                filter: `id=eq.${roomId}`
            }, () => this.queueRefresh())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'online_room_players',
                filter: `room_id=eq.${roomId}`
            }, () => this.queueRefresh())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'online_room_state',
                filter: `room_id=eq.${roomId}`
            }, () => this.queueRefresh())
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    this.queueRefresh();
                }
            });
    },

    startPolling(intervalMs = 1500) {
        this.stopPolling();
        this.activePollingIntervalMs = intervalMs;
        this.pollTimer = window.setInterval(() => {
            if (!this.room?.id) return;
            this.queueRefresh();
        }, intervalMs);
    },

    stopPolling() {
        if (this.pollTimer) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.activePollingIntervalMs = null;
    },

    async queueRefresh() {
        if (!this.room?.id) return;
        if (this.refreshPromise) return this.refreshPromise;

        this.refreshPromise = this.refreshSnapshot()
            .catch(error => {
                console.error('online refresh failed', error);
                this.lastError = error.message || 'Realtime-Update fehlgeschlagen.';
                window.UIController?.renderOnlineLobby(this.getLobbyViewModel(this.lastError));
            })
            .finally(() => {
                this.refreshPromise = null;
            });

        return this.refreshPromise;
    },

    async refreshSnapshot() {
        if (!this.room?.id) return null;
        const requestId = ++this.refreshRequestId;
        if (!this.currentUserId && window.appState?.user?.id) {
            this.currentUserId = window.appState.user.id;
        }

        const roomId = this.room.id;
        const [
            roomRes,
            playersRes,
            stateRes,
            resultsRes
        ] = await Promise.all([
            supabase.from('online_rooms').select('*').eq('id', roomId).single(),
            supabase.from('online_room_players').select('*').eq('room_id', roomId).order('seat', { ascending: true }),
            supabase.from('online_room_state').select('*').eq('room_id', roomId).maybeSingle(),
            supabase.from('online_room_results').select('*').eq('room_id', roomId).order('seat', { ascending: true })
        ]);

        if (roomRes.error) throw roomRes.error;
        if (playersRes.error) throw playersRes.error;
        if (stateRes.error) throw stateRes.error;
        if (resultsRes.error) throw resultsRes.error;

        const playerIds = (playersRes.data || []).map(player => player.player_id);
        let profilesById = {};

        if (playerIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username')
                .in('id', playerIds);

            if (profilesError) throw profilesError;
            profilesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]));
        }

        if (requestId !== this.refreshRequestId) {
            return this.getLobbyViewModel();
        }

        this.room = roomRes.data;
        this.players = (playersRes.data || []).map(player => ({
            ...player,
            username: profilesById[player.player_id]?.username || 'Spieler'
        }));
        this.state = stateRes.data?.state || null;
        this.stateVersion = stateRes.data?.version ?? null;
        this.roomResults = (resultsRes.data || []).map(result => ({
            ...result,
            username: profilesById[result.player_id]?.username || 'Spieler'
        }));
        this.lastError = '';
        this.persistSession();

        if (this.room?.status === 'live') {
            const desiredLiveInterval = this.inMatchPollingIntervalMs;
            if (!this.pollTimer || this.activePollingIntervalMs !== desiredLiveInterval) {
                this.startPolling(desiredLiveInterval);
            }
        } else {
            const desiredLobbyInterval = this.lobbyPollingIntervalMs;
            if (!this.pollTimer || this.activePollingIntervalMs !== desiredLobbyInterval) {
                this.startPolling(desiredLobbyInterval);
            }
        }

        if (this.room?.status === 'live' && !this.startHandled) {
            this.startHandled = true;
            this.startOnlineGameView();
        }

        if (this.room?.status !== 'live') {
            this.startHandled = false;
        }

        if (this.room?.status === 'finished' || this.room?.status === 'cancelled') {
            this.stopPolling();
        }

        if (document.getElementById('view-online-lobby') && !document.getElementById('view-online-lobby').classList.contains('hidden')) {
            window.UIController?.renderOnlineLobby(this.getLobbyViewModel());
        }

        const x01Visible = document.getElementById('view-game-x01') && !document.getElementById('view-game-x01').classList.contains('hidden');
        const boardVisible = document.getElementById('view-game-active') && !document.getElementById('view-game-active').classList.contains('hidden');
        if (window.GameManager?.isOnlineMatch && (x01Visible || boardVisible)) {
            window.GameManager.applyOnlineRoomSnapshot?.();
        }

        return this.getLobbyViewModel();
    },

    isRoomLive() {
        return this.room?.status === 'live' && this.state?.status === 'live';
    },

    isRoomFinished() {
        return this.room?.status === 'finished' || this.state?.status === 'finished';
    },

    isMyTurn() {
        const currentUserId = this.getResolvedCurrentUserId();
        const activePlayerId = this.normalizeId(this.state?.currentTurnPlayerId || this.room?.active_player_id || null);
        return !!currentUserId && !!activePlayerId && activePlayerId === currentUserId;
    },

    getCurrentPlayerRecord() {
        const currentUserId = this.getResolvedCurrentUserId();
        return this.players.find(player => this.normalizeId(player.player_id) === currentUserId) || null;
    },

    getOpponentRecord() {
        const currentUserId = this.getResolvedCurrentUserId();
        return this.players.find(player => this.normalizeId(player.player_id) !== currentUserId) || null;
    },

    getCurrentPlayerState() {
        const currentUserId = this.getResolvedCurrentUserId();
        if (!currentUserId || !this.state?.players) return null;
        const entry = Object.entries(this.state.players).find(([playerId]) => this.normalizeId(playerId) === currentUserId);
        return entry ? entry[1] : null;
    },

    getOpponentState() {
        const opponent = this.getOpponentRecord();
        if (!opponent || !this.state?.players) return null;
        const opponentId = this.normalizeId(opponent.player_id);
        const entry = Object.entries(this.state.players).find(([playerId]) => this.normalizeId(playerId) === opponentId);
        return entry ? entry[1] : null;
    },

    getOnlineMatchSnapshot() {
        const activePlayerId = this.normalizeId(this.state?.currentTurnPlayerId || this.room?.active_player_id || null);
        return {
            gameId: this.getGameId(),
            room: this.room,
            state: this.state,
            roomResults: this.roomResults,
            currentPlayer: this.getCurrentPlayerRecord(),
            opponent: this.getOpponentRecord(),
            currentPlayerState: this.getCurrentPlayerState(),
            opponentState: this.getOpponentState(),
            activePlayerId,
            opponentConnected: this.getOpponentRecord()?.connected ?? true,
            isMyTurn: this.isMyTurn(),
            isFinished: this.isRoomFinished()
        };
    },

    async submitTurn(throws) {
        if (!this.room?.id) throw new Error('Kein aktiver Raum.');
        const gameId = this.getGameId();
        const previousStateVersion = this.stateVersion;
        const previousActivePlayerId = this.normalizeId(this.state?.currentTurnPlayerId || this.room?.active_player_id || null);
        const payload = this.createTurnPayload(gameId, throws);
        const rpcName = this.getGameRpcName('submit', gameId);
        const { error } = await supabase.rpc(rpcName, {
            p_room_id: this.room.id,
            p_turn: payload
        });

        if (error) throw new Error(error.message || 'Turn konnte nicht gesendet werden.');
        for (let attempt = 0; attempt < 6; attempt++) {
            await this.refreshSnapshot();
            const activePlayerId = this.normalizeId(this.state?.currentTurnPlayerId || this.room?.active_player_id || null);
            const serverAdvanced = this.stateVersion !== previousStateVersion
                || activePlayerId !== previousActivePlayerId
                || !this.isMyTurn()
                || this.isRoomFinished();
            if (serverAdvanced) break;
            await new Promise(resolve => window.setTimeout(resolve, 150));
        }
    },

    async syncMyMatchResult() {
        if (!this.room?.id) throw new Error('Kein aktiver Raum.');
        const rpcName = this.getGameRpcName('sync');
        const { data, error } = await supabase.rpc(rpcName, {
            p_room_id: this.room.id
        });
        if (error) throw new Error(error.message || 'Online-Ergebnis konnte nicht synchronisiert werden.');
        return data;
    },

    getLobbyViewModel(errorMessage = '') {
        const currentUserId = this.getResolvedCurrentUserId();
        const currentPlayer = this.players.find(player => this.normalizeId(player.player_id) === currentUserId);
        const isHost = !!this.room && this.normalizeId(this.room.host_id) === currentUserId;
        const gameId = this.getGameId();
        const settings = this.buildLobbySettings(gameId);

        return {
            roomId: this.room?.id || null,
            roomCode: this.room?.room_code || '',
            gameId,
            gameLabel: this.getGameLabel(),
            status: this.room?.status || 'waiting',
            statusLabel: STATUS_LABELS[this.room?.status] || 'Wartet',
            isHost,
            playerCount: this.players.length,
            allReady: this.players.length === 2 && this.players.every(player => player.ready),
            currentUserReady: !!currentPlayer?.ready,
            settings,
            error: errorMessage || this.lastError || '',
            players: this.players.map(player => ({
                id: player.player_id,
                name: player.username,
                seat: player.seat,
                ready: !!player.ready,
                connected: !!player.connected,
                isHost: this.normalizeId(this.room?.host_id) === this.normalizeId(player.player_id),
                isSelf: currentUserId === this.normalizeId(player.player_id)
            }))
        };
    }
};

window.OnlineRoomService = OnlineRoomService;

window.addEventListener('app:authenticated-session', () => {
    window.setTimeout(() => {
        OnlineRoomService.restorePersistedRoom();
    }, 0);
});
