// tests/api.test.js
// Testet den API-Adapter (api.js) gegen die Mock-Daten.
// Da submitRequest/withdrawRequest/confirmNotification die geteilten Mock-Arrays
// mutieren, wird der Zustand vor jedem Test via beforeEach zurückgesetzt.

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  getCurrentUser,
  getShifts,
  submitRequest,
  withdrawRequest,
  getNotifications,
  confirmNotification,
  getVacations,
  mergePlanAntraegeIntoRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  setPlanData,
  setPinsData,
  validatePin,
  getDebugInfo,
} from "../public/src/data/api.js";
import { MOCK_REQUESTS, MOCK_NOTIFICATIONS } from "../public/src/data/mock.js";

// Initialen Zustand der mutierbaren Arrays sichern (tief genug für unsere Zwecke)
const snapshotRequests = MOCK_REQUESTS.map((r) => ({ ...r }));
const snapshotNotifications = MOCK_NOTIFICATIONS.map((n) => ({
  ...n,
  confirmedBy: [...n.confirmedBy],
  targetGroups: [...n.targetGroups],
}));

// Vor jedem Test Arrays in den Ausgangszustand zurückversetzen
beforeEach(() => {
  MOCK_REQUESTS.splice(
    0,
    MOCK_REQUESTS.length,
    ...snapshotRequests.map((r) => ({ ...r }))
  );
  MOCK_NOTIFICATIONS.splice(
    0,
    MOCK_NOTIFICATIONS.length,
    ...snapshotNotifications.map((n) => ({
      ...n,
      confirmedBy: [...n.confirmedBy],
      targetGroups: [...n.targetGroups],
    }))
  );
});

// ============================================================
// getCurrentUser
// ============================================================

describe("API: getCurrentUser()", () => {
  it("gibt Vanessa Müller zurück", async () => {
    const user = await getCurrentUser();
    expect(user.displayName).toBe("Vanessa Müller");
    expect(user.id).toBe("user-001");
    expect(user.group).toBe("Bären");
  });
});

// ============================================================
// getShifts
// ============================================================

describe("API: getShifts()", () => {
  it('gibt August-2026-Shifts für "user-001" zurück', async () => {
    const shifts = await getShifts("user-001", 8, 2026);
    expect(shifts.length).toBeGreaterThan(0);
    shifts.forEach((s) => {
      expect(s.date).toMatch(/^2026-08/);
      expect(s.userId).toBe("user-001");
    });
  });

  it('gibt leeres Array zurück für unbekannten userId "u1"', async () => {
    const shifts = await getShifts("u1", 8, 2026);
    expect(shifts).toHaveLength(0);
  });

  it("gibt leeres Array zurück wenn kein Monat übereinstimmt", async () => {
    const shifts = await getShifts("user-001", 1, 2025);
    expect(shifts).toHaveLength(0);
  });
});

// ============================================================
// submitRequest
// ============================================================

describe("API: submitRequest()", () => {
  it('fügt Antrag hinzu und setzt Status auf "ausstehend"', async () => {
    const countBefore = MOCK_REQUESTS.length;

    const result = await submitRequest({
      userId: "user-001",
      type: "urlaub",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-05",
      note: "Test-Urlaub",
    });

    expect(result.success).toBe(true);
    expect(MOCK_REQUESTS.length).toBe(countBefore + 1);

    // submitRequest nutzt unshift → neuer Antrag ist Index 0
    const newReq = MOCK_REQUESTS[0];
    expect(newReq.status).toBe("ausstehend");
    expect(newReq.userId).toBe("user-001");
    expect(newReq.type).toBe("urlaub");
    expect(typeof newReq.id).toBe("string");
    expect(newReq.id.length).toBeGreaterThan(0);
  });
});

// ============================================================
// withdrawRequest
// ============================================================

describe("API: withdrawRequest()", () => {
  it("entfernt einen ausstehenden Antrag erfolgreich", async () => {
    // Erst neuen ausstehenden Antrag einreichen
    await submitRequest({
      userId: "user-001",
      type: "dienstwunsch",
      dateFrom: "2026-09-10",
      dateTo: "2026-09-10",
      note: null,
    });
    const newReq = MOCK_REQUESTS[0];
    const countBefore = MOCK_REQUESTS.length;

    const result = await withdrawRequest(newReq.id, "user-001");

    expect(result.success).toBe(true);
    expect(MOCK_REQUESTS.length).toBe(countBefore - 1);
    expect(MOCK_REQUESTS.find((r) => r.id === newReq.id)).toBeUndefined();
  });

  it("schlägt fehl bei genehmigtem Antrag und löscht ihn nicht", async () => {
    const approved = MOCK_REQUESTS.find((r) => r.status === "genehmigt");
    expect(approved).toBeDefined(); // Sicherstellen dass Testdaten stimmen

    const countBefore = MOCK_REQUESTS.length;
    const result = await withdrawRequest(approved.id, "user-001");

    expect(result.success).toBe(false);
    expect(MOCK_REQUESTS.length).toBe(countBefore);
    expect(MOCK_REQUESTS.find((r) => r.id === approved.id)).toBeDefined();
  });

  it("schlägt fehl bei abgelehntem Antrag und löscht ihn nicht", async () => {
    const rejected = MOCK_REQUESTS.find((r) => r.status === "abgelehnt");
    expect(rejected).toBeDefined();

    const countBefore = MOCK_REQUESTS.length;
    const result = await withdrawRequest(rejected.id, "user-001");

    expect(result.success).toBe(false);
    expect(MOCK_REQUESTS.length).toBe(countBefore);
  });
});

// ============================================================
// getNotifications
// ============================================================

describe("API: getNotifications()", () => {
  it('gibt "alle"- UND "Bären"-Mitteilungen für Gruppe "Bären" zurück', async () => {
    const notifs = await getNotifications("Bären");

    const hasAlle = notifs.some((n) => n.targetGroups.includes("alle"));
    const hasBaeren = notifs.some((n) => n.targetGroups.includes("Bären"));

    expect(hasAlle).toBe(true);
    expect(hasBaeren).toBe(true);
  });

  it('gibt NUR "alle"-Mitteilungen für Gruppe "Löwen" zurück (keine Bären-exklusiven)', async () => {
    const notifs = await getNotifications("Löwen");

    expect(notifs.length).toBeGreaterThan(0);

    // Jede zurückgegebene Mitteilung muss "alle" in targetGroups enthalten
    notifs.forEach((n) => {
      expect(n.targetGroups).toContain("alle");
    });

    // Kein Bären-exklusiver Eintrag darf erscheinen
    const baerensOnly = notifs.filter(
      (n) => n.targetGroups.includes("Bären") && !n.targetGroups.includes("alle")
    );
    expect(baerensOnly).toHaveLength(0);
  });
});

// ============================================================
// confirmNotification
// ============================================================

// ============================================================
// getVacations
// ============================================================

describe("API: getVacations()", () => {
  it("gibt leeres Array zurück im Mock-Modus (nur user-001-Daten, kein Urlaub in anderen Gruppen)", async () => {
    const vacations = await getVacations(8, 2026);
    expect(Array.isArray(vacations)).toBe(true);
    expect(vacations).toHaveLength(0);
  });
});

// ============================================================
// mergePlanAntraegeIntoRequests
// ============================================================

describe("API: mergePlanAntraegeIntoRequests()", () => {
  const stored = [
    { id: "r1", userId: "user-1", type: "urlaub",       dateFrom: "2026-09-10", status: "ausstehend", reviewNote: null, reviewedAt: null },
    { id: "r2", userId: "user-1", type: "dienstwunsch", dateFrom: "2026-09-15", status: "ausstehend", reviewNote: null, reviewedAt: null },
  ];

  it("gibt unveränderten Array zurück wenn keine planAntraege vorhanden", () => {
    const result = mergePlanAntraegeIntoRequests(stored, [], "user-1");
    expect(result).toBe(stored); // identische Referenz
  });

  it("aktualisiert Status eines genehmigten Antrags", () => {
    const planAntraege = [
      { mitarbeiterId: "user-1", type: "urlaub", dateFrom: "2026-09-10", status: "genehmigt", begruendung: null },
    ];
    const result = mergePlanAntraegeIntoRequests(stored, planAntraege, "user-1");
    const updated = result.find((r) => r.id === "r1");
    expect(updated.status).toBe("genehmigt");
    expect(updated.reviewNote).toBeNull();
  });

  it("aktualisiert Status eines abgelehnten Antrags mit Begründung", () => {
    const planAntraege = [
      { mitarbeiterId: "user-1", type: "dienstwunsch", dateFrom: "2026-09-15", status: "abgelehnt", begruendung: "Zu wenig Personal" },
    ];
    const result = mergePlanAntraegeIntoRequests(stored, planAntraege, "user-1");
    const updated = result.find((r) => r.id === "r2");
    expect(updated.status).toBe("abgelehnt");
    expect(updated.reviewNote).toBe("Zu wenig Personal");
  });

  it("berührt Anträge anderer User nicht", () => {
    const planAntraege = [
      { mitarbeiterId: "user-2", type: "urlaub", dateFrom: "2026-09-10", status: "genehmigt", begruendung: null },
    ];
    const result = mergePlanAntraegeIntoRequests(stored, planAntraege, "user-1");
    // Kein Antrag von user-1 wurde verändert
    result.forEach((r) => expect(r.status).toBe("ausstehend"));
  });
});

// ============================================================
// getAllRequests / approveRequest / rejectRequest (Mock-Modus)
// ============================================================

describe("API: getAllRequests() im Mock-Modus", () => {
  it("gibt alle Mock-Requests zurück", async () => {
    const all = await getAllRequests();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });
});

describe("API: approveRequest() im Mock-Modus", () => {
  it("setzt Status eines Antrags auf genehmigt", async () => {
    const pending = MOCK_REQUESTS.find((r) => r.status === "ausstehend");
    expect(pending).toBeDefined();
    const result = await approveRequest(pending.id, null);
    expect(result.success).toBe(true);
    expect(pending.status).toBe("genehmigt");
  });
});

describe("API: rejectRequest() im Mock-Modus", () => {
  it("setzt Status eines Antrags auf abgelehnt mit Begründung", async () => {
    const pending = MOCK_REQUESTS.find((r) => r.status === "ausstehend");
    expect(pending).toBeDefined();
    const result = await rejectRequest(pending.id, "Keine freie Stelle");
    expect(result.success).toBe(true);
    expect(pending.status).toBe("abgelehnt");
    expect(pending.reviewNote).toBe("Keine freie Stelle");
  });
});

// ============================================================
// setPinsData
// ============================================================

describe("API: setPinsData()", () => {
  afterEach(() => { setPinsData(null); });

  it("speichert ein Array korrekt — getDebugInfo zeigt pinsLoaded true", () => {
    setPinsData([{ id: "u1", name: "A", gruppe: "X", rolle: "Erzieherin", pin: "1111" }]);
    expect(getDebugInfo().pinsLoaded).toBe(true);
    expect(getDebugInfo().mitarbeiterCount).toBe(1);
  });

  it("ignoriert null — pinsLoaded bleibt false", () => {
    setPinsData(null);
    expect(getDebugInfo().pinsLoaded).toBe(false);
  });

  it("ignoriert Nicht-Array (Objekt) — pinsLoaded bleibt false", () => {
    setPinsData({ id: "u1", pin: "1234" });
    expect(getDebugInfo().pinsLoaded).toBe(false);
  });

  it("überschreibt vorherige Pins-Daten", () => {
    setPinsData([{ id: "u1", name: "A", gruppe: "X", rolle: "Erzieherin", pin: "1111" }]);
    setPinsData([
      { id: "u2", name: "B", gruppe: "X", rolle: "Erzieherin", pin: "2222" },
      { id: "u3", name: "C", gruppe: "X", rolle: "Erzieherin", pin: "3333" },
    ]);
    expect(getDebugInfo().mitarbeiterCount).toBe(2);
    expect(getDebugInfo().firstPinSet).toBe(true);
  });
});

// ============================================================
// getDebugInfo
// ============================================================

describe("API: getDebugInfo()", () => {
  afterEach(() => { setPlanData(null); setPinsData(null); });

  it("gibt Null-Zustand zurück wenn weder Plan noch Pins geladen", () => {
    setPlanData(null);
    setPinsData(null);
    const info = getDebugInfo();
    expect(info.loaded).toBe(false);
    expect(info.pinsLoaded).toBe(false);
    expect(info.mitarbeiterCount).toBe(0);
    expect(info.firstPinSet).toBe(false);
  });

  it("zeigt Mitarbeiter aus pins.json (Priorität vor plan)", () => {
    setPlanData({ mitarbeiter: [{ id: "p1", name: "Plan", gruppe: "X", rolle: "Erzieherin", pin: "0000" }], wochen: [], infos: [] });
    setPinsData([
      { id: "u1", name: "A", gruppe: "X", rolle: "Erzieherin", pin: "1111" },
      { id: "u2", name: "B", gruppe: "X", rolle: "Erzieherin", pin: "2222" },
    ]);
    const info = getDebugInfo();
    expect(info.loaded).toBe(true);
    expect(info.pinsLoaded).toBe(true);
    expect(info.mitarbeiterCount).toBe(2);
    expect(info.firstPinSet).toBe(true);
  });

  it("fällt auf plan.mitarbeiter zurück wenn keine pins.json", () => {
    setPinsData(null);
    setPlanData({ mitarbeiter: [{ id: "u1", name: "A", gruppe: "X", rolle: "Erzieherin", pin: "9999" }], wochen: [], infos: [] });
    const info = getDebugInfo();
    expect(info.loaded).toBe(true);
    expect(info.pinsLoaded).toBe(false);
    expect(info.mitarbeiterCount).toBe(1);
    expect(info.firstPinSet).toBe(true);
  });
});

// ============================================================
// validatePin() mit pins.json
// ============================================================

describe("API: validatePin() mit setPinsData()", () => {
  const pinsList = [
    { id: "u-pins", name: "Test Person", gruppe: "Blaue Gruppe", rolle: "Erzieherin", pin: "777666" },
  ];

  afterEach(() => { setPlanData(null); setPinsData(null); });

  it("gibt null zurück wenn weder pins noch plan geladen", () => {
    expect(validatePin("777666")).toBeNull();
  });

  it("findet PIN in pinsData", () => {
    setPinsData(pinsList);
    const result = validatePin("777666");
    expect(result).not.toBeNull();
    expect(result.id).toBe("u-pins");
    expect(result.displayName).toBe("Test Person");
    expect(result.group).toBe("Blaue Gruppe");
    expect(result.role).toBe("Erzieherin");
  });

  it("gibt null wenn PIN nicht in pinsData", () => {
    setPinsData(pinsList);
    expect(validatePin("000000")).toBeNull();
  });

  it("pinsData hat Priorität vor plan.mitarbeiter", () => {
    setPlanData({ mitarbeiter: [{ id: "plan-user", name: "Plan", gruppe: "X", rolle: "Erzieherin", pin: "777666" }], wochen: [], infos: [] });
    setPinsData(pinsList);
    const result = validatePin("777666");
    expect(result.id).toBe("u-pins");
  });

  it("fällt auf plan.mitarbeiter zurück wenn keine pinsData", () => {
    setPinsData(null);
    setPlanData({ mitarbeiter: [{ id: "plan-user", name: "Fallback Person", gruppe: "Y", rolle: "Erzieherin", pin: "888999" }], wochen: [], infos: [] });
    const result = validatePin("888999");
    expect(result).not.toBeNull();
    expect(result.id).toBe("plan-user");
    expect(result.displayName).toBe("Fallback Person");
  });

  it("gibt null wenn plan.mitarbeiter den PIN auch nicht hat (Fallback leer)", () => {
    setPinsData(null);
    setPlanData({ mitarbeiter: [], wochen: [], infos: [] });
    expect(validatePin("888999")).toBeNull();
  });

  it("trimmt Leerzeichen im eingegebenen PIN", () => {
    setPinsData(pinsList);
    expect(validatePin("  777666  ")).not.toBeNull();
  });
});

describe("API: confirmNotification()", () => {
  it("fügt userId zu confirmedBy hinzu", async () => {
    const testUser = "test-user-confirm-x";
    const notif = MOCK_NOTIFICATIONS.find(
      (n) => !n.confirmedBy.includes(testUser)
    );
    expect(notif).toBeDefined();

    const result = await confirmNotification(notif.id, testUser);

    expect(result.success).toBe(true);
    expect(notif.confirmedBy).toContain(testUser);
  });

  it("fügt denselben userId nicht doppelt hinzu", async () => {
    const testUser = "test-user-double";
    const notif = MOCK_NOTIFICATIONS[0];

    await confirmNotification(notif.id, testUser);
    await confirmNotification(notif.id, testUser);

    const count = notif.confirmedBy.filter((id) => id === testUser).length;
    expect(count).toBe(1);
  });
});
