import { supabase } from '../supabase_client.js';

const VIDEO_SIGNAL_EVENT = 'video_signal';
const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];
const VIDEO_UI_STORAGE_PREFIX = 'online-video-ui:';
const VIDEO_ICE_STORAGE_KEYS = [
    'online-video-ice-servers',
    'online-video-turn-config'
];

export const OnlineVideoService = {
    roomId: null,
    roomStatus: 'waiting',
    currentUserId: null,
    players: [],
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    signalSubscription: null,
    signalSubscriptionReadyPromise: null,
    pendingRemoteSignals: [],
    seenSignalKeys: [],
    signalReplayPromise: null,
    lastSignalReplayAt: 0,
    pendingIceCandidates: [],
    localVideoEls: new Set(),
    remoteVideoEls: new Set(),
    statusEls: new Set(),
    controlEls: new Set(),
    floatingDockEl: null,
    facingMode: 'user',
    isEnabled: false,
    isStarting: false,
    isReceiveOnlyMode: false,
    isDockExpanded: true,
    isRemoteAudioMuted: false,
    isRemoteVideoHidden: false,
    shouldAutoResumeVideo: false,
    autoResumeAttemptedForRoomId: null,
    dockPosition: null,
    dockDragState: null,
    dockDragCleanup: null,
    statusText: 'Kamera aus',
    remoteStatusText: 'Warte auf Gegnerkamera',
    lastError: '',
    lastSignalType: '-',
    lastSignalDirection: '-',
    lastSignalAt: '-',
    remotePlaybackBlocked: false,
    uiRefreshQueued: false,
    resolvedIceBundle: null,
    iceServerBundlePromise: null,
    offerPendingSince: null,
    localVideoSessionId: null,
    opponentVideoSessionId: null,
    opponentVideoReady: false,
    lastIceProbeStatus: '-',
    lastIceProbeAt: '-',
    lifecycleBound: false,
    reconnectTimer: null,
    isEndingForRoomState: false,

    normalizeId(id) {
        return typeof id === 'string' ? id.toLowerCase() : id;
    },

    generateVideoSessionId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return `video-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    },

    getRoomStorageKey(roomId = this.roomId) {
        return roomId ? `${VIDEO_UI_STORAGE_PREFIX}${roomId}` : null;
    },

    getDefaultUiState() {
        return {
            isDockExpanded: true,
            isRemoteAudioMuted: false,
            isRemoteVideoHidden: false,
            shouldAutoResumeVideo: false,
            dockPosition: null
        };
    },

    loadPersistedUiState(roomId = this.roomId) {
        const fallbackState = this.getDefaultUiState();
        if (typeof window === 'undefined' || !window.localStorage) {
            return fallbackState;
        }

        const storageKey = this.getRoomStorageKey(roomId);
        if (!storageKey) return fallbackState;

        try {
            const rawValue = window.localStorage.getItem(storageKey);
            if (!rawValue) return fallbackState;

            const parsedValue = JSON.parse(rawValue);
            return {
                isDockExpanded: parsedValue?.isDockExpanded !== false,
                isRemoteAudioMuted: !!parsedValue?.isRemoteAudioMuted,
                isRemoteVideoHidden: !!parsedValue?.isRemoteVideoHidden,
                shouldAutoResumeVideo: !!parsedValue?.shouldAutoResumeVideo,
                dockPosition: parsedValue?.dockPosition
                    && Number.isFinite(parsedValue.dockPosition.left)
                    && Number.isFinite(parsedValue.dockPosition.top)
                    ? {
                        left: parsedValue.dockPosition.left,
                        top: parsedValue.dockPosition.top
                    }
                    : null
            };
        } catch (error) {
            console.warn('video ui state load failed', error);
            return fallbackState;
        }
    },

    applyPersistedUiState(roomId = this.roomId) {
        const uiState = this.loadPersistedUiState(roomId);
        this.isDockExpanded = uiState.isDockExpanded;
        this.isRemoteAudioMuted = uiState.isRemoteAudioMuted;
        this.isRemoteVideoHidden = uiState.isRemoteVideoHidden;
        this.shouldAutoResumeVideo = uiState.shouldAutoResumeVideo;
        this.dockPosition = uiState.dockPosition;
    },

    persistUiState() {
        if (typeof window === 'undefined' || !window.localStorage || !this.roomId) return;

        const storageKey = this.getRoomStorageKey();
        if (!storageKey) return;

        try {
            window.localStorage.setItem(storageKey, JSON.stringify({
                isDockExpanded: this.isDockExpanded,
                isRemoteAudioMuted: this.isRemoteAudioMuted,
                isRemoteVideoHidden: this.isRemoteVideoHidden,
                shouldAutoResumeVideo: this.shouldAutoResumeVideo,
                dockPosition: this.dockPosition
            }));
        } catch (error) {
            console.warn('video ui state persist failed', error);
        }
    },

    maybeAutoResumeVideo() {
        if (!this.roomId || !this.currentUserId) return;
        if (!this.canAutoResumeInCurrentRoom()) return;
        if (!this.shouldAutoResumeVideo || this.isEnabled || this.isStarting) return;
        if (this.autoResumeAttemptedForRoomId === this.roomId) return;

        this.autoResumeAttemptedForRoomId = this.roomId;
        this.startVideo({ autoResume: true }).catch(error => {
            console.warn('video auto resume failed', error);
        });
    },

    canAutoResumeInCurrentRoom() {
        return ['waiting', 'ready', 'live'].includes(this.roomStatus);
    },

    getRoomEndStatusText() {
        return this.roomStatus === 'cancelled' ? 'Raum beendet' : 'Match beendet';
    },

    syncRoomContext({ room, players, currentUserId }) {
        const nextRoomId = room?.id || null;
        const previousRoomId = this.roomId;
        this.roomId = nextRoomId;
        this.roomStatus = room?.status || 'waiting';
        this.players = Array.isArray(players) ? players : [];
        this.currentUserId = this.normalizeId(currentUserId);

        if (!this.roomId) {
            this.reset({ preserveUi: false });
            return;
        }

        if (previousRoomId !== nextRoomId) {
            this.applyPersistedUiState(nextRoomId);
            this.autoResumeAttemptedForRoomId = null;
            this.resolvedIceBundle = null;
            this.iceServerBundlePromise = null;
            this.signalSubscriptionReadyPromise = null;
            this.offerPendingSince = null;
            this.pendingRemoteSignals = [];
            this.seenSignalKeys = [];
            this.signalReplayPromise = null;
            this.lastSignalReplayAt = 0;
            this.localVideoSessionId = null;
            this.opponentVideoSessionId = null;
            this.opponentVideoReady = false;
            this.isEndingForRoomState = false;
        }

        if (!this.canAutoResumeInCurrentRoom()) {
            this.shouldAutoResumeVideo = false;
            this.opponentVideoReady = false;
            this.persistUiState();

            if ((this.isEnabled || this.isStarting) && !this.isEndingForRoomState) {
                const endStatus = this.getRoomEndStatusText();
                this.isEndingForRoomState = true;
                this.remoteStatusText = endStatus;
                this.stopVideo({
                    emitLeave: false,
                    preserveStatus: true,
                    keepAutoResume: false
                }).then(() => {
                    this.isEndingForRoomState = false;
                    this.setStatus(endStatus);
                    this.refreshUiState();
                }).catch(error => {
                    this.isEndingForRoomState = false;
                    console.warn('video room-end cleanup failed', error);
                });
            } else {
                const endStatus = this.getRoomEndStatusText();
                this.remoteStatusText = endStatus;
                this.setStatus(endStatus);
            }
        }

        this.ensureFloatingDock();
        this.updatePresenceState();
        this.syncUiVisibility();
        this.refreshUiState();

        if (this.isEnabled) {
            this.maybeReconnectToOpponent().catch(error => {
                console.warn('video reconnect check failed', error);
            });
        } else {
            this.maybeAutoResumeVideo();
        }
    },

    getCurrentPlayer() {
        return this.players.find(player => this.normalizeId(player.player_id) === this.currentUserId) || null;
    },

    getOpponentPlayer() {
        return this.players.find(player => this.normalizeId(player.player_id) !== this.currentUserId) || null;
    },

    isOpponentConnected() {
        const opponent = this.getOpponentPlayer();
        return !!opponent && opponent.connected !== false;
    },

    isInitiator() {
        const currentPlayer = this.getCurrentPlayer();
        return !!currentPlayer && Number(currentPlayer.seat) === 1;
    },

    hasOpponent() {
        return !!this.getOpponentPlayer();
    },

    getRuntimeVideoConfig() {
        const runtimeConfig = window.__OCRAM_VIDEO_CONFIG__;
        return runtimeConfig && typeof runtimeConfig === 'object' ? runtimeConfig : {};
    },

    isDebugEnabled() {
        const runtimeValue = this.getRuntimeVideoConfig().debugPanels;
        if (typeof runtimeValue === 'boolean') {
            return runtimeValue;
        }

        if (typeof window === 'undefined') return false;

        try {
            const params = new URLSearchParams(window.location.search || '');
            if (params.get('videoDebug') === '1') return true;
            if (params.get('videoDebug') === '0') return false;
        } catch (_error) {
        }

        const host = (window.location?.hostname || '').toLowerCase();
        if (!host) return false;
        if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return true;
        if (host.startsWith('192.168.') || host.startsWith('10.')) return true;

        return /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    },

    isSafariLikeBrowser() {
        const userAgent = navigator.userAgent || '';
        const isSafariEngine = /Safari/i.test(userAgent);
        const isOtherWebKitShell = /CriOS|FxiOS|EdgiOS|Chrome|Chromium|Android/i.test(userAgent);
        return isSafariEngine && !isOtherWebKitShell;
    },

    getIceServerEndpoint() {
        const endpoint = this.getRuntimeVideoConfig().iceServerEndpoint;
        return typeof endpoint === 'string' && endpoint.trim() ? endpoint.trim() : '';
    },

    canUseReceiveOnlyMode() {
        return this.isIOSLikeDevice()
            && !window.isSecureContext
            && this.getRuntimeVideoConfig().preferReceiveOnlyOnInsecureIOS !== false;
    },

    hasRemoteMedia() {
        return !!this.remoteStream?.getTracks?.().length;
    },

    shouldStartMicrophoneMuted() {
        return this.getRuntimeVideoConfig().startMicrophoneMuted !== false;
    },

    shouldPromptRemoteAudioUnlock() {
        return !!(this.hasRemoteMedia() && !this.isRemoteAudioMuted && this.remotePlaybackBlocked);
    },

    normalizeIceServers(value) {
        if (!Array.isArray(value)) return null;

        const normalizedServers = value.flatMap(server => {
            if (!server || typeof server !== 'object') return [];

            const urls = Array.isArray(server.urls)
                ? server.urls.filter(url => typeof url === 'string' && url.trim())
                : (typeof server.urls === 'string' && server.urls.trim() ? [server.urls] : []);

            if (!urls.length) return [];

            const normalizedServer = {
                urls: urls.length === 1 ? urls[0] : urls
            };

            if (typeof server.username === 'string' && server.username.trim()) {
                normalizedServer.username = server.username;
            }

            if (typeof server.credential === 'string' && server.credential.trim()) {
                normalizedServer.credential = server.credential;
            }

            if (typeof server.credentialType === 'string' && server.credentialType.trim()) {
                normalizedServer.credentialType = server.credentialType;
            }

            return [normalizedServer];
        });

        return normalizedServers.length ? normalizedServers : null;
    },

    getConfiguredIceBundle() {
        if (this.resolvedIceBundle?.iceServers?.length) {
            return this.resolvedIceBundle;
        }

        let iceServers = null;
        let source = 'default';

        try {
            const runtimeConfig = this.normalizeIceServers(window.__OCRAM_VIDEO_CONFIG__?.iceServers);
            if (runtimeConfig) {
                iceServers = runtimeConfig;
                source = 'window.__OCRAM_VIDEO_CONFIG__';
            }
        } catch (error) {
            console.warn('video runtime ice config load failed', error);
        }

        try {
            if (!iceServers) {
                const directConfig = this.normalizeIceServers(window.__OCRAM_VIDEO_ICE_SERVERS__);
                if (directConfig) {
                    iceServers = directConfig;
                    source = 'window.__OCRAM_VIDEO_ICE_SERVERS__';
                }
            }
        } catch (error) {
            console.warn('video direct ice config load failed', error);
        }

        if (!iceServers && typeof window !== 'undefined' && window.localStorage) {
            for (const storageKey of VIDEO_ICE_STORAGE_KEYS) {
                try {
                    const rawValue = window.localStorage.getItem(storageKey);
                    if (!rawValue) continue;

                    const parsedValue = JSON.parse(rawValue);
                    const localConfig = this.normalizeIceServers(parsedValue);
                    if (!localConfig) continue;

                    iceServers = localConfig;
                    source = `localStorage:${storageKey}`;
                    break;
                } catch (error) {
                    console.warn(`video ice config load failed for ${storageKey}`, error);
                }
            }
        }

        const resolvedIceServers = iceServers || DEFAULT_ICE_SERVERS;
        const hasTurn = resolvedIceServers.some(server => {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            return urls.some(url => typeof url === 'string' && /^turns?:/i.test(url));
        });

        return {
            iceServers: resolvedIceServers,
            source,
            hasTurn
        };
    },

    async ensureResolvedIceBundle() {
        const existingBundle = this.getConfiguredIceBundle();
        if (existingBundle.hasTurn) {
            this.resolvedIceBundle = existingBundle;
            return existingBundle;
        }

        const endpoint = this.getIceServerEndpoint();
        if (!endpoint) {
            this.resolvedIceBundle = existingBundle;
            return existingBundle;
        }

        if (this.iceServerBundlePromise) {
            return this.iceServerBundlePromise;
        }

        this.iceServerBundlePromise = (async () => {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        roomId: this.roomId,
                        ttl: this.getRuntimeVideoConfig().iceServerTtlSeconds
                    })
                });

                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(payload?.error || 'TURN-Credentials konnten nicht geladen werden.');
                }

                const fetchedIceServers = this.normalizeIceServers(payload?.iceServers);
                if (!fetchedIceServers) {
                    throw new Error('TURN-Antwort enthielt keine gueltigen ICE-Server.');
                }

                const resolvedBundle = {
                    iceServers: fetchedIceServers,
                    source: payload?.source || `endpoint:${endpoint}`,
                    hasTurn: fetchedIceServers.some(server => {
                        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                        return urls.some(url => typeof url === 'string' && /^turns?:/i.test(url));
                    })
                };

                this.resolvedIceBundle = resolvedBundle;
                return resolvedBundle;
            } catch (error) {
                console.warn('managed ice server fetch failed', error);
                return existingBundle;
            } finally {
                this.iceServerBundlePromise = null;
            }
        })();

        return this.iceServerBundlePromise;
    },

    async probeManagedIceServers() {
        this.recordIceProbeStatus('pruefe...');
        this.setStatus('TURN wird geprueft...');

        try {
            const iceBundle = await this.ensureResolvedIceBundle();
            const turnCount = iceBundle.iceServers.filter(server => {
                const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                return urls.some(url => typeof url === 'string' && /^turns?:/i.test(url));
            }).length;

            const summary = `${iceBundle.hasTurn ? 'TURN ok' : 'nur STUN'} via ${iceBundle.source}`;
            this.recordIceProbeStatus(`${summary} (${turnCount} turn)`);
            this.lastError = '';
            this.setStatus(iceBundle.hasTurn ? 'TURN bereit' : 'Kein TURN aktiv');
            return iceBundle;
        } catch (error) {
            console.error('OnlineVideoService.probeManagedIceServers failed', error);
            this.recordIceProbeStatus(`fehler: ${error?.message || 'Probe fehlgeschlagen'}`);
            this.lastError = error?.message || 'TURN-Probe fehlgeschlagen.';
            this.setStatus(this.lastError);
            throw error;
        }
    },

    getConfiguredIceServers() {
        return this.getConfiguredIceBundle().iceServers;
    },

    getIceTransportLabel() {
        const iceBundle = this.getConfiguredIceBundle();
        return iceBundle.hasTurn ? 'TURN bereit' : 'STUN only';
    },

    getAudioPolicyLabel() {
        if (this.canUseReceiveOnlyMode()) {
            return 'iOS: HTTPS fuer Send';
        }

        if (this.isSafariLikeBrowser()) {
            return 'Safari: Tap fuer Ton';
        }

        if (this.isIOSLikeDevice()) {
            return 'Mic stumm + Tap';
        }

        return 'Mic startet stumm';
    },

    getCameraTrack() {
        return this.localStream?.getVideoTracks?.()[0] || null;
    },

    isCompactVideoDevice() {
        if (typeof window === 'undefined') return false;
        const narrowViewport = window.innerWidth <= 820;
        const touchFirst = navigator.maxTouchPoints > 0;
        return narrowViewport || touchFirst;
    },

    getPerformancePreset() {
        const runtimeConfig = this.getRuntimeVideoConfig();

        if (this.isCompactVideoDevice()) {
            const mobilePreset = runtimeConfig.mobilePreset || {};
            return {
                label: mobilePreset.label || 'Mobile 360p',
                width: Number.isFinite(mobilePreset.width) ? mobilePreset.width : 640,
                height: Number.isFinite(mobilePreset.height) ? mobilePreset.height : 360,
                frameRate: Number.isFinite(mobilePreset.frameRate) ? mobilePreset.frameRate : 18
            };
        }

        const desktopPreset = runtimeConfig.desktopPreset || {};
        return {
            label: desktopPreset.label || 'Desktop 540p',
            width: Number.isFinite(desktopPreset.width) ? desktopPreset.width : 960,
            height: Number.isFinite(desktopPreset.height) ? desktopPreset.height : 540,
            frameRate: Number.isFinite(desktopPreset.frameRate) ? desktopPreset.frameRate : 24
        };
    },

    getPerformanceLabel() {
        return this.getPerformancePreset().label;
    },

    getConnectionIndicator() {
        if (!this.isEnabled) {
            return { label: 'Offline', tone: 'offline' };
        }

        if (this.hasRemoteMedia()) {
            return { label: 'Live', tone: 'live' };
        }

        if (this.reconnectTimer || this.remoteStatusText.includes('unterbrochen')) {
            return { label: 'Reconnect', tone: 'warning' };
        }

        const peerState = this.peerConnection?.connectionState || 'new';
        if (peerState === 'connecting') {
            return { label: 'Verbinde', tone: 'connecting' };
        }

        if (this.statusText.includes('Antwort') || this.remoteStatusText.includes('Antwort') || this.remoteStatusText.includes('bereit')) {
            return { label: 'Signaling', tone: 'connecting' };
        }

        if (this.hasOpponent()) {
            return { label: 'Bereit', tone: 'ready' };
        }

        return { label: 'Warte', tone: 'offline' };
    },

    getModeLabel() {
        if (!this.isEnabled) return 'Video aus';
        if (this.isReceiveOnlyMode) return 'Nur Empfang';
        return 'Zwei Wege';
    },

    getCameraLabel() {
        if (this.isReceiveOnlyMode) return 'Cam via HTTPS';
        const videoTrack = this.getCameraTrack();
        if (!this.isEnabled) return 'Cam aus';
        if (!videoTrack) return 'Keine Cam';
        return videoTrack.enabled ? 'Cam aktiv' : 'Cam pausiert';
    },

    getMicrophoneLabel() {
        if (this.isReceiveOnlyMode) return 'Mic via HTTPS';
        const microphoneTrack = this.getMicrophoneTrack();
        if (!this.isEnabled) return 'Mic aus';
        if (!microphoneTrack) return 'Mic bereit';
        return microphoneTrack.enabled ? 'Mic aktiv' : 'Mic stumm';
    },

    getPeerLabel() {
        if (!this.hasOpponent()) return 'Kein Gegner';
        if (!this.isOpponentConnected()) return 'Gegner offline';
        if (this.hasRemoteMedia()) return 'Live verbunden';
        return 'Gegner online';
    },

    getRemoteAudioLabel() {
        if (!this.isEnabled) return 'Ton aus';
        return this.isRemoteAudioMuted ? 'Gegner stumm' : 'Gegnerton an';
    },

    getRemoteVideoLabel() {
        if (!this.isEnabled) return 'Bild aus';
        return this.isRemoteVideoHidden ? 'Gegnerbild aus' : 'Gegnerbild an';
    },

    getHelperText() {
        if (this.shouldPromptRemoteAudioUnlock()) {
            return 'Der Gegnerstream ist da, aber der Browser blockiert den Ton noch. Tippe auf Audio freigeben.';
        }
        if (this.isReceiveOnlyMode) {
            return 'Du empfängst nur Bild und Ton. Eigene Kamera und Mikrofon brauchen auf iPhone/iPad HTTPS.';
        }

        if (!this.isEnabled) {
            if (this.isIOSLikeDevice() && window.isSecureContext) {
                return 'Auf iPhone/iPad zuerst die Kamera erlauben. Das Mikrofon kannst du danach bei Bedarf zuschalten.';
            }
            return 'Verbinde zuerst das Video. Das Mikrofon kannst du danach getrennt aktivieren.';
        }

        if (this.hasRemoteMedia()) {
            if (this.isRemoteVideoHidden && this.isRemoteAudioMuted) {
                return 'Der Gegnerstream laeuft weiter, ist aber gerade komplett ausgeblendet und stumm.';
            }
            if (this.isRemoteVideoHidden) {
                return 'Der Gegnerstream laeuft weiter, das Bild ist aber gerade ausgeblendet.';
            }
            if (this.isRemoteAudioMuted) {
                return 'Der Gegnerstream laeuft weiter, der Ton ist gerade stumm.';
            }
            return 'Video steht. Ihr koennt den Call im Match als kleines Overlay weiterlaufen lassen.';
        }

        if (!this.hasOpponent()) {
            return 'Sobald dein Gegner im Raum ist, kann die Verbindung aufgebaut werden.';
        }

        if (!this.isOpponentConnected()) {
            return 'Dein Gegner ist offline. Der Video-Call wird wieder aufgenommen, sobald er zurueck ist.';
        }

        return 'Dein Stream ist bereit. Warte darauf, dass auch die Gegenseite ihre Kamera verbindet.';
    },

    getLocalTileBadge() {
        if (this.isReceiveOnlyMode) return 'Empfang only';
        if (!this.isEnabled) return 'Offline';
        const videoTrack = this.getCameraTrack();
        if (!videoTrack) return 'Kein Bild';
        return videoTrack.enabled ? 'Live' : 'Pausiert';
    },

    getRemoteTileBadge() {
        if (this.isRemoteVideoHidden && this.hasRemoteMedia()) return 'Versteckt';
        if (this.hasRemoteMedia()) return 'Live';
        if (!this.hasOpponent()) return 'Warte';
        if (!this.isOpponentConnected()) return 'Offline';
        return 'Bereit';
    },

    async requestConnectionIfNeeded(options = {}) {
        const force = !!options.force;
        const statusText = options.statusText || 'Warte auf Gegnervideo...';

        if (!this.isEnabled || !this.peerConnection || !this.hasOpponent()) return;
        if (!force && !this.isInitiator()) return;
        if (!force && !this.opponentVideoReady) return;
        if (this.peerConnection.signalingState !== 'stable') return;
        if (this.remoteStream?.getTracks?.().length) return;

        await this.createAndSendOffer({
            allowNonInitiator: force,
            statusText
        });
    },

    async startVideo(options = {}) {
        const { autoResume = false } = options;
        if (this.isStarting || this.isEnabled) return;
        if (!this.roomId || !this.currentUserId) {
            this.setStatus('Kein aktiver Online-Raum');
            return;
        }

        this.isStarting = true;
        this.lastError = '';
        this.setStatus('Kamera wird gestartet...');

        try {
            this.isReceiveOnlyMode = false;
            this.remotePlaybackBlocked = false;
            this.localVideoSessionId = this.generateVideoSessionId();
            await this.ensureResolvedIceBundle();

            try {
                await this.ensureLocalStream();
            } catch (mediaError) {
                if (!this.canUseReceiveOnlyMode()) {
                    throw mediaError;
                }

                this.isReceiveOnlyMode = true;
                this.localStream = null;
                this.setStatus('Nur Empfang wird gestartet...');
            }

            this.ensurePeerConnection();
            await this.ensureSignalSubscription();
            this.isEnabled = true;
            this.shouldAutoResumeVideo = true;
            this.autoResumeAttemptedForRoomId = this.roomId;
            this.persistUiState();
            await this.emitSignal('video_ready', {
                facingMode: this.facingMode,
                receiveOnly: this.isReceiveOnlyMode
            });

            const replayPromise = this.fetchMissedSignals({ force: true });
            await this.flushPendingRemoteSignals();

            if (this.isInitiator() && this.hasOpponent() && this.opponentVideoReady) {
                await this.requestConnectionIfNeeded({
                    statusText: 'Warte auf Antwort...'
                });
            }

            await replayPromise;
            await this.flushPendingRemoteSignals();

            if (this.isInitiator() && this.hasOpponent() && this.opponentVideoReady && !this.hasRemoteMedia()) {
                await this.requestConnectionIfNeeded({
                    statusText: 'Warte auf Antwort...'
                });
            }

            this.setStatus(this.isReceiveOnlyMode ? 'Nur Empfang verbunden' : 'Kamera verbunden');
        } catch (error) {
            console.error('OnlineVideoService.startVideo failed', error);
            if (!autoResume) {
                this.autoResumeAttemptedForRoomId = this.roomId;
            }
            this.lastError = this.getMediaErrorMessage(error);
            await this.stopVideo({ emitLeave: false, preserveStatus: true });
            this.setStatus(this.lastError);
        } finally {
            this.isStarting = false;
            this.refreshUiState();
        }
    },

    async stopVideo(options = {}) {
        const { emitLeave = true, preserveStatus = false, keepAutoResume = false } = options;
        this.clearReconnectTimer();

        if (!keepAutoResume) {
            this.shouldAutoResumeVideo = false;
            this.persistUiState();
        }

        if (emitLeave && this.roomId && this.isEnabled) {
            try {
                await this.emitSignal('video_leave', {});
            } catch (error) {
                console.warn('video leave signal failed', error);
            }
        }

        this.isEnabled = false;
        this.offerPendingSince = null;

        if (this.peerConnection) {
            try {
                this.peerConnection.onicecandidate = null;
                this.peerConnection.ontrack = null;
                this.peerConnection.onconnectionstatechange = null;
                this.peerConnection.close();
            } catch (error) {
                console.warn('peer connection close failed', error);
            }
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.remoteStream = null;
        this.pendingIceCandidates = [];
        this.signalReplayPromise = null;
        this.lastSignalReplayAt = 0;
        this.localVideoSessionId = null;
        this.opponentVideoSessionId = null;
        this.isReceiveOnlyMode = false;
        this.remotePlaybackBlocked = false;
        this.opponentVideoReady = false;
        this.remoteStatusText = 'Warte auf Gegnerkamera';
        this.detachVideoStreams();
        if (!preserveStatus) {
            this.setStatus('Kamera aus');
        }
        this.refreshUiState();
    },

    async reset(options = {}) {
        const { preserveUi = false } = options;
        await this.stopVideo({ emitLeave: false, keepAutoResume: false });

        if (this.signalSubscription) {
            try {
                await supabase.removeChannel(this.signalSubscription);
            } catch (error) {
                console.warn('video subscription remove failed', error);
            }
            this.signalSubscription = null;
        }

        this.roomId = null;
        this.roomStatus = 'waiting';
        this.players = [];
        this.currentUserId = null;
        this.lastError = '';
        this.isReceiveOnlyMode = false;
        this.remotePlaybackBlocked = false;
        this.resolvedIceBundle = null;
        this.iceServerBundlePromise = null;
        this.signalSubscriptionReadyPromise = null;
        this.offerPendingSince = null;
        this.pendingRemoteSignals = [];
        this.seenSignalKeys = [];
        this.signalReplayPromise = null;
        this.lastSignalReplayAt = 0;
        this.localVideoSessionId = null;
        this.opponentVideoSessionId = null;
        this.opponentVideoReady = false;
        this.isEndingForRoomState = false;
        Object.assign(this, this.getDefaultUiState());
        this.dockDragState = null;
        this.autoResumeAttemptedForRoomId = null;
        this.remoteStatusText = 'Warte auf Gegnerkamera';

        if (!preserveUi && this.floatingDockEl) {
            this.dockDragCleanup?.();
            this.dockDragCleanup = null;
            this.floatingDockEl.remove();
            this.floatingDockEl = null;
        }

        this.localVideoEls.clear();
        this.remoteVideoEls.clear();
        this.statusEls.clear();
        this.controlEls.clear();
    },

    getMicrophoneTrack() {
        return this.localStream?.getAudioTracks?.()[0] || null;
    },

    getMicrophoneErrorMessage(error) {
        if (error?.name === 'NotAllowedError') {
            if (this.isIOSLikeDevice()) {
                return 'Mikrofonzugriff wurde blockiert. Bitte in Safari bei den Website-Einstellungen Mikrofon auf Erlauben setzen.';
            }
            return 'Mikrofonzugriff wurde blockiert.';
        }

        if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
            return 'Kein Mikrofon gefunden.';
        }

        return error?.message || 'Mikrofon konnte nicht gestartet werden.';
    },

    async requestMicrophoneTrack() {
        const stream = await this.getUserMediaWithConstraints({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: { ideal: 1 }
            },
            video: false
        });
        const track = stream.getAudioTracks?.()[0] || null;
        if (!track) {
            stream.getTracks?.().forEach(item => item.stop());
            throw new Error('Kein Mikrofon gefunden.');
        }
        return track;
    },

    async ensureMicrophoneTrack(options = {}) {
        const { initializeMuted = false, silent = false } = options;

        const existingTrack = this.getMicrophoneTrack();
        if (existingTrack) {
            if (initializeMuted) {
                existingTrack.enabled = false;
            }
            return existingTrack;
        }

        try {
            const microphoneTrack = await this.requestMicrophoneTrack();
            microphoneTrack.enabled = !initializeMuted;

            if (this.localStream) {
                this.localStream.addTrack(microphoneTrack);
            } else {
                this.localStream = new MediaStream([microphoneTrack]);
            }

            if (this.peerConnection) {
                this.peerConnection.addTrack(microphoneTrack, this.localStream);
                await this.createAndSendOffer({
                    allowNonInitiator: true,
                    statusText: 'Mikrofon wird verbunden...'
                });
            }

            this.attachVideoStreams();
            return microphoneTrack;
        } catch (error) {
            if (silent) return null;
            throw error;
        }
    },

    async toggleCameraEnabled() {
        if (!this.isEnabled) {
            await this.startVideo();
            return;
        }

        if (this.isReceiveOnlyMode) {
            this.setStatus('Eigene Kamera auf iPhone/iPad erst mit HTTPS moeglich.');
            return;
        }

        const videoTrack = this.localStream?.getVideoTracks?.()[0];
        if (!videoTrack) return;

        videoTrack.enabled = !videoTrack.enabled;
        this.setStatus(videoTrack.enabled ? 'Kamera verbunden' : 'Kamera pausiert');
        this.refreshUiState();
    },

    async toggleMicrophoneEnabled() {
        if (!this.isEnabled) {
            this.setStatus('Zuerst Video verbinden');
            this.refreshUiState();
            return;
        }

        if (!this.isEnabled) return;

        try {
            if (this.isReceiveOnlyMode) {
                this.setStatus('Eigenes Mikrofon auf iPhone/iPad erst mit HTTPS moeglich.');
                return;
            }

            let microphoneTrack = this.getMicrophoneTrack();
            if (!microphoneTrack) {
                microphoneTrack = await this.ensureMicrophoneTrack();
                if (!microphoneTrack) return;
                this.setStatus('Mikrofon aktiv');
                this.refreshUiState();
                return;
            }

            microphoneTrack.enabled = !microphoneTrack.enabled;
            this.setStatus(microphoneTrack.enabled ? 'Mikrofon aktiv' : 'Mikrofon stumm');
            this.refreshUiState();
        } catch (error) {
            console.error('OnlineVideoService.toggleMicrophoneEnabled failed', error);
            this.setStatus(this.getMicrophoneErrorMessage(error));
        }
    },

    async switchCamera() {
        if (!this.isEnabled) {
            await this.startVideo();
            return;
        }

        if (this.isReceiveOnlyMode) {
            this.setStatus('Kamerawechsel auf iPhone/iPad erst mit HTTPS moeglich.');
            return;
        }

        const nextFacingMode = this.facingMode === 'user' ? 'environment' : 'user';

        try {
            const nextStream = await this.requestCameraStream(nextFacingMode);

            const nextTrack = nextStream.getVideoTracks()[0];
            const previousTrack = this.localStream?.getVideoTracks?.()[0];

            if (!nextTrack) {
                nextStream.getTracks().forEach(track => track.stop());
                return;
            }

            const sender = this.peerConnection?.getSenders?.().find(item => item.track?.kind === 'video');
            if (sender) {
                await sender.replaceTrack(nextTrack);
            }

            if (previousTrack) previousTrack.stop();
            if (this.localStream) {
                this.localStream.removeTrack(previousTrack);
                this.localStream.addTrack(nextTrack);
            } else {
                this.localStream = new MediaStream([nextTrack]);
            }

            nextStream.getAudioTracks().forEach(track => track.stop());
            this.facingMode = nextFacingMode;
            this.attachVideoStreams();
            this.setStatus(nextFacingMode === 'environment' ? 'Rueckkamera aktiv' : 'Frontkamera aktiv');
            this.refreshUiState();
        } catch (error) {
            console.error('OnlineVideoService.switchCamera failed', error);
            this.setStatus(this.getMediaErrorMessage(error));
        }
    },

    getLobbyMarkup() {
        if (!this.roomId) return '';

        return `
            <div id="online-video-root" class="glass-panel online-room-card online-video-card">
                <div class="online-room-topline">
                    <div>
                        <span class="online-eyebrow">Video</span>
                        <h3>Match Kamera</h3>
                    </div>
                    <span id="online-video-status-pill" class="online-status-pill status-${this.isEnabled ? 'live' : 'waiting'}">${this.isEnabled ? (this.isReceiveOnlyMode ? 'Empfang' : 'Aktiv') : 'Aus'}</span>
                </div>
                <p class="online-room-copy">Optionales Livebild fuer euer Handy-Duell. Erst aktivieren, wenn beide bereit sind.</p>
                <div class="online-video-meta-strip">
                    <span id="online-video-mode-chip" class="online-video-chip">${this.getModeLabel()}</span>
                    <span id="online-video-connection-chip" class="online-video-chip">${this.getConnectionIndicator().label}</span>
                    <span id="online-video-performance-chip" class="online-video-chip">${this.getPerformanceLabel()}</span>
                    <span id="online-video-ice-chip" class="online-video-chip">${this.getIceTransportLabel()}</span>
                    <span id="online-video-audio-policy-chip" class="online-video-chip">${this.getAudioPolicyLabel()}</span>
                    <span id="online-video-cam-chip" class="online-video-chip">${this.getCameraLabel()}</span>
                    <span id="online-video-mic-chip" class="online-video-chip">${this.getMicrophoneLabel()}</span>
                    <span id="online-video-peer-chip" class="online-video-chip">${this.getPeerLabel()}</span>
                    <span id="online-video-remote-audio-chip" class="online-video-chip">${this.getRemoteAudioLabel()}</span>
                    <span id="online-video-remote-video-chip" class="online-video-chip">${this.getRemoteVideoLabel()}</span>
                </div>
                <div class="online-video-grid">
                    <div class="online-video-tile">
                        <div class="online-video-tile-head">
                            <span class="online-video-label">Du</span>
                            <span id="online-video-local-badge" class="online-video-badge">${this.getLocalTileBadge()}</span>
                        </div>
                        <video id="online-video-local" class="online-video-feed" autoplay muted playsinline></video>
                    </div>
                    <div class="online-video-tile">
                        <div class="online-video-tile-head">
                            <span class="online-video-label">Gegner</span>
                            <span id="online-video-remote-badge" class="online-video-badge">${this.getRemoteTileBadge()}</span>
                        </div>
                        <video id="online-video-remote" class="online-video-feed" autoplay playsinline></video>
                    </div>
                </div>
                <div class="online-video-controls">
                    <button id="online-video-connect-btn" class="glass-btn" onclick="OnlineVideoService.handlePrimaryAction()"></button>
                    <button id="online-video-turn-probe-btn" class="glass-btn" onclick="OnlineVideoService.probeManagedIceServers()">TURN Test</button>
                    <button id="online-video-toggle-btn" class="glass-btn" onclick="OnlineVideoService.toggleCameraEnabled()">Kamera an/aus</button>
                    <button id="online-video-mic-btn" class="glass-btn" onclick="OnlineVideoService.toggleMicrophoneEnabled()">Mikrofon an/aus</button>
                    <button id="online-video-switch-btn" class="glass-btn" onclick="OnlineVideoService.switchCamera()">Front/Back</button>
                    <button id="online-video-unlock-audio-btn" class="glass-btn" onclick="OnlineVideoService.resumeRemotePlayback({ fromUserGesture: true })">Audio freigeben</button>
                    <button id="online-video-remote-audio-btn" class="glass-btn" onclick="OnlineVideoService.toggleRemoteAudioMuted()">Gegner stumm</button>
                    <button id="online-video-remote-video-btn" class="glass-btn" onclick="OnlineVideoService.toggleRemoteVideoHidden()">Gegnerbild aus</button>
                </div>
                <div id="online-video-helper-text" class="online-video-helper-text">${this.getHelperText()}</div>
                ${this.getDebugMarkup('lobby')}
                <div id="online-video-status-text" class="online-video-status-text"></div>
            </div>
        `;
    },

    mountLobbyElements() {
        this.registerElements({
            localVideo: document.getElementById('online-video-local'),
            remoteVideo: document.getElementById('online-video-remote'),
            status: document.getElementById('online-video-status-text'),
            controls: [
                document.getElementById('online-video-connect-btn'),
                document.getElementById('online-video-toggle-btn'),
                document.getElementById('online-video-mic-btn'),
                document.getElementById('online-video-switch-btn'),
                document.getElementById('online-video-remote-audio-btn'),
                document.getElementById('online-video-remote-video-btn'),
                document.getElementById('online-video-status-pill')
            ]
        });
        this.refreshUiState();
    },

    async handlePrimaryAction() {
        this.primePlaybackFromGesture().catch(() => {});

        if (this.isEnabled) {
            await this.stopVideo();
            return;
        }

        await this.startVideo();
    },

    toggleDockExpanded(force) {
        if (typeof force === 'boolean') {
            this.isDockExpanded = force;
        } else {
            this.isDockExpanded = !this.isDockExpanded;
        }
        this.persistUiState();
        this.refreshUiState();
    },

    async toggleRemoteAudioMuted() {
        this.isRemoteAudioMuted = !this.isRemoteAudioMuted;
        this.persistUiState();
        this.attachVideoStreams();
        if (!this.isRemoteAudioMuted) {
            await this.resumeRemotePlayback({ fromUserGesture: true, suppressStatus: true });
        }
        this.setStatus(this.isRemoteAudioMuted ? 'Gegnerton stumm' : 'Gegnerton aktiv');
    },

    toggleRemoteVideoHidden() {
        this.isRemoteVideoHidden = !this.isRemoteVideoHidden;
        this.persistUiState();
        this.attachVideoStreams();
        this.setStatus(this.isRemoteVideoHidden ? 'Gegnerbild ausgeblendet' : 'Gegnerbild sichtbar');
    },

    clampDockPosition(left, top) {
        if (!this.floatingDockEl) {
            return { left, top };
        }

        const margin = 10;
        const dockWidth = this.floatingDockEl.offsetWidth || 220;
        const dockHeight = this.floatingDockEl.offsetHeight || 160;
        const maxLeft = Math.max(margin, window.innerWidth - dockWidth - margin);
        const maxTop = Math.max(margin, window.innerHeight - dockHeight - margin);

        return {
            left: Math.min(Math.max(margin, left), maxLeft),
            top: Math.min(Math.max(margin, top), maxTop)
        };
    },

    snapDockPosition(left, top) {
        if (!this.floatingDockEl) {
            return { left, top };
        }

        const margin = 10;
        const dockWidth = this.floatingDockEl.offsetWidth || 220;
        const dockHeight = this.floatingDockEl.offsetHeight || 160;
        const maxLeft = Math.max(margin, window.innerWidth - dockWidth - margin);
        const maxTop = Math.max(margin, window.innerHeight - dockHeight - margin);

        const clamped = this.clampDockPosition(left, top);
        const snapLeft = clamped.left <= (maxLeft / 2) ? margin : maxLeft;
        const snapTop = clamped.top <= (maxTop / 2) ? margin : maxTop;

        return { left: snapLeft, top: snapTop };
    },

    applyDockPosition() {
        if (!this.floatingDockEl) return;

        if (!this.dockPosition) {
            this.floatingDockEl.style.left = '';
            this.floatingDockEl.style.top = '';
            this.floatingDockEl.style.right = '';
            this.floatingDockEl.style.bottom = '';
            return;
        }

        const nextPosition = this.clampDockPosition(this.dockPosition.left, this.dockPosition.top);
        this.dockPosition = nextPosition;
        this.floatingDockEl.style.left = `${nextPosition.left}px`;
        this.floatingDockEl.style.top = `${nextPosition.top}px`;
        this.floatingDockEl.style.right = 'auto';
        this.floatingDockEl.style.bottom = 'auto';
    },

    initializeDockDrag(dock) {
        if (!dock) return;

        this.dockDragCleanup?.();

        const dockHead = dock.querySelector('.online-video-dock-head');
        if (!dockHead) return;

        const handlePointerMove = (event) => {
            if (!this.dockDragState || event.pointerId !== this.dockDragState.pointerId) return;
            const nextLeft = event.clientX - this.dockDragState.offsetX;
            const nextTop = event.clientY - this.dockDragState.offsetY;
            this.dockPosition = this.clampDockPosition(nextLeft, nextTop);
            this.applyDockPosition();
        };

        const finishDrag = (event) => {
            if (!this.dockDragState || (event?.pointerId && event.pointerId !== this.dockDragState.pointerId)) return;
            if (this.dockPosition) {
                this.dockPosition = this.snapDockPosition(this.dockPosition.left, this.dockPosition.top);
                this.persistUiState();
                this.applyDockPosition();
            }
            this.dockDragState = null;
            this.floatingDockEl?.classList.remove('dragging');
        };

        const handleResize = () => {
            this.applyDockPosition();
        };

        const handlePointerDown = (event) => {
            if (event.target.closest('button')) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            const rect = dock.getBoundingClientRect();
            this.dockPosition = { left: rect.left, top: rect.top };
            this.dockDragState = {
                pointerId: event.pointerId,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };
            this.floatingDockEl?.classList.add('dragging');
            dockHead.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        };

        dockHead.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', finishDrag);
        window.addEventListener('resize', handleResize);

        this.dockDragCleanup = () => {
            dockHead.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', finishDrag);
            window.removeEventListener('resize', handleResize);
        };
    },

    registerElements({ localVideo, remoteVideo, status, controls = [] }) {
        this.pruneDomElementReferences();
        if (localVideo) this.localVideoEls.add(localVideo);
        if (remoteVideo) this.remoteVideoEls.add(remoteVideo);
        if (status) this.statusEls.add(status);
        controls.filter(Boolean).forEach(control => this.controlEls.add(control));
        this.attachVideoStreams();
        this.refreshUiState();
    },

    pruneDisconnectedElements(elementSet) {
        for (const element of Array.from(elementSet)) {
            if (!element?.isConnected) {
                elementSet.delete(element);
            }
        }
    },

    pruneDomElementReferences() {
        this.pruneDisconnectedElements(this.localVideoEls);
        this.pruneDisconnectedElements(this.remoteVideoEls);
        this.pruneDisconnectedElements(this.statusEls);
        this.pruneDisconnectedElements(this.controlEls);
    },

    ensureFloatingDock() {
        if (this.floatingDockEl || typeof document === 'undefined') return;

        const dock = document.createElement('div');
        dock.id = 'online-video-dock';
        dock.className = 'online-video-dock expanded hidden';
        dock.innerHTML = `
            <div class="online-video-dock-head">
                <div class="online-video-dock-headline">
                    <span>Live Video</span>
                    <span id="online-video-dock-mode" class="online-video-mini-chip">${this.getModeLabel()}</span>
                </div>
                <div class="online-video-dock-head-actions">
                    <span id="online-video-dock-state" class="online-video-dock-state">Aus</span>
                    <button id="online-video-dock-toggle" class="online-video-dock-toggle" onclick="OnlineVideoService.toggleDockExpanded()"></button>
                </div>
            </div>
            <div class="online-video-dock-meta">
                <span id="online-video-dock-connection" class="online-video-mini-chip">${this.getConnectionIndicator().label}</span>
                <span id="online-video-dock-performance" class="online-video-mini-chip">${this.getPerformanceLabel()}</span>
                <span id="online-video-dock-ice" class="online-video-mini-chip">${this.getIceTransportLabel()}</span>
                <span id="online-video-dock-peer" class="online-video-mini-chip">${this.getPeerLabel()}</span>
                <span id="online-video-dock-media" class="online-video-mini-chip">${this.getCameraLabel()}</span>
            </div>
            <div id="online-video-dock-body" class="online-video-dock-body">
                <div class="online-video-dock-stage">
                    <div class="online-video-dock-stage-head">
                        <span class="online-video-label">Match Stage</span>
                        <span id="online-video-dock-stage-badge" class="online-video-badge">${this.getRemoteTileBadge()}</span>
                    </div>
                    <div class="online-video-dock-feeds">
                        <video id="online-video-dock-remote" class="online-video-feed" autoplay playsinline></video>
                        <video id="online-video-dock-local" class="online-video-feed online-video-feed-self" autoplay muted playsinline></video>
                    </div>
                </div>
                <div id="online-video-dock-helper" class="online-video-dock-helper">${this.getHelperText()}</div>
                ${this.getDebugMarkup('dock')}
                <div class="online-video-dock-actions">
                    <button id="online-video-dock-connect" class="glass-btn" onclick="OnlineVideoService.handlePrimaryAction()"></button>
                    <button id="online-video-dock-turn" class="glass-btn" onclick="OnlineVideoService.probeManagedIceServers()">TURN</button>
                    <button id="online-video-dock-cam" class="glass-btn" onclick="OnlineVideoService.toggleCameraEnabled()">Cam</button>
                    <button id="online-video-dock-mic" class="glass-btn" onclick="OnlineVideoService.toggleMicrophoneEnabled()">Mic</button>
                    <button id="online-video-dock-flip" class="glass-btn" onclick="OnlineVideoService.switchCamera()">Flip</button>
                    <button id="online-video-dock-unlock" class="glass-btn" onclick="OnlineVideoService.resumeRemotePlayback({ fromUserGesture: true })">Play</button>
                    <button id="online-video-dock-audio" class="glass-btn" onclick="OnlineVideoService.toggleRemoteAudioMuted()">Audio</button>
                    <button id="online-video-dock-hide" class="glass-btn" onclick="OnlineVideoService.toggleRemoteVideoHidden()">Hide</button>
                </div>
            </div>
        `;

        document.body.appendChild(dock);
        this.floatingDockEl = dock;
        this.initializeDockDrag(dock);
        this.registerElements({
            localVideo: dock.querySelector('#online-video-dock-local'),
            remoteVideo: dock.querySelector('#online-video-dock-remote'),
            controls: [
                dock.querySelector('#online-video-dock-connect'),
                dock.querySelector('#online-video-dock-state')
            ]
        });
        this.syncUiVisibility();
    },

    syncUiVisibility() {
        if (!this.floatingDockEl) return;
        const x01Visible = !document.getElementById('view-game-x01')?.classList.contains('hidden');
        const boardVisible = !document.getElementById('view-game-active')?.classList.contains('hidden');
        const showDock = this.isEnabled && this.roomStatus === 'live' && (x01Visible || boardVisible);
        this.floatingDockEl.classList.toggle('hidden', !showDock);
    },

    updatePresenceState() {
        if (!this.canAutoResumeInCurrentRoom()) {
            this.opponentVideoReady = false;
            this.setRemoteStatus(this.getRoomEndStatusText());
            return;
        }

        if (!this.hasOpponent()) {
            this.opponentVideoReady = false;
            this.setRemoteStatus('Warte auf Gegner');
            return;
        }

        if (!this.isOpponentConnected()) {
            this.handleRemoteDeparture('Gegner offline');
            return;
        }

        if (this.remoteStream?.getTracks?.().length) {
            this.setRemoteStatus('Gegnerkamera verbunden');
            return;
        }

        this.setRemoteStatus(this.opponentVideoReady ? 'Gegnerkamera bereit' : 'Gegner verbunden');
    },

    isIOSLikeDevice() {
        const userAgent = navigator.userAgent || '';
        const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
        const isIPadOSDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        return isAppleMobile || isIPadOSDesktopMode;
    },

    initializeLifecycleObservers() {
        if (this.lifecycleBound || typeof document === 'undefined') return;

        const resumeVideoState = () => {
            if (!this.isEnabled) return;

            this.resumeRemotePlayback({ suppressStatus: true }).catch(error => {
                console.warn('video lifecycle remote playback resume failed', error);
            });
            this.fetchMissedSignals().catch(error => {
                console.warn('video lifecycle replay failed', error);
            });
            this.maybeReconnectToOpponent().catch(error => {
                console.warn('video lifecycle reconnect failed', error);
            });
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                resumeVideoState();
            }
        });

        window.addEventListener('pageshow', () => {
            resumeVideoState();
        });

        window.addEventListener('online', () => {
            if (!this.isEnabled) return;
            this.setRemoteStatus('Netz wieder da');
            window.setTimeout(() => {
                this.recoverVideoSession({
                    statusText: 'Video wird nach Netzwechsel verbunden...'
                }).catch(error => {
                    console.warn('video network recovery failed', error);
                });
            }, 500);
        });

        window.addEventListener('offline', () => {
            if (!this.isEnabled) return;
            this.setRemoteStatus('Keine Verbindung');
            this.setStatus('Netz getrennt');
            this.refreshUiState();
        });

        this.lifecycleBound = true;
    },

    getLocalhostSuggestion() {
        const currentHost = (window.location.hostname || '').toLowerCase();
        const { protocol, port, pathname, search, hash } = window.location;

        if (!port || currentHost === 'localhost' || currentHost === '127.0.0.1') {
            return null;
        }

        return `${protocol}//localhost:${port}${pathname}${search}${hash}`;
    },

    getMediaErrorMessage(error) {
        if (this.isReceiveOnlyMode) {
            return 'Nur Empfang aktiv. Eigene Kamera auf iPhone/iPad erst mit HTTPS moeglich.';
        }

        if (this.isIOSLikeDevice() && !window.isSecureContext) {
            return 'iPhone/iPad brauchen HTTPS fuer Kamera im Browser.';
        }

        if (!window.isSecureContext && error?.message === 'INSECURE_CONTEXT_CAMERA_BLOCKED') {
            const localhostSuggestion = this.getLocalhostSuggestion();
            if (localhostSuggestion) {
                return `Dieser Browser gibt auf dieser HTTP-LAN-Adresse keine Kamera frei. Auf dem Laptop bitte ${localhostSuggestion} verwenden.`;
            }
            return 'Dieser Browser gibt auf dieser HTTP-Adresse keine Kamera frei. Bitte per HTTPS testen.';
        }

        if (error?.name === 'NotAllowedError') {
            if (this.isIOSLikeDevice()) {
                return 'Kamerazugriff wurde blockiert. Bitte in Safari bei den Website-Einstellungen Kamera und Mikrofon auf Erlauben setzen.';
            }
            return 'Kamerazugriff wurde blockiert. Bitte Safari-Kamerarechte pruefen.';
        }

        if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
            return 'Keine Kamera gefunden.';
        }

        if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
            return 'Kamera ist bereits belegt oder nicht lesbar.';
        }

        if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError') {
            return 'Die gewaehlte Kamera-Konfiguration wird auf diesem Geraet nicht unterstuetzt.';
        }

        return error?.message || 'Kamera konnte nicht gestartet werden.';
    },

    async getUserMediaWithConstraints(constraints) {
        if (navigator.mediaDevices?.getUserMedia) {
            return navigator.mediaDevices.getUserMedia(constraints);
        }

        const legacyGetUserMedia = navigator.getUserMedia
            || navigator.webkitGetUserMedia
            || navigator.mozGetUserMedia
            || navigator.msGetUserMedia;

        if (!legacyGetUserMedia) {
            if (!window.isSecureContext) {
                throw new Error('INSECURE_CONTEXT_CAMERA_BLOCKED');
            }
            throw new Error('Kamera wird auf diesem Geraet nicht unterstuetzt.');
        }

        return new Promise((resolve, reject) => {
            legacyGetUserMedia.call(navigator, constraints, resolve, reject);
        });
    },

    queueUiRefresh() {
        if (this.uiRefreshQueued) return;
        this.uiRefreshQueued = true;
        window.setTimeout(() => {
            this.uiRefreshQueued = false;
            this.refreshUiState();
        }, 0);
    },

    async syncMediaElementPlayback(videoEl, options = {}) {
        if (!videoEl?.play) return;

        const { isRemote = false, fromUserGesture = false } = options;

        try {
            await videoEl.play();
            if (isRemote && this.remotePlaybackBlocked) {
                this.remotePlaybackBlocked = false;
                if (this.lastError === 'Browser blockiert Gegnerton noch.') {
                    this.lastError = '';
                }
                this.queueUiRefresh();
            }
        } catch (error) {
            if (!isRemote) return;

            const remoteAudioBlocked = !videoEl.muted
                && (error?.name === 'NotAllowedError' || /play|autoplay/i.test(error?.message || ''));

            if (remoteAudioBlocked !== this.remotePlaybackBlocked) {
                this.remotePlaybackBlocked = remoteAudioBlocked;
                this.queueUiRefresh();
            }

            if (fromUserGesture && remoteAudioBlocked) {
                this.lastError = 'Browser blockiert Gegnerton noch.';
                this.queueUiRefresh();
            }
        }
    },

    async primePlaybackFromGesture() {
        const playbackElements = [
            ...this.localVideoEls,
            ...this.remoteVideoEls
        ].filter(Boolean);

        for (const videoEl of playbackElements) {
            videoEl.setAttribute('playsinline', 'true');
            videoEl.setAttribute('webkit-playsinline', 'true');
            try {
                const playPromise = videoEl.play();
                if (playPromise?.catch) {
                    playPromise.catch(() => {});
                }
            } catch (_error) {
                // Expected until media is attached or the peer stream arrives.
            }
        }
    },

    async bindVideoElement(videoEl, stream, options = {}) {
        if (!videoEl) return;

        const {
            muted = false,
            hidden = false,
            isRemote = false
        } = options;

        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.disablePictureInPicture = true;

        const hadDifferentStream = videoEl.srcObject !== stream;
        const hadDifferentMute = videoEl.muted !== muted;
        const hadDifferentVisibility = videoEl.classList.contains('online-video-feed-hidden') !== hidden;

        if (hadDifferentMute) {
            videoEl.muted = muted;
        }

        if (hadDifferentStream) {
            videoEl.srcObject = stream || null;
        }

        if (hadDifferentVisibility) {
            videoEl.classList.toggle('online-video-feed-hidden', hidden);
        }

        const shouldAttemptPlayback = hadDifferentStream
            || hadDifferentMute
            || (isRemote && this.remotePlaybackBlocked)
            || (!!stream && videoEl.paused);

        if (!shouldAttemptPlayback) return;

        await this.syncMediaElementPlayback(videoEl, { isRemote });
    },

    async resumeRemotePlayback(options = {}) {
        const { fromUserGesture = false, suppressStatus = false } = options;
        if (!this.hasRemoteMedia()) return;

        for (const videoEl of this.remoteVideoEls) {
            if (!videoEl) continue;
            await this.syncMediaElementPlayback(videoEl, {
                isRemote: true,
                fromUserGesture
            });
        }

        if (fromUserGesture && !suppressStatus) {
            if (!this.remotePlaybackBlocked && this.lastError === 'Browser blockiert Gegnerton noch.') {
                this.lastError = '';
            }
            this.setStatus(this.remotePlaybackBlocked ? 'Gegnerton braucht noch Freigabe' : 'Gegnerton freigegeben');
        }
    },

    async requestCameraStream(preferredFacingMode = this.facingMode) {
        const performancePreset = this.getPerformancePreset();
        const attempts = [
            {
                audio: false,
                video: {
                    facingMode: { ideal: preferredFacingMode },
                    width: { ideal: performancePreset.width },
                    height: { ideal: performancePreset.height },
                    frameRate: { ideal: performancePreset.frameRate, max: performancePreset.frameRate }
                }
            },
            {
                audio: false,
                video: {
                    facingMode: preferredFacingMode,
                    frameRate: { ideal: performancePreset.frameRate }
                }
            },
            {
                audio: false,
                video: true
            }
        ];

        let lastError = null;
        for (const constraints of attempts) {
            try {
                return await this.getUserMediaWithConstraints(constraints);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Kamera konnte nicht gestartet werden.');
    },

    async ensureLocalStream() {
        if (this.localStream) return this.localStream;

        if (this.isIOSLikeDevice() && !window.isSecureContext) {
            throw new Error('iPhone/iPad brauchen HTTPS fuer Kamera im Browser.');
        }

        this.localStream = await this.requestCameraStream(this.facingMode);

        this.attachVideoStreams();
        return this.localStream;
    },

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    },

    scheduleReconnectAttempt(delayMs = 800) {
        if (!this.isEnabled || !this.isInitiator() || !this.isOpponentConnected()) return;
        if (this.reconnectTimer) return;

        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.maybeReconnectToOpponent().catch(error => {
                console.warn('scheduled video reconnect failed', error);
            });
        }, delayMs);
    },

    resetPeerConnection() {
        this.clearReconnectTimer();

        if (this.peerConnection) {
            try {
                this.peerConnection.onicecandidate = null;
                this.peerConnection.ontrack = null;
                this.peerConnection.onconnectionstatechange = null;
                this.peerConnection.close();
            } catch (error) {
                console.warn('peer connection reset failed', error);
            }
        }

        this.peerConnection = null;
        this.pendingIceCandidates = [];
        this.offerPendingSince = null;
        this.remoteStream = null;
        this.attachVideoStreams();
    },

    handleRemoteDeparture(message = 'Gegnerkamera getrennt') {
        this.resetPeerConnection();
        this.opponentVideoSessionId = null;
        this.opponentVideoReady = false;
        this.setRemoteStatus(message);
    },

    async maybeReconnectToOpponent() {
        if (!this.isEnabled || !this.roomId) return;
        if (!this.hasOpponent()) {
            this.setRemoteStatus('Warte auf Gegner');
            return;
        }

        if (!this.isOpponentConnected()) {
            this.handleRemoteDeparture('Gegner offline');
            return;
        }

        await this.ensureSignalSubscription();
        await this.fetchMissedSignals();

        const connectionState = this.peerConnection?.connectionState;
        const signalingState = this.peerConnection?.signalingState;
        const needsFreshConnection = !this.peerConnection || connectionState === 'failed' || connectionState === 'closed';
        const hasRemoteMedia = !!this.remoteStream?.getTracks?.().length;

        if (needsFreshConnection) {
            this.resetPeerConnection();
            this.ensurePeerConnection();
        }

        const offerTimedOut = this.isInitiator()
            && signalingState === 'have-local-offer'
            && this.offerPendingSince
            && (Date.now() - this.offerPendingSince) > 4000;

        if (offerTimedOut) {
            this.setRemoteStatus('Sende Offer erneut...');
            this.resetPeerConnection();
            this.ensurePeerConnection();
            await this.requestConnectionIfNeeded({
                force: true,
                statusText: 'Warte auf Antwort...'
            });
            return;
        }

        if (!this.opponentVideoReady && !hasRemoteMedia) {
            this.setRemoteStatus('Warte auf Gegnerkamera');
            return;
        }

        if (this.isInitiator() && !hasRemoteMedia && this.peerConnection?.signalingState === 'stable') {
            this.setRemoteStatus('Verbinde Gegnerkamera...');
            await this.requestConnectionIfNeeded({
                statusText: 'Warte auf Antwort...'
            });
            return;
        }

        if (!hasRemoteMedia) {
            this.setRemoteStatus('Warte auf Gegnerkamera');
        }
    },

    ensurePeerConnection() {
        if (this.peerConnection) return this.peerConnection;

        this.remoteStream = new MediaStream();
        this.peerConnection = new RTCPeerConnection({ iceServers: this.getConfiguredIceServers() });

        const hasLocalVideoTrack = !!this.localStream?.getVideoTracks?.().length;
        const hasLocalAudioTrack = !!this.localStream?.getAudioTracks?.().length;

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        if (!hasLocalVideoTrack) {
            this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
        }

        if (!hasLocalAudioTrack) {
            this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });
        }

        this.peerConnection.onicecandidate = (event) => {
            if (!event.candidate) return;
            this.emitSignal('video_ice', { candidate: event.candidate.toJSON() }).catch(error => {
                console.warn('video ice emit failed', error);
            });
        };

        this.peerConnection.ontrack = (event) => {
            event.streams.forEach(stream => {
                stream.getTracks().forEach(track => {
                    const exists = this.remoteStream.getTracks().some(item => item.id === track.id);
                    if (!exists) this.remoteStream.addTrack(track);
                });
            });
            this.attachVideoStreams();
            this.setRemoteStatus('Gegnerkamera verbunden');
            this.setStatus('Video verbunden');
            this.resumeRemotePlayback().catch(error => {
                console.warn('remote playback resume failed', error);
            });
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection?.connectionState || 'new';
            if (state === 'connected') {
                this.clearReconnectTimer();
                this.setRemoteStatus('Gegnerkamera verbunden');
                this.setStatus('Video verbunden');
            } else if (state === 'connecting') {
                this.setRemoteStatus('Verbinde Gegnerkamera...');
                this.setStatus('Verbinde Video...');
            } else if (state === 'disconnected' || state === 'failed') {
                this.setRemoteStatus('Verbindung unterbrochen');
                this.setStatus('Video getrennt');
                this.scheduleReconnectAttempt();
            } else if (state === 'closed') {
                this.setRemoteStatus('Gegnerkamera getrennt');
            }
            this.refreshUiState();
        };

        return this.peerConnection;
    },

    async ensureSignalSubscription() {
        if (!this.roomId) return;
        if (this.signalSubscription && this.signalSubscriptionReadyPromise) {
            return this.signalSubscriptionReadyPromise;
        }

        this.signalSubscriptionReadyPromise = new Promise((resolve, reject) => {
            this.signalSubscription = supabase
                .channel(`online-video-${this.roomId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'online_room_events',
                    filter: `room_id=eq.${this.roomId}`
                }, (payload) => {
                    const eventType = payload?.new?.event_type;
                    const data = payload?.new?.payload;
                    if (eventType !== VIDEO_SIGNAL_EVENT || !data) return;
                    this.handleSignal(data, payload.new.player_id).catch(error => {
                        console.error('handleSignal failed', error);
                    });
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        resolve();
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        this.signalSubscriptionReadyPromise = null;
                        reject(new Error(`Video subscription failed: ${status}`));
                    }
                });
        });

        return this.signalSubscriptionReadyPromise;
    },

    async restartSignalSubscription() {
        if (this.signalSubscription) {
            try {
                await supabase.removeChannel(this.signalSubscription);
            } catch (error) {
                console.warn('video subscription restart remove failed', error);
            }
        }

        this.signalSubscription = null;
        this.signalSubscriptionReadyPromise = null;
        return this.ensureSignalSubscription();
    },

    async emitSignal(signalType, payload) {
        if (!this.roomId) return;

        const enrichedPayload = {
            ...(payload || {})
        };

        if (this.localVideoSessionId && !enrichedPayload.sessionId) {
            enrichedPayload.sessionId = this.localVideoSessionId;
        }

        const { error } = await supabase.rpc('emit_online_room_signal', {
            p_room_id: this.roomId,
            p_signal_type: signalType,
            p_payload: enrichedPayload
        });

        if (error) {
            throw new Error(error.message || 'Videosignal konnte nicht gesendet werden.');
        }

        this.recordSignalDebug('out', signalType);
    },

    async recoverVideoSession(options = {}) {
        const { statusText = 'Video wird wiederhergestellt...' } = options;
        if (!this.isEnabled || !this.roomId) return;

        this.clearReconnectTimer();
        this.localVideoSessionId = this.generateVideoSessionId();
        this.setStatus(statusText);
        this.setRemoteStatus('Stelle Video neu her...');

        await this.restartSignalSubscription();
        this.resetPeerConnection();
        this.ensurePeerConnection();
        await this.emitSignal('video_ready', {
            facingMode: this.facingMode,
            receiveOnly: this.isReceiveOnlyMode
        });
        await this.fetchMissedSignals({ force: true });
        await this.flushPendingRemoteSignals();

        if (this.isInitiator() && this.opponentVideoReady) {
            await this.requestConnectionIfNeeded({
                force: true,
                statusText: 'Verbinde erneut...'
            });
        }
    },

    buildSignalReplayKey(signalData, fromPlayerId) {
        const signalType = signalData?.signalType || '-';
        const sessionId = signalData?.payload?.sessionId || '-';
        let payloadKey = '{}';

        try {
            payloadKey = JSON.stringify(signalData?.payload || {});
        } catch (_error) {
            payloadKey = '[unserializable]';
        }

        return `${this.normalizeId(fromPlayerId) || '-'}|${sessionId}|${signalType}|${payloadKey}`;
    },

    getSignalSessionId(payload) {
        return typeof payload?.sessionId === 'string' && payload.sessionId.trim()
            ? payload.sessionId.trim()
            : null;
    },

    hasSeenSignalKey(signalKey) {
        return !!signalKey && this.seenSignalKeys.includes(signalKey);
    },

    rememberSignalKey(signalKey) {
        if (!signalKey || this.hasSeenSignalKey(signalKey)) return;

        this.seenSignalKeys.push(signalKey);
        if (this.seenSignalKeys.length > 250) {
            this.seenSignalKeys = this.seenSignalKeys.slice(-200);
        }
    },

    async fetchMissedSignals(options = {}) {
        const { force = false } = options;

        if (!this.roomId || !this.currentUserId) return;

        const now = Date.now();
        if (!force && this.signalReplayPromise) {
            return this.signalReplayPromise;
        }

        if (!force && this.lastSignalReplayAt && (now - this.lastSignalReplayAt) < 1200) {
            return;
        }

        this.signalReplayPromise = (async () => {
            const { data, error } = await supabase.rpc('list_online_room_video_signals', {
                p_room_id: this.roomId,
                p_limit: 40
            });

            if (error) {
                throw new Error(error.message || 'Videosignale konnten nicht nachgeladen werden.');
            }

            const replayRows = this.filterReplayRowsToLatestSessions(Array.isArray(data) ? data : []);

            for (const row of replayRows) {
                await this.handleSignal(row?.signal_data, row?.player_id, {
                    replayed: true,
                    signalKey: this.buildSignalReplayKey(row?.signal_data, row?.player_id)
                });
            }
        })()
            .catch(error => {
                console.warn('video signal replay failed', error);
            })
            .finally(() => {
                this.signalReplayPromise = null;
                this.lastSignalReplayAt = Date.now();
            });

        return this.signalReplayPromise;
    },

    filterReplayRowsToLatestSessions(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return [];

        const latestSessionByPlayer = new Map();
        rows.forEach((row, index) => {
            const playerKey = this.normalizeId(row?.player_id) || `idx-${index}`;
            const sessionId = this.getSignalSessionId(row?.signal_data?.payload);
            if (sessionId) {
                latestSessionByPlayer.set(playerKey, sessionId);
            }
        });

        const lastBoundaryByPlayer = new Map();
        rows.forEach((row, index) => {
            const playerKey = this.normalizeId(row?.player_id) || `idx-${index}`;
            const signalType = row?.signal_data?.signalType;
            if (signalType === 'video_ready' || signalType === 'video_leave') {
                lastBoundaryByPlayer.set(playerKey, index);
            }
        });

        return rows.filter((row, index) => {
            const playerKey = this.normalizeId(row?.player_id) || `idx-${index}`;
            const latestSessionId = latestSessionByPlayer.get(playerKey);
            const rowSessionId = this.getSignalSessionId(row?.signal_data?.payload);
            if (latestSessionId) {
                return rowSessionId === latestSessionId;
            }
            const boundaryIndex = lastBoundaryByPlayer.get(playerKey);
            return boundaryIndex == null || index >= boundaryIndex;
        });
    },

    async createAndSendOffer(options = {}) {
        const allowNonInitiator = !!options.allowNonInitiator;
        const statusText = options.statusText || 'Warte auf Antwort...';

        if (!this.isEnabled || !this.peerConnection) return;
        if (!allowNonInitiator && !this.isInitiator()) return;
        if (!allowNonInitiator && this.peerConnection.connectionState === 'connected' && this.remoteStream?.getTracks?.().length) return;
        if (this.peerConnection.signalingState !== 'stable') return;

        const offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        await this.peerConnection.setLocalDescription(offer);
        this.offerPendingSince = Date.now();
        await this.emitSignal('video_offer', { sdp: offer.sdp, type: offer.type });
        this.setStatus(statusText);
    },

    async handleSignal(signalData, fromPlayerId, options = {}) {
        const signalType = signalData?.signalType;
        const payload = signalData?.payload || {};
        const replayed = !!options.replayed;
        const signalKey = options.signalKey || this.buildSignalReplayKey(signalData, fromPlayerId);
        const signalSessionId = this.getSignalSessionId(payload);

        if (!signalType || this.normalizeId(fromPlayerId) === this.currentUserId) return;

        if (!this.isEnabled && signalType !== 'video_ready') {
            if (!replayed) {
                const alreadyQueued = this.pendingRemoteSignals.some(item => item.signalKey === signalKey);
                if (!alreadyQueued) {
                    this.pendingRemoteSignals.push({ signalData, fromPlayerId, signalKey });
                }
            }
            return;
        }

        if (this.hasSeenSignalKey(signalKey)) return;
        this.rememberSignalKey(signalKey);
        this.recordSignalDebug('in', signalType);

        if (signalType === 'video_ready') {
            const sessionChanged = !!(signalSessionId && this.opponentVideoSessionId && signalSessionId !== this.opponentVideoSessionId);
            if (sessionChanged) {
                this.resetPeerConnection();
            }
            if (signalSessionId) {
                this.opponentVideoSessionId = signalSessionId;
            }
            this.opponentVideoReady = true;
            this.setRemoteStatus(payload?.receiveOnly ? 'Gegner im Empfangsmodus' : 'Gegnerkamera bereit');
            if (this.isEnabled && this.isInitiator()) {
                this.ensurePeerConnection();
                await this.requestConnectionIfNeeded({
                    statusText: 'Warte auf Antwort...'
                });
            }
            return;
        }

        this.ensurePeerConnection();

        if (signalSessionId) {
            if (!this.opponentVideoSessionId) {
                this.opponentVideoSessionId = signalSessionId;
            } else if (signalSessionId !== this.opponentVideoSessionId) {
                if (signalType === 'video_offer') {
                    this.opponentVideoSessionId = signalSessionId;
                    this.resetPeerConnection();
                    this.ensurePeerConnection();
                } else {
                    return;
                }
            }
        }

        if (signalType === 'video_offer') {
            this.opponentVideoReady = true;
            if (this.peerConnection?.signalingState !== 'stable') {
                this.resetPeerConnection();
                this.ensurePeerConnection();
            }
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
            await this.flushPendingIceCandidates();
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.emitSignal('video_answer', { sdp: answer.sdp, type: answer.type });
            this.setRemoteStatus('Sende Antwort...');
            this.setStatus('Antwort gesendet');
            return;
        }

        if (signalType === 'video_answer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
            await this.flushPendingIceCandidates();
            this.offerPendingSince = null;
            this.setRemoteStatus('Gegnerkamera verbunden');
            this.setStatus('Video verbunden');
            return;
        }

        if (signalType === 'video_ice' && payload?.candidate) {
            const candidate = new RTCIceCandidate(payload.candidate);
            if (this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(candidate);
            } else {
                this.pendingIceCandidates.push(candidate);
            }
            return;
        }

        if (signalType === 'video_leave') {
            if (signalSessionId && this.opponentVideoSessionId && signalSessionId !== this.opponentVideoSessionId) {
                return;
            }
            this.opponentVideoSessionId = null;
            this.opponentVideoReady = false;
            this.handleRemoteDeparture('Gegnerkamera getrennt');
            this.setStatus('Gegnerkamera getrennt');
        }
    },

    async flushPendingIceCandidates() {
        if (!this.peerConnection?.remoteDescription || this.pendingIceCandidates.length === 0) return;

        for (const candidate of this.pendingIceCandidates.splice(0)) {
            await this.peerConnection.addIceCandidate(candidate);
        }
    },

    async flushPendingRemoteSignals() {
        if (!this.isEnabled || this.pendingRemoteSignals.length === 0) return;

        const queuedSignals = [...this.pendingRemoteSignals];
        this.pendingRemoteSignals = [];

        for (const queuedSignal of queuedSignals) {
            await this.handleSignal(queuedSignal.signalData, queuedSignal.fromPlayerId, {
                replayed: true,
                signalKey: queuedSignal.signalKey
            });
        }
    },

    attachVideoStreams() {
        this.localVideoEls.forEach(videoEl => {
            this.bindVideoElement(videoEl, this.localStream || null, {
                muted: true,
                hidden: false,
                isRemote: false
            }).catch(() => {});
        });

        this.remoteVideoEls.forEach(videoEl => {
            this.bindVideoElement(videoEl, this.remoteStream || null, {
                muted: this.isRemoteAudioMuted,
                hidden: this.isRemoteVideoHidden,
                isRemote: true
            }).catch(() => {});
        });
    },

    detachVideoStreams() {
        this.localVideoEls.forEach(videoEl => {
            if (videoEl) videoEl.srcObject = null;
        });
        this.remoteVideoEls.forEach(videoEl => {
            if (videoEl) videoEl.srcObject = null;
        });
    },

    setStatus(text) {
        this.statusText = text;
        this.refreshUiState();
    },

    setRemoteStatus(text) {
        this.remoteStatusText = text;
        this.refreshUiState();
    },

    getDisplayStatusText() {
        if (!this.isEnabled) return this.statusText;
        if (!this.remoteStatusText) return this.statusText;
        if (this.statusText === this.remoteStatusText) return this.statusText;
        return `${this.statusText} | ${this.remoteStatusText}`;
    },

    recordSignalDebug(direction, signalType) {
        this.lastSignalDirection = direction;
        this.lastSignalType = signalType || '-';
        try {
            this.lastSignalAt = new Date().toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (_error) {
            this.lastSignalAt = String(Date.now());
        }
    },

    recordIceProbeStatus(status) {
        this.lastIceProbeStatus = status || '-';
        try {
            this.lastIceProbeAt = new Date().toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (_error) {
            this.lastIceProbeAt = String(Date.now());
        }
    },

    getTrackSummary(stream) {
        const audioCount = stream?.getAudioTracks?.().length || 0;
        const videoCount = stream?.getVideoTracks?.().length || 0;
        return `${audioCount}A/${videoCount}V`;
    },

    getDebugText() {
        const peerState = this.peerConnection?.connectionState || 'none';
        const signalingState = this.peerConnection?.signalingState || 'none';
        const iceState = this.peerConnection?.iceConnectionState || 'none';
        const subscriptionState = this.signalSubscription ? 'on' : 'off';
        const localTracks = this.getTrackSummary(this.localStream);
        const remoteTracks = this.getTrackSummary(this.remoteStream);
        const lastSignal = `${this.lastSignalDirection} ${this.lastSignalType} @ ${this.lastSignalAt}`;
        const remoteUi = `${this.isRemoteAudioMuted ? 'mute' : 'audio'} / ${this.isRemoteVideoHidden ? 'hidden' : 'video'}`;
        const iceBundle = this.getConfiguredIceBundle();
        const lastIceProbe = `${this.lastIceProbeStatus} @ ${this.lastIceProbeAt}`;

        return [
            `peer: ${peerState}`,
            `signal: ${signalingState}`,
            `ice: ${iceState}`,
            `sub: ${subscriptionState}`,
            `preset: ${this.getPerformanceLabel()}`,
            `transport: ${iceBundle.hasTurn ? 'turn-ready' : 'stun-only'} (${iceBundle.source})`,
            `audio-policy: ${this.getAudioPolicyLabel()}`,
            `local: ${localTracks}`,
            `remote: ${remoteTracks}`,
            `queue: ${this.pendingIceCandidates.length}`,
            `mode: ${this.isReceiveOnlyMode ? 'receive-only' : 'full'}`,
            `turn-probe: ${lastIceProbe}`,
            `remote-playback: ${this.remotePlaybackBlocked ? 'unlock-needed' : 'ok'}`,
            `remote-ui: ${remoteUi}`,
            `last: ${lastSignal}`,
            `error: ${this.lastError || '-'}`,
        ].join('\n');
    },

    getDebugMarkup(scope) {
        if (!this.isDebugEnabled()) return '';

        return `
            <div class="online-video-debug">
                <div class="online-video-debug-head">
                    <span class="online-video-label">Debug</span>
                    <span class="online-video-mini-chip">Dev</span>
                </div>
                <pre id="online-video-debug-${scope}" class="online-video-debug-text"></pre>
            </div>
        `;
    },

    updateIndicatorElement(element, baseClass, indicator) {
        if (!element) return;
        element.textContent = indicator.label;
        element.className = `${baseClass} tone-${indicator.tone}`;
    },

    refreshUiState() {
        this.pruneDomElementReferences();
        this.initializeLifecycleObservers();
        this.attachVideoStreams();
        const connectionIndicator = this.getConnectionIndicator();
        const debugText = this.getDebugText();

        this.statusEls.forEach(statusEl => {
            if (statusEl) statusEl.textContent = this.getDisplayStatusText();
        });

        const lobbyDebug = document.getElementById('online-video-debug-lobby');
        if (lobbyDebug) lobbyDebug.textContent = debugText;

        const dockDebug = document.getElementById('online-video-debug-dock');
        if (dockDebug) dockDebug.textContent = debugText;

        const modeChip = document.getElementById('online-video-mode-chip');
        if (modeChip) modeChip.textContent = this.getModeLabel();

        const connectionChip = document.getElementById('online-video-connection-chip');
        this.updateIndicatorElement(connectionChip, 'online-video-chip', connectionIndicator);

        const performanceChip = document.getElementById('online-video-performance-chip');
        if (performanceChip) performanceChip.textContent = this.getPerformanceLabel();

        const iceChip = document.getElementById('online-video-ice-chip');
        if (iceChip) iceChip.textContent = this.getIceTransportLabel();

        const audioPolicyChip = document.getElementById('online-video-audio-policy-chip');
        if (audioPolicyChip) audioPolicyChip.textContent = this.getAudioPolicyLabel();

        const camChip = document.getElementById('online-video-cam-chip');
        if (camChip) camChip.textContent = this.getCameraLabel();

        const micChip = document.getElementById('online-video-mic-chip');
        if (micChip) micChip.textContent = this.getMicrophoneLabel();

        const peerChip = document.getElementById('online-video-peer-chip');
        if (peerChip) peerChip.textContent = this.getPeerLabel();

        const remoteAudioChip = document.getElementById('online-video-remote-audio-chip');
        if (remoteAudioChip) remoteAudioChip.textContent = this.getRemoteAudioLabel();

        const remoteVideoChip = document.getElementById('online-video-remote-video-chip');
        if (remoteVideoChip) remoteVideoChip.textContent = this.getRemoteVideoLabel();

        const helperText = document.getElementById('online-video-helper-text');
        if (helperText) helperText.textContent = this.getHelperText();

        const localBadge = document.getElementById('online-video-local-badge');
        if (localBadge) localBadge.textContent = this.getLocalTileBadge();

        const remoteBadge = document.getElementById('online-video-remote-badge');
        if (remoteBadge) remoteBadge.textContent = this.getRemoteTileBadge();

        const connectButton = document.getElementById('online-video-connect-btn');
        if (connectButton) {
            connectButton.textContent = this.isEnabled
                ? 'Video trennen'
                : (this.isStarting ? 'Starte...' : (this.canUseReceiveOnlyMode() ? 'Empfang starten' : 'Video verbinden'));
            connectButton.disabled = this.isStarting;
        }

        const turnProbeButton = document.getElementById('online-video-turn-probe-btn');
        if (turnProbeButton) {
            turnProbeButton.textContent = 'TURN Test';
            turnProbeButton.disabled = this.isStarting;
        }

        const toggleButton = document.getElementById('online-video-toggle-btn');
        if (toggleButton) {
            const videoTrack = this.localStream?.getVideoTracks?.()[0];
            if (this.isReceiveOnlyMode) {
                toggleButton.textContent = 'HTTPS fuer Cam';
                toggleButton.disabled = true;
            } else if (!this.isEnabled) {
                toggleButton.textContent = 'Nach Verbindung';
                toggleButton.disabled = true;
            } else {
                toggleButton.textContent = videoTrack?.enabled === false ? 'Kamera fortsetzen' : 'Kamera pausieren';
                toggleButton.disabled = false;
            }
        }

        const micButton = document.getElementById('online-video-mic-btn');
        if (micButton) {
            const microphoneTrack = this.getMicrophoneTrack();
            if (this.isReceiveOnlyMode) {
                micButton.textContent = 'HTTPS fuer Mic';
            } else if (!this.isEnabled) {
                micButton.textContent = 'Mikrofon aktivieren';
            } else if (!microphoneTrack) {
                micButton.textContent = 'Mikrofon freigeben';
            } else {
                micButton.textContent = microphoneTrack.enabled ? 'Mikrofon stumm' : 'Mikrofon aktivieren';
            }
            micButton.disabled = this.isStarting || this.isReceiveOnlyMode;
        }

        const unlockAudioButton = document.getElementById('online-video-unlock-audio-btn');
        if (unlockAudioButton) {
            unlockAudioButton.textContent = this.shouldPromptRemoteAudioUnlock() ? 'Audio freigeben' : 'Audio pruefen';
            unlockAudioButton.disabled = !this.hasRemoteMedia();
        }

        const switchButton = document.getElementById('online-video-switch-btn');
        if (switchButton) {
            switchButton.disabled = !this.isEnabled || this.isReceiveOnlyMode;
        }

        const remoteAudioButton = document.getElementById('online-video-remote-audio-btn');
        if (remoteAudioButton) {
            remoteAudioButton.textContent = this.isRemoteAudioMuted ? 'Gegnerton an' : 'Gegner stumm';
            remoteAudioButton.disabled = !this.hasRemoteMedia();
        }

        const remoteVideoButton = document.getElementById('online-video-remote-video-btn');
        if (remoteVideoButton) {
            remoteVideoButton.textContent = this.isRemoteVideoHidden ? 'Gegnerbild an' : 'Gegnerbild aus';
            remoteVideoButton.disabled = !this.hasRemoteMedia();
        }

        const statusPill = document.getElementById('online-video-status-pill');
        if (statusPill) {
            statusPill.textContent = this.isEnabled ? (this.isReceiveOnlyMode ? 'Empfang' : 'Aktiv') : 'Aus';
            statusPill.className = `online-status-pill status-${this.isEnabled ? 'live' : 'waiting'}`;
        }

        const dockState = document.getElementById('online-video-dock-state');
        if (dockState) {
            dockState.textContent = this.isEnabled ? this.remoteStatusText : 'Aus';
        }

        const dockToggle = document.getElementById('online-video-dock-toggle');
        if (dockToggle) {
            dockToggle.textContent = this.isDockExpanded ? 'Min' : 'Stage';
        }

        const dockMode = document.getElementById('online-video-dock-mode');
        if (dockMode) {
            dockMode.textContent = this.getModeLabel();
        }

        const dockConnection = document.getElementById('online-video-dock-connection');
        this.updateIndicatorElement(dockConnection, 'online-video-mini-chip', connectionIndicator);

        const dockPerformance = document.getElementById('online-video-dock-performance');
        if (dockPerformance) {
            dockPerformance.textContent = this.getPerformanceLabel();
        }

        const dockIce = document.getElementById('online-video-dock-ice');
        if (dockIce) {
            dockIce.textContent = this.getIceTransportLabel();
        }

        const dockPeer = document.getElementById('online-video-dock-peer');
        if (dockPeer) {
            dockPeer.textContent = this.getPeerLabel();
        }

        const dockMedia = document.getElementById('online-video-dock-media');
        if (dockMedia) {
            dockMedia.textContent = this.isReceiveOnlyMode ? this.getMicrophoneLabel() : `${this.getCameraLabel()} / ${this.getMicrophoneLabel()}`;
        }

        const dockHelper = document.getElementById('online-video-dock-helper');
        if (dockHelper) {
            dockHelper.textContent = this.getHelperText();
        }

        const dockStageBadge = document.getElementById('online-video-dock-stage-badge');
        this.updateIndicatorElement(dockStageBadge, 'online-video-badge', {
            label: this.getRemoteTileBadge(),
            tone: connectionIndicator.tone
        });

        const dockConnect = document.getElementById('online-video-dock-connect');
        if (dockConnect) {
            dockConnect.textContent = this.isEnabled ? 'Disconnect' : 'Connect';
            dockConnect.disabled = this.isStarting;
        }

        const dockTurn = document.getElementById('online-video-dock-turn');
        if (dockTurn) {
            dockTurn.textContent = 'TURN';
            dockTurn.disabled = this.isStarting;
        }

        const dockCam = document.getElementById('online-video-dock-cam');
        if (dockCam) {
            const videoTrack = this.localStream?.getVideoTracks?.()[0];
            if (this.isReceiveOnlyMode) {
                dockCam.textContent = 'Recv';
                dockCam.disabled = true;
            } else if (!this.isEnabled) {
                dockCam.textContent = 'Verbinden';
                dockCam.disabled = true;
            } else {
                dockCam.textContent = videoTrack?.enabled === false ? 'Cam+' : 'Cam';
                dockCam.disabled = false;
            }
        }

        const dockMic = document.getElementById('online-video-dock-mic');
        if (dockMic) {
            const microphoneTrack = this.getMicrophoneTrack();
            if (this.isReceiveOnlyMode) {
                dockMic.textContent = 'Recv';
            } else if (!this.isEnabled) {
                dockMic.textContent = 'Mic';
            } else if (!microphoneTrack) {
                dockMic.textContent = 'Mic+';
            } else {
                dockMic.textContent = microphoneTrack.enabled ? 'Mute' : 'Mic';
            }
            dockMic.disabled = this.isStarting || this.isReceiveOnlyMode;
        }

        const dockFlip = document.getElementById('online-video-dock-flip');
        if (dockFlip) {
            dockFlip.disabled = !this.isEnabled || this.isReceiveOnlyMode;
        }

        const dockUnlock = document.getElementById('online-video-dock-unlock');
        if (dockUnlock) {
            dockUnlock.textContent = this.shouldPromptRemoteAudioUnlock() ? 'Unlock' : 'Play';
            dockUnlock.disabled = !this.hasRemoteMedia();
        }

        const dockAudio = document.getElementById('online-video-dock-audio');
        if (dockAudio) {
            dockAudio.textContent = this.isRemoteAudioMuted ? 'Audio+' : 'MuteR';
            dockAudio.disabled = !this.hasRemoteMedia();
        }

        const dockHide = document.getElementById('online-video-dock-hide');
        if (dockHide) {
            dockHide.textContent = this.isRemoteVideoHidden ? 'ShowR' : 'HideR';
            dockHide.disabled = !this.hasRemoteMedia();
        }

        if (this.floatingDockEl) {
            this.floatingDockEl.classList.toggle('expanded', this.isDockExpanded);
            this.floatingDockEl.classList.toggle('minimized', !this.isDockExpanded);
            this.applyDockPosition();
        }

        this.syncUiVisibility();
    }
};

window.OnlineVideoService = OnlineVideoService;
