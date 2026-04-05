import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

export class WarmupController {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.modifier = 1;
        this.appContainer = document.getElementById('view-game-x01');
        this.ui = {};
        this.onlineService = null;
        this.isInputLocked = false;
        this.isSubmittingOnlineTurn = false;
        this.lastConfirmedRound = null;
        this.lastConfirmedPoints = null;
        this.localOnlineProgress = null;
        this.autoNextTimeout = null;
    }

    setOnlineMode(service) {
        this.onlineService = service;
    }

    getNextButton() {
        return document.getElementById('x01-next-btn') || document.querySelector('.next-btn-side');
    }

    captureOnlineProgress() {
        if (!this.onlineService) return;
        this.localOnlineProgress = this.createLocalProgressSnapshot();
    }

    getMappedServerRoundThrows(playerState) {
        const serverRoundThrows = Array.isArray(playerState?.currentRoundThrows) ? playerState.currentRoundThrows : [];
        return serverRoundThrows.map(throwData => ({
            ...throwData,
            displayValue: throwData.displayValue ?? (throwData.val === 25 ? 'DB' : String(throwData.val ?? 0))
        }));
    }

    async init() {
        document.body.classList.add('game-active');
        document.body.classList.add('hide-app-header');

        if (this.appContainer) {
            this.appContainer.innerHTML = htmlX01;
            this.appContainer.classList.remove('hidden');

            this.ui = {
                score: this.appContainer.querySelector('#x01-score'),
                round: this.appContainer.querySelector('#x01-round'),
                playerName: this.appContainer.querySelector('#x01-player-name'),
                gameName: this.appContainer.querySelector('#x01-game-name'),
                challengeTitle: this.appContainer.querySelector('#x01-challenge-title'),
                scoringStats: this.appContainer.querySelector('#x01-scoring-stats'),
                challengeHeader: this.appContainer.querySelector('#x01-challenge-header'),
                targetContainer: this.appContainer.querySelector('#x01-target-progress-container'),
                targetProgress: this.appContainer.querySelector('#x01-target-progress'),
                minPtsContainer: this.appContainer.querySelector('#x01-min-pts-container'),
                minPtsVal: this.appContainer.querySelector('#x01-min-pts-val'),
                statsBar: this.appContainer.querySelector('#x01-stats-bar'),
                points: this.appContainer.querySelector('#x01-points'),
                malus: this.appContainer.querySelector('#x01-malus'),
                pointsContainer: this.appContainer.querySelector('#x01-points-container'),
                malusContainer: this.appContainer.querySelector('#x01-malus-container'),
                flashOverlay: this.appContainer.querySelector('#board-flash-overlay'),
                throws: [
                    this.appContainer.querySelector('#th-1'),
                    this.appContainer.querySelector('#th-2'),
                    this.appContainer.querySelector('#th-3')
                ],
                dartIcons: [
                    this.appContainer.querySelector('#dart-1'),
                    this.appContainer.querySelector('#dart-2'),
                    this.appContainer.querySelector('#dart-3')
                ]
            };
        }

        if (this.ui.scoringStats) this.ui.scoringStats.classList.add('hidden');
        if (this.ui.challengeHeader) {
            this.ui.challengeHeader.style.display = 'flex';
            this.ui.challengeHeader.classList.remove('hidden');
        }
        if (this.ui.targetContainer) this.ui.targetContainer.style.display = 'flex';
        if (this.ui.minPtsContainer && this.game.minPointsRequired) {
            this.ui.minPtsContainer.style.display = 'flex';
        }
        const progressLabel = this.appContainer?.querySelector('#x01-target-progress-container .label');
        if (progressLabel) progressLabel.textContent = 'RUN';

        await this.updateHeaderInfo();
        this.updateUI();
    }

    async updateHeaderInfo() {
        if (!this.ui.playerName && !this.ui.challengeTitle) return;

        let displayName = 'PLAYER';
        const profile = LevelSystem.lastProfileData;

        if (profile?.username) {
            displayName = profile.username;
        } else if (window.appState?.profile?.username) {
            displayName = window.appState.profile.username;
        }

        let displayLevel = 'CHALLENGE ACTIVE';
        if (this.game?.level) {
            displayLevel = `LEVEL ${this.game.level}`;
        } else if (this.game?.difficulty) {
            displayLevel = `LEVEL ${this.game.difficulty}`;
        }

        if (this.ui.playerName) this.ui.playerName.textContent = displayName.toUpperCase();
        if (this.ui.gameName) this.ui.gameName.textContent = this.game.displayName || this.game.name || 'Warmup';
        if (this.ui.challengeTitle) this.ui.challengeTitle.textContent = displayLevel;
    }

    createLocalProgressSnapshot() {
        return {
            points: this.game.points,
            round: this.game.round,
            maxRounds: this.game.maxRounds,
            currentRoundThrows: Array.isArray(this.game.currentRoundThrows) ? [...this.game.currentRoundThrows] : [],
            stats: { ...(this.game.stats || {}) },
            isFinished: this.game.isFinished
        };
    }

    hydrateLocalProgress(progress) {
        if (!progress) return;
        this.game.points = progress.points ?? this.game.points;
        this.game.round = progress.round ?? this.game.round;
        this.game.maxRounds = progress.maxRounds ?? this.game.maxRounds;
        this.game.currentRoundThrows = Array.isArray(progress.currentRoundThrows) ? [...progress.currentRoundThrows] : [];
        this.game.stats = { ...(this.game.stats || {}), ...(progress.stats || {}) };
        this.game.isFinished = !!progress.isFinished;
    }

    clearAutoNextState() {
        clearTimeout(this.autoNextTimeout);
        this.autoNextTimeout = null;

        const nextBtn = this.getNextButton();
        if (nextBtn) nextBtn.classList.remove('auto-next-anim');
    }

    updateOnlineInteractionState() {
        if (!this.onlineService) return;

        const controlsDisabled = this.isInputLocked || this.isSubmittingOnlineTurn;
        document.querySelectorAll('.mod-btn').forEach(btn => {
            btn.disabled = controlsDisabled;
        });

        const undoBtn = document.querySelector('.undo-btn');
        const nextBtn = document.getElementById('x01-next-btn') || document.querySelector('.next-btn-side');
        if (undoBtn) undoBtn.disabled = controlsDisabled || this.game.currentRoundThrows.length === 0;
        if (nextBtn) nextBtn.disabled = controlsDisabled || this.game.currentRoundThrows.length === 0;
    }

    handleInput(val, mult) {
        if (this.isInputLocked || this.isSubmittingOnlineTurn) return;
        if (this.game.currentRoundThrows.length >= 3) return;

        const safeVal = parseInt(val, 10) || 0;
        const finalMult = this.modifier !== 1 ? this.modifier : (parseInt(mult, 10) || 1);

        this.triggerFlash(safeVal, finalMult);
        this.game.registerHit(safeVal, finalMult);
        const latestThrow = Array.isArray(this.game.currentRoundThrows)
            ? this.game.currentRoundThrows[this.game.currentRoundThrows.length - 1]
            : null;
        const latestThrowIndex = Math.max(0, this.game.currentRoundThrows.length - 1);
        window.SoundManager?.play(safeVal === 0 ? 'miss' : 'hit');

        this.modifier = 1;
        this.captureOnlineProgress();
        this.updateUI();
        this.animateThrowPill(latestThrowIndex, latestThrow);

        const currentDarts = this.game.currentRoundThrows.length;
        if (currentDarts === 3 && !this.game.isFinished) {
            const nextBtn = this.getNextButton();
            if (nextBtn) {
                nextBtn.classList.remove('auto-next-anim');
                void nextBtn.offsetWidth;
                nextBtn.classList.add('auto-next-anim');
            }

            this.clearAutoNextState();
            if (nextBtn) nextBtn.classList.add('auto-next-anim');

            this.autoNextTimeout = setTimeout(() => {
                if (this.onlineService) {
                    this.submitOnlineTurn();
                } else if (this.game.currentRoundThrows.length === 3) {
                    window.GameManager.nextRoundX01();
                }
                this.autoNextTimeout = null;
            }, 1100);
        }
    }

    triggerFlash(val, mult) {
        if (!this.ui.flashOverlay) return;
        const flashClass = mult === 3 ? 'flash-triple' : (val === 0 ? 'flash-miss' : 'flash-active');
        this.ui.flashOverlay.classList.remove('flash-active', 'flash-triple', 'flash-miss');
        void this.ui.flashOverlay.offsetWidth;
        this.ui.flashOverlay.classList.add(flashClass);
        clearTimeout(this.ui.flashOverlay._flashTimer);
        this.ui.flashOverlay._flashTimer = setTimeout(() => {
            this.ui.flashOverlay.classList.remove('flash-active', 'flash-triple', 'flash-miss');
        }, 460);

        if (val === 0) return;

        const segment = this.appContainer?.querySelector(`#segment-${val}`);
        if (!segment) return;

        const path = val === 25
            ? (mult === 2 ? segment.querySelector('.bull-inner') : segment.querySelector('.bull-outer'))
            : (mult === 3
                ? segment.querySelector('.triple-path')
                : (mult === 2
                    ? segment.querySelector('.double-path')
                    : segment.querySelector('path.segment-path:not(.double-path):not(.triple-path)')));

        if (!path) return;

        const variantClass = val === 25
            ? 'segment-hit-bull'
            : (mult === 3 ? 'segment-hit-triple' : (mult === 2 ? 'segment-hit-double' : 'segment-hit-single'));

        segment.classList.remove('segment-hit-group');
        void segment.offsetWidth;
        segment.classList.add('segment-hit-group');

        path.classList.remove('segment-hit-pulse', 'segment-hit-single', 'segment-hit-double', 'segment-hit-triple', 'segment-hit-bull');
        void path.offsetWidth;
        path.classList.add('segment-hit-pulse', variantClass);
        clearTimeout(segment._groupHitTimer);
        segment._groupHitTimer = setTimeout(() => {
            segment.classList.remove('segment-hit-group');
        }, 320);
        clearTimeout(path._hitTimer);
        path._hitTimer = setTimeout(() => {
            path.classList.remove('segment-hit-pulse', variantClass);
        }, 620);
    }

    animateThrowPill(index, throwData) {
        const box = this.ui.throws?.[index];
        if (!box) return;

        const isMiss = !throwData || throwData.isHit === false || throwData.val === 0;
        box.classList.remove('throw-hit-pop', 'throw-hit-miss');
        void box.offsetWidth;
        box.classList.add('throw-hit-pop');
        if (isMiss) box.classList.add('throw-hit-miss');

        clearTimeout(box._pillTimer);
        box._pillTimer = setTimeout(() => {
            box.classList.remove('throw-hit-pop', 'throw-hit-miss');
        }, 560);
    }

    setModifier(m) {
        if (this.isInputLocked || this.isSubmittingOnlineTurn) return;
        this.modifier = this.modifier === m ? 1 : m;
        this.updateModifierUI();
    }

    nextRound() {
        if (this.onlineService) {
            this.submitOnlineTurn();
            return;
        }

        if (this.game.nextRound) this.game.nextRound();
        this.modifier = 1;
        this.updateUI();
    }

    undo() {
        if (this.isInputLocked || this.isSubmittingOnlineTurn) return;

        this.clearAutoNextState();
        if (this.game.undo) this.game.undo();
        this.modifier = 1;

        this.localOnlineProgress = this.onlineService && this.game.currentRoundThrows.length > 0
            ? this.createLocalProgressSnapshot()
            : null;

        this.updateUI();
    }

    updateUI() {
        if (!this.game) return;

        const throws = this.game.currentRoundThrows || [];
        const targets = this.game.currentTargets || [];
        const currentTarget = targets[throws.length];

        if (this.ui.score) {
            this.ui.score.textContent = currentTarget === 25 ? 'BULL' : (currentTarget ?? '-');
            this.ui.score.style.color = '#00f2ff';
        }

        if (this.ui.round) this.ui.round.textContent = `Runde ${this.game.round ?? 1}`;
        this.renderDisplayStats();

        this.ui.throws.forEach((box, index) => {
            if (!box) return;

            box.className = 'throw-box';
            const dartData = throws[index];
            const i = index + 1;

            if (dartData) {
                box.classList.add(`target-dart-${i}`, `active-dart-${i}`);
                const prefix = dartData.mult === 3 ? 'T' : (dartData.mult === 2 ? 'D' : '');
                box.textContent = `${prefix}${dartData.displayValue}`;
                if (!dartData.isHit) box.classList.add('missed');
            } else {
                box.classList.add(`target-dart-${i}`);
                box.textContent = '';
                if (i === throws.length + 1) box.classList.add('next-up');
            }
        });

        this.ui.dartIcons.forEach((icon, index) => {
            if (!icon) return;
            const i = index + 1;
            icon.style.opacity = i <= (3 - throws.length) ? '1' : '0.2';
        });

        this.highlightBoard();
        this.updateModifierUI();
        this.updateOnlineInteractionState();

        if (!this.onlineService && this.game.isFinished && window.GameManager?.completeGame) {
            window.GameManager.completeGame();
        }
    }

    renderDisplayStats() {
        if (this.ui.statsBar) this.ui.statsBar.style.display = 'none';
        if (this.ui.points) this.ui.points.textContent = this.game.points;

        const malusVal = document.getElementById('x01-malus-val');
        if (malusVal) malusVal.textContent = this.game.malusTotal || 0;

        const totalPointsVal = document.getElementById('x01-total-points');
        if (totalPointsVal) totalPointsVal.textContent = this.game.points;

        if (this.ui.targetProgress) {
            const current = this.game.round || 1;
            const total = this.game.maxRounds || 10;
            this.ui.targetProgress.textContent = `${current}/${total}`;
        }

        if (this.ui.minPtsVal) {
            this.ui.minPtsVal.textContent = this.game.minPointsRequired || 0;
        }

        if (this.ui.malus) this.ui.malus.textContent = `-${this.game.malusTotal || 0}`;
        if (this.ui.pointsContainer) this.ui.pointsContainer.classList.remove('hidden');
        if (this.ui.malusContainer) this.ui.malusContainer.classList.remove('hidden');
    }

    applyOnlineSnapshot(snapshot) {
        if (!this.onlineService || !snapshot?.currentPlayerState) return;

        const playerState = snapshot.currentPlayerState;
        const settings = snapshot.state?.settings || {};
        const opponentName = snapshot.opponent?.username || snapshot.opponent?.name || 'Gegner';
        const serverRoundThrows = Array.isArray(playerState.currentRoundThrows) ? playerState.currentRoundThrows : [];
        const hasLocalDraft = Array.isArray(this.localOnlineProgress?.currentRoundThrows) && this.localOnlineProgress.currentRoundThrows.length > 0;
        const staleDuringSubmit = this.isSubmittingOnlineTurn
            && snapshot.isMyTurn
            && !snapshot.isFinished
            && serverRoundThrows.length === 0
            && playerState.round === this.lastConfirmedRound
            && playerState.points === this.lastConfirmedPoints;
        const shouldPreserveLocalDraft = snapshot.isMyTurn
            && hasLocalDraft
            && serverRoundThrows.length === 0
            && !snapshot.isFinished
            && (!this.isSubmittingOnlineTurn || staleDuringSubmit);

        this.lastConfirmedRound = playerState.round ?? this.lastConfirmedRound;
        this.lastConfirmedPoints = playerState.points ?? this.lastConfirmedPoints;

        this.game.level = settings.level || this.game.level;
        this.game.config = { ...(this.game.config || {}), ...settings };
        if (Array.isArray(settings.gamePlan)) {
            this.game.gamePlan = settings.gamePlan.map(step => ({
                ...step,
                target: Array.isArray(step.target) ? [...step.target] : []
            }));
        }
        this.game.points = playerState.points ?? this.game.points ?? 0;
        this.game.round = playerState.round ?? this.game.round ?? 1;
        this.game.maxRounds = playerState.maxRounds ?? settings.maxRounds ?? this.game.maxRounds;
        this.game.isFinished = !!playerState.isFinished;
        this.game.stats = { ...(this.game.stats || {}), ...(playerState.stats || {}) };

        if (shouldPreserveLocalDraft) {
            this.hydrateLocalProgress(this.localOnlineProgress);
        } else {
            this.localOnlineProgress = null;
            this.game.currentRoundThrows = this.getMappedServerRoundThrows(playerState);
        }

        this.isInputLocked = !snapshot.isMyTurn || snapshot.isFinished || !!playerState.isFinished;
        if (snapshot.isFinished || !snapshot.isMyTurn || !staleDuringSubmit) {
            this.isSubmittingOnlineTurn = false;
        }
        if (!snapshot.isMyTurn || snapshot.isFinished) {
            this.localOnlineProgress = null;
            this.clearAutoNextState();
            this.game.currentRoundThrows = [];
        }

        if (this.ui.playerName) {
            this.ui.playerName.textContent = snapshot.currentPlayer?.username || snapshot.currentPlayer?.name || window.appState?.profile?.username || 'You';
        }
        if (this.ui.gameName) {
            this.ui.gameName.textContent = snapshot.room?.room_code ? `ONLINE JDC - ${snapshot.room.room_code}` : 'ONLINE JDC';
        }
        if (this.ui.challengeTitle) {
            this.ui.challengeTitle.textContent = snapshot.opponentConnected === false
                ? `${opponentName} ist offline`
                : (snapshot.isMyTurn ? 'Du bist dran' : `${opponentName} ist dran`);
        }

        this.updateUI();

        if (snapshot.isFinished && window.GameManager) {
            window.GameManager.completeGame(true);
        }
    }

    async submitOnlineTurn() {
        if (!this.onlineService || this.isInputLocked || this.isSubmittingOnlineTurn) return;

        const throws = this.game.currentRoundThrows || [];
        if (throws.length === 0) return;

        try {
            this.isSubmittingOnlineTurn = true;
            this.clearAutoNextState();
            this.captureOnlineProgress();
            await this.onlineService.submitTurn(throws);
            this.modifier = 1;
        } catch (error) {
            console.error(error);
            this.isSubmittingOnlineTurn = false;
        }
    }

    highlightBoard() {
        document.querySelectorAll('.segment-path').forEach(path => {
            path.classList.remove(
                'target-dart-1', 'target-dart-2', 'target-dart-3',
                'toggle-color-1-2', 'toggle-color-2-3', 'toggle-color-1-3', 'toggle-color-1-2-3'
            );
        });

        const targets = this.game.currentTargets || [];
        const targetRings = this.game.currentTargetRings || [];
        const throwsCount = (this.game.currentRoundThrows || []).length;
        const remainingIndices = [0, 1, 2].filter(i => i >= throwsCount);

        remainingIndices.forEach(index => {
            const num = targets[index];
            const ring = targetRings[index];
            const dartPosition = index + 1;

            if (num === undefined) return;

            const segmentGroup = this.appContainer.querySelector(`#segment-${num}`);
            if (!segmentGroup) return;

            const paths = segmentGroup.querySelectorAll('.segment-path');
            paths.forEach(path => {
                const isDouble = path.classList.contains('double-path');
                const isTriple = path.classList.contains('triple-path');
                const isSingle = !isDouble && !isTriple;
                const isCorrectRing = !ring
                    || ring === 'A'
                    || (ring === 'S' && isSingle)
                    || (ring === 'D' && isDouble)
                    || (ring === 'T' && isTriple);

                if (!isCorrectRing) return;

                if (path.classList.contains('target-dart-1') && dartPosition === 2) {
                    path.classList.remove('target-dart-1');
                    path.classList.add('toggle-color-1-2');
                } else if (path.classList.contains('target-dart-1') && dartPosition === 3) {
                    path.classList.remove('target-dart-1');
                    path.classList.add('toggle-color-1-3');
                } else if (path.classList.contains('target-dart-2') && dartPosition === 3) {
                    path.classList.remove('target-dart-2');
                    path.classList.add('toggle-color-2-3');
                } else if (path.classList.contains('toggle-color-1-2') && dartPosition === 3) {
                    path.classList.remove('toggle-color-1-2');
                    path.classList.add('toggle-color-1-2-3');
                } else {
                    path.classList.add(`target-dart-${dartPosition}`);
                }
            });
        });
    }

    updateModifierUI() {
        document.querySelectorAll('.mod-btn').forEach(btn => {
            const btnMult = parseInt(btn.dataset.mult, 10);
            btn.classList.toggle('active', btnMult === this.modifier && this.modifier !== 1);
        });
    }
}
