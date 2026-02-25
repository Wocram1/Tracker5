import { htmlX01 } from './views/view-x01.js';

const UIController = {
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
            { id: 'x01', name: 'X01 Training', icon: 'ri-numbers-line', active: true }
        ], 
        warmup: [
            { id: 'numbers-warmup', name: '20, 19, 18 Warmup', icon: 'ri-fire-line', active: true }
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

    showChallengeCategories() {
        // Kategorien im Challenge Mode jetzt auch als Balken
        const container = document.getElementById('view-challenge').querySelector('.category-list') || 
                          document.getElementById('view-challenge').querySelector('.category-grid');
        if (!container) return;

        // Wir stellen sicher, dass die Klasse für die Liste stimmt
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
            // Hier nutzen wir jetzt den neuen einheitlichen Balken-Stil
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
    }
};

// Globale Funktionen für HTML Access
window.navigate = (t) => UIController.navigate(t);
window.showGames = (c) => UIController.showGamesByCategory(c);
window.UIController = UIController;

window.selectGame = (id) => {
    if (window.GameManager) {
        window.GameManager.handleGameSelection(id);
    } else {
        console.error("GameManager not loaded");
    }
};

// Helper für Setup Modals
window.selectModalOption = (btn, fieldId, value) => {
    const parent = btn.parentNode;
    parent.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const hiddenInput = document.getElementById(`setup-${fieldId}`);
    if (hiddenInput) hiddenInput.value = value;
};