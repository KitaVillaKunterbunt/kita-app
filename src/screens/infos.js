// src/screens/infos.js
// Screen 5: Infos — Prioritäten (normal/wichtig/sehrwichtig), Archiv, Tauschanfragen

import { escapeHTML } from "../utils.js";

// Schwellwert in Tagen ab dem eine Info ins Archiv wandert
const ARCHIVE_DAYS = 14;

const FILTERS = {
  aktuell:     "Aktuell",
  gruppe:      "Meine Gruppe",
  sehrwichtig: "Sehr wichtig",
  archiv:      "Archiv",
};

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

function isArchived(notif) {
  const ageDays = (Date.now() - new Date(notif.createdAt).getTime()) / 86400000;
  return ageDays > ARCHIVE_DAYS;
}

// ============================================================
// Karten-Builder
// ============================================================

function swapCardHTML(notif, userId, onSwapRespond) {
  const sd = notif.swapData ?? {};
  const hasResponded = notif.confirmedBy.includes(userId) || sd.responseStatus;

  const offerDate = sd.offerShift?.date
    ? new Date(sd.offerShift.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })
    : "—";
  const wantDate = sd.wantShift?.date
    ? new Date(sd.wantShift.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })
    : "—";

  let actionHTML;
  if (hasResponded) {
    const resp = sd.responseStatus ?? "zugestimmt";
    const color = resp === "zugestimmt" ? "var(--c-success)" : "var(--c-danger)";
    actionHTML = `<p class="text-small mt-sm" style="color:${color};font-weight:600;">
      ${resp === "zugestimmt" ? "✓ Du hast zugestimmt" : "✗ Du hast abgelehnt"}
    </p>`;
  } else {
    actionHTML = `
      <div class="swap-actions">
        <button class="btn btn--primary btn--sm" data-action="swap-accept" data-notif-id="${escapeHTML(notif.id)}">
          ✓ Zustimmen
        </button>
        <button class="btn btn--ghost btn--sm" data-action="swap-decline" data-notif-id="${escapeHTML(notif.id)}">
          ✗ Ablehnen
        </button>
      </div>`;
  }

  return `
    <div class="notif-card notif-card--tausch notif-card--unread" data-notif-id="${escapeHTML(notif.id)}">
      <div class="notif-header">
        <p class="notif-title">🔄 ${escapeHTML(notif.title)}</p>
        <span class="notif-priority-badge notif-priority-badge--wichtig">Tausch</span>
      </div>
      <p class="notif-meta">${formatDate(notif.createdAt)}</p>
      <div class="swap-offer">
        <div class="swap-offer__row">
          <span class="swap-offer__dir">Du gibst:</span>
          <span class="swap-offer__shift">${escapeHTML(wantDate)}
            ${sd.wantShift?.startTime ? `· ${escapeHTML(sd.wantShift.startTime)}–${escapeHTML(sd.wantShift.endTime)} Uhr` : ""}</span>
        </div>
        <div class="swap-offer__row">
          <span class="swap-offer__dir">Du bekommst:</span>
          <span class="swap-offer__shift">${escapeHTML(offerDate)}
            ${sd.offerShift?.startTime ? `· ${escapeHTML(sd.offerShift.startTime)}–${escapeHTML(sd.offerShift.endTime)} Uhr` : ""}</span>
        </div>
      </div>
      ${actionHTML}
    </div>`;
}

function notifCardHTML(notif, userId) {
  const priority    = notif.priority ?? (notif.type === "wichtig" ? "wichtig" : "normal");
  const isSehrWichtig = priority === "sehrwichtig";
  const isWichtig     = priority === "wichtig";
  const isConfirmed   = notif.confirmedBy.includes(userId);
  const isUnread      = !isConfirmed && (isSehrWichtig || !isConfirmed);
  const archived      = isArchived(notif);

  let actionHTML = "";
  if (isSehrWichtig && !isConfirmed) {
    actionHTML = `<button class="btn btn--danger btn--sm mt-md" data-action="confirm" data-notif-id="${escapeHTML(notif.id)}">
      ✓ Gelesen &amp; bestätigt
    </button>`;
  } else if (isSehrWichtig && isConfirmed) {
    actionHTML = `<p class="text-small mt-sm" style="color:var(--c-success);font-weight:600;">✓ Bestätigt</p>`;
  }

  const priorityLabel = isSehrWichtig ? "Sehr wichtig" : isWichtig ? "Wichtig" : "Info";
  const priorityClass = isSehrWichtig ? "sehrwichtig" : isWichtig ? "wichtig" : "normal";

  const targetLabel = notif.targetGroups.includes("alle")
    ? "Alle"
    : notif.targetGroups.join(", ");

  return `
    <div class="notif-card
      ${isSehrWichtig ? "notif-card--sehrwichtig" : ""}
      ${isWichtig && !isSehrWichtig ? "notif-card--wichtig" : ""}
      ${isUnread && !archived ? "notif-card--unread" : ""}
      ${archived ? "notif-card--archived" : ""}"
         data-notif-id="${escapeHTML(notif.id)}">
      <div class="notif-header">
        <p class="notif-title">${escapeHTML(notif.title)}</p>
        <span class="notif-priority-badge notif-priority-badge--${priorityClass}">${priorityLabel}</span>
      </div>
      <p class="notif-meta">${formatDate(notif.createdAt)} · ${escapeHTML(targetLabel)}</p>
      <p class="notif-body">${escapeHTML(notif.body)}</p>
      <span class="notif-mehr" data-action="expand">Mehr lesen</span>
      ${actionHTML}
    </div>`;
}

// ============================================================
// Filter-Logik
// ============================================================

function applyFilter(notifications, filter, user) {
  let list = [...notifications];

  if (filter === "aktuell") {
    list = list.filter((n) => !isArchived(n) && n.type !== "tausch");
  } else if (filter === "gruppe") {
    list = list.filter((n) =>
      !isArchived(n) &&
      n.targetGroups.some((g) => g !== "alle") &&
      n.targetGroups.includes(user.group)
    );
  } else if (filter === "sehrwichtig") {
    list = list.filter((n) => (n.priority ?? n.type) === "sehrwichtig");
  } else if (filter === "archiv") {
    list = list.filter((n) => isArchived(n));
  }

  // Sehr wichtig unbestätigt immer oben
  list.sort((a, b) => {
    const aUrgent = (a.priority ?? a.type) === "sehrwichtig" && !a.confirmedBy.includes(user.id);
    const bUrgent = (b.priority ?? b.type) === "sehrwichtig" && !b.confirmedBy.includes(user.id);
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return list;
}

// ============================================================
// Haupt-Export
// ============================================================

/**
 * @param {HTMLElement} container
 * @param {Array} notifications
 * @param {{ id:string, group:string }} user
 * @param {function} onConfirm       async (notifId) => void
 * @param {function} onSwapRespond   async (notifId, accept:boolean) => void
 */
export function renderInfos(container, notifications, user, onConfirm, onSwapRespond) {
  let activeFilter = "aktuell";

  // Tauschanfragen (immer im aktuell-Tab oben)
  const pendingSwaps = notifications.filter(
    (n) => n.type === "tausch" && !n.confirmedBy.includes(user.id) && !n.swapData?.responseStatus
  );

  function unconfirmedSehrWichtig() {
    return notifications.filter(
      (n) => (n.priority ?? n.type) === "sehrwichtig" && !n.confirmedBy.includes(user.id) && !isArchived(n)
    ).length;
  }

  function render() {
    const filtered = applyFilter(notifications, activeFilter, user);
    const urgentCount = unconfirmedSehrWichtig();

    const filterTabsHTML = Object.entries(FILTERS).map(([key, label]) => {
      let badge = "";
      if (key === "sehrwichtig" && urgentCount > 0) {
        badge = `<span class="filter-badge-urgent">${urgentCount}</span>`;
      }
      return `<button class="filter-tab ${key === activeFilter ? "active" : ""}" data-filter="${key}">
        ${label}${badge}
      </button>`;
    }).join("");

    // Im aktuell-Tab: Tauschanfragen oben einfügen
    let swapsHTML = "";
    if (activeFilter === "aktuell" && pendingSwaps.length > 0) {
      swapsHTML = pendingSwaps.map((n) => swapCardHTML(n, user.id, onSwapRespond)).join("");
    }

    const listHTML = filtered.length > 0 || swapsHTML
      ? swapsHTML + filtered.map((n) =>
          n.type === "tausch" ? "" : notifCardHTML(n, user.id)
        ).join("")
      : `<div class="empty-state">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
             <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
             <path d="M13.73 21a2 2 0 01-3.46 0"/>
           </svg>
           <p>${activeFilter === "archiv" ? "Kein Archiv vorhanden." : "Keine Mitteilungen in dieser Kategorie."}</p>
         </div>`;

    container.innerHTML = `
      <h1 class="screen-title">Mitteilungen</h1>
      <div class="filter-tabs" role="tablist" aria-label="Mitteilungsfilter">
        ${filterTabsHTML}
      </div>
      <div id="notif-list">${listHTML}</div>`;

    attachListeners();
  }

  function attachListeners() {
    container.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeFilter = tab.dataset.filter;
        render();
      });
    });

    const list = container.querySelector("#notif-list");

    list.addEventListener("click", async (e) => {
      // Bestätigen-Button (sehr wichtig)
      const confirmBtn = e.target.closest("[data-action='confirm']");
      if (confirmBtn) {
        e.stopPropagation();
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Wird bestätigt …";
        await onConfirm(confirmBtn.dataset.notifId);
        return;
      }

      // Tausch zustimmen
      const acceptBtn = e.target.closest("[data-action='swap-accept']");
      if (acceptBtn) {
        e.stopPropagation();
        acceptBtn.disabled = true;
        acceptBtn.textContent = "Wird bestätigt …";
        if (onSwapRespond) await onSwapRespond(acceptBtn.dataset.notifId, true);
        return;
      }

      // Tausch ablehnen
      const declineBtn = e.target.closest("[data-action='swap-decline']");
      if (declineBtn) {
        e.stopPropagation();
        declineBtn.disabled = true;
        declineBtn.textContent = "Wird abgelehnt …";
        if (onSwapRespond) await onSwapRespond(declineBtn.dataset.notifId, false);
        return;
      }

      // "Mehr lesen" / Karte expandieren
      const card = e.target.closest(".notif-card");
      if (!card) return;
      const body = card.querySelector(".notif-body");
      const mehr = card.querySelector(".notif-mehr");
      if (body) {
        body.classList.toggle("expanded");
        if (mehr) mehr.textContent = body.classList.contains("expanded") ? "Weniger" : "Mehr lesen";
      }
    });
  }

  render();
}
