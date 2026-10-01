'use strict';

/**
 * profanityFilter.js — Filtru bilingv (RO / EN) de înjurături și expresii obscene.
 *
 * Scopul e să blocheze vulgaritățile și insultele, NU critica. Cuvinte ca
 * „prost” („condiții proaste”), „viol” („au violat contractul”), „sex”
 * („discriminare pe criterii de sex”) sau „morții” sunt lăsate să treacă,
 * pentru că apar natural într-un protest.
 *
 * Trei niveluri de potrivire, de la cel mai strict la cel mai permisiv:
 *
 * 1. SUBSTRING — rădăcina e căutată oriunde în cuvânt. Doar rădăcini care
 *    practic nu apar în cuvinte normale (verificate pe primele 50.000 de
 *    cuvinte din română și engleză).
 * 2. PREFIX — cuvântul începe cu rădăcina. Prinde derivatele („pulii”,
 *    „futu-ți”, „căcatul”) fără să prindă „manipulare” sau „populație”.
 * 3. CUVÂNT ÎNTREG — doar potrivire exactă (după normalizare).
 *
 * Mesajele cu litere despărțite („p u l a”) sunt prinse separat: literele
 * izolate consecutive sunt lipite și verificate ca un singur cuvânt.
 */

const ROOTS_SUBSTRING = [
    // --- LIMBA ROMÂNĂ ---
    'pizd', 'pzd', 'chizd',
    'bulang',
    'labagi',
    'kkat', 'ckat', 'kakat',
    'ejacul', 'masturb',
    'fofoloanc', 'putulic', 'madular',

    // --- LIMBA ENGLEZĂ ---
    'fuck', 'fck', 'shit', 'bitch', 'cunt', 'motherf', 'cocksuck',
    'dickhead', 'asshole', 'bullshit', 'dipshit', 'dumbass', 'jackass',
    'nigger', 'nigga', 'faggot', 'whore', 'slut', 'wanker', 'douche',
];

const ROOTS_PREFIX = [
    // --- LIMBA ROMÂNĂ ---
    // Pulă & derivate
    'pula', 'pule', 'puli',
    // Muie & derivate
    'muie', 'muist', 'muisor',
    // Fut & derivate
    'futu', 'fute', 'futa', 'futea', 'futai', 'futut', 'futac',
    // Căcat & derivate
    'cacat', 'cacan', 'kkt',
    // Coaie & derivate
    'coaie', 'coai',
    // Jigniri
    'cocalar', 'curva', 'curve', 'curvar',
    'tarfa', 'tarfe', 'tarfo', 'panaram', 'sloboz',
    'labagiu', 'bozgor', 'cioroi',
    // Anatomie explicită
    'sperma', 'vagin', 'clitor', 'lindic', 'preput', 'scrot',

    // --- LIMBA ENGLEZĂ ---
    'cocks', 'dickface', 'pussy', 'pussies', 'bastard', 'retard',
    'fagg', 'twat', 'prick', 'skank', 'arsehole', 'bollock',
];

const ROOTS_WHOLE_WORD = [
    // --- LIMBA ROMÂNĂ ---
    // Abrevieri
    'plm', 'pwla', 'pzdm', 'fmm', 'fml', 'mortiimatii', 'mtii',
    // Insulte
    'bou', 'boul', 'boule', 'boului', 'boilor',
    'idiot', 'idiota', 'idiotul', 'idiotule', 'idioti', 'idioata', 'idioate', 'idiotilor',
    'cretin', 'cretina', 'cretinul', 'cretinule', 'cretini', 'cretine', 'cretinilor',
    'tampit', 'tampita', 'tampitul', 'tampitule', 'tampiti', 'tampite', 'tampitilor',
    'prostanac', 'prostanaca', 'prostanacule', 'prostovan',
    'fraier', 'fraiera', 'fraierul', 'fraierule', 'fraieri', 'fraierilor', 'fraierache',
    'jegos', 'jegosi', 'jegoasa', 'jegosule',
    'javra', 'javre', 'javrelor', 'potaie', 'potaile',
    'scroafa', 'scroafo', 'piranda', 'pirande', 'handralau', 'jagardea', 'paduchele', 'paduchilor',
    'centurista', 'centuriste', 'gloaba', 'hoarta', 'lepadatura', 'pocitanie', 'rapandula',
    // Vulgarități
    'cur', 'curu', 'curul', 'cururi',
    'sug', 'suge', 'sugi', 'sugeo', 'sugio', 'supto', 'sugaci',
    'laba', 'labii',
    'mata', 'matii', 'matiii',
    'dracu', 'dracului', 'draq',
    'pisat', 'pisatul',
    'penis', 'penisul', 'orgasm',

    // --- LIMBA ENGLEZĂ ---
    'ass', 'dick', 'dicks', 'cock', 'tits', 'boobs',
    'porn', 'porno', 'piss', 'pissed', 'hoe', 'fag', 'tard',
    'bitches', 'nude', 'nudes',
];

// Cuvinte care încep cu o rădăcină PREFIX, dar sunt normale.
const WHITELIST_PREFIX = [
    'futur',                     // future, futurist
    'pulitzer', 'pulaski',
    'pulle', 'pulli', 'pullo', 'pulls', // pulled, pulling, pullover
    'slobozia',
    'cockat',                    // cockatoo
    'muier',                     // muiere (arhaic: femeie)
    'curvatur', 'curves', 'curved',
    'twater',
    'prickl',                    // prickly
    'scrotum',
    'retardant',                 // flame retardant
];

// Cuvinte întregi care NU se filtrează niciodată.
const WHITELIST = new Set([
    'labe', // labe = lăbuțe de animal
]);

/**
 * Normalizează textul: l33tspeak, diacritice, minuscule.
 */
function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/@/g, 'a')
        .replace(/\$/g, 's')
        .replace(/[^a-z]/g, '');
}

/**
 * Comprimă literele repetate consecutive (ex: "puuullaaa" -> "pula").
 */
function collapseRepeats(text) {
    return text.replace(/(.)\1+/g, '$1');
}

function isWhitelisted(word) {
    if (WHITELIST.has(word)) return true;
    return WHITELIST_PREFIX.some(p => word.startsWith(p));
}

function matchesRoots(word) {
    if (isWhitelisted(word)) return false;
    if (ROOTS_SUBSTRING.some(r => word.includes(r))) return true;
    if (ROOTS_PREFIX.some(r => word.startsWith(r))) return true;
    if (ROOTS_WHOLE_WORD.includes(word)) return true;
    return false;
}

/**
 * Verifică dacă un cuvânt normalizat este interzis. Încearcă și varianta
 * cu literele repetate comprimate („puuuula”), dar numai dacă forma
 * originală nu e deja un cuvânt din whitelist.
 */
function isForbiddenWord(normalizedWord) {
    if (!normalizedWord) return false;
    if (isWhitelisted(normalizedWord)) return false;
    if (matchesRoots(normalizedWord)) return true;

    const collapsed = collapseRepeats(normalizedWord);
    return collapsed !== normalizedWord && matchesRoots(collapsed);
}

/**
 * Caută cuvinte scrise cu litere despărțite („p u l a”, „f u t”).
 * Lipește doar literele izolate consecutive, ca să nu apară potriviri
 * false între cuvinte normale alăturate.
 */
function hasSpacedOutWord(normalizedTokens) {
    let run = '';
    for (const word of normalizedTokens) {
        if (word.length === 1) {
            run += word;
            continue;
        }
        if (run.length >= 3 && isForbiddenWord(run)) return true;
        run = '';
    }
    return run.length >= 3 && isForbiddenWord(run);
}

/**
 * Filtrează mesajul primit.
 * @returns {{ filtered: string, wasFiltered: boolean }}
 */
function filterMessage(message) {
    if (typeof message !== 'string' || message.length === 0) {
        return { filtered: '', wasFiltered: false };
    }

    let wasFiltered = false;

    // Pasul 1: verificare cuvânt cu cuvânt
    const tokens = message.split(/(\s+)/);
    const filteredTokens = tokens.map(token => {
        if (/^\s*$/.test(token)) return token;

        if (isForbiddenWord(normalize(token))) {
            wasFiltered = true;
            return '🦆'.repeat(Math.min(token.length, 5));
        }
        return token;
    });

    let filtered = filteredTokens.join('');

    // Pasul 2: litere despărțite prin spații
    if (!wasFiltered) {
        const words = message.split(/\s+/).map(normalize).filter(Boolean);
        if (hasSpacedOutWord(words)) {
            wasFiltered = true;
            filtered = '🦆🦆🦆 (mesaj blocat)';
        }
    }

    return { filtered, wasFiltered };
}

module.exports = { filterMessage, normalize, isForbiddenWord };
