export const SoundManager = {
    context: null,
    buffers: {},
    isMuted: false,

    async init() {
        // Audio Context initialisieren (Web Audio API)
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        const soundFiles = {
            click: 'sounds/click.wav',
            hit: 'sounds/hit.wav',
            miss: 'sounds/miss.wav',
            next: 'sounds/nextround.wav',
            undo: 'sounds/undo.wav'
        };

        // Alle Sounds parallel laden und dekodieren
        const loadPromises = Object.entries(soundFiles).map(async ([key, url]) => {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
            } catch (e) {
                console.error(`Fehler beim Laden von Sound: ${key}`, e);
            }
        });

        await Promise.all(loadPromises);

        // Globaler Click-Listener (wie gehabt)
        document.addEventListener('click', (e) => {
            if (this.context?.state === 'suspended') this.context.resume();
            
            if (e.target.closest('button, .glass-card, .square-card, .wide-card, .opt-btn, .qp-card')) {
                if (!e.target.closest('.x01-controls-container, .x01-controls, .hit-buttons-grid')) {
                    this.play('click');
                }
            }
        });
    },

    play(type) {
        if (this.isMuted || !this.buffers[type] || !this.context) return;

        // Falls der Browser den AudioContext wegen Autoplay-Richtlinien pausiert hat
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        // BufferSource erstellen (das ist der "Player" für den Moment)
        const source = this.context.createBufferSource();
        source.buffer = this.buffers[type];
        source.connect(this.context.destination);
        source.start(0); // Startet sofort ohne Verzögerung
    }
};
<<<<<<< HEAD
window.SoundManager = SoundManager;

async function keepScreenAlive() {
    if ('wakeLock' in navigator) {
        try {
            await navigator.wakeLock.request('screen');
        } catch (err) {
            console.log("Wake Lock nicht möglich");
        }
    }
}

// Trigger bei jedem Spielstart oder Klick
document.addEventListener('click', keepScreenAlive, { once: true });
=======
window.SoundManager = SoundManager;
>>>>>>> 3473ee7cd40fa21899c17045fd298b87c94217c2
