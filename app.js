/**
 * CORE APP - SUPABASE & AUTH CONNECTOR
 * Fokus: Authentifizierung, Profil-Synchronisation und Datenbank-Kommunikation.
 */

const SB_URL = 'https://ujccdnduolqyzjoeghrl.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2NkbmR1b2xxeXpqb2VnaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjI5NTIsImV4cCI6MjA4NjI5ODk1Mn0.4P_H3vrvOnfNGK4TKjas75pu3HpNT3OSMAPzK9Ok64s';
const INVITE_REQUIRED = '123';

const supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);

// Zentraler Status der App
window.appState = {
    user: null,
    profile: null
};

// --- INITIALISIERUNG ---
async function init() {
    console.log("App Initializing...");
    
    // FIX: Warten, bis der UIController window.navigate bereitgestellt hat
    const checkNavigation = setInterval(async () => {
        if (typeof window.navigate === "function") {
            clearInterval(checkNavigation);
            
            // Erst wenn Navigation bereit ist, Session prüfen
            const { data: { session } } = await supabaseClient.auth.getSession();
            setupAuthEventListeners();

            if (session) {
                await setupAuthenticatedSession(session.user);
            } else {
                // Falls nicht eingeloggt, Auth-Screen zeigen (indem wir app-screen verstecken)
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('app-screen').classList.add('hidden');
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

    if (!emailInput || !password) return flashError("E-Mail/Name und Passwort fehlen!");

    const email = emailInput.includes('@') ? emailInput : `${emailInput.toLowerCase().trim()}@dart.app`;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        flashError(error.message);
    } else {
        await setupAuthenticatedSession(data.user);
    }
}

async function handleSignUp() {
    const username = document.getElementById('username').value;
    const emailInput = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const invite = document.getElementById('invite-code').value;

    if (invite !== INVITE_REQUIRED) return flashError("Falscher Invite-Code!");
    if (!username || !password) return flashError("Name und Passwort fehlen!");

    const email = emailInput.includes('@') ? emailInput : `${username.toLowerCase().trim()}@dart.app`;

    const { data, error } = await supabaseClient.auth.signUp({
        email, 
        password,
        options: { data: { username, invite_code: invite } }
    });

    if (error) {
        flashError(error.message);
    } else {
        if (data.user) await setupAuthenticatedSession(data.user);
    }
}

async function setupAuthenticatedSession(user) {
    window.appState.user = user;
    await fetchUserProfile();
    
    // UI-Wechsel
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    
    // Sicherstellen, dass wir auf dem Dashboard landen
    window.navigate('dashboard');
}

// --- DATENBANK SYNCHRONISATION ---
async function fetchUserProfile() {
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

    const nameEl = document.getElementById('display-name');
    const levelEl = document.getElementById('display-level');
    const xpBarEl = document.getElementById('xp-bar');

    if (nameEl) nameEl.textContent = profile.username || "Spieler";
    if (levelEl) levelEl.textContent = profile.level || "1";

    if (xpBarEl) {
        const currentLevel = profile.level || 1;
        const currentXP = profile.xp || 0;
        
        // XP Formel (muss mit deinem SQL Trigger übereinstimmen)
        const currentLevelBaseXP = Math.pow(currentLevel - 1, 2) * 50;
        const nextLevelXP = Math.pow(currentLevel, 2) * 50;
        
        const progressInLevel = currentXP - currentLevelBaseXP;
        const totalNeededInLevel = nextLevelXP - currentLevelBaseXP;
        
        const percentage = Math.max(5, (progressInLevel / totalNeededInLevel) * 100);
        xpBarEl.style.width = `${percentage}%`;
    }
};

/**
 * Globale Funktion zum Speichern von Spielergebnissen
 * Wird vom GameManager aufgerufen
 */
window.syncMatchToDatabase = async function(xpGained, matchStats) {
    const { error } = await supabaseClient.rpc('finish_game', {
        p_game_mode: matchStats.mode || 'unknown',
        p_stats: matchStats,
        p_xp_gained: xpGained,
        p_first_dart_hits: matchStats.first_dart_hits || 0
    });

    if (error) {
        console.error("Datenbank-Fehler:", error);
    } else {
        await fetchUserProfile();
    }
};

// Hilfsfunktion für Fehlermeldungen
function flashError(msg) {
    const errNode = document.getElementById('auth-error');
    if (errNode) {
        errNode.textContent = msg;
        setTimeout(() => errNode.textContent = '', 4000);
    }
}

// Start der App
init();