/*
 * calendar.js — Pagina /calendar.
 *
 * - Încarcă /data/greve.json și calculează statusul fiecărei acțiuni.
 * - Filtre după sector și oraș.
 * - Link direct spre fiecare grevă: /calendar#<nume>-<data> (ex: #brd-2026-08-13).
 * - Export în calendarul personal: fișier .ics (Apple, Outlook, Thunderbird)
 *   sau link Google Calendar. Totul se generează în browser, fără server.
 */

(function () {
    'use strict';

    const SITE = 'https://greva.online';
    const TIMEZONE = 'Europe/Bucharest';
    const PAST_STATUSES = ['incheiata', 'castigata', 'pierduta', 'compromis'];
    const ORAS_NESPECIFICAT = 'Nespecificat';
    const ORAS_NATIONAL = 'Național';

    const TIP_LABELS = {
        greva: '🚫 Grevă',
        pichetare: '✊ Pichetare',
        protest: '📢 Protest',
    };
    const TIP_TEXT = { greva: 'Grevă', pichetare: 'Pichetare', protest: 'Protest' };

    const listEl = document.getElementById('greve-list');
    const filtersEl = document.getElementById('calendar-filters');
    const sectorSelect = document.getElementById('filter-sector');
    const orasSelect = document.getElementById('filter-oras');

    let greve = [];

    // === UTILITARE ===

    function escape(s) {
        return (s || '').toString()
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Linkurile din calendar acceptă doar http(s) — blochează javascript: etc.
    function safeUrl(url) {
        try {
            const u = new URL(url);
            if (u.protocol === 'http:' || u.protocol === 'https:') return escape(u.href);
        } catch (e) {}
        return '#';
    }

    function slugify(s) {
        return (s || '').toString()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 40);
    }

    const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const isTime = s => /^\d{2}:\d{2}$/.test(s || '');

    function orasOf(g) {
        return (g.oras || '').trim() || ORAS_NESPECIFICAT;
    }

    function formatDate(start, end) {
        const d1 = new Date(start);
        const months = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const s = `${d1.getDate()} ${months[d1.getMonth()]} ${d1.getFullYear()}`;
        if (end && end !== start) {
            const d2 = new Date(end);
            return `${s} – ${d2.getDate()} ${months[d2.getMonth()]}`;
        }
        return s;
    }

    function formatOra(g) {
        // Suport pentru ambele formate: vechi (ora) și nou (ora_start + ora_end)
        if (g.ora_start && g.ora_end) return escape(g.ora_start + ' - ' + g.ora_end);
        if (g.ora_start) return escape(g.ora_start);
        return escape(g.ora || '');
    }

    function eventTitle(g) {
        return `${TIP_TEXT[g.tip] || 'Acțiune'} la ${g.companie}`;
    }

    function cardUrl(g) {
        return `${SITE}/calendar#${g._slug}`;
    }

    // === STATUS + SORTARE ===

    function computeStatus(g, now) {
        const start = new Date(g.data_start + 'T' + (g.ora_start || '00:00') + ':00');
        const end = new Date((g.data_end || g.data_start) + 'T' + (g.ora_end || '23:59') + ':59');
        g._startDateTime = start;

        if (g.status_override) return g.status_override;
        if (now >= start && now <= end) return 'activa';
        if (start > now) return 'anuntata';
        return 'incheiata';
    }

    function prepare(data) {
        const now = new Date();
        const usedSlugs = new Set();

        data.forEach(g => {
            g.computed_status = computeStatus(g, now);

            // ID stabil pentru link direct: <pancarta sau companie>-<data>
            let slug = slugify(g.pancarta || g.companie) + '-' + g.data_start;
            if (usedSlugs.has(slug)) slug += '-' + g.id;
            usedSlugs.add(slug);
            g._slug = slug;
        });

        // Sortare: ACTIVE → URMĂTOARE → ÎNCHEIATE (cele mai recente primele)
        const order = { activa: 0, anuntata: 1 };
        data.sort((a, b) => {
            const orderA = order[a.computed_status] ?? 2;
            const orderB = order[b.computed_status] ?? 2;
            if (orderA !== orderB) return orderA - orderB;
            if (PAST_STATUSES.includes(a.computed_status)) return b._startDateTime - a._startDateTime;
            return a._startDateTime - b._startDateTime;
        });
        return data;
    }

    // === EXPORT CALENDAR (.ics + Google) ===

    function compactDate(d) { return d.replace(/-/g, ''); }

    function nextDay(dateStr) {
        const d = new Date(dateStr + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().substring(0, 10);
    }

    /** Intervalul evenimentului: zi întreagă sau cu ore (ora României). */
    function eventRange(g) {
        const endDate = isDate(g.data_end) ? g.data_end : g.data_start;
        if (!isTime(g.ora_start) && !isTime(g.ora_end)) {
            return { allDay: true, start: compactDate(g.data_start), end: compactDate(nextDay(endDate)) };
        }
        const startTime = isTime(g.ora_start) ? g.ora_start : '00:00';
        const endTime = isTime(g.ora_end) ? g.ora_end : '23:59';
        return {
            allDay: false,
            start: compactDate(g.data_start) + 'T' + startTime.replace(':', '') + '00',
            end: compactDate(endDate) + 'T' + endTime.replace(':', '') + '00',
        };
    }

    function eventDescription(g) {
        const parts = [g.motiv];
        if (g.organizator) parts.push('Organizator: ' + g.organizator);
        if (g.site) parts.push('Site: ' + g.site);
        parts.push('Detalii: ' + cardUrl(g));
        return parts.filter(Boolean).join('\n');
    }

    function icsEscape(s) {
        return (s || '').toString()
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r?\n/g, '\\n');
    }

    /** Liniile .ics au maxim 75 de octeți; restul continuă pe rândul următor. */
    function foldLine(line) {
        const encoder = new TextEncoder();
        const out = [];
        let current = '';
        let bytes = 0;
        for (const ch of line) {
            const len = encoder.encode(ch).length;
            if (bytes + len > 73) {
                out.push(current);
                current = ' ';
                bytes = 1;
            }
            current += ch;
            bytes += len;
        }
        out.push(current);
        return out.join('\r\n');
    }

    function buildIcs(g) {
        const range = eventRange(g);
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
        const dtStart = range.allDay
            ? `DTSTART;VALUE=DATE:${range.start}`
            : `DTSTART;TZID=${TIMEZONE}:${range.start}`;
        const dtEnd = range.allDay
            ? `DTEND;VALUE=DATE:${range.end}`
            : `DTEND;TZID=${TIMEZONE}:${range.end}`;

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Greva Online//Calendar Greve//RO',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            // Ora României, cu trecerea la ora de vară/iarnă
            'BEGIN:VTIMEZONE',
            `TZID:${TIMEZONE}`,
            'BEGIN:DAYLIGHT',
            'TZOFFSETFROM:+0200',
            'TZOFFSETTO:+0300',
            'TZNAME:EEST',
            'DTSTART:19700329T030000',
            'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
            'END:DAYLIGHT',
            'BEGIN:STANDARD',
            'TZOFFSETFROM:+0300',
            'TZOFFSETTO:+0200',
            'TZNAME:EET',
            'DTSTART:19701025T040000',
            'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
            'END:STANDARD',
            'END:VTIMEZONE',
            'BEGIN:VEVENT',
            `UID:${g._slug}@greva.online`,
            `DTSTAMP:${stamp}`,
            dtStart,
            dtEnd,
            `SUMMARY:${icsEscape(eventTitle(g))}`,
            `LOCATION:${icsEscape(g.locatie)}`,
            `DESCRIPTION:${icsEscape(eventDescription(g))}`,
            `URL:${cardUrl(g)}`,
            'END:VEVENT',
            'END:VCALENDAR',
        ];
        return lines.map(foldLine).join('\r\n') + '\r\n';
    }

    function downloadIcs(g) {
        const blob = new Blob([buildIcs(g)], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = g._slug + '.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function googleCalendarUrl(g) {
        const range = eventRange(g);
        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: eventTitle(g),
            dates: range.start + '/' + range.end,
            details: eventDescription(g),
            location: g.locatie || '',
        });
        if (!range.allDay) params.set('ctz', TIMEZONE);
        return 'https://calendar.google.com/calendar/render?' + params.toString();
    }

    // === RANDARE ===

    function renderStatusBadge(status) {
        const map = {
            activa: { text: 'În desfășurare', color: '#ff4d4d' },
            anuntata: { text: 'Urmează', color: '#ffc800' },
            incheiata: { text: 'Încheiată', color: '#6a8aa3' },
            castigata: { text: '✅ Câștigată', color: '#4caf50' },
            compromis: { text: '🤝 Compromis', color: '#7986cb' },
            pierduta: { text: '❌ Neîndeplinită', color: '#9e9e9e' },
        };
        const s = map[status] || map.incheiata;
        return `<span class="greva-status-badge" style="background:${s.color}">${s.text}</span>`;
    }

    function renderNewsLinks(news) {
        if (!Array.isArray(news) || news.length === 0) return '';

        const items = news.map(n => {
            if (typeof n === 'string') {
                return `<li><a href="${safeUrl(n)}" target="_blank" rel="noopener">${escape(n)}</a></li>`;
            }
            const source = n.sursa ? `<span class="news-source">${escape(n.sursa)}</span> · ` : '';
            const date = n.data ? `<span class="news-date">${escape(n.data)}</span>` : '';
            return `<li>${source}<a href="${safeUrl(n.url)}" target="_blank" rel="noopener">${escape(n.titlu || n.url)}</a> ${date}</li>`;
        }).join('');

        return `<div class="greva-news">
            <strong>📰 În presă:</strong>
            <ul>${items}</ul>
        </div>`;
    }

    function renderActions(g, index) {
        const isPast = PAST_STATUSES.includes(g.computed_status);
        const calendarButtons = isPast ? '' : `
            <button type="button" class="greva-action-btn" data-action="ics" data-index="${index}">📅 Adaugă în calendar</button>
            <a class="greva-action-btn" href="${escape(googleCalendarUrl(g))}" target="_blank" rel="noopener">Google Calendar</a>`;
        return `<div class="greva-actions">
            ${calendarButtons}
            <button type="button" class="greva-action-btn" data-action="copy" data-index="${index}">🔗 Copiază linkul</button>
        </div>`;
    }

    function renderCard(g, index) {
        return `
            <div class="greva-card status-${escape(g.computed_status)}" id="${escape(g._slug)}"
                 data-sector="${escape(g.sector)}" data-oras="${escape(orasOf(g))}"
                 data-past="${PAST_STATUSES.includes(g.computed_status) ? '1' : '0'}">
                <div class="greva-header">
                    <span class="greva-data">${formatDate(g.data_start, g.data_end)}</span>
                    ${(g.ora_start || g.ora) ? `<span class="greva-ora">${formatOra(g)}</span>` : ''}
                    ${renderStatusBadge(g.computed_status)}
                </div>
                <h3>${TIP_LABELS[g.tip || 'greva'] || '✊ Acțiune'} la ${escape(g.companie)}</h3>
                <div class="greva-meta">
                    📍 ${escape(g.locatie)} · 🏢 ${escape(g.sector)}
                </div>
                <p>${escape(g.motiv)}</p>
                ${g.organizator ? `<p class="greva-org">Organizator: ${escape(g.organizator)}</p>` : ''}
                ${g.site ? `<p class="greva-link"><a href="${safeUrl(g.site)}" target="_blank" rel="noopener">Site dedicat →</a></p>` : ''}
                ${renderNewsLinks(g.news)}
                ${g.rezultat ? `<div class="greva-rezultat">${escape(g.rezultat)}</div>` : ''}
                ${renderActions(g, index)}
            </div>`;
    }

    function render() {
        const parts = [];
        let separatorAdded = false;

        greve.forEach((g, i) => {
            // Separator între „în curs/urmează” și „încheiate”
            if (PAST_STATUSES.includes(g.computed_status) && !separatorAdded) {
                parts.push('<div class="greve-separator" id="separator-incheiate"><span>Greve încheiate</span></div>');
                separatorAdded = true;
            }
            parts.push(renderCard(g, i));
        });
        parts.push('<div class="card" id="no-results" hidden><p style="text-align:center">Nicio acțiune pentru filtrele alese.</p></div>');

        listEl.innerHTML = parts.join('');
    }

    // === FILTRE ===

    function fillSelect(select, values) {
        for (const value of values) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = value;
            select.appendChild(opt);
        }
    }

    function setupFilters() {
        const sectors = [...new Set(greve.map(g => g.sector).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'ro'));

        // Național primul, Nespecificat ultimul, restul alfabetic
        const rank = o => (o === ORAS_NATIONAL ? 0 : o === ORAS_NESPECIFICAT ? 2 : 1);
        const orase = [...new Set(greve.map(orasOf))]
            .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ro'));

        fillSelect(sectorSelect, sectors);
        fillSelect(orasSelect, orase);
        sectorSelect.addEventListener('change', applyFilters);
        orasSelect.addEventListener('change', applyFilters);
        filtersEl.hidden = false;
    }

    function applyFilters() {
        const sector = sectorSelect.value;
        const oras = orasSelect.value;
        let visible = 0;
        let visiblePast = 0;

        listEl.querySelectorAll('.greva-card').forEach(card => {
            const show = (!sector || card.dataset.sector === sector) &&
                (!oras || card.dataset.oras === oras);
            card.hidden = !show;
            if (show) {
                visible++;
                if (card.dataset.past === '1') visiblePast++;
            }
        });

        const separator = document.getElementById('separator-incheiate');
        if (separator) separator.hidden = visiblePast === 0;
        document.getElementById('no-results').hidden = visible > 0;
    }

    // === LINK DIRECT (#brd-2026-08-13) ===

    function highlightFromHash() {
        const id = decodeURIComponent(location.hash.slice(1));
        if (!id) return;
        const card = document.getElementById(id);
        if (!card || !card.classList.contains('greva-card')) return;

        // Dacă filtrele ascund cardul, le resetăm
        if (card.hidden) {
            sectorSelect.value = '';
            orasSelect.value = '';
            applyFilters();
        }
        listEl.querySelectorAll('.greva-highlight').forEach(el => el.classList.remove('greva-highlight'));
        card.classList.add('greva-highlight');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function copyLink(g, button) {
        const url = cardUrl(g);
        const original = button.textContent;
        try {
            await navigator.clipboard.writeText(url);
            button.textContent = '✅ Link copiat';
        } catch (e) {
            // Clipboard indisponibil (ex: browser vechi) — arătăm linkul
            window.prompt('Copiază linkul:', url);
        }
        history.replaceState(null, '', '#' + g._slug);
        setTimeout(() => { button.textContent = original; }, 2000);
    }

    listEl.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const g = greve[Number(button.dataset.index)];
        if (!g) return;
        if (button.dataset.action === 'ics') downloadIcs(g);
        if (button.dataset.action === 'copy') copyLink(g, button);
    });

    window.addEventListener('hashchange', highlightFromHash);

    // === START ===

    fetch('/data/greve.json?t=' + Date.now())
        .then(r => r.json())
        .then(data => {
            if (!data.greve || data.greve.length === 0) {
                listEl.innerHTML = '<div class="card"><p style="text-align:center">Nu există greve anunțate momentan.</p></div>';
                return;
            }
            greve = prepare(data.greve);
            render();
            setupFilters();
            highlightFromHash();
        })
        .catch(() => {
            listEl.innerHTML = '<div class="alert alert-error">Eroare la încărcare. Încearcă din nou.</div>';
        });
})();
