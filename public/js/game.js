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
                document.getElementById('chat-container').classList.remove('hidden');
            } else {
                document.getElementById('chat-container').classList.add('hidden');
            }

            // Curăță rățuștele existente (reconectare după sleep/pierdere semnal)
            this.ducksLayer.innerHTML = '';
            this.ducksById.clear();

            this._updateCounters(data.counts);
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

            // Poziționare: zona serverului (ZONE_*) e întinsă peste zona sigură
            // a ecranului, definită de --edge-* în game.css. Așa rățușca și
            // pancarta nu ies din ecran și nu intră sub HUD, nici pe telefon.
            // Apoi translate(-50%, -100%) centrează baza rățuștei pe punct.
            const zone = window.GREVA_CONFIG.ZONE;
            const fx = clamp01((data.x - zone.X_MIN) / (zone.X_MAX - zone.X_MIN));
            const fy = clamp01((data.y - zone.Y_MIN) / (zone.Y_MAX - zone.Y_MIN));
            duck.style.left = `calc(var(--edge-left) + (100% - var(--edge-left) - var(--edge-right)) * ${fx.toFixed(4)})`;
            duck.style.top = `calc(var(--edge-top) + (100% - var(--edge-top) - var(--edge-bottom)) * ${fy.toFixed(4)})`;
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
                sign.dataset.sign = data.sign;
                const signMeta = window.GREVA_CONFIG.SIGNS.find(s => s.id === data.sign);
                // Pancarta „Grevă la ...” primește imaginea din strike-sign.js (regulă CSS)
                if (signMeta && data.sign !== 'greva_la') {
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

            const existingId = 'bubble-' + socketId;
            const existing = document.getElementById(existingId);
            if (existing) existing.remove();

            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble chat-bubble--floating';
            bubble.id = existingId;
            bubble.textContent = text;

            // offsetLeft/offsetTop = punctul rățuștei (centru-jos), fără transform.
            // Scădem înălțimea rățuștei ca să ajungem deasupra capului.
            const layerW = this.ducksLayer.offsetWidth;
            const layerH = this.ducksLayer.offsetHeight;
            const duckH = duck.offsetWidth || 64; // rățușca e pătrată
            const headPx = duck.offsetTop - duckH;

            this.ducksLayer.appendChild(bubble);

            // Bula stă deasupra capului. Animația bubble-life controlează transform-ul
            // (doar -8px pe verticală, cât coada bulei), deci scădem noi înălțimea bulei.
            // Procente, ca să rămână aproximativ la locul ei la resize.
            bubble.style.top = ((headPx - bubble.offsetHeight) / layerH) * 100 + '%';

            // Ținem bula în ecran pe orizontală (rățuștele de la margini)
            const half = bubble.offsetWidth / 2;
            const centerPx = Math.min(Math.max(duck.offsetLeft, half + 4), layerW - half - 4);
            bubble.style.left = (centerPx / layerW) * 100 + '%';

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

    function clamp01(v) {
        return Math.min(1, Math.max(0, v));
    }

    window.Game = Game;
})();

