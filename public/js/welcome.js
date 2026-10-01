/*
 * welcome.js — Logica ecranului de welcome.
 *
 * Foarte simplu: două butoane, două destinații diferite.
 * Vizitatorul sare direct în joc; protestatarul trece prin ecranul de pancarte.
 */

(function () {
    'use strict';

    const Welcome = {

        init() {
            document.getElementById('btn-visitor').addEventListener('click', () => {
                this._chooseVisitor();
            });

            document.getElementById('btn-protester').addEventListener('click', () => {
                this._chooseProtester();
            });
        },

        _chooseVisitor() {
            // Salvăm rolul ales în state-ul global
            window.GREVA_STATE.role = 'visitor';
            // Direct în joc, fără pancartă
            window.SceneManager.show('game');
            window.SocketClient.connect();
        },

        _chooseProtester() {
            window.GREVA_STATE.role = 'protester';
            window.SceneManager.show('signs');
            // Init populare grid pancarte (lazy, doar acum)
            window.Signs.populate();
        },
    };

    window.Welcome = Welcome;
})();