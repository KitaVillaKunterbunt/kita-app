#!/usr/bin/env node
// scripts/strip-dsgvo.js
// Entfernt DSGVO-sensible Felder aus plan-export-public-*.json Dateien:
//   - Krankmeldungen (wochen[].typ === "krank")
//   - Geburtstage (mitarbeiter[].geburtstag)
//   - Eintrittsdaten (mitarbeiter[].eintrittsdatum)
//
// Ausführen: node scripts/strip-dsgvo.js [--dry-run]

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname }                          from "path";
import { fileURLToPath }                             from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const DRY_RUN   = process.argv.includes("--dry-run");

const files = readdirSync(ROOT)
  .filter((f) => /^plan-export-public-\d{4}-\d{2}\.json$/.test(f));

if (files.length === 0) {
  console.log("Keine plan-export-public-*.json Dateien gefunden.");
  process.exit(0);
}

let totalStripped = 0;

for (const file of files.sort()) {
  const path = resolve(ROOT, file);
  const data = JSON.parse(readFileSync(path, "utf-8"));

  let changed = false;

  // ── Mitarbeiter: geburtstag + eintrittsdatum entfernen ────
  for (const m of data.mitarbeiter ?? []) {
    if (m.geburtstag !== null && m.geburtstag !== undefined) {
      m.geburtstag = null;
      changed = true;
    }
    if (m.eintrittsdatum !== null && m.eintrittsdatum !== undefined) {
      m.eintrittsdatum = null;
      changed = true;
    }
  }

  // ── Wochen: krank-Einträge entfernen ──────────────────────
  const before = (data.wochen ?? []).length;
  const krankEntries = (data.wochen ?? []).filter((w) => w.typ === "krank");

  if (krankEntries.length > 0) {
    data.wochen = data.wochen.filter((w) => w.typ !== "krank");
    changed = true;
    for (const k of krankEntries) {
      console.log(`  ${file}: Krank-Eintrag entfernt — ${k.datum} ${k.mitarbeiterId}`);
    }
  }

  const after = (data.wochen ?? []).length;
  totalStripped += before - after;

  if (changed) {
    if (DRY_RUN) {
      console.log(`[dry-run] ${file}: würde bereinigt werden.`);
    } else {
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
      console.log(`Bereinigt: ${file}`);
    }
  } else {
    console.log(`Sauber:    ${file}`);
  }
}

console.log(`\nFertig. ${totalStripped} Krank-Eintrag/Einträge entfernt.`);
if (DRY_RUN) console.log("(Dry-Run — keine Dateien geschrieben)");
