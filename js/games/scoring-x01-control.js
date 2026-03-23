import { htmlX01 } from '../views/view-x01.js';
import { LevelSystem } from '../supabase_client.js';

export class ScoringX01Control {
    constructor(gameInstance) {
        this.game = gameInstance; 
        this.appContainer = document.getElementById('view-game-x01');
        this.modifier = 1;
        this.ui = {};
        this.onlineService = null;
        this.isInputLocked = false;
        this.isSubmittingOnlineTurn = false;
        this.onlineStatusMessage = '';
        this.onlineStatusType = '';
        this.onlineStatusTimeout = null;
        this.lastConfirmedScore = null;
        this.lastConfirmedRound = null;
    }

    setOnlineMode(service) {
        this.onlineService = service;
    }

    async init() {
        document.body.classList.add('game-active');
        if (this.appContainer) {
            this.appContainer.innerHTML = htmlX01;
            this.appContainer.classList.remove('hidden');
            
            // UI Referenzen cachen
            this.ui = {
                score: this.appContainer.querySelector('#x01-score'),
                playerName: this.appContainer.querySelector('#x01-player-name'),
                gameName: this.appContainer.querySelector('#x01-game-name'),
                challengeTitle: this.appContainer.querySelector('#x01-challenge-title'),
                onlineStatus: this.appContainer.querySelector('#x01-online-status'),
                round: this.appContainer.querySelector('#x01-round'),

                checkoutBadge: this.appContainer.querySelector('#x01-checkout-badge'),
                // Scoring Elemente (X01)
                avgContainer: this.appContainer.querySelector('#x01-avg-container'),
                avgVal: this.appContainer.querySelector('#x01-avg-val'),
                lastContainer: this.appContainer.querySelector('#x01-last-container'),
                lastVal: this.appContainer.querySelector('#x01-last-val'),
                
                // Challenge Elemente (Warmup / Finishing)
                challengeHeader: this.appContainer.querySelector('#x01-challenge-header'),
                malusVal: this.appContainer.querySelector('#x01-malus-val'),
                pointsVal: this.appContainer.querySelector('#x01-total-points'),
                progressContainer: this.appContainer.querySelector('#x01-progress-container'),
                progressVal: this.appContainer.querySelector('#x01-target-progress'),
                minPtsContainer: this.appContainer.querySelector('#x01-min-pts-container'),
                minPtsVal: this.appContainer.querySelector('#x01-min-pts-val'),
                livesContainer: this.appContainer.querySelector('#x01-lives-container'),
                
                throws: [
                    this.appContainer.querySelector('#th-1'),
                    this.appContainer.querySelector('#th-2'),
                    this.appContainer.querySelector('#th-3')
                ]
            };

            this.configureLayout();
        }
        await this.updateHeaderInfo();
        this.updateUI();
        this.updateOnlineInteractionState();
    }

    getOnlineProgressStorageKey() {
        if (!this.onlineService?.room?.id) return null;
        const userId = this.onlineService.getResolvedCurrentUserId?.() || window.appState?.user?.id || 'anonymous';
        return `ocram-online-progress-${this.onlineService.room.id}-${String(userId).toLowerCase()}`;
    }

    readPersistedOnlineProgress() {
        const key = this.getOnlineProgressStorageKey();
        if (!key) return null;
        try {
            const raw = window.sessionStorage?.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('readPersistedOnlineProgress failed', error);
            return null;
        }
    }

    persistOnlineProgress() {
        if (!this.onlineService) return;
        const key = this.getOnlineProgressStorageKey();
        if (!key) return;
        try {
            const payload = {
                currentScore: this.game.currentScore,
                round: this.game.round,
                lastScore: this.game.lastScore,
                totalDarts: this.game.totalDarts,
                dartsThrown: this.game.dartsThrown,
                currentRoundThrows: this.game.currentRoundThrows || [],
                stats: this.game.stats || {},
                hasStartedScoring: this.game.hasStartedScoring,
                isFinished: this.game.isFinished,
                isDoubleOut: this.game.isDoubleOut,
                isDoubleIn: this.game.isDoubleIn,
                startScore: this.game.startScore,
                lastConfirmedScore: this.lastConfirmedScore,
                lastConfirmedRound: this.lastConfirmedRound,
                savedAt: Date.now()
            };
            window.sessionStorage?.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.warn('persistOnlineProgress failed', error);
        }
    }

    clearPersistedOnlineProgress() {
        const key = this.getOnlineProgressStorageKey();
        if (!key) return;
        try {
            window.sessionStorage?.removeItem(key);
        } catch (error) {
            console.warn('clearPersistedOnlineProgress failed', error);
        }
    }

    hydrateFromPersistedProgress(progress, { includeDraft = false } = {}) {
        if (!progress) return;
        if (progress.stats) this.game.stats = { ...this.game.stats, ...progress.stats };
        if (typeof progress.totalDarts === 'number') this.game.totalDarts = progress.totalDarts;
        if (typeof progress.lastScore === 'number') this.game.lastScore = progress.lastScore;
        if (includeDraft) {
            this.game.currentScore = progress.currentScore ?? this.game.currentScore;
            this.game.round = progress.round ?? this.game.round;
            this.game.currentRoundThrows = Array.isArray(progress.currentRoundThrows) ? progress.currentRoundThrows : [];
            this.game.dartsThrown = progress.dartsThrown ?? this.game.currentRoundThrows.length;
        }
    }

    setOnlineStatus(message = '', type = '', timeoutMs = 0) {
        this.onlineStatusMessage = message;
        this.onlineStatusType = type;
        if (this.onlineStatusTimeout) {
            window.clearTimeout(this.onlineStatusTimeout);
            this.onlineStatusTimeout = null;
        }
        if (timeoutMs > 0) {
            this.onlineStatusTimeout = window.setTimeout(() => {
                this.onlineStatusMessage = '';
                this.onlineStatusType = '';
                this.renderOnlineStatus();
            }, timeoutMs);
        }
        this.renderOnlineStatus();
    }

    renderOnlineStatus() {
        if (!this.ui.onlineStatus) return;
        const message = this.onlineStatusMessage || '';
        this.ui.onlineStatus.textContent = message;
        this.ui.onlineStatus.classList.toggle('hidden', !message);
        this.ui.onlineStatus.classList.toggle('is-error', this.onlineStatusType === 'error');
        this.ui.onlineStatus.classList.toggle('is-success', this.onlineStatusType === 'success');
    }

    updateOnlineInteractionState() {
        const targets = [
            ...Array.from(document.querySelectorAll('.num-btn')),
            ...Array.from(document.querySelectorAll('.mod-btn')),
            document.getElementById('x01-next-btn'),
            document.querySelector('.undo-btn')
        ].filter(Boolean);

        const shouldDisable = this.isInputLocked || this.isSubmittingOnlineTurn;
        targets.forEach(el => {
            el.classList.toggle('disabled', shouldDisable);
            if ('disabled' in el) el.disabled = shouldDisable;
        });

        const nextBtn = document.getElementById('x01-next-btn');
        if (nextBtn) {
            nextBtn.classList.toggle('loading', this.isSubmittingOnlineTurn);
            nextBtn.innerHTML = this.isSubmittingOnlineTurn
                ? '<i class="ri-loader-4-line ri-spin"></i>'
                : '<i class="ri-arrow-right-line"></i>';
        }
    }

    /**
     * Entscheidet basierend auf dem Spielnamen, welches Layout gezeigt wird.
     * Nur "X01" bekommt das Clean Layout. Alle anderen (Warmup, Finishing, etc.)
     * bekommen das Challenge Layout.
     */
    configureLayout() {
        if (this.onlineService) {
            if(this.ui.avgContainer) this.ui.avgContainer.style.display = 'flex';
            if(this.ui.lastContainer) this.ui.lastContainer.style.display = 'flex';
            if(this.ui.challengeHeader) this.ui.challengeHeader.style.display = 'none';
            if(this.ui.progressContainer) this.ui.progressContainer.style.display = 'none';
            if(this.ui.minPtsContainer) this.ui.minPtsContainer.style.display = 'none';
            if(this.ui.livesContainer) this.ui.livesContainer.classList.add('hidden');
            return;
        }
        // Prüft strikt, ob es das Standard X01 Spiel ist
        const isStandardX01 = this.game.name === 'X01';

        if (isStandardX01) {
            // SCORING LAYOUT: Zeige AVG & LAST, verstecke den Rest
            if(this.ui.avgContainer) this.ui.avgContainer.style.display = 'flex';
            if(this.ui.lastContainer) this.ui.lastContainer.style.display = 'flex';
            
            if(this.ui.challengeHeader) this.ui.challengeHeader.style.display = 'none';
            if(this.ui.progressContainer) this.ui.progressContainer.style.display = 'none';
            if(this.ui.minPtsContainer) this.ui.minPtsContainer.style.display = 'none';
            if(this.ui.livesContainer) this.ui.livesContainer.classList.add('hidden');
        } else {
            // CHALLENGE LAYOUT: Verstecke AVG & LAST, zeige den Rest
            if(this.ui.avgContainer) this.ui.avgContainer.style.display = 'none';
            if(this.ui.lastContainer) this.ui.lastContainer.style.display = 'none';
            
            if(this.ui.challengeHeader) this.ui.challengeHeader.style.display = 'flex';
            if(this.ui.progressContainer) this.ui.progressContainer.style.display = 'flex';
            if(this.ui.minPtsContainer) this.ui.minPtsContainer.style.display = 'flex';
            
            // Leben Container nur zeigen, wenn das Spiel Leben hat
            if (this.game.lives !== undefined && this.ui.livesContainer) {
                this.ui.livesContainer.classList.remove('hidden');
            }
        }
    }

    updateUI() {
        if (!this.ui.score) return;
        this.ui.score.textContent = this.game.currentScore;

        const isStandardX01 = this.game.name === 'X01';

        if (isStandardX01) {
         // --- UPDATE FÜR X01 & COUNTUP ---
       this.ui.round.textContent = `R${this.game.round}/${this.game.maxRounds}`;
        const avg = this.game.totalDarts > 0 ? ((this.game.stats.totalPoints / this.game.totalDarts) * 3).toFixed(1) : "0.0";
        if(this.ui.avgVal) this.ui.avgVal.textContent = avg;
        if(this.ui.lastVal) this.ui.lastVal.textContent = this.game.lastScore || 0;

        // NEU: Hier wird das Badge befüllt
        if(this.ui.checkoutBadge) {
            // Wenn das Spiel checkoutText hat (CountUp), nimm den, sonst Standard (S/O oder D/O)
            this.ui.checkoutBadge.textContent = this.game.checkoutText || (this.game.isDoubleOut ? 'D/O' : 'S/O');
        }
        } else {
            // --- UPDATE FÜR WARMUP / FINISHING ---
            this.ui.round.textContent = this.game.currentRoundDisplay || `R${this.game.round}`;
            
            if(this.ui.malusVal) this.ui.malusVal.textContent = this.game.malus || 0;
            if(this.ui.pointsVal) this.ui.pointsVal.textContent = this.game.totalPoints || 0;
            if(this.ui.minPtsVal) this.ui.minPtsVal.textContent = this.game.minPointsRequired || 0;
            
            // Progress (z.B. 1/3 Versuche)
            if(this.ui.progressVal) {
                const currentTry = (this.game.roundsUsedForCurrentTarget || this.game.roundsUsedForTarget || 0) + 1;
                const maxTries = this.game.maxRoundsPerTarget || 3;
                this.ui.progressVal.textContent = `${currentTry}/${maxTries}`;
            }
            
            if (document.getElementById('lives-val')) {
                document.getElementById('lives-val').textContent = this.game.lives || 0;
            }
        }

        // Throws & Modifier (Immer gleich)
        const throws = this.game.currentRoundThrows || [];
        this.ui.throws.forEach((box, index) => {
            if (box) {
                const t = throws[index];
                box.textContent = t ? (t.isBust ? "BST" : `${t.mult > 1 ? (t.mult === 3 ? 'T' : 'D') : ''}${t.base}`) : "-";
            }
        });
        this.updateModifierUI();
        if (!this.onlineService && this.game.isFinished && window.GameManager) window.GameManager.completeGame();
    }

    // Standard Methoden bleiben unverändert
  handleInput(val, mult) {
        if (this.isInputLocked) return;
        if (this.isSubmittingOnlineTurn) return;
        if (this.game.isFinished || this.game.dartsThrown >= 3) return;
        const finalMult = this.modifier !== 1 ? this.modifier : mult;
        
        this.game.registerHit(parseInt(val), finalMult);
        
        // SOUND: Miss (0) oder Hit (>0)
        window.SoundManager?.play(parseInt(val) === 0 ? 'miss' : 'hit');
        
        this.modifier = 1; 
        this.updateUI();
        this.persistOnlineProgress();
const currentDarts = this.game.dartsThrown;
      if (currentDarts === 3 && !this.game.isFinished) {
            const nextBtn = document.getElementById('x01-next-btn') || document.querySelector('.next-btn-side');
            if (nextBtn) {
                nextBtn.classList.remove('auto-next-anim');
                void nextBtn.offsetWidth; // Repaint
                nextBtn.classList.add('auto-next-anim');
            }

            clearTimeout(this.autoNextTimeout);
            this.autoNextTimeout = setTimeout(() => {
                if (nextBtn) nextBtn.classList.remove('auto-next-anim');
                if (currentDarts === 3) { // Bedingung passend zur Datei
                    window.GameManager.nextRoundX01();
                }
            }, 1100); // Auf 1100ms erhöht
        }
    }
    setModifier(m) { if (this.isInputLocked || this.isSubmittingOnlineTurn) return; this.modifier = (this.modifier === m) ? 1 : m; this.updateModifierUI(); }
    nextRound() { if (this.game.nextRound) { this.game.nextRound(); this.updateUI(); } }
    undo() { 
        if (this.isInputLocked || this.isSubmittingOnlineTurn) return;
        clearTimeout(this.autoNextTimeout);
        const nextBtn = document.getElementById('x01-next-btn') || document.querySelector('.next-btn-side');
        if (nextBtn) nextBtn.classList.remove('auto-next-anim');

        const btn = document.querySelector('.undo-btn'); 
        if (btn) { btn.classList.add('ani-undo'); setTimeout(() => btn.classList.remove('ani-undo'), 400); }
        if (this.game && typeof this.game.undo === 'function') { this.game.undo(); this.updateUI(); this.persistOnlineProgress(); }
    }
    updateModifierUI() { document.querySelectorAll('.mod-btn').forEach(btn => { const m = parseInt(btn.dataset.mult); btn.classList.toggle('active', m === this.modifier && this.modifier !== 1); }); }
    async updateHeaderInfo() {
        try { await LevelSystem.getUserStats(); if(this.ui.playerName) this.ui.playerName.textContent = window.appState?.profile?.username || "Player 1"; } catch (e) { if(this.ui.playerName) this.ui.playerName.textContent = "Player 1"; }
        if(this.ui.gameName) this.ui.gameName.textContent = this.game.displayName || this.game.name || 'Game';
        if(this.ui.challengeTitle) this.ui.challengeTitle.textContent = this.game.isTraining ? "Training Mode" : `Level ${this.game.level || 1}`;
    }

    applyOnlineSnapshot(snapshot) {
        if (!snapshot?.currentPlayerState) return;

        const playerState = snapshot.currentPlayerState;
        const opponentState = snapshot.opponentState || {};
        const settings = snapshot.state?.settings || {};
        const persistedProgress = this.readPersistedOnlineProgress();
        const hasLocalDraft = (this.game.currentRoundThrows || []).length > 0;
        const serverHasDraft = Array.isArray(playerState.currentThrows) && playerState.currentThrows.length > 0;
        const shouldPreserveLocalDraft = snapshot.isMyTurn && hasLocalDraft && !serverHasDraft && !snapshot.isFinished;
        const canRestorePersistedDraft = snapshot.isMyTurn
            && !hasLocalDraft
            && !serverHasDraft
            && !snapshot.isFinished
            && Array.isArray(persistedProgress?.currentRoundThrows)
            && persistedProgress.currentRoundThrows.length > 0
            && persistedProgress.lastConfirmedScore === playerState.score
            && persistedProgress.lastConfirmedRound === playerState.round;

        if (persistedProgress) {
            this.hydrateFromPersistedProgress(persistedProgress, { includeDraft: false });
        }

        this.game.startScore = settings.startScore || this.game.startScore;
        this.game.isDoubleOut = !!settings.doubleOut;
        this.game.isDoubleIn = !!settings.doubleIn;
        this.game.hasStartedScoring = playerState.hasStartedScoring ?? true;
        this.game.isFinished = !!playerState.finished;
        this.lastConfirmedScore = playerState.score ?? this.lastConfirmedScore;
        this.lastConfirmedRound = playerState.round ?? this.lastConfirmedRound;

        if (canRestorePersistedDraft) {
            this.hydrateFromPersistedProgress(persistedProgress, { includeDraft: true });
        } else if (!shouldPreserveLocalDraft) {
            this.game.currentScore = playerState.score ?? this.game.currentScore;
            this.game.round = playerState.round ?? this.game.round;
            this.game.lastScore = playerState.lastScore ?? 0;
            this.game.currentRoundThrows = Array.isArray(playerState.currentThrows)
                ? playerState.currentThrows.map(t => ({
                    base: t.base ?? t.val ?? 0,
                    mult: t.mult ?? 1,
                    points: t.points ?? ((t.base ?? t.val ?? 0) * (t.mult ?? 1)),
                    scoreBefore: t.scoreBefore ?? this.game.currentScore
                }))
                : [];
            this.game.dartsThrown = this.game.currentRoundThrows.length;
        }

        this.isInputLocked = !snapshot.isMyTurn || snapshot.isFinished;
        if (!snapshot.isMyTurn && !snapshot.isFinished) {
            this.game.currentRoundThrows = [];
            this.game.dartsThrown = 0;
        }
        if (snapshot.isFinished) {
            this.isSubmittingOnlineTurn = false;
        }

        if (this.ui.playerName) {
            this.ui.playerName.textContent = snapshot.currentPlayer?.username || snapshot.currentPlayer?.name || window.appState?.profile?.username || 'You';
        }

        if (this.ui.gameName) {
            this.ui.gameName.textContent = snapshot.room?.room_code ? `ONLINE X01 • ${snapshot.room.room_code}` : 'ONLINE X01';
        }

        if (this.ui.challengeTitle) {
            const opponentName = snapshot.opponent?.username || snapshot.opponent?.name || 'Gegner';
            const turnText = snapshot.opponentConnected === false
                ? `${opponentName} ist offline`
                : (snapshot.isMyTurn ? 'Du bist dran' : `${opponentName} ist dran`);
            const oppScore = opponentState?.score ?? '--';
            this.ui.challengeTitle.textContent = `${turnText} • Opp ${oppScore}`;
        }

        if (this.ui.checkoutBadge) {
            this.ui.checkoutBadge.textContent = this.game.isDoubleOut ? 'D/O' : 'S/O';
            this.ui.checkoutBadge.classList.toggle('mode-double', this.game.isDoubleOut);
            this.ui.checkoutBadge.classList.toggle('mode-single', !this.game.isDoubleOut);
        }

        this.updateUI();
        this.updateOnlineInteractionState();

        if (snapshot.isFinished) {
            this.persistOnlineProgress();
        } else if (!snapshot.isMyTurn) {
            this.persistOnlineProgress();
        } else if (canRestorePersistedDraft || shouldPreserveLocalDraft) {
            this.persistOnlineProgress();
        } else {
            this.persistOnlineProgress();
        }

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
            this.setOnlineStatus('Turn wird synchronisiert ...', '', 0);
            this.updateOnlineInteractionState();
            await this.onlineService.submitTurn(throws);
            this.modifier = 1;
            this.setOnlineStatus('Turn gesendet', 'success', 1200);
        } catch (error) {
            console.error(error);
            this.setOnlineStatus(error.message || 'Turn konnte nicht gesendet werden.', 'error', 3500);
        } finally {
            this.isSubmittingOnlineTurn = false;
            this.updateOnlineInteractionState();
        }
    }
}
