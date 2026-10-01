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
* **🔒 Anonimitate Garantată:** Complet anonim — fără creare de conturi și fără cookie-uri de tracking.
* **✊ Solidaritate:** Suport tehnic și vizual pentru greve, pichetări și proteste de orice amploare.

## Stack tehnic

- **Backend:** Node.js + Socket.io (WebSocket)
- **Reverse proxy:** Caddy (HTTPS via Cloudflare Origin Certificates)
- **CDN:** Cloudflare
- **Process management:** PM2

## Arhitectură

```text
┌──────────────────────────────┐
│           Browser            │
└──────────────┬───────────────┘
               │ HTTPS + WebSocket
               ▼
┌──────────────────────────────┐
│   Cloudflare (CDN + HTTPS)   │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│ Caddy (reverse proxy)        │──► fișiere statice din public/
└──────────────┬───────────────┘
               │ /socket.io, /api
               ▼
┌──────────────────────────────┐
│ Node.js + Socket.io          │──► data/inscrieri-pending.jsonl
│ 127.0.0.1:3000               │
└──────────────────────────────┘
```

Coordonate logice 0-10000, poziționare prin procente, fără pathfinding. Toate validările sunt server-side.

## Rulare locală

```bash
# Instalează dependențele
npm install

# (Opțional) notificări Discord pentru înscrieri noi
cp server/secrets.example.js server/secrets.js

# Pornește serverul
node server/index.js

# Sau cu PM2
pm2 start ecosystem.config.js
```

Serverul ascultă pe `127.0.0.1:3000`. Pentru producție, configurează un reverse proxy (Caddy/Nginx) care servește `public/` și face proxy WebSocket către port 3000.

## Configurare

- `server/config.js` — limite, timeouts, pancarte valide. `MAX_CONNECTIONS_PER_IP` poate fi suprascris din variabila de mediu cu același nume.
- `server/secrets.js` — date sensibile (webhook Discord). **NU e inclus în repo**; pornește de la `server/secrets.example.js`.

La fiecare înscriere nouă, Discord primește doar mesajul „Grevă nouă de verificat!”, fără nicio dată din formular. Detaliile rămân pe server, în `data/inscrieri-pending.jsonl`, și se verifică manual înainte de publicare în `public/data/greve.json`.

## Producție (Caddy)

În repo e un exemplu complet: [`Caddyfile.example`](Caddyfile.example). Servește `public/`, trimite `/socket.io` și `/api` către Node, setează cache-ul și anteturile de securitate.

```bash
cp Caddyfile.example Caddyfile   # editează domeniul, calea spre public/ și certificatele
sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

## Calendarul de greve

Grevele publicate sunt în `public/data/greve.json`. Câmpurile unei intrări:

| Câmp | Obligatoriu | Descriere |
|------|-------------|-----------|
| `id` | da | număr unic |
| `tip` | da | `greva`, `pichetare` sau `protest` |
| `data_start` / `data_end` | da / nu | `AAAA-LL-ZZ` |
| `ora_start` / `ora_end` | nu | `HH:MM`, ora României |
| `companie` | da | numele complet |
| `pancarta` | nu | nume scurt pentru pancarta „Grevă la …” (ex: `BRD`, `Metrorex`, `Educație`); implicit se folosește `companie` |
| `sector` | da | folosit la filtrul „Sector” |
| `oras` | nu | folosit la filtrul „Oraș” (ex: `București`, `Național`) |
| `locatie`, `motiv`, `organizator`, `site` | — | afișate pe card |
| `status_override` | nu | `castigata`, `compromis` sau `pierduta`; altfel statusul se calculează din date |
| `rezultat` | nu | text afișat la final |
| `news` | nu | listă de `{ "sursa", "titlu", "url", "data" }` |

Ce se întâmplă automat:

- **Pancarta „Grevă la …”** — cât timp o acțiune e în desfășurare (sau începe în următoarele 24h), protestatarii pot alege o pancartă cu textul ei, generată în browser din `pancarta`/`companie`. Textul vine doar din `greve.json`, nu de la utilizatori.
- **Link direct** spre fiecare card: `/calendar#<pancarta sau companie>-<data_start>`, de ex. `/calendar#brd-2026-08-13`.
- **Export în calendar** — butoanele „Adaugă în calendar” (fișier `.ics`) și „Google Calendar” apar la acțiunile care n-au trecut încă.

## Administrare

Scripturi pentru server, în `scripts/` (necesită `jq`: `sudo apt install jq`):

| Script | Ce face |
|--------|---------|
| `scripts/lista.sh` | înscrierile pending, cu toate detaliile, plus grevele din calendar |
| `scripts/aproba.sh <nr>` | mută înscrierea în `greve.json` (fără email și IP) și o șterge din pending |
| `scripts/respinge.sh <nr>` | șterge înscrierea din pending |
| `scripts/bump.sh` | crește `?v=N` în paginile HTML după modificări de CSS/JS |
| `golive.sh` / `gooffline.sh` | comută între site și pagina „Coming soon” |

## Statistici de participare

Serverul scrie la fiecare oră, în `data/stats.jsonl`, câți protestatari și vizitatori au fost conectați simultan (vârful) și câte intrări au fost. Doar numere, fără IP-uri.

```bash
node scripts/stats.js                 # rezumat pe zile
node scripts/stats.js --zi 2026-10-01 # fiecare oră dintr-o zi
```

## Confidențialitate

Pentru protestatari și vizitatori nu se colectează nicio dată persistentă. Detalii: [greva.online/confidentialitate](https://greva.online/confidentialitate).

## Licență

[AGPL-3.0](LICENSE) — oricine folosește sau modifică acest cod trebuie să-și publice la rândul lui modificările sub aceeași licență.

## Contribuții

Acest proiect e construit din spirit civic. Sugestii și contribuții sunt binevenite prin Issues și Pull Requests.
