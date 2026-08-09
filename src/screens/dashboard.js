// src/screens/dashboard.js
// Leitung-Dashboard — nur für Leitung und Stellvertreterin

import { escapeHTML } from "../utils.js";

const TYPE_LABEL = {
  urlaub:        "Urlaub",
  dienstwunsch:  "Dienstwunsch",
  diensttausch:  "Diensttausch",
  krankmeldung:  "Krankmeldung",
};

const TYPE_ICON = {
  urlaub:        "🌴",
  dienstwunsch:  "📅",
  diensttausch:  "🔄",
  krankmeldung:  "🤒",
};

function formatDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr + (isoStr.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function todayMMDD() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function currentYear() {
  return new Date().getFullYear();
}

/**
 * Berechnet Geburtstage + Jubiläen die heute anstehen.
 * @param {Array} mitarbeiter - [{name, geburtstag, eintrittsdatum}]
 * @returns {Array<{name, label}>}
 */
export function getTodayEvents(mitarbeiter) {
  const today = todayMMDD();
  const year  = currentYear();
  const events = [];

  for (const m of mitarbeiter) {
    if (m.geburtstag && m.geburtstag.endsWith
      && m.geburtstag === today) {
      events.push({ name: m.name, label: "Geburtstag 🎂" });
    }
    if (m.eintrittsdatum) {
      const [entryYear, mm, dd] = m.eintrittsdatum.split("-");
      const mmdd = `${mm}-${dd}`;
      if (mmdd === today && Number(entryYear) < year) {
        const years = year - Number(entryYear);
        events.push({ name: m.name, label: `${years}-jähriges Jubiläum 🎉` });
      }
    }
  }
  return events;
}

/**
 * Filtert Anträge die heute Urlaub und Status ausstehend-leitung/ausstehend haben,
 * und gibt die Mitarbeiter-Namen zurück.
 * @param {Array} requests - alle Anträge
 * @param {Array} mitarbeiter - [{id, name}]
 * @returns {Array<string>} Namen der Urlaubenden
 */
export function getTodayVacationers(requests, mitarbeiter) {
  const today = todayDateStr();
  const nameMap = Object.fromEntries(mitarbeiter.map((m) => [m.id, m.name]));
  return requests
    .filter((r) => r.type === "urlaub" && r.status === "genehmigt"
      && r.dateFrom <= today && r.dateTo >= today)
    .map((r) => nameMap[r.userId] ?? r.userId);
}

/**
 * Gibt Anträge zurück die auf eine Leitungs-Entscheidung warten.
 */
export function getPendingRequests(requests) {
  return requests.filter(
    (r) => r.status === "ausstehend" || r.status === "ausstehend-leitung"
  );
}

// ============================================================
// Render
// ============================================================

function pendingCard(req, mitarbeiter, onDecide) {
  const nameMap = Object.fromEntries(mitarbeiter.map((m) => [m.id, m.name]));
  const name      = nameMap[req.userId] ?? req.userId;
  const typeLabel = TYPE_LABEL[req.type] ?? req.type;
  const typeIcon  = TYPE_ICON[req.type]  ?? "📋";
  const fromStr   = formatDate(req.dateFrom);
  const toStr     = req.dateTo && req.dateTo !== req.dateFrom ? ` – ${formatDate(req.dateTo)}` : "";

  return `
    <div class="dashboard-card__request" data-request-id="${escapeHTML(req.id)}">
      <div class="dashboard-card__request-header">
        <span class="dashboard-card__request-icon">${typeIcon}</span>
        <div class="dashboard-card__request-meta">
          <strong>${escapeHTML(name)}</strong>
          <span>${escapeHTML(typeLabel)} · ${escapeHTML(fromStr)}${escapeHTML(toStr)}</span>
          ${req.note ? `<span class="dashboard-card__request-note">${escapeHTML(req.note)}</span>` : ""}
        </div>
      </div>
      <div class="dashboard-card__request-actions">
        <button class="btn btn--sm btn--success dashboard-approve" data-id="${escapeHTML(req.id)}">Genehmigen</button>
        <button class="btn btn--sm btn--danger dashboard-reject"  data-id="${escapeHTML(req.id)}">Ablehnen</button>
      </div>
    </div>`;
}

export function renderDashboard(container, user, allRequests, mitarbeiter, notifications, onApprove, onReject) {
  const pending       = getPendingRequests(allRequests);
  const vacationers   = getTodayVacationers(allRequests, mitarbeiter);
  const todayEvents   = getTodayEvents(mitarbeiter);
  const unreadNotifs  = notifications.filter(
    (n) => !n.confirmedBy.includes(user.id)
  );

  const pendingSection = pending.length === 0
    ? `<p class="dashboard-card__empty">Keine offenen Anträge ✓</p>`
    : pending.map((r) => pendingCard(r, mitarbeiter, null)).join("");

  const vacationSection = vacationers.length === 0
    ? `<p class="dashboard-card__empty">Heute niemand im Urlaub</p>`
    : vacationers.map((n) => `<div class="dashboard-card__chip">🌴 ${escapeHTML(n)}</div>`).join("");

  const eventsSection = todayEvents.length === 0
    ? `<p class="dashboard-card__empty">Heute keine Ereignisse</p>`
    : todayEvents.map((e) =>
        `<div class="dashboard-card__event"><strong>${escapeHTML(e.name)}</strong> — ${escapeHTML(e.label)}</div>`
      ).join("");

  const notifSection = unreadNotifs.length === 0
    ? `<p class="dashboard-card__empty">Keine ungelesenen Mitteilungen</p>`
    : `<p class="dashboard-card__notif-count">${unreadNotifs.length} ungelesene Mitteilung${unreadNotifs.length !== 1 ? "en" : ""}</p>`;

  container.innerHTML = `
    <div class="dashboard">
      <button class="screen-back-btn" onclick="window.location.hash='home'">&#8592; Startseite</button>
      <h1 class="dashboard__title">Dashboard</h1>

      <section class="dashboard-card">
        <h2 class="dashboard-card__title">
          Offene Anträge
          ${pending.length > 0 ? `<span class="badge badge--pending">${pending.length}</span>` : ""}
        </h2>
        <div class="dashboard-card__requests">
          ${pendingSection}
        </div>
      </section>

      <section class="dashboard-card">
        <h2 class="dashboard-card__title">Heute im Urlaub</h2>
        <div class="dashboard-card__chips">${vacationSection}</div>
      </section>

      <section class="dashboard-card">
        <h2 class="dashboard-card__title">Geburtstage &amp; Jubiläen heute</h2>
        ${eventsSection}
      </section>

      <section class="dashboard-card">
        <h2 class="dashboard-card__title">Ungelesene Mitteilungen</h2>
        ${notifSection}
      </section>
    </div>`;

  // Approve / Reject Buttons
  container.querySelectorAll(".dashboard-approve").forEach((btn) => {
    btn.addEventListener("click", () => onApprove(btn.dataset.id));
  });
  container.querySelectorAll(".dashboard-reject").forEach((btn) => {
    btn.addEventListener("click", () => onReject(btn.dataset.id));
  });
}
