#!/bin/bash
#
# setup-server.sh — Inițializare server Ubuntu pentru Greva Banca.
# RULEAZĂ O SINGURĂ DATĂ pe server proaspăt. Idempotent (poate rula iar
# fără să strice nimic).
#
# Utilizare: sudo bash scripts/setup-server.sh

set -e # exit la prima eroare

echo "===== [1/8] Update sistem ====="
apt update && apt upgrade -y

echo "===== [2/8] Instalare dependențe ====="
apt install -y curl ufw fail2ban htop iotop

echo "===== [3/8] Instalare Node.js 20 ====="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
node --version
npm --version

echo "===== [4/8] Instalare Caddy ====="
if ! command -v caddy &> /dev/null; then
    apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install -y caddy
fi
caddy version

echo "===== [5/8] Instalare PM2 (process manager pentru Node) ====="
npm install -g pm2

echo "===== [6/8] Tuning limite file descriptors ====="
# limits.conf
if ! grep -q "grevabanca" /etc/security/limits.conf; then
    cat >> /etc/security/limits.conf <<EOF

# Greva Banca - limite mărite pentru WebSocket high-concurrency
*               soft    nofile          50000
*               hard    nofile          50000
root            soft    nofile          50000
root            hard    nofile          50000
EOF
fi

# Caddy service override
mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/limits.conf <<EOF
[Service]
LimitNOFILE=50000
EOF

echo "===== [7/8] Tuning kernel TCP ====="
cat > /etc/sysctl.d/99-grevabanca.conf <<EOF
# Coadă conexiuni pending
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Reutilizare rapidă socket-uri TIME_WAIT
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15

# Plaja porturi efemere
net.ipv4.ip_local_port_range = 1024 65535

# File descriptors global
fs.file-max = 200000

# Buffere TCP pentru Gigabit
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# BBR congestion control
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
EOF
sysctl --system

echo "===== [8/8] Firewall UFW ====="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Caddy redirect)'
ufw allow 443/tcp comment 'HTTPS (Caddy)'
# Portul 3000 NU se deschide — Node ascultă doar pe 127.0.0.1
ufw --force enable
ufw status verbose

echo ""
echo "============================================"
echo "  Setup complet!"
echo "  Următorii pași:"
echo "  1. Copiază proiectul în /var/www/grevabanca"
echo "  2. cd /var/www/grevabanca && npm install"
echo "  3. cp Caddyfile /etc/caddy/Caddyfile"
echo "  4. systemctl reload caddy"
echo "  5. pm2 start ecosystem.config.js"
echo "  6. pm2 save && pm2 startup"
echo "============================================"