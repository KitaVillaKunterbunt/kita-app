# Architektur — Kita Mitarbeiter-App

Version: 1.0  
Datum: 2026-07-28  
Autor: Solution Architect  
Status: Phase 1 (Mock-Daten, kein SharePoint)

---

## Inhaltsverzeichnis

1. [Tech-Stack und Entscheidungsgrunde](#1-tech-stack-und-entscheidungsgrunde)
2. [Ordnerstruktur](#2-ordnerstruktur)
3. [Die 5 Screens](#3-die-5-screens)
4. [Datenmodell](#4-datenmodell)
5. [Navigation](#5-navigation)
6. [Mock-Datenstrategie](#6-mock-datenstrategie)
7. [PWA-Anforderungen](#7-pwa-anforderungen)
8. [Spatere Integration — SharePoint und Graph API](#8-spatere-integration--sharepoint-und-graph-api)
9. [Sicherheit und Datenschutz](#9-sicherheit-und-datenschutz)

---

## 1. Tech-Stack und Entscheidungsgrunde

### Warum PWA?

Eine Progressive Web App wird gewahlt, weil:

- Keine App-Store-Veroffentlichung notwendig (kein Apple/Google-Reviewprozess)
- Installierbar als App-Icon auf iOS (Safari "Zum Home-Bildschirm") und Android (Chrome)
- Eine einzige Codebasis fur alle Gerate
- Updates ohne Nutzeraktion — neuer Service Worker wird automatisch geladen
- Bekannte Web-Technologien, kein proprietares SDK

### Warum kein Framework (kein React, Vue, Angular)?

- Die App hat genau 5 Screens — kein Routing-Framework benotigt
- Keine komplexen Zustandsbaume, die ein State-Management-Framework rechtfertigen
- Kein Build-Schritt, kein Transpiler, keine node_modules in der Produktion
- Direktes DOM-Rendering ist fur diese Datenmenge ausreichend und schnell
- Entwickler ohne Framework-Kenntnisse konnen den Code lesen und pflegen
- Klares Prinzip: einfachste Losung, die die Anforderungen erfullt

### Warum MSAL.js?

- Microsoft Authentication Library — offizielle Bibliothek von Microsoft fur Azure AD
- Unterstuzt den OAuth 2.0 Authorization Code Flow with PKCE (empfohlen fur SPAs)
- Token-Verwaltung (Refresh, Cache) ist eingebaut
- Bestehendes Microsoft-Konto der Kita-Mitarbeitenden wird genutzt — kein separates Passwort
- Direkte Vorbereitung auf die spatere Graph-API-Integration

### Zukinftige Graph-API-Integration

In Phase 2 ersetzt die Microsoft Graph API alle Mock-Daten:

- `GET /me` — angemeldete Nutzerin laden
- `GET /sites/{site-id}/lists/{list-id}/items` — Dienstplane, Antrage, Mitteilungen lesen
- `POST /sites/{site-id}/lists/{list-id}/items` — Antrage einreichen
- `PATCH /sites/{site-id}/lists/{list-id}/items/{item-id}` — Status andern

---

## 2. Ordnerstruktur

```
kita-app/
|
+-- public/                        Statisch ausgelieferte Dateien (Web-Root)
|   +-- index.html                 Einstiegspunkt — ladt die App-Shell
|   +-- manifest.json              PWA-Manifest (Name, Icons, Theme, Display)
|   +-- sw.js                      Service Worker (Caching, Offline)
|   +-- icons/                     App-Icons in verschiedenen Grossen
|       +-- icon-192.png           Android Home Screen Icon
|       +-- icon-512.png           Android Splash / iOS Icon
|       +-- icon-180.png           Apple Touch Icon (iOS)
|
+-- src/                           Quellcode der App
|   +-- app.js                     Einstiegspunkt — initialisiert Navigation und Auth
|   +-- router.js                  Einfacher Hash-Router (zeigt/versteckt Screens)
|   +-- auth.js                    MSAL.js-Wrapper — Login, Logout, Token
|   |
|   +-- screens/                   Ein Modul pro Screen
|   |   +-- home.js                Screen 1: Wochenuberblick
|   |   +-- plan.js                Screen 2: Monatskalender
|   |   +-- request.js             Screen 3: Antrag stellen
|   |   +-- my-requests.js         Screen 4: Meine Antrage
|   |   +-- info.js                Screen 5: Mitteilungen
|   |
|   +-- components/                Wiederverwendbare UI-Bausteine
|   |   +-- bottom-nav.js          Untere Navigationsleiste
|   |   +-- shift-card.js          Einzelne Dienstkarte (Uhrzeit, Gruppe, Raum)
|   |   +-- request-form.js        Formular fur Antrage (Urlaub, Krankmeldung, Wunsch)
|   |   +-- notification-banner.js Mitteilungsbanner mit Bestatigung
|   |   +-- calendar-grid.js       Monatsraster fur "Mein Plan"
|   |   +-- status-badge.js        Status-Pill (genehmigt / ausstehend / abgelehnt)
|   |
|   +-- data/                      Datenebene — austauschbar zwischen Mock und API
|   |   +-- mock.js                Alle Mock-Daten (Vanessa Muller, August 2026)
|   |   +-- api.js                 API-Adapter — liefert heute Mock, spater Graph API
|   |
|   +-- styles/                    CSS — Mobile-First
|       +-- base.css               Reset, CSS-Variablen (Farben, Abstande, Typografie)
|       +-- components.css         Wiederverwendbare Klassen (Card, Button, Badge)
|       +-- screens.css            Screen-spezifische Layouts
|       +-- navigation.css         Bottom-Navigation-Leiste
|
+-- tests/                         Automatisierte Tests
|   +-- mock.test.js               Validiert Mock-Datenkonsistenz
|   +-- router.test.js             Testet Navigation und Screen-Wechsel
|   +-- request.test.js            Testet Formularvalidierung
|
+-- docs/                          Dokumentation
|   +-- ARCHITECTURE.md            Dieses Dokument
|
+-- .claude/                       Claude-Code-Agenten-Konfiguration
|   +-- agents/                    Agenten-Definitionen
|
+-- _GLOBAL_RULES.md               Verbindliche Regeln fur alle Agenten
+-- START_HIER.md                  Projektuberblick und Schnellstart
```

---

## 3. Die 5 Screens

### Screen 1 — Home (Startseite)

**Dateiname:** `src/screens/home.js`  
**Route:** `#/home` (Standard-Route nach Login)

**Zweck:** Schneller Uberblick uber die aktuelle Woche. Mitarbeiterin sieht sofort, was heute und diese Woche ansteht — ohne zu suchen.

**Angezeigte Daten:**
- Heutiger Dienst: Uhrzeit, Gruppe, Raum
- Kommende Dienste der Woche (Montag bis Freitag)
- Eigene Abwesenheiten diese Woche (Urlaub, Krank)
- Kollegen-Abwesenheiten in der eigenen Gruppe (anonym oder mit Name, je nach Konfiguration)
- Ungelesene Mitteilungen (Badge-Zahler)

**Interaktionen:**
- Tippen auf einen Dienst-Eintrag navigiert zu "Mein Plan" und springt auf den Tag
- Tippen auf ein Mitteilungs-Badge navigiert zu "Infos"
- Pull-to-Refresh aktualisiert die Anzeige (in Phase 2: API-Aufruf)

---

### Screen 2 — Mein Plan (Monatskalender)

**Dateiname:** `src/screens/plan.js`  
**Route:** `#/plan`

**Zweck:** Vollstandige Monatsansicht des personlichen Dienstplans. Mitarbeiterin kann vor- und zuruckblattern.

**Angezeigte Daten:**
- Kalenderraster des aktuellen Monats (Woche beginnt Montag)
- Jeder Tag mit Kurzinformation: Fruh-/Spat-/Teildienst oder frei
- Farbcodierung: Dienst (blau), Urlaub (grun), Krank (orange), Frei (grau)
- Tippen auf einen Tag offnet eine Detailansicht (Modal oder Erweiterung): Exakte Uhrzeiten, Gruppe, Aufgabe

**Interaktionen:**
- Monats-Navigation (Pfeil links/rechts)
- Tag antippen — Details einblenden
- Aktueller Tag ist visuell hervorgehoben

---

### Screen 3 — Antrag stellen

**Dateiname:** `src/screens/request.js`  
**Route:** `#/request`

**Zweck:** Einheitliches Formular fur alle Antrage an die Leitung.

**Antragstypen:**
1. **Urlaubsantrag** — Zeitraum (Von / Bis), optionale Notiz
2. **Dienstwunsch** — Datum, gewunschte Schicht, Begruundung
3. **Krankmeldung** — Datum (heute oder ruckwirkend), voraussichtliche Ruckkehr

**Angezeigte Felder je Typ:**
- Typ-Auswahl (Tab oder Dropdown)
- Datumsfelder (nativer Date-Picker)
- Freitextfeld fur Notiz/Begruundung (optional)
- Absendebutton

**Interaktionen:**
- Typ-Wechsel andert die Felder dynamisch
- Validierung vor dem Absenden (Pflichtfelder, Datumslogik: Startdatum nicht nach Enddatum)
- Erfolgs-Toast nach Absenden
- Navigation zu "Meine Antrage" nach Erfolg

---

### Screen 4 — Meine Antrage

**Dateiname:** `src/screens/my-requests.js`  
**Route:** `#/my-requests`

**Zweck:** Ubersicht aller eigenen Antrage und deren aktueller Status.

**Angezeigte Daten:**
- Liste aller Antrage chronologisch (neueste zuerst)
- Je Eintrag: Typ, Zeitraum, Eingangsdatum, Status-Badge
- Status-Werte: `ausstehend` / `genehmigt` / `abgelehnt`
- Bei Ablehnung: optionale Begrundung der Leitung sichtbar

**Interaktionen:**
- Eintrag antippen offnet Detailansicht
- Ausstehende Antrage konnen zuruckgezogen werden (Loschen-Button)
- Leere Liste zeigt freundlichen Hinweis ("Noch keine Antrage gestellt")

---

### Screen 5 — Infos (Mitteilungen)

**Dateiname:** `src/screens/info.js`  
**Route:** `#/info`

**Zweck:** Interne Kommunikation von der Leitung an die Mitarbeitenden. Wichtige Mitteilungen mussen aktiv bestatigt werden.

**Angezeigte Daten:**
- Liste aller Mitteilungen (neueste zuerst)
- Filter: "Alle", "Fur meine Gruppe" (Baren), "Wichtig"
- Je Eintrag: Titel, Kurztext, Datum, Zielgruppe, Typ (Information / Wichtig)
- Wichtige Mitteilungen: roter Rahmen, Bestatigungsbutton

**Interaktionen:**
- Eintrag antippen expandiert den vollen Text
- "Bestatigt"-Button markiert wichtige Mitteilungen als gelesen
- Unbestatige wichtige Mitteilungen erscheinen oben (fixiert)
- Ungelesene Mitteilungen fuhren zum Badge-Zahler auf dem Home-Screen

---

## 4. Datenmodell

Die folgenden TypeScript-Interfaces definieren die Datenstruktur. In Phase 1 werden sie als JSDoc-Kommentare im Code verwendet, nicht kompiliert.

### User

```typescript
interface User {
  id: string;              // Eindeutige ID (in Phase 2: Azure AD Object ID)
  displayName: string;     // Vollname, z.B. "Vanessa Muller"
  email: string;           // Microsoft-E-Mail
  group: string;           // Zugeordnete Gruppe, z.B. "Baren"
  role: "mitarbeiterin" | "leitung";
}
```

### Shift (Dienst)

```typescript
interface Shift {
  id: string;
  userId: string;          // Referenz auf User.id
  date: string;            // ISO 8601, z.B. "2026-08-03"
  type: "frueh" | "spaet" | "teil" | "frei" | "urlaub" | "krank";
  startTime: string | null; // "07:00" oder null (bei frei/urlaub/krank)
  endTime: string | null;   // "16:00" oder null
  group: string;            // z.B. "Baren"
  room: string | null;      // z.B. "Raum 2" oder null
  note: string | null;      // optionale Anmerkung
}
```

### Request (Antrag)

```typescript
interface Request {
  id: string;
  userId: string;
  createdAt: string;       // ISO 8601 Zeitstempel
  type: "urlaub" | "dienstwunsch" | "krankmeldung";
  status: "ausstehend" | "genehmigt" | "abgelehnt";
  dateFrom: string;        // ISO 8601
  dateTo: string;          // ISO 8601 (gleich wie dateFrom bei Einzeltag)
  note: string | null;
  reviewedAt: string | null;
  reviewNote: string | null; // Begrundung der Leitung bei Ablehnung
}
```

### Notification (Mitteilung)

```typescript
interface Notification {
  id: string;
  createdAt: string;       // ISO 8601 Zeitstempel
  authorId: string;        // User.id der Leitung
  title: string;
  body: string;            // Volltext (Markdown nicht erlaubt — nur Plaintext)
  targetGroups: string[];  // z.B. ["Baren", "Lowen"] oder ["alle"]
  type: "info" | "wichtig";
  confirmedBy: string[];   // Array von User.id — wer hat bestatigt
}
```

---

## 5. Navigation

### Prinzip: Bottom Navigation Bar

Eine fixe Leiste am unteren Bildschirmrand mit 5 Icons. Ideal fur einhandi ge Smartphone-Bedienung (Daumen-Zone).

```
+------------------------------------------+
|                                          |
|          [Screen-Inhalt]                 |
|                                          |
+------------------------------------------+
| [Haus]  [Kalend.] [+]  [Liste]  [Glocke]|
|  Home   MeinPlan  Neu  Antrage   Infos   |
+------------------------------------------+
```

### Technische Umsetzung

- Hash-Router in `src/router.js`
- Jeder Screen hat einen eigenen `<section id="screen-...">` Container
- Beim Navigieren: alle Sections auf `display: none`, Ziel-Section auf `display: block`
- Active-State des Nav-Icons wird per CSS-Klasse `.active` gesetzt
- Kein Seiten-Reload, kein Browser-History-Push in Phase 1

### Routen-Tabelle

| Route          | Screen          | Nav-Icon  |
|----------------|-----------------|-----------|
| `#/home`       | Home            | Haus      |
| `#/plan`       | Mein Plan       | Kalender  |
| `#/request`    | Antrag stellen  | Plus (+)  |
| `#/my-requests`| Meine Antrage   | Liste     |
| `#/info`       | Infos           | Glocke    |

Der Antrag-Button (+) in der Mitte ist grosser dargestellt (Float-Action-Button-Stil) und hat keine Text-Beschriftung.

### Zustand

Der Router halt den aktuellen Screen-Identifier im Modul-Scope. Kein globaler Zustandsbaum. Jeder Screen ist beim Aktivieren fur das Laden und Rendern seiner Daten selbst verantwortlich (lazy rendering).

---

## 6. Mock-Datenstrategie

### Datei: `src/data/mock.js`

Alle Mock-Daten fur Phase 1 liegen in einer einzigen Datei. Sie simuliert den Datenzustand fur August 2026, Testnutzerin Vanessa Muller, Gruppe Baren.

### Aufbau der Datei

```javascript
// src/data/mock.js

export const MOCK_USER = {
  id: "user-001",
  displayName: "Vanessa Muller",
  email: "vanessa.mueller@kita-villakunterbunt.de",
  group: "Baren",
  role: "mitarbeiterin"
};

export const MOCK_SHIFTS = [
  // Vollstandige Arbeitstage fur August 2026
  // Abdeckung: Fruhdienst, Spatdienst, Teildienst, Urlaub, Krank, Frei
  // Mindestens 4 Wochen Daten
];

export const MOCK_REQUESTS = [
  // 3-5 Antrage in verschiedenen Status (ausstehend, genehmigt, abgelehnt)
];

export const MOCK_NOTIFICATIONS = [
  // 4-6 Mitteilungen, davon 2 mit type: "wichtig"
  // Mischung aus "alle" und Gruppen-spezifischen Mitteilungen
];
```

### API-Adapter: `src/data/api.js`

Der Adapter abstrahiert die Datenquelle. Phase 1 gibt Mock-Daten zuruck, Phase 2 ruft Graph API auf. Der Rest der App merkt den Wechsel nicht.

```javascript
// src/data/api.js

import * as mock from "./mock.js";

const USE_MOCK = true; // In Phase 2: false

export async function getCurrentUser() {
  if (USE_MOCK) return mock.MOCK_USER;
  // Phase 2: return await graphApi.getMe();
}

export async function getShifts(userId, month, year) {
  if (USE_MOCK) {
    return mock.MOCK_SHIFTS.filter(
      s => s.userId === userId &&
           s.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)
    );
  }
  // Phase 2: return await graphApi.getShifts(userId, month, year);
}

export async function getRequests(userId) {
  if (USE_MOCK) return mock.MOCK_REQUESTS.filter(r => r.userId === userId);
  // Phase 2: return await graphApi.getRequests(userId);
}

export async function submitRequest(request) {
  if (USE_MOCK) {
    mock.MOCK_REQUESTS.push({ ...request, id: crypto.randomUUID(), status: "ausstehend" });
    return { success: true };
  }
  // Phase 2: return await graphApi.createRequest(request);
}

export async function getNotifications(userGroup) {
  if (USE_MOCK) {
    return mock.MOCK_NOTIFICATIONS.filter(
      n => n.targetGroups.includes("alle") || n.targetGroups.includes(userGroup)
    );
  }
  // Phase 2: return await graphApi.getNotifications(userGroup);
}

export async function confirmNotification(notificationId, userId) {
  if (USE_MOCK) {
    const n = mock.MOCK_NOTIFICATIONS.find(n => n.id === notificationId);
    if (n && !n.confirmedBy.includes(userId)) n.confirmedBy.push(userId);
    return { success: true };
  }
  // Phase 2: return await graphApi.confirmNotification(notificationId, userId);
}

export async function withdrawRequest(requestId, userId) {
  if (USE_MOCK) {
    const idx = mock.MOCK_REQUESTS.findIndex(r => r.id === requestId && r.userId === userId && r.status === "ausstehend");
    if (idx !== -1) mock.MOCK_REQUESTS.splice(idx, 1);
    return { success: idx !== -1 };
  }
  // Phase 2: return await graphApi.deleteRequest(requestId);
}
```

### Datenkonsistenz-Regeln

1. Alle `date`-Felder im Format `YYYY-MM-DD`
2. Alle `createdAt`/`reviewedAt`-Felder im Format ISO 8601 mit Zeitzone: `2026-08-01T08:00:00+02:00`
3. Jede Shift hat exakt einen User
4. Keine zwei Shifts fur denselben User am selben Tag
5. Antrage beziehen sich auf Tage ohne Konflikt mit bestehenden Shifts (Plausibilitat)

---

## 7. PWA-Anforderungen

### manifest.json

```json
{
  "name": "Kita Mitarbeiter-App",
  "short_name": "Kita-App",
  "description": "Dienstplan und Antrage fur Kita-Mitarbeitende",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4A90D9",
  "orientation": "portrait",
  "lang": "de",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

**Wichtige Einstellungen:**
- `display: "standalone"` — versteckt Browser-Adressleiste, App wirkt nativ
- `orientation: "portrait"` — erzwingt Hochformat (Smartphone-Nutzung)
- `theme_color` — farbt die Statusleiste auf Android
- iOS benotigt zusatzlich Meta-Tags in `index.html` (kein Manifest-Support fur alle Felder)

### iOS-spezifische Meta-Tags (in index.html)

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Kita-App">
<link rel="apple-touch-icon" href="icons/icon-180.png">
```

### Service Worker (public/sw.js)

**Strategie: Cache First fur Assets, Network First fur Daten**

```
Cache First:
  - index.html
  - CSS-Dateien
  - JavaScript-Dateien
  - Icons

Network First (Phase 2):
  - API-Aufrufe an Microsoft Graph
```

**Lebenszyklus:**
1. `install` — App-Shell in Cache legen (alle CSS, JS, HTML, Icons)
2. `activate` — Alten Cache loschen (bei Update)
3. `fetch` — Cache-First-Strategie fur App-Shell-Anfragen

**Offline-Verhalten (Phase 1):** Da alle Daten Mock-Daten sind, funktioniert die App vollstandig offline. Phase 2 erfordert Offline-Fallback-Strategie (Letzter bekannter Stand aus Cache anzeigen).

### Install Prompt

In `src/app.js` wird das `beforeinstallprompt`-Event abgefangen:

- Event wird gespeichert, nicht sofort ausgelost
- Nach dem ersten vollstandigen Laden (> 30 Sekunden Nutzung) erscheint ein dezenter Banner: "App installieren?"
- Nutzerinnen, die ablehnen, werden 7 Tage nicht erneut gefragt (localStorage)
- iOS: manueller Hinweis-Dialog (iOS unterstutzt kein automatisches Prompt)

---

## 8. Spatere Integration — SharePoint und Graph API

### Datenpersistenz in SharePoint

In Phase 2 werden vier SharePoint-Listen angelegt:

| SharePoint-Liste  | Entspricht          | Felder                                      |
|-------------------|---------------------|---------------------------------------------|
| `Dienstplaene`    | `Shift[]`           | MitarbeiterID, Datum, Typ, Von, Bis, Gruppe |
| `Antrage`         | `Request[]`         | MitarbeiterID, Typ, Von, Bis, Status, Notiz |
| `Mitteilungen`    | `Notification[]`    | Titel, Text, Typ, Zielgruppen, Bestaetigt   |
| `Mitarbeiter`     | `User[]`            | DisplayName, Email, Gruppe, Rolle           |

### Migration von Mock zu Graph API

1. `USE_MOCK`-Flag in `src/data/api.js` auf `false` setzen
2. MSAL-Konfiguration in `src/auth.js` mit echten Azure-AD-Werten befallen:
   - `clientId` (aus Azure-Portal)
   - `tenantId` (Mandanten-ID der Kita)
   - `authority`
   - `redirectUri`
3. Graph-API-Aufrufe in `api.js` implementieren (die Kommentare sind bereits Platzhalter)
4. SharePoint-Site-ID und Listen-IDs als Konstanten eintragen

### Benotigte Azure AD Permissions (minimale Rechte)

| Permission        | Typ       | Zweck                                          |
|-------------------|-----------|------------------------------------------------|
| `User.Read`       | Delegiert | Angemeldete Nutzerin lesen (Name, Email)       |
| `Sites.Read.All`  | Delegiert | SharePoint-Daten lesen (Dienstplan, Antrage)   |
| `Sites.ReadWrite.All` | Delegiert | Antrage schreiben, Bestatigungensetzen    |

**Minimalprinzip:** Nur die oben genannten Permissions anfordern. Keine Admin-Rechte, keine E-Mail-Zugriffe.

---

## 9. Sicherheit und Datenschutz

### Phase 1 (Mock-Daten)

Auch ohne echten Login gelten folgende Grundsatze:

**Datenisolation:** Jeder Screen filtert Daten nach `userId`. Auch in Mock-Daten ist dieser Filter aktiv — ein spaterer Bug beim API-Wechsel, der alle Daten zuruckgibt, wird so fruher sichtbar.

**Keine sensiblen Daten im Code:** Mock-Daten enthalten keine echten Personendaten, keine Passworter, keine Azure-Secrets. Der Name "Vanessa Muller" ist ein frei gewahlter Testname.

**localStorage-Nutzung:** Nur unkritische Praferenzen werden gespeichert (z.B. ob der Install-Prompt abgelehnt wurde). Keine Dienstplandaten, keine Antrags-IDs in localStorage.

### Phase 2 (mit echtem Login)

**Token-Sicherheit:**
- MSAL.js speichert Tokens im `sessionStorage` (nicht `localStorage`) — Tokens enden bei Tab-Schluss
- PKCE (Proof Key for Code Exchange) verhindert Authorization-Code-Abfang
- Kein Client Secret im Frontend-Code

**Prinzip der minimalen Rechte:**
- Jede Mitarbeiterin sieht nur ihre eigenen Daten
- Die Filterung erfolgt serverseitig (Graph-API-Query nach userId), nicht nur client-seitig
- Die Leitung hat in SharePoint erhohtere Rechte, nicht die App selbst

**HTTPS-Pflicht:**
- PWA-Features (Service Worker, Install Prompt) sind nur uber HTTPS verfugbar
- Kein Fallback auf HTTP in Produktion

**Content Security Policy (CSP):**
- In Phase 2: CSP-Header setzen, der nur `login.microsoftonline.com` und `graph.microsoft.com` als externe Quellen erlaubt
- Inline-Scripts nur mit Nonce oder komplett vermeiden

**Datenschutz (DSGVO-Relevanz):**
- Dienstplandaten sind personenbezogene Arbeitsdaten — Speicherung in SharePoint (EU-Rechenzentrum bei Microsoft 365 Deutschland/EU) ist zulassig
- Keine Weitergabe an Drittanbieter
- Keine Analytics, kein Tracking
- Krankmeldungen sind besonders schutzwurdige Gesundheitsdaten — Zugriff nur fur betroffene Mitarbeiterin und Leitung, nicht fur Kollegen

---

## Anhang: Architekturentscheidungen auf einen Blick

| Entscheidung          | Gewahlt                   | Begrundung                                      |
|-----------------------|---------------------------|-------------------------------------------------|
| App-Typ               | PWA                       | Kein App Store, installierbar, eine Codebasis   |
| Framework             | Kein Framework            | 5 Screens, keine Komplexitat die Framework braucht |
| Auth                  | MSAL.js                   | Azure AD, kein Passwort, Graph-API-ready        |
| Datenhaltung Phase 1  | Mock-Daten (mock.js)      | Kein SharePoint-Zugang notig, sofort entwickelbar |
| Datenhaltung Phase 2  | SharePoint + Graph API    | Bestehendes Microsoft-Okosystem der Kita        |
| Navigation            | Hash-Router + Bottom Nav  | Einfachst mogliche Routing-Losung               |
| Offline               | Service Worker Cache      | App-Shell immer verfugbar                       |
| Datenisolation        | Filter nach userId        | Jede Mitarbeiterin sieht nur eigene Daten       |
