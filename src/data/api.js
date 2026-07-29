// src/data/api.js
// API-Adapter — 3 Datenquellen (Priorität):
//   1. plan-export.json  (wenn von Leitung exportiert)
//   2. Mock-Daten        (Entwicklung / Fallback)
//   3. Graph API         (Phase 8, SharePoint)

import * as mock from "./mock.js";

const USE_MOCK = true;

// ============================================================
// Plan-Daten (plan-export.json)
// ============================================================

// Wird von app.js via setPlanData() gefüllt wenn plan-export.json geladen wurde.
let _planData = null;

/** Plan-Daten setzen (aufgerufen von app.js nach fetch von plan-export.json) */
export function setPlanData(data) {
  _planData = data ?? null;
}

// Kein crypto.randomUUID() — schlägt auf nicht-HTTPS-Verbindungen fehl
function _genId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

const LS_REQUESTS_KEY = "kita-requests";

function _lsGetRequests() {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_REQUESTS_KEY) ?? "[]"); }
  catch { return []; }
}

function _lsSaveRequests(all) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_REQUESTS_KEY, JSON.stringify(all));
}

/** Gibt true zurück wenn ein exportierter Plan verfügbar ist */
export function hasPlanData() {
  return _planData !== null;
}

// In-Memory-Bestätigungen für plan-export-Notifications (Fallback bis SharePoint)
const _confirmedBy = {};

function _planConfirmedBy(notifId) {
  return _confirmedBy[notifId] ?? [];
}

function _addPlanConfirmedBy(notifId, userId) {
  if (!_confirmedBy[notifId]) _confirmedBy[notifId] = [];
  if (!_confirmedBy[notifId].includes(userId)) _confirmedBy[notifId].push(userId);
}

// ============================================================
// Adapter: plan-export.json → internes Format
// ============================================================

function adaptShifts(wochen) {
  return (wochen ?? []).map((w) => ({
    id:        `${w.mitarbeiterId}-${w.datum}`,
    userId:    w.mitarbeiterId,
    date:      w.datum,
    type:      w.typ,
    startTime: w.vonUhr  ?? null,
    endTime:   w.bisUhr  ?? null,
    group:     w.gruppe  ?? "",
    room:      w.raum    ?? null,
    note:      w.notiz   ?? null,
  }));
}

function adaptNotifications(infos) {
  return (infos ?? []).map((n) => ({
    id:           n.id,
    createdAt:    n.datum,
    authorId:     "user-leitung-001",
    title:        n.titel,
    body:         n.text,
    targetGroups: n.zielgruppen ?? ["alle"],
    priority:     n.prioritaet ?? "normal",
    type:         n.prioritaet === "sehrwichtig" ? "sehrwichtig"
                : n.prioritaet === "wichtig"     ? "wichtig"
                : "info",
    confirmedBy:  _planConfirmedBy(n.id),
  }));
}

// ============================================================
// User
// ============================================================

export async function getCurrentUser() {
  if (_planData) {
    // Gespeicherte Personenwahl aus localStorage lesen (Person-Picker beim App-Start)
    const savedId = (typeof localStorage !== "undefined") ? localStorage.getItem("kita-user-id") : null;
    const members = _planData.mitarbeiter ?? [];
    const m = savedId ? members.find(x => x.id === savedId) : null;
    if (!m) return null; // kein User gespeichert → Person-Picker in app.js
    return { id: m.id, displayName: m.name, email: m.email ?? "", group: m.gruppe, role: m.rolle ?? "mitarbeiterin" };
  }
  if (USE_MOCK) return mock.MOCK_USER;
  // Phase 8: return await graphApi.getMe();
}

/** Gibt alle Mitarbeiterinnen aus dem Plan zurück (für PIN-Login-Anzeige) */
export function getPlanMitarbeiter() {
  return (_planData?.mitarbeiter ?? []).map(m => ({
    id:     m.id,
    name:   m.name,
    gruppe: m.gruppe,
    rolle:  m.rolle ?? "Erzieherin",
  }));
}

/**
 * Prüft einen PIN gegen die Mitarbeiterliste aus plan-export.json.
 * Gibt bei Treffer das User-Objekt zurück, sonst null.
 */
export function validatePin(pin) {
  if (!_planData) return null;
  const m = (_planData.mitarbeiter ?? []).find(
    (m) => String(m.pin) === String(pin).trim()
  );
  if (!m) return null;
  return {
    id:          m.id,
    displayName: m.name,
    email:       m.email ?? "",
    group:       m.gruppe,
    role:        m.rolle ?? "mitarbeiterin",
  };
}

// ============================================================
// Colleagues
// ============================================================

export async function getColleagues() {
  if (_planData) {
    const userId = (typeof localStorage !== "undefined") ? localStorage.getItem("kita-user-id") : null;
    return (_planData.mitarbeiter ?? [])
      .filter((m) => m.id !== userId)
      .map((m) => ({ id: m.id, displayName: m.name, group: m.gruppe, role: m.rolle ?? "mitarbeiterin" }));
  }
  if (USE_MOCK) return mock.MOCK_COLLEAGUES;
  // Phase 8: return await graphApi.getColleagues();
}

// ============================================================
// Shifts
// ============================================================

export async function getShifts(userId, month, year) {
  if (_planData) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return adaptShifts(_planData.wochen).filter(
      (s) => s.userId === userId && s.date.startsWith(prefix)
    );
  }
  if (USE_MOCK) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return mock.MOCK_SHIFTS.filter(
      (s) => s.userId === userId && s.date.startsWith(prefix)
    );
  }
  // Phase 8: return await graphApi.getShifts(userId, month, year);
}

// ============================================================
// Requests — immer intern (Anträge kommen nie aus dem Plan-Export)
// ============================================================

export async function getRequests(userId) {
  if (_planData) return _lsGetRequests().filter((r) => r.userId === userId);
  if (USE_MOCK) return mock.MOCK_REQUESTS.filter((r) => r.userId === userId);
  // Phase 8: return await graphApi.getRequests(userId);
}

/**
 * Reicht einen neuen Antrag ein.
 * type "diensttausch" → "ausstehend-kollegin", alle anderen → "ausstehend".
 * Speichert im Plan-Modus in localStorage, sonst in MOCK_REQUESTS.
 */
export async function submitRequest(request) {
  const status = request.type === "diensttausch" ? "ausstehend-kollegin" : "ausstehend";
  const entry = {
    ...request,
    id: _genId(),
    createdAt: new Date().toISOString(),
    status,
    reviewedAt: null,
    reviewNote: null,
    colleagueStatus: request.type === "diensttausch" ? "ausstehend" : null,
  };
  if (_planData) {
    const all = _lsGetRequests();
    all.unshift(entry);
    _lsSaveRequests(all);
    return { success: true };
  }
  if (USE_MOCK) {
    mock.MOCK_REQUESTS.unshift(entry);
    return { success: true };
  }
  // Phase 8: return await graphApi.createRequest(request);
}

/**
 * Zieht einen Antrag zurück (erlaubt: "ausstehend", "ausstehend-kollegin").
 */
export async function withdrawRequest(requestId, userId) {
  const withdrawable = ["ausstehend", "ausstehend-kollegin"];
  if (_planData) {
    const all = _lsGetRequests();
    const idx = all.findIndex(
      (r) => r.id === requestId && r.userId === userId && withdrawable.includes(r.status)
    );
    if (idx !== -1) all.splice(idx, 1);
    _lsSaveRequests(all);
    return { success: idx !== -1 };
  }
  if (USE_MOCK) {
    const idx = mock.MOCK_REQUESTS.findIndex(
      (r) => r.id === requestId && r.userId === userId && withdrawable.includes(r.status)
    );
    if (idx !== -1) mock.MOCK_REQUESTS.splice(idx, 1);
    return { success: idx !== -1 };
  }
  // Phase 8: return await graphApi.deleteRequest(requestId);
}

/** Antwortet auf Tauschanfrage */
export async function respondToSwapRequest(notificationId, userId, accept) {
  if (USE_MOCK) {
    const notif = mock.MOCK_NOTIFICATIONS.find((n) => n.id === notificationId);
    if (notif) {
      if (accept) {
        notif.swapData = { ...notif.swapData, responseStatus: "zugestimmt" };
        if (!notif.confirmedBy.includes(userId)) notif.confirmedBy.push(userId);
      } else {
        notif.swapData = { ...notif.swapData, responseStatus: "abgelehnt" };
      }
    }
    return { success: true, accepted: accept };
  }
  // Phase 8: return await graphApi.respondToSwapRequest(notificationId, accept);
}

// ============================================================
// Notifications
// ============================================================

export async function getNotifications(userGroup) {
  if (_planData) {
    return adaptNotifications(_planData.infos).filter(
      (n) => n.targetGroups.includes("alle") || n.targetGroups.includes(userGroup)
    );
  }
  if (USE_MOCK) {
    return mock.MOCK_NOTIFICATIONS.filter(
      (n) => n.targetGroups.includes("alle") || n.targetGroups.includes(userGroup)
    );
  }
  // Phase 8: return await graphApi.getNotifications(userGroup);
}

export async function confirmNotification(notificationId, userId) {
  if (_planData) {
    _addPlanConfirmedBy(notificationId, userId);
    return { success: true };
  }
  if (USE_MOCK) {
    const n = mock.MOCK_NOTIFICATIONS.find((n) => n.id === notificationId);
    if (n && !n.confirmedBy.includes(userId)) n.confirmedBy.push(userId);
    return { success: true };
  }
  // Phase 8: return await graphApi.confirmNotification(notificationId, userId);
}
