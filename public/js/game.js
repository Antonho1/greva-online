/*
 * game.js — Render rățuște pe hartă.
 *
 * Optimizări critice (5000 rățuște = 5000 elemente DOM):
 * - Folosim DocumentFragment la init pentru batch insert.
 * - Map<id, element> pentru lookup O(1) la player_left / chat.
 * - Coordonatele server (0–10000) → percent al .ducks-layer.
 *   Transformul %-uri permite browserul să scaleze automat la resize.
 * - NU re-randăm tot la fiecare update; modificăm doar elementele afectate.
 * - Animația de bobbing are delay random per rățușcă (CSS variable) ca
 *   să nu se miște toate sincron — arată ca o gașcă reală.
 */

(function () {
    'use strict';

    const Game = {

        ducksLayer: null,
        ducksById: new Map(), // socketId → element DOM
        myId: null,
        myRole: null,

        init() {
            this.ducksLayer = document.getElementById('ducks-layer');
        },

        // === HANDLERS EVENIMENTE SERVER ===

        handleInitState(data) {
            this.myRole = data.role;

            if (data.role === 'protester') {
                this.myId = data.me.id;
                // Ascunde chat input pentru vizitatori; afișează pentru protestatari
                document.getElementById('chat-container').classList.remove('hidden');
            } else {
                document.getElementById('chat-container').classList.add('hidden');
            }

            // Update counters
            this._updateCounters(data.counts);

            // Randează toate rățuștele existente într-un singur batch
            this._renderInitialDucks(data.protesters);
        },

        handlePlayerJoined(data) {
            // Cineva nou s-a alăturat
            this._addDuck(data, /* spawn animation */ true);
            this._incrementCounter('protester');
        },

        handlePlayerLeft(data) {
            this._removeDuck(data.id);
            this._decrementCounter('protester');
        },

        // === RENDER ===

        _renderInitialDucks(protesters) {
            // Batch insert într-un fragment — un singur reflow
            const frag = document.createDocumentFragment();
            for (const p of protesters) {
                const el = this._createDuckElement(p);
                this.ducksById.set(p.id, el);
                frag.appendChild(el);
            }
            this.ducksLayer.appendChild(frag);
        },

        _addDuck(data, spawn) {
            // Evită duplicate (race condition între init_state și player_joined)
            if (this.ducksById.has(data.id)) return;

            const el = this._createDuckElement(data);
            if (spawn) el.classList.add('spawning');
            this.ducksById.set(data.id, el);
            this.ducksLayer.appendChild(el);
        },

        _removeDuck(id) {
            const el = this.ducksById.get(id);
            if (!el) return;
            this.ducksById.delete(id);

            // Animație de fade-out, apoi remove
            el.classList.add('despawning');
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 300);
        },

        _createDuckElement(data) {
            const duck = document.createElement('div');
            duck.className = 'duck';
            duck.dataset.id = data.id;

            if (data.id === this.myId) {
                duck.classList.add('is-me');
            }

            // Poziționare: x/y server-side sunt 0–MAP_WIDTH/HEIGHT
            // → procente. Apoi translate(-50%, -100%) ca să centrăm
            // baza rățuștei pe coordonata respectivă.
            const xPct = (data.x / window.GREVA_CONFIG.MAP_WIDTH) * 100;
            const yPct = (data.y / window.GREVA_CONFIG.MAP_HEIGHT) * 100;
            duck.style.left = xPct + '%';
            duck.style.top = yPct + '%';
            duck.style.transform = 'translate(-50%, -100%)';

             // Bobbing delay random - rățușca ȘI pancarta au ACELAȘI delay
            // ca să fie sincronizate (rața sare = pancarta se înclină)
           // Bobbing delay random - rățușca ȘI pancarta au ACELAȘI delay
            const bobDelay = (Math.random() * 1.8).toFixed(3);  // 3 zecimale pentru precizie

            const body = document.createElement('div');
            body.className = 'duck-body';
            // Setăm variabila pe duck-ul părinte, NU pe body individual
            duck.style.setProperty('--bob-delay', bobDelay + 's');
            duck.appendChild(body);

            // Pancarta moștenește același --bob-delay
            if (data.sign) {
                const sign = document.createElement('div');
                sign.className = 'duck-sign';
                const signMeta = window.GREVA_CONFIG.SIGNS.find(s => s.id === data.sign);
                if (signMeta) {
                    sign.style.backgroundImage = `url(/assets/signs/${signMeta.file})`;
                }
                duck.appendChild(sign);
            }

            return duck;
        },

        // === CHAT BUBBLES ===

showBubble(socketId, text) {
            const duck = this.ducksById.get(socketId);
            if (!duck) return;

            // Înlocuiește bula existentă a acestui user (dacă e)
            const existingId = 'bubble-' + socketId;
            const existing = document.getElementById(existingId);
            if (existing) existing.remove();

            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble chat-bubble--floating';
            bubble.id = existingId;
            bubble.textContent = text;

            // Poziționăm bula la coordonatele rățuștei (în layer separat)
            // ca să nu fie prinsă de stacking context-ul rățuștei
            bubble.style.left = duck.style.left;
            bubble.style.top = duck.style.top;

            this.ducksLayer.appendChild(bubble);

            setTimeout(() => {
                if (bubble.parentNode) bubble.remove();
            }, window.GREVA_CONFIG.CHAT_BUBBLE_DURATION_MS);
        },

        // === COUNTERS ===

        _updateCounters(counts) {
            document.getElementById('counter-protesters').textContent = counts.protesters;
            document.getElementById('counter-visitors').textContent = counts.visitors;
        },

        _incrementCounter(type) {
            const el = document.getElementById('counter-' + type + 's');
            if (el) el.textContent = (parseInt(el.textContent, 10) || 0) + 1;
        },

        _decrementCounter(type) {
            const el = document.getElementById('counter-' + type + 's');
            if (el) {
                const n = parseInt(el.textContent, 10) || 0;
                el.textContent = Math.max(0, n - 1);
            }
        },
    };

    window.Game = Game;
})();

