'use strict';

/**
 * index.js — Punct de intrare al serverului Greva Banca.
 *
 * Arhitectură:
 * - HTTP server nativ (NU Express) — minim overhead.
 * - Caddy servește static-urile, deci serverul ăsta răspunde doar
 *   la upgrade-urile WebSocket. Endpoint-ul HTTP returnează 426
 *   pentru orice request non-WS.
 * - Socket.io configurat pentru concurență mare:
 *     • doar WebSocket (fără polling fallback — economie bandwidth)
 *     • perMessageDeflate dezactivat (CPU > bandwidth pe payload-uri mici)
 *     • ping intervals mărite (vezi config.js)
 *
 * Optimizări critice:
 * - Broadcast diferențiat: vizitatorii primesc updates de poziții la
 *   conectare, dar NU primesc heartbeat-uri continue (nu se mișcă nimic).
 * - Mesajele de chat sunt rebroadcast doar dacă userul nu e shadowbanned.
 * - Toate validările sunt server-side. Clientul e mereu suspect.
 */

const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const PlayerRegistry = require('./playerRegistry');
const PositionAllocator = require('./positionAllocator');
const RateLimiter = require('./rateLimiter');
const { filterMessage } = require('./profanityFilter');

let secrets = {};
try {
    secrets = require('./secrets');
} catch (e) {
    console.warn('[Discord] secrets.js lipsește - notificările Discord dezactivate');
}

// === INIȚIALIZARE ===
// === API ÎNSCRIERI ===
// Înscrierile sunt salvate ca JSON Lines (o linie per înregistrare).
// Le verifici manual cu: cat /home/antonho/caddy/greva/data/inscrieri-pending.jsonl
const INSCRIERI_FILE = path.join(__dirname, '../data/inscrieri-pending.jsonl');

// Rate limit per IP (anti-spam form)
const apiRateLimit = new Map();
const API_COOLDOWN_MS = 30000; // 30 secunde între submit-uri per IP

const registry = new PlayerRegistry();
const allocator = new PositionAllocator();
const limiter = new RateLimiter(registry);

// Path la fișierul cu înscrieri pending (manual approval)
const PENDING_FILE = path.join(__dirname, '../data/inscrieri-pending.jsonl');

// Asigură-te că folderul există
const dataDir = path.dirname(PENDING_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const httpServer = http.createServer((req, res) => {

    // ====== HEALTH CHECK ======
    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            players: registry.size,
            protesters: registry.countByRole('protester'),
            visitors: registry.countByRole('visitor'),
            uptime: process.uptime(),
            memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        }));
        return;
    }

    // ====== API: ÎNSCRIERE GREVĂ ======
    if (req.url === '/api/inscriere' && req.method === 'POST') {

        // Identifică IP-ul (prin Cloudflare)
        const ip = req.headers['cf-connecting-ip'] ||
                   (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
                   req.socket.remoteAddress;

        // Rate limit
        const now = Date.now();
        const lastSubmit = apiRateLimit.get(ip) || 0;
        if (now - lastSubmit < API_COOLDOWN_MS) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Prea multe trimiteri. Așteaptă 30 secunde.' }));
            return;
        }

        // Citim body-ul
        let body = '';
        let totalSize = 0;
        const MAX_BODY = 10 * 1024; // 10KB

        req.on('data', chunk => {
            totalSize += chunk.length;
            if (totalSize > MAX_BODY) {
                req.destroy();
                return;
            }
            body += chunk;
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);

                // Validare câmpuri obligatorii
                const required = ['companie','tip', 'sector', 'data_start', 'locatie', 'motiv', 'contact_email'];
                for (const field of required) {
                    if (!data[field] || typeof data[field] !== 'string' || data[field].trim().length === 0) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: `Câmp obligatoriu lipsă: ${field}` }));
                        return;
                    }
                }

                // Validare email
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Email invalid' }));
                    return;
                }

                // Sanitizare + limitare lungime
                const clean = {
                    timestamp: new Date().toISOString(),
                    ip: ip,
                    companie: data.companie.substring(0, 100).trim(),
                    tip: (data.tip || 'greva').substring(0, 20),
                    sector: data.sector.substring(0, 50).trim(),
                    data_start: data.data_start.substring(0, 20),
                    data_end: (data.data_end || '').substring(0, 20),
                    ora_start: (data.ora_start || '').substring(0, 10),
                    ora_end: (data.ora_end || '').substring(0, 10),
                    locatie: data.locatie.substring(0, 200).trim(),
                    motiv: data.motiv.substring(0, 500).trim(),
                    organizator: (data.organizator || '').substring(0, 100).trim(),
                    site: (data.site || '').substring(0, 200).trim(),
                    contact_email: data.contact_email.substring(0, 100).trim(),
                };

                // Salvează linie cu linie (append - sigur, nu rescrie fișierul)
                fs.appendFileSync(INSCRIERI_FILE, JSON.stringify(clean) + '\n');

                apiRateLimit.set(ip, now);

                // Loghăm doar primii octeți ai IP-ului pentru debug, nu IP-ul complet
                const anonIp = ip.includes(':') 
                    ? ip.split(':').slice(0, 3).join(':') + ':xxx' 
                    : ip.replace(/\.\d+$/, '.xxx');
                console.log(`[INSCRIERE] ${clean.companie} de la ${anonIp}`);
                // Trimite notificare pe Discord (async, nu blochează răspunsul)
                notifyDiscord(clean);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));

            } catch (err) {
                console.error('[API ERROR]', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Date invalide' }));
            }
        });
        return;
    }

    // ====== ORICE ALTCEVA ======
    // 426 Upgrade Required - pentru WebSocket
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('Upgrade Required');
});

// Cleanup periodic la rate limit map (după 5 min, intrarea expiră)
setInterval(() => {
    const now = Date.now();
    for (const [ip, ts] of apiRateLimit) {
        if (now - ts > 5 * 60 * 1000) apiRateLimit.delete(ip);
    }
}, 60000);


const io = new Server(httpServer, {
    // Doar WebSocket — fără polling fallback.
    // Polling = mult mai mult overhead (HTTP request per mesaj).
    transports: ['websocket'],

    // Ping/pong rar — economie bandwidth.
    pingInterval: config.PING_INTERVAL_MS,
    pingTimeout: config.PING_TIMEOUT_MS,

    // Limită dimensiune mesaj (anti-DOS).
    maxHttpBufferSize: config.MAX_HTTP_BUFFER_SIZE,

    // perMessageDeflate: dezactivat.
    // Pe payload-uri mici (<100 bytes — chat, coords), compresia costă
    // mai mult CPU decât economisește bandwidth.
    perMessageDeflate: false,

    // CORS — în prod, Caddy face proxy de pe același host, deci nu e
    // problemă. Dacă vrei să restrângi, pune origin: 'https://greva.online'.
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? 'https://greva.online'
            : '*',
    },

    // serveClient: false — nu servim noi socket.io.js, îl pune Caddy
    // din node_modules direct sau îl bagi în public/.
    serveClient: false,
});


// === HELPERS ===

/**
 * Extrage IP-ul real ținând cont de Cloudflare + Caddy reverse proxy.
 * Header-ul "cf-connecting-ip" e setat de Cloudflare; "x-forwarded-for"
 * de Caddy. Fallback la handshake.address.
 */
function getRealIp(socket) {
    const headers = socket.handshake.headers;
    return (
        headers['cf-connecting-ip'] ||
        (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        socket.handshake.address ||
        'unknown'
    );
}

async function notifyDiscord(inscriere) {
    if (!secrets.DISCORD_WEBHOOK_URL) return;

    const tipEmoji = {
        'greva': '🚫',
        'pichetare': '✊',
        'protest': '📢'
    }[inscriere.tip] || '✊';

    const tipLabel = {
        'greva': 'Grevă',
        'pichetare': 'Pichetare',
        'protest': 'Protest'
    }[inscriere.tip] || 'Acțiune';

    // Construim mesajul ca embed Discord (frumos formatat)
    const embed = {
        title: `${tipEmoji} Înscriere nouă: ${tipLabel} la ${inscriere.companie}`,
        color: 0xffc800, // galben
        fields: [
            { name: '🏢 Companie', value: inscriere.companie || '-', inline: true },
            { name: '📋 Tip', value: tipLabel, inline: true },
            { name: '🏭 Sector', value: inscriere.sector || '-', inline: true },
            { name: '📅 Data', value: (inscriere.data_start || '-') + (inscriere.data_end ? ' → ' + inscriere.data_end : ''), inline: true },
            { name: '🕐 Ore', value: (inscriere.ora_start || '-') + (inscriere.ora_end ? ' - ' + inscriere.ora_end : ''), inline: true },
            { name: '📍 Locație', value: inscriere.locatie || '-', inline: false },
            { name: '💬 Motiv', value: (inscriere.motiv || '-').substring(0, 500), inline: false },
            { name: '👥 Organizator', value: inscriere.organizator || '(nespecificat)', inline: true },
            { name: '🔗 Site', value: inscriere.site || '(fără)', inline: true },
            { name: '📧 Contact', value: inscriere.contact_email || '-', inline: false }
        ],
        footer: { text: 'Aprobă pe server cu: ~/shgreva/aproba.sh' },
        timestamp: new Date().toISOString()
    };

    try {
        const res = await fetch(secrets.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: '🔔 **Înscriere nouă de verificat!**',
                embeds: [embed]
            })
        });
        if (!res.ok) {
            console.warn('[Discord] Webhook a returnat', res.status);
        } else {
            console.log('[Discord] Notificare trimisă');
        }
    } catch (e) {
        console.warn('[Discord] Eroare la trimitere:', e.message);
    }
}

/**
 * Validează pancarta — userul nu poate trimite string arbitrar.
 */
function isValidSign(sign) {
    return typeof sign === 'string' && config.VALID_SIGNS.includes(sign);
}

/**
 * Verifică dacă un user poate scrie acum (cooldown respectat).
 */
function canChat(player) {
    const now = Date.now();
    const elapsed = (now - (player.lastChatAt || 0)) / 1000;
    return elapsed >= config.CHAT_COOLDOWN_SECONDS;
}

/**
 * Înregistrează un strike de înjurătură și verifică dacă utilizatorul
 * trebuie shadowbanned.
 *
 * @returns {boolean} true dacă tocmai a fost shadowbanned
 */
function recordProfanityStrike(player) {
    const now = Date.now();
    // Păstrează doar strike-urile din fereastra activă
    player.profanityStrikes = player.profanityStrikes.filter(
        ts => now - ts < config.SHADOWBAN_WINDOW_MS
    );
    player.profanityStrikes.push(now);

    if (
        !player.isShadowbanned &&
        player.profanityStrikes.length >= config.SHADOWBAN_STRIKE_THRESHOLD
    ) {
        player.isShadowbanned = true;
        return true;
    }
    return false;
}


// === HANDLER PRINCIPAL CONEXIUNE ===

io.on('connection', (socket) => {

    const ip = getRealIp(socket);

    // --- VERIFICĂRI INIȚIALE ---

    // 1. Limită globală
    if (registry.size >= config.MAX_PLAYERS_TOTAL) {
        socket.emit('error_kick', { reason: 'server_full' });
        socket.disconnect(true);
        return;
    }

    // 2. Limită per IP (anti-flood)
    if (!limiter.canConnect(ip)) {
        socket.emit('error_kick', { reason: 'too_many_from_ip' });
        socket.disconnect(true);
        return;
    }


    /**
     * Pasul 1 al conexiunii: clientul trimite "join" cu rolul ales
     * (visitor/protester) și, dacă e protester, pancarta aleasă.
     *
     * NU permitem două "join"-uri pe același socket (anti race-condition).
     */
    let hasJoined = false;

    socket.on('join', (data) => {

        if (hasJoined) {
            // Client buggy sau malițios — ignorăm.
            return;
        }

        // Validare payload
        if (!data || typeof data !== 'object') {
            socket.emit('error_kick', { reason: 'invalid_payload' });
            socket.disconnect(true);
            return;
        }

        const { role, sign } = data;

        // --- VIZITATOR ---
        if (role === 'visitor') {
            if (registry.countByRole('visitor') >= config.MAX_VISITORS) {
                socket.emit('error_kick', { reason: 'visitors_full' });
                socket.disconnect(true);
                return;
            }

            const player = {
                socketId: socket.id,
                role: 'visitor',
                ip,
                connectedAt: Date.now(),
                // vizitatorii nu au x, y, sign, chat — economie de memorie
            };
            registry.add(player);
            hasJoined = true;

            // Trimite state-ul curent al protestului
            socket.emit('init_state', {
                role: 'visitor',
                protesters: registry.getProtestersPublicState(),
                counts: {
                    protesters: registry.countByRole('protester'),
                    visitors: registry.countByRole('visitor'),
                },
            });

            // Vizitatorul NU se anunță altora — e fantomă.
            return;
        }

        // --- PROTESTATAR ---
        if (role === 'protester') {

            // Verifică limită protestatari
            const protesterCount = registry.countByRole('protester');
            if (protesterCount >= config.MAX_PROTESTERS) {
                socket.emit('error_kick', { reason: 'protesters_full' });
                socket.disconnect(true);
                return;
            }

            // Validare pancartă
            if (!isValidSign(sign)) {
                socket.emit('error_kick', { reason: 'invalid_sign' });
                socket.disconnect(true);
                return;
            }

            // Alocă poziție
            const pos = allocator.allocate(socket.id, protesterCount);

            const player = {
                socketId: socket.id,
                role: 'protester',
                x: pos.x,
                y: pos.y,
                sign,
                lastChatAt: 0,
                profanityStrikes: [],
                isShadowbanned: false,
                ip,
                connectedAt: Date.now(),
            };
            registry.add(player);
            hasJoined = true;

            // Trimite state-ul curent CĂTRE acest nou jucător
            socket.emit('init_state', {
                role: 'protester',
                me: { id: socket.id, x: pos.x, y: pos.y, sign },
                protesters: registry.getProtestersPublicState(),
                counts: {
                    protesters: registry.countByRole('protester'),
                    visitors: registry.countByRole('visitor'),
                },
            });

            // Anunță TOȚI ceilalți că s-a alăturat un nou protestatar
            // (inclusiv vizitatorii — ei urmăresc protestul).
            socket.broadcast.emit('player_joined', {
                id: socket.id,
                x: pos.x,
                y: pos.y,
                sign,
            });

            return;
        }

        // Rol invalid
        socket.emit('error_kick', { reason: 'invalid_role' });
        socket.disconnect(true);
    });


    /**
     * Handler chat. Aplică:
     * 1. Cooldown server-side
     * 2. Validare lungime
     * 3. Filtru înjurături
     * 4. Logica shadowban
     */
    socket.on('chat', (data) => {

        const player = registry.get(socket.id);
        if (!player || player.role !== 'protester') {
            // Vizitatorii nu pot vorbi. Tăcere completă.
            return;
        }

        if (!data || typeof data.text !== 'string') return;

        let text = data.text.trim();
        if (text.length === 0) return;
        if (text.length > config.CHAT_MAX_LENGTH) {
            text = text.substring(0, config.CHAT_MAX_LENGTH);
        }

        // Cooldown
        if (!canChat(player)) {
            socket.emit('chat_rejected', { reason: 'cooldown' });
            return;
        }

        // Filtrare
        const { filtered, wasFiltered } = filterMessage(text);

        if (wasFiltered) {
            const justBanned = recordProfanityStrike(player);
            if (justBanned) {
                // Nu îi spunem că e shadowbanned — asta e ideea.
                console.log(`[SHADOWBAN] socket=${socket.id} ip=${player.ip}`);
            }
        }

        // Actualizează timestamp-ul de cooldown (chiar și pentru mesaje filtrate)
        player.lastChatAt = Date.now();

        const payload = {
            id: socket.id,
            text: filtered,
            at: Date.now(),
        };

        if (player.isShadowbanned) {
            // Shadowban: doar EL își vede mesajul. Restul lumii — nimic.
            socket.emit('chat_message', payload);
        } else {
            // Broadcast normal — toți (inclusiv el).
            io.emit('chat_message', payload);
        }
    });


    /**
     * Deconectare.
     */
    socket.on('disconnect', () => {

        const player = registry.remove(socket.id);
        if (!player) return;

        // Eliberează slotul de grid dacă era protestatar
        if (player.role === 'protester') {
            allocator.release(socket.id);

            // Anunță restul că a plecat un protestatar
            socket.broadcast.emit('player_left', { id: socket.id });
        }
    });


    // Capturăm orice eroare per socket ca să nu doboare procesul
    socket.on('error', (err) => {
        console.error(`[Socket Error] ${socket.id}: ${err.message}`);
    });
});


// === STATS LOG PERIODIC ===
// Util pentru monitorizare manuală. La 5000 useri vrei să știi
// că serverul respiră.

if (process.env.NODE_ENV !== 'production' || process.env.STATS === '1') {
    setInterval(() => {
        const mem = process.memoryUsage();
        console.log(
            `[STATS] players=${registry.size} ` +
            `protesters=${registry.countByRole('protester')} ` +
            `visitors=${registry.countByRole('visitor')} ` +
            `slots=${JSON.stringify(allocator.stats())} ` +
            `rss=${Math.round(mem.rss / 1024 / 1024)}MB ` +
            `heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB`
        );
    }, 30000);
    
    setInterval(() => {
    const now = Date.now();
    for (const [ip, ts] of apiRateLimit) {
        if (now - ts > 5 * 60 * 1000) apiRateLimit.delete(ip);
    }
}, 60000);
}


// === SHUTDOWN ELEGANT ===
// Important pentru deploy-uri: clienții primesc un eveniment de
// shutdown ca să poată reconecta automat după restart.

function gracefulShutdown(signal) {
    console.log(`[Shutdown] Received ${signal}, closing server...`);
    io.emit('server_shutdown', { reason: 'restart' });

    setTimeout(() => {
        io.close(() => {
            httpServer.close(() => {
                console.log('[Shutdown] Done.');
                process.exit(0);
            });
        });
    }, 1000); // dă 1s clienților să primească mesajul
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Erori uncaught — log, nu crash.
process.on('uncaughtException', (err) => {
    console.error('[UncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
    console.error('[UnhandledRejection]', err);
});


// === START ===

httpServer.listen(config.PORT, '127.0.0.1', () => {
    console.log(`[GrevaBRD] Server pornit pe 127.0.0.1:${config.PORT}`);
    console.log(`[GrevaBRD] Limită: ${config.MAX_PLAYERS_TOTAL} useri (${config.MAX_PROTESTERS} protestatari + ${config.MAX_VISITORS} vizitatori)`);
});