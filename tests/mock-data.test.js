// tests/mock-data.test.js
// Validiert die Vollständigkeit und Korrektheit der Mock-Daten.

import { describe, it, expect } from "@jest/globals";
import {
  MOCK_USER,
  MOCK_SHIFTS,
  MOCK_REQUESTS,
  MOCK_NOTIFICATIONS,
} from "../public/src/data/mock.js";

// ============================================================
// Vanessa Müller
// ============================================================

describe("Mock-Daten: Vanessa Müller (MOCK_USER)", () => {
  it('hat die korrekte id "user-001"', () => {
    expect(MOCK_USER.id).toBe("user-001");
  });

  it('heißt "Vanessa Müller"', () => {
    expect(MOCK_USER.displayName).toBe("Vanessa Müller");
  });

  it('gehört zur Gruppe "Bären"', () => {
    expect(MOCK_USER.group).toBe("Bären");
  });

  it('hat die Rolle "mitarbeiterin"', () => {
    expect(MOCK_USER.role).toBe("mitarbeiterin");
  });

  it("hat eine E-Mail-Adresse", () => {
    expect(MOCK_USER.email).toBeTruthy();
    expect(MOCK_USER.email).toContain("@");
  });
});

// ============================================================
// Shifts — August 2026
// ============================================================

describe("Mock-Daten: Shifts (August 2026)", () => {
  const augustShifts = MOCK_SHIFTS.filter((s) => s.date.startsWith("2026-08"));

  it("hat mindestens 15 August-Shifts", () => {
    expect(augustShifts.length).toBeGreaterThanOrEqual(15);
  });

  it('alle Shifts haben userId === "user-001"', () => {
    expect(MOCK_SHIFTS.every((s) => s.userId === "user-001")).toBe(true);
  });

  it("kein Tag hat zwei Shifts (keine Datum-Duplikate)", () => {
    const dates = MOCK_SHIFTS.map((s) => s.date);
    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(dates.length);
  });

  it("alle Shifts haben ein gültiges Datumsformat YYYY-MM-DD", () => {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    MOCK_SHIFTS.forEach((s) => {
      expect(s.date).toMatch(ISO_DATE);
    });
  });

  it("alle Shifts haben einen definierten Typ", () => {
    const validTypes = ["frueh", "spaet", "teil", "frei", "urlaub", "krank"];
    MOCK_SHIFTS.forEach((s) => {
      expect(validTypes).toContain(s.type);
    });
  });

  it("keine Einträge an Wochenenden (Kita hat keinen Sa/So-Dienst)", () => {
    MOCK_SHIFTS.forEach((s) => {
      const dow = new Date(s.date + "T00:00:00").getDay();
      expect(dow).not.toBe(0); // kein Sonntag
      expect(dow).not.toBe(6); // kein Samstag
    });
  });
});

// ============================================================
// Requests
// ============================================================

describe("Mock-Daten: Requests (Anträge)", () => {
  it("hat mindestens einen ausstehenden Antrag", () => {
    expect(MOCK_REQUESTS.some((r) => r.status === "ausstehend")).toBe(true);
  });

  it("hat mindestens einen genehmigten Antrag", () => {
    expect(MOCK_REQUESTS.some((r) => r.status === "genehmigt")).toBe(true);
  });

  it("hat mindestens einen abgelehnten Antrag", () => {
    expect(MOCK_REQUESTS.some((r) => r.status === "abgelehnt")).toBe(true);
  });

  it("alle Requests haben eine userId", () => {
    MOCK_REQUESTS.forEach((r) => {
      expect(r.userId).toBeTruthy();
    });
  });
});

// ============================================================
// Notifications
// ============================================================

describe('Mock-Daten: Notifications (Mitteilungen)', () => {
  it('hat mindestens eine wichtige Mitteilung (type === "wichtig")', () => {
    expect(MOCK_NOTIFICATIONS.some((n) => n.type === "wichtig")).toBe(true);
  });

  it('hat mindestens eine Mitteilung für Gruppe "Bären"', () => {
    expect(
      MOCK_NOTIFICATIONS.some((n) => n.targetGroups.includes("Bären"))
    ).toBe(true);
  });

  it("alle Mitteilungen haben ein targetGroups-Array", () => {
    MOCK_NOTIFICATIONS.forEach((n) => {
      expect(Array.isArray(n.targetGroups)).toBe(true);
      expect(n.targetGroups.length).toBeGreaterThan(0);
    });
  });

  it("alle Mitteilungen haben ein confirmedBy-Array", () => {
    MOCK_NOTIFICATIONS.forEach((n) => {
      expect(Array.isArray(n.confirmedBy)).toBe(true);
    });
  });
});
