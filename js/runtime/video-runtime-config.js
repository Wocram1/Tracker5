window.__OCRAM_VIDEO_CONFIG__ = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
        // TURN example:
        // {
        //     urls: 'turn:turn.example.com:3478',
        //     username: 'turn-user',
        //     credential: 'turn-password'
        // }
    ],
    iceServerEndpoint: '/.netlify/functions/cloudflare-turn-credentials',
    iceServerTtlSeconds: 43200,
    startMicrophoneMuted: true,
    preferReceiveOnlyOnInsecureIOS: true,
    mobilePreset: {
        label: 'Mobile 360p',
        width: 640,
        height: 360,
        frameRate: 18
    },
    desktopPreset: {
        label: 'Desktop 540p',
        width: 960,
        height: 540,
        frameRate: 24
    }
};
