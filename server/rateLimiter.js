'use strict';

const config = require('./config');

/**
 * rateLimiter.js — Limitare conexiuni per IP la nivel de TCP/handshake.
 *
 * De ce e separat de cooldown-ul de chat?
 * Cooldown-ul de chat protejează contra spamului în interiorul aplicației.
 * Rate limiter-ul ăsta protejează contra atacurilor de epuizare a
 * resurselor (un singur IP deschide 5000 socket-uri și consumă FD-urile).
 *
 * Cloudflare face deja o parte din asta, dar e bună apărarea în profunzime.
 */

class RateLimiter {

    constructor(registry) {
        this.registry = registry;
    }

    /**
     * Verifică dacă un IP mai poate deschide o conexiune.
     * @returns {boolean} true dacă e OK, false dacă a depășit limita
     */
    canConnect(ip) {
        const current = this.registry.getIpConnectionCount(ip);
        return current < config.MAX_CONNECTIONS_PER_IP;
    }
}

module.exports = RateLimiter;