// src/screens/plan.js
// Screen 2: Mein Plan — Monatskalender mit Schichten farblich markiert

// Modul-Zustand für Monatsnavigation
let _month = 8;   // August (1-basiert)
let _year  = 2026;

// Callback: App.js soll bei Monatswechsel neue Daten laden
let _onMonthChange = null;

/** Setzt den Callback für Monatswechsel. Wird von app.js gesetzt. */
export function setOnMonthChange(cb) {
  _onMonthChange = cb;
}

const MONTH_NAMES_DE = [
  "", "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TYPE_LABEL = {
  frueh:  "Frühdienst",
  spaet:  "Spätdienst",
  teil:   "Teildienst",
  frei:   "Frei",
  urlaub: "Urlaub",
  krank:  "Krank",
};

/** Gibt YYYY-MM-DD für heute zurück (lokale Zeit, kein UTC-Shift) */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Gibt den ersten Wochentag des Monats zurück (0=Mo … 6=So, europäisch) */
function firstWeekday(year, month) {
  const d = new Date(year, month - 1, 1).getDay(); // 0=So
  return d === 0 ? 6 : d - 1; // Mo=0 … So=6
}

/** Anzahl Tage im Monat */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Baut die Kalender-Zellen auf */
function buildCalendarCells(year, month, shifts) {
  const shiftMap = {};
  shifts.forEach((s) => { shiftMap[s.date] = s; });

  const startOffset = firstWeekday(year, month);
  const days = daysInMonth(year, month);
  const today = todayStr();

  const cells = [];

  // Leere Zellen vor dem 1.
  for (let i = 0; i < startOffset; i++) {
    cells.push(`<div class="calendar-day calendar-day--empty"></div>`);
  }

  for (let day = 1; day <= days; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const shift = shiftMap[dateStr] ?? null;
    const isToday = dateStr === today;
    const dow = new Date(year, month - 1, day).getDay(); // 0=So, 6=Sa
    const isWeekend = dow === 0 || dow === 6;

    const dotHTML = (shift && shift.type !== "frei")
      ? `<span class="day-dot day-dot--${shift.type}"></span>`
      : "";

    const classes = [
      "calendar-day",
      isToday ? "calendar-day--today" : "",
      isWeekend ? "calendar-day--weekend" : "",
    ].filter(Boolean).join(" ");

    cells.push(`
      <div class="${classes}"
           data-date="${dateStr}" ${shift ? `data-shift-id="${shift.id}"` : ""}>
        <span class="day-num">${day}</span>
        ${dotHTML}
      </div>`);
  }

  return cells.join("");
}

/** Rendert das Detail-Panel für einen ausgewählten Tag */
function renderDayDetail(container, date, shift) {
  let existing = container.querySelector(".day-detail");
  if (existing) existing.remove();

  const d = new Date(date + "T00:00:00");
  const dateFormatted = d.toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long",
  });

  let detailContent = "";
  let typeClass = "";
  if (shift && shift.type !== "frei") {
    const label = TYPE_LABEL[shift.type] ?? shift.type;
    typeClass = `day-detail--${shift.type}`;
    const mainLine = shift.startTime
      ? `${shift.startTime} – ${shift.endTime} · ${label}`
      : label;
    const meta = [shift.group, shift.room, shift.note].filter(Boolean).join(" · ");
    detailContent = `
      <p class="day-detail__main">${mainLine}</p>
      ${meta ? `<p class="day-detail__meta">${meta}</p>` : ""}`;
  } else {
    detailContent = `<p class="day-detail__empty">Kein Dienst eingetragen.</p>`;
  }

  const div = document.createElement("div");
  div.className = `day-detail ${typeClass}`;
  div.innerHTML = `
    <div class="day-detail__header">
      <span class="day-detail__date">${dateFormatted}</span>
      <button class="day-detail-close" aria-label="Schließen">✕</button>
    </div>
    ${detailContent}`;

  container.querySelector(".plan-calendar").appendChild(div);

  div.querySelector(".day-detail-close").addEventListener("click", () => div.remove());
}

/**
 * Rendert den Plan-Screen.
 * @param {HTMLElement} container
 * @param {{ id:string, displayName:string }} user
 * @param {Array} shifts
 * @param {number} month
 * @param {number} year
 */
export function renderPlan(container, user, shifts, month, year) {
  _month = month;
  _year  = year;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;

  container.innerHTML = `
    <div class="plan-calendar">
      <h1 class="screen-title">Mein Plan</h1>

      <!-- Monatsnavigation -->
      <div class="calendar-nav">
        <button class="calendar-nav-btn" id="plan-prev" aria-label="Vorheriger Monat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <p class="calendar-nav-title">${MONTH_NAMES_DE[month]} ${year}</p>
        <button class="calendar-nav-btn" id="plan-next" aria-label="Nächster Monat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <!-- Wochentag-Header -->
      <div class="calendar-grid" style="margin-bottom:4px;">
        ${WEEKDAY_SHORT.map((d) => `<div class="calendar-header">${d}</div>`).join("")}
      </div>

      <!-- Kalender-Zellen -->
      <div class="calendar-grid" id="calendar-cells">
        ${buildCalendarCells(year, month, shifts)}
      </div>

      <!-- Legende -->
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:20px; padding:16px; background:var(--c-surface); border-radius:var(--r-md); border:1px solid var(--c-border);">
        ${Object.entries({
          frueh: "Frühdienst",
          spaet: "Spätdienst",
          teil:  "Teildienst",
          urlaub:"Urlaub",
        }).map(([type, label]) => `
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="day-dot day-dot--${type}" style="width:10px;height:10px;flex-shrink:0"></span>
            <span style="font-size:var(--text-xs);color:var(--c-text-secondary)">${label}</span>
          </div>`).join("")}
      </div>
    </div>`;

  // Event: Monat zurück
  container.querySelector("#plan-prev").addEventListener("click", () => {
    if (_onMonthChange) _onMonthChange(prevMonth, prevYear);
  });

  // Event: Monat vor
  container.querySelector("#plan-next").addEventListener("click", () => {
    if (_onMonthChange) _onMonthChange(nextMonth, nextYear);
  });

  // Event-Delegation: Tag antippen → Detail anzeigen
  container.querySelector("#calendar-cells").addEventListener("click", (e) => {
    const cell = e.target.closest("[data-date]");
    if (!cell
      || cell.classList.contains("calendar-day--empty")
      || cell.classList.contains("calendar-day--weekend")) return;

    // Hervorhebung
    container.querySelectorAll(".calendar-day--selected").forEach((el) =>
      el.classList.remove("calendar-day--selected")
    );
    cell.classList.add("calendar-day--selected");

    const date = cell.dataset.date;
    const shift = shifts.find((s) => s.date === date) ?? null;
    renderDayDetail(container, date, shift);
  });
}
