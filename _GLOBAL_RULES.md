# Globale Regeln — Kita Mitarbeiter-App

## Pflichtregeln für alle Agenten
1. Nur eine klar definierte Aufgabe pro Agent gleichzeitig.
2. Keine Änderungen außerhalb des eigenen Verantwortungsbereichs.
3. Jede Änderung muss Build, Linter und Tests bestehen.
4. Fehler maximal dreimal automatisch beheben, danach stoppen und dokumentieren.
5. Code sauber dokumentieren.
6. Bestehende Funktionen nicht unbeabsichtigt verändern.
7. Nach jeder Änderung npm test ausführen — alle Tests müssen grün bleiben.
8. Nichts ohne ausdrückliche Freigabe umsetzen.

## Technischer Stack
- Frontend: PWA (HTML/CSS/JS, kein Framework-Overhead)
- Auth: Microsoft Azure AD (MSAL.js)
- Daten: Microsoft Graph API → SharePoint
- Ziel: iOS + Android, installierbar als App-Icon

## Projektstruktur
```
kita-app/
  .claude/agents/    ← Agenten
  src/               ← Quellcode
  public/            ← manifest.json, icons, index.html
  tests/             ← automatische Tests
  docs/              ← Dokumentation
```
