import { htmlBoardControl } from '../views/view-board-control.js';
import { LevelSystem } from '../supabase_client.js';

export class ScoringBoardControl {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.appContainer = document.getElementById('view-game-active');
        this.frozenTargetDisplay = null;
        this.playerName = 'PLAYER';
        this.displayLevel = 'CHALLENGE ACTIVE';
        this.onlineService = null;
        this.isInputLocked = false;
        this.isSubmittingOnlineTurn = false;
        this.onlineDraftDarts = [];
        this.autoNextTimeout = null;
        this.elements = {};
    }

    setOnlineMode(service) {
        this.onlineService = service;
    }

    async init() {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        this.appContainer.classList.remove('hidden');
        this.frozenTargetDisplay = null;

        const appHeader = document.querySelector('.app-top-bar');
        if (appHeader) appHeader.classList.add('hidden');

        document.body.classList.add('game-active');

        const profile = LevelSystem.lastProfileData;
        if (profile && profile.username) {
            this.playerName = profile.username.toUpperCase();
        } else if (window.appState?.profile?.username) {
            this.playerName = window.appState.profile.username.toUpperCase();
        }

        if (this.game.isTraining) {
            this.displayLevel = `${this.game.name} (TRAINING)`;
        } else if (this.game.level || this.game.difficulty) {
            this.displayLevel = `LEVEL ${this.game.level || this.game.difficulty}`;
        } else {
            this.displayLevel = this.game.name || 'CHALLENGE ACTIVE';
        }

        this.renderInitialLayout();
        this.updateView();
    }

    renderInitialLayout() {
        this.appContainer.innerHTML = htmlBoardControl(
            '',
            [],
            0,
            0,
            0,
            0,
            1,
            10,
            0,
            this.playerName,
            this.displayLevel,
            this.game.displayName || this.game.name || 'Board Control'
        );

        const ids = [
            'main-target',
            'bc-points-display',
            'x01-round',
            'bc-heart-container',
            'bc-bolt-container',
            'bc-dart-1',
            'bc-dart-2',
            'bc-dart-3'
        ];

        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    updateView() {
        const currentTarget = this.game.targets
            ? this.game.targets[this.game.currentIndex]
            : (this.game.targetDisplay || 'FIN');

        const target = (this.game.roundDarts.length === 3 && this.frozenTargetDisplay !== null)
            ? this.frozenTargetDisplay
            : currentTarget;

        const roundDarts = this.game.roundDarts || [];
        const score = this.game.points || 0;
        const malus = this.game.malusScore || 0;
        const lives = this.game.lives !== undefined ? this.game.lives : 0;
        const bolts = this.game.bolts !== undefined ? this.game.bolts : 0;
        const round = this.game.round || 1;
        const maxRounds = this.game.maxRounds || 10;
        const minPoints = this.game.config?.minPoints ?? this.game.minPoints ?? 0;

        if (this.elements['main-target']) {
            this.elements['main-target'].textContent = target === 25 ? 'BULL' : target;
        }

        if (this.elements['bc-points-display']) {
            this.elements['bc-points-display'].innerHTML = `
                <span class="ani-next-score" style="font-weight: 900; font-size: 0.9rem; color: var(--target-blue-1);">${score}</span>
                ${malus > 0 ? `<span style="color: var(--neon-red); font-size: 0.75rem; font-weight: 800;">(-${malus})</span>` : ''}
            `;
        }

        const minPointsEl = document.getElementById('bc-min-points-display');
        if (minPointsEl) {
            minPointsEl.textContent = minPoints > 0 ? `${minPoints}` : '--';
        }

        if (this.elements['x01-round']) {
            this.elements['x01-round'].textContent = `${round}/${maxRounds}`;
        }

        const activeTargets = this.game.currentTargets || [target, target, target];
        for (let i = 0; i < 3; i++) {
            const el = this.elements[`bc-dart-${i + 1}`];
            if (!el) continue;

            const val = roundDarts[i];
            if (val !== undefined) {
                let text = 'M';
                if (val > 0) {
                    const prefix = val === 1 ? 'S' : (val === 2 ? 'D' : 'T');
                    const dartTarget = activeTargets[i] || target;
                    const tNum = dartTarget === 25 ? 'BULL' : dartTarget;
                    text = `${prefix}-${tNum}`;
                }
                el.textContent = text;
                el.className = `dart-dot filled ${val > 0 ? 'hit' : 'miss'}`;
                const bgColors = ['var(--target-blue-1)', 'var(--target-blue-2)', 'var(--target-blue-3)'];
                el.style.background = val > 0 ? bgColors[i] : '';
            } else {
                el.textContent = '-';
                el.className = 'dart-dot empty';
                el.style.background = '';
            }
        }

        if (this.elements['bc-heart-container']) {
            this.elements['bc-heart-container'].innerHTML = this.generateIconHtml(lives, 'ri-heart-fill', 'icon-heart');
        }
        if (this.elements['bc-bolt-container']) {
            this.elements['bc-bolt-container'].innerHTML = this.generateIconHtml(bolts, 'ri-flashlight-fill', 'icon-bolt');
        }

        requestAnimationFrame(() => {
            this.highlightBoard();
            this.highlightNextButton(roundDarts.length >= 3);
        });

        this.updateOnlineInteractionState();

        if (!this.onlineService && this.game.isFinished && window.GameManager?.completeGame) {
            setTimeout(() => {
                window.GameManager.completeGame();
            }, 600);
        }
    }

    updateOnlineInteractionState() {
        if (!this.onlineService) return;

        const controlsDisabled = this.isInputLocked || this.isSubmittingOnlineTurn;
        document.querySelectorAll('.bc-btn-small').forEach(btn => {
            btn.disabled = controlsDisabled;
        });

        const undoBtn = document.getElementById('bc-undo-btn');
        const nextBtn = document.getElementById('bc-next-btn');
        if (undoBtn) undoBtn.disabled = controlsDisabled || this.onlineDraftDarts.length === 0;
        if (nextBtn) nextBtn.disabled = controlsDisabled || this.onlineDraftDarts.length === 0;
    }

    generateIconHtml(count, iconClass, activeClass) {
        let html = '';
        for (let i = 0; i < 3; i++) {
            const isActive = i < count;
            html += `<i class="${iconClass} ${isActive ? activeClass : 'icon-empty'}"></i>`;
        }
        return html;
    }

    highlightBoard() {
        document.querySelectorAll('.segment-path').forEach(path => {
            path.classList.remove(
                'target-dart-1', 'target-dart-2', 'target-dart-3',
                'toggle-color-1-2', 'toggle-color-2-3', 'toggle-color-1-3', 'toggle-color-1-2-3'
            );
        });

        const throwsCount = (this.game.roundDarts || []).length;
        if (throwsCount >= 3 || this.frozenTargetDisplay !== null) return;

        const targets = this.game.currentTargets || [];
        if (targets.length === 0) return;

        const segmentMap = {};
        for (let i = throwsCount; i < 3; i++) {
            const num = targets[i];
            if (num === undefined) continue;
            if (!segmentMap[num]) segmentMap[num] = [];
            segmentMap[num].push(i + 1);
        }

        for (const [num, dartIndices] of Object.entries(segmentMap)) {
            const segmentGroup = document.getElementById(`segment-${num}`);
            if (!segmentGroup) continue;

            const paths = segmentGroup.querySelectorAll('.segment-path');
            paths.forEach(path => {
                const sorted = [...dartIndices].sort((a, b) => a - b);
                if (sorted.length === 3) path.classList.add('toggle-color-1-2-3');
                else if (sorted.length === 2) path.classList.add(`toggle-color-${sorted[0]}-${sorted[1]}`);
                else if (sorted.length === 1) path.classList.add(`target-dart-${sorted[0]}`);
            });
        }
    }

    handleInput(multiplier) {
        if (this.onlineService) {
            if (this.isInputLocked || this.isSubmittingOnlineTurn || this.onlineDraftDarts.length >= 3 || this.game.isFinished) {
                return;
            }

            this.onlineDraftDarts.push(multiplier);
            this.game.roundDarts = [...this.onlineDraftDarts];
            if (this.game.roundDarts.length === 3) {
                this.frozenTargetDisplay = this.game.targetDisplay || this.game.currentTargetNumber;
            }

            window.SoundManager?.play(multiplier > 0 ? 'hit' : 'miss');
            this.triggerHitEffect(multiplier);
            this.updateView();
            return;
        }

        if (this.game.roundDarts.length >= 3 || this.game.isFinished) return;

        const displayBefore = this.game.targetDisplay || this.game.currentTargetNumber;
        const roundBefore = this.game.round;

        this.game.registerThrow(multiplier);
        window.SoundManager?.play(multiplier > 0 ? 'hit' : 'miss');

        if (this.game.roundDarts.length === 3) {
            this.frozenTargetDisplay = this.game.targetDisplay || displayBefore;
        }

        if (this.game.round > roundBefore && this.game.bolts === 0) {
            this.game.bolts = this.game.config?.startBlitz || 0;
            this.triggerBurnoutEffect();
        }

        this.triggerHitEffect(multiplier);
        this.updateView();

        const currentDarts = this.game.roundDarts.length;
        if (currentDarts === 3 && !this.game.isFinished) {
            const nextBtn = document.getElementById('bc-next-btn');
            if (nextBtn) {
                nextBtn.classList.remove('auto-next-anim');
                void nextBtn.offsetWidth;
                nextBtn.classList.add('auto-next-anim');
            }

            clearTimeout(this.autoNextTimeout);
            this.autoNextTimeout = setTimeout(() => {
                if (nextBtn) nextBtn.classList.remove('auto-next-anim');
                if (currentDarts === 3) {
                    window.GameManager.nextRoundBC();
                }
            }, 1100);
        }
    }

    nextRound() {
        if (this.onlineService) {
            this.submitOnlineTurn();
            return;
        }

        if (!this.game) return;
        const btn = document.getElementById('bc-next-btn');
        if (btn) btn.classList.add('ani-next-score');

        this.game.nextRound();
        this.frozenTargetDisplay = null;

        if (this.game.bolts === 0 && this.game.config?.startBlitz > 0) {
            this.game.bolts = this.game.config.startBlitz;
            this.triggerBurnoutEffect();
        }

        this.updateView();

        setTimeout(() => {
            const scoreDisplay = document.getElementById('bc-points-display');
            if (scoreDisplay) scoreDisplay.classList.remove('ani-next-score');
        }, 500);
    }

    undo() {
        if (this.onlineService) {
            if (this.isInputLocked || this.isSubmittingOnlineTurn || this.onlineDraftDarts.length === 0) return;

            clearTimeout(this.autoNextTimeout);
            const btn = document.getElementById('bc-undo-btn');
            if (btn) btn.classList.add('ani-undo');

            this.onlineDraftDarts.pop();
            this.game.roundDarts = [...this.onlineDraftDarts];
            if (this.onlineDraftDarts.length < 3) this.frozenTargetDisplay = null;
            this.updateView();

            setTimeout(() => {
                if (btn) btn.classList.remove('ani-undo');
            }, 400);
            return;
        }

        clearTimeout(this.autoNextTimeout);
        const nextBtn = document.getElementById('bc-next-btn');
        if (nextBtn) nextBtn.classList.remove('auto-next-anim');

        const btn = document.getElementById('bc-undo-btn');
        if (btn) btn.classList.add('ani-undo');

        this.frozenTargetDisplay = null;
        if (this.game.undo) this.game.undo();
        else if (this.game.roundDarts.length > 0) this.game.roundDarts.pop();

        this.updateView();

        setTimeout(() => {
            if (btn) btn.classList.remove('ani-undo');
        }, 400);
    }

    highlightNextButton(active) {
        const btn = document.getElementById('bc-next-btn');
        if (btn) btn.classList.toggle('confirm-next', active);
    }

    triggerBurnoutEffect() {
        this.appContainer.classList.add('burnout-active');
        setTimeout(() => this.appContainer.classList.remove('burnout-active'), 500);
    }

    triggerHitEffect(multiplier) {
        const overlay = document.getElementById('board-flash-overlay');
        if (!overlay) return;
        overlay.classList.remove('flash-active', 'flash-miss');
        void overlay.offsetWidth;
        overlay.classList.add(multiplier > 0 ? 'flash-active' : 'flash-miss');
    }

    applyOnlineSnapshot(snapshot) {
        if (!this.onlineService || !snapshot?.currentPlayerState) return;

        const playerState = snapshot.currentPlayerState;
        const settings = snapshot.state?.settings || {};
        const opponentName = snapshot.opponent?.username || snapshot.opponent?.name || 'Gegner';
        const gameId = snapshot.gameId || snapshot.room?.game_id || 'shanghai';
        const serverRoundDarts = Array.isArray(playerState.roundDarts) ? playerState.roundDarts : [];
        const shouldKeepDraft = snapshot.isMyTurn
            && this.onlineDraftDarts.length > 0
            && serverRoundDarts.length === 0
            && !snapshot.isFinished
            && !this.isSubmittingOnlineTurn;

        this.playerName = snapshot.currentPlayer?.username?.toUpperCase()
            || window.appState?.profile?.username?.toUpperCase()
            || 'PLAYER';
        this.displayLevel = snapshot.opponentConnected === false
            ? `${opponentName.toUpperCase()} OFFLINE`
            : (snapshot.isMyTurn ? 'DU BIST DRAN' : `${opponentName.toUpperCase()} IST DRAN`);

        this.game.level = settings.level || this.game.level;
        this.game.config = { ...(this.game.config || {}), ...settings };
        this.game.targets = Array.isArray(settings.targets) ? settings.targets : (this.game.targets || []);
        this.game.targetHitsNeeded = settings.hitsPerTarget || this.game.targetHitsNeeded || 1;
        this.game.currentIndex = playerState.currentIndex ?? this.game.currentIndex;
        this.game.currentHitsOnTarget = playerState.currentHitsOnTarget ?? this.game.currentHitsOnTarget ?? 0;
        this.game.points = playerState.points ?? 0;
        this.game.malusScore = playerState.malusScore ?? 0;
        this.game.bolts = playerState.bolts ?? 0;
        this.game.lives = playerState.lives ?? 0;
        this.game.round = playerState.round ?? 1;
        this.game.maxRounds = playerState.maxRounds ?? settings.rounds ?? this.game.maxRounds;
        this.game.roundStartIndex = playerState.roundStartIndex ?? this.game.currentIndex ?? 0;
        this.game.roundStartHits = playerState.roundStartHits ?? this.game.currentHitsOnTarget ?? 0;
        this.game.isFinished = !!playerState.isFinished;
        this.game.stats = { ...(this.game.stats || {}), ...(playerState.stats || {}) };

        if (!shouldKeepDraft) {
            this.onlineDraftDarts = [...serverRoundDarts];
        }

        this.game.roundDarts = shouldKeepDraft ? [...this.onlineDraftDarts] : [...serverRoundDarts];
        this.isInputLocked = !snapshot.isMyTurn || snapshot.isFinished || !!playerState.isFinished;

        if (!snapshot.isMyTurn || snapshot.isFinished) {
            this.onlineDraftDarts = [];
            this.game.roundDarts = [];
        }

        if (this.game.roundDarts.length < 3) {
            this.frozenTargetDisplay = null;
        }

        const playerNameEl = document.getElementById('x01-player-name');
        const titleEl = document.getElementById('x01-challenge-title');
        const gameNameEl = document.getElementById('x01-game-name');
        if (playerNameEl) playerNameEl.textContent = this.playerName;
        if (titleEl) titleEl.textContent = this.displayLevel;
        if (gameNameEl) {
            gameNameEl.textContent = snapshot.room?.room_code
                ? `ONLINE SHANGHAI • ${snapshot.room.room_code}`
                : 'ONLINE SHANGHAI';
        }

        this.updateView();

        if (snapshot.isFinished && window.GameManager) {
            window.GameManager.completeGame(true);
        }
    }

    async submitOnlineTurn() {
        if (!this.onlineService || this.isInputLocked || this.isSubmittingOnlineTurn) return;
        if (this.onlineDraftDarts.length === 0) return;

        try {
            this.isSubmittingOnlineTurn = true;
            this.updateOnlineInteractionState();
            await this.onlineService.submitTurn([...this.onlineDraftDarts]);
            this.onlineDraftDarts = [];
            this.game.roundDarts = [];
            this.frozenTargetDisplay = null;
        } catch (error) {
            console.error(error);
        } finally {
            this.isSubmittingOnlineTurn = false;
            this.updateOnlineInteractionState();
        }
    }
}
