import { supabase } from '../supabase_client.js';

const STATUS_LABELS = {
    waiting: 'Wartet',
    ready: 'Bereit',
    live: 'Live',
    finished: 'Beendet',
    cancelled: 'Abgebrochen'
};

export const OnlineRoomService = {
    room: null,
    players: [],
    state: null,
    subscription: null,
    currentUserId: null,
    lastError: '',
    refreshPromise: null,
    startHandled: false,

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

    async createRoom(settings) {
        await this.ensureCurrentUser();
        const { data, error } = await supabase.rpc('create_online_room', {
            p_game_id: 'x01',
            p_settings: settings || {}
        });
        if (error) throw new Error(error.message || 'Raum konnte nicht erstellt werden.');

        this.room = {
            id: data.room_id,
            room_code: data.room_code,
            status: data.status,
            settings: settings || {}
        };
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
        const { error } = await supabase.rpc('start_online_match', {
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

        this.room = null;
        this.players = [];
        this.state = null;
        this.subscription = null;
        this.lastError = '';
        this.startHandled = false;
    },

    async subscribeToRoom(roomId) {
        if (this.subscription) {
            await supabase.removeChannel(this.subscription);
        }

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
            .subscribe();
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

        const roomId = this.room.id;
        const [
            roomRes,
            playersRes,
            stateRes
        ] = await Promise.all([
            supabase.from('online_rooms').select('*').eq('id', roomId).single(),
            supabase.from('online_room_players').select('*').eq('room_id', roomId).order('seat', { ascending: true }),
            supabase.from('online_room_state').select('*').eq('room_id', roomId).maybeSingle()
        ]);

        if (roomRes.error) throw roomRes.error;
        if (playersRes.error) throw playersRes.error;
        if (stateRes.error) throw stateRes.error;

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

        this.room = roomRes.data;
        this.players = (playersRes.data || []).map(player => ({
            ...player,
            username: profilesById[player.player_id]?.username || 'Spieler'
        }));
        this.state = stateRes.data?.state || null;
        this.lastError = '';

        if (this.room?.status === 'live' && !this.startHandled) {
            this.startHandled = true;
            window.GameManager?.startOnlineX01Match?.();
        }

        if (this.room?.status !== 'live') {
            this.startHandled = false;
        }

        if (document.getElementById('view-online-lobby') && !document.getElementById('view-online-lobby').classList.contains('hidden')) {
            window.UIController?.renderOnlineLobby(this.getLobbyViewModel());
        }

        if (window.GameManager?.isOnlineMatch && document.getElementById('view-game-x01') && !document.getElementById('view-game-x01').classList.contains('hidden')) {
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
        const currentUserId = this.currentUserId || window.appState?.user?.id || null;
        return !!currentUserId && this.state?.currentTurnPlayerId === currentUserId;
    },

    getCurrentPlayerRecord() {
        const currentUserId = this.currentUserId || window.appState?.user?.id || null;
        return this.players.find(player => player.player_id === currentUserId) || null;
    },

    getOpponentRecord() {
        const currentUserId = this.currentUserId || window.appState?.user?.id || null;
        return this.players.find(player => player.player_id !== currentUserId) || null;
    },

    getCurrentPlayerState() {
        const currentUserId = this.currentUserId || window.appState?.user?.id || null;
        return currentUserId ? (this.state?.players?.[currentUserId] || null) : null;
    },

    getOpponentState() {
        const opponent = this.getOpponentRecord();
        return opponent ? (this.state?.players?.[opponent.player_id] || null) : null;
    },

    getOnlineMatchSnapshot() {
        return {
            room: this.room,
            state: this.state,
            currentPlayer: this.getCurrentPlayerRecord(),
            opponent: this.getOpponentRecord(),
            currentPlayerState: this.getCurrentPlayerState(),
            opponentState: this.getOpponentState(),
            isMyTurn: this.isMyTurn(),
            isFinished: this.isRoomFinished()
        };
    },

    async submitTurn(throws) {
        if (!this.room?.id) throw new Error('Kein aktiver Raum.');
        const payload = {
            throws: throws.map(throwData => ({
                val: throwData.base ?? throwData.val ?? 0,
                mult: throwData.mult ?? 1
            }))
        };

        const { error } = await supabase.rpc('submit_x01_turn', {
            p_room_id: this.room.id,
            p_turn: payload
        });

        if (error) throw new Error(error.message || 'Turn konnte nicht gesendet werden.');
        await this.refreshSnapshot();
    },

    getLobbyViewModel(errorMessage = '') {
        const currentUserId = this.currentUserId || window.appState?.user?.id || null;
        const currentPlayer = this.players.find(player => player.player_id === currentUserId);
        const isHost = !!this.room && this.room.host_id === currentUserId;
        const settings = {
            startScore: this.room?.settings?.startScore || this.state?.settings?.startScore || 501,
            doubleOut: !!(this.room?.settings?.doubleOut || this.state?.settings?.doubleOut),
            doubleIn: !!(this.room?.settings?.doubleIn || this.state?.settings?.doubleIn)
        };

        return {
            roomId: this.room?.id || null,
            roomCode: this.room?.room_code || '',
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
                isHost: this.room?.host_id === player.player_id,
                isSelf: currentUserId === player.player_id
            }))
        };
    }
};

window.OnlineRoomService = OnlineRoomService;
