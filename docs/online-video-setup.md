# Online Video Setup

## Ziel

Der Online-Video-Teil ist jetzt auf drei Einsatzfaelle vorbereitet:

- lokale Desktop-Entwicklung
- echter Handy-Test mit HTTPS
- spaetere TURN-Nutzung fuer mobile Netze

## Lokales Testen

### Laptop

- Kamera und Mikrofon lokal am besten ueber `http://localhost:8888`
- `http://192.168.x.x:8888` kann vom Browser fuer `getUserMedia()` blockiert werden

### iPhone / iPad

- Kamera und Mikrofon brauchen im Browser einen sicheren Kontext
- fuer echtes Senden deshalb per `https://...` testen
- auf ungesichertem LAN-HTTP bleibt nur der aktuelle Fallback-Modus sinnvoll

## HTTPS fuer Mobile

Empfohlene Wege fuer echte iPhone-Tests:

1. Tunnel auf den lokalen Dev-Server
   - zum Beispiel `ngrok` oder `cloudflared`
   - Vorteil: schnellster Weg zu einer echten `https://`-URL

2. Lokales Zertifikat
   - zum Beispiel mit `mkcert`
   - sinnvoll, wenn dauerhaft im Heimnetz getestet wird

## TURN / ICE Konfiguration

Der Video-Service nutzt standardmaessig nur STUN:

```js
[
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]
```

Die zentrale Runtime-Datei dafuer liegt jetzt hier:

- [video-runtime-config.js](/c:/Users/Svenja/Desktop/Dartapp/ocramtracker/js/runtime/video-runtime-config.js)
- lokaler Secret-Override: [video-runtime-config.local.js](/c:/Users/Svenja/Desktop/Dartapp/ocramtracker/js/runtime/video-runtime-config.local.js)
- Vorlage dafuer: [video-runtime-config.local.example.js](/c:/Users/Svenja/Desktop/Dartapp/ocramtracker/js/runtime/video-runtime-config.local.example.js)
- Netlify Function fuer Cloudflare TURN: [cloudflare-turn-credentials.js](/c:/Users/Svenja/Desktop/Dartapp/ocramtracker/netlify/functions/cloudflare-turn-credentials.js)

Fuer echte mobile Netze sollte spaeter mindestens ein TURN-Server hinterlegt werden.

### Variante A: Window Runtime Config

Empfohlen ist jetzt direkt die Runtime-Datei:

```js
window.__OCRAM_VIDEO_CONFIG__ = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.example.com:3478',
      username: 'demo-user',
      credential: 'demo-password'
    }
  ],
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
```

Fuer echte Zugangsdaten bitte bevorzugt die lokale Override-Datei bearbeiten:

```js
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
```

Im aktuellen Stand ist das eine praktische Stub-Datei im Projekt. Sobald echte TURN-Credentials verwendet werden, sollten wir sie in einen nicht versionierten Override oder in das Deployment-Setup verschieben.

Alternativ:

```html
<script>
  window.__OCRAM_VIDEO_ICE_SERVERS__ = [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.example.com:3478',
      username: 'demo-user',
      credential: 'demo-password'
    }
  ];
</script>
```

### Variante B: LocalStorage fuer Dev-Tests

Im Browser-Console-Tab:

```js
localStorage.setItem('online-video-ice-servers', JSON.stringify([
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:turn.example.com:3478',
    username: 'demo-user',
    credential: 'demo-password'
  }
]));
```

Legacy-Key wird ebenfalls noch gelesen:

```js
localStorage.setItem('online-video-turn-config', JSON.stringify([
  {
    urls: 'turn:turn.example.com:3478',
    username: 'demo-user',
    credential: 'demo-password'
  }
]));
```

## Aktuelle Audio-/Video-Regeln

- Mikrofon startet bewusst stumm
- Desktop nutzt standardmaessig `540p / 24fps`
- kompakte/mobile Geraete nutzen standardmaessig `360p / 18fps`
- iOS auf unsicherem HTTP faellt in den aktuellen Sicherheits-/Fallback-Pfad
- wenn Gegnerton wegen Autoplay blockiert wird, kann der Nutzer `Audio freigeben` ausloesen

## Hosting / HTTPS

Fuer Netlify liegt jetzt eine kleine Basis-Konfiguration in [netlify.toml](/c:/Users/Svenja/Desktop/Dartapp/ocramtracker/netlify.toml):

- `Permissions-Policy` fuer Kamera und Mikrofon
- `no-store` fuer Runtime-Konfigurationsdateien

Damit werden HTTPS-Handytests spaeter berechenbarer, sobald die App ueber Netlify oder eine andere HTTPS-Quelle laeuft.

## Cloudflare + Netlify

Der aktuelle Projektpfad ist jetzt:

1. Frontend ruft `/.netlify/functions/cloudflare-turn-credentials`
2. Netlify Function fragt Cloudflare nach kurzlebigen `iceServers`
3. `OnlineVideoService` verwendet diese bevorzugt fuer `RTCPeerConnection`

Fuer Netlify werden diese Env Vars benoetigt:

- `CLOUDFLARE_TURN_KEY_ID`
- `CLOUDFLARE_TURN_API_TOKEN`
- optional `CLOUDFLARE_TURN_TTL`

Wenn du den TURN-Key ueber das Cloudflare-Dashboard erstellst, brauchst du fuer dieses Projekt vor allem:

- die TURN Key ID
- den TURN API Token / Secret

Die `account_id` ist nur dann zusaetzlich relevant, wenn wir spaeter die TURN-Key-Verwaltung auch automatisiert per API machen wollen.

## Empfohlene Testmatrix

1. Laptop auf `localhost`
   - Kamera verbinden
   - Mikrofon aktivieren
   - Match starten
   - Rejoin testen

2. Handy per HTTPS
   - Kamera verbinden
   - Remote-Audio pruefen
   - Wechsel Front/Back pruefen
   - Overlay im Match testen

3. Zwei verschiedene Netze
   - WLAN gegen Mobilfunk
   - ohne TURN Verhalten pruefen
   - danach mit TURN gegenpruefen
