# Greva Online 🦆

Platformă digitală de protest pașnic pentru susținerea grevelor, pichetărilor și protestelor angajaților din România.

**Live:** [greva.online](https://greva.online)

## Ce face

Greva Online oferă un spațiu pașnic de protest digital unde angajații care nu pot participa fizic la o acțiune (din alte orașe, în concediu, sub presiune ierarhică) își pot exprima solidaritatea sub forma unor avatare cu pancarte, în timp real.

- 🦆 Protest live cu avatare-rățuște care țin pancarte
- 📅 Calendar public al grevelor anunțate
- 📝 Sistem de înscriere pentru noi acțiuni (verificare manuală)
- 🔒 Complet anonim — fără cont, fără cookie-uri de tracking
- ✊ Suport pentru greve, pichetări și proteste

## Stack tehnic

- **Backend:** Node.js + Socket.io (WebSocket)
- **Reverse proxy:** Caddy (HTTPS via Cloudflare Origin Certificates)
- **CDN:** Cloudflare
- **Process management:** PM2

## Arhitectură
Browser ←─ WebSocket ─→ Node.js (port 3000)
↓                         ↓
Caddy (reverse proxy) ←──────┘
↓
Cloudflare (CDN + HTTPS)

Coordonate logice 0-10000, poziționare prin procente, fără pathfinding. Toate validările sunt server-side.

## Rulare locală

```bash
# Instalează dependențele
npm install

# Pornește serverul
node server/index.js

# Sau cu PM2
pm2 start server/index.js --name greva
```

Serverul ascultă pe `127.0.0.1:3000`. Pentru producție, configurează un reverse proxy (Caddy/Nginx) care servește `public/` și face proxy WebSocket către port 3000.

## Configurare

- `server/config.js` — limite, timeouts, pancarte valide
- `server/secrets.js` — date sensibile (webhook Discord etc.) — **NU e inclus în repo**, creează-l manual:

```javascript
module.exports = {
    DISCORD_WEBHOOK_URL: 'your-webhook-url'
};
```

## Confidențialitate

Pentru protestatari și vizitatori nu se colectează nicio dată persistentă. Detalii: [greva.online/confidentialitate](https://greva.online/confidentialitate).

## Licență

[AGPL-3.0](LICENSE) — oricine folosește sau modifică acest cod trebuie să-și publice la rândul lui modificările sub aceeași licență.

## Contribuții

Acest proiect e construit din spirit civic. Sugestii și contribuții sunt binevenite prin Issues și Pull Requests.
