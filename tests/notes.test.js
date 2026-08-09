// tests/notes.test.js
// Testet die Notiz-Logik: groupNote-Feld im adaptShifts-Adapter
// und das Zusammenspiel von note + groupNote im Schicht-Objekt.

import { describe, it, expect } from "@jest/globals";
import { getShifts }            from "../public/src/data/api.js";
import { MOCK_SHIFTS }          from "../public/src/data/mock.js";

// ============================================================
// Mock-Daten: note und groupNote vorhanden
// ============================================================

describe("Notizen: Mock-Daten haben note und groupNote", () => {
  it("MOCK_SHIFTS enthält Einträge mit note", () => {
    const withNote = MOCK_SHIFTS.filter((s) => s.note);
    expect(withNote.length).toBeGreaterThan(0);
  });

  it("MOCK_SHIFTS enthält Einträge mit groupNote", () => {
    const withGroupNote = MOCK_SHIFTS.filter((s) => s.groupNote);
    expect(withGroupNote.length).toBeGreaterThan(0);
  });

  it("Eintrag mit sowohl note als auch groupNote existiert", () => {
    const both = MOCK_SHIFTS.find((s) => s.note && s.groupNote);
    expect(both).toBeDefined();
    expect(typeof both.note).toBe("string");
    expect(typeof both.groupNote).toBe("string");
  });
});

// ============================================================
// API: getShifts gibt note und groupNote durch
// ============================================================

describe("Notizen: getShifts() liefert note und groupNote", () => {
  it("zurückgegebene Schichten haben das Feld 'note'", async () => {
    const shifts = await getShifts("user-001", 8, 2026);
    expect(shifts.length).toBeGreaterThan(0);
    shifts.forEach((s) => {
      expect("note" in s).toBe(true);
    });
  });

  it("zurückgegebene Schichten haben das Feld 'groupNote'", async () => {
    const shifts = await getShifts("user-001", 8, 2026);
    expect(shifts.length).toBeGreaterThan(0);
    shifts.forEach((s) => {
      expect("groupNote" in s).toBe(true);
    });
  });

  it("Schicht s03 (2026-08-05) hat note 'Elterngespräch 13:00'", async () => {
    const shifts = await getShifts("user-001", 8, 2026);
    const s03 = shifts.find((s) => s.date === "2026-08-05");
    expect(s03).toBeDefined();
    expect(s03.note).toBe("Elterngespräch 13:00");
  });

  it("Schicht s03 (2026-08-05) hat groupNote 'Praktikantin Jana dabei'", async () => {
    const shifts = await getShifts("user-001", 8, 2026);
    const s03 = shifts.find((s) => s.date === "2026-08-05");
    expect(s03).toBeDefined();
    expect(s03.groupNote).toBe("Praktikantin Jana dabei");
  });

  it("Schicht ohne Notiz hat note: null", async () => {
    const shifts = await getShifts("user-001", 8, 2026);
    const noNote = shifts.find((s) => !s.note && !s.groupNote);
    expect(noNote).toBeDefined();
    expect(noNote.note).toBeNull();
    expect(noNote.groupNote).toBeNull();
  });
});

// ============================================================
// Hilfsfunktionen: Notiz-Logik (pure functions)
// ============================================================

describe("Notizen: hasAnyNote Hilfsfunktion", () => {
  function hasAnyNote(shift) {
    return !!(shift?.note || shift?.groupNote);
  }

  it("gibt true zurück wenn note vorhanden", () => {
    expect(hasAnyNote({ note: "Test", groupNote: null })).toBe(true);
  });

  it("gibt true zurück wenn groupNote vorhanden", () => {
    expect(hasAnyNote({ note: null, groupNote: "Gruppeninfo" })).toBe(true);
  });

  it("gibt true zurück wenn beide vorhanden", () => {
    expect(hasAnyNote({ note: "A", groupNote: "B" })).toBe(true);
  });

  it("gibt false zurück wenn beide null", () => {
    expect(hasAnyNote({ note: null, groupNote: null })).toBe(false);
  });

  it("gibt false zurück für null/undefined shift", () => {
    expect(hasAnyNote(null)).toBe(false);
    expect(hasAnyNote(undefined)).toBe(false);
  });
});
