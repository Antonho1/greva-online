/*
 * active-action.js — Detectează greva/pichetarea/protestul activ acum
 * sau în următoarele 24h și actualizează titlurile site-ului dinamic.
 */

(function () {
    'use strict';

    const TIP_LABELS = {
        'greva': 'Grevă',
        'pichetare': 'Pichetare',
        'protest': 'Protest'
    };

    const TIP_PREPOZITIE = {
        'greva': 'la',
        'pichetare': 'la',
        'protest': 'pentru'
    };

    // Timpul în viitor pentru care considerăm "iminent" (în ms)
    const LOOKAHEAD_MS = 24 * 60 * 60 * 1000; // 24h

    async function loadGreve() {
        try {
            const res = await fetch('/data/greve.json?t=' + Date.now());
            if (!res.ok) return null;
            const data = await res.json();
            return data.greve || [];
        } catch (e) {
            console.warn('Nu am putut încărca greve.json:', e);
            return null;
        }
    }

    function getActionInWindow(greve) {
        const now = new Date();
        let bestActive = null;       // în desfășurare acum
        let bestUpcoming = null;     // începe în max 24h

        for (const g of greve) {
            // Skip cele cu status_override (deja terminate)
            if (g.status_override === 'castigata' ||
                g.status_override === 'compromis' ||
                g.status_override === 'pierduta') {
                continue;
            }

            // Construim datetime start și end
            const startStr = g.data_start + 'T' + (g.ora_start || '00:00') + ':00';
            const endDate = g.data_end || g.data_start;
            const endTime = g.ora_end || '23:59';
            const endStr = endDate + 'T' + endTime + ':59';

            const start = new Date(startStr);
            const end = new Date(endStr);

            if (isNaN(start) || isNaN(end)) continue;

            // Prioritate 1: în desfășurare ACUM
            if (now >= start && now <= end) {
                if (!bestActive || start < bestActive._start) {
                    bestActive = { ...g, _start: start, _end: end };
                }
            }
            // Prioritate 2: începe în următoarele 24h
            else if (start > now && (start - now) <= LOOKAHEAD_MS) {
                if (!bestUpcoming || start < bestUpcoming._start) {
                    bestUpcoming = { ...g, _start: start, _end: end };
                }
            }
        }

        // Returnăm prioritar greva activă, apoi cea iminentă
        return bestActive || bestUpcoming || null;
    }


    function formatTimeRemaining(action) {
        const now = new Date();

        // Dacă e activă acum → cât mai durează până la sfârșit
        if (now >= action._start && now <= action._end) {
            const diff = action._end - now;
            return 'se termină în ' + humanizeDuration(diff);
        }

        // Dacă urmează → cât până începe
        if (action._start > now) {
            const diff = action._start - now;
            return 'începe în ' + humanizeDuration(diff);
        }

        return '';
    }

    function humanizeDuration(ms) {
        const totalMin = Math.floor(ms / 60000);
        const hours = Math.floor(totalMin / 60);
        const mins = totalMin % 60;

        if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h`;
        if (mins > 0) return `${mins}m`;
        return 'sub 1 minut';
    }

    function formatTitle(action) {
        if (!action) return null;
        const tipLabel = TIP_LABELS[action.tip] || 'Acțiune';
        const prep = TIP_PREPOZITIE[action.tip] || 'la';
        return `${tipLabel} ${prep} ${action.companie}`;
    }

function applyToPage(action) {
        const banner = document.getElementById('action-banner');

        if (!action) {
            // Niciun protest activ → ascunde banner-ul, lasă titlurile default
            if (banner) banner.style.display = 'none';
            return;
        }

        const dynamicTitle = formatTitle(action);

        // Update <title> (tab browser și Google)
        document.title = dynamicTitle + ' - Greva Online';

        // Update H1 dacă există elementul .dynamic-title
        const h1 = document.querySelector('.dynamic-title');
        if (h1) {
            h1.textContent = dynamicTitle;
        }

        // Update banner-ul de pe lac
        if (banner) {
            const tipIcon = {
                'greva': '🚫',
                'pichetare': '✊',
                'protest': '📢'
            }[action.tip] || '✊';

            banner.querySelector('.action-banner-icon').textContent = tipIcon;
            const timeRemaining = formatTimeRemaining(action);
            banner.querySelector('.action-banner-text').textContent =
                timeRemaining ? `${dynamicTitle} · ${timeRemaining}` : dynamicTitle;
            banner.style.display = 'flex';
        }

        // Update <meta name="description">
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content',
                `${dynamicTitle} - protest pașnic digital. Solidaritate cu angajații.`);
        }

        // Update Open Graph (pentru Facebook, WhatsApp, Twitter când se distribuie link-ul)
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', dynamicTitle);

        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content',
            `Solidaritate cu angajații din ${action.companie}. Intră în protestul digital.`);

        // Salvăm pentru ca alte module să poată folosi
        window.ACTIVE_ACTION = action;
    }

    // Rulează la încărcarea paginii
    document.addEventListener('DOMContentLoaded', async () => {
        const greve = await loadGreve();
        if (!greve) return;

        const action = getActionInWindow(greve);
        applyToPage(action);

        // Re-verifică la fiecare 5 minute (în caz că greva se termină / începe alta)
        setInterval(async () => {
            const refreshGreve = await loadGreve();
            if (refreshGreve) {
                const refreshAction = getActionInWindow(refreshGreve);
                applyToPage(refreshAction);
            }
        }, 60 * 1000);
    });
})();
