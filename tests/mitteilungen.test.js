// tests/mitteilungen.test.js
// Testet Mitteilungen (mitteilungen.json) und Schwarzes Brett (schwarzes-brett.json):
// Adaptierung ins interne Format, Merge in getNotifications(), Erstellen via GitHub-Push.

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

function makeLocalStorage() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

beforeEach(() => {
  global.localStorage = makeLocalStorage();
});

afterEach(() => {
  delete global.localStorage;
  delete global.fetch;
});

const {
  setPlanData,
  setMitteilungenData,
  setAushaengeData,
  getNotifications,
  getAushaenge,
  createMitteilung,
  createAushang,
  deleteAushang,
} = await import("../public/src/data/api.js");

const { saveGithubToken } = await import("../public/src/data/github.js");

function mockSuccessfulPush() {
  global.fetch = async (url, opts) => {
    if (!opts || opts.method === undefined) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => ({}) };
  };
}

// Nach jedem Test Modul-Zustand zurücksetzen (Mitteilungen/Aushänge/Plan sind Modul-State)
afterEach(() => {
  setPlanData(null);
  setMitteilungenData(null);
  setAushaengeData(null);
});

// ============================================================
// getNotifications(): Merge aus plan-export "infos" + mitteilungen.json
// ============================================================

describe("Mitteilungen: getNotifications() merged App-Mitteilungen mit Plan-Infos", () => {
  it("gibt leeres Array zurück wenn weder Plan noch Mitteilungen vorhanden sind", async () => {
    const notifs = await getNotifications("Bären", "mitarbeiterin");
    expect(notifs).toEqual([]);
  });

  it("gibt in mitteilungen.json erstellte Mitteilungen auch ohne Plan zurück", async () => {
    setMitteilungenData({
      mitteilungen: [
        { id: "m1", titel: "Elternabend", text: "Am 20.09.", prioritaet: "wichtig", zielgruppe: "alle", erstellt: "2026-08-01T10:00:00Z", von: "Sandra" },
      ],
    });
    const notifs = await getNotifications("Bären", "mitarbeiterin");
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Elternabend");
    expect(notifs[0].body).toBe("Am 20.09.");
    expect(notifs[0].priority).toBe("wichtig");
    expect(notifs[0].targetGroups).toEqual(["alle"]);
  });

  it("filtert Mitteilungen mit spezifischer Zielgruppe für nicht betroffene Mitarbeiterinnen heraus", async () => {
    setMitteilungenData({
      mitteilungen: [
        { id: "m1", titel: "Nur Bären", text: "…", prioritaet: "info", zielgruppe: "Bären", erstellt: "2026-08-01T10:00:00Z", von: "Sandra" },
      ],
    });
    const forBaeren = await getNotifications("Bären", "mitarbeiterin");
    expect(forBaeren).toHaveLength(1);

    const forMaeuse = await getNotifications("Mäuse", "mitarbeiterin");
    expect(forMaeuse).toHaveLength(0);
  });

  it("Leitung sieht alle Mitteilungen unabhängig von Zielgruppe", async () => {
    setMitteilungenData({
      mitteilungen: [
        { id: "m1", titel: "Nur Bären", text: "…", prioritaet: "info", zielgruppe: "Bären", erstellt: "2026-08-01T10:00:00Z", von: "Sandra" },
      ],
    });
    const forLeitung = await getNotifications("Leitung", "Leitung");
    expect(forLeitung).toHaveLength(1);
  });

  it("kombiniert Plan-Infos und App-Mitteilungen", async () => {
    setPlanData({
      monat: 8, jahr: 2026,
      infos: [{ id: "p1", titel: "Plan-Info", text: "…", datum: "2026-08-01", zielgruppen: ["alle"] }],
    });
    setMitteilungenData({
      mitteilungen: [{ id: "m1", titel: "App-Mitteilung", text: "…", prioritaet: "info", zielgruppe: "alle", erstellt: "2026-08-02T10:00:00Z", von: "Sandra" }],
    });
    const notifs = await getNotifications("Bären", "mitarbeiterin");
    const ids = notifs.map((n) => n.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("m1");
  });
});

// ============================================================
// createMitteilung(): pusht auf GitHub und aktualisiert lokalen Cache
// ============================================================

describe("Mitteilungen: createMitteilung()", () => {
  it("schlägt fehl ohne GitHub-Token und ändert den Cache nicht", async () => {
    const result = await createMitteilung(
      { titel: "Test", text: "…", prioritaet: "info", zielgruppe: "alle" },
      { displayName: "Sandra Hoffmann" }
    );
    expect(result.success).toBe(false);
    const notifs = await getNotifications("alle", "mitarbeiterin");
    expect(notifs).toHaveLength(0);
  });

  it("fügt bei Erfolg die neue Mitteilung dem lokalen Cache hinzu", async () => {
    saveGithubToken("ghp_valid");
    mockSuccessfulPush();

    const result = await createMitteilung(
      { titel: "Neue Info", text: "Bitte beachten", prioritaet: "sehrwichtig", zielgruppe: "alle" },
      { displayName: "Sandra Hoffmann" }
    );
    expect(result.success).toBe(true);

    const notifs = await getNotifications("Bären", "mitarbeiterin");
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Neue Info");
    expect(notifs[0].priority).toBe("sehrwichtig");
    expect(notifs[0].authorId).toBe("Sandra Hoffmann");
  });
});

// ============================================================
// Schwarzes Brett: getAushaenge() / createAushang() / deleteAushang()
// ============================================================

describe("Schwarzes Brett: getAushaenge()", () => {
  it("blendet abgelaufene Aushänge standardmäßig aus", () => {
    setAushaengeData({
      aushaenge: [
        { id: "a1", titel: "Aktuell", text: "…", ablaufdatum: null, erstellt: "2026-08-01T10:00:00Z", von: "Sandra" },
        { id: "a2", titel: "Abgelaufen", text: "…", ablaufdatum: "2020-01-01", erstellt: "2019-12-01T10:00:00Z", von: "Sandra" },
      ],
    });
    const active = getAushaenge();
    expect(active.map((a) => a.id)).toEqual(["a1"]);

    const all = getAushaenge(true);
    expect(all).toHaveLength(2);
  });

  it("sortiert neueste zuerst", () => {
    setAushaengeData({
      aushaenge: [
        { id: "old", titel: "Alt", text: "…", ablaufdatum: null, erstellt: "2026-01-01T10:00:00Z", von: "Sandra" },
        { id: "new", titel: "Neu", text: "…", ablaufdatum: null, erstellt: "2026-08-01T10:00:00Z", von: "Sandra" },
      ],
    });
    const list = getAushaenge();
    expect(list.map((a) => a.id)).toEqual(["new", "old"]);
  });
});

describe("Schwarzes Brett: createAushang() / deleteAushang()", () => {
  it("schlägt ohne GitHub-Token fehl", async () => {
    const result = await createAushang({ titel: "Hausordnung", text: "…", ablaufdatum: null }, { displayName: "Sandra" });
    expect(result.success).toBe(false);
    expect(getAushaenge()).toHaveLength(0);
  });

  it("erstellt und löscht einen Aushang bei gültigem Token", async () => {
    saveGithubToken("ghp_valid");
    mockSuccessfulPush();

    const created = await createAushang({ titel: "Hausordnung", text: "Bitte Schuhe ausziehen", ablaufdatum: null }, { displayName: "Sandra" });
    expect(created.success).toBe(true);
    const list = getAushaenge();
    expect(list).toHaveLength(1);
    const id = list[0].id;

    const deleted = await deleteAushang(id);
    expect(deleted.success).toBe(true);
    expect(getAushaenge()).toHaveLength(0);
  });
});

