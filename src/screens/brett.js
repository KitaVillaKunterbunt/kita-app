// src/screens/brett.js
// Schwarzes Brett — dauerhafte Aushänge der Leitung (optional mit Ablaufdatum)

import { escapeHTML } from "../utils.js";

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

function aushangCardHTML(aushang, isLeitung) {
  const ablaufHTML = aushang.ablaufdatum
    ? `<span class="brett-card__expiry">Gültig bis ${escapeHTML(formatDate(aushang.ablaufdatum + "T00:00:00"))}</span>`
    : "";
  const deleteHTML = isLeitung
    ? `<button class="brett-card__delete" data-action="delete" data-id="${escapeHTML(aushang.id)}" aria-label="Aushang löschen">🗑</button>`
    : "";

  return `
    <div class="brett-card" data-id="${escapeHTML(aushang.id)}">
      <div class="brett-card__header">
        <p class="brett-card__title">📌 ${escapeHTML(aushang.titel)}</p>
        ${deleteHTML}
      </div>
      <p class="brett-card__body">${escapeHTML(aushang.text)}</p>
      <div class="brett-card__meta">
        <span>${escapeHTML(formatDate(aushang.erstellt))} · ${escapeHTML(aushang.von ?? "Leitung")}</span>
        ${ablaufHTML}
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {Array} aushaenge
 * @param {boolean} isLeitung
 * @param {function} onCreateClick   () => void
 * @param {function} onDelete        async (id) => void
 */
export function renderBrett(container, aushaenge, isLeitung, onCreateClick, onDelete) {
  const createBtnHTML = isLeitung
    ? `<button class="btn btn--primary btn--sm brett-create-btn" id="brett-create-btn">+ Neuer Aushang</button>`
    : "";

  const listHTML = aushaenge.length > 0
    ? aushaenge.map((a) => aushangCardHTML(a, isLeitung)).join("")
    : `<div class="empty-state">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
           <rect x="3" y="4" width="18" height="16" rx="2"/>
           <path d="M8 2v4M16 2v4M3 10h18"/>
         </svg>
         <p>Aktuell keine Aushänge.</p>
       </div>`;

  container.innerHTML = `
    <button class="screen-back-btn" onclick="window.location.hash='home'">&#8592; Startseite</button>
    <div class="screen-title-row">
      <h1 class="screen-title">Schwarzes Brett</h1>
      ${createBtnHTML}
    </div>
    <div id="brett-list">${listHTML}</div>`;

  const createBtn = container.querySelector("#brett-create-btn");
  if (createBtn && onCreateClick) {
    createBtn.addEventListener("click", onCreateClick);
  }

  container.querySelector("#brett-list").addEventListener("click", async (e) => {
    const delBtn = e.target.closest("[data-action='delete']");
    if (!delBtn || !onDelete) return;
    delBtn.disabled = true;
    await onDelete(delBtn.dataset.id);
  });
}
