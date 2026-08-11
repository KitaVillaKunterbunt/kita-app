// src/screens/brett.js
// Schwarzes Brett — permanente Aushänge (Regeln, Öffnungszeiten, Dokumente)

import { escapeHTML } from "../utils.js";

const CATEGORY_LABEL = {
  regeln:    "Regeln",
  zeiten:    "Öffnungszeiten",
  dokument:  "Dokumente",
  sonstiges: "Sonstiges",
};

const CATEGORY_ICON = {
  regeln:    "📋",
  zeiten:    "🕐",
  dokument:  "📄",
  sonstiges: "📌",
};

function isLeitungUser(user) {
  const role = (user.role ?? "").trim().toLowerCase();
  return ["leitung", "stellvertreterin", "stellvertretung", "kita-leitung"].includes(role);
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleDateString("de-DE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function entryCardHTML(entry, isLeitung) {
  const icon     = CATEGORY_ICON[entry.category] ?? "📌";
  const catLabel = CATEGORY_LABEL[entry.category] ?? escapeHTML(entry.category);
  const canDelete = isLeitung && entry.source !== "plan";
  const deleteBtn = canDelete
    ? `<button class="btn btn--ghost btn--sm brett-delete-btn"
               data-action="delete"
               data-entry-id="${escapeHTML(entry.id)}"
               aria-label="Eintrag löschen">🗑</button>`
    : "";

  return `
    <div class="brett-card">
      <div class="brett-card__header">
        <span class="brett-card__icon">${icon}</span>
        <div class="brett-card__meta">
          <strong class="brett-card__title">${escapeHTML(entry.title)}</strong>
          <span class="brett-card__cat">${catLabel}</span>
        </div>
        ${deleteBtn}
      </div>
      ${entry.body ? `<p class="brett-card__body">${escapeHTML(entry.body)}</p>` : ""}
      ${entry.createdAt ? `<p class="brett-card__date">Erstellt: ${formatDate(entry.createdAt)}</p>` : ""}
    </div>`;
}

function addEntryModalHTML() {
  const categoryOptions = Object.entries(CATEGORY_LABEL)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  return `
    <div class="decision-modal-overlay" id="brett-add-overlay">
      <div class="decision-modal">
        <h3 class="decision-modal__title">Neuer Aushang</h3>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
          <div>
            <label class="form-label" for="brett-new-title">Titel</label>
            <input class="form-input" type="text" id="brett-new-title"
                   placeholder="z.B. Geänderte Öffnungszeiten" maxlength="100">
          </div>
          <div>
            <label class="form-label" for="brett-new-body">Inhalt (optional)</label>
            <textarea class="form-textarea" id="brett-new-body" rows="3"
                      placeholder="Details …"></textarea>
          </div>
          <div>
            <label class="form-label" for="brett-new-cat">Kategorie</label>
            <select class="form-select" id="brett-new-cat">
              ${categoryOptions}
            </select>
          </div>
        </div>
        <div class="decision-modal__actions">
          <button class="btn btn--ghost" id="brett-add-cancel">Abbrechen</button>
          <button class="btn btn--primary" id="brett-add-confirm">Hinzufügen</button>
        </div>
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {Array} entries        — aus api.getBrettEntries()
 * @param {{ id:string, role:string }} user
 * @param {function} [onAdd]     — async ({ title, body, category }) => void
 * @param {function} [onDelete]  — async (entryId) => void
 */
export function renderBrett(container, entries, user, onAdd, onDelete) {
  const isLeitung = isLeitungUser(user);
  let activeFilter = "alle";

  const usedCategories = [...new Set(entries.map((e) => e.category))];
  const filterKeys = ["alle", ...Object.keys(CATEGORY_LABEL).filter((k) => usedCategories.includes(k))];

  function render() {
    const filtered = activeFilter === "alle"
      ? entries
      : entries.filter((e) => e.category === activeFilter);

    const filterTabsHTML = filterKeys.map((key) => {
      const label = key === "alle" ? "Alle" : (CATEGORY_LABEL[key] ?? key);
      return `<button class="filter-tab ${key === activeFilter ? "active" : ""}" data-filter="${key}">${label}</button>`;
    }).join("");

    const listHTML = filtered.length > 0
      ? filtered.map((e) => entryCardHTML(e, isLeitung)).join("")
      : `<div class="empty-state">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
             <rect x="3" y="3" width="18" height="18" rx="2"/>
             <line x1="3" y1="9" x2="21" y2="9"/>
             <line x1="9" y1="21" x2="9" y2="9"/>
           </svg>
           <p>Noch keine Aushänge vorhanden.</p>
         </div>`;

    container.innerHTML = `
      <button class="screen-back-btn" onclick="window.location.hash='home'">&#8592; Startseite</button>
      <div class="brett-header">
        <h1 class="screen-title" style="margin:0">Schwarzes Brett</h1>
        ${isLeitung && onAdd ? `<button class="btn btn--primary btn--sm" id="brett-add-btn">+ Neu</button>` : ""}
      </div>
      <div class="filter-tabs" role="tablist" aria-label="Kategorie-Filter">
        ${filterTabsHTML}
      </div>
      <div id="brett-list">${listHTML}</div>`;

    attachListeners();
  }

  function attachListeners() {
    container.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeFilter = tab.dataset.filter;
        render();
      });
    });

    container.querySelector("#brett-add-btn")?.addEventListener("click", () => {
      document.body.insertAdjacentHTML("beforeend", addEntryModalHTML());
      const overlay = document.getElementById("brett-add-overlay");

      const close = () => overlay.remove();
      overlay.querySelector("#brett-add-cancel").addEventListener("click", close);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

      overlay.querySelector("#brett-add-confirm").addEventListener("click", async () => {
        const titleEl = overlay.querySelector("#brett-new-title");
        const title = titleEl.value.trim();
        if (!title) { titleEl.focus(); return; }
        const body     = overlay.querySelector("#brett-new-body").value.trim();
        const category = overlay.querySelector("#brett-new-cat").value;
        close();
        if (onAdd) await onAdd({ title, body, category });
      });
    });

    container.querySelector("#brett-list").addEventListener("click", async (e) => {
      const deleteBtn = e.target.closest("[data-action='delete']");
      if (deleteBtn && onDelete) {
        e.stopPropagation();
        deleteBtn.disabled = true;
        deleteBtn.textContent = "…";
        await onDelete(deleteBtn.dataset.entryId);
      }
    });
  }

  render();
}
