// --- KONFIGURATION ---
const SUPABASE_URL = 'https://ujccdnduolqyzjoeghrl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2NkbmR1b2xxeXpqb2VnaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjI5NTIsImV4cCI6MjA4NjI5ODk1Mn0.4P_H3vrvOnfNGK4TKjas75pu3HpNT3OSMAPzK9Ok64s';
const INVITATION_CODE = '123';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE MANAGEMENT ---
const state = {
    user: null,
    profile: null,
    currentScore: 501,
    currentDart: 1
};

// --- DOM ELEMENTS ---
const el = {
    authScreen: document.getElementById('auth-screen'),
    appScreen: document.getElementById('app-screen'),
    inviteInput: document.getElementById('invite-code'),
    emailInput: document.getElementById('email'),
    passInput: document.getElementById('password'),
    nameInput: document.getElementById('username'),
    loginBtn: document.getElementById('btn-login'),
    signupBtn: document.getElementById('btn-signup'),
    logoutBtn: document.getElementById('btn-logout'),
    authError: document.getElementById('auth-error'),
    displayName: document.getElementById('display-name'),
    displayLevel: document.getElementById('display-level'),
    xpBar: document.getElementById('xp-bar'),
    scoreDisplay: document.getElementById('current-score'),
    scoreInput: document.getElementById('throw-input'),
    submitScoreBtn: document.getElementById('submit-score')
};

// --- AUTHENTIFIZIERUNG ---
async function init() {
    // Session check beim Start
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        handleLoginSuccess(session.user);
    } else {
        el.appScreen.classList.add('hidden');
        el.authScreen.classList.remove('hidden');
    }
}

async function handleLoginSuccess(user) {
    state.user = user;
    el.authScreen.classList.add('hidden');
    el.appScreen.classList.remove('hidden');
    
    // Profil laden
    await loadProfile();
}

async function signUp() {
    const email = el.emailInput.value;
    const password = el.passInput.value;
    const invite = el.inviteInput.value;
    const username = el.nameInput.value;

    if (invite !== INVITATION_CODE) {
        showError("Falscher Invite Code!");
        return;
    }

    // Wir senden den Invite Code und Username in den Metadaten mit
    // Der Datenbank-Trigger (Phase 1) prüft diese Daten
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                invite_code: invite,
                username: username
            }
        }
    });

    if (error) {
        showError(error.message);
    } else {
        showError("Account erstellt! Bitte einloggen.", false); // false = grüne Farbe (muss in CSS angepasst werden) oder Info
    }
}

async function signIn() {
    const email = el.emailInput.value;
    const password = el.passInput.value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email, password
    });

    if (error) showError(error.message);
    else handleLoginSuccess(data.user);
}

async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
}

// --- DATEN & GAME LOGIC ---
async function loadProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', state.user.id)
        .single();

    if (data) {
        state.profile = data;
        updateUI();
    }
}

function updateUI() {
    if (!state.profile) return;
    el.displayName.textContent = state.profile.username;
    el.displayLevel.textContent = state.profile.level;
    
    // XP Bar Berechnung (Vereinfacht: 0-100% für aktuelles Level)
    // In einem echten System müsste man XP für nächstes Level berechnen
    const xpMod = state.profile.xp % 100; 
    el.xpBar.style.width = `${xpMod}%`;
}

async function submitThrow() {
    const score = parseInt(el.scoreInput.value);
    if (isNaN(score) || score < 0 || score > 180) {
        alert("Ungültiger Score");
        return;
    }

    // Statistiken berechnen
    let xpGain = score; // Basis XP = geworfene Punkte
    
    // First Dart Statistik Logik (Beispiel)
    let firstDartHit = 0;
    if (state.currentDart === 1 && score > 0) {
        firstDartHit = 1;
        xpGain += 10; // Bonus für Treffer mit erstem Dart
    }

    // Neue Werte berechnen
    const newXP = state.profile.xp + xpGain;
    const newTotalThrows = state.profile.total_throws + 1;
    const newFirstDartHits = state.profile.first_dart_hits + firstDartHit;
    
    // Level Berechnung (Entspricht SQL Funktion logic)
    const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;

    // Optimistisches UI Update (Sofort anzeigen, dann speichern)
    state.currentScore -= score;
    el.scoreDisplay.textContent = state.currentScore;
    el.scoreInput.value = '';

    // Speichern in DB
    const { error } = await supabase
        .from('profiles')
        .update({ 
            xp: newXP, 
            level: newLevel,
            total_throws: newTotalThrows,
            first_dart_hits: newFirstDartHits
        })
        .eq('id', state.user.id);

    if (!error) {
        // Lokalen State updaten
        state.profile.xp = newXP;
        state.profile.level = newLevel;
        state.profile.total_throws = newTotalThrows;
        state.profile.first_dart_hits = newFirstDartHits;
        updateUI();
    }
}

function showError(msg) {
    el.authError.textContent = msg;
    setTimeout(() => el.authError.textContent = '', 3000);
}

// --- EVENT LISTENERS ---
el.loginBtn.addEventListener('click', signIn);
el.signupBtn.addEventListener('click', signUp);
el.logoutBtn.addEventListener('click', signOut);
el.submitScoreBtn.addEventListener('click', submitThrow);

// Spiel Helpers
window.game = {
    addThrow: (dartNum) => {
        state.currentDart = dartNum;
        // Visual Feedback für Button Selection könnte hier hin
        console.log(`Dart ${dartNum} ausgewählt`);
    }
};

// Start
init();