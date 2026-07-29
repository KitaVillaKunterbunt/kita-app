// src/screens/antrag.js
// Screen 3: Antrag stellen — Urlaub / Dienstwunsch / Diensttausch / Krankmeldung

import { escapeHTML } from "../utils.js";

/** ISO-Datum für heute */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Shift als lesbaren String formatieren */
function shiftLabel(shift) {
  if (!shift) return "—";
  const date = new Date(shift.date + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short", day: "numeric", month: "short",
  });
  const typeMap = { frueh: "Frühdienst", spaet: "Spätdienst", teil: "Teildienst", frei: "Frei", urlaub: "Urlaub", krank: "Krank" };
  const type = typeMap[shift.type] ?? shift.type;
  const time = shift.startTime ? ` ${shift.startTime}–${shift.endTime}` : "";
  return `${date} · ${type}${time}`;
}

// ============================================================
// Formular-Builder pro Typ
// ============================================================

function buildUrlaub() {
  return `
    <div class="form-group">
      <label class="form-label">Zeitraum wählen</label>
      ${calendarPickerHTML("range")}
    </div>
    <div class="form-group">
      <label class="form-label" for="field-note">Anmerkung (optional)</label>
      <textarea class="form-textarea" id="field-note" name="note" placeholder="z. B. Familienurlaub" rows="2"></textarea>
    </div>`;
}

function buildDienstwunsch() {
  return `
    <div class="form-group">
      <label class="form-label">Datum wählen</label>
      ${calendarPickerHTML("single")}
    </div>
    <div class="form-group">
      <label class="form-label" for="field-wunsch">Gewünschte Schicht</label>
      <select class="form-select" id="field-wunsch" name="wunsch" required>
        <option value="">Bitte wählen …</option>
        <option value="Frühdienst">Frühdienst (07:00–14:00)</option>
        <option value="Spätdienst">Spätdienst (12:00–19:00)</option>
        <option value="Teildienst">Teildienst (09:00–15:00)</option>
      </select>
      <p class="form-error" id="err-wunsch">Bitte eine Schicht wählen.</p>
    </div>
    <div class="form-group">
      <label class="form-label" for="field-note">Begründung (optional)</label>
      <textarea class="form-textarea" id="field-note" name="note" placeholder="z. B. Arzttermin am Nachmittag" rows="2"></textarea>
    </div>`;
}

function buildDiensttausch(shifts, colleagues) {
  const tauschableShifts = shifts.filter(
    (s) => s.type !== "frei" && s.type !== "urlaub" && s.type !== "krank" && s.startTime
  );

  const shiftOptions = tauschableShifts.length > 0
    ? tauschableShifts.map((s) =>
        `<option value="${escapeHTML(s.id)}">${escapeHTML(shiftLabel(s))}</option>`
      ).join("")
    : `<option value="">Keine Dienste verfügbar</option>`;

  const colleagueOptions = colleagues.length > 0
    ? colleagues.map((c) =>
        `<option value="${escapeHTML(c.id)}" data-name="${escapeHTML(c.displayName)}">
          ${escapeHTML(c.displayName)} (${escapeHTML(c.group)})
        </option>`
      ).join("")
    : `<option value="">Keine Kolleginnen verfügbar</option>`;

  return `
    <div class="antrag-info-box">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>Die Kollegin muss zustimmen. Danach genehmigt die Leitung den Tausch.</span>
    </div>
    <div class="form-group">
      <label class="form-label" for="field-myShift">Mein Dienst (den ich abgeben möchte)</label>
      <select class="form-select" id="field-myShift" name="myShift" required>
        <option value="">Dienst wählen …</option>
        ${shiftOptions}
      </select>
      <p class="form-error" id="err-myShift">Bitte einen Dienst wählen.</p>
    </div>
    <div class="form-group">
      <label class="form-label" for="field-colleague">Tausch mit</label>
      <select class="form-select" id="field-colleague" name="colleague" required>
        <option value="">Kollegin wählen …</option>
        ${colleagueOptions}
      </select>
      <p class="form-error" id="err-colleague">Bitte eine Kollegin wählen.</p>
    </div>
    <div class="form-group">
      <label class="form-label" for="field-note">Notiz (optional)</label>
      <textarea class="form-textarea" id="field-note" name="note" placeholder="z. B. Ich hätte gerne den Frühdienst" rows="2"></textarea>
    </div>`;
}


// ============================================================
// Validierung
// ============================================================

function validate(form, activeType) {
  let valid = true;

  const clearErr = (id) => { const el = form.querySelector(`#${id}`); if (el) el.classList.remove("visible"); };
  const showErr  = (id) => { const el = form.querySelector(`#${id}`); if (el) el.classList.add("visible"); valid = false; };

  // dateFrom: visible date input (diensttausch) OR hidden calendar input (urlaub, dienstwunsch)
  const dateFrom = form.querySelector("#field-dateFrom");
  if (dateFrom) {
    if (!dateFrom.value) { showErr("err-dateFrom"); } else { clearErr("err-dateFrom"); }
  }

  // dateTo: only present as visible input in diensttausch legacy forms
  const dateTo   = form.querySelector("#field-dateTo");
  const errDateTo = form.querySelector("#err-dateTo");
  if (dateTo && errDateTo) {
    if (!dateTo.value || (dateFrom?.value && dateTo.value < dateFrom.value)) {
      showErr("err-dateTo");
    } else {
      clearErr("err-dateTo");
    }
  }

  if (activeType === "dienstwunsch") {
    const wunsch = form.querySelector("#field-wunsch");
    if (!wunsch?.value) { showErr("err-wunsch"); } else { clearErr("err-wunsch"); }
  }

  if (activeType === "diensttausch") {
    const myShift   = form.querySelector("#field-myShift");
    const colleague = form.querySelector("#field-colleague");
    if (!myShift?.value)   { showErr("err-myShift"); }   else { clearErr("err-myShift"); }
    if (!colleague?.value) { showErr("err-colleague"); } else { clearErr("err-colleague"); }
  }

  return valid;
}

// ============================================================
// Daten sammeln
// ============================================================

function collectData(form, userId, activeType, shifts, colleagues) {
  const dateFrom  = form.querySelector("#field-dateFrom")?.value ?? todayISO();
  const dateTo    = form.querySelector("#field-dateTo")?.value   ?? dateFrom;
  const note      = form.querySelector("#field-note")?.value?.trim() || null;

  if (activeType === "dienstwunsch") {
    const wunsch = form.querySelector("#field-wunsch")?.value ?? "";
    return {
      userId, type: "dienstwunsch",
      dateFrom, dateTo: dateFrom,
      note: wunsch ? `${wunsch}${note ? " — " + note : ""}` : note,
    };
  }

  if (activeType === "diensttausch") {
    const shiftId     = form.querySelector("#field-myShift")?.value ?? "";
    const colleagueId = form.querySelector("#field-colleague")?.value ?? "";
    const myShift     = shifts.find((s) => s.id === shiftId) ?? null;
    const colleague   = colleagues.find((c) => c.id === colleagueId) ?? null;
    return {
      userId, type: "diensttausch",
      dateFrom: myShift?.date ?? dateFrom,
      dateTo:   myShift?.date ?? dateFrom,
      note,
      colleagueId:   colleague?.id   ?? null,
      colleagueName: colleague?.displayName ?? null,
      myShift:       myShift ? { date: myShift.date, type: myShift.type, startTime: myShift.startTime, endTime: myShift.endTime } : null,
      colleagueShift: null,
    };
  }

  return { userId, type: activeType, dateFrom, dateTo, note };
}

// ============================================================
// Kalender-Range-Picker
// ============================================================

/** Gibt den HTML-Rumpf des Kalender-Pickers zurück (ohne Event-Handler). */
function calendarPickerHTML(mode) {
  return `
    <div class="drp" id="date-range-picker" data-mode="${mode}">
      <div class="drp__header">
        <button type="button" class="drp__nav" id="drp-prev" aria-label="Vorheriger Monat">&#8249;</button>
        <span class="drp__title" id="drp-title"></span>
        <button type="button" class="drp__nav" id="drp-next" aria-label="Nächster Monat">&#8250;</button>
      </div>
      <div class="drp__weekdays" aria-hidden="true">
        <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
      </div>
      <div class="drp__grid" id="drp-grid"></div>
      <div class="drp__hint" id="drp-hint"></div>
    </div>
    <input type="hidden" id="field-dateFrom" name="dateFrom" value="">
    <input type="hidden" id="field-dateTo"   name="dateTo"   value="">
    <p class="form-error" id="err-dateFrom">Bitte einen Tag auswählen.</p>`;
}

/**
 * Initialisiert den Kalender-Picker (Event-Handler).
 * Muss nach dem Rendern des Formulars aufgerufen werden.
 * @param {HTMLElement} form
 * @param {number} initYear   Starjanr (z. B. 2026)
 * @param {number} initMonth  Startmonat 1-basiert (z. B. 9 für September)
 */
function attachCalendarPicker(form, initYear, initMonth) {
  const picker = form.querySelector("#date-range-picker");
  if (!picker) return;

  const mode      = picker.dataset.mode ?? "range";
  const grid      = picker.querySelector("#drp-grid");
  const titleEl   = picker.querySelector("#drp-title");
  const hintEl    = picker.querySelector("#drp-hint");
  const inputFrom = form.querySelector("#field-dateFrom");
  const inputTo   = form.querySelector("#field-dateTo");

  const MONTHS = [
    "Januar","Februar","März","April","Mai","Juni",
    "Juli","August","September","Oktober","November","Dezember",
  ];

  let year     = initYear  ?? new Date().getFullYear();
  let month    = (initMonth ?? (new Date().getMonth() + 1)) - 1; // 0-basiert
  let fromISO  = null;
  let toISO    = null;
  let hoverISO = null;

  function localISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function cellISO(y, m0, d) {
    return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function formatDE(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
      day: "numeric", month: "long", year: "numeric",
    });
  }

  function updateHint() {
    if (!fromISO) {
      hintEl.textContent = mode === "single"
        ? "Tippe auf einen Tag"
        : "1. Tippe auf den Starttag";
      hintEl.className = "drp__hint";
    } else if (mode === "range" && !toISO) {
      hintEl.textContent = `Von: ${formatDE(fromISO)} — jetzt Endtag tippen`;
      hintEl.className = "drp__hint drp__hint--partial";
    } else {
      hintEl.textContent = (!toISO || fromISO === toISO)
        ? formatDE(fromISO)
        : `${formatDE(fromISO)} – ${formatDE(toISO)}`;
      hintEl.className = "drp__hint drp__hint--complete";
    }
    inputFrom.value = fromISO ?? "";
    inputTo.value   = toISO ?? fromISO ?? "";
  }

  function renderGrid() {
    titleEl.textContent = `${MONTHS[month]} ${year}`;

    const today    = localISO(new Date());
    const firstDow = new Date(year, month, 1).getDay();
    const offset   = (firstDow + 6) % 7; // Mo=0 … So=6
    const days     = new Date(year, month + 1, 0).getDate();

    let html = "";
    for (let i = 0; i < offset; i++) {
      html += `<div class="drp__cell drp__cell--empty"></div>`;
    }

    for (let d = 1; d <= days; d++) {
      const iso       = cellISO(year, month, d);
      const dow       = new Date(year, month, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isToday   = iso === today;
      const isFrom    = iso === fromISO;
      const isTo      = iso === toISO;
      const isSingle  = isFrom && isTo;
      const inRange   = !isSingle && fromISO && toISO && iso > fromISO && iso < toISO;
      const effHover  = (hoverISO && fromISO && !toISO && hoverISO > fromISO) ? hoverISO : null;
      const inHover   = effHover && iso > fromISO && iso < effHover;
      const isHoverEnd = effHover && iso === effHover;

      let cls = "drp__cell";
      if (isWeekend)                   cls += " drp__cell--weekend";
      if (isToday && !isFrom && !isTo) cls += " drp__cell--today";
      if (isSingle)                    cls += " drp__cell--single";
      else if (isFrom)                 cls += " drp__cell--from";
      else if (isTo)                   cls += " drp__cell--to";
      if (inRange)                     cls += " drp__cell--range";
      if (inHover)                     cls += " drp__cell--hover-range";
      if (isHoverEnd)                  cls += " drp__cell--hover-end";

      const attrs = isWeekend ? "" : `data-date="${iso}"`;
      html += `<div class="${cls}" ${attrs}><span>${d}</span></div>`;
    }
    grid.innerHTML = html;
  }

  // Click: Datum auswählen
  grid.addEventListener("click", (e) => {
    const cell = e.target.closest(".drp__cell[data-date]");
    if (!cell) return;
    const iso = cell.dataset.date;

    if (mode === "single") {
      fromISO = iso;
      toISO   = iso;
    } else if (!fromISO || toISO) {
      fromISO  = iso;
      toISO    = null;
      hoverISO = null;
    } else {
      if (iso < fromISO)       { toISO = fromISO; fromISO = iso; }
      else if (iso === fromISO) { toISO = iso; }
      else                      { toISO = iso; }
      hoverISO = null;
    }
    updateHint();
    renderGrid();
  });

  // Hover-Preview (nur Desktop/Mouse)
  grid.addEventListener("mousemove", (e) => {
    if (!fromISO || toISO || mode !== "range") return;
    const cell     = e.target.closest(".drp__cell[data-date]");
    const newHover = (cell && cell.dataset.date > fromISO) ? cell.dataset.date : null;
    if (newHover !== hoverISO) { hoverISO = newHover; renderGrid(); }
  });
  grid.addEventListener("mouseleave", () => {
    if (hoverISO) { hoverISO = null; renderGrid(); }
  });

  // Monatsnavigation
  picker.querySelector("#drp-prev").addEventListener("click", () => {
    month--; if (month < 0) { month = 11; year--; }
    renderGrid();
  });
  picker.querySelector("#drp-next").addEventListener("click", () => {
    month++; if (month > 11) { month = 0; year++; }
    renderGrid();
  });

  updateHint();
  renderGrid();
}

// ============================================================
// Haupt-Export
// ============================================================

const TABS = [
  { key: "urlaub",       label: "Urlaub" },
  { key: "dienstwunsch", label: "Dienstwunsch" },
  { key: "diensttausch", label: "Diensttausch" },
];

/**
 * @param {HTMLElement} container
 * @param {{ id:string, displayName:string }} user
 * @param {{ shifts: Array, colleagues: Array }} context
 * @param {function} onSubmit  async (requestData) => void
 */
export function renderAntrag(container, user, context = {}, onSubmit) {
  const shifts     = context.shifts     ?? [];
  const colleagues = context.colleagues ?? [];
  let activeType   = "urlaub";

  function buildFields() {
    switch (activeType) {
      case "dienstwunsch": return buildDienstwunsch();
      case "diensttausch": return buildDiensttausch(shifts, colleagues);
      case "krankmeldung": return buildKrankmeldung();
      default:             return buildUrlaub();
    }
  }

  function render() {
    container.innerHTML = `
      <h1 class="screen-title">Antrag stellen</h1>

      <div class="type-tabs" role="tablist" aria-label="Antragstyp">
        ${TABS.map(({ key, label }) => `
          <button class="type-tab ${key === activeType ? "active" : ""}"
                  role="tab" aria-selected="${key === activeType}" data-type="${key}">
            ${label}
          </button>`).join("")}
      </div>

      <form id="antrag-form" novalidate>
        <input type="hidden" name="type" value="${activeType}">
        ${buildFields()}
        <p class="form-error" id="antrag-submit-error" style="margin-bottom:12px"></p>
        <button type="submit" class="btn btn--primary btn--full" id="antrag-submit-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Antrag absenden
        </button>
      </form>`;

    attachListeners();
  }

  function attachListeners() {
    container.querySelectorAll(".type-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeType = tab.dataset.type;
        render();
      });
    });

    const form = container.querySelector("#antrag-form");

    // Kalender-Picker für Urlaub & Dienstwunsch
    const initY = context.planYear  ?? new Date().getFullYear();
    const initM = context.planMonth ?? (new Date().getMonth() + 1);
    attachCalendarPicker(form, initY, initM);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validate(form, activeType)) return;

      const btn    = form.querySelector("#antrag-submit-btn");
      const errEl  = form.querySelector("#antrag-submit-error");
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner"></span> Wird gesendet …`;

      try {
        const data = collectData(form, user.id, activeType, shifts, colleagues);
        await onSubmit(data);
        render(); // Formular zurücksetzen für nächsten Antrag
        return;
      } catch {
        errEl.textContent = "Fehler beim Senden. Bitte erneut versuchen.";
        errEl.classList.add("visible");
        btn.disabled = false;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg> Antrag absenden`;
      }
    });
  }

  render();
}
