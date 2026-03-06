import { htmlX01 } from './views/view-x01.js';
import { LevelSystem } from './supabase_client.js'; // Import für XP-Berechnung hinzugefügt

const UIController = {
    DAILY_WORKOUT_IDS: ['bulls-warmup', 'atc', 'numbers-warmup', 'shanghai', 'checkoutchallenge'],
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
            { id: 'checkoutchallenge', name: 'Checkout Challenge', icon: 'ri-target-line', active: true }
        ], 
        scoring: [
            { id: 'x01', name: 'X01 Training', icon: 'ri-numbers-line', active: true },
            { id: 'countup', name: 'Count Up', icon: 'ri-bar-chart-line', active: true }
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
            'view-stats', 
            'view-game-active', 
            'view-game-x01',
            'modal-game-setup',
            'modal-game-result'
        ];
        
        if (target === 'stats') {
            views.forEach(v => document.getElementById(v)?.classList.add('hidden'));
            document.getElementById('view-stats').classList.remove('hidden');
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

        if (target === 'challenge') {
            this.showChallengeCategories();
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
                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayPreview(['${this.DAILY_WORKOUT_IDS.join("','")}'], 'Daily Workout')" style="padding: 20px; text-align: left; border: 1px solid var(--neon-cyan);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 style="color: var(--neon-cyan); margin: 0;">Daily Workout</h3>
                                <p style="font-size: 0.8rem; margin: 5px 0 0; opacity: 0.7;">5 feste Spiele • Volles Training</p>
                            </div>
                            <i class="ri-calendar-check-line" style="font-size: 2rem; color: var(--neon-cyan);"></i>
                        </div>
                    </div>

                    <div class="qp-card glass-btn" onclick="UIController.showQuickplayPreview(['${randomQueue.join("','")}'], 'Random Mix')" style="padding: 20px; text-align: left;">
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

    showQuickplayPreview(queueIds, title) {
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
                    <button class="primary-btn flash-btn" style="flex: 2;" onclick="GameManager.startQuickplaySequence(['${queueIds.join("','")}'])">
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