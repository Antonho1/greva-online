'use strict';

/**
 * profanityFilter.js — Filtru de înjurături în limba română.
 *
 * Strategie:
 * 1. Listă de root-uri (rădăcini), nu cuvinte complete — prinde și
 *    declinări/conjugări/diminutive.
 * 2. Normalizare input: lowercase, fără diacritice, fără caractere
 *    obfuscate (l33t, spații între litere).
 * 3. Înlocuire cu 🦆 (rățușcă) — păstrează tonul ludic.
 *
 * NOTĂ: Lista de mai jos e un STARTER. Va trebui extinsă în timp pe
 * baza log-urilor de strike-uri. Nu o includ exhaustiv aici (mulți
 * termeni vulgari) — pune-i tu pe cei pe care îi vezi în practică.
 */

// Rădăcini de cuvinte interzise. Folosesc forma fără diacritice.
// Adaug variante l33t comune (4=a, 0=o, etc.) în detectare, nu în listă.
const FORBIDDEN_ROOTS = [
    // Vulgarități clasice românești (rădăcini, prinde și formele derivate)
    'pul', 'pizd', 'muie', 'fut', 'futu', 'cur', 'cacat', 'caca',
    'bou', 'boul', 'bulang', 'cocal',
    'tarf', 'curva', 'curve', 'curvar',
    'nesimti', 'jegos', 'jeg',
    'idiot', 'cretin', 'tampi', 'prost',
    'dracu', 'draq',
    'mortii', 'morti',
    'sug', 'suge',
    // Insulte etnice/rasiale — trebuie completate, dar nu le scriu eu aici.
    // Adaugă-le tu în funcție de ce vezi în log-uri.
    'uie', 'dick', 'fuck', 'shit', 'anal','penis', 'pla','panarame', 'murit', 'coi', 'coaie', "ma-ti", "ma-ta","sloboz","mata",
    "vagin","ffut","ffuut","mi-ai","banana","orgasm", "sloboz", "fofoloanca", "fofo", "putulica", "puta", "pasarica", "preput",
    'ling','cariceps','laba','pis','ejacu', 'ass', 'but', 'viol','abuzez','naiba','regulez', 'sex','cuuu','masturb','madulare','maciuca','lindic',
    'puh','dih','cuc','buci','mui'
    
    
];

/**
 * Normalizează un text pentru detectarea înjurăturilor obfuscate.
 *
 * Exemple ce trebuie să prindem:
 *   "p*la"        → "pla"      (no, dar root "pul" prinde "pula")
 *   "p u l a"     → "pula"
 *   "p.u.l.a"     → "pula"
 *   "p u l 4"     → "pula"
 *   "PULĂ"        → "pula"
 *
 * @param {string} text
 * @returns {string} text normalizat pentru matching
 */
function normalize(text) {
    return text
        .toLowerCase()
        // Elimină diacriticele (ă→a, î→i, ș→s, ț→t, â→a)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        // Substituții l33t comune
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/@/g, 'a')
        .replace(/\$/g, 's')
        // Elimină tot ce nu e literă (spații, puncte, asteriscuri, etc.)
        // pentru a prinde "p u l a", "p.u.l.a", "p*l*a"
        .replace(/[^a-z]/g, '');
}

/**
 * Verifică dacă un mesaj conține înjurături și îl filtrează.
 *
 * @param {string} message — mesajul original al userului
 * @returns {{ filtered: string, wasFiltered: boolean }}
 *   filtered: mesajul cu cuvintele rele înlocuite cu 🦆
 *   wasFiltered: true dacă s-a făcut cel puțin o înlocuire (pentru strike-uri)
 */
function filterMessage(message) {
    if (typeof message !== 'string' || message.length === 0) {
        return { filtered: '', wasFiltered: false };
    }

    let wasFiltered = false;

    // Spargem mesajul în "cuvinte" păstrând spațiile/punctuația.
    // Verificăm fiecare cuvânt individual: dacă forma sa normalizată
    // conține o rădăcină interzisă, înlocuim cuvântul cu 🦆🦆🦆.
    const tokens = message.split(/(\s+)/); // păstrează separatorii ca tokeni

    const filtered = tokens.map(token => {
        // Nu atinge whitespace-ul
        if (/^\s*$/.test(token)) return token;

        const normalized = normalize(token);
        if (normalized.length === 0) return token;

        // Verifică dacă orice root e prezent în cuvântul normalizat
        for (const root of FORBIDDEN_ROOTS) {
            if (normalized.includes(root)) {
                wasFiltered = true;
                // Înlocuim cu rățuște: una per literă, păstrând "vizualul"
                return '🦆'.repeat(Math.min(token.length, 5));
            }
        }
        return token;
    }).join('');

    return { filtered, wasFiltered };
}

module.exports = { filterMessage, normalize };
