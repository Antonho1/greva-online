'use strict';

/**
 * playerRegistry.js — Registrul central al jucătorilor conectați.
 *
 * Folosim Map() nativ JS, nu Object literal:
 * - Map are performanță O(1) garantată pentru insert/delete (V8 optimizat)
 * - Iterare ordonată (utilă pentru broadcast)
 * - .size e instant, nu trebuie Object.keys().length
 *
 * Structura unui jucător:
 * {
 *   socketId: string,
 *   role: 'protester' | 'visitor',
 *   x: number, y: number,             // doar pentru protester
 *   sign: string,                     // pancartă, doar pentru protester
 *   lastChatAt: number (timestamp ms), // pentru cooldown
 *   profanityStrikes: Array<number>,  // timestamps strike-uri
 *   isShadowbanned: boolean,
 *   ip: string,                       // pentru rate limiting per IP
 *   connectedAt: number,
 * }
 */

class PlayerRegistry {

    constructor() {
        this.players = new Map();      // socketId → player object
        this.ipConnectionCount = new Map(); // ip → count (pentru limita per IP)
    }

    add(player) {
        this.players.set(player.socketId, player);

        // Tracking conexiuni per IP
        const count = this.ipConnectionCount.get(player.ip) || 0;
        this.ipConnectionCount.set(player.ip, count + 1);
    }

    remove(socketId) {
        const player = this.players.get(socketId);
        if (!player) return null;

        this.players.delete(socketId);

        // Decrement IP count
        const count = this.ipConnectionCount.get(player.ip) || 1;
        if (count <= 1) {
            this.ipConnectionCount.delete(player.ip);
        } else {
            this.ipConnectionCount.set(player.ip, count - 1);
        }

        return player;
    }

    get(socketId) {
        return this.players.get(socketId);
    }

    has(socketId) {
        return this.players.has(socketId);
    }

    get size() {
        return this.players.size;
    }

    /**
     * Numără jucătorii după rol.
     * O(n) — dar n e maxim 6000, deci ~microsecunde.
     * Apelat doar la conectare nouă, nu în hot path.
     */
    countByRole(role) {
        let count = 0;
        for (const p of this.players.values()) {
            if (p.role === role) count++;
        }
        return count;
    }

    getIpConnectionCount(ip) {
        return this.ipConnectionCount.get(ip) || 0;
    }

    /**
     * Returnează doar datele PUBLICE ale tuturor protestatarilor.
     * Vizitatorii NU sunt în această listă (sunt ghost).
     * Folosit la trimiterea state-ului inițial către useri noi.
     */
    getProtestersPublicState() {
        const result = [];
        for (const p of this.players.values()) {
            if (p.role === 'protester') {
                result.push({
                    id: p.socketId,
                    x: p.x,
                    y: p.y,
                    sign: p.sign,
                });
            }
        }
        return result;
    }

    /**
     * Iterator pentru broadcast eficient.
     */
    *all() {
        yield* this.players.values();
    }
}

module.exports = PlayerRegistry;