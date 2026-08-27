#!/usr/bin/env node
// Migriert plan-export.json vom alten Format (plain "pin") zum neuen Format (SHA-256 "pinHash").
// Liest PINs aus pins.json (autoritative Quelle) und berechnet pinHash = sha256(userId + ':' + pin).
// Schreibt plan-export.json (und alle plan-export-YYYY-MM.json) in public/ neu.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT   = resolve(__dir, "..");
const PUBLIC = resolve(ROOT, "public");

function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

// pins.json lesen
const pinsRaw = JSON.parse(readFileSync(resolve(ROOT, "pins.json"), "utf8"));
const pinsMap  = pinsRaw.pins ?? {}; // { "user-1": "1234", ... }

let migrated = 0;
let skipped  = 0;

function migratePlanFile(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!data.mitarbeiter) return false;

  let changed = false;
  data.mitarbeiter = data.mitarbeiter.map((m) => {
    const pin = pinsMap[m.id];
    if (!pin) {
      skipped++;
      return m; // kein PIN → kein Hash (Account gesperrt oder leer)
    }
    const hash = sha256(m.id + ":" + pin);
    const updated = { ...m, pinHash: hash };
    delete updated.pin; // altes Klartext-Feld entfernen
    migrated++;
    changed = true;
    return updated;
  });

  if (changed) {
    writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
    return true;
  }
  return false;
}

// Alle plan-export*.json in public/ migrieren
const planFiles = readdirSync(PUBLIC)
  .filter((f) => f.startsWith("plan-export") && f.endsWith(".json") && !f.startsWith("plan-export-public"));

if (planFiles.length === 0) {
  console.error("Keine plan-export*.json in public/ gefunden.");
  process.exit(1);
}

for (const f of planFiles) {
  const path = resolve(PUBLIC, f);
  const ok = migratePlanFile(path);
  console.log(`${ok ? "✓" : "–"} ${f}`);
}

console.log(`\nFertig: ${migrated} Hashes gesetzt, ${skipped} ohne PIN übersprungen.`);
console.log("NICHT committen — plan-export*.json enthält pinHash (gitignored).");
