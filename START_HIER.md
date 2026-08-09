# 🚀 Kita Mitarbeiter-App — Start hier

## Was diese App macht
- Jede Mitarbeiterin sieht ihren persönlichen Dienstplan auf dem Handy
- Urlaubsanträge und Dienstwünsche direkt in der App stellen
- Krankmeldungen senden
- Login mit dem vorhandenen Microsoft-Account
- Installierbar als App-Icon auf iOS und Android

## Voraussetzungen (einmalig durch IT)
1. Microsoft Graph API freischalten
2. Azure AD App-Registrierung anlegen
3. SharePoint Site „Villa Kunterbunt" bereitstellen

## In 4 Schritten starten

### Schritt 1 — Neues Projekt in Claude Code
```
mkdir ~/Desktop/kita-app
cd ~/Desktop/kita-app
git init
claude
```

### Schritt 2 — Diesen Ordner reinkopieren
Den Inhalt dieses ZIP in `~/Desktop/kita-app` kopieren.
Der Ordner `.claude/agents/` muss mit! (versteckt — Cmd+Shift+. zum Einblenden)

### Schritt 3 — Starten
```
claude
```

### Schritt 4 — Erste Nachricht in Claude Code
```
Starte Phase 1 der Kita Mitarbeiter-App:
1. solution-architect soll die Gesamtarchitektur definieren und dokumentieren
2. sharepoint-engineer soll die SharePoint-Struktur planen
3. pwa-engineer soll das PWA-Grundgerüst aufbauen
4. review-agent prüft am Ende
Nichts ohne Freigabe umsetzen — erst Konzept vorlegen.
```

## Die 7 Agenten
| Agent | Aufgabe |
|---|---|
| solution-architect | Gesamtarchitektur |
| sharepoint-engineer | SharePoint + Graph API |
| pwa-engineer | Handy-App + Login |
| ui-ux-engineer | Design + Bedienung |
| security-engineer | Sicherheit + Datenschutz |
| qa-test-engineer | Tests |
| review-agent | Qualitätsprüfung |

## E-Mail an IT (Vorlage)
Betreff: Microsoft Graph API für Kita-App freischalten

Hallo,
wir möchten eine interne PWA für unsere Mitarbeitenden entwickeln.
Dafür benötige ich:
1. Eine Azure AD App-Registrierung mit folgenden Permissions:
   - User.Read
   - Sites.ReadWrite.All
2. Eine SharePoint Site „Villa Kunterbunt"
3. MSAL.js Redirect URI: https://[unsere-sharepoint-url]/kita-app

Kannst du das einrichten?
Danke!
