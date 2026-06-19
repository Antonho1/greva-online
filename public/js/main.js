/*
 * main.js — Orchestrare: bootstrap aplicație, scene manager, state global.
 */

(function () {
    'use strict';

    // === STATE GLOBAL ===
    window.GREVA_STATE = {
        role: null,   // 'visitor' | 'protester'
        sign: null,   // id pancartă (doar pentru protester)
    };

    // === SCENE MANAGER ===
    // Comutare între cele 3 ecrane (welcome → signs → game)
    const SceneManager = {
        current: 'welcome',

        show(name) {
            const all = document.querySelectorAll('.scene');
            all.forEach(s => s.classList.remove('active'));
            const target = document.getElementById('scene-' + name);
            if (target) {
                target.classList.add('active');
                this.current = name;
            }
        },
    };
    window.SceneManager = SceneManager;

    // === BOOTSTRAP ===
    document.addEventListener('DOMContentLoaded', () => {
        window.Welcome.init();
        window.Signs.init();
        window.Game.init();
        window.Chat.init();


        // Prevenire zoom accidental pe mobile (double-tap)
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        // Prevenire pinch-zoom
        document.addEventListener('gesturestart', (e) => e.preventDefault());
    });

    // Tratează unload: dacă userul închide tab-ul, anunță serverul curat
    // (browserul închide WebSocket-ul, dar asta e o curtoazie suplimentară).
    window.addEventListener('beforeunload', () => {
        if (window.SocketClient && window.SocketClient.socket) {
            window.SocketClient.socket.close();
        }
    });
})();