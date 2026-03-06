/**
 * CORE APP - SUPABASE & AUTH CONNECTOR
 * Fokus: Authentifizierung, Profil-Synchronisation und XP/Level System.
 */

import { getRankSvg } from './sr-ranks.js';

const SB_URL = 'https://ujccdnduolqyzjoeghrl.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2NkbmR1b2xxeXpqb2VnaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjI5NTIsImV4cCI6MjA4NjI5ODk1Mn0.4P_H3vrvOnfNGK4TKjas75pu3HpNT3OSMAPzK9Ok64s';
const INVITE_REQUIRED = '123';

const supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);

// --- XP & LEVEL SYSTEM LOGIK ---
export const LevelSystem = {
    /**
     * Holt die aktuellen Stats für den GameManager (Challenge-Level Ermittlung)
     */
    async getUserStats() {
        if (window.appState.profile) {
            const xp = window.appState.profile.xp || 0;
            return {
                level: LevelSystem.calcLevel(xp),
                xp: xp
            };
        }
        
        await fetchUserProfile();
        const xp = window.appState.profile?.xp || 0;
        return {
            level: LevelSystem.calcLevel(xp),
            xp: xp
        };
    },

    /**
     * NEU: Berechnet das neue Elo-Rating basierend auf der Match-Performance (0-180)
     */
    calculateElo(currentSR, matchPerformance) {
        const K = 32; // Volatilitäts-Faktor
        const MAX_SCORE = 180;
        
        // 1. Normierung der Match-Leistung (0.0 bis 1.0)
        const actual = Math.min(MAX_SCORE, matchPerformance) / MAX_SCORE;
        
        // 2. Erwartungswert basierend auf aktuellem Rating
        // Ein Rating von 1000 erwartet ca. 90 Punkte (0.5 Performance)
        const expected = 1 / (1 + Math.pow(10, (1000 - currentSR) / 600));
        
        const change = Math.round(K * (actual - expected));
        const newSR = Math.max(0, currentSR + change); // Verhindert negatives Rating

        return { newSR, change };
    },

    // Formel: XP = 80 * L^2.25
    calcLevel: (totalXP) => {
        if (!totalXP || totalXP < 80) return 1;
        const lvl = Math.floor(Math.pow(totalXP / 80, 1 / 2.25));
        return Math.min(99, lvl);
    },

    xpForLevel: (l) => {
        return Math.floor(80 * Math.pow(l, 2.25));
    },

    getLevelProgress: (totalXP) => {
        const currentLvl = LevelSystem.calcLevel(totalXP);
        const xpCurrentLvlStart = LevelSystem.xpForLevel(currentLvl);
        const xpNextLvlStart = LevelSystem.xpForLevel(currentLvl + 1);
        
        const requiredForStep = xpNextLvlStart - xpCurrentLvlStart;
        const gainedInStep = totalXP - xpCurrentLvlStart;
        const percent = Math.max(2, (gainedInStep / requiredForStep) * 100); 
        
        return {
            level: currentLvl,
            percent: Math.min(100, percent),
            xpToNext: xpNextLvlStart - totalXP
        };
    },

    calculateMatchXP: (performanceBonus = 0, malusPenalty = 0) => {
        const baseXP = 1000;
        return Math.max(100, baseXP + performanceBonus - malusPenalty);
    }
};

window.appState = {
    user: null,
    profile: null
};

// --- INITIALISIERUNG ---
async function init() {
    console.log("App Initializing...");
    const checkNavigation = setInterval(async () => {
        if (typeof window.navigate === "function") {
            clearInterval(checkNavigation);
            const { data: { session } } = await supabaseClient.auth.getSession();
            setupAuthEventListeners();

            if (session) {
                await setupAuthenticatedSession(session.user);
            } else {
                const authScreen = document.getElementById('auth-screen');
                const appScreen = document.getElementById('app-screen');
                if (authScreen) authScreen.classList.remove('hidden');
                if (appScreen) appScreen.classList.add('hidden');
            }
        }
    }, 50); 
}

// --- AUTHENTIFIZIERUNG ---
function setupAuthEventListeners() {
    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const btnLogout = document.getElementById('btn-logout');

    if (btnLogin) btnLogin.onclick = handleSignIn;
    if (btnSignup) btnSignup.onclick = handleSignUp;
    if (btnLogout) btnLogout.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };
}

async function handleSignIn() {
    const emailInput = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!emailInput || !password) return flashError("Daten fehlen!");
    const email = emailInput.includes('@') ? emailInput : `${emailInput.toLowerCase().trim()}@dart.app`;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) flashError(error.message);
    else await setupAuthenticatedSession(data.user);
}

async function handleSignUp() {
    const username = document.getElementById('username').value;
    const emailInput = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const invite = document.getElementById('invite-code').value;

    if (invite !== INVITE_REQUIRED) return flashError("Falscher Invite-Code!");
    const email = emailInput.includes('@') ? emailInput : `${username.toLowerCase().trim()}@dart.app`;

    const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { username, invite_code: invite } }
    });

    if (error) flashError(error.message);
    else if (data.user) await setupAuthenticatedSession(data.user);
}

async function setupAuthenticatedSession(user) {
    window.appState.user = user;
    await fetchUserProfile();
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');
    if (authScreen) authScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    window.navigate('dashboard');
}

// --- DATENBANK SYNCHRONISATION ---
async function fetchUserProfile() {
    if (!window.appState.user) return;
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', window.appState.user.id)
        .single();

    if (data) {
        window.appState.profile = data;
        renderProfile();
    }
}

// --- PROFIL RENDERING ---
window.renderProfile = function() {
    const profile = window.appState.profile;
    if (!profile) return;

    if (window.UIController && window.UIController.updateProfileDisplay) {
        window.UIController.updateProfileDisplay(profile);
    }

    const progress = LevelSystem.getLevelProgress(profile.xp || 0);

    const nameEl = document.getElementById('display-name');
    const levelEl = document.getElementById('display-level');
    if (nameEl) nameEl.textContent = profile.username || "Spieler";
    if (levelEl) levelEl.textContent = progress.level;

    const xpBarEl = document.getElementById('xp-bar');
    if (xpBarEl) {
        xpBarEl.style.width = `${progress.percent}%`;
    }

    const headerEl = document.querySelector('.main-header');
    if (headerEl) {
        headerEl.className = headerEl.className.replace(/\blvl-\d+\b/g, '');
        headerEl.classList.add(`lvl-${progress.level}`);
    }

    // UPDATE: Nutzt jetzt die korrekten Spaltennamen aus deiner SQL DB
    const totalDartsEl = document.getElementById('stat-total-darts');
    const totalGamesEl = document.getElementById('stat-total-games');
    if (totalDartsEl) totalDartsEl.textContent = (profile.total_darts_thrown || 0).toLocaleString();
    if (totalGamesEl) totalGamesEl.textContent = (profile.total_games_played || 0).toLocaleString();

    // SR CATEGORIES UPDATE (Inklusive Icons aus sr-ranks.js)
    const categories = [
        { id: 'sr-finishing', iconId: 'icon-finishing', val: profile.sr_finishing },
        { id: 'sr-scoring', iconId: 'icon-scoring', val: profile.sr_scoring },
        { id: 'sr-boardcontrol', iconId: 'icon-boardcontrol', val: profile.sr_boardcontrol }
    ];

    categories.forEach(cat => {
        const textEl = document.getElementById(cat.id);
        const iconEl = document.getElementById(cat.iconId);
        const score = cat.val || 0;
        
        if (textEl) textEl.textContent = score;
        if (iconEl) iconEl.innerHTML = getRankSvg(score);
    });
};

/**
 * Synchronisiert Spielergebnisse mit der DB und aktualisiert das HUD optimistisch
 */
window.syncMatchToDatabase = async function(xpGained, matchStats, srGained = 0, srCategory = 'boardcontrol', isTraining = false) {
    
    // Sicherstellen, dass wir Zahlen haben
    const xp = parseInt(xpGained || 0);
    const sr = parseInt(srGained || 0);
    // Versucht Darts aus verschiedenen Ebenen zu fischen
    const dartsThrown = parseInt(matchStats.totalDarts || matchStats.stats?.totalDarts || matchStats.darts || 0);

    // 1. Darts & Games optimistisch updaten (NUR wenn es KEIN Training ist)
    if (window.appState.profile && !isTraining) {
        window.appState.profile.total_games_played = (window.appState.profile.total_games_played || 0) + 1;
        
        // FIX: Korrekter Variablenname (total_darts_thrown statt total_dart_thrown)
        const currentDarts = window.appState.profile.total_darts_thrown || 0;
        window.appState.profile.total_darts_thrown = currentDarts + dartsThrown;
        
        // SOFORT ins HTML schreiben (UI-Reaktionszeit verbessern)
        const dartsEl = document.getElementById('stat-total-darts');
        const gamesEl = document.getElementById('stat-total-games');
        if (dartsEl) dartsEl.textContent = window.appState.profile.total_darts_thrown.toLocaleString();
        if (gamesEl) gamesEl.textContent = window.appState.profile.total_games_played.toLocaleString();
    }

    // 2. XP & SR optimistisch im Profil-Objekt setzen
    if (window.appState.profile) {
        window.appState.profile.xp = (window.appState.profile.xp || 0) + xp;
        
        // SR nur setzen wenn kein Training und Kategorie gültig
        const srKey = `sr_${srCategory}`;
        if (!isTraining && window.appState.profile.hasOwnProperty(srKey)) {
            window.appState.profile[srKey] = sr;
        }

        setTimeout(() => {
            window.renderProfile(); 
        }, 800); 
    }

    // 3. Im Hintergrund an die DB senden
    // WICHTIG: Die Namen der Parameter müssen exakt mit deiner SQL Funktion p_... übereinstimmen!
    const { error } = await supabaseClient.rpc('finish_game', {
        p_game_mode: matchStats.mode || 'unknown',
        p_stats: matchStats,
        p_xp_gained: xp,
        p_sr_gained: sr,
        p_sr_category: srCategory,
        p_darts_thrown: dartsThrown,
        p_is_training: isTraining
    });

    if (error) {
        console.error("Datenbank-Fehler beim Speichern:", error);
    } else {
        console.log(`Match synchronisiert: ${xp} XP, ${sr} SR (${srCategory})`);
        fetchUserProfile(); // Daten final von DB ziehen um sicher zu sein
    }
};

function flashError(msg) {
    const errNode = document.getElementById('auth-error');
    if (errNode) {
        errNode.textContent = msg;
        setTimeout(() => errNode.textContent = '', 4000);
    }
}

init();