export const SoundManager = {
    sounds: {},
    isMuted: false,

    init() {
        // Hier deine Dateinamen anpassen, falls sie anders heißen
        this.sounds = {
            click: new Audio('sounds/click.wav'),
            hit: new Audio('sounds/hit.wav'),
            miss: new Audio('sounds/miss.wav'),
            next: new Audio('sounds/nextround.wav'),
            undo: new Audio('sounds/undo.wav')
        };

        // UI-Klicks global abfangen (Minimal Invasiv für das Menü)
        document.addEventListener('click', (e) => {
            // Spielt Sound ab, wenn auf einen Button, eine Karte oder ein Icon geklickt wird
            if (e.target.closest('button, .glass-card, .square-card, .wide-card, .opt-btn, .qp-card')) {
                // Verhindere Doppel-Sounds, wenn In-Game Buttons geklickt werden (die haben eigene Sounds)
                if (!e.target.closest('.x01-controls-container, .x01-controls, .hit-buttons-grid')) {
                    this.play('click');
                }
            }
        });
    },

    play(type) {
        if (this.isMuted || !this.sounds[type]) return;
        
        // Sound klonen oder zurücksetzen, damit er auch bei schnellem Klicken mehrfach spielt
        this.sounds[type].currentTime = 0;
        this.sounds[type].play().catch(err => console.warn("Sound play prevented by browser:", err));
    }
};

// Global verfügbar machen für einfache Aufrufe
window.SoundManager = SoundManager;