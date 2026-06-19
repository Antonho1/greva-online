/*
 * signs.js — Galeria de pancarte.
 *
 * Populează grid-ul, gestionează selecția și confirmarea.
 */

(function () {
    'use strict';

    const Signs = {

        selectedId: null,
        _populated: false,

        init() {
            document.getElementById('btn-signs-back').addEventListener('click', () => {
                this.selectedId = null;
                window.SceneManager.show('welcome');
            });

            document.getElementById('btn-signs-confirm').addEventListener('click', () => {
                this._confirm();
            });
        },

        populate() {
            if (this._populated) return;
            this._populated = true;

            const grid = document.getElementById('signs-grid');
            const frag = document.createDocumentFragment();

            for (const sign of window.GREVA_CONFIG.SIGNS) {
                const item = document.createElement('button');
                item.className = 'sign-item';
                item.dataset.signId = sign.id;
                item.setAttribute('aria-label', sign.label);

                const img = document.createElement('img');
                img.src = '/assets/signs/' + sign.file;
                img.alt = sign.label;
                // loading="lazy" — dar pentru 6 imagini mici nu contează enorm
                img.loading = 'lazy';

                const label = document.createElement('span');
                label.className = 'sign-item-label';
                label.textContent = sign.label;

                item.appendChild(img);
                item.appendChild(label);

                item.addEventListener('click', () => this._select(sign.id, item));

                frag.appendChild(item);
            }

            grid.appendChild(frag);
        },

        _select(signId, element) {
            this.selectedId = signId;

            // Vizual: marchează doar elementul selectat
            const all = document.querySelectorAll('.sign-item');
            all.forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');

            // Activează butonul de confirmare
            document.getElementById('btn-signs-confirm').disabled = false;
        },

        _confirm() {
            if (!this.selectedId) return;

            window.GREVA_STATE.sign = this.selectedId;
            window.SceneManager.show('game');
            window.SocketClient.connect();
        },
    };

    window.Signs = Signs;
})();