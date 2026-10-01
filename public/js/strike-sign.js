/*
 * strike-sign.js — Pancarta „Grevă la ...” generată automat.
 *
 * Când în calendar există o acțiune în desfășurare (sau care începe în
 * următoarele 24h, vezi active-action.js), pancarta „greva_la” primește
 * textul ei: tipul acțiunii + numele scurt al companiei (câmpul `pancarta`
 * din greve.json, altfel `companie`). Ex: „Grevă / Metrorex”.
 *
 * Siguranță: textul vine DOAR din greve.json, editat manual de admin —
 * niciodată de la utilizatori. Serverul validează în continuare doar
 * ID-ul pancartei („greva_la”), exact ca înainte.
 *
 * Performanță: imaginea e desenată o singură dată pe un <canvas> și e
 * aplicată tuturor rățuștelor printr-o singură regulă CSS, deci 5000 de
 * rățuște cu această pancartă nu costă nimic în plus.
 *
 * Imaginea e un URL data: (nu blob:), pentru că politica CSP a site-ului
 * permite imagini doar din 'self' și data: (img-src 'self' data:).
 */

(function () {
    'use strict';

    const SIGN_ID = 'greva_la';
    const BLANK_URL = '/assets/signs/pancarta_goala.webp';
    const FONT_FAMILY = '"Balsamiq Sans", "Comic Sans MS", "Chalkboard SE", cursive';

    // Zona albă a pancartei, în pixeli ai imaginii originale (160×120)
    const BOARD = { x: 42, y: 14, w: 76, h: 48 };
    const SCALE = 2; // randare la 2× pentru ecrane retina
    const MAX_FONT = 24;
    const MIN_FONT = 8;

    const TIP_LABELS = {
        greva: 'Grevă',
        pichetare: 'Pichetare',
        protest: 'Protest',
    };
    const LABEL_COLOR = '#b3261e';
    const NAME_COLOR = '#1a1a1a';

    // O singură regulă CSS pentru toate rățuștele cu această pancartă.
    // Până e generat textul, arată pancarta goală.
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);
    setSignUrl(BLANK_URL);

    let blankPromise = null;
    let currentKey = null;
    let currentUrl = null;    // pancarta acțiunii active (null = nicio acțiune)
    let currentLabel = null;  // ex: „Grevă la Metrorex”, pentru galerie

    function setSignUrl(url) {
        styleEl.textContent =
            `.duck-sign[data-sign="${SIGN_ID}"] { background-image: url("${url}"); }`;
    }

    function loadBlank() {
        if (!blankPromise) {
            blankPromise = new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = BLANK_URL;
            });
        }
        return blankPromise;
    }

    async function waitForFont(text) {
        if (!document.fonts || !document.fonts.load) return;
        const timeout = new Promise(r => setTimeout(r, 3000));
        try {
            await Promise.race([document.fonts.load(`700 20px ${FONT_FAMILY}`, text), timeout]);
        } catch (e) { /* folosim fontul de rezervă */ }
    }

    /** Împarte textul pe rânduri care încap în lățimea dată. */
    function wrapWords(ctx, text, maxWidth) {
        const words = text.split(/\s+/).filter(Boolean);
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (line && ctx.measureText(test).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    /** Caută cel mai mare font la care tot textul încape pe pancartă. */
    function layoutText(ctx, label, name) {
        const maxW = BOARD.w * SCALE;
        const maxH = BOARD.h * SCALE;

        for (let size = MAX_FONT; size >= MIN_FONT; size--) {
            ctx.font = `700 ${size * SCALE}px ${FONT_FAMILY}`;
            const lines = [label, ...wrapWords(ctx, name, maxW)];
            const lineH = size * SCALE * 1.1;
            const fits = lines.length * lineH <= maxH &&
                lines.every(l => ctx.measureText(l).width <= maxW);
            if (fits) return { lines, lineH };
        }

        // Nume foarte lung: font minim, maxim 3 rânduri de nume, tăiate cu „…”
        ctx.font = `700 ${MIN_FONT * SCALE}px ${FONT_FAMILY}`;
        const nameLines = wrapWords(ctx, name, maxW).slice(0, 3)
            .map(line => truncateToWidth(ctx, line, maxW));
        const last = nameLines.length - 1;
        if (!nameLines[last].endsWith('…')) {
            nameLines[last] = truncateToWidth(ctx, nameLines[last] + '…', maxW);
        }
        return { lines: [label, ...nameLines], lineH: MIN_FONT * SCALE * 1.1 };
    }

    function truncateToWidth(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let cut = text.replace(/…$/, '');
        while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) {
            cut = cut.slice(0, -1);
        }
        return cut + '…';
    }

    async function render(label, name) {
        const blank = await loadBlank();
        await waitForFont(label + ' ' + name);

        const canvas = document.createElement('canvas');
        canvas.width = blank.naturalWidth * SCALE;
        canvas.height = blank.naturalHeight * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(blank, 0, 0, canvas.width, canvas.height);

        const { lines, lineH } = layoutText(ctx, label, name);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = (BOARD.x + BOARD.w / 2) * SCALE;
        const cy = (BOARD.y + BOARD.h / 2) * SCALE;
        const firstY = cy - ((lines.length - 1) * lineH) / 2;

        lines.forEach((line, i) => {
            ctx.fillStyle = i === 0 ? LABEL_COLOR : NAME_COLOR;
            ctx.fillText(line, cx, firstY + i * lineH);
        });

        return canvas.toDataURL('image/png');
    }

    /** Actualizează elementul din galeria de pancarte (dacă a fost creat). */
    function refreshGallery() {
        const item = document.querySelector(`.sign-item[data-sign-id="${SIGN_ID}"]`);
        if (!item) return;

        const active = currentUrl !== null;
        item.hidden = !active;

        if (active) {
            item.querySelector('img').src = currentUrl;
            item.querySelector('.sign-item-label').textContent = currentLabel;
            item.setAttribute('aria-label', currentLabel);
            // Pancarta grevei în desfășurare apare prima
            if (item.parentNode.firstElementChild !== item) item.parentNode.prepend(item);
        } else if (window.Signs && window.Signs.selectedId === SIGN_ID) {
            // Greva s-a terminat cât timp userul alegea — anulăm selecția
            window.Signs.selectedId = null;
            item.classList.remove('selected');
            document.getElementById('btn-signs-confirm').disabled = true;
        }
    }

    async function update(action) {
        const name = action ? String(action.pancarta || action.companie || '').trim() : '';
        const label = action ? (TIP_LABELS[action.tip] || 'Grevă') : '';
        const key = action && name ? label + '|' + name : null;
        if (key === currentKey) return;
        currentKey = key;

        // Fără acțiune activă, rățuștele rămase cu pancarta primesc „Grevă!”
        const url = key ? await render(label, name) : await render('Grevă!', '');
        if (currentKey !== key) return; // a venit între timp o actualizare mai nouă

        setSignUrl(url);
        currentUrl = key ? url : null;
        currentLabel = key ? `${label} la ${name}` : null;
        refreshGallery();
    }

    window.addEventListener('greva:action', (e) => {
        update(e.detail).catch(err => console.warn('[StrikeSign]', err));
    });

    window.StrikeSign = {
        SIGN_ID,
        refreshGallery,
    };
})();
