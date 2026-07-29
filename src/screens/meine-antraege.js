// src/screens/meine-antraege.js
// Screen 4: Meine Anträge — alle Typen, Statusfilter, Zurückziehen

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

const STATUS_LABEL = {
  "ausstehend":          "Ausstehend",
  "ausstehend-kollegin": "Warte auf Kollegin",
  "ausstehend-leitung":  "Leitung prüft",
  "genehmigt":           "Genehmigt",
  "abgelehnt":           "Abgelehnt",
};

const FILTER_LABELS = {
  alle:       "Alle",
  ausstehend: "Ausstehend",
  genehmigt:  "Genehmigt",
  abgelehnt:  "Abgelehnt",
};

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

function formatRange(from, to) {
  if (from === to) return formatDate(from);
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function formatTimestamp(isoStr) {
  return new Date(isoStr).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

/** Gibt true wenn ein Antrag im aktuellen Filter als "ausstehend" gilt */
function isWithdrawable(req) {
  return req.status === "ausstehend" || req.status === "ausstehend-kollegin";
}

/** Statusbadge-CSS-Klasse */
function statusClass(status) {
  const map = {
    "ausstehend":          "ausstehend",
    "ausstehend-kollegin": "ausstehend-kollegin",
    "ausstehend-leitung":  "ausstehend-leitung",
    "genehmigt":           "genehmigt",
    "abgelehnt":           "abgelehnt",
  };
  return map[status] ?? "ausstehend";
}

/** Diensttausch-Detail-Block */
function swapDetailHTML(req) {
  if (req.type !== "diensttausch") return "";

  const myShift = req.myShift
    ? `${formatDate(req.myShift.date)}, ${req.myShift.startTime ?? ""}–${req.myShift.endTime ?? ""} Uhr`
    : req.dateFrom ? formatDate(req.dateFrom) : "—";

  let colleagueStatus = "";
  if (req.colleagueName) {
    const cs = req.colleagueStatus ?? "ausstehend";
    const csLabel = cs === "zugestimmt" ? "✓ Zugestimmt" : cs === "abgelehnt" ? "✗ Abgelehnt" : "Ausstehend";
    const csColor = cs === "zugestimmt" ? "var(--c-success)" : cs === "abgelehnt" ? "var(--c-danger)" : "var(--c-text-secondary)";
    colleagueStatus = `
      <div class="swap-step">
        <span class="swap-step__label">Kollegin (${escapeHTML(req.colleagueName)})</span>
        <span class="swap-step__status" style="color:${csColor}">${csLabel}</span>
      </div>`;
  }

  const leitungStatus = req.status === "ausstehend-leitung" || req.status === "genehmigt" || req.status === "abgelehnt"
    ? `<div class="swap-step">
         <span class="swap-step__label">Leitung</span>
         <span class="swap-step__status" style="color:${
           req.status === "genehmigt" ? "var(--c-success)" :
           req.status === "abgelehnt" ? "var(--c-danger)" : "var(--c-text-secondary)"
         }">${req.status === "genehmigt" ? "✓ Genehmigt" : req.status === "abgelehnt" ? "✗ Abgelehnt" : "Prüft …"}</span>
       </div>`
    : "";

  return `
    <div class="swap-detail">
      <p class="swap-detail__shift">🔄 Mein Dienst: <strong>${escapeHTML(myShift)}</strong></p>
      ${colleagueStatus}
      ${leitungStatus}
    </div>`;
}

/** Baut eine Antrags-Karte als HTML-String */
function requestCardHTML(req) {
  const typeLabel   = TYPE_LABEL[req.type]   ?? req.type;
  const typeIcon    = TYPE_ICON[req.type]    ?? "📄";
  const statusLabel = STATUS_LABEL[req.status] ?? req.status;
  const range       = formatRange(req.dateFrom, req.dateTo);
  const submitted   = formatTimestamp(req.createdAt);

  const withdrawBtn = isWithdrawable(req)
    ? `<button class="btn btn--ghost btn--sm" data-action="withdraw" data-request-id="${escapeHTML(req.id)}">
         Zurückziehen
       </button>`
    : "";

  const reviewNoteHTML = req.status === "abgelehnt" && req.reviewNote
    ? `<div class="request-review-note">
         <strong>Begründung Leitung:</strong> ${escapeHTML(req.reviewNote)}
       </div>`
    : "";

  const noteHTML = req.note && req.type !== "diensttausch"
    ? `<p class="request-note">"${escapeHTML(req.note)}"</p>`
    : "";

  return `
    <div class="request-card" data-request-id="${escapeHTML(req.id)}">
      <div class="request-header">
        <span class="request-type-icon">${typeIcon}</span>
        <span class="request-type-label">${escapeHTML(typeLabel)}</span>
        <span class="status-badge status-badge--${statusClass(req.status)}">${escapeHTML(statusLabel)}</span>
      </div>
      <p class="request-dates">${escapeHTML(range)}</p>
      <p class="text-muted text-small">Eingereicht: ${escapeHTML(submitted)}</p>
      ${noteHTML}
      ${swapDetailHTML(req)}
      ${reviewNoteHTML}
      ${withdrawBtn ? `<div class="mt-md">${withdrawBtn}</div>` : ""}
    </div>`;
}

/** Gibt true wenn ein Request im Filter-Tab als "ausstehend" zählt */
function matchesFilter(req, filter) {
  if (filter === "alle") return true;
  if (filter === "ausstehend") {
    return req.status === "ausstehend" || req.status === "ausstehend-kollegin" || req.status === "ausstehend-leitung";
  }
  return req.status === filter;
}

/**
 * @param {HTMLElement} container
 * @param {Array} requests
 * @param {function} onWithdraw  async (requestId) => void
 */
export function renderMeineAntraege(container, requests, onWithdraw) {
  let activeFilter = "alle";

  function countForFilter(filter) {
    if (filter === "alle") return requests.length;
    if (filter === "ausstehend") {
      return requests.filter((r) =>
        r.status === "ausstehend" || r.status === "ausstehend-kollegin" || r.status === "ausstehend-leitung"
      ).length;
    }
    return requests.filter((r) => r.status === filter).length;
  }

  function render() {
    const sorted   = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const filtered = sorted.filter((r) => matchesFilter(r, activeFilter));

    const filterTabsHTML = Object.entries(FILTER_LABELS).map(([key, label]) => {
      const count = key !== "alle" ? countForFilter(key) : null;
      const badge = count > 0
        ? `<span class="filter-count">${count}</span>`
        : "";
      return `<button class="filter-tab ${key === activeFilter ? "active" : ""}" data-filter="${key}">
                ${label}${badge}
              </button>`;
    }).join("");

    const listHTML = filtered.length > 0
      ? filtered.map(requestCardHTML).join("")
      : `<div class="empty-state">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
             <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
             <line x1="8" y1="18" x2="21" y2="18"/>
             <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
             <line x1="3" y1="18" x2="3.01" y2="18"/>
           </svg>
           <p>${activeFilter === "alle" ? "Noch keine Anträge gestellt." : `Keine ${FILTER_LABELS[activeFilter]}-Anträge vorhanden.`}</p>
           ${activeFilter === "alle"
             ? `<button class="btn btn--primary btn--sm mt-md" data-nav="antrag">Neuen Antrag stellen</button>`
             : ""}
         </div>`;

    container.innerHTML = `
      <h1 class="screen-title">Meine Anträge</h1>
      <div class="filter-tabs" role="tablist" aria-label="Statusfilter">
        ${filterTabsHTML}
      </div>
      <div id="requests-list">${listHTML}</div>`;

    attachListeners();
  }

  function attachListeners() {
    container.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeFilter = tab.dataset.filter;
        render();
      });
    });

    container.querySelector("#requests-list").addEventListener("click", async (e) => {
      // Navigationsbutton im Empty-State
      const navBtn = e.target.closest("[data-nav]");
      if (navBtn) { window.location.hash = navBtn.dataset.nav; return; }

      const btn = e.target.closest("[data-action='withdraw']");
      if (!btn) return;

      const confirmed = window.confirm("Antrag wirklich zurückziehen?");
      if (!confirmed) return;

      btn.disabled = true;
      btn.textContent = "Wird zurückgezogen …";

      try {
        await onWithdraw(btn.dataset.requestId);
      } catch {
        btn.disabled = false;
        btn.textContent = "Zurückziehen";
      }
    });
  }

  render();
}
