// tests/shift-labels.test.js
// Regression: "Frühdienst" wurde für Schichten angezeigt, deren tatsächliche Startzeit
// nach 07:00 lag (z.B. 08:00–16:30), weil das Label blind vom "type"-Feld des
// Plan-Exports übernommen wurde statt von der echten Uhrzeit abzuleiten.
//
// Regel: "Frühdienst" nur bei Start ≤ 07:00, "Spätdienst" nur bei Ende ≥ 17:00,
// alles dazwischen bekommt kein Label.

import { describe, it, expect } from "@jest/globals";
import { shiftTypeLabel } from "../public/src/utils.js";

describe("shiftTypeLabel()", () => {
  it("gibt 'Frühdienst' bei Start genau 07:00", () => {
    expect(shiftTypeLabel({ type: "frueh", startTime: "07:00", endTime: "14:00" })).toBe("Frühdienst");
  });

  it("gibt 'Frühdienst' bei Start vor 07:00", () => {
    expect(shiftTypeLabel({ type: "frueh", startTime: "06:30", endTime: "14:00" })).toBe("Frühdienst");
  });

  it("gibt KEIN Label bei Start 08:00, obwohl type='frueh' im Export steht (Kern-Bugfix)", () => {
    expect(shiftTypeLabel({ type: "frueh", startTime: "08:00", endTime: "16:30" })).toBe("");
  });

  it("gibt 'Spätdienst' bei Ende genau 17:00", () => {
    expect(shiftTypeLabel({ type: "spaet", startTime: "10:00", endTime: "17:00" })).toBe("Spätdienst");
  });

  it("gibt 'Spätdienst' bei Ende nach 17:00", () => {
    expect(shiftTypeLabel({ type: "spaet", startTime: "12:00", endTime: "19:00" })).toBe("Spätdienst");
  });

  it("gibt KEIN Label bei Ende 16:30, obwohl type='spaet' im Export steht", () => {
    expect(shiftTypeLabel({ type: "spaet", startTime: "09:00", endTime: "16:30" })).toBe("");
  });

  it("gibt KEIN Label für einen normalen Mitteldienst (08:00–16:30)", () => {
    expect(shiftTypeLabel({ type: "dienst", startTime: "08:00", endTime: "16:30" })).toBe("");
  });

  it("'Urlaub', 'Krank', 'Frei' und 'Teildienst' bleiben unabhängig von der Uhrzeit erhalten", () => {
    expect(shiftTypeLabel({ type: "urlaub" })).toBe("Urlaub");
    expect(shiftTypeLabel({ type: "krank" })).toBe("Krank");
    expect(shiftTypeLabel({ type: "frei" })).toBe("Frei");
    expect(shiftTypeLabel({ type: "teil", startTime: "09:00", endTime: "15:00" })).toBe("Teildienst");
  });

  it("gibt leeren String für null/undefined zurück", () => {
    expect(shiftTypeLabel(null)).toBe("");
    expect(shiftTypeLabel(undefined)).toBe("");
  });

  it("eine Schicht die beide Schwellen erfüllt (früh UND spät) bekommt 'Frühdienst' (Priorität Start)", () => {
    expect(shiftTypeLabel({ type: "frueh", startTime: "06:00", endTime: "18:00" })).toBe("Frühdienst");
  });
});
