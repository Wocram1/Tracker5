import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

/**
 * FinishingController
 * Steuert 121, Checkout Challenge etc. im X01-Layout
 */
export class FinishingController {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.modifier = 1;
        this.appContainer = document.getElementById('view-game-x01');
        this.ui = {};
        this.onlineService = null;
        this.isInputLocked = false;
        this.isSubmittingOnlineTurn = false;
        this.lastConfirmedScore = null;
        this.lastConfirmedRound = null;
        this.lastConfirmedTarget = null;
        this.lastConfirmedPoints = null;
        this.lastConfirmedTargetsPlayed = null;
        this.pendingOnlineTurnThrows = null;
        this.pendingSubmittedProgress = null;
        this.autoNextTimeout = null;
    }

    setOnlineMode(service) {
        this.onlineService = service;
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
                progress: this.appContainer.querySelector('#x01-target-progress'),
                progressLabel: this.appContainer.querySelector('#x01-target-progress-container .label'),
                totalPoints: this.appContainer.querySelector('#x01-total-points'),
                malus: this.appContainer.querySelector('#x01-malus-val'),
                minPts: this.appContainer.querySelector('#x01-min-pts-val'),
                livesContainer: this.appContainer.querySelector('#x01-lives-container'),
                modeBadge: this.appContainer.querySelector('#x01-checkout-badge'),
                hint: this.appContainer.querySelector('#x01-checkout-hint'),
                playerName: this.appContainer.querySelector('#x01-player-name'),
                gameName: this.appContainer.querySelector('#x01-game-name'),
                challengeTitle: this.appContainer.querySelector('#x01-challenge-title'),
                challengeHeader: this.appContainer.querySelector('#x01-challenge-header'),
                avgContainer: this.appContainer.querySelector('#x01-avg-container'),
                lastContainer: this.appContainer.querySelector('#x01-last-container'),
                minPtsContainer: this.appContainer.querySelector('#x01-min-pts-container'),
                targetContainer: this.appContainer.querySelector('#x01-target-progress-container'),
                flashOverlay: this.appContainer.querySelector('#board-flash-overlay'),
                throws: [
                    this.appContainer.querySelector('#th-1'),
                    this.appContainer.querySelector('#th-2'),
                    this.appContainer.querySelector('#th-3')
                ]
            };
        }

        if (this.ui.challengeHeader) this.ui.challengeHeader.style.display = 'flex';
        if (this.ui.avgContainer) this.ui.avgContainer.style.display = 'none';
        if (this.ui.lastContainer) this.ui.lastContainer.style.display = 'none';
        if (this.ui.minPtsContainer) this.ui.minPtsContainer.style.display = 'flex';
        if (this.ui.targetContainer) this.ui.targetContainer.style.display = 'flex';
        if (this.ui.progressLabel) this.ui.progressLabel.textContent = 'TARGETS';

        await this.updateHeaderInfo();
        this.updateUI();
    }

    isRoundReadyForAdvance() {
        const throws = this.game.currentRoundThrows || [];
        return throws.length >= 3;
    }

    createLocalProgressSnapshot() {
        return {
            points: this.game.points,
            malusScore: this.game.malusScore,
            round: this.game.round,
            roundDarts: this.game.roundDarts,
            roundsUsedForTarget: this.game.roundsUsedForTarget,
            targetsPlayed: this.game.targetsPlayed,
            currentTarget: this.game.currentTarget,
            currentScore: this.game.currentScore,
            startTarget: this.game.startTarget,
            maxRoundsPerTarget: this.game.maxRoundsPerTarget,
            checkMode: this.game.checkMode,
            activeCheckMode: this.game.activeCheckMode,
            switchTarget: this.game.switchTarget,
            totalTargetsToPlay: this.game.totalTargetsToPlay,
            minPointsRequired: this.game.minPointsRequired,
            minTargetToReach: this.game.minTargetToReach,
            resetToStart: this.game.resetToStart,
            currentRoundThrows: Array.isArray(this.game.currentRoundThrows) ? [...this.game.currentRoundThrows] : [],
            stats: { ...(this.game.stats || {}) },
            isFinished: this.game.isFinished
        };
    }

    getCurrentThrows() {
        return this.game.currentRoundThrows || [];
    }

    getRealThrows(throws = this.getCurrentThrows()) {
        return throws.filter(throwData => !throwData?.isDummy);
    }

    clearAutoNextState() {
        if (this.autoNextTimeout) {
            clearTimeout(this.autoNextTimeout);
            this.autoNextTimeout = null;
        }

        const nextBtn = document.querySelector('.next-btn-side') || document.getElementById('bc-next-btn');
        if (nextBtn) {
            nextBtn.classList.remove('auto-next-anim');
        }
    }

    clearPendingOnlineState() {
        this.pendingOnlineTurnThrows = null;
        this.pendingSubmittedProgress = null;
    }

    getOnlineProgressStorageKey() {
        if (!this.onlineService?.room?.id) return null;
        const userId = this.onlineService.getResolvedCurrentUserId?.() || window.appState?.user?.id || 'anonymous';
        return `ocram-online-progress-121-${this.onlineService.room.id}-${String(userId).toLowerCase()}`;
    }

    readPersistedOnlineProgress() {
        const key = this.getOnlineProgressStorageKey();
        if (!key) return null;
        try {
            const raw = window.sessionStorage?.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('readPersisted121OnlineProgress failed', error);
            return null;
        }
    }

    persistOnlineProgress() {
        if (!this.onlineService) return;
        const key = this.getOnlineProgressStorageKey();
        if (!key) return;
        try {
            const payload = {
                points: this.game.points,
                malusScore: this.game.malusScore,
                round: this.game.round,
                roundDarts: this.game.roundDarts,
                roundsUsedForTarget: this.game.roundsUsedForTarget,
                targetsPlayed: this.game.targetsPlayed,
                currentTarget: this.game.currentTarget,
                currentScore: this.game.currentScore,
                startTarget: this.game.startTarget,
                maxRoundsPerTarget: this.game.maxRoundsPerTarget,
                checkMode: this.game.checkMode,
                activeCheckMode: this.game.activeCheckMode,
                switchTarget: this.game.switchTarget,
                totalTargetsToPlay: this.game.totalTargetsToPlay,
                minPointsRequired: this.game.minPointsRequired,
                minTargetToReach: this.game.minTargetToReach,
                resetToStart: this.game.resetToStart,
                currentRoundThrows: this.game.currentRoundThrows || [],
                stats: this.game.stats || {},
                isFinished: this.game.isFinished,
                lastConfirmedScore: this.lastConfirmedScore,
                lastConfirmedRound: this.lastConfirmedRound,
                lastConfirmedTarget: this.lastConfirmedTarget,
                lastConfirmedPoints: this.lastConfirmedPoints,
                lastConfirmedTargetsPlayed: this.lastConfirmedTargetsPlayed,
                savedAt: Date.now()
            };
            window.sessionStorage?.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.warn('persist121OnlineProgress failed', error);
        }
    }

    hydrateFromPersistedProgress(progress, { includeDraft = false } = {}) {
        if (!progress) return;
        if (progress.stats) this.game.stats = { ...(this.game.stats || {}), ...progress.stats };
        if (typeof progress.points === 'number') this.game.points = progress.points;
        if (typeof progress.malusScore === 'number') this.game.malusScore = progress.malusScore;
        if (typeof progress.roundsUsedForTarget === 'number') this.game.roundsUsedForTarget = progress.roundsUsedForTarget;
        if (typeof progress.targetsPlayed === 'number') this.game.targetsPlayed = progress.targetsPlayed;
        if (typeof progress.currentTarget === 'number') this.game.currentTarget = progress.currentTarget;
        if (typeof progress.startTarget === 'number') this.game.startTarget = progress.startTarget;
        if (typeof progress.maxRoundsPerTarget === 'number') this.game.maxRoundsPerTarget = progress.maxRoundsPerTarget;
        if (typeof progress.switchTarget === 'number') this.game.switchTarget = progress.switchTarget;
        if (typeof progress.totalTargetsToPlay === 'number') this.game.totalTargetsToPlay = progress.totalTargetsToPlay;
        if (typeof progress.minPointsRequired === 'number') this.game.minPointsRequired = progress.minPointsRequired;
        if (typeof progress.minTargetToReach === 'number') this.game.minTargetToReach = progress.minTargetToReach;
        if (typeof progress.resetToStart === 'boolean') this.game.resetToStart = progress.resetToStart;
        if (typeof progress.checkMode === 'string') this.game.checkMode = progress.checkMode;
        if (typeof progress.activeCheckMode === 'string') this.game.activeCheckMode = progress.activeCheckMode;

        if (includeDraft) {
            this.game.round = progress.round ?? this.game.round;
            this.game.roundDarts = progress.roundDarts ?? this.game.roundDarts;
            this.game.currentScore = progress.currentScore ?? this.game.currentScore;
            this.game.currentRoundThrows = Array.isArray(progress.currentRoundThrows) ? progress.currentRoundThrows : [];
            this.game.isFinished = !!progress.isFinished;
        }
    }

    async updateHeaderInfo() {
        try {
            await LevelSystem.getUserStats();
            if (this.ui.playerName) {
                this.ui.playerName.textContent = window.appState?.profile?.username?.toUpperCase() || 'PLAYER 1';
            }
        } catch (error) {
            if (this.ui.playerName) this.ui.playerName.textContent = 'PLAYER 1';
        }

        if (this.ui.gameName) {
            this.ui.gameName.textContent = this.game.displayName || this.game.name || 'Finishing';
        }

        if (this.ui.challengeTitle) {
            this.ui.challengeTitle.textContent = this.game.isTraining ? 'TRAINING MODE' : `LEVEL ${this.game.level || 1}`;
        }
    }

    triggerBoardFlash(val, mult) {
        if (!this.ui.flashOverlay) return;
        const flashClass = val === 0
            ? 'flash-miss'
            : (mult === 3 ? 'flash-triple' : 'flash-active');

        this.ui.flashOverlay.classList.remove('flash-active', 'flash-triple', 'flash-miss');
        void this.ui.flashOverlay.offsetWidth;
        this.ui.flashOverlay.classList.add(flashClass);
        clearTimeout(this.ui.flashOverlay._flashTimer);
        this.ui.flashOverlay._flashTimer = setTimeout(() => {
            this.ui.flashOverlay.classList.remove('flash-active', 'flash-triple', 'flash-miss');
        }, 460);
    }

    getBoardHitPath(val, mult) {
        const segment = this.appContainer?.querySelector(`#segment-${val}`);
        if (!segment) return null;

        if (val === 25) {
            return mult === 2
                ? segment.querySelector('.bull-inner')
                : segment.querySelector('.bull-outer');
        }

        if (mult === 3) return segment.querySelector('.triple-path');
        if (mult === 2) return segment.querySelector('.double-path');
        return segment.querySelector('path.segment-path:not(.double-path):not(.triple-path)');
    }

    animateBoardHit(val, mult) {
        this.triggerBoardFlash(val, mult);
        if (val === 0) return;

        const segmentGroup = this.appContainer?.querySelector(`#segment-${val}`);
        const path = this.getBoardHitPath(val, mult);
        if (!path || !segmentGroup) return;

        const variantClass = val === 25
            ? 'segment-hit-bull'
            : (mult === 3 ? 'segment-hit-triple' : (mult === 2 ? 'segment-hit-double' : 'segment-hit-single'));

        segmentGroup.classList.remove('segment-hit-group');
        void segmentGroup.offsetWidth;
        segmentGroup.classList.add('segment-hit-group');

        path.classList.remove('segment-hit-pulse', 'segment-hit-single', 'segment-hit-double', 'segment-hit-triple', 'segment-hit-bull');
        void path.offsetWidth;
        path.classList.add('segment-hit-pulse', variantClass);

        clearTimeout(segmentGroup._groupHitTimer);
        segmentGroup._groupHitTimer = setTimeout(() => {
            segmentGroup.classList.remove('segment-hit-group');
        }, 320);

        clearTimeout(path._hitTimer);
        path._hitTimer = setTimeout(() => {
            path.classList.remove('segment-hit-pulse', variantClass);
        }, 620);
    }

    animateThrowPill(index, throwData) {
        const box = this.ui.throws?.[index];
        if (!box) return;

        const isMiss = !throwData || throwData.isBust || throwData.base === 0;
        box.classList.remove('throw-hit-pop', 'throw-hit-miss');
        void box.offsetWidth;
        box.classList.add('throw-hit-pop');
        if (isMiss) box.classList.add('throw-hit-miss');

        clearTimeout(box._pillTimer);
        box._pillTimer = setTimeout(() => {
            box.classList.remove('throw-hit-pop', 'throw-hit-miss');
        }, 560);
    }

    handleInput(val, mult) {
        if (this.isInputLocked || this.isSubmittingOnlineTurn) return;

        const parsedVal = parseInt(val, 10);
        const throws = this.getCurrentThrows();
        if (this.getRealThrows(throws).length >= 3) return;
        const preThrows = Array.isArray(throws) ? [...throws] : [];
        const preRound = this.game.round;
        const preTargetsPlayed = this.game.targetsPlayed;
        const preCurrentTarget = this.game.currentTarget;

        const finalMult = this.modifier !== 1 ? this.modifier : mult;
        this.game.registerHit(parsedVal, finalMult);
        const latestThrow = Array.isArray(this.game.currentRoundThrows)
            ? this.game.currentRoundThrows[this.game.currentRoundThrows.length - 1]
            : null;
        const latestThrowIndex = Math.max(0, this.game.currentRoundThrows.length - 1);
        this.animateBoardHit(parsedVal, finalMult);

        window.SoundManager?.play(parsedVal === 0 ? 'miss' : 'hit');

        this.modifier = 1;
        this.updateUI();
        this.animateThrowPill(latestThrowIndex, latestThrow);
        this.persistOnlineProgress();

        const roundAdvanced = this.game.round !== preRound
            || this.game.targetsPlayed !== preTargetsPlayed
            || this.game.currentTarget !== preCurrentTarget
            || this.game.isFinished;
        if (this.onlineService && roundAdvanced) {
            this.pendingOnlineTurnThrows = [...preThrows, {
                base: parsedVal,
                mult: finalMult
            }].filter(throwData => !throwData?.isDummy);
            this.pendingSubmittedProgress = this.createLocalProgressSnapshot();
        }

        const shouldAutoAdvanceOnline = !!this.onlineService && (this.isRoundReadyForAdvance() || this.pendingOnlineTurnThrows?.length);
        const shouldAutoAdvanceOffline = !this.onlineService && this.isRoundReadyForAdvance() && !this.game.isFinished;

        if (shouldAutoAdvanceOnline || shouldAutoAdvanceOffline) {
            const nextBtn = document.querySelector('.next-btn-side');
            if (nextBtn) {
                nextBtn.classList.remove('auto-next-anim');
                void nextBtn.offsetWidth;
                nextBtn.classList.add('auto-next-anim');
            }

            this.clearAutoNextState();
            if (nextBtn) {
                nextBtn.classList.add('auto-next-anim');
            }
            if (this.onlineService) {
                this.submitOnlineTurn();
                this.autoNextTimeout = setTimeout(() => {
                    if (nextBtn) nextBtn.classList.remove('auto-next-anim');
                    this.autoNextTimeout = null;
                }, 150);
                return;
            }
            this.autoNextTimeout = setTimeout(() => {
                if (nextBtn) nextBtn.classList.remove('auto-next-anim');
                if (this.isRoundReadyForAdvance()) {
                    window.GameManager.nextRoundX01();
                }
                this.autoNextTimeout = null;
            }, 1100);
        }
    }

    setModifier(m) {
        if (this.isInputLocked || this.isSubmittingOnlineTurn) return;
        this.modifier = this.modifier === m ? 1 : m;
        this.updateModifierUI();
    }

    nextRound() {
        if (this.game.nextRound) {
            this.game.nextRound();
        }
        this.modifier = 1;
        this.updateUI();
    }

    undo() {
        if (this.isInputLocked || this.isSubmittingOnlineTurn) return;

        this.clearAutoNextState();
        this.clearPendingOnlineState();

        if (this.game.undo) {
            this.game.undo();
        }
        this.modifier = 1;
        this.updateUI();
        this.persistOnlineProgress();
    }

    updateUI() {
        if (!this.game) return;

        if (this.ui.score) this.ui.score.textContent = this.game.currentScore;

        if (this.ui.round) {
            if (this.game.currentRoundDisplay) {
                this.ui.round.textContent = this.game.currentRoundDisplay;
            } else {
                const currentRound = (this.game.roundsUsedForTarget || 0) + 1;
                const maxRounds = this.game.maxRoundsPerTarget || 3;
                this.ui.round.textContent = `${currentRound}/${maxRounds}`;
            }
        }

        if (this.ui.progress) {
            const total = this.game.totalTargetsToPlay || 0;
            const current = total > 0
                ? (this.game.isFinished ? total : Math.min(total, (this.game.targetsPlayed || 0) + 1))
                : 0;
            this.ui.progress.textContent = `${current}/${total}`;
        }

        if (this.ui.totalPoints) this.ui.totalPoints.textContent = this.game.points || 0;
        if (this.ui.malus) this.ui.malus.textContent = this.game.malusScore || this.game.malusTotal || 0;
        if (this.ui.minPts) this.ui.minPts.textContent = this.game.minPointsRequired || 0;

        if (this.ui.modeBadge) {
            const activeMode = typeof this.game.getCurrentCheckMode === 'function'
                ? this.game.getCurrentCheckMode()
                : (this.game.activeCheckMode || this.game.checkMode || 'single');
            this.ui.modeBadge.textContent = activeMode === 'double' ? 'D/O' : 'S/O';
            this.ui.modeBadge.className = `mode-badge-compact ${activeMode === 'double' ? 'mode-double' : 'mode-single'}`;
        }

        this.renderThrowBoxes();
        this.updateStatsBar();
        if (this.ui.hint) this.ui.hint.textContent = this.game.checkoutPath || '';
        this.updateModifierUI();

        if (!this.onlineService && this.game.isFinished && window.GameManager?.completeGame) {
            window.GameManager.completeGame();
        }
    }

    renderThrowBoxes() {
        const throws = this.getCurrentThrows();
        this.ui.throws.forEach((box, index) => {
            if (!box) return;

            const i = index + 1;
            box.className = 'throw-box';
            const t = throws[index];

            if (t) {
                if (t.isDummy) {
                    box.textContent = '-';
                } else {
                    const prefix = t.mult === 3 ? 'T' : (t.mult === 2 ? 'D' : '');
                    box.textContent = t.isBust ? 'BUST' : `${prefix}${t.base}`;
                    if (t.isBust) box.classList.add('missed');
                    box.classList.add(`active-dart-${i}`);
                }
            } else {
                box.textContent = '-';
                const currentRealDarts = this.getRealThrows(throws).length;
                if (i === currentRealDarts + 1) box.classList.add('next-up');
            }
        });
    }

    updateStatsBar() {
        if (this.ui.livesContainer && this.game.lives !== undefined) {
            this.ui.livesContainer.classList.remove('hidden');
            const icons = this.ui.livesContainer.querySelectorAll('i');
            if (icons.length === 0) {
                this.ui.livesContainer.innerHTML = this.generateIcons(this.game.lives, 'icon-heart', 'ri-heart-fill');
            } else {
                icons.forEach((icon, i) => {
                    const isActive = i < this.game.lives;
                    icon.className = `ri-heart-fill ${isActive ? 'icon-heart' : 'icon-empty'}`;
                });
            }
        }
    }

    generateIcons(count, activeClass, iconClass) {
        const max = this.game.maxLives || 3;
        let html = '';
        for (let i = 0; i < max; i++) {
            const isActive = i < count;
            html += `<i class="${iconClass} ${isActive ? activeClass : 'icon-empty'}"></i>`;
        }
        return html;
    }

    updateModifierUI() {
        document.querySelectorAll('.modifier-btn, .mod-btn').forEach(btn => {
            const btnMult = parseInt(btn.dataset.mult, 10);
            btn.classList.toggle('active', btnMult === this.modifier && this.modifier !== 1);
        });
    }

    applyOnlineSnapshot(snapshot) {
        if (!snapshot?.currentPlayerState) return;

        const playerState = snapshot.currentPlayerState;
        const opponentState = snapshot.opponentState || {};
        const persistedProgress = this.readPersistedOnlineProgress();
        const prevConfirmedRound = this.lastConfirmedRound;
        const prevConfirmedScore = this.lastConfirmedScore;
        const prevConfirmedTarget = this.lastConfirmedTarget;
        const prevConfirmedPoints = this.lastConfirmedPoints;
        const prevConfirmedTargetsPlayed = this.lastConfirmedTargetsPlayed;
        const hasLocalDraft = (this.game.currentRoundThrows || []).some(throwData => !throwData.isDummy);
        const serverHasDraft = Array.isArray(playerState.currentRoundThrows) && playerState.currentRoundThrows.length > 0;
        const isStaleServerStateDuringSubmit = this.isSubmittingOnlineTurn
            && snapshot.isMyTurn
            && !snapshot.isFinished
            && !serverHasDraft
            && prevConfirmedRound === playerState.round
            && prevConfirmedScore === playerState.currentScore
            && prevConfirmedTarget === playerState.currentTarget
            && prevConfirmedPoints === playerState.points
            && prevConfirmedTargetsPlayed === playerState.targetsPlayed;
        const shouldPreserveLocalDraft = snapshot.isMyTurn
            && hasLocalDraft
            && !serverHasDraft
            && !snapshot.isFinished
            && (!this.isSubmittingOnlineTurn || isStaleServerStateDuringSubmit);
        const localDraftProgress = shouldPreserveLocalDraft ? this.createLocalProgressSnapshot() : null;
        const shouldPreservePendingTurn = !!this.pendingOnlineTurnThrows
            && snapshot.isMyTurn
            && !snapshot.isFinished
            && !serverHasDraft
            && !!this.pendingSubmittedProgress;
        const shouldPreserveSubmittedProgress = this.isSubmittingOnlineTurn
            && isStaleServerStateDuringSubmit
            && !snapshot.isFinished
            && !!this.pendingSubmittedProgress;
        const canRestorePersistedDraft = snapshot.isMyTurn
            && !hasLocalDraft
            && !serverHasDraft
            && !snapshot.isFinished
            && !this.isSubmittingOnlineTurn
            && Array.isArray(persistedProgress?.currentRoundThrows)
            && persistedProgress.currentRoundThrows.length > 0
            && persistedProgress.lastConfirmedRound === playerState.round
            && persistedProgress.lastConfirmedScore === playerState.currentScore
            && persistedProgress.lastConfirmedTarget === playerState.currentTarget
            && persistedProgress.lastConfirmedPoints === playerState.points
            && persistedProgress.lastConfirmedTargetsPlayed === playerState.targetsPlayed;

        if (persistedProgress) {
            this.hydrateFromPersistedProgress(persistedProgress, { includeDraft: false });
        }

        this.lastConfirmedScore = playerState.currentScore ?? this.lastConfirmedScore;
        this.lastConfirmedRound = playerState.round ?? this.lastConfirmedRound;
        this.lastConfirmedTarget = playerState.currentTarget ?? this.lastConfirmedTarget;
        this.lastConfirmedPoints = playerState.points ?? this.lastConfirmedPoints;
        this.lastConfirmedTargetsPlayed = playerState.targetsPlayed ?? this.lastConfirmedTargetsPlayed;

        this.game.points = playerState.points ?? this.game.points;
        this.game.malusScore = playerState.malusScore ?? this.game.malusScore;
        this.game.roundsUsedForTarget = playerState.roundsUsedForTarget ?? this.game.roundsUsedForTarget;
        this.game.targetsPlayed = playerState.targetsPlayed ?? this.game.targetsPlayed;
        this.game.currentTarget = playerState.currentTarget ?? this.game.currentTarget;
        this.game.startTarget = playerState.startTarget ?? this.game.startTarget;
        this.game.maxRoundsPerTarget = playerState.maxRoundsPerTarget ?? this.game.maxRoundsPerTarget;
        this.game.checkMode = playerState.checkMode ?? this.game.checkMode;
        this.game.activeCheckMode = playerState.activeCheckMode ?? this.game.activeCheckMode;
        this.game.switchTarget = playerState.switchTarget ?? this.game.switchTarget;
        this.game.totalTargetsToPlay = playerState.totalTargetsToPlay ?? this.game.totalTargetsToPlay;
        this.game.minPointsRequired = playerState.minPointsRequired ?? this.game.minPointsRequired;
        this.game.minTargetToReach = playerState.minTargetToReach ?? this.game.minTargetToReach;
        this.game.resetToStart = playerState.resetToStart ?? this.game.resetToStart;
        this.game.isFinished = !!playerState.isFinished;
        this.game.stats = { ...(this.game.stats || {}), ...(playerState.stats || {}) };

        if (canRestorePersistedDraft) {
            this.hydrateFromPersistedProgress(persistedProgress, { includeDraft: true });
        } else if (shouldPreservePendingTurn) {
            this.hydrateFromPersistedProgress(this.pendingSubmittedProgress, { includeDraft: true });
        } else if (shouldPreserveSubmittedProgress) {
            this.hydrateFromPersistedProgress(this.pendingSubmittedProgress, { includeDraft: true });
        } else if (shouldPreserveLocalDraft) {
            this.hydrateFromPersistedProgress(localDraftProgress || persistedProgress, { includeDraft: true });
        } else if (!shouldPreserveLocalDraft) {
            this.game.round = playerState.round ?? this.game.round;
            this.game.roundDarts = playerState.roundDarts ?? this.game.roundDarts;
            this.game.currentScore = playerState.currentScore ?? this.game.currentScore;
            this.game.currentRoundThrows = Array.isArray(playerState.currentRoundThrows)
                ? playerState.currentRoundThrows.map(t => ({
                    base: t.base ?? t.val ?? 0,
                    mult: t.mult ?? 1,
                    isBust: !!t.isBust,
                    isDummy: !!t.isDummy,
                    scoreBefore: t.scoreBefore ?? this.game.currentScore
                }))
                : [];
        }

        if (typeof this.game.getCurrentCheckMode !== 'function') {
            this.game.getCurrentCheckMode = () => this.game.activeCheckMode || this.game.checkMode || 'single';
        }

        this.isInputLocked = !snapshot.isMyTurn || snapshot.isFinished;
        if (!snapshot.isMyTurn && !snapshot.isFinished) {
            this.clearAutoNextState();
            this.game.currentRoundThrows = [];
            this.game.roundDarts = 0;
        }
        if (snapshot.isFinished || !snapshot.isMyTurn || (!isStaleServerStateDuringSubmit && !shouldPreservePendingTurn)) {
            this.isSubmittingOnlineTurn = false;
            this.clearPendingOnlineState();
        }

        if (this.ui.playerName) {
            this.ui.playerName.textContent = snapshot.currentPlayer?.username || snapshot.currentPlayer?.name || window.appState?.profile?.username || 'You';
        }

        if (this.ui.gameName) {
            this.ui.gameName.textContent = snapshot.room?.room_code ? `ONLINE 121 - ${snapshot.room.room_code}` : 'ONLINE 121';
        }

        if (this.ui.challengeTitle) {
            const opponentName = snapshot.opponent?.username || snapshot.opponent?.name || 'Gegner';
            const turnText = snapshot.opponentConnected === false
                ? `${opponentName} ist offline`
                : (snapshot.isMyTurn ? 'Du bist dran' : `${opponentName} ist dran`);
            const oppPoints = opponentState.points ?? 0;
            this.ui.challengeTitle.textContent = `${turnText} | Opp ${oppPoints}`;
        }

        this.updateUI();
        this.persistOnlineProgress();

        if (snapshot.isFinished && window.GameManager) {
            window.GameManager.completeGame(true);
        }
    }

    async submitOnlineTurn() {
        if (!this.onlineService || this.isInputLocked || this.isSubmittingOnlineTurn) return;
        const throws = this.pendingOnlineTurnThrows || this.getCurrentThrows();
        const realThrows = this.getRealThrows(throws);
        if (realThrows.length === 0) return;

        try {
            this.isSubmittingOnlineTurn = true;
            this.clearAutoNextState();
            if (!this.pendingSubmittedProgress) {
                this.pendingSubmittedProgress = this.createLocalProgressSnapshot();
            }
            await this.onlineService.submitTurn(realThrows);
            this.modifier = 1;
        } catch (error) {
            console.error(error);
            this.clearPendingOnlineState();
        } finally {
            this.isSubmittingOnlineTurn = false;
        }
    }
}
