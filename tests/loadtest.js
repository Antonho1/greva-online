'use strict';

/**
 * loadtest.js — Stress test pentru serverul Greva Banca.
 *
 * Simulează N clienți WebSocket conectați simultan, fiecare făcând:
 * - join cu rol random (90% protester, 10% visitor)
 * - protestatarii trimit chat la intervale aleatorii
 * - rămân conectați până la final
 *
 * Utilizare:
 *   node tests/loadtest.js --users 1000 --url wss://grevabanca.xyz
 *
 * Rulează DE PE ALT SERVER decât producția (sau de pe laptopul tău),
 * altfel testezi împotriva propriilor resurse.
 *
 * Important: setează ulimit -n 50000 ÎNAINTE de a rula testul cu >1000 useri.
 */

const { io } = require('socket.io-client');

// === CLI ARGS ===
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
    const idx = args.indexOf('--' + name);
    return idx >= 0 ? args[idx + 1] : defaultValue;
}

const USERS = parseInt(getArg('users', '500'), 10);
const URL = getArg('url', 'ws://localhost:3000');
const RAMP_UP_MS = parseInt(getArg('rampup', '30000'), 10); // 30s ramp-up
const CHAT_INTERVAL_MIN = 50000;  // chat la fiecare 50-90s (sub cooldown)
const CHAT_INTERVAL_MAX = 90000;
const DURATION_MS = parseInt(getArg('duration', '300000'), 10); // 5 min default

// Mesaje test - mix de OK și înjurături pentru a testa filtrul/shadowban
const TEST_MESSAGES = [
    'Solidaritate cu colegii!',
    'Vrem dreptate pentru toți',
    'Salarii decente!',
    'Nu ne dăm bătuți',
    'Stop concedierilor',
    'BRD respect',
    'Suntem împreună',
    'Forța angajaților',
    // 10% mesaje cu profanitate pentru test shadowban
    'pula mea ce naspa', // ar trebui să fie filtrat
    'cacat de companie',
];

const SIGNS = [
    'vrem_dreptate', 'respectati_angajatii', 'greva_brd',
    'salarii_decente', 'nu_concedierilor', 'solidaritate'
];

// === STATS ===
const stats = {
    connected: 0,
    disconnected: 0,
    failed: 0,
    chatSent: 0,
    chatReceived: 0,
    chatRejected: 0,
    kicked: 0,
    errors: {},
};

function recordError(msg) {
    stats.errors[msg] = (stats.errors[msg] || 0) + 1;
}

// === CLIENT SIMULAT ===
function spawnClient(id) {
    const isVisitor = Math.random() < 0.1; // 10% vizitatori

    const socket = io(URL, {
        transports: ['websocket'],
        reconnection: false, // pentru test, nu vrem reconectări care distorsionează stats
        timeout: 15000,
    });

    let chatTimer = null;

    socket.on('connect', () => {
        stats.connected++;

        const payload = isVisitor
            ? { role: 'visitor' }
            : { role: 'protester', sign: SIGNS[Math.floor(Math.random() * SIGNS.length)] };

        socket.emit('join', payload);

        // Doar protestatarii trimit chat
        if (!isVisitor) {
            scheduleNextChat();
        }
    });

    function scheduleNextChat() {
        const delay = CHAT_INTERVAL_MIN + Math.random() * (CHAT_INTERVAL_MAX - CHAT_INTERVAL_MIN);
        chatTimer = setTimeout(() => {
            if (socket.connected) {
                const msg = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)];
                socket.emit('chat', { text: msg });
                stats.chatSent++;
                scheduleNextChat();
            }
        }, delay);
    }

    socket.on('init_state', () => { /* OK */ });

    socket.on('chat_message', () => {
        stats.chatReceived++;
    });

    socket.on('chat_rejected', () => {
        stats.chatRejected++;
    });

    socket.on('error_kick', (data) => {
        stats.kicked++;
        recordError('kick:' + data.reason);
    });

    socket.on('connect_error', (err) => {
        stats.failed++;
        recordError('connect_error:' + err.message);
    });

    socket.on('disconnect', () => {
        stats.disconnected++;
        if (chatTimer) clearTimeout(chatTimer);
    });

    return socket;
}

// === RAMP UP ===
const sockets = [];
const spawnInterval = RAMP_UP_MS / USERS;

console.log(`[LoadTest] Conectare ${USERS} clienți pe ${RAMP_UP_MS / 1000}s către ${URL}`);
console.log(`[LoadTest] Spawn rate: ${(1000 / spawnInterval).toFixed(1)} clienți/s`);

let spawned = 0;
const spawnTimer = setInterval(() => {
    if (spawned >= USERS) {
        clearInterval(spawnTimer);
        console.log('[LoadTest] Toți clienții lansați. Test rulează...');
        return;
    }
    sockets.push(spawnClient(spawned));
    spawned++;
}, spawnInterval);


// === STATS PERIODIC ===
const statsTimer = setInterval(() => {
    console.log(
        `[STATS] connected=${stats.connected} ` +
        `disconnected=${stats.disconnected} ` +
        `failed=${stats.failed} ` +
        `chat_sent=${stats.chatSent} ` +
        `chat_recv=${stats.chatReceived} ` +
        `chat_rejected=${stats.chatRejected} ` +
        `kicked=${stats.kicked}`
    );
}, 5000);


// === FINAL ===
setTimeout(() => {
    clearInterval(statsTimer);
    clearInterval(spawnTimer);
    console.log('\n========== REZULTATE FINALE ==========');
    console.log(JSON.stringify(stats, null, 2));
    console.log('======================================\n');
    console.log('Deconectare clienți...');
    sockets.forEach(s => s.disconnect());
    setTimeout(() => process.exit(0), 2000);
}, DURATION_MS);


// Cleanup la Ctrl+C
process.on('SIGINT', () => {
    console.log('\n[LoadTest] Întrerupt. Deconectare...');
    sockets.forEach(s => s.disconnect());
    setTimeout(() => process.exit(0), 1000);
});