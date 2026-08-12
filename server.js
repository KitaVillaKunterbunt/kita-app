#!/usr/bin/env node
// server.js — lokaler PIN-Management-Server (nur 127.0.0.1)
// Startet mit: node server.js
// Voraussetzung: .env mit ADMIN_PASSWORD=...

import { createServer }                                                    from "http";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "fs";
import { resolve, extname, join, dirname, sep }                           from "path";
import { fileURLToPath }                                                   from "url";
import { randomBytes }                                                     from "crypto";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const PORT       = 3001;
const PUBLIC     = resolve(__dirname, "public");
const PINS_PATH  = resolve(__dirname, "pins.json");
const ADMIN_HTML = resolve(__dirname, "admin.html");

// ── .env laden (kein npm-Paket) ───────────────────────────────
;(function loadEnv() {
  const p = resolve(__dirname, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx < 0) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    process.env[k] ??= v;
  }
})();

// ── MIME-Typen ────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".svg":  "image/svg+xml",
  ".webp": "image/webp",
};

// ── Erlaubte CORS-Origins (nur localhost) ─────────────────────
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3001",
  "http://localhost:8765",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:8765",
]);

// ── Session-Management ────────────────────────────────────────
const sessions    = new Map(); // token → expiryMs
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 h

function createSession() {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function requireAuth(req) {
  const auth  = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) { sessions.delete(token); return false; }
  return true;
}

// ── Hilfsfunktionen ───────────────────────────────────────────
function setCORS(res, req) {
  const origin = req?.headers?.origin ?? "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin",  origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function readPins() {
  if (!existsSync(PINS_PATH)) return { aktualisiert: null, pins: {}, disabled: [] };
  const d = JSON.parse(readFileSync(PINS_PATH, "utf-8"));
  if (!Array.isArray(d.disabled)) d.disabled = [];
  return d;
}

function writePins(data) {
  data.aktualisiert = new Date().toISOString();
  writeFileSync(PINS_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function parseBody(req) {
  return new Promise((res, rej) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try { res(JSON.parse(raw || "{}")); }
      catch { rej(new Error("Ungültiges JSON")); }
    });
    req.on("error", rej);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) filePath = join(filePath, "index.html");
    const body = readFileSync(filePath);
    const mime = MIME[extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

// ── Plan-Dateien für Namen ────────────────────────────────────
function readPlanNames() {
  const names = {};
  try {
    const files = readdirSync(__dirname)
      .filter((f) => /^plan-export(-public)?-\d{4}-\d{2}\.json$/.test(f))
      .sort()
      .reverse(); // neueste zuerst
    for (const file of files) {
      try {
        const d = JSON.parse(readFileSync(resolve(__dirname, file), "utf-8"));
        for (const m of d.mitarbeiter ?? []) {
          if (!names[m.id]) {
            names[m.id] = { name: m.name ?? m.id, gruppe: m.gruppe ?? "", rolle: m.rolle ?? "" };
          }
        }
      } catch { /* fehlerhafte Datei überspringen */ }
    }
  } catch { /* kein Plan vorhanden */ }
  return names;
}

// ── Request-Handler ───────────────────────────────────────────
async function handleRequest(req, res) {
  setCORS(res, req);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url.split("?")[0];

  // ── Admin-UI ──────────────────────────────────────────────
  if (url === "/admin" || url === "/admin.html") {
    serveFile(res, ADMIN_HTML);
    return;
  }

  // ── POST /api/admin/login ─────────────────────────────────
  if (url === "/api/admin/login" && req.method === "POST") {
    const { password } = await parseBody(req);
    const adminPw = process.env.ADMIN_PASSWORD;
    if (!adminPw) return sendJSON(res, 503, { error: "ADMIN_PASSWORD fehlt in .env" });
    if (!password || password !== adminPw) {
      return sendJSON(res, 401, { error: "Falsches Passwort" });
    }
    console.log(`[${new Date().toLocaleTimeString("de-DE")}] Admin eingeloggt`);
    return sendJSON(res, 200, { token: createSession() });
  }

  // ── Admin-Endpoints (Auth erforderlich) ───────────────────
  if (url.startsWith("/api/admin/")) {
    if (!requireAuth(req)) return sendJSON(res, 401, { error: "Nicht autorisiert" });

    // GET /api/admin/data
    if (url === "/api/admin/data" && req.method === "GET") {
      const pins  = readPins();
      const names = readPlanNames();
      const employees = Object.entries(pins.pins).map(([userId, pin]) => {
        const num  = userId.replace("user-", "");
        const info = names[userId] ?? {};
        return {
          userId,
          number:   num,
          name:     info.name    ?? `Mitarbeiter ${num}`,
          gruppe:   info.gruppe  ?? "",
          rolle:    info.rolle   ?? "",
          pin,
          hasPin:   pin !== null && pin !== undefined,
          disabled: (pins.disabled ?? []).includes(userId),
        };
      });
      return sendJSON(res, 200, { employees });
    }

    // POST /api/admin/reset-pin
    if (url === "/api/admin/reset-pin" && req.method === "POST") {
      const { userId } = await parseBody(req);
      if (!userId) return sendJSON(res, 400, { error: "userId fehlt" });
      const data = readPins();
      if (!(userId in data.pins)) return sendJSON(res, 404, { error: "Nicht gefunden" });
      data.pins[userId] = null;
      writePins(data);
      console.log(`[${new Date().toLocaleTimeString("de-DE")}] PIN zurückgesetzt: ${userId}`);
      return sendJSON(res, 200, { success: true });
    }

    // POST /api/admin/add-employee
    if (url === "/api/admin/add-employee" && req.method === "POST") {
      const { number } = await parseBody(req);
      const num = String(number ?? "").trim();
      if (!num || !/^\d+$/.test(num)) return sendJSON(res, 400, { error: "Ungültige Nummer" });
      const userId = `user-${num}`;
      const data   = readPins();
      if (userId in data.pins) return sendJSON(res, 409, { error: "Mitarbeiter existiert bereits" });
      data.pins[userId] = null;
      writePins(data);
      console.log(`[${new Date().toLocaleTimeString("de-DE")}] Hinzugefügt: ${userId}`);
      return sendJSON(res, 200, { success: true, userId });
    }

    // POST /api/admin/deactivate
    if (url === "/api/admin/deactivate" && req.method === "POST") {
      const { userId } = await parseBody(req);
      if (!userId) return sendJSON(res, 400, { error: "userId fehlt" });
      const data = readPins();
      if (!(userId in data.pins)) return sendJSON(res, 404, { error: "Nicht gefunden" });
      if (!data.disabled.includes(userId)) data.disabled.push(userId);
      writePins(data);
      console.log(`[${new Date().toLocaleTimeString("de-DE")}] Deaktiviert: ${userId}`);
      return sendJSON(res, 200, { success: true });
    }

    // POST /api/admin/activate
    if (url === "/api/admin/activate" && req.method === "POST") {
      const { userId } = await parseBody(req);
      if (!userId) return sendJSON(res, 400, { error: "userId fehlt" });
      const data = readPins();
      data.disabled = data.disabled.filter((id) => id !== userId);
      writePins(data);
      console.log(`[${new Date().toLocaleTimeString("de-DE")}] Aktiviert: ${userId}`);
      return sendJSON(res, 200, { success: true });
    }

    return sendJSON(res, 404, { error: "Nicht gefunden" });
  }

  // ── POST /api/auth-check ──────────────────────────────────
  if (url === "/api/auth-check" && req.method === "POST") {
    try {
      const { number } = await parseBody(req);
      const userId = `user-${number}`;
      const data   = readPins();
      if (!(userId in data.pins)) return sendJSON(res, 404, { found: false });
      if ((data.disabled ?? []).includes(userId)) {
        return sendJSON(res, 403, { found: true, disabled: true });
      }
      const hasPin = data.pins[userId] !== null && data.pins[userId] !== undefined;
      return sendJSON(res, 200, { found: true, userId, hasPin });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // ── POST /api/set-pin ─────────────────────────────────────
  if (url === "/api/set-pin" && req.method === "POST") {
    try {
      const { userId, pin } = await parseBody(req);
      if (!userId || !pin) return sendJSON(res, 400, { error: "userId und pin erforderlich" });
      if (!/^\d{4,8}$/.test(String(pin))) return sendJSON(res, 400, { error: "PIN muss 4–8 Ziffern haben" });
      const data = readPins();
      if (!(userId in data.pins)) return sendJSON(res, 404, { error: "Mitarbeiter nicht gefunden" });
      if (data.pins[userId] !== null && data.pins[userId] !== undefined) {
        return sendJSON(res, 409, { error: "PIN bereits gesetzt" });
      }
      data.pins[userId] = String(pin);
      writePins(data);
      console.log(`[${new Date().toLocaleTimeString("de-DE")}] PIN gesetzt: ${userId}`);
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // ── GET /pins.json ────────────────────────────────────────
  if (url === "/pins.json" && req.method === "GET") {
    const data = readPins();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }

  // ── Statische Dateien aus public/ (Path-Traversal-Schutz) ─
  try {
    const rawPath = decodeURIComponent(url === "/" ? "/index.html" : url);
    if (rawPath.includes("\0")) { res.writeHead(400); res.end(); return; }
    const filePath = resolve(PUBLIC, "." + rawPath);
    if (filePath !== PUBLIC && !filePath.startsWith(PUBLIC + sep)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    serveFile(res, filePath);
  } catch {
    res.writeHead(400); res.end();
  }
}

// ── Server starten (nur localhost) ────────────────────────────
createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("[Server] Fehler:", err.message);
    try { res.writeHead(500); res.end(); } catch { /* already sent */ }
  });
}).listen(PORT, "127.0.0.1", () => {
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("\n  WARNUNG: ADMIN_PASSWORD fehlt! Erstelle .env mit ADMIN_PASSWORD=...\n");
  }
  console.log(`\nKita-App Server  → http://localhost:${PORT}`);
  console.log(`Admin-Panel      → http://localhost:${PORT}/admin`);
  console.log("Ctrl+C zum Beenden.\n");
});
