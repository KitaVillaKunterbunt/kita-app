// src/app.js
// Haupteinstiegspunkt der Kita-App.
// Verantwortlich für: Auth-Init, Hash-Router, Screen-Rendering, Toast, Install-Prompt.

import { initAuth, getUser }              from "./auth.js";
import {
  getShifts,
  getRequests,
  getNotifications,
  getColleagues,
  submitRequest,
  withdrawRequest,
  confirmNotification,
  respondToSwapRequest,
  setPlanData,
  hasPlanData,
  validatePin,
} from "./data/api.js";
import { escapeHTML } from "./utils.js";
import { renderHome }          from "./screens/home.js";
import { renderPlan, setOnMonthChange } from "./screens/plan.js";
import { renderAntrag }        from "./screens/antrag.js";
import { renderMeineAntraege } from "./screens/meine-antraege.js";
import { renderInfos }         from "./screens/infos.js";

// ============================================================
// DOM-Referenzen
// ============================================================

const screens = {
  home:     document.getElementById("screen-home"),
  plan:     document.getElementById("screen-plan"),
  antrag:   document.getElementById("screen-antrag"),
  antraege: document.getElementById("screen-antraege"),
  infos:    document.getElementById("screen-infos"),
};

const loadingOverlay = document.getElementById("loading-overlay");
const notifBadge     = document.getElementById("notif-badge");
const toastEl        = document.getElementById("toast");
const iosHint        = document.getElementById("ios-install-hint");
const settingsBtn    = document.getElementById("settings-btn");

// Plan-Screen: aktuell angezeigter Monat
let planMonth = 8;
let planYear  = 2026;

// Install-Prompt (Android/Chrome)
let deferredInstallPrompt = null;

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
    const notifs = await getNotifications(user.group);
    const unread = notifs.filter((n) => !n.confirmedBy.includes(user.id)).length;
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
        const [shifts, requests, notifications] = await Promise.all([
          getShifts(user.id, now.getMonth() + 1, now.getFullYear()),
          getRequests(user.id),
          getNotifications(user.group),
        ]);
        // Planmonat-Schichten laden (Mock: Aug 2026, Export: monat/jahr aus plan-export.json)
        const planShifts = await getShifts(user.id, planMonth, planYear);
        const allShifts = [...shifts];
        planShifts.forEach((s) => {
          if (!allShifts.find((x) => x.id === s.id)) allShifts.push(s);
        });
        allShifts.sort((a, b) => a.date.localeCompare(b.date));

        // Springe zur Planwoche wenn Plan noch in der Zukunft liegt
        let homeOffset = 0;
        if (hasPlanData()) {
          const planFirst = new Date(planYear, planMonth - 1, 1);
          const planDow = planFirst.getDay();
          planFirst.setDate(planFirst.getDate() - (planDow === 0 ? 6 : planDow - 1));
          const todayMon = new Date(now);
          todayMon.setHours(0, 0, 0, 0);
          const todayDow = todayMon.getDay();
          todayMon.setDate(todayMon.getDate() - (todayDow === 0 ? 6 : todayDow - 1));
          homeOffset = Math.round((planFirst - todayMon) / (7 * 24 * 3600 * 1000));
          if (homeOffset < 0) homeOffset = 0;
        }
        renderHome(container, user, allShifts, requests, notifications, homeOffset);
        updateNotifBadge(user);
        break;
      }

      case "plan": {
        const shifts = await getShifts(user.id, planMonth, planYear);
        renderPlan(container, user, shifts, planMonth, planYear);
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
        const notifications = await getNotifications(user.group);

        const refreshInfos = async () => {
          const fresh = await getNotifications(user.group);
          renderInfos(container, fresh, user, confirmCb, swapCb);
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

        renderInfos(container, notifications, user, confirmCb, swapCb);
        updateNotifBadge(user);
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
  const user   = getUser();
  const shifts = await getShifts(user.id, month, year);
  renderPlan(screens.plan, user, shifts, month, year);
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
        <p class="pin-login-error" id="pin-error" hidden>
          Falscher PIN — bitte erneut versuchen.
        </p>
        <button class="btn btn--primary btn--lg pin-login-btn" id="pin-submit">
          Anmelden
        </button>
      </div>`;

    document.body.appendChild(overlay);

    const input  = overlay.querySelector("#pin-input");
    const error  = overlay.querySelector("#pin-error");
    const submit = overlay.querySelector("#pin-submit");

    function tryLogin() {
      const pin = input.value.trim();
      const member = validatePin(pin);
      if (member) {
        localStorage.setItem("kita-user-id", member.id);
        overlay.remove();
        resolve(member);
      } else {
        error.hidden = false;
        input.value  = "";
        input.focus();
      }
    }

    submit.addEventListener("click", tryLogin);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });

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
          <span class="settings-row__label">Sprache</span>
          <span class="settings-row__value">Deutsch</span>
        </div>
        <div class="settings-row">
          <span class="settings-row__label">Version</span>
          <span class="settings-row__value">1.0.0</span>
        </div>
      </div>

      <button class="btn btn--danger btn--sm settings-logout" id="settings-logout">
        Abmelden
      </button>
    </div>`;

  document.body.appendChild(overlay);

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

  overlay.querySelector("#settings-logout").addEventListener("click", () => {
    localStorage.removeItem("kita-user-id");
    overlay.remove();
    location.reload();
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

  try {
    // plan-export.json laden (wenn von Leitung veröffentlicht)
    try {
      const resp = await fetch("plan-export.json", { cache: "no-cache" });
      if (resp.ok) {
        const plan = await resp.json();
        setPlanData(plan);
        if (plan.monat) planMonth = plan.monat;
        if (plan.jahr)  planYear  = plan.jahr;
        console.log(`[Kita-App] Plan geladen: ${plan.exportiert ?? "unbekannt"} (${(plan.wochen ?? []).length} Schichten, ${planMonth}/${planYear})`);
      }
    } catch {
      // Kein plan-export.json vorhanden — Mock-Daten bleiben aktiv
    }

    await initAuth();
    let user = getUser();

    // Plan vorhanden, aber kein gespeicherter Login → PIN-Login zeigen
    if (!user && hasPlanData()) {
      loadingOverlay.classList.add("hidden");
      await showPinLogin();
      await initAuth();
      user = getUser();
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
