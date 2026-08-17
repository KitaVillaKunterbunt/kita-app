// tests/github.test.js
// Testet den GitHub-Contents-API-Client (github.js) mit gemocktem fetch + localStorage.

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// Minimaler localStorage-Polyfill für die Node-Testumgebung
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
  getGithubToken,
  saveGithubToken,
  hasGithubToken,
  testGithubToken,
  pushJsonFile,
} = await import("../public/src/data/github.js");

// ============================================================
// Token-Speicherung
// ============================================================

describe("github.js: Token-Speicherung", () => {
  it("gibt null zurück wenn kein Token gespeichert ist", () => {
    expect(getGithubToken()).toBeNull();
    expect(hasGithubToken()).toBe(false);
  });

  it("speichert und liest einen Token", () => {
    saveGithubToken("ghp_test123");
    expect(getGithubToken()).toBe("ghp_test123");
    expect(hasGithubToken()).toBe(true);
  });

  it("löscht den Token bei leerem String", () => {
    saveGithubToken("ghp_test123");
    saveGithubToken("");
    expect(getGithubToken()).toBeNull();
  });

  it("trimmt Whitespace beim Speichern", () => {
    saveGithubToken("  ghp_abc  ");
    expect(getGithubToken()).toBe("ghp_abc");
  });
});

// ============================================================
// testGithubToken()
// ============================================================

describe("github.js: testGithubToken()", () => {
  it("meldet Fehler wenn kein Token übergeben wird", async () => {
    const result = await testGithubToken(null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Token/);
  });

  it("meldet Erfolg bei gültigem Token mit Schreibrechten", async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ permissions: { push: true } }),
    });
    const result = await testGithubToken("ghp_valid");
    expect(result.success).toBe(true);
  });

  it("meldet Fehler bei 401 (ungültiger Token)", async () => {
    global.fetch = async () => ({ ok: false, status: 401 });
    const result = await testGithubToken("ghp_invalid");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ungültig/i);
  });

  it("meldet Fehler wenn keine Schreibrechte vorhanden sind", async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ permissions: { push: false } }),
    });
    const result = await testGithubToken("ghp_readonly");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Schreibrechte/);
  });
});

// ============================================================
// pushJsonFile()
// ============================================================

describe("github.js: pushJsonFile()", () => {
  it("schlägt fehl wenn kein Token hinterlegt ist", async () => {
    const result = await pushJsonFile("mitteilungen.json", { mitteilungen: [] }, "test");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Token/);
  });

  it("erstellt eine neue Datei wenn noch keine sha existiert (404)", async () => {
    saveGithubToken("ghp_valid");
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      if (!opts || opts.method === undefined) {
        // GET (sha ermitteln)
        return { ok: false, status: 404 };
      }
      return { ok: true, status: 201, json: async () => ({}) };
    };
    const result = await pushJsonFile("mitteilungen.json", { mitteilungen: [] }, "Erste Mitteilung");
    expect(result.success).toBe(true);
    const putCall = calls.find((c) => c.opts?.method === "PUT");
    expect(putCall).toBeDefined();
    const body = JSON.parse(putCall.opts.body);
    expect(body.sha).toBeUndefined();
    expect(body.message).toBe("Erste Mitteilung");
  });

  it("überschreibt eine bestehende Datei mit sha", async () => {
    saveGithubToken("ghp_valid");
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      if (!opts || opts.method === undefined) {
        return { ok: true, status: 200, json: async () => ({ sha: "abc123" }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const result = await pushJsonFile("mitteilungen.json", { mitteilungen: [{ id: "1" }] }, "Update");
    expect(result.success).toBe(true);
    const putCall = calls.find((c) => c.opts?.method === "PUT");
    const body = JSON.parse(putCall.opts.body);
    expect(body.sha).toBe("abc123");
  });

  it("kodiert Umlaute korrekt in Base64 (UTF-8-sicher)", async () => {
    saveGithubToken("ghp_valid");
    let putBody;
    global.fetch = async (url, opts) => {
      if (!opts || opts.method === undefined) return { ok: false, status: 404 };
      putBody = JSON.parse(opts.body);
      return { ok: true, status: 201, json: async () => ({}) };
    };
    const payload = { mitteilungen: [{ titel: "Elternabend äöüß" }] };
    await pushJsonFile("mitteilungen.json", payload, "Umlaute-Test");
    const decoded = Buffer.from(putBody.content, "base64").toString("utf-8");
    expect(JSON.parse(decoded)).toEqual(payload);
  });

  it("meldet Fehler bei 401 während des PUT", async () => {
    saveGithubToken("ghp_valid");
    global.fetch = async (url, opts) => {
      if (!opts || opts.method === undefined) return { ok: false, status: 404 };
      return { ok: false, status: 401 };
    };
    const result = await pushJsonFile("mitteilungen.json", {}, "test");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ungültig/i);
  });
});
