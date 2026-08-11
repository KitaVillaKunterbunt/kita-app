# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Was ist dieses Projekt

PWA (Progressive Web App) für die Kita "Villa Kunterbunt". Vanilla HTML/CSS/JS, kein Framework, kein Build-Schritt. Deployed auf GitHub Pages: `https://kitavillakunterbunt.github.io/kita-app/`

## Befehle

```bash
npm test          # Jest-Tests (106), --experimental-vm-modules
npm run test:watch
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

src/              ← Produktions-Kopie (= GitHub Pages)
sw.js             ← Produktions-SW (= public/sw.js)
index.html        ← Produktions-HTML
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

- `pins.json` → enthält PINs aller Mitarbeiterinnen, **nie** committen
- `plan-export-YYYY-MM.json` → lokale Dateien mit PINs, **nie** committen (gitignored: `plan-export-????-??.json`)
- `plan-export.json` → legacy, ebenfalls gitignored
- `dienstplan.html` → enthält echte Namen, gitignored
- Keine PINs in Debug-Dialogen, console.log oder öffentlichen Dateien

## Plan-Dateien Format

**Lokale Dateien (mit PINs, gitignored):**
- `plan-export-2026-08.json`, `plan-export-2026-09.json` usw.

**Öffentliche Dateien (ohne PINs, im Repo):**
- `plan-export-public-2026-08.json`, `plan-export-public-2026-09.json` usw.
- `plan-export-public.json` (Legacy-Fallback, ein Monat)

Das Dienstplan-Tool (`kita-dienstplan-review/Entwurf_Nr_1_v108.html`) pusht **nur** die öffentliche Variante (ohne PINs) auf GitHub. PINs landen separat in `pins.json`.

## App-Architektur

### Datenladen (`initApp()` in app.js)

1. Versucht lokale Dateien: `plan-export.json` + `plan-export-YYYY-MM.json` für -2..+10 Monate
2. Falls keine lokale Datei → öffentliche Dateien: `plan-export-public.json` + `plan-export-public-YYYY-MM.json`
3. Danach `pins.json` (separate PIN-Datei)
4. Auto-Refresh alle 5 Minuten via `refreshPlanData()`

### Monatssupport (`api.js`)

- `_planMonths = {}` — akkumuliert Pläne, key = `"YYYY-MM"`
- `_buildMergedPlan()` — merged alle Monate zu `_planData`
- `getAvailableMonths()` → sortierte Liste `[{monat, jahr}]`
- `getAllUserShifts(userId)` → Schichten über alle geladenen Monate

### Demo-Modus

`isDemoMode()` = kein `pins.json` UND kein PIN in Mitarbeiter-Daten → Auto-Login als erste Person.

### Auth

PIN-Login via `validatePin(pin)` gegen `pins.json` (Priorität) oder `mitarbeiter[].pin` aus Plan. User-ID wird in `localStorage` gespeichert.

## Service Worker

`sw.js` v30, Network First Strategie. `skipWaiting()` im Install-Event → neue Version aktiviert sofort, `controllerchange` löst `location.reload()` aus. Bei SW-Änderungen: `CACHE_NAME` auf `kita-app-vXX` bumpen.

## Screens & Navigation

Hash-Router: `#home`, `#plan`, `#antrag`, `#antraege`, `#infos`, `#dashboard`. Alle Screens außer Home haben einen `← Startseite` Zurück-Button.

Plan-Screen: Navigation zwischen verfügbaren Monaten, Buttons disabled an den Grenzen.

Antrag-Screen: Kalender öffnet immer auf heutigem Monat. Dienstwunsch-Dropdown zeigt echte Schichtzeiten der Mitarbeiterin (Fallback: Standardzeiten). Freitextfeld "Eigener Wunsch…" verfügbar.

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
