// src/utils.js

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ESC[c]);
}

/**
 * Textlabel für eine Schicht anhand ihrer tatsächlichen Uhrzeit (nicht des
 * ggf. ungenauen "type"-Felds aus dem Plan-Export).
 * - "Frühdienst" nur wenn Start ≤ 07:00
 * - "Spätdienst" nur wenn Ende ≥ 17:00
 * - Alles dazwischen: kein Label (leerer String) — nur die Uhrzeit anzeigen
 * @param {{ type?:string, startTime?:string|null, endTime?:string|null }} shift
 * @returns {string}
 */
export function shiftTypeLabel(shift) {
  if (!shift) return "";
  if (shift.type === "urlaub") return "Urlaub";
  if (shift.type === "krank")  return "Krank";
  if (shift.type === "frei")   return "Frei";
  if (shift.type === "teil")   return "Teildienst";
  if (shift.startTime && shift.startTime <= "07:00") return "Frühdienst";
  if (shift.endTime && shift.endTime >= "17:00") return "Spätdienst";
  return "";
}

/**
 * Zeigt einen app-eigenen Bestätigungs-Dialog.
 * @param {string} message   Frage, die dem User gestellt wird
 * @param {string} [confirmLabel="Bestätigen"]
 * @param {string} [cancelLabel="Abbrechen"]
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, confirmLabel = "Bestätigen", cancelLabel = "Abbrechen") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    overlay.innerHTML = `
      <div class="confirm-card">
        <p class="confirm-message">${escapeHTML(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn--ghost btn--sm" id="confirm-cancel">${escapeHTML(cancelLabel)}</button>
          <button class="btn btn--danger btn--sm" id="confirm-ok">${escapeHTML(confirmLabel)}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    function close(result) {
      overlay.classList.add("confirm-overlay--out");
      overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
      resolve(result);
    }

    overlay.querySelector("#confirm-ok").addEventListener("click", () => close(true));
    overlay.querySelector("#confirm-cancel").addEventListener("click", () => close(false));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });

    // Fokus auf Abbrechen setzen (sicherer Default)
    requestAnimationFrame(() => overlay.querySelector("#confirm-cancel").focus());
  });
}
