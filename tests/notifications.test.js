// tests/notifications.test.js
// Testet die pure Hilfsfunktionen des Notification-Moduls.
// Keine Browser-APIs — läuft in Node.js.

import { describe, it, expect } from "@jest/globals";
import {
  formatPlanNotificationTitle,
  hasNewPlan,
  getNewNotifications,
  detectNewContent,
} from "../public/src/notifications.js";

// ============================================================
// formatPlanNotificationTitle
// ============================================================

describe("Notifications: formatPlanNotificationTitle()", () => {
  it("gibt korrekten Titel für September 2026 zurück", () => {
    expect(formatPlanNotificationTitle(9, 2026)).toBe("Neuer Dienstplan September 2026");
  });

  it("gibt korrekten Titel für Januar 2027 zurück", () => {
    expect(formatPlanNotificationTitle(1, 2027)).toBe("Neuer Dienstplan Januar 2027");
  });
});

// ============================================================
// hasNewPlan
// ============================================================

describe("Notifications: hasNewPlan()", () => {
  const older = "2026-07-01T00:00:00.000Z";
  const newer = "2026-07-30T00:00:00.000Z";

  it("gibt false zurück beim ersten App-Start (kein letzter Plan gespeichert)", () => {
    expect(hasNewPlan(null, newer)).toBe(false);
  });

  it("gibt false zurück wenn gleicher exportiert-Zeitstempel", () => {
    expect(hasNewPlan(newer, newer)).toBe(false);
  });

  it("gibt true zurück wenn Plan neuer als zuletzt gesehen", () => {
    expect(hasNewPlan(older, newer)).toBe(true);
  });

  it("gibt false zurück wenn Plan älter als zuletzt gesehen", () => {
    expect(hasNewPlan(newer, older)).toBe(false);
  });

  it("gibt false zurück wenn kein aktueller Plan vorhanden", () => {
    expect(hasNewPlan(older, null)).toBe(false);
  });
});

// ============================================================
// getNewNotifications
// ============================================================

describe("Notifications: getNewNotifications()", () => {
  const lastVisit = "2026-07-27T00:00:00.000Z";

  const notifs = [
    { id: "n1", createdAt: "2026-07-28T00:00:00.000Z", targetGroups: ["alle"] },
    { id: "n2", createdAt: "2026-07-28T00:00:00.000Z", targetGroups: ["Bären"] },
    { id: "n3", createdAt: "2026-07-28T00:00:00.000Z", targetGroups: ["Mäuse"] },
    { id: "n4", createdAt: "2026-07-26T00:00:00.000Z", targetGroups: ["alle"] }, // zu alt
  ];

  it("gibt leeres Array zurück wenn keine Notifications übergeben", () => {
    expect(getNewNotifications([], lastVisit, "Bären")).toHaveLength(0);
  });

  it("filtert Mitteilungen für die eigene Gruppe korrekt", () => {
    const result = getNewNotifications(notifs, lastVisit, "Bären");
    expect(result.map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it('schließt Mitteilungen der falschen Gruppe aus (hier "Mäuse")', () => {
    const result = getNewNotifications(notifs, lastVisit, "Bären");
    expect(result.find((n) => n.id === "n3")).toBeUndefined();
  });

  it("schließt Mitteilungen aus die vor dem letzten Besuch erstellt wurden", () => {
    const result = getNewNotifications(notifs, lastVisit, "Bären");
    expect(result.find((n) => n.id === "n4")).toBeUndefined();
  });

  it("gibt alle relevanten Mitteilungen zurück wenn kein lastVisit gesetzt (Erstinstallation)", () => {
    const result = getNewNotifications(notifs, null, "Bären");
    // n1, n2, n4 relevant für Bären, n3 nicht
    expect(result.map((n) => n.id)).toContain("n1");
    expect(result.map((n) => n.id)).toContain("n2");
    expect(result.map((n) => n.id)).toContain("n4");
    expect(result.find((n) => n.id === "n3")).toBeUndefined();
  });
});

// ============================================================
// detectNewContent
// ============================================================

describe("Notifications: detectNewContent()", () => {
  const user = { id: "user-001", group: "Bären", role: "mitarbeiterin" };
  const exportedNew = "2026-07-30T02:00:00.000Z";
  const exportedOld = "2026-07-20T02:00:00.000Z";
  const lastVisit   = "2026-07-27T00:00:00.000Z";

  it("gibt einen Plan-Eintrag zurück wenn Plan neu", () => {
    const items = detectNewContent(user, exportedNew, 9, 2026, [], exportedOld, exportedOld);
    expect(items.some((i) => i.type === "plan")).toBe(true);
    expect(items.find((i) => i.type === "plan")?.hash).toBe("plan");
  });

  it("gibt keinen Plan-Eintrag zurück wenn Plan unverändert", () => {
    const items = detectNewContent(user, exportedNew, 9, 2026, [], lastVisit, exportedNew);
    expect(items.some((i) => i.type === "plan")).toBe(false);
  });

  it("gibt Notification-Eintrag zurück wenn neue Mitteilung vorliegt", () => {
    const notifs = [
      { id: "n1", createdAt: "2026-07-28T00:00:00.000Z", title: "Test", body: "Inhalt", targetGroups: ["alle"] },
    ];
    const items = detectNewContent(user, null, null, null, notifs, lastVisit, null);
    expect(items.some((i) => i.type === "notification")).toBe(true);
    expect(items.find((i) => i.type === "notification")?.hash).toBe("infos");
  });

  it("gibt leeres Array zurück wenn keine neuen Inhalte", () => {
    const items = detectNewContent(user, exportedNew, 9, 2026, [], lastVisit, exportedNew);
    expect(items).toHaveLength(0);
  });
});
