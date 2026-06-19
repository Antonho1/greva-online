/*
 * chat.js — Input chat + bule deasupra rățuștelor.
 *
 * UI cooldown: countdown vizibil cât trebuie să aștepte userul.
 * Toată validarea reală e pe server — aici e doar UX.
 */

(function () {
    'use strict';

    const Chat = {

        cooldownTimer: null,
        lastSendAt: 0,

        init() {
            const form = document.getElementById('chat-form');
            const input = document.getElementById('chat-input');

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this._send(input.value);
            });

            // Pe mobile: când utilizatorul închide tastatura, blur input
            input.addEventListener('blur', () => {
                window.scrollTo(0, 0); // fix iOS scroll bug
            });
        },

        _send(text) {
            text = (text || '').trim();
            if (text.length === 0) return;

            // Verificare cooldown client-side (anti-spam UI, serverul e definitiv)
            const now = Date.now();
            const elapsed = (now - this.lastSendAt) / 1000;
            if (elapsed < window.GREVA_CONFIG.CHAT_COOLDOWN_SECONDS) {
                this._showCooldown(window.GREVA_CONFIG.CHAT_COOLDOWN_SECONDS - elapsed);
                return;
            }

            // Trunchiere defensivă
            if (text.length > window.GREVA_CONFIG.CHAT_MAX_LENGTH) {
                text = text.substring(0, window.GREVA_CONFIG.CHAT_MAX_LENGTH);
            }

            window.SocketClient.sendChat(text);

            // Marchează imediat ca trimis (chiar dacă serverul îl respinge,
            // userul nu spam-uie tasta send).
            this.lastSendAt = now;
            document.getElementById('chat-input').value = '';
            this._showCooldown(window.GREVA_CONFIG.CHAT_COOLDOWN_SECONDS);
        },

        handleIncomingMessage(data) {
            // Afișează bula deasupra rățuștei expeditorului
            window.Game.showBubble(data.id, data.text);
        },

        handleRejection(data) {
            // Serverul ne-a refuzat un mesaj. Sincronizăm UI-ul cu adevărul.
            if (data.reason === 'cooldown') {
                this._showCooldown(window.GREVA_CONFIG.CHAT_COOLDOWN_SECONDS);
            }
        },

        _showCooldown(seconds) {
            seconds = Math.ceil(seconds);
            const wrapper = document.getElementById('chat-cooldown');
            const timer = document.getElementById('cooldown-timer');
            const input = document.getElementById('chat-input');
            const sendBtn = document.querySelector('.chat-send');

            wrapper.hidden = false;
            input.disabled = true;
            sendBtn.disabled = true;

            let remaining = seconds;
            timer.textContent = remaining;

            if (this.cooldownTimer) clearInterval(this.cooldownTimer);

            this.cooldownTimer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(this.cooldownTimer);
                    this.cooldownTimer = null;
                    wrapper.hidden = true;
                    input.disabled = false;
                    sendBtn.disabled = false;
                    input.focus();
                } else {
                    timer.textContent = remaining;
                }
            }, 1000);
        },
    };

    window.Chat = Chat;
})();