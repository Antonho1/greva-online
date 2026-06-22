# Greva Online 🦆

Platformă digitală de protest pașnic pentru susținerea grevelor, pichetărilor și protestelor angajaților din România.

**Live:** [greva.online](https://greva.online)

## Ce face

**Greva Online** nu este doar o unealtă tehnică, ci o platformă completă de **conștientizare, promovare și solidaritate**. Proiectul aduce în prim-plan problemele cu care se confruntă sindicatele și angajații în raport cu companiile, oferind vizibilitate cauzelor care contează și un mediu sigur de exprimare.

Platforma oferă un spațiu pașnic de protest digital unde angajații care nu pot participa fizic la o acțiune (din alte orașe, aflați în concediu sau sub presiune ierarhică) își pot exprima susținerea în timp real.

### ✨ Funcționalități Cheie

* **🦆 Protest Live:** Avatare-rățuște interactive care țin pancarte personalizate, randate în timp real.
* **📅 Calendar Public:** Un hub centralizat pentru monitorizarea și promovarea grevelor anunțate la nivel național/sectorial.
* **📝 Implicare Activă:** Sistem rapid de înscriere pentru noi acțiuni (cu verificare și moderare manuală).
* **📢 Conștientizare (Awareness):** Spațiu dedicat expunerii abuzurilor, revendicărilor și problemelor dintre angajați și companii.
* **🔒 Anonimitate Garanatată:** Complet anonim — fără creare de conturi și fără cookie-uri de tracking.
* **✊ Solidaritate:** Suport tehnic și vizual pentru greve, pichetări și proteste de orice amploare.

## Stack tehnic

- **Backend:** Node.js + Socket.io (WebSocket)
- **Reverse proxy:** Caddy (HTTPS via Cloudflare Origin Certificates)
- **CDN:** Cloudflare
- **Process management:** PM2

## Arhitectură

```text
┌────────────────────────────────────────────────────────┐
│                        Browser                         │
└───────────────────────────┬────────────────────────────┘
                            │ ▲
                  WebSocket │ │ 
                            ▼ │
┌────────────────────────────────────────────────────────┐
│                  Node.js (Port 3000)                   │
└───────────────────────────┬────────────────────────────┘
                            │ ▲
                            │ │ Reverse Proxy
                            ▼ │
┌────────────────────────────────────────────────────────┐
│                         Caddy                          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                Cloudflare (CDN + HTTPS)                │
└────────────────────────────────────────────────────────┘

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
