// src/data/github.js
// Direktes Veröffentlichen von JSON-Dateien im GitHub-Repo (Contents API).
// Nur für Leitung: Mitteilungen + Schwarzes Brett werden hierüber gepusht,
// ohne den bisherigen manuellen Export/Upload-Workflow.
//
// Der Token wird gerätegebunden in localStorage gespeichert (kein Server-Backend
// vorhanden — reine Client-App). Empfehlung für die Leitung: ein fein-granulares
// GitHub-Token, das nur Schreibrechte auf dieses eine Repo hat.

const OWNER  = "KitaVillaKunterbunt";
const REPO   = "kita-app";
const BRANCH = "main";
const API_BASE = "https://api.github.com";

const LS_TOKEN_KEY = "kita-github-token";

/** Gespeicherten GitHub-Token lesen (oder null). */
export function getGithubToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LS_TOKEN_KEY) || null;
}

/** Token speichern (leerer/undefined-Wert löscht ihn). */
export function saveGithubToken(token) {
  if (typeof localStorage === "undefined") return;
  const trimmed = (token ?? "").trim();
  if (trimmed) localStorage.setItem(LS_TOKEN_KEY, trimmed);
  else localStorage.removeItem(LS_TOKEN_KEY);
}

/** true wenn ein Token hinterlegt ist (sagt nichts über dessen Gültigkeit aus). */
export function hasGithubToken() {
  return !!getGithubToken();
}

// UTF-8-sicheres Base64-Encoding — btoa() allein kann keine Umlaute/Emojis kodieren.
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Prüft ob der Token gültig ist und Schreibrechte auf das Repo hat.
 * @param {string} [token]  Standard: gespeicherter Token
 * @returns {Promise<{success:boolean, error?:string}>}
 */
export async function testGithubToken(token = getGithubToken()) {
  if (!token) return { success: false, error: "Kein Token hinterlegt." };
  try {
    const resp = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (resp.status === 401) return { success: false, error: "Token ungültig oder abgelaufen." };
    if (resp.status === 404) return { success: false, error: "Repo nicht gefunden oder kein Zugriff mit diesem Token." };
    if (!resp.ok) return { success: false, error: `GitHub-Fehler (${resp.status}).` };
    const data = await resp.json();
    if (data.permissions && data.permissions.push !== true) {
      return { success: false, error: "Token hat keine Schreibrechte auf dieses Repo." };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Verbindung zu GitHub fehlgeschlagen." };
  }
}

/**
 * Erstellt oder überschreibt eine JSON-Datei im Repo (GitHub Contents API).
 * @param {string} path            z. B. "mitteilungen.json"
 * @param {object} dataObj         wird formatiert als JSON gespeichert
 * @param {string} commitMessage
 * @returns {Promise<{success:boolean, error?:string}>}
 */
export async function pushJsonFile(path, dataObj, commitMessage) {
  const token = getGithubToken();
  if (!token) {
    return { success: false, error: "Kein GitHub-Token hinterlegt. Bitte in den Einstellungen eintragen." };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}`;

  try {
    // Aktuelle sha ermitteln (nötig zum Überschreiben einer bestehenden Datei)
    let sha;
    const getResp = await fetch(`${url}?ref=${BRANCH}`, { headers });
    if (getResp.ok) {
      const current = await getResp.json();
      sha = current.sha;
    } else if (getResp.status !== 404) {
      return { success: false, error: `GitHub-Fehler beim Lesen (${getResp.status}).` };
    }

    const putResp = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: commitMessage,
        content: utf8ToBase64(JSON.stringify(dataObj, null, 2)),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });

    if (putResp.status === 401) return { success: false, error: "Token ungültig oder abgelaufen." };
    if (putResp.status === 403) return { success: false, error: "Keine Schreibrechte auf dieses Repo." };
    if (!putResp.ok) {
      const body = await putResp.json().catch(() => ({}));
      return { success: false, error: body.message ?? `GitHub-Fehler (${putResp.status}).` };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Verbindung zu GitHub fehlgeschlagen." };
  }
}
