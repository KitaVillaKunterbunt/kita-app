# Kita-App auf GitHub Pages veröffentlichen

Schritt-für-Schritt-Anleitung, ganz ohne Kommandozeile — nur über die GitHub-Weboberfläche.

## Was du brauchst
- Einen kostenlosen GitHub-Account (https://github.com/signup, falls noch nicht vorhanden)
- Die Datei `github-upload.zip` aus diesem Projektordner

## 1. Neues Repository anlegen
1. Bei github.com anmelden.
2. Oben rechts auf **„+"** → **„New repository"** klicken.
3. **Repository name** vergeben, z. B. `kita-app` (der Name erscheint später in der Web-Adresse).
4. **Public** auswählen (bei Private-Repos ist GitHub Pages nur mit kostenpflichtigem Plan verfügbar).
5. **Nichts** ankreuzen (kein README, keine .gitignore, keine Lizenz) — das Repo soll leer bleiben.
6. **„Create repository"** klicken.

## 2. Dateien hochladen
1. Auf der leeren Repo-Seite auf **„uploading an existing file"** klicken (Link mitten im Text).
2. `github-upload.zip` entpacken (Doppelklick auf macOS, oder Rechtsklick → „Alle extrahieren" unter Windows).
   **Wichtig:** Beim Entpacken legt macOS/Windows automatisch einen neuen Ordner namens `github-upload` an (Standardverhalten beim Entpacken, unabhängig vom Inhalt der ZIP-Datei) — `index.html` liegt direkt **in diesem Ordner**, nicht noch eine Ebene tiefer.
3. Diesen `github-upload`-Ordner **öffnen** und **seinen Inhalt** (alle Dateien und Unterordner darin, inkl. der unsichtbaren Datei `.nojekyll` — siehe Hinweis unten) markieren und in das Browser-Upload-Feld ziehen. **Nicht den `github-upload`-Ordner selbst ziehen** — sonst landet alles eine Ebene zu tief im Repo (`github-upload/index.html` statt `index.html`), und GitHub Pages findet die Startseite nicht.
4. Unten bei **„Commit changes"** kurz auf **„Commit changes"** klicken (die Vorbelegung reicht).

**Hinweis zur unsichtbaren `.nojekyll`-Datei:** Dateien, die mit einem Punkt beginnen, sind auf macOS standardmäßig ausgeblendet. Unsichtbare Dateien einblenden: macOS `Cmd+Shift+.` im Finder-Fenster, Windows-Explorer → Ansicht → „Ausgeblendete Elemente". Ohne `.nojekyll` versucht GitHub, die Seite mit seinem Jekyll-System zu verarbeiten — das kann Ordner wie `_`-Präfixe fälschlich ignorieren und zu Fehlern führen.

**Alternative, falls der Browser-Upload beim Entpacken Probleme macht:** Statt die entpackten Dateien einzeln hochzuladen, kannst du GitHub Desktop (https://desktop.github.com) installieren, das Repository klonen und die entpackten Dateien einfach per Finder/Explorer in den lokalen Ordner kopieren, dann in GitHub Desktop committen und pushen.

## 3. GitHub Pages aktivieren
1. Im Repository oben auf **„Settings"** (Zahnrad-Symbol).
2. Links im Menü auf **„Pages"**.
3. Unter **„Build and deployment"** → **„Source"** die Option **„Deploy from a branch"** wählen.
4. Bei **„Branch"**: `main` auswählen, Ordner **`/ (root)`** lassen. **„Save"** klicken.
5. Kurz warten (meist 1–2 Minuten) und die Seite neu laden — oben erscheint dann ein grüner Kasten mit dem Link zur veröffentlichten Seite, z. B. `https://<dein-username>.github.io/kita-app/`.

## 4. App testen
1. Den Link aus Schritt 3.5 öffnen.
2. Prüfen, ob der Dienstplan lädt (nicht dauerhaft bei „Wird geladen…" hängen bleibt).
3. Auf dem Handy öffnen und testen, ob „Zum Home-Bildschirm hinzufügen" funktioniert (PWA-Installation).

## Unterordner-Pfade (bereits erledigt)

`public/manifest.json` (`start_url`) und `public/sw.js` (die `APP_SHELL`-Liste sowie die `plan-export.json`-Sonderbehandlung) sowie die Service-Worker-Registrierung in `index.html` nutzen relative Pfade. Die App funktioniert damit korrekt sowohl unter `https://<dein-username>.github.io/` (Repo heißt `<dein-username>.github.io`) als auch im Unterordner `https://<dein-username>.github.io/kita-app/` (normaler Projekt-Repo-Name) — inklusive PWA-Installation und Offline-Cache des Service Workers.

## Später aktualisieren
Um einen neuen Dienstplan zu veröffentlichen: einfach die neue `plan-export.json` über **„Add file" → „Upload files"** im Repository hochladen (überschreibt die alte automatisch) und committen. Die Seite aktualisiert sich innerhalb weniger Minuten von selbst.
