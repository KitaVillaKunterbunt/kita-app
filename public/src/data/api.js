// src/data/api.js
// API-Adapter — 3 Datenquellen (Priorität):
//   1. plan-export.json  (wenn von Leitung exportiert)
//   2. Mock-Daten        (Entwicklung / Fallback)
//   3. Graph API         (Phase 8, SharePoint)

const USE_MOCK = true;

// Placeholder — wird durch setMockData() ersetzt sobald Demo-Modus erkannt wird.
// Leere Arrays verhindern Crashes falls Funktionen vor dem Laden aufgerufen werden.
let mock = {
  MOCK_USER:          null,
  MOCK_MITARBEITER:   [],
  MOCK_COLLEAGUES:    [],
  MOCK_SHIFTS:        [],
  MOCK_REQUESTS:      [],
  MOCK_NOTIFICATIONS: [],
};

export function setMockData(m) { mock = m; }

// ============================================================
// Plan-Daten (plan-export.json)
// ============================================================

// Merged view über alle geladenen Monate — alle anderen Funktionen lesen hieraus.
let _planData = null;

// Einzelne Monats-Pläne: key = "YYYY-MM" → Plan-Objekt
let _planMonths = {};

// Wird von app.js via setPinsData() gefüllt wenn pins.json geladen wurde.
let _pinsData = null;

/** Alle Monatspläne zu einem einzigen Objekt zusammenführen. */
function _buildMergedPlan() {
  const months = Object.values(_planMonths);
  if (months.length === 0) return null;

  // Neuester Monat zuerst (für mitarbeiter, monat, jahr, exportiert)
  months.sort((a, b) => {
    const ak = `${a.jahr}-${String(a.monat).padStart(2, "0")}`;
    const bk = `${b.jahr}-${String(b.monat).padStart(2, "0")}`;
    return bk.localeCompare(ak);
  });

  const newest = months[0];
  const allWochen = months.flatMap((p) => p.wochen ?? []);

  // Infos aus allen Monaten zusammenführen, Duplikate per id entfernen
  const seenInfoIds = new Set();
  const allInfos = [];
  for (const p of months) {
    for (const info of p.infos ?? []) {
      if (!seenInfoIds.has(info.id)) {
        seenInfoIds.add(info.id);
        allInfos.push(info);
      }
    }
  }

  return { ...newest, wochen: allWochen, infos: allInfos };
}

/**
 * Plan-Daten setzen — akkumuliert pro Monat anstatt zu überschreiben.
 * null → Reset. Objekte ohne monat/jahr landen unter Schlüssel "0000-00".
 */
export function setPlanData(data) {
  if (data === null || data === undefined) {
    _planMonths = {};
    _planData = null;
    return;
  }
  const key = (data.monat && data.jahr)
    ? `${data.jahr}-${String(data.monat).padStart(2, "0")}`
    : "0000-00";
  _planMonths[key] = data;
  _planData = _buildMergedPlan();
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

/** Alle geladenen Monate sortiert zurückgeben. */
export function getAvailableMonths() {
  return Object.keys(_planMonths)
    .sort()
    .map((key) => ({ monat: _planMonths[key].monat, jahr: _planMonths[key].jahr }));
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

/** Neuester exportiert-Timestamp über alle geladenen Monate. */
export function getPlanExportTimestamp() {
  const months = Object.values(_planMonths);
  if (months.length === 0) return null;
  return months.map((p) => p.exportiert ?? "").sort().at(-1) || null;
}

/** Hilfsfunktion: Liste der zu prüfenden Quelldateien für Refresh. */
function _refreshSources() {
  const sources = new Set(["plan-export.json", "plan-export-public.json"]);
  // Aktuell geladene Monate
  for (const key of Object.keys(_planMonths)) {
    sources.add(`plan-export-public-${key}.json`);
  }
  // 3 Monate Vorschau
  const now = new Date();
  for (let delta = 0; delta <= 2; delta++) {
    let m = now.getMonth() + 1 + delta;
    let y = now.getFullYear();
    if (m > 12) { m -= 12; y++; }
    sources.add(`plan-export-public-${y}-${String(m).padStart(2, "0")}.json`);
  }
  return [...sources];
}

/**
 * Holt alle Plan-Dateien neu vom Server.
 * Gibt true zurück wenn sich mindestens ein Monat geändert hat.
 */
export async function refreshPlanData() {
  const sources = _refreshSources();
  const results = await Promise.allSettled(
    sources.map((src) => fetch(src, { cache: "no-cache" }))
  );
  let changed = false;
  for (let i = 0; i < sources.length; i++) {
    const r = results[i];
    if (r.status === "rejected" || !r.value.ok) continue;
    try {
      const plan = await r.value.json();
      if (!plan.monat || !plan.jahr) continue;
      const key = `${plan.jahr}-${String(plan.monat).padStart(2, "0")}`;
      if (_planMonths[key]?.exportiert !== plan.exportiert) {
        _planMonths[key] = plan;
        changed = true;
      }
    } catch { /* parse error ignorieren */ }
  }
  if (changed) _planData = _buildMergedPlan();
  return changed;
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

// ============================================================
// Gelöschte Mitteilungen (localStorage-persistent)
// ============================================================

const LS_DELETED_NOTIFS = "kita-deleted-notifs";

function _getDeletedNotifIds() {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_DELETED_NOTIFS) ?? "[]"); }
  catch { return []; }
}

// ============================================================
// Schwarzes Brett
// ============================================================

const LS_BRETT_KEY = "kita-brett";

function _getBrettLocal() {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_BRETT_KEY) ?? "[]"); }
  catch { return []; }
}

function _adaptBrettEntries(aushänge) {
  return (aushänge ?? []).map((a) => ({
    id:        a.id,
    title:     a.titel     ?? a.title     ?? "",
    body:      a.inhalt    ?? a.body      ?? "",
    category:  a.kategorie ?? a.category  ?? "sonstiges",
    createdAt: a.erstelltAm ?? a.createdAt ?? "",
    source:    "plan",
  }));
}

/** Gibt alle Brett-Einträge zurück — aus Plan + localStorage. */
export function getBrettEntries() {
  const fromPlan = _adaptBrettEntries(_planData?.aushänge ?? []);
  const local    = _getBrettLocal();
  return [...fromPlan, ...local];
}

/** Neuen Eintrag von der Leitung in localStorage speichern. */
export function addBrettEntry(entry) {
  const local = _getBrettLocal();
  local.push({
    id:        _genId(),
    title:     entry.title,
    body:      entry.body      ?? "",
    category:  entry.category  ?? "sonstiges",
    createdAt: new Date().toISOString(),
    source:    "lokal",
  });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LS_BRETT_KEY, JSON.stringify(local));
  }
  return { success: true };
}

/** Lokalen Brett-Eintrag löschen (Plan-Einträge nur über Plan-Export entfernbar). */
export function deleteBrettEntry(id) {
  const filtered = _getBrettLocal().filter((e) => e.id !== id);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LS_BRETT_KEY, JSON.stringify(filtered));
  }
  return { success: true };
}

/** Einzelne Mitteilung dauerhaft löschen (Leitung). */
export function deleteNotification(notifId) {
  const ids = _getDeletedNotifIds();
  if (!ids.includes(notifId)) {
    ids.push(notifId);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_DELETED_NOTIFS, JSON.stringify(ids));
    }
  }
  return { success: true };
}

/** Mehrere Mitteilungen auf einmal löschen (z.B. "Archiv leeren"). */
export function deleteNotifications(notifIds) {
  const ids = _getDeletedNotifIds();
  for (const id of notifIds) {
    if (!ids.includes(id)) ids.push(id);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LS_DELETED_NOTIFS, JSON.stringify(ids));
  }
  return { success: true };
}

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

/** Alle Schichten eines Nutzers über alle geladenen Monate. */
export async function getAllUserShifts(userId) {
  if (_planData) {
    return adaptShifts((_planData.wochen ?? []).filter((w) => w.mitarbeiterId === userId));
  }
  if (USE_MOCK) return mock.MOCK_SHIFTS.filter((s) => s.userId === userId);
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
  const deletedIds = _getDeletedNotifIds();
  if (_planData) {
    const adapted = adaptNotifications(_planData.infos)
      .filter((n) => !deletedIds.includes(n.id));
    return seeAll ? adapted : adapted.filter(
      (n) => n.targetGroups.includes("alle") || n.targetGroups.includes(userGroup)
    );
  }
  // Keine Mock-Mitteilungen — nur echte aus plan-export.json
  return [];
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
