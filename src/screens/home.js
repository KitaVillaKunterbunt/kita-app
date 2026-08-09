// src/screens/home.js
// Screen 1: Home — Dashboard mit Heute-Karte und Kachel-Grid

import { escapeHTML } from "../utils.js";

// ── Modul-State ───────────────────────────────────────────────

let _container     = null;
let _user          = null;
let _shifts        = [];
let _requests      = [];
let _notifications = [];

// ── Hilfsfunktionen ──────────────────────────────────────────

function dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

function firstName(displayName) {
  return (displayName ?? "").split(" ")[0];
}

function isLeadership(user) {
  const role = (user?.role ?? "").toLowerCase();
  return role === "leitung" || role === "stellvertreterin";
}

const WEEKDAY_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Nächste Schicht ab morgen als Kurztext, z.B. "Mo 11.8 · Früh 07:00" */
function nextShiftSub(shifts) {
  const today = dateToISO(new Date());
  const next = shifts
    .filter((s) => s.date > today && s.type !== "frei" && s.startTime)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const d = new Date(next.date + "T00:00:00");
  const wd = WEEKDAY_SHORT_DE[d.getDay()];
  const day = d.getDate();
  const mon = d.getMonth() + 1;
  const typeLabel = next.startTime < "07:30" ? "Früh" : next.endTime > "16:30" ? "Spät" : "Dienst";
  return `${wd} ${day}.${mon} · ${typeLabel} ${next.startTime}`;
}

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function weekCardHTML(shifts) {
  const today = dateToISO(new Date());
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  const rows = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = dateToISO(d);
    const isToday = dateStr === today;
    const shift = shifts.find((s) => s.date === dateStr) ?? null;

    const dayLabel  = WEEKDAY_SHORT[d.getDay()];
    const dateLabel = `${d.getDate()}.${d.getMonth() + 1}.`;

    let timeText = "Frei";
    let badgeHTML = "";

    if (shift && shift.type !== "frei") {
      if (shift.type === "urlaub") {
        timeText = "Urlaub";
        badgeHTML = `<span class="home-week-badge home-week-badge--urlaub">Urlaub</span>`;
      } else if (shift.type === "krank") {
        timeText = "Krank";
        badgeHTML = `<span class="home-week-badge home-week-badge--krank">Krank</span>`;
      } else if (shift.startTime) {
        timeText = `${shift.startTime}–${shift.endTime ?? ""}`;
        if (shift.startTime < "07:30") {
          badgeHTML = `<span class="home-week-badge home-week-badge--frueh">Früh</span>`;
        } else if (shift.endTime && shift.endTime > "16:30") {
          badgeHTML = `<span class="home-week-badge home-week-badge--spaet">Spät</span>`;
        }
      }
    }

    rows.push(`
      <div class="home-week-row${isToday ? " home-week-row--today" : ""}">
        <span class="home-week-row__day">${dayLabel}</span>
        <span class="home-week-row__date">${escapeHTML(dateLabel)}</span>
        <span class="home-week-row__time${!shift || shift.type === "frei" ? " home-week-row__time--free" : ""}">${escapeHTML(timeText)}</span>
        ${badgeHTML}
      </div>`);
  }

  return `
    <div class="home-week-card">
      <p class="home-week-card__title">Diese Woche</p>
      ${rows.join("")}
    </div>`;
}

// ── Render ──────────────────────────────────────���─────────────

function _render() {
  if (!_container) return;

  const unreadCount  = (_notifications ?? []).filter(
    (n) => !n.confirmedBy.includes(_user.id)
  ).length;
  const pendingCount = (_requests ?? []).filter(
    (r) => r.status === "ausstehend"
  ).length;
  const isLeader = isLeadership(_user);

  // Kachel-Definitionen
  const tiles = [
    {
      id:     "plan",
      label:  "Mein Monat",
      screen: "plan",
      color:  "plan",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>`,
    },
    {
      id:     "antrag",
      label:  "Antrag stellen",
      screen: "antrag",
      color:  "antrag",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>`,
    },
    {
      id:     "antraege",
      label:  "Meine Anträge",
      screen: "antraege",
      color:  "list",
      badge:  pendingCount > 0 ? pendingCount : null,
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>`,
    },
    {
      id:     "infos",
      label:  "Mitteilungen",
      screen: "infos",
      color:  "notif",
      badge:  unreadCount > 0 ? unreadCount : null,
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>`,
    },
    ...(isLeader ? [{
      id:     "dashboard",
      label:  "Dashboard",
      screen: "dashboard",
      color:  "leitung",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>`,
    }] : []),
    {
      id:     "brett",
      label:  "Schwarzes Brett",
      screen: "infos",
      color:  "brett",
      svg: `<span style="font-size:22px;line-height:1" aria-hidden="true">📋</span>`,
    },
  ];

  const tilesHTML = tiles
    .map(
      (t) => `
        <button class="home-tile home-tile--${t.color}" data-screen="${escapeHTML(t.screen)}" aria-label="${escapeHTML(t.label)}">
          ${t.badge != null ? `<span class="home-tile__badge" aria-hidden="true">${t.badge}</span>` : ""}
          <span class="home-tile__icon">${t.svg}</span>
          <span class="home-tile__label">${escapeHTML(t.label)}</span>
          ${t.sub ? `<span class="home-tile__sub">${escapeHTML(t.sub)}</span>` : ""}
        </button>`
    )
    .join("");

  const notifBadge = unreadCount > 0
    ? `<div class="home-header__notif" aria-label="${unreadCount} neue Mitteilungen">
         <span class="home-header__notif-dot" aria-hidden="true"></span>
         ${unreadCount} neu
       </div>`
    : "";

  _container.innerHTML = `
    <div class="home-screen">

      <div class="home-header">
        <div class="home-header__top">
          <div class="home-header__logo">
            <span class="home-header__logo-icon" aria-hidden="true">🏡</span>
            <span class="home-header__logo-name">Villa Kunterbunt</span>
          </div>
          ${notifBadge}
        </div>
        <p class="home-header__greeting">${escapeHTML(greeting())},</p>
        <p class="home-header__name">${escapeHTML(firstName(_user.displayName))}</p>
      </div>

      <div class="home-body">

        ${weekCardHTML(_shifts)}

        <p class="home-section-label">Schnellzugriff</p>

        <div class="home-tile-grid" role="list">
          ${tilesHTML}
        </div>

      </div>

    </div>`;

  // Kachel-Navigation
  _container.querySelectorAll(".home-tile[data-screen]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.hash = btn.dataset.screen;
    });
  });
}

// ── Export ────────────────────────────────────────────────────

/**
 * Rendert den Home-Screen (Dashboard mit Heute-Karte und Kachel-Grid).
 * @param {HTMLElement} container
 * @param {{ id:string, displayName:string, group:string, role?:string }} user
 * @param {Array} shifts
 * @param {Array} requests
 * @param {Array} notifications
 */
export function renderHome(container, user, shifts, requests, notifications) {
  _container     = container;
  _user          = user;
  _shifts        = shifts        ?? [];
  _requests      = requests      ?? [];
  _notifications = notifications ?? [];
  _render();
}
