#!/usr/bin/env node
'use strict';

/**
 * stats.js — Rezumatul participării, din data/stats.jsonl.
 *
 * Utilizare:
 *   node scripts/stats.js                 # rezumat pe zile (ultimele 30)
 *   node scripts/stats.js --zile 7        # doar ultimele 7 zile
 *   node scripts/stats.js --zi 2026-10-01 # fiecare oră dintr-o zi
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/stats.jsonl');

const args = process.argv.slice(2);
function getArg(name) {
    const i = args.indexOf('--' + name);
    return i >= 0 ? args[i + 1] : undefined;
}

if (!fs.existsSync(FILE)) {
    console.log('Nu există încă statistici (data/stats.jsonl). Se creează după prima oră de funcționare.');
    process.exit(0);
}

// Citește și unește liniile aceleiași ore (apar două la un restart în mijlocul orei)
const hours = new Map();
for (const raw of fs.readFileSync(FILE, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    let r;
    try { r = JSON.parse(raw); } catch (e) { continue; }
    const h = hours.get(r.ora) || { ora: r.ora, vp: 0, vv: 0, ip: 0, iv: 0 };
    h.vp = Math.max(h.vp, r.varf_protestatari || 0);
    h.vv = Math.max(h.vv, r.varf_vizitatori || 0);
    h.ip += r.intrari_protestatari || 0;
    h.iv += r.intrari_vizitatori || 0;
    hours.set(r.ora, h);
}

function table(headers, rows) {
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
    const line = cells => cells.map((c, i) => String(c).padStart(widths[i])).join('  ');
    console.log(line(headers));
    console.log(widths.map(w => '-'.repeat(w)).join('  '));
    rows.forEach(r => console.log(line(r)));
}

const zi = getArg('zi');

if (zi) {
    const rows = [...hours.values()]
        .filter(h => h.ora.startsWith(zi))
        .sort((a, b) => a.ora.localeCompare(b.ora))
        .map(h => [h.ora.substring(11), h.vp, h.vv, h.ip, h.iv]);

    if (rows.length === 0) {
        console.log(`Nicio statistică pentru ${zi}.`);
        process.exit(0);
    }
    console.log(`\nParticipare pe ore — ${zi}\n`);
    table(['Ora', 'Vârf protestatari', 'Vârf vizitatori', 'Intrări protestatari', 'Intrări vizitatori'], rows);
} else {
    const days = new Map();
    for (const h of hours.values()) {
        const day = h.ora.substring(0, 10);
        const d = days.get(day) || { day, vp: 0, peakHour: '-', vv: 0, ip: 0, iv: 0 };
        if (h.vp > d.vp) { d.vp = h.vp; d.peakHour = h.ora.substring(11); }
        d.vv = Math.max(d.vv, h.vv);
        d.ip += h.ip;
        d.iv += h.iv;
        days.set(day, d);
    }

    const limit = parseInt(getArg('zile') || '30', 10);
    const rows = [...days.values()]
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-limit)
        .map(d => [d.day, d.vp, d.peakHour, d.vv, d.ip, d.iv]);

    console.log('\nParticipare pe zile\n');
    table(['Zi', 'Vârf protestatari', 'Ora vârfului', 'Vârf vizitatori', 'Intrări protestatari', 'Intrări vizitatori'], rows);
    console.log('\nDetalii pe ore: node scripts/stats.js --zi AAAA-LL-ZZ');
}
console.log('\nVârf = maxim conectați simultan. Intrări = conectări (o reconectare contează din nou).\n');
