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

// Wird von app.js via setPinsData() gefüllt wenn pins.json geladen wurde.
// Priorität vor _planData.mitarbeiter für validatePin().
let _pinsData = null;

/** Plan-Daten setzen (aufgerufen von app.js nach fetch von plan-export.json) */
export function setPlanData(data) {
  _planData = data ?? null;
}

/** PIN-Liste setzen (aufgerufen von app.js nach fetch von pins.json) */
export function setPinsData(data) {
  _pinsData = Array.isArray(data) ? data : null;
}

/** Debug-Informationen (für den 3×-Tap-Dialog auf der Login-Seite) */
export function getDebugInfo() {
  const list = _pinsData ?? _planData?.mitarbeiter ?? [];
  return {
    loaded:           !!_planData,
    pinsLoaded:       !!_pinsData,
    mitarbeiterCount: list.length,
    firstPinSet:      list[0]?.pin != null,
  };
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

/** Exportiert-Timestamp des aktuell geladenen Plans (ISO-String oder null) */
export function getPlanExportTimestamp() {
  return _planData?.exportiert ?? null;
}

/**
 * Holt Plan-Daten erneut vom Server.
 * Gibt true zurück wenn sich der Plan seit dem letzten Laden geändert hat
 * (anderer exportiert-Timestamp). _planData wird nur bei Änderung ersetzt.
 */
export async function refreshPlanData() {
  const sources = ["plan-export.json", "plan-export-public.json"];
  for (const src of sources) {
    try {
      const resp = await fetch(src, { cache: "no-cache" });
      if (!resp.ok) continue;
      const plan = await resp.json();
      const oldTs = _planData?.exportiert ?? null;
      const newTs = plan.exportiert ?? null;
      if (newTs !== oldTs) {
        _planData = plan;
        return true;
      }
      return false;
    } catch {
      // Quelle nicht verfügbar — nächste versuchen
    }
  }
  return false;
}

/**
 * Demo-Modus: keine pins.json UND entweder kein Plan oder Plan ohne PIN-Felder.
 * Trifft auf GitHub Pages mit plan-export-public.json zu.
 */
export function isDemoMode() {
  if (_pinsData !== null) return false;
  if (_planData === null) return true;
  return !(_planData.mitarbeiter ?? []).some(m => m.pin != null);
}

/** Ersten Mitarbeiter aus Plan (oder Mock) als Demo-User zurückgeben. */
export function getDemoUser() {
  const m = (_planData?.mitarbeiter ?? mock.MOCK_MITARBEITER)[0];
  if (!m) return null;
  return { id: m.id, displayName: m.name, email: m.email ?? "", group: m.gruppe, role: m.rolle ?? "mitarbeiterin" };
}

const LS_DECISIONS_KEY = "kita-decisions";

function _lsGetDecisions() {
  if (typeof localStorage === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_DECISIONS_KEY) ?? "{}"); }
  catch { return {}; }
}

function _lsSaveDecision(requestId, status, reviewNote) {
  const d = _lsGetDecisions();
  d[requestId] = { status, reviewNote, reviewedAt: new Date().toISOString() };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LS_DECISIONS_KEY, JSON.stringify(d));
  }
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
    startTime: w.vonUhr      ?? null,
    endTime:   w.bisUhr      ?? null,
    group:     w.gruppe      ?? "",
    room:      w.raum        ?? null,
    note:      w.notiz       ?? null,
    groupNote: w.gruppenNotiz ?? null,
  }));
}

function adaptNotifications(infos) {
  return (infos ?? []).map((n) => ({
    id:           n.id,
    createdAt:    n.erstelltAm ?? n.datum,
    authorId:     "user-leitung-001",
    title:        n.titel,
    body:         n.text,
    targetGroups: n.zielgruppen ?? ["alle"],
    priority:     n.prioritaet ?? "normal",
    type:         n.prioritaet === "sehrwichtig" ? "sehrwichtig"
                : n.prioritaet === "wichtig"     ? "wichtig"
                : "info",
    datum:        (n.datum && n.datum.length === 10) ? n.datum : null,
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
  const list = _pinsData ?? _planData?.mitarbeiter ?? mock.MOCK_MITARBEITER;
  const m = list.find((m) => String(m.pin) === String(pin).trim());
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

/** Gibt Mitarbeiterinnen mit Geburtstag- und Eintrittsdaten zurück (für Kalender-Events). */
export function getMitarbeiter() {
  if (_planData) {
    return (_planData.mitarbeiter ?? []).map((m) => ({
      id:             m.id,
      name:           m.name,
      geburtstag:     m.geburtstag     ?? null,
      eintrittsdatum: m.eintrittsdatum ?? null,
    }));
  }
  return mock.MOCK_MITARBEITER ?? [];
}

/**
 * Gibt alle Urlaub-Einträge ALLER Mitarbeiter für einen Monat zurück.
 * Kein Gruppen-Filter — alle Kolleginnen sehen wer Urlaub hat.
 * @returns {Array<{ userId: string, date: string }>}
 */
export async function getVacations(month, year) {
  if (_planData) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return adaptShifts(_planData.wochen)
      .filter((s) => s.date.startsWith(prefix) && s.type === "urlaub")
      .map((s) => ({ userId: s.userId, date: s.date }));
  }
  // Mock: enthält nur user-001-Daten → leeres Array (Feature greift nur mit plan-export.json)
  return [];
}

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

/**
 * Wendet Entscheidungen der Leitung aus plan-export.json "antraege"-Feld
 * auf die lokal gespeicherten Anträge an. Pure Funktion — testbar ohne Browser.
 *
 * Matching: userId + type + dateFrom (da die id client-seitig generiert wird
 * und dem Leitungs-Export-Tool nicht bekannt ist).
 *
 * @param {Array} storedRequests  Anträge aus localStorage
 * @param {Array} planAntraege    Anträge aus plan-export.json (kann leer/null sein)
 * @param {string} userId
 * @returns {Array} Gemergter Antrag-Array (neue Referenz wenn Änderung, sonst original)
 */
export function mergePlanAntraegeIntoRequests(storedRequests, planAntraege, userId) {
  if (!planAntraege?.length || !storedRequests?.length) return storedRequests ?? [];

  const relevant = planAntraege.filter((a) => (a.mitarbeiterId ?? a.userId) === userId);
  if (!relevant.length) return storedRequests;

  return storedRequests.map((r) => {
    if (r.userId !== userId) return r;
    const match = relevant.find(
      (a) =>
        (a.type ?? a.typ) === r.type &&
        (a.dateFrom ?? a.von) === r.dateFrom
    );
    if (!match) return r;
    const newStatus    = match.status ?? r.status;
    const newNote      = match.begruendung ?? match.reviewNote ?? r.reviewNote ?? null;
    const newReviewedAt = match.reviewedAt ?? r.reviewedAt ?? new Date().toISOString();
    if (r.status === newStatus && r.reviewNote === newNote) return r;
    return { ...r, status: newStatus, reviewNote: newNote, reviewedAt: newReviewedAt };
  });
}

export async function getRequests(userId) {
  if (_planData) {
    const stored = _lsGetRequests().filter((r) => r.userId === userId);
    return mergePlanAntraegeIntoRequests(stored, _planData.antraege ?? [], userId);
  }
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
// Leitung-Dashboard: alle Anträge + Entscheidungen
// ============================================================

/**
 * Gibt alle Anträge zurück (kein userId-Filter) — für Leitungs-Dashboard.
 * Plan-Modus: pendingAntraege aus plan-export.json + localStorage-Anträge.
 * Mock-Modus: alle MOCK_REQUESTS.
 */
export async function getAllRequests() {
  if (_planData) {
    const decisions = _lsGetDecisions();
    const fromPlan = (_planData.pendingAntraege ?? []).map((a) => {
      const dec = decisions[a.id];
      return {
        id:           a.id,
        userId:       a.mitarbeiterId,
        type:         a.type ?? a.typ,
        dateFrom:     a.dateFrom ?? a.von,
        dateTo:       a.dateTo ?? a.bis,
        note:         a.note ?? a.notiz ?? null,
        status:       dec?.status ?? a.status ?? "ausstehend",
        createdAt:    a.createdAt ?? "",
        reviewedAt:   dec?.reviewedAt ?? null,
        reviewNote:   dec?.reviewNote ?? null,
        colleagueId:  null,
        colleagueName: null,
        colleagueStatus: null,
      };
    });
    const fromLS  = _lsGetRequests();
    const planIds = new Set(fromPlan.map((r) => r.id));
    return [...fromPlan, ...fromLS.filter((r) => !planIds.has(r.id))];
  }
  if (USE_MOCK) return mock.MOCK_REQUESTS.slice();
}

/** Genehmigt einen Antrag (Leitung). */
export async function approveRequest(requestId, reviewNote = null) {
  const now = new Date().toISOString();
  if (_planData) {
    const all = _lsGetRequests();
    const idx = all.findIndex((r) => r.id === requestId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], status: "genehmigt", reviewedAt: now, reviewNote };
      _lsSaveRequests(all);
    } else {
      _lsSaveDecision(requestId, "genehmigt", reviewNote);
    }
    return { success: true };
  }
  if (USE_MOCK) {
    const r = mock.MOCK_REQUESTS.find((r) => r.id === requestId);
    if (r) { r.status = "genehmigt"; r.reviewedAt = now; r.reviewNote = reviewNote; }
    return { success: !!r };
  }
}

/** Lehnt einen Antrag ab (Leitung). */
export async function rejectRequest(requestId, reviewNote = null) {
  const now = new Date().toISOString();
  if (_planData) {
    const all = _lsGetRequests();
    const idx = all.findIndex((r) => r.id === requestId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], status: "abgelehnt", reviewedAt: now, reviewNote };
      _lsSaveRequests(all);
    } else {
      _lsSaveDecision(requestId, "abgelehnt", reviewNote);
    }
    return { success: true };
  }
  if (USE_MOCK) {
    const r = mock.MOCK_REQUESTS.find((r) => r.id === requestId);
    if (r) { r.status = "abgelehnt"; r.reviewedAt = now; r.reviewNote = reviewNote; }
    return { success: !!r };
  }
}

// ============================================================
// Notifications
// ============================================================

export async function getNotifications(userGroup, userRole) {
  // Leitung und Stellvertreterin sehen alle Mitteilungen unabhängig von Zielgruppe
  const seeAll = userRole === "Leitung" || userRole === "Stellvertreterin";
  if (_planData) {
    const adapted = adaptNotifications(_planData.infos);
    return seeAll ? adapted : adapted.filter(
      (n) => n.targetGroups.includes("alle") || n.targetGroups.includes(userGroup)
    );
  }
  if (USE_MOCK) {
    return seeAll
      ? mock.MOCK_NOTIFICATIONS.slice()
      : mock.MOCK_NOTIFICATIONS.filter(
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
