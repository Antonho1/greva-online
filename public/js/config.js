/*
 * config.js — Constante client. TREBUIE sincronizate cu server/config.js.
 *
 * Le folosim doar pentru UI feedback (countdown, validări preliminare).
 * Serverul rămâne sursa de adevăr; clientul e mereu suspect.
 */

window.GREVA_CONFIG = {
    // Trebuie să fie aceeași valoare cu server/config.js
    CHAT_COOLDOWN_SECONDS: 30,
    CHAT_MAX_LENGTH: 140,
    CHAT_BUBBLE_DURATION_MS: 7000,

    // Coordonate harta — trebuie să match-uiască serverul
    MAP_WIDTH: 10000,
    MAP_HEIGHT: 10000,

    // Pancarte: id intern → etichetă vizibilă + nume fișier
    SIGNS: [
                { id: 'vrem_dreptate',       label: 'Vrem dreptate!',         file: 'vrem_dreptate.webp' },
                { id: 'respectati_angajatii',label: 'Respectați angajații!',  file: 'respectati_angajatii.webp' },
                { id: 'pichetare_brd',           label: 'Pichetare BRD',          file: 'pichetare_brd.webp' },
                { id: 'salarii_decente',     label: 'Salarii decente!',       file: 'salarii_decente.webp' },
                { id: 'nu_concedierilor',    label: 'Nu concedierilor!',      file: 'nu_concedierilor.webp' },
                { id: 'solidaritate',        label: 'Solidaritate',           file: 'solidaritate.webp' },
         ],


    // URL socket — în prod, host-ul curent (Caddy proxy)
    SOCKET_URL: window.location.protocol === 'https:'
        ? 'wss://' + window.location.host
        : 'ws://' + window.location.host,
};