#!/usr/bin/env node
// rotate-pins.js — einmalig lokal ausführen um alle Mitarbeiter-PINs zu rotieren
// Liest pins.json, generiert neue 4-stellige PINs, zeigt Vorschau, schreibt nach Bestätigung.

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { createInterface } from "readline";
import { randomInt } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

const PINS_PATH   = resolve(ROOT, "pins.json");
const PUBLIC_PATH = resolve(ROOT, "public");
const PIN_DIGITS  = 4;

// ── Laden ──────────────────────────────────────────────────────

function loadPins() {
  try {
    return JSON.parse(readFileSync(PINS_PATH, "utf-8"));
  } catch (e) {
    die(`pins.json nicht lesbar: ${e.message}`);
  }
}

function loadNames() {
  // Namen aus dem neuesten plan-export-public-*.json holen
  const pattern = /^plan-export-public-(\d{4}-\d{2})\.json$/;
  let files = [];
  for (const dir of [ROOT, PUBLIC_PATH]) {
    try {
      const found = readdirSync(dir)
        .filter(f => pattern.test(f))
        .map(f => ({ file: resolve(dir, f), key: f.match(pattern)[1] }));
      files.push(...found);
    } catch { /* ignorieren */ }
  }
  files.sort((a, b) => b.key.localeCompare(a.key));

  for (const { file } of files) {
    try {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      const mitarbeiter = data.mitarbeiter ?? [];
      if (mitarbeiter.length > 0) {
        return Object.fromEntries(mitarbeiter.map(m => [m.id, m.name]));
      }
    } catch { /* nächste Datei versuchen */ }
  }
  return {};
}

// ── PIN-Generierung ────────────────────────────────────────────

function randomPin(digits, forbidden) {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  let pin;
  let attempts = 0;
  do {
    pin = String(randomInt(min, max));
    attempts++;
    if (attempts > 10_000) die("Zu viele Kollisionen bei der PIN-Generierung.");
  } while (forbidden.has(pin));
  return pin;
}

// ── Tabellen-Ausgabe ───────────────────────────────────────────

const ANSI = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
};

function col(str, width) {
  return String(str).padEnd(width);
}

function printTable(rows, names) {
  const W_NAME = Math.max(12, ...rows.map(r => (names[r.id] ?? r.id).length)) + 2;
  const W_OLD  = 12;
  const W_NEW  = 12;
  const LINE   = "─".repeat(W_NAME + W_OLD + W_NEW + 8);

  console.log(`\n${ANSI.bold}${LINE}${ANSI.reset}`);
  console.log(
    `${ANSI.bold}  ${col("Name", W_NAME)}${col("Alter PIN", W_OLD)}${col("Neuer PIN", W_NEW)}${ANSI.reset}`
  );
  console.log(`${ANSI.dim}${LINE}${ANSI.reset}`);

  for (const r of rows) {
    const name = names[r.id] ?? r.id;
    const oldPin = r.oldPin.padStart(PIN_DIGITS + 2, " ");
    const newPin = ANSI.green + r.newPin.padStart(PIN_DIGITS + 2, " ") + ANSI.reset;
    console.log(`  ${col(name, W_NAME)}${ANSI.dim}${oldPin}${ANSI.reset}    ${newPin}`);
  }

  console.log(`${ANSI.bold}${LINE}${ANSI.reset}\n`);
}

// ── Hilfsfunktionen ────────────────────────────────────────────

function die(msg) {
  console.error(`\n${ANSI.red}Fehler: ${msg}${ANSI.reset}\n`);
  process.exit(1);
}

function ask(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── Hauptprogramm ──────────────────────────────────────────────

async function main() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}Kita-App — PIN-Rotation${ANSI.reset}`);
  console.log(`${ANSI.dim}Generiert neue ${PIN_DIGITS}-stellige PINs für alle Mitarbeiterinnen.${ANSI.reset}\n`);

  const pinsFile = loadPins();
  const oldPins  = pinsFile.pins ?? {};
  const names    = loadNames();

  const userIds = Object.keys(oldPins);
  if (userIds.length === 0) {
    die("Keine PINs in pins.json gefunden (leeres pins-Objekt).");
  }

  // Bestehende Werte als verboten markieren
  const usedPins = new Set(Object.values(oldPins).map(String));

  // Neue PINs generieren — kein alter PIN darf wiederverwendet werden
  const rows = [];
  for (const id of userIds) {
    const newPin = randomPin(PIN_DIGITS, usedPins);
    usedPins.add(newPin);
    rows.push({ id, oldPin: String(oldPins[id]), newPin });
  }

  printTable(rows, names);

  console.log(`${ANSI.yellow}⚠  Alte PINs sind nach diesem Schritt ungültig.${ANSI.reset}`);
  console.log(`   Neue PINs müssen den Mitarbeiterinnen mitgeteilt werden.\n`);

  const answer = await ask(`${ANSI.bold}Neue pins.json schreiben? [y/n]: ${ANSI.reset}`);
  if (answer !== "y" && answer !== "yes") {
    console.log(`\n${ANSI.dim}Abgebrochen — keine Änderungen.${ANSI.reset}\n`);
    process.exit(0);
  }

  const newPinsMap = Object.fromEntries(rows.map(r => [r.id, r.newPin]));
  const output = {
    aktualisiert: new Date().toISOString(),
    pins: newPinsMap,
  };

  writeFileSync(PINS_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");

  console.log(`\n${ANSI.green}✓ pins.json gespeichert — ${rows.length} PINs rotiert.${ANSI.reset}`);
  console.log(`${ANSI.dim}Pfad: ${PINS_PATH}${ANSI.reset}\n`);
  console.log(`Nächster Schritt: Dienstplan neu exportieren (Dienstplan-Tool), damit`);
  console.log(`die neuen PINs in plan-export-public-*.json übernommen werden.\n`);
}

main().catch(e => die(String(e)));
