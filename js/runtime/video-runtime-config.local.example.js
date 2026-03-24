window.__OCRAM_VIDEO_CONFIG__ = {
    ...window.__OCRAM_VIDEO_CONFIG__,
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:turn.example.com:3478',
            username: 'turn-user',
            credential: 'turn-password'
        }
    ]
};
