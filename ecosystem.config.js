/**
 * ecosystem.config.js — Configurație PM2 pentru rulare în producție.
 *
 * PM2 oferă:
 * - Restart automat la crash
 * - Log management (rotație automată)
 * - Zero-downtime reload
 * - Startup script pentru pornire la reboot
 *
 * Pornire:    pm2 start ecosystem.config.js
 * Restart:    pm2 reload greva
 * Logs:       pm2 logs greva
 * Stop:       pm2 stop greva
 * Auto-boot:  pm2 startup && pm2 save
 */

module.exports = {
    apps: [{
        name: 'greva',
        script: './server/index.js',
        cwd: __dirname,

        // O singură instanță — Socket.io în cluster mode necesită Redis pentru
        // sync între workeri. Pentru câteva mii de useri, un singur proces Node
        // e suficient (event loop foarte rapid pe payload-uri mici).
        instances: 1,
        exec_mode: 'fork',

        // Restart automat la crash, cu backoff
        autorestart: true,
        max_restarts: 10,
        min_uptime: '30s',
        restart_delay: 2000,

        // Restart dacă memoria depășește 1GB (proxy pentru memory leak)
        max_memory_restart: '1G',

        // Mediu
        env: {
            NODE_ENV: 'production',
            PORT: 3000,
            STATS: '1', // log de stats periodic
        },

        // Logs - PM2 le rotește automat dacă instalezi pm2-logrotate
        out_file: '/var/log/greva/out.log',
        error_file: '/var/log/greva/error.log',
        merge_logs: true,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',

        // Limită file descriptors moștenită de la sistem (50000)
        // PM2 nu suprascrie, deci limits.conf rulează
    }]
};