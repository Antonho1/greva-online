/*
 * socket-client.js — Wrapper peste Socket.io.
 *
 * Responsabilități:
 * - Conectare cu rolul ales + pancarta (dacă e cazul)
 * - Reconectare automată cu backoff
 * - Routing evenimentelor către modulele potrivite (game, chat)
 * - Gestiune stare conexiune (UI status dot)
 */

(function () {
    'use strict';

    const SocketClient = {

        socket: null,
        isConnected: false,

        connect() {
            if (this.socket) {
                // Deja conectat sau încercăm reconect — nu suprapunem
                return;
            }

            this.socket = io(window.GREVA_CONFIG.SOCKET_URL, {
                // Doar WebSocket — match cu serverul
                transports: ['websocket'],

                // Reconectare automată
                reconnection: true,
                reconnectionAttempts: Infinity,
                // Backoff exponențial cu jitter:
                // 1s → 2s → 4s → 8s → max 20s
                reconnectionDelay: 1000,
                reconnectionDelayMax: 20000,
                randomizationFactor: 0.5,

                // Timeout conectare inițială
                timeout: 10000,
            });

            this._bindEvents();
        },

        _bindEvents() {
            const s = this.socket;

            // === CONECTARE ===
            s.on('connect', () => {
                this.isConnected = true;
                this._setStatus('connected');

                // Trimite "join" cu rolul + pancarta
                const payload = { role: window.GREVA_STATE.role };
                if (window.GREVA_STATE.role === 'protester') {
                    payload.sign = window.GREVA_STATE.sign;
                }
                s.emit('join', payload);
            });

            // === DECONECTARE ===
            s.on('disconnect', (reason) => {
                this.isConnected = false;
                this._setStatus('disconnected');
                console.log('[Socket] Disconnected:', reason);

                // Pentru disconnect inițiat de server, NU reconectăm automat
                if (reason === 'io server disconnect') {
                    this.socket = null;
                }
            });

            s.on('connect_error', (err) => {
                console.warn('[Socket] Connect error:', err.message);
                this._setStatus('disconnected');
            });

            // === KICK FROM SERVER ===
            s.on('error_kick', (data) => {
                this._showKickModal(data.reason);
                this.socket.disconnect();
                this.socket = null;
            });

            s.on('server_shutdown', () => {
                this._showModal(
                    'Server în mentenanță',
                    'Serverul se restartează. Aplicația se va reconecta automat.',
                    null
                );
            });

            // === STATE INIȚIAL ===
            s.on('init_state', (data) => {
                window.Game.handleInitState(data);
            });

            // === EVENIMENTE LIVE ===
            s.on('player_joined', (data) => {
                window.Game.handlePlayerJoined(data);
            });

            s.on('player_left', (data) => {
                window.Game.handlePlayerLeft(data);
            });

            s.on('chat_message', (data) => {
                window.Chat.handleIncomingMessage(data);
            });

            s.on('chat_rejected', (data) => {
                window.Chat.handleRejection(data);
            });
        },

        // Trimitere mesaj chat
        sendChat(text) {
            if (!this.isConnected) return;
            this.socket.emit('chat', { text });
        },

        // === UI HELPERS ===

        _setStatus(state) {
            const el = document.getElementById('connection-status');
            if (!el) return;
            const textEl = el.querySelector('.status-text');
            if (state === 'connected') {
                el.classList.remove('disconnected');
                textEl.textContent = 'Conectat';
            } else {
                el.classList.add('disconnected');
                textEl.textContent = 'Reconectare...';
            }
        },

        _showKickModal(reason) {
            const messages = {
                server_full: 'Serverul e plin. Te rugăm să încerci în câteva minute.',
                too_many_from_ip: 'Prea multe conexiuni de la aceeași adresă IP.',
                visitors_full: 'Locurile pentru vizitatori sunt epuizate.',
                protesters_full: 'Locurile pentru protestatari sunt epuizate. Poți intra ca vizitator.',
                invalid_sign: 'Pancartă invalidă.',
                invalid_role: 'Rol invalid.',
                invalid_payload: 'Eroare de comunicare.',
            };
            this._showModal(
                'Conexiune închisă',
                messages[reason] || 'Conexiunea a fost închisă.',
                () => window.location.reload()
            );
        },

        _showModal(title, message, onAction) {
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-message').textContent = message;
            const btn = document.getElementById('modal-action');
            btn.onclick = onAction || (() => {
                document.getElementById('modal').hidden = true;
            });
            document.getElementById('modal').hidden = false;
        },
    };

    window.SocketClient = SocketClient;
})();