// tests/dashboard.test.js
// Testet die reinen Hilfsfunktionen aus dashboard.js

import { describe, it, expect } from "@jest/globals";
import { getTodayEvents, getTodayVacationers, getPendingRequests } from "../public/src/screens/dashboard.js";

// ============================================================
// getTodayEvents
// ============================================================

describe("Dashboard: getTodayEvents()", () => {
  const today = new Date();
  const mm    = String(today.getMonth() + 1).padStart(2, "0");
  const dd    = String(today.getDate()).padStart(2, "0");
  const todayMMDD = `${mm}-${dd}`;
  const year      = today.getFullYear();

  it("erkennt Geburtstag heute", () => {
    const mitarbeiter = [
      { id: "u1", name: "Anna", geburtstag: todayMMDD, eintrittsdatum: null },
    ];
    const events = getTodayEvents(mitarbeiter);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("Anna");
    expect(events[0].label).toMatch(/Geburtstag/);
  });

  it("erkennt Jubiläum heute", () => {
    const entryYear = year - 5;
    const mitarbeiter = [
      { id: "u2", name: "Bea", geburtstag: null, eintrittsdatum: `${entryYear}-${mm}-${dd}` },
    ];
    const events = getTodayEvents(mitarbeiter);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("Bea");
    expect(events[0].label).toMatch(/5-jähriges/);
  });

  it("gibt leeres Array zurück wenn keine Events heute", () => {
    const otherMMDD = todayMMDD === "01-01" ? "01-02" : "01-01";
    const mitarbeiter = [
      { id: "u3", name: "Clara", geburtstag: otherMMDD, eintrittsdatum: null },
    ];
    const events = getTodayEvents(mitarbeiter);
    expect(events).toHaveLength(0);
  });

  it("erkennt kein Jubiläum wenn Eintrittsjahr gleich aktuellem Jahr", () => {
    const mitarbeiter = [
      { id: "u4", name: "Dana", geburtstag: null, eintrittsdatum: `${year}-${mm}-${dd}` },
    ];
    const events = getTodayEvents(mitarbeiter);
    expect(events).toHaveLength(0);
  });
});

// ============================================================
// getTodayVacationers
// ============================================================

describe("Dashboard: getTodayVacationers()", () => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  const tomorrow  = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const tStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const mitarbeiter = [
    { id: "u1", name: "Anna" },
    { id: "u2", name: "Bea" },
    { id: "u3", name: "Clara" },
  ];

  it("gibt Mitarbeiterin zurück die heute im Urlaub ist", () => {
    const requests = [
      { userId: "u1", type: "urlaub", status: "genehmigt", dateFrom: yStr, dateTo: tStr },
    ];
    const result = getTodayVacationers(requests, mitarbeiter);
    expect(result).toContain("Anna");
  });

  it("gibt keine Mitarbeiterin zurück wenn Urlaub nicht genehmigt", () => {
    const requests = [
      { userId: "u2", type: "urlaub", status: "ausstehend", dateFrom: todayStr, dateTo: todayStr },
    ];
    const result = getTodayVacationers(requests, mitarbeiter);
    expect(result).toHaveLength(0);
  });

  it("gibt keine Mitarbeiterin zurück wenn Urlaub in der Zukunft liegt", () => {
    const requests = [
      { userId: "u3", type: "urlaub", status: "genehmigt", dateFrom: tStr, dateTo: tStr },
    ];
    const result = getTodayVacationers(requests, mitarbeiter);
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// getPendingRequests
// ============================================================

describe("Dashboard: getPendingRequests()", () => {
  it("filtert nur ausstehende + ausstehend-leitung heraus", () => {
    const requests = [
      { id: "r1", status: "ausstehend" },
      { id: "r2", status: "ausstehend-leitung" },
      { id: "r3", status: "genehmigt" },
      { id: "r4", status: "abgelehnt" },
      { id: "r5", status: "ausstehend-kollegin" },
    ];
    const result = getPendingRequests(requests);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(["r1", "r2"]));
  });

  it("gibt leeres Array zurück wenn keine offenen Anträge", () => {
    const requests = [
      { id: "r1", status: "genehmigt" },
      { id: "r2", status: "abgelehnt" },
    ];
    expect(getPendingRequests(requests)).toHaveLength(0);
  });
});
