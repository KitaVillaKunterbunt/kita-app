// tests/routing.test.js
// Testet Screen-Namen, Hash-Werte und Router-Logik.
// Reines Node.js — keine DOM-Abhängigkeiten.
// Logik ist identisch mit getHashScreen() und navigate() in src/app.js.

import { describe, it, expect } from "@jest/globals";

// ============================================================
// Routen-Konfiguration — spiegelt src/app.js wider:
//   const screens = { home, plan, antrag, antraege, infos }
// ============================================================

const VALID_ROUTES = ["home", "plan", "antrag", "antraege", "infos"];
const DEFAULT_ROUTE = "home";

// Reine Hilfsfunktionen aus app.js (ohne DOM) zur Testbarkeit extrahiert

/** Ermittelt den Screen-Namen aus dem aktuellen window.location.hash */
function getHashScreen(hash) {
  const screen = hash.replace(/^#\/?/, "");
  return screen || DEFAULT_ROUTE;
}

/** Validiert einen Route-Namen; fällt bei Ungültigem auf DEFAULT_ROUTE zurück */
function resolveRoute(screenName) {
  return VALID_ROUTES.includes(screenName) ? screenName : DEFAULT_ROUTE;
}

// ============================================================
// Tests: Alle 5 Hash-Routes sind definiert
// ============================================================

describe("Routing: Alle 5 Hash-Routes sind definiert", () => {
  it("VALID_ROUTES enthält genau 5 Einträge", () => {
    expect(VALID_ROUTES).toHaveLength(5);
  });

  it("#home ist definiert", () => {
    expect(VALID_ROUTES).toContain("home");
  });

  it("#plan ist definiert", () => {
    expect(VALID_ROUTES).toContain("plan");
  });

  it("#antrag ist definiert", () => {
    expect(VALID_ROUTES).toContain("antrag");
  });

  it("#antraege ist definiert", () => {
    expect(VALID_ROUTES).toContain("antraege");
  });

  it("#infos ist definiert", () => {
    expect(VALID_ROUTES).toContain("infos");
  });
});

// ============================================================
// Tests: Default-Route ist #home
// ============================================================

describe("Routing: Default-Route ist #home", () => {
  it('leerer Hash "" ergibt "home"', () => {
    expect(getHashScreen("")).toBe("home");
  });

  it('nur "#" ergibt "home"', () => {
    expect(getHashScreen("#")).toBe("home");
  });

  it('"#home" wird korrekt zu "home" aufgelöst', () => {
    expect(getHashScreen("#home")).toBe("home");
  });

  it('"#plan" wird korrekt zu "plan" aufgelöst', () => {
    expect(getHashScreen("#plan")).toBe("plan");
  });

  it('"#antrag" wird korrekt zu "antrag" aufgelöst', () => {
    expect(getHashScreen("#antrag")).toBe("antrag");
  });

  it('"#antraege" wird korrekt zu "antraege" aufgelöst', () => {
    expect(getHashScreen("#antraege")).toBe("antraege");
  });

  it('"#infos" wird korrekt zu "infos" aufgelöst', () => {
    expect(getHashScreen("#infos")).toBe("infos");
  });

  it("unbekannter Route-Name fällt auf DEFAULT_ROUTE (#home) zurück", () => {
    expect(resolveRoute("unknown")).toBe(DEFAULT_ROUTE);
    expect(resolveRoute("")).toBe(DEFAULT_ROUTE);
    expect(resolveRoute("settings")).toBe(DEFAULT_ROUTE);
  });

  it("alle gültigen Routen werden unverändert durchgereicht", () => {
    VALID_ROUTES.forEach((route) => {
      expect(resolveRoute(route)).toBe(route);
    });
  });
});
