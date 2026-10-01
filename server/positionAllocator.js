'use strict';

const config = require('./config');

/**
 * positionAllocator.js — Algoritm hibrid de alocare pozitii.
 *
 * PROBLEMĂ:
 * - La <50 useri: rățuștele NU trebuie să se suprapună (arată gol și aliniat).
 * - La 1000+ useri: suprapunerea e OK și chiar dezirabilă (mulțime densă).
 *
 * SOLUȚIE:
 * 1. La inițializare, generăm un grid de sloturi non-overlapping în zona
 *    permisă, cu spacing = DUCK_LOGICAL_SIZE * 1.2. Le amestecăm (shuffle).
 * 2. Primii ~100 useri primesc sloturi din această listă, în ordine
 *    aleatorie — par "împrăștiați", dar nu se suprapun.
 * 3. Când sloturile se epuizează (>~100 useri), comutăm pe plasare RANDOM
 *    pură în zonă. Suprapunerile încep să apară natural — exact ce vrem.
 * 4. La deconectare, slotul se eliberează și revine în pool. Următorul
 *    user în "modul grid" îl reutilizează (ordinea de eliberare contează
 *    mai puțin decât faptul că slot-urile rămân non-overlapping).
 *
 * EDGE CASES:
 * - User se conectează, primește slot, se deconectează → slotul revine.
 * - User în "modul random" se deconectează → nu eliberăm nimic (era random).
 * - Reconect rapid: tratat ca user nou, primește slot/random nou.
 */

class PositionAllocator {

    constructor() {
        this.gridSlots = [];        // sloturi disponibile (stack-style)
        this.usedSlotsBySocketId = new Map(); // socketId → slot (pentru free la disconnect)
        this._buildGrid();
    }

    /**
     * Construiește grid-ul inițial: puncte non-overlapping în zona permisă.
     * Apelat o singură dată, la pornirea serverului.
     */
    _buildGrid() {
        const spacing = config.DUCK_LOGICAL_SIZE * 1.2; // 20% buffer între rățuște

        const zoneWidth = config.ZONE_X_MAX - config.ZONE_X_MIN;
        const zoneHeight = config.ZONE_Y_MAX - config.ZONE_Y_MIN;

        const cols = Math.floor(zoneWidth / spacing);
        const rows = Math.floor(zoneHeight / spacing);

        // Generăm punctele centrate în celula lor + jitter mic
        // ca să nu arate ca o tablă de șah perfectă.
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const baseX = config.ZONE_X_MIN + (c + 0.5) * spacing;
                const baseY = config.ZONE_Y_MIN + (r + 0.5) * spacing;

                // Jitter ±15% din spacing — păstrează non-overlapping
                // dar rupe simetria geometrică.
                const jitterRange = spacing * 0.15;
                const x = Math.round(baseX + (Math.random() * 2 - 1) * jitterRange);
                const y = Math.round(baseY + (Math.random() * 2 - 1) * jitterRange);

                this.gridSlots.push({ x, y });
            }
        }

        // Fisher-Yates shuffle — primii useri par împrăștiați aleator.
        for (let i = this.gridSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.gridSlots[i], this.gridSlots[j]] = [this.gridSlots[j], this.gridSlots[i]];
        }

        console.log(`[PositionAllocator] Grid construit: ${this.gridSlots.length} sloturi non-overlapping (${cols}x${rows})`);
    }

    /**
     * Alocă o poziție pentru un user nou.
     *
     * @param {string} socketId
     * @param {number} currentProtesterCount — câți protestatari sunt deja conectați
     * @returns {{x: number, y: number}}
     */
    allocate(socketId, currentProtesterCount) {

        // Strategie: dacă încă avem sloturi de grid disponibile ȘI suntem
        // sub pragul de "comutare", folosim grid. Altfel, random.
        const useGrid =
            this.gridSlots.length > 0 &&
            currentProtesterCount < config.GRID_SLOTS_THRESHOLD;

        if (useGrid) {
            // Pop slot din vârful stack-ului (deja amestecat)
            const slot = this.gridSlots.pop();
            this.usedSlotsBySocketId.set(socketId, slot);
            return { x: slot.x, y: slot.y, mode: 'grid' };
        }

        // Random plasare în zonă — suprapunerea e OK aici.
        const x = Math.round(
            config.ZONE_X_MIN + Math.random() * (config.ZONE_X_MAX - config.ZONE_X_MIN)
        );
        const y = Math.round(
            config.ZONE_Y_MIN + Math.random() * (config.ZONE_Y_MAX - config.ZONE_Y_MIN)
        );

        return { x, y, mode: 'random' };
    }

    /**
     * Eliberează slotul unui user la deconectare.
     * Funcționează doar pentru useri în "mod grid" — pentru random,
     * nu avem ce elibera.
     */
    release(socketId) {
        const slot = this.usedSlotsBySocketId.get(socketId);
        if (slot) {
            this.gridSlots.push(slot);
            this.usedSlotsBySocketId.delete(socketId);
        }
    }

    /**
     * Debug/stats
     */
    stats() {
        return {
            slotsAvailable: this.gridSlots.length,
            slotsInUse: this.usedSlotsBySocketId.size,
        };
    }
}

module.exports = PositionAllocator;