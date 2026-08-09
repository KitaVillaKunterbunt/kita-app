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

function todayCardHTML(shifts, userId) {
  const today = dateToISO(new Date());
  const shift = shifts.find((s) => s.date === today) ?? null;
  const dateLabel = new Date().toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  if (!shift || shift.type === "frei" || !shift.startTime) {
    return `
      <div class="home-today-card">
        <div class="home-today-card__left">
          <span class="home-today-card__label">Heute · ${escapeHTML(dateLabel)}</span>
          <span class="home-today-card__time home-today-card__time--free">Frei</span>
        </div>
      </div>`;
  }

  let badgeHTML = "";
  if (shift.type === "krank") {
    badgeHTML = `<span class="home-today-badge home-today-badge--krank">Krank</span>`;
  } else if (shift.type === "urlaub") {
    badgeHTML = `<span class="home-today-badge home-today-badge--urlaub">Urlaub</span>`;
  } else if (shift.startTime && shift.startTime < "07:30") {
    badgeHTML = `<span class="home-today-badge home-today-badge--frueh">Frühdienst</span>`;
  } else if (shift.endTime && shift.endTime > "16:30") {
    badgeHTML = `<span class="home-today-badge home-today-badge--spaet">Spätdienst</span>`;
  }

  const subLine = shift.group
    ? `<span class="home-today-card__sub">${escapeHTML(shift.group)}</span>`
    : "";

  return `
    <div class="home-today-card">
      <div class="home-today-card__left">
        <span class="home-today-card__label">Heute · ${escapeHTML(dateLabel)}</span>
        <span class="home-today-card__time">${escapeHTML(shift.startTime)} – ${escapeHTML(shift.endTime)}</span>
        ${subLine}
      </div>
      ${badgeHTML}
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
      label:  "Mein Plan",
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

        ${todayCardHTML(_shifts, _user.id)}

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
