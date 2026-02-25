const UIController = {
    gamesData: {
        board: [
            { id: 'atc', name: 'Around the Clock', icon: 'ri-restart-line', active: true },
            { id: 'shanghai', name: 'Shanghai', icon: 'ri-building-line', active: true }
        ],
        finishing: [], scoring: [], warmup: []
    },

    navigate(target) {
        const views = ['view-dashboard', 'view-training', 'view-games-list', 'view-challenge', 'view-stats', 'view-game-active'];
        
        // Sonderlogik für gesperrte Bereiche
        if (target === 'challenge' || target === 'stats') {
            alert("Coming Soon: Dieser Bereich ist in Arbeit!");
            return;
        }

        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.classList.add('hidden');
        });

        const targetView = document.getElementById(`view-${target}`);
        if (targetView) targetView.classList.remove('hidden');
        
        this.updateDockUI(target);
    },

    showGamesByCategory(category) {
        const games = this.gamesData[category];
        if (!games || games.length === 0) {
            alert("Coming Soon: Diese Kategorie folgt in Kürze!");
            return;
        }

        const container = document.getElementById('view-games-list');
        container.innerHTML = `
            <div class="nav-header">
                <button class="back-btn" onclick="UIController.navigate('training')">
                    <i class="ri-arrow-left-s-line"></i> Zurück
                </button>
                <h2 class="view-title">${category.toUpperCase()}</h2>
            </div>
            <div class="category-grid animated-in">
                ${games.map(game => `
                    <div class="cat-card glass-panel" onclick="window.selectGame('${game.id}')">
                        <i class="${game.icon}"></i>
                        <span>${game.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
        this.navigate('games-list');
    },

    updateDockUI(activeId) {
        document.querySelectorAll('.dock-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('onclick').includes(`'${activeId}'`)) item.classList.add('active');
        });
    }
};

window.navigate = (t) => UIController.navigate(t);
window.showGames = (c) => UIController.showGamesByCategory(c);
window.UIController = UIController;
window.selectGame = (id) => {
    UIController.navigate('game-active');
    window.GameManager.loadGame(id);
};