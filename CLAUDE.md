# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Was ist dieses Projekt

PWA (Progressive Web App) für die Kita "Villa Kunterbunt". Vanilla HTML/CSS/JS, kein Framework, kein Build-Schritt. Deployed auf GitHub Pages: `https://kitavillakunterbunt.github.io/kita-app/`

## Befehle

```bash
npm test          # Jest-Tests (101), --experimental-vm-modules
npm run test:watch
node server.js    # Lokaler Admin-Server, Port 3001, 127.0.0.1 only
```

Tests laufen gegen `public/src/data/api.js` und `public/src/data/mock.js`.

## Datei-Struktur

```
public/           ← Entwicklung (lokaler Dev-Server Port 8765)
  src/
    app.js        ← Haupt-Einstiegspunkt, Router, initApp()
    auth.js
    notifications.js
    utils.js
    data/
      api.js      ← Daten-Adapter (plan-export + Mock-Fallback)
      mock.js     ← Mock-Daten für Tests / Demo-Modus
    screens/
      home.js     ← Dashboard, Wochenkarte Mo–Fr, Kachel-Grid
      plan.js     ← Monatskalender mit Schichtanzeige
      antrag.js   ← Urlaub / Dienstwunsch / Diensttausch
      infos.js    ← Mitteilungen
      meine-antraege.js
      dashboard.js ← Leitungs-Dashboard
    styles/
      main.css
  sw.js           ← Service Worker v30, Network First, skipWaiting
  index.html
  admin.html      ← Admin-Panel (passwortgeschützt, /admin)

src/              ← Produktions-Kopie (= GitHub Pages)
sw.js             ← Produktions-SW (= public/sw.js)
index.html        ← Produktions-HTML

server.js         ← Lokaler Admin-Server (Port 3001, nur 127.0.0.1)
pins.json         ← Klartext-PINs für lokalen Server (gitignored, niemals committen)
.env              ← ADMIN_PASSWORD (gitignored)
.env.example      ← Vorlage (ohne Passwort)
scripts/
  strip-dsgvo.js  ← Bereinigt plan-export-public-*.json vor Commit
  rotate-pins.js  ← Generiert neue PINs, zeigt Tabelle, schreibt pins.json
```

**Wichtig:** Nach Änderungen in `public/src/` immer nach `src/` synchronisieren:
```bash
cp public/src/app.js src/app.js
cp public/src/data/api.js src/data/api.js
cp public/src/screens/DATEI.js src/screens/DATEI.js
cp public/src/styles/main.css src/styles/main.css
cp public/sw.js sw.js
```

## Sicherheitsregeln (NICHT verletzen)

- `pins.json` → Klartext-PINs, nur für lokalen Admin-Server. **Nie committen.**
- `plan-export-YYYY-MM.json` → lokale Dateien mit `pinHash`, **nie** committen (gitignored: `plan-export-????-??.json`)
- `plan-export.json` → legacy, ebenfalls gitignored
- `dienstplan.html` → enthält echte Namen, gitignored
- `.env` → enthält ADMIN_PASSWORD, gitignored
- **Niemals** pinHash, PINs oder ADMIN_PASSWORD in Debug-Dialogen oder console.log
- **Bewusste Ausnahme:** `plan-export-public-*.json` enthalten `pinHash`-Felder für Client-Side-PIN-Validierung auf GitHub Pages (kein Server verfügbar). Risiko bekannt und akzeptiert (2026-08-27): SHA-256(userId:pin) eines 6-stelligen PINs ist offline bruteforcebar. Für eine interne Kita-App ohne sensible Daten vertretbar. Nicht ändern ohne explizite Anweisung.

## Plan-Dateien Format

**Lokale Dateien (mit pinHash, gitignored):**
- `plan-export-2026-08.json`, `plan-export-2026-09.json` usw.
- Mitarbeiter-Einträge haben `pinHash`-Feld (SHA-256-Hash)

**Öffentliche Dateien (ohne pinHash/PINs, im Repo):**
- `plan-export-public-2026-08.json`, `plan-export-public-2026-09.json` usw.
- `plan-export-public.json` (Legacy-Fallback, ein Monat)
- Mitarbeiter-Einträge haben **kein** `pinHash` (wird bei Export gestripped)
- Vor Commit: `node scripts/strip-dsgvo.js` ausführen (entfernt auch geburtstag, eintrittsdatum, krank-Einträge)

Das Dienstplan-Tool (`kita-dienstplan-review/Entwurf_Nr_1_v108.html`) pusht **nur** die öffentliche Variante (ohne pinHash). Die privaten Plan-Dateien mit pinHash liegen lokal. Klartext-PINs liegen separat in `pins.json` (nur für Admin-Server).

## App-Architektur

### Datenladen (`initApp()` in app.js)

1. Versucht lokale Dateien: `plan-export.json` + `plan-export-YYYY-MM.json` für -2..+10 Monate
2. Falls keine lokale Datei → öffentliche Dateien: `plan-export-public.json` + `plan-export-public-YYYY-MM.json`
3. Auto-Refresh alle 5 Minuten via `refreshPlanData()`

### Monatssupport (`api.js`)

- `_planMonths = {}` — akkumuliert Pläne, key = `"YYYY-MM"`
- `_buildMergedPlan()` — merged alle Monate zu `_planData`
- `getAvailableMonths()` → sortierte Liste `[{monat, jahr}]`
- `getAllUserShifts(userId)` → Schichten über alle geladenen Monate

### Auth-Architektur (SHA-256 pinHash)

PINs werden **niemals** im Klartext gespeichert. Stattdessen SHA-256-Hash in `mitarbeiter[].pinHash`:

```
pinHash = sha256(userId + ':' + pin)
```

Beispiel: `sha256("user-3:1234")` → hex-String in `mitarbeiter[3].pinHash`

**Relevante Funktionen in `api.js`:**
- `validatePinForUser(userId, pin)` — prüft `sha256(userId + ':' + pin)` gegen `m.pinHash`, async
- `validatePin(pin)` — durchsucht alle Mitarbeiter (für globalen PIN-Login ohne bekannte userId)
- `isDemoMode()` — `true` wenn kein Mitarbeiter ein `pinHash`-Feld hat
- `getDebugInfo()` → `{ loaded, mitarbeiterCount, firstPinHashSet }`

**sha256()** in api.js: dual-environment — Browser via `SubtleCrypto`, Node via `node:crypto`.

### Login-Flow (`showLoginFlow()` in app.js)

3-Schritt-Flow, ersetzt das alte globale PIN-Login:

1. **Step 1** — Mitarbeiternummer eingeben → `POST /api/auth-check` (nur lokaler Server)
   - Gibt `{ found, userId, hasPin }` zurück
   - `found: false` → Fehlermeldung
   - `found: true, disabled: true` (403) → Account gesperrt
2. **Step 2a** (Erstanmeldung, `hasPin: false`) — neuen PIN setzen → `POST /api/set-pin`
3. **Step 2b** (Normal-Login, `hasPin: true`) — PIN eingeben → `validatePinForUser(userId, pin)`
   - Brute-Force-Schutz: 5 Fehlversuche → 10 Min Sperre (`_pinFailCount`, `_pinLockUntil`)

Wenn kein lokaler Server verfügbar (GitHub Pages): App fällt auf globales PIN-Login (`validatePin()`) oder Demo-Modus zurück.

### Demo-Modus

`isDemoMode()` = Plan geladen, aber kein Mitarbeiter hat `pinHash` gesetzt → Auto-Login als erste Person (`getDemoUser()`). Trifft auf GitHub Pages ohne lokalen Server zu, da public-Dateien kein `pinHash` haben.

### Lokaler Admin-Server (`server.js`)

- Port `3001`, bindet nur an `127.0.0.1`
- CORS: nur `localhost:3001`, `localhost:8765`, `127.0.0.1:3001`, `127.0.0.1:8765`
- Session-Tokens: `crypto.randomBytes(32)`, 8h TTL, in-memory Map
- Passwort aus `.env` → `ADMIN_PASSWORD`
- **Endpoints:**
  - `POST /api/admin/login` → Token
  - `GET /api/admin/data` → alle Mitarbeiter aus pins.json
  - `POST /api/admin/reset-pin` → setzt PIN auf null
  - `POST /api/admin/add-employee` → neuen Eintrag
  - `POST /api/admin/deactivate` / `activate`
  - `POST /api/auth-check` → prüft Mitarbeiternummer, gibt `{found, userId, hasPin}`
  - `POST /api/set-pin` → setzt PIN (nur wenn aktuell null, sonst 409)
  - `GET /pins.json` → dient pins.json (für Debugging)
- Path-Traversal-Schutz: `resolve()` + `filePath.startsWith(PUBLIC + sep)`

### Admin-Panel (`admin.html`)

Unter `/admin` — passwortgeschützt via Server-Session.
- Tabelle: Name, Mitarbeiter-Nr., PIN-Status, PIN (toggle-sichtbar), Status (aktiv/gesperrt), Aktionen
- Aktionen: PIN zurücksetzen, Deaktivieren/Aktivieren, Mitarbeiter hinzufügen
- Alle User-Daten via `escapeHTML()` gesichert

### DSGVO-Compliance

`scripts/strip-dsgvo.js` — vor jedem Push public plan-Dateien bereinigen:
```bash
node scripts/strip-dsgvo.js [--dry-run]
```
Entfernt: `mitarbeiter[].geburtstag`, `mitarbeiter[].eintrittsdatum`, `wochen[]` mit `typ === "krank"`.

## Service Worker

`sw.js` v30, Network First Strategie. `skipWaiting()` im Install-Event → neue Version aktiviert sofort, `controllerchange` löst `location.reload()` aus. Bei SW-Änderungen: `CACHE_NAME` auf `kita-app-vXX` bumpen.

## Screens & Navigation

Hash-Router: `#home`, `#plan`, `#antrag`, `#antraege`, `#infos`, `#dashboard`, `#brett`. Alle Screens außer Home haben einen `← Startseite` Zurück-Button.

Plan-Screen: Navigation zwischen verfügbaren Monaten, Buttons disabled an den Grenzen.

Antrag-Screen: Kalender öffnet immer auf heutigem Monat. Dienstwunsch-Dropdown zeigt echte Schichtzeiten der Mitarbeiterin (Fallback: Standardzeiten). Freitextfeld "Eigener Wunsch…" verfügbar.

Settings: Logout-Button öffnet Bestätigungs-Dialog (`.decision-modal-overlay`) vor dem Ausloggen.

## CSS Token

```css
--tile-icon-bg: rgba(0,0,0,0.055)  /* light */
--tile-icon-bg: rgba(255,255,255,0.09)  /* dark */
```

Alle Kacheln einheitlich: nur `color` pro Kachel, `background` immer via `--tile-icon-bg`.

`.home-header__top` hat `padding-right: 52px` damit Notif-Badge nicht mit dem Zahnrad-Button (fixed, top-right) überlappt.

## GitHub Repo

`KitaVillaKunterbunt/kita-app` (öffentlich). Deployment via GitHub Pages aus `main`-Branch (Root).

Verwandte Repos:
- `kita-dienstplan-review` (lokal, `/Users/pierre/Desktop/kita-dienstplan-review/`) — Dienstplan-Generator HTML-Tool, nicht auf GitHub Pages
