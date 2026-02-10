/**
 * DART TRACKER PRO - VOLLSTÄNDIGE VERSION
 * Fixes: ReferenceErrors behoben, Auto-Email-Generierung für Namen-Login
 */

const SB_URL = 'https://ujccdnduolqyzjoeghrl.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2NkbmR1b2xxeXpqb2VnaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjI5NTIsImV4cCI6MjA4NjI5ODk1Mn0.4P_H3vrvOnfNGK4TKjas75pu3HpNT3OSMAPzK9Ok64s';
const INVITE_REQUIRED = '123';

const supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);

// --- GLOBAL STATE ---
let state = {
    user: null,
    profile: null,
    game: {
        active: false,
        mode: '501_classic',
        startScore: 501,
        currentScore: 501,
        dartsInLeg: 0,
        firstDartHits: 0
    }
};

// --- DOM NODES ---
const nodes = {
    auth: document.getElementById('auth-screen'),
    app: document.getElementById('app-screen'),
    email: document.getElementById('email'), // Wird für Login/Namen genutzt
    pass: document.getElementById('password'),
    invite: document.getElementById('invite-code'),
    user: document.getElementById('username'),
    scoreInput: document.getElementById('throw-input'),
    displayName: document.getElementById('display-name'),
    displayLevel: document.getElementById('display-level'),
    xpBar: document.getElementById('xp-bar'),
    currentScore: document.getElementById('current-score'),
    errorMsg: document.getElementById('auth-error')
};

// --- HELPER FUNCTIONS ---
function flashError(msg, type = "error") {
    nodes.errorMsg.textContent = msg;
    nodes.errorMsg.style.color = type === "error" ? "#ff4b4b" : "#00f2ff";
    setTimeout(() => nodes.errorMsg.textContent = '', 4000);
}

function showScreen(screen) {
    if (screen === 'auth') {
        nodes.auth.classList.remove('hidden');
        nodes.app.classList.add('hidden');
    } else {
        nodes.auth.classList.add('hidden');
        nodes.app.classList.remove('hidden');
    }
}

// Erstellt aus einem Namen eine technische E-Mail (z.B. "max" -> "max@dart.app")
function formatEmail(input) {
    return input.includes('@') ? input : `${input.toLowerCase().trim()}@dart.app`;
}

// --- DATABASE ACTIONS ---
async function fetchUserProfile() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', state.user.id)
        .single();
    if (data) {
        state.profile = data;
        renderProfile();
    }
}

async function syncMatchToDatabase(xpGained, matchStats) {
    const { error } = await supabaseClient.rpc('finish_game', {
        p_game_mode: state.game.mode,
        p_stats: matchStats,
        p_xp_gained: xpGained,
        p_first_dart_hits: state.game.firstDartHits
    });
    if (!error) await fetchUserProfile();
}

// --- AUTH LOGIC (Vor dem Event-Setup definiert!) ---
async function handleSignIn() {
    const email = formatEmail(nodes.email.value);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: nodes.pass.value
    });

    if (error) flashError("Login fehlgeschlagen: " + error.message);
    else setupAuthenticatedSession(data.user);
}

async function handleSignUp() {
    const name = nodes.user.value;
    const email = formatEmail(name);
    const password = nodes.pass.value;
    const invite = nodes.invite.value;

    if (invite !== INVITE_REQUIRED) return flashError("Falscher Invite-Code!");
    if (!name || !password) return flashError("Name und Passwort nötig!");

    const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { username: name, invite_code: invite } }
    });

    if (error) flashError(error.message);
    else if (data.user) {
        setupAuthenticatedSession(data.user);
        flashError("Konto erstellt & eingeloggt!", "info");
    }
}

async function setupAuthenticatedSession(user) {
    state.user = user;
    await fetchUserProfile();
    showScreen('app');
}

// --- GAME ENGINE ---
function updateGameUI() {
    nodes.currentScore.textContent = state.game.currentScore;
}

function processScoreInput() {
    const value = parseInt(nodes.scoreInput.value);
    if (isNaN(value) || value < 0 || value > 180) return flashError("0-180 eingeben");

    // Statistik: Traf der erste Dart?
    if (state.game.dartsInLeg === 0 && value > 0) state.game.firstDartHits++;

    const remaining = state.game.currentScore - value;
    if (remaining === 0) {
        finishLeg(value);
    } else if (remaining < 2) {
        flashError("Bust!");
    } else {
        state.game.currentScore = remaining;
        state.game.dartsInLeg += 3;
        updateGameUI();
    }
    nodes.scoreInput.value = '';
}

function finishLeg(finalScore) {
    const xp = 50 + Math.max(0, 100 - state.game.dartsInLeg);
    const stats = { darts: state.game.dartsInLeg + 3, avg: ((501/(state.game.dartsInLeg+3))*3).toFixed(1) };
    
    syncMatchToDatabase(xp, stats);
    state.game.currentScore = 501;
    state.game.dartsInLeg = 0;
    state.game.firstDartHits = 0;
    updateGameUI();
    alert(`Sieg! +${xp} XP`);
}

// --- UI RENDERING ---
function renderProfile() {
    if (!state.profile) return;
    nodes.displayName.textContent = state.profile.username;
    nodes.displayLevel.textContent = state.profile.level;
    
    const currentLevelBaseXP = Math.pow(state.profile.level - 1, 2) * 50;
    const nextLevelXP = Math.pow(state.profile.level, 2) * 50;
    const progress = state.profile.xp - currentLevelBaseXP;
    const totalNeeded = nextLevelXP - currentLevelBaseXP;
    
    nodes.xpBar.style.width = `${Math.max(5, (progress / totalNeeded) * 100)}%`;
}

// --- INIT & EVENTS ---
function setupEventListeners() {
    document.getElementById('btn-login').addEventListener('click', handleSignIn);
    document.getElementById('btn-signup').addEventListener('click', handleSignUp);
    document.getElementById('btn-logout').addEventListener('click', () => {
        supabaseClient.auth.signOut();
        window.location.reload();
    });
    document.getElementById('submit-score').addEventListener('click', processScoreInput);
    nodes.scoreInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') processScoreInput(); });
}

async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    setupEventListeners(); // Erst Events binden
    if (session) setupAuthenticatedSession(session.user);
    else showScreen('auth');
}

init();