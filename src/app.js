// src/app.js
// Haupteinstiegspunkt der Kita-App.
// Verantwortlich für: Auth-Init, Hash-Router, Screen-Rendering, Toast, Install-Prompt.

import { initAuth, getUser }              from "./auth.js";
import {
  getShifts,
  getRequests,
  getAllRequests,
  getNotifications,
  getColleagues,
  getMitarbeiter,
  getVacations,
  submitRequest,
  withdrawRequest,
  approveRequest,
  rejectRequest,
  confirmNotification,
  respondToSwapRequest,
  setPlanData,
  setPinsData,
  hasPlanData,
  isDemoMode,
  getDemoUser,
  getPlanMitarbeiter,
  validatePin,
  deleteNotification,
  deleteNotifications,
  getBrettEntries,
  addBrettEntry,
  deleteBrettEntry,
  getDebugInfo,
  refreshPlanData,
  getPlanExportTimestamp,
  getAvailableMonths,
  getAllUserShifts,
  setMockData,
} from "./data/api.js";

/** Nächsten verfügbaren Monat nahe dem heutigen Datum finden. */
function _nearestAvailableMonth(available, now) {
  if (available.length === 0) return null;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const exact = available.find((m) => `${m.jahr}-${String(m.monat).padStart(2, "0")}` === todayKey);
  if (exact) return exact;
  const future = available.find((m) => `${m.jahr}-${String(m.monat).padStart(2, "0")}` > todayKey);
  return future ?? available[available.length - 1];
}
import { escapeHTML } from "./utils.js";
import {
  detectNewContent,
  maybeAskPermission,
  showNativeNotification,
  isNotificationsEnabled,
  requestNotificationPermission,
  saveNotifPref,
  getLastVisit,
  setLastVisit,
  getLastPlanExported,
  setLastPlanExported,
} from "./notifications.js";
import { renderHome }          from "./screens/home.js";
import { renderPlan, setOnMonthChange } from "./screens/plan.js";
import { renderAntrag }        from "./screens/antrag.js";
import { renderMeineAntraege } from "./screens/meine-antraege.js";
import { renderInfos }         from "./screens/infos.js";
import { renderDashboard }     from "./screens/dashboard.js";
import { renderBrett }         from "./screens/brett.js";

// ============================================================
// DOM-Referenzen
// ============================================================

const screens = {
  home:      document.getElementById("screen-home"),
  plan:      document.getElementById("screen-plan"),
  antrag:    document.getElementById("screen-antrag"),
  antraege:  document.getElementById("screen-antraege"),
  infos:     document.getElementById("screen-infos"),
  dashboard: document.getElementById("screen-dashboard"),
  brett:     document.getElementById("screen-brett"),
};

const loadingOverlay = document.getElementById("loading-overlay");
const notifBadge     = document.getElementById("notif-badge");
const toastEl        = document.getElementById("toast");
const iosHint        = document.getElementById("ios-install-hint");
const settingsBtn    = document.getElementById("settings-btn");

// Plan-Screen: aktuell angezeigter Monat (startet beim aktuellen Kalendermonat)
const _initDate = new Date();
let planMonth = _initDate.getMonth() + 1;
let planYear  = _initDate.getFullYear();

// Install-Prompt (Android/Chrome)
let deferredInstallPrompt = null;

// PIN-Brute-Force-Schutz (session-only, kein localStorage)
let _pinFailCount = 0;
let _pinLockUntil = 0;

// ============================================================
// Leitung-Erkennung
// ============================================================

/** Gibt true zurück wenn der Benutzer Leitungszugang hat. */
function isLeadership(user) {
  if (!user) return false;
  const role = (user.role ?? "").trim().toLowerCase();
  return ["leitung", "stellvertreterin", "stellvertretung", "kita-leitung"].includes(role);
}

// ============================================================
// Toast-System
// ============================================================

let _toastTimer = null;

/**
 * Zeigt eine kurze Toast-Meldung.
 * @param {string} message
 * @param {'success'|'error'|''} type
 * @param {number} duration  ms
 */
function showToast(message, type = "", duration = 3000) {
  if (_toastTimer) clearTimeout(_toastTimer);
  toastEl.textContent = message;
  toastEl.className   = `toast${type ? " toast--" + type : ""}`;
  toastEl.hidden      = false;
  _toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, duration);
}

// ============================================================
// Navigation-Badge aktualisieren
// ============================================================

async function updateNotifBadge(user) {
  try {
    const notifs = await getNotifications(user.group, user.role);
    const unread = notifs.filter(
      (n) => !n.confirmedBy.includes(user.id) && (n.priority ?? n.type) === "sehrwichtig"
    ).length;
    notifBadge.textContent = unread;
    notifBadge.hidden      = unread === 0;
  } catch {
    notifBadge.hidden = true;
  }
}

// ============================================================
// Router — Screen wechseln
// ============================================================

/** Derzeit aktiver Screen-Name */
let _currentScreen = null;

/**
 * Navigiert zu einem Screen.
 * Lädt die Daten für den Ziel-Screen und rendert ihn.
 * @param {string} screenName  "home" | "plan" | "antrag" | "antraege" | "infos"
 */
async function navigate(screenName) {
  const user = getUser();
  if (!user) return;

  // Falls ungültig: Home
  const validScreens = Object.keys(screens);
  const target = validScreens.includes(screenName) ? screenName : "home";

  if (_currentScreen === target) return; // Kein Re-Render nötig (außer Daten-Update)

  _currentScreen = target;

  // Alle Screens verstecken
  Object.values(screens).forEach((s) => { s.hidden = true; });

  // Aktiven Nav-Button markieren
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const isActive = btn.dataset.screen === target;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-current", isActive ? "page" : "false");
  });

  // Ziel-Screen anzeigen
  const container = screens[target];
  container.hidden = false;

  const now = new Date();

  // Ladeanimation im Ziel-Screen während Daten geladen werden
  container.innerHTML = `<div class="screen-skeleton">
    <div class="skeleton skeleton--title"></div>
    <div class="skeleton skeleton--line"></div>
    <div class="skeleton skeleton--line skeleton--line-short"></div>
    <div class="skeleton skeleton--card"></div>
    <div class="skeleton skeleton--card"></div>
    <div class="skeleton skeleton--card"></div>
  </div>`;

  try {
    switch (target) {
      case "home": {
        const [allShifts, requests, notifications] = await Promise.all([
          getAllUserShifts(user.id),
          getRequests(user.id),
          getNotifications(user.group, user.role),
        ]);
        renderHome(container, user, allShifts ?? [], requests, notifications);
        updateNotifBadge(user);
        break;
      }

      case "plan": {
        const [shifts, notifications, mitarbeiter, vacations] = await Promise.all([
          getShifts(user.id, planMonth, planYear),
          getNotifications(user.group, user.role),
          getMitarbeiter(),
          getVacations(planMonth, planYear),
        ]);
        renderPlan(container, user, shifts, notifications, mitarbeiter, planMonth, planYear, vacations, getAvailableMonths());
        break;
      }

      case "antrag": {
        const [shifts, colleagues] = await Promise.all([
          getShifts(user.id, planMonth, planYear),
          getColleagues(),
        ]);
        renderAntrag(container, user, { shifts, colleagues, planMonth, planYear }, async (requestData) => {
          await submitRequest(requestData);
          const msg = requestData.type === "diensttausch"
            ? "Tauschanfrage gesendet — Kollegin wird benachrichtigt."
            : "Antrag erfolgreich eingereicht!";
          showToast(msg, "success");
        });
        break;
      }

      case "antraege": {
        const requests = await getRequests(user.id);
        const withdrawCb = async (requestId) => {
          const result = await withdrawRequest(requestId, user.id);
          if (result.success) {
            showToast("Antrag wurde zurückgezogen.", "success");
            const fresh = await getRequests(user.id);
            renderMeineAntraege(container, fresh, withdrawCb);
          } else {
            showToast("Dieser Antrag kann nicht mehr zurückgezogen werden.", "error");
          }
        };
        renderMeineAntraege(container, requests, withdrawCb);
        break;
      }

      case "infos": {
        const notifications = await getNotifications(user.group, user.role);

        const refreshInfos = async () => {
          const fresh = await getNotifications(user.group, user.role);
          renderInfos(container, fresh, user, confirmCb, swapCb, deleteCb, deleteAllCb);
          updateNotifBadge(user);
        };

        const confirmCb = async (notifId) => {
          await confirmNotification(notifId, user.id);
          showToast("Mitteilung bestätigt.", "success");
          await refreshInfos();
        };

        const swapCb = async (notifId, accept) => {
          await respondToSwapRequest(notifId, user.id, accept);
          showToast(accept ? "Du hast dem Tausch zugestimmt." : "Tauschanfrage abgelehnt.", accept ? "success" : "");
          await refreshInfos();
        };

        const deleteCb = async (notifId) => {
          deleteNotification(notifId);
          showToast("Mitteilung gelöscht.", "success");
          await refreshInfos();
        };

        const deleteAllCb = async (notifIds) => {
          deleteNotifications(notifIds);
          showToast(`${notifIds.length} Mitteilung${notifIds.length !== 1 ? "en" : ""} gelöscht.`, "success");
          await refreshInfos();
        };

        renderInfos(container, notifications, user, confirmCb, swapCb, deleteCb, deleteAllCb);
        updateNotifBadge(user);
        break;
      }

      case "dashboard": {
        if (!isLeadership(user)) {
          window.location.hash = "home";
          return;
        }
        const [allRequests, mitarbeiter, notifications] = await Promise.all([
          getAllRequests(),
          getMitarbeiter(),
          getNotifications(user.group, user.role),
        ]);

        const refreshDashboard = async () => {
          const [fresh, freshMit, freshNotifs] = await Promise.all([
            getAllRequests(),
            getMitarbeiter(),
            getNotifications(user.group, user.role),
          ]);
          renderDashboard(container, user, fresh, freshMit, freshNotifs, onApprove, onReject);
        };

        const onApprove = (requestId) => showDecisionModal(requestId, "genehmigen", async (note) => {
          await approveRequest(requestId, note);
          showToast("Antrag genehmigt.", "success");
          await refreshDashboard();
        });

        const onReject = (requestId) => showDecisionModal(requestId, "ablehnen", async (note) => {
          await rejectRequest(requestId, note);
          showToast("Antrag abgelehnt.", "");
          await refreshDashboard();
        });

        renderDashboard(container, user, allRequests, mitarbeiter, notifications, onApprove, onReject);
        break;
      }

      case "brett": {
        const entries = getBrettEntries();

        const refreshBrett = async () => {
          const fresh = getBrettEntries();
          renderBrett(container, fresh, user, addCb, deleteCb);
        };

        const addCb = async (entryData) => {
          addBrettEntry(entryData);
          showToast("Aushang hinzugefügt.", "success");
          await refreshBrett();
        };

        const deleteCb = async (entryId) => {
          deleteBrettEntry(entryId);
          showToast("Aushang gelöscht.", "success");
          await refreshBrett();
        };

        renderBrett(container, entries, user, addCb, deleteCb);
        break;
      }
    }
  } catch (err) {
    console.error("[Kita-App] Fehler beim Rendern von Screen:", target, err);
    container.innerHTML = `
      <div class="screen-error">
        <p class="screen-error__icon">⚠️</p>
        <p class="screen-error__msg">Fehler beim Laden. Bitte Seite neu laden.</p>
        <button class="btn btn--primary btn--sm" onclick="location.reload()">Neu laden</button>
      </div>`;
  }
}

// ============================================================
// Plan-Screen: Monatswechsel
// ============================================================

setOnMonthChange(async (month, year) => {
  planMonth = month;
  planYear  = year;
  const user = getUser();
  const [shifts, notifications, mitarbeiter, vacations] = await Promise.all([
    getShifts(user.id, month, year),
    getNotifications(user.group, user.role),
    getMitarbeiter(),
    getVacations(month, year),
  ]);
  renderPlan(screens.plan, user, shifts, notifications, mitarbeiter, month, year, vacations, getAvailableMonths());
});

// ============================================================
// Hash-Router
// ============================================================

function getHashScreen() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return hash || "home";
}

window.addEventListener("hashchange", () => {
  navigate(getHashScreen());
});

// ============================================================
// Bottom-Nav Click-Handler
// ============================================================

document.getElementById("bottom-nav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-screen]");
  if (!btn) return;
  const screen = btn.dataset.screen;
  if (window.location.hash === `#${screen}`) {
    // Bereits aktiv: Re-render erzwingen
    _currentScreen = null;
  }
  window.location.hash = screen;
});

// ============================================================
// PWA Install-Prompt
// ============================================================

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Nur zeigen wenn nicht abgelehnt (innerhalb von 7 Tagen)
  const declined = localStorage.getItem("install-declined");
  if (declined && Date.now() - Number(declined) < 7 * 24 * 60 * 60 * 1000) return;

  // Dezenter Install-Banner (nach 30s)
  setTimeout(() => {
    if (!deferredInstallPrompt) return;
    showInstallBanner();
  }, 30_000);
});

function showInstallBanner() {
  const banner = document.createElement("div");
  banner.className = "ios-install-hint";
  banner.innerHTML = `
    <p>Diese App auf dem Startbildschirm installieren?</p>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button id="install-yes" class="btn btn--primary btn--sm">Installieren</button>
      <button id="install-no"  class="btn btn--outline btn--sm">Später</button>
    </div>`;
  document.body.appendChild(banner);

  banner.querySelector("#install-yes").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      showToast("App wurde installiert!", "success");
    }
    deferredInstallPrompt = null;
    banner.remove();
  });

  banner.querySelector("#install-no").addEventListener("click", () => {
    localStorage.setItem("install-declined", String(Date.now()));
    banner.remove();
  });
}

// iOS: kein beforeinstallprompt → manuellen Hinweis zeigen
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function showIOSHint() {
  if (!isIOS() || isInStandaloneMode()) return;
  const declined = localStorage.getItem("ios-hint-declined");
  if (declined && Date.now() - Number(declined) < 7 * 24 * 60 * 60 * 1000) return;
  iosHint.hidden = false;
}

// ============================================================
// Debug-Dialog (3× Tipp auf 🔑-Icon)
// ============================================================

function showDebugDialog() {
  const existing = document.getElementById("debug-dialog-overlay");
  if (existing) { existing.remove(); return; }

  const info    = getDebugInfo();
  const overlay = document.createElement("div");
  overlay.id        = "debug-dialog-overlay";
  overlay.className = "decision-modal-overlay";

  const rows = [
    ["Plan geladen",  info.loaded ? "✅ ja" : "❌ nein"],
    ["PINs geladen",  info.pinsLoaded ? "✅ ja" : "❌ nein"],
    ["Mitarbeiter",   String(info.mitarbeiterCount)],
    ["Erster PIN",    info.firstPinSet ? "gesetzt" : "—"],
  ];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:6px 0;color:var(--color-text-secondary);font-size:13px">${escapeHTML(label)}</td>
      <td style="padding:6px 0;font-weight:600;font-size:13px;font-family:monospace;text-align:right">${escapeHTML(value)}</td>
    </tr>`).join("");

  overlay.innerHTML = `
    <div class="decision-modal">
      <h3 class="decision-modal__title">🐛 Debug-Info</h3>
      <table style="width:100%;border-collapse:collapse">${tableRows}</table>
      <div class="decision-modal__actions" style="margin-top:16px">
        <button class="btn btn--primary" id="debug-close" style="width:100%">Schließen</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector("#debug-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

// ============================================================
// User-Picker (kein PIN vorhanden — Person aus Liste wählen)
// ============================================================

function showUserPicker() {
  const persons = getPlanMitarbeiter();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pin-login-overlay";

    const listHTML = persons.map((p) => {
      const initials = (p.name ?? "?")
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return `
        <button class="user-picker-item" data-id="${escapeHTML(p.id)}">
          <span class="user-picker-item__avatar">${escapeHTML(initials)}</span>
          <span class="user-picker-item__name">${escapeHTML(p.name)}</span>
          ${p.gruppe ? `<span class="user-picker-item__group">${escapeHTML(p.gruppe)}</span>` : ""}
        </button>`;
    }).join("");

    overlay.innerHTML = `
      <div class="pin-login-card">
        <div class="pin-login-icon">👋</div>
        <h1 class="pin-login-title">Kita-App</h1>
        <p class="pin-login-sub">Wer bist du?</p>
        <div class="user-picker-list">
          ${listHTML || "<p style='color:var(--c-text-secondary)'>Keine Mitarbeiterinnen gefunden.</p>"}
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelectorAll(".user-picker-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = persons.find((x) => x.id === btn.dataset.id);
        overlay.remove();
        if (!p) { resolve(null); return; }
        resolve({ id: p.id, displayName: p.name, email: "", group: p.gruppe, role: p.rolle ?? "mitarbeiterin" });
      });
    });
  });
}

// ============================================================
// PIN-Login
// ============================================================

function showPinLogin() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pin-login-overlay";

    overlay.innerHTML = `
      <div class="pin-login-card">
        <div class="pin-login-icon">🔑</div>
        <h1 class="pin-login-title">Kita-App</h1>
        <p class="pin-login-sub">Bitte gib deinen PIN-Code ein</p>
        <input
          class="pin-login-input"
          id="pin-input"
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="10"
          autocomplete="one-time-code"
          placeholder="••••••"
        >
        <p class="pin-login-error" id="pin-error" hidden></p>
        <button class="btn btn--primary btn--lg pin-login-btn" id="pin-submit">
          Anmelden
        </button>
      </div>`;

    document.body.appendChild(overlay);

    // 3× Tipp auf das Schlüssel-Icon → Debug-Dialog
    let _debugTaps  = 0;
    let _debugTimer = null;
    overlay.querySelector(".pin-login-icon").addEventListener("click", () => {
      _debugTaps++;
      clearTimeout(_debugTimer);
      _debugTimer = setTimeout(() => { _debugTaps = 0; }, 1500);
      if (_debugTaps >= 3) {
        _debugTaps = 0;
        showDebugDialog();
      }
    });

    const input  = overlay.querySelector("#pin-input");
    const error  = overlay.querySelector("#pin-error");
    const submit = overlay.querySelector("#pin-submit");

    function showError(msg) {
      error.textContent = msg;
      error.hidden = false;
    }

    function setLocked(locked) {
      input.disabled  = locked;
      submit.disabled = locked;
    }

    function tryLogin() {
      const now = Date.now();

      if (_pinLockUntil > now) {
        const secs = Math.ceil((_pinLockUntil - now) / 1000);
        showError(`Gesperrt noch ${secs} s. Bitte wende dich an die Leitung.`);
        return;
      }

      const pin    = input.value.trim();
      const member = validatePin(pin);

      if (member) {
        _pinFailCount = 0;
        _pinLockUntil = 0;
        localStorage.setItem("kita-user-id", member.id);
        overlay.remove();
        resolve(member);
        return;
      }

      _pinFailCount++;
      input.value = "";

      if (_pinFailCount >= 5) {
        _pinLockUntil = Date.now() + 30_000;
        _pinFailCount = 0;
        setLocked(true);
        showError("Zu viele Versuche. Bitte wende dich an die Leitung.");
        setTimeout(() => {
          _pinLockUntil = 0;
          setLocked(false);
          error.hidden = true;
          input.focus();
        }, 30_000);
      } else {
        showError(`Falscher PIN — noch ${5 - _pinFailCount} Versuch${5 - _pinFailCount === 1 ? "" : "e"}.`);
        input.focus();
      }
    }

    submit.addEventListener("click", tryLogin);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });

    // Falls Session bereits gesperrt ist (Overlay neu geöffnet während Sperre läuft)
    if (_pinLockUntil > Date.now()) {
      setLocked(true);
      const secs = Math.ceil((_pinLockUntil - Date.now()) / 1000);
      showError(`Gesperrt noch ${secs} s. Bitte wende dich an die Leitung.`);
    }

    requestAnimationFrame(() => input.focus());
  });
}

// ============================================================
// Einstellungen / Abmelden
// ============================================================

function showSettings(user) {
  const existing = document.getElementById("settings-overlay");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "settings-overlay";
  overlay.className = "settings-overlay";

  const initials = escapeHTML(
    (user.displayName ?? "?").split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase()
  );
  const activeTheme = document.documentElement.dataset.theme ||
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  overlay.innerHTML = `
    <div class="settings-panel">
      <div class="settings-header">
        <span class="settings-title">Einstellungen</span>
        <button class="settings-close" id="settings-close" aria-label="Schließen">✕</button>
      </div>

      <div class="settings-user">
        <div class="settings-avatar">${initials}</div>
        <div class="settings-user-info">
          <p class="settings-user-name">${escapeHTML(user.displayName ?? "")}</p>
          <p class="settings-user-group">${escapeHTML(user.group ?? "")}</p>
        </div>
      </div>

      <div class="settings-rows">
        <div class="settings-row">
          <span class="settings-row__label">Design</span>
          <div class="settings-theme-toggle" id="theme-toggle">
            <button class="theme-btn${activeTheme === "light" ? " active" : ""}" data-theme-val="light">Hell</button>
            <button class="theme-btn${activeTheme === "dark"  ? " active" : ""}" data-theme-val="dark">Dunkel</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-row__label">Benachrichtigungen</span>
          <label class="notif-toggle" aria-label="Benachrichtigungen ein/aus">
            <input type="checkbox" class="notif-toggle__input" id="notif-toggle-input"
              ${isNotificationsEnabled() ? "checked" : ""}>
            <span class="notif-toggle__track"></span>
          </label>
        </div>
        <div class="settings-row">
          <span class="settings-row__label">Sprache</span>
          <span class="settings-row__value">Deutsch</span>
        </div>
        <div class="settings-row">
          <span class="settings-row__label">Version</span>
          <span class="settings-row__value" id="settings-version">…</span>
        </div>
        <div class="settings-row">
          <span class="settings-row__label">Letztes Deploy</span>
          <span class="settings-row__value" id="settings-deploy">…</span>
        </div>
      </div>

      <button class="btn btn--danger btn--sm settings-logout" id="settings-logout">
        Abmelden
      </button>
    </div>`;

  document.body.appendChild(overlay);

  // Version + Deploy-Datum asynchron laden
  (async () => {
    try {
      const versionEl = overlay.querySelector("#settings-version");
      if (versionEl) versionEl.textContent = "1.0.0";
      const [swResp] = await Promise.all([
        fetch("sw.js", { method: "HEAD", cache: "no-cache" }),
      ]);
      const deployEl = overlay.querySelector("#settings-deploy");
      if (deployEl) {
        const raw = swResp.ok ? swResp.headers.get("Last-Modified") : null;
        if (raw) {
          const d = new Date(raw);
          deployEl.textContent = d.toLocaleDateString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          });
        } else {
          deployEl.textContent = "–";
        }
      }
    } catch {
      // Nicht kritisch
    }
  })();

  overlay.querySelector("#settings-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#theme-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-val]");
    if (!btn) return;
    const t = btn.dataset.themeVal;
    document.documentElement.dataset.theme = t;
    localStorage.setItem("kita-theme", t);
    overlay.querySelectorAll(".theme-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.themeVal === t)
    );
  });

  // Benachrichtigungs-Toggle
  overlay.querySelector("#notif-toggle-input").addEventListener("change", async (e) => {
    const wantEnabled = e.target.checked;
    if (wantEnabled) {
      if (typeof Notification === "undefined") {
        e.target.checked = false;
        showToast("Dein Browser unterstützt keine Benachrichtigungen.", "");
        return;
      }
      if (Notification.permission === "denied") {
        e.target.checked = false;
        showToast("Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.", "");
        return;
      }
      const perm = await requestNotificationPermission();
      const granted = perm === "granted";
      e.target.checked = granted;
      saveNotifPref(granted);
      showToast(granted ? "Benachrichtigungen aktiviert." : "Benachrichtigungen nicht erlaubt.", granted ? "success" : "");
    } else {
      saveNotifPref(false);
      showToast("Benachrichtigungen deaktiviert.", "");
    }
  });

  overlay.querySelector("#settings-logout").addEventListener("click", () => {
    localStorage.removeItem("kita-user-id");
    overlay.remove();
    location.reload();
  });
}

// ============================================================
// In-App-Benachrichtigungs-Banner
// ============================================================

/**
 * Zeigt einen In-App-Banner wenn neue Inhalte erkannt wurden.
 * @param {string} title
 * @param {string} body
 * @param {string} hash   Ziel-Screen
 */
function showInAppBanner(title, body, hash) {
  const banner = document.createElement("div");
  banner.className = "notif-in-app-banner";
  banner.innerHTML = `
    <div class="notif-in-app-banner__content">
      <span class="notif-in-app-banner__icon">🔔</span>
      <div class="notif-in-app-banner__text">
        <p class="notif-in-app-banner__title">${escapeHTML(title)}</p>
        ${body ? `<p class="notif-in-app-banner__body">${escapeHTML(body)}</p>` : ""}
      </div>
    </div>
    <div class="notif-in-app-banner__actions">
      <button class="notif-in-app-banner__open">Anzeigen</button>
      <button class="notif-in-app-banner__close" aria-label="Schließen">✕</button>
    </div>`;
  document.body.appendChild(banner);

  // Slide-in
  requestAnimationFrame(() => banner.classList.add("notif-in-app-banner--visible"));

  function dismiss() {
    banner.classList.remove("notif-in-app-banner--visible");
    setTimeout(() => banner.remove(), 320);
  }

  banner.querySelector(".notif-in-app-banner__open").addEventListener("click", () => {
    dismiss();
    if (window.location.hash === `#${hash}`) {
      _currentScreen = null;
    }
    window.location.hash = hash;
  });

  banner.querySelector(".notif-in-app-banner__close").addEventListener("click", dismiss);

  // Auto-dismiss nach 9 Sekunden
  setTimeout(() => { if (banner.parentNode) dismiss(); }, 9000);
}

// ============================================================
// Entscheidungs-Modal (Leitung: genehmigen / ablehnen)
// ============================================================

/**
 * Zeigt ein Modal mit optionalem Begründungsfeld.
 * @param {string}   requestId
 * @param {"genehmigen"|"ablehnen"} action
 * @param {function} onConfirm  Aufgerufen mit (reviewNote|null)
 */
function showDecisionModal(requestId, action, onConfirm) {
  const existing = document.getElementById("decision-modal-overlay");
  if (existing) existing.remove();

  const isApprove = action === "genehmigen";
  const overlay   = document.createElement("div");
  overlay.id        = "decision-modal-overlay";
  overlay.className = "decision-modal-overlay";

  overlay.innerHTML = `
    <div class="decision-modal">
      <h3 class="decision-modal__title">${isApprove ? "Antrag genehmigen" : "Antrag ablehnen"}</h3>
      <label class="decision-modal__label" for="decision-note">
        Begründung <span class="decision-modal__optional">(optional)</span>
      </label>
      <textarea class="decision-modal__note" id="decision-note" rows="3"
        placeholder="${isApprove ? "z.B. Wie besprochen…" : "z.B. Zu wenig Personal…"}"></textarea>
      <div class="decision-modal__actions">
        <button class="btn btn--ghost decision-modal__cancel">Abbrechen</button>
        <button class="btn ${isApprove ? "btn--success" : "btn--danger"} decision-modal__confirm">
          ${isApprove ? "Genehmigen" : "Ablehnen"}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  overlay.querySelector(".decision-modal__cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector(".decision-modal__confirm").addEventListener("click", async () => {
    const note = overlay.querySelector("#decision-note").value.trim() || null;
    close();
    await onConfirm(note);
  });
}

// ============================================================
// App starten
// ============================================================

async function initApp() {
  // Gespeichertes Theme sofort anwenden — verhindert Flash
  const _savedTheme = localStorage.getItem("kita-theme");
  if (_savedTheme === "dark" || _savedTheme === "light") {
    document.documentElement.dataset.theme = _savedTheme;
  }

  // Navigation-Nachrichten vom Service Worker (Klick auf OS-Benachrichtigung)
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.type === "NAVIGATE") navigate(e.data.hash);
  });

  try {
    // Plan laden: lokale Dateien (mit PINs) haben Vorrang.
    // Lokal: plan-export.json + plan-export-YYYY-MM.json (gitignored)
    // Fallback: plan-export-public.json + plan-export-public-YYYY-MM.json (GitHub Pages)
    const _loadNow = new Date();
    let planExportedIso = null;
    try {
      const localSources = ["plan-export.json"];
      for (let delta = -1; delta <= 3; delta++) {
        let m = _loadNow.getMonth() + 1 + delta;
        let y = _loadNow.getFullYear();
        while (m > 12) { m -= 12; y++; }
        while (m < 1)  { m += 12; y--; }
        localSources.push(`plan-export-${y}-${String(m).padStart(2, "0")}.json`);
      }
      const localResults = await Promise.allSettled(
        localSources.map((src) => fetch(src, { cache: "no-cache" }))
      );
      let localLoaded = 0;
      for (let i = 0; i < localSources.length; i++) {
        const r = localResults[i];
        if (r.status === "rejected" || !r.value.ok) continue;
        try {
          const plan = await r.value.json();
          setPlanData(plan);
          planExportedIso = plan.exportiert ?? planExportedIso;
          localLoaded++;
        } catch { /* parse error */ }
      }

      if (localLoaded === 0) {
        // Öffentliche Dateien: plan-export-public.json + pro-Monat für -2..+10 Monate
        const publicSources = ["plan-export-public.json"];
        for (let delta = -1; delta <= 3; delta++) {
          let m = _loadNow.getMonth() + 1 + delta;
          let y = _loadNow.getFullYear();
          while (m > 12) { m -= 12; y++; }
          while (m < 1)  { m += 12; y--; }
          publicSources.push(`plan-export-public-${y}-${String(m).padStart(2, "0")}.json`);
        }
        const publicResults = await Promise.allSettled(
          publicSources.map((src) => fetch(src, { cache: "no-cache" }))
        );
        for (let i = 0; i < publicResults.length; i++) {
          const r = publicResults[i];
          if (r.status === "rejected" || !r.value.ok) continue;
          try {
            const plan = await r.value.json();
            setPlanData(plan);
            planExportedIso = plan.exportiert ?? planExportedIso;
          } catch { /* parse error */ }
        }
      }
    } catch {
      // Kein Plan vorhanden — Demo-Modus
    }

    // pins.json laden — separate Datei mit PINs, hat Priorität vor plan-export.json
    try {
      const pinsResp = await fetch("pins.json", { cache: "no-cache" });
      if (pinsResp.ok) {
        const pins = await pinsResp.json();
        setPinsData(pins);
        const dbg = getDebugInfo();
        console.log(`[Kita-App] pins.json geladen — ${dbg.mitarbeiterCount} PINs, Erster: ${dbg.firstPinSet ? 'gesetzt' : '—'}`);
      }
    } catch {
      // pins.json nicht verfügbar — Fallback auf mitarbeiter aus plan-export.json
    }

    // planMonth/planYear auf nächsten verfügbaren Monat setzen
    const _nearest = _nearestAvailableMonth(getAvailableMonths(), new Date());
    if (_nearest) { planMonth = _nearest.monat; planYear = _nearest.jahr; }

    await initAuth();
    let user = getUser();

    if (!user) {
      loadingOverlay.classList.add("hidden");

      if (!hasPlanData()) {
        // Kein Plan überhaupt → Demo-Modus: mock.js jetzt laden (lazy)
        setMockData(await import("./data/mock.js"));
        const demo = getDemoUser();
        if (demo) {
          user = demo;
          localStorage.setItem("kita-user-id", demo.id);
          showToast("Demo-Modus — keine Plandaten vorhanden", "", 4000);
        }
      } else if (isDemoMode()) {
        // Plan vorhanden, aber keine PINs → Person aus Liste wählen
        const picked = await showUserPicker();
        if (picked) {
          user = picked;
          localStorage.setItem("kita-user-id", picked.id);
        }
      } else {
        // Plan + PINs vorhanden → PIN-Screen
        await showPinLogin();
        await initAuth();
        user = getUser();
      }
    }

    if (!user) throw new Error("Kein User nach Auth");

    // Lade-Overlay ausblenden, Settings-Button einblenden
    loadingOverlay.classList.add("hidden");
    if (settingsBtn) {
      settingsBtn.hidden = false;
      settingsBtn.addEventListener("click", () => showSettings(user));
    }
    if (hasPlanData()) {
      showToast("Plan geladen ✓", "success", 2000);
    }

    // Dashboard-Tab nur für Leitung sichtbar
    if (isLeadership(user)) {
      const navDashboard = document.getElementById("nav-dashboard");
      if (navDashboard) navDashboard.hidden = false;
    }

    // ✕-Button des iOS-Hinweises immer verdrahten (unabhängig von iOS-Erkennung)
    document.getElementById("ios-install-close")?.addEventListener("click", () => {
      iosHint.hidden = true;
      localStorage.setItem("ios-hint-declined", String(Date.now()));
    });

    // iOS-Hinweis ggf. anzeigen (verzögert nach Init)
    setTimeout(showIOSHint, 2000);

    // Initiale Route
    const initial = getHashScreen();
    await navigate(initial);

    // Auf neue Inhalte seit letztem Besuch prüfen (nach dem Rendern)
    try {
      const lastVisit     = getLastVisit();
      const lastPlanExp   = getLastPlanExported();
      const notifications = await getNotifications(user.group, user.role);

      const newItems = detectNewContent(
        user,
        planExportedIso,
        planMonth,
        planYear,
        notifications,
        lastVisit,
        lastPlanExp,
      );

      for (const item of newItems) {
        // In-App-Banner immer anzeigen
        setTimeout(() => showInAppBanner(item.title, item.body, item.hash), 800);
        // Native Push nur für neue Pläne und sehr wichtige Mitteilungen
        if (item.type === "plan" || item.priority === "sehrwichtig") {
          showNativeNotification(item.title, item.body, item.tag, item.hash);
        }
      }

      // Stand für nächsten Besuch speichern
      setLastPlanExported(planExportedIso);
      setLastVisit();
    } catch {
      // Benachrichtigungs-Prüfung ist nicht kritisch
    }

    // Beim allerersten Start nach Login: Erlaubnis-Dialog zeigen (verzögert)
    setTimeout(() => maybeAskPermission(), 3500);

    // Auto-Refresh: alle 5 Minuten Plan neu laden und bei Änderung Mitteilungen aktualisieren
    setInterval(async () => {
      try {
        const changed = await refreshPlanData();
        if (!changed) return;

        // Badge neu laden
        await updateNotifBadge(user);

        // Infos-Screen neu rendern wenn gerade offen
        if (_currentScreen === "infos") {
          _currentScreen = null;
          await navigate("infos");
        }

        // Banner: neue Mitteilungen ankündigen
        const notifications = await getNotifications(user.group, user.role);
        const lastPlanExp   = getPlanExportTimestamp();
        const newItems = detectNewContent(user, lastPlanExp, planMonth, planYear, notifications, getLastVisit(), lastPlanExp);
        for (const item of newItems) {
          setTimeout(() => showInAppBanner(item.title, item.body, item.hash), 300);
          if (item.type === "plan" || item.priority === "sehrwichtig") {
            showNativeNotification(item.title, item.body, item.tag, item.hash);
          }
        }
        setLastPlanExported(lastPlanExp);
      } catch {
        // Polling-Fehler sind nicht kritisch
      }
    }, 5 * 60 * 1000);

  } catch (err) {
    console.error("[Kita-App] Init-Fehler:", err);
    loadingOverlay.innerHTML = `
      <p style="color:var(--c-danger);text-align:center;padding:24px;">
        Fehler beim Laden der App.<br>
        <button onclick="location.reload()"
                style="margin-top:12px;padding:10px 20px;background:var(--c-primary);
                       color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">
          Erneut versuchen
        </button>
      </p>`;
  }
}

// Starten sobald DOM bereit
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
