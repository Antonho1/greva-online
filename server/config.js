'use strict';

/**
 * config.js — Toate constantele reglabile ale aplicației.
 *
 * De ce într-un fișier separat?
 * Pentru că pe un server casnic cu 16GB RAM și i7 Gen 11, vei vrea să
 * ajustezi pragurile pe măsură ce vezi cum se comportă serverul sub
 * încărcare reală (1000–5000 useri). Toate "magic numbers" sunt aici.
 */

module.exports = {

    // === REȚEA ===
    PORT: process.env.PORT || 3000,

    // Socket.io ping/pong — tuning critic pentru bandwidth.
    // Default-urile (25s/20s) generează prea mult trafic la 5000 useri.
    // 60s ping interval + 30s timeout = ~2x mai puțin overhead, dar
    // detectează în maxim 90s un client mort.
    PING_INTERVAL_MS: 60000,
    PING_TIMEOUT_MS: 30000,

    // Dimensiune maximă mesaj WebSocket (anti-DOS).
    // 1KB e suficient pentru chat. Orice mai mare = client malițios.
    MAX_HTTP_BUFFER_SIZE: 1024,


    // === LIMITE JUCĂTORI ===

    // Limita superioară absolută. Peste asta, refuzăm conexiuni noi.
    // 5000 e ținta, dar lăsăm puțin headroom.
    MAX_PLAYERS_TOTAL: 7000,

    // Limită vizitatori (ghost mode) — sunt ieftini, dar tot consumă FD-uri.
    MAX_VISITORS: 2000,

    // Limită protestatari (au avatar + pot scrie în chat = mai scumpi).
    MAX_PROTESTERS: 5000,

    // Limită conexiuni simultane per IP (anti-bot/anti-flood).
    // Lăsăm 5 pentru cazuri legitime: familie pe același NAT, mobile+desktop, etc.
    MAX_CONNECTIONS_PER_IP: 1000,


    // === HARTĂ ȘI POZIȚIONARE ===

    // Coordonate logice (0–10000) — independente de rezoluția clientului.
    // Frontend-ul le scalează la viewport. Aleg coordonate "mari" ca să
    // am precizie suficientă fără floating point.
    MAP_WIDTH: 10000,
    MAP_HEIGHT: 10000,

    // Zona permisă pentru rățuște (procente din hartă).
    // Lăsăm margini pentru fundal/UI: gheața nu acoperă tot ecranul.
    ZONE_X_MIN: 800,    // 8% din stânga
    ZONE_X_MAX: 9200,   // 92% din stânga
    ZONE_Y_MIN: 2500,   // 25% de sus (lăsăm cer/banner)
    ZONE_Y_MAX: 9000,   // 90% (lăsăm loc jos pentru UI chat)

    // Dimensiunea efectivă a unei rățuște în coordonate logice.
    // Folosită pentru spacing-ul grid-ului (no-overlap la <100 useri).
    DUCK_LOGICAL_SIZE: 350,

    // Prag până la care folosim grid-ul cu spacing.
    // Peste, comutăm pe random plasare → "mulțime organică".
    // Calculat: zonă efectivă ≈ 8400×6500 ÷ (350*1.2)² ≈ ~120 sloturi.
    // 100 e o țintă conservatoare ca să nu rămânem fără sloturi.
    GRID_SLOTS_THRESHOLD: 100,


    // === CHAT ===

    // Cooldown chat: secunde între mesaje, per user.
    // 45s = mijloc între 30 și 60 (cerință). Server-side enforced.
    CHAT_COOLDOWN_SECONDS: 35,

    // Lungime maximă mesaj. 140 ≈ tweet old-school, generos dar nu abuziv.
    CHAT_MAX_LENGTH: 140,

    // Durată afișare bulă chat (informativ, frontend folosește aceeași valoare).
    CHAT_BUBBLE_DURATION_SECONDS: 7,


    // === MODERARE / SHADOWBAN ===

    // Câte mesaje cu înjurături într-un interval declanșează shadowban.
    SHADOWBAN_STRIKE_THRESHOLD: 3,

    // Fereastra de timp (ms) în care se numără strike-urile.
    SHADOWBAN_WINDOW_MS: 60000, // 1 minut

    // Shadowban-ul e permanent pentru sesiune (până se deconectează).
    // Dacă vrei să fie permanent inter-sesiuni, ai nevoie de DB/Redis.


    // === PANCARTE ===

    // Listă pancarte valide. Frontend afișează grafic, dar serverul
    // VALIDEAZĂ alegerea (nu accepți string-uri arbitrare de la client).
    VALID_SIGNS: [
        'vrem_dreptate',
        'respectati_angajatii',
        'pichetare_brd',
        'salarii_decente',
        'nu_concedierilor',
        'solidaritate'
    ],


    // === LOGGING ===

    // În prod, log doar evenimente importante. console.log() e BLOCANT.
    LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
};