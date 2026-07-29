// src/screens/home.js
// Screen 1: Home — Kalenderwoche-Ansicht mit Wochennavigation

import { escapeHTML } from "../utils.js";

// ---- Modul-State für Wochennavigation -----------------------

let _weekOffset    = 0;
let _container     = null;
let _user          = null;
let _shifts        = [];
let _requests      = [];
let _notifications = [];

// ---- Hilfsfunktionen ----------------------------------------

/** Gibt YYYY-MM-DD für ein Datum in lokaler Zeit zurück (kein UTC-Shift) */
function dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Gibt die ISO-Datumszeichenkette für heute zurück: YYYY-MM-DD */
function todayStr() {
  return dateToISO(new Date());
}

/**
 * Gibt Mo–So der Woche mit gegebenem Offset zurück.
 * offset=0 → aktuelle Woche, offset=1 → nächste Woche usw.
 * @param {number} offset
 * @returns {Date[]} Array mit 5 Date-Objekten (Mo bis Fr)
 */
function getWeekDays(offset) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dow = now.getDay(); // 0=So, 1=Mo, ..., 6=Sa
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow === 0 ? 7 : dow) - 1) + offset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/**
 * Berechnet die ISO-Kalenderwochennummer eines Datums.
 * @param {Date} date
 * @returns {number}
 */
function getISOWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

/**
 * Formatiert den Datumsbereich Mo–Fr einer Woche.
 * Gleicher Monat:       "1. – 5. September 2026"
 * Verschiedene Monate:  "29. Sept. – 3. Oktober 2026"
 * @param {Date} monday
 * @param {Date} friday
 * @returns {string}
 */
function formatDateRange(monday, friday) {
  if (
    monday.getMonth() === friday.getMonth() &&
    monday.getFullYear() === friday.getFullYear()
  ) {
    const d1 = monday.toLocaleDateString("de-DE", { day: "numeric" });
    const d2 = friday.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${d1} – ${d2}`;
  }
  const d1 = monday.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
  });
  const d2 = friday.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${d1} – ${d2}`;
}

/** Kurzname des Wochentags auf Deutsch (passend zu getDay()) */
const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Gibt das Badge-HTML zurück — basierend auf Uhrzeit, nicht auf Typ-String.
 * Früh: Start vor 08:00 | Spät: Ende nach 16:00 | Teil/Urlaub/Krank: Typ-Label
 * @param {{ type:string, startTime:string|null, endTime:string|null }|null} shift
 * @returns {string}
 */
function shiftBadgeHTML(shift) {
  if (!shift || shift.type === "frei") return "";
  if (shift.type === "urlaub") return `<span class="shift-badge shift-badge--urlaub">Urlaub</span>`;
  if (shift.type === "krank")  return `<span class="shift-badge shift-badge--krank">Krank</span>`;
  if (shift.type === "teil")   return `<span class="shift-badge shift-badge--teil">Teil</span>`;
  if (shift.startTime && shift.startTime < "08:00") return `<span class="shift-badge shift-badge--frueh">Früh</span>`;
  if (shift.endTime   && shift.endTime   > "16:00") return `<span class="shift-badge shift-badge--spaet">Spät</span>`;
  return "";
}

// ---- Render-Funktion ----------------------------------------

function _renderWeekView() {
  if (!_container) return;

  const today    = todayStr();
  const weekDays = getWeekDays(_weekOffset);
  const monday   = weekDays[0];
  const friday   = weekDays[4];
  const kw        = getISOWeekNumber(monday);
  const dateRange = formatDateRange(monday, friday);

  // Wochenzeilen Mo–Fr rendern
  const rowsHTML = weekDays
    .map((day) => {
      const dateISO  = dateToISO(day);
      const shift    = _shifts.find((s) => s.date === dateISO) ?? null;
      const isToday  = dateISO === today;

      const weekdayLabel = WEEKDAY_SHORT[day.getDay()];
      const dayLabel = day.toLocaleDateString("de-DE", {
        day: "numeric",
        month: "short",
      }); // z.B. "1. Sep"

      // Uhrzeit-Spalte
      let timeHTML;
      if (!shift || shift.type === "frei" || !shift.startTime) {
        timeHTML = `<span class="week-row__time week-row__time--empty">—</span>`;
      } else {
        timeHTML = `<span class="week-row__time">${escapeHTML(shift.startTime)} – ${escapeHTML(shift.endTime)}</span>`;
      }

      // Badge-Spalte (zeit-basiert)
      const badge = shiftBadgeHTML(shift);

      return `
        <div class="week-row${isToday ? " week-row--today" : ""}" role="listitem">
          <span class="week-row__day">${weekdayLabel}</span>
          <span class="week-row__date">${escapeHTML(dayLabel)}</span>
          ${timeHTML}
          <span class="week-row__badge">${badge}</span>
        </div>`;
    })
    .join("");

  // Schnellzugriff-Karten
  const unreadCount  = (_notifications ?? []).filter(
    (n) => !n.confirmedBy.includes(_user.id)
  ).length;
  const pendingCount = (_requests ?? []).filter(
    (r) => r.status === "ausstehend"
  ).length;

  const quickCards = [];
  if (pendingCount > 0) {
    quickCards.push(`
      <button class="quick-card" data-nav="antraege">
        <span class="quick-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </span>
        <span class="quick-card__text">
          <strong>${pendingCount} Antrag${pendingCount !== 1 ? "räge" : ""} ausstehend</strong>
          <small>Tippen um Details zu sehen</small>
        </span>
        <svg class="quick-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16" aria-hidden="true">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>`);
  }
  if (unreadCount > 0) {
    quickCards.push(`
      <button class="quick-card" data-nav="infos">
        <span class="quick-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </span>
        <span class="quick-card__text">
          <strong>${unreadCount} ungelesene Mitteilung${unreadCount !== 1 ? "en" : ""}</strong>
          <small>Tippen um zu lesen</small>
        </span>
        <svg class="quick-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16" aria-hidden="true">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>`);
  }

  _container.innerHTML = `
    <div class="home-screen">

      <!-- KW-Header -->
      <header class="kw-header">
        <div class="kw-header__left">
          <button class="kw-nav-btn" id="week-prev" aria-label="Vorherige Woche">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round"
                 width="20" height="20" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span class="kw-header__kw">KW ${kw}</span>
          <button class="kw-nav-btn" id="week-next" aria-label="Nächste Woche">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round"
                 width="20" height="20" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </header>
      <p class="kw-date-range">${escapeHTML(dateRange)}</p>

      <!-- Wochenliste Mo–So -->
      <div class="week-list" role="list" aria-label="Dienste diese Woche">
        ${rowsHTML}
      </div>

      <!-- Schnellzugriff -->
      ${quickCards.length > 0
        ? `<div class="quick-access">${quickCards.join("")}</div>`
        : ""}

    </div>`;

  // Event-Handler: Wochennavigation
  _container.querySelector("#week-prev").addEventListener("click", () => {
    _weekOffset -= 1;
    _renderWeekView();
  });
  _container.querySelector("#week-next").addEventListener("click", () => {
    _weekOffset += 1;
    _renderWeekView();
  });

  // Event-Handler: Schnellzugriff-Navigation
  _container.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.hash = btn.dataset.nav;
    });
  });
}

// ---- Hauptexport --------------------------------------------

/**
 * Rendert den Home-Screen (Kalenderwoche-Ansicht).
 * @param {HTMLElement} container
 * @param {{ id:string, displayName:string, group:string }} user
 * @param {Array} shifts         Dienste (alle verfügbaren Monate)
 * @param {Array} requests
 * @param {Array} notifications
 */
export function renderHome(container, user, shifts, requests, notifications, initialOffset = 0) {
  _weekOffset    = initialOffset;
  _container     = container;
  _user          = user;
  _shifts        = shifts        ?? [];
  _requests      = requests      ?? [];
  _notifications = notifications ?? [];
  _renderWeekView();
}
