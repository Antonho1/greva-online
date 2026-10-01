'use strict';

/**
 * statsLog.js — Statistici de participare pe oră, salvate pe server.
 *
 * La fiecare oră fixă (ora României) adaugă o linie în data/stats.jsonl:
 *
 *   {"ora":"2026-10-01 14:00","varf_protestatari":312,"varf_vizitatori":58,
 *    "intrari_protestatari":540,"intrari_vizitatori":97}
 *
 * - varf_*    = numărul maxim de persoane conectate simultan în acea oră
 * - intrari_* = câte intrări au fost în acea oră (o reconectare contează
 *               ca intrare nouă; nu identificăm oamenii, deci nu putem
 *               număra persoane unice)
 *
 * Doar numere agregate — fără IP-uri sau alte date personale.
 * Rezumatul pe zile/ore: node scripts/stats.js
 */

const fs = require('fs');

const TIMEZONE = 'Europe/Bucharest';
const HOUR_MS = 60 * 60 * 1000;

// „2026-10-01 14:00” în ora României
const hourLabelFormat = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function hourStart(ts) {
    // Fusul orar al României are ore întregi față de UTC, deci ora fixă
    // UTC coincide cu ora fixă locală.
    return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

class StatsLog {

    constructor(file, registry) {
        this.file = file;
        this.registry = registry;
        this.bucket = null;
        this.timer = null;
    }

    start() {
        this._newBucket(Date.now());
        this._scheduleNext();
    }

    /** Apelat după fiecare join reușit. */
    recordJoin(role) {
        if (!this.bucket) return;
        if (role === 'protester') this.bucket.joinsProtesters++;
        else this.bucket.joinsVisitors++;
        this._updatePeaks();
    }

    /** Scrie ora curentă (parțială) — la oprirea serverului. */
    flush() {
        if (!this.bucket) return;
        this._write(this.bucket, true);
        this.bucket = null;
        clearTimeout(this.timer);
    }

    _newBucket(now) {
        this.bucket = {
            start: hourStart(now),
            peakProtesters: this.registry.countByRole('protester'),
            peakVisitors: this.registry.countByRole('visitor'),
            joinsProtesters: 0,
            joinsVisitors: 0,
        };
    }

    _updatePeaks() {
        const b = this.bucket;
        b.peakProtesters = Math.max(b.peakProtesters, this.registry.countByRole('protester'));
        b.peakVisitors = Math.max(b.peakVisitors, this.registry.countByRole('visitor'));
    }

    _scheduleNext() {
        const now = Date.now();
        const delay = hourStart(now) + HOUR_MS - now + 50;
        this.timer = setTimeout(() => this._rollOver(), delay);
        this.timer.unref(); // nu ține procesul pornit doar pentru statistici
    }

    _rollOver() {
        this._write(this.bucket, false);
        this._newBucket(Date.now());
        this._scheduleNext();
    }

    _write(b, partial) {
        const line = {
            ora: hourLabelFormat.format(new Date(b.start)).replace(',', ''),
            varf_protestatari: b.peakProtesters,
            varf_vizitatori: b.peakVisitors,
            intrari_protestatari: b.joinsProtesters,
            intrari_vizitatori: b.joinsVisitors,
        };
        if (partial) line.partial = true;

        try {
            fs.appendFileSync(this.file, JSON.stringify(line) + '\n');
        } catch (e) {
            console.error('[Stats] Nu am putut scrie statisticile:', e.message);
        }
        console.log(
            `[Stats] ${line.ora} vârf=${line.varf_protestatari} protestatari, ` +
            `${line.varf_vizitatori} vizitatori · intrări=${line.intrari_protestatari}/${line.intrari_vizitatori}`
        );
    }
}

module.exports = StatsLog;
