#!/usr/bin/env node
// server.js — lokaler PIN-Management-Server
// Startet mit: node server.js
// Dient public/ als statische Dateien (Port 3001) und verwaltet pins.json.

import { createServer }                                       from "http";
import { readFileSync, writeFileSync, existsSync, statSync }  from "fs";
import { resolve, extname, join, dirname }                    from "path";
import { fileURLToPath }                                      from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT      = 3001;
const PUBLIC    = resolve(__dirname, "public");
const PINS_PATH = resolve(__dirname, "pins.json");

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

// ── Hilfsfunktionen ───────────────────────────────────────────

function readPins() {
  if (!existsSync(PINS_PATH)) return { aktualisiert: null, pins: {} };
  return JSON.parse(readFileSync(PINS_PATH, "utf-8"));
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

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJSON(res, status, data) {
  setCORS(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) filePath = join(filePath, "index.html");
    const body = readFileSync(filePath);
    const mime = MIME[extname(filePath)] ?? "application/octet-stream";
    setCORS(res);
    res.writeHead(200, { "Content-Type": mime });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

// ── Request-Handler ───────────────────────────────────────────

async function handleRequest(req, res) {
  setCORS(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url.split("?")[0];

  // ── POST /api/auth-check ──────────────────────────────────
  if (url === "/api/auth-check" && req.method === "POST") {
    try {
      const { number } = await parseBody(req);
      const userId = `user-${number}`;
      const data   = readPins();

      if (!(userId in data.pins)) {
        return sendJSON(res, 404, { found: false });
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

      if (!userId || !pin) {
        return sendJSON(res, 400, { error: "userId und pin erforderlich" });
      }
      if (!/^\d{4,8}$/.test(String(pin))) {
        return sendJSON(res, 400, { error: "PIN muss 4–8 Ziffern haben" });
      }

      const data = readPins();

      if (!(userId in data.pins)) {
        return sendJSON(res, 404, { error: "Mitarbeiter nicht gefunden" });
      }
      if (data.pins[userId] !== null && data.pins[userId] !== undefined) {
        return sendJSON(res, 409, { error: "PIN bereits gesetzt" });
      }

      data.pins[userId] = String(pin);
      writePins(data);
      console.log(`[${new Date().toLocaleTimeString("de-DE")}] PIN gesetzt für ${userId}`);
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // ── GET /pins.json (root-level, für die App) ──────────────
  if (url === "/pins.json" && req.method === "GET") {
    try {
      const data = readPins();
      setCORS(res);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(404); res.end();
    }
    return;
  }

  // ── Statische Dateien aus public/ ─────────────────────────
  serveFile(res, join(PUBLIC, url === "/" ? "index.html" : url));
}

// ── Server starten ────────────────────────────────────────────

createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("[Server] Fehler:", err.message);
    res.writeHead(500); res.end();
  });
}).listen(PORT, () => {
  console.log(`\nKita-App Server → http://localhost:${PORT}`);
  console.log("Ctrl+C zum Beenden.\n");
});
