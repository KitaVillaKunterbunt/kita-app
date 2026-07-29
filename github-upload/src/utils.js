// src/utils.js

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ESC[c]);
}
