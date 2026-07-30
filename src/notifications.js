// src/notifications.js
// Push-Benachrichtigungen — pure Logik + Browser-API-Wrapper
//
// Pure (testbar ohne Browser): formatPlanNotificationTitle, hasNewPlan,
//   getNewNotifications, detectNewContent
// Browser-only: alles andere

const MONAT_NAMEN = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
];

export const LS_NOTIF_ASKED   = 'kita-notif-asked';
export const LS_NOTIF_ENABLED = 'kita-notif-enabled';
export const LS_LAST_VISIT    = 'kita-last-visit';
export const LS_LAST_PLAN_EXP = 'kita-last-plan-exported';

// ============================================================
// Pure Hilfsfunktionen — testbar in Node.js
// ============================================================

/** "Neuer Dienstplan September 2026" */
export function formatPlanNotificationTitle(monat, jahr) {
  return `Neuer Dienstplan ${MONAT_NAMEN[(monat ?? 1) - 1] ?? ''} ${jahr ?? ''}`;
}

/** True wenn plan-export.json ein neueres exportiert-Datum hat */
export function hasNewPlan(lastExportedIso, currentExportedIso) {
  if (!currentExportedIso) return false;
  if (!lastExportedIso) return true;
  return new Date(currentExportedIso) > new Date(lastExportedIso);
}

/** Gibt Mitteilungen zurück die seit lastVisitIso neu sind und die Gruppe betreffen */
export function getNewNotifications(notifications, lastVisitIso, group) {
  if (!notifications?.length) return [];
  const since = lastVisitIso ? new Date(lastVisitIso) : null;
  return notifications.filter((n) => {
    if (since && new Date(n.createdAt) <= since) return false;
    return n.targetGroups?.includes('alle') || n.targetGroups?.includes(group);
  });
}

/**
 * Prüft ob neue Inhalte vorliegen und gibt anzuzeigende Benachrichtigungen zurück.
 * Pure — keine Seiteneffekte.
 */
export function detectNewContent(user, planExportedIso, planMonat, planJahr, notifications, lastVisitIso, lastPlanExportedIso) {
  const results = [];

  if (hasNewPlan(lastPlanExportedIso, planExportedIso) && planMonat && planJahr) {
    results.push({
      type:  'plan',
      title: formatPlanNotificationTitle(planMonat, planJahr),
      body:  'Tippen um den neuen Dienstplan anzuzeigen.',
      hash:  'plan',
      tag:   `plan-${planExportedIso ?? 'unknown'}`,
    });
  }

  const newNotifs = getNewNotifications(notifications ?? [], lastVisitIso, user?.group ?? '');
  if (newNotifs.length > 0) {
    const first = newNotifs[0];
    const preview = first.body ? first.body.slice(0, 80) + (first.body.length > 80 ? '…' : '') : '';
    results.push({
      type:  'notification',
      title: `Neue Mitteilung: ${first.title}`,
      body:  preview,
      hash:  'infos',
      tag:   `notif-${first.id}`,
    });
  }

  return results;
}

// ============================================================
// localStorage-Helfer
// ============================================================

export function getLastVisit() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LS_LAST_VISIT) ?? null;
}

export function setLastVisit() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_LAST_VISIT, new Date().toISOString());
}

export function getLastPlanExported() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LS_LAST_PLAN_EXP) ?? null;
}

export function setLastPlanExported(exportedIso) {
  if (typeof localStorage === 'undefined') return;
  if (exportedIso) localStorage.setItem(LS_LAST_PLAN_EXP, exportedIso);
}

export function saveNotifPref(enabled) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_NOTIF_ENABLED, enabled ? 'true' : 'false');
}

// ============================================================
// Browser-API-Wrapper
// ============================================================

/** True wenn Notification-API verfügbar, Permission granted und Pref = true */
export function isNotificationsEnabled() {
  if (typeof localStorage === 'undefined') return false;
  if (localStorage.getItem(LS_NOTIF_ENABLED) !== 'true') return false;
  if (typeof Notification === 'undefined') return false;
  return Notification.permission === 'granted';
}

/** Fordert Browser-Permission an */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Zeigt eine native OS-Benachrichtigung */
export function showNativeNotification(title, body, tag, hash) {
  if (!isNotificationsEnabled()) return;
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { hash },
    });
    n.onclick = () => {
      window.focus();
      window.location.hash = hash;
      n.close();
    };
  } catch {
    // Safari und nicht-HTTPS ignorieren
  }
}

// ============================================================
// Erlaubnis-Dialog (schöner eigener Dialog vor dem Browser-Dialog)
// ============================================================

/**
 * Zeigt unseren schönen Dialog.
 * Nur nach Klick auf "Ja" wird der hässliche Browser-Dialog gezeigt.
 * @returns {Promise<boolean>} true wenn permission granted
 */
export function showPermissionDialog() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return; }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_NOTIF_ASKED, 'true');
    }

    const overlay = document.createElement('div');
    overlay.className = 'notif-dialog-overlay';
    overlay.innerHTML = `
      <div class="notif-dialog">
        <div class="notif-dialog__icon">🔔</div>
        <h2 class="notif-dialog__title">Immer informiert</h2>
        <p class="notif-dialog__body">
          Soll die Kita-App dich benachrichtigen, wenn ein neuer
          Dienstplan veröffentlicht wird oder eine neue Mitteilung
          für dich vorliegt?
        </p>
        <div class="notif-dialog__actions">
          <button class="btn btn--primary notif-dialog__yes" id="notif-yes">Ja, gerne</button>
          <button class="btn btn--ghost notif-dialog__no" id="notif-no">Nein danke</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Slide-in Animation
    requestAnimationFrame(() => overlay.classList.add('notif-dialog-overlay--visible'));

    function close(granted) {
      overlay.classList.remove('notif-dialog-overlay--visible');
      setTimeout(() => overlay.remove(), 280);
      resolve(granted);
    }

    overlay.querySelector('#notif-yes').addEventListener('click', async () => {
      const perm = await requestNotificationPermission();
      const granted = perm === 'granted';
      saveNotifPref(granted);
      close(granted);
    });

    overlay.querySelector('#notif-no').addEventListener('click', () => {
      saveNotifPref(false);
      close(false);
    });
  });
}

/**
 * Prüft ob der Dialog angezeigt werden soll (einmalig, ersten Start nach Login).
 * Zeigt unseren Dialog und danach ggf. den Browser-Dialog.
 */
export async function maybeAskPermission() {
  if (typeof localStorage === 'undefined') return;
  if (typeof Notification === 'undefined') return;
  if (localStorage.getItem(LS_NOTIF_ASKED) === 'true') return;
  await showPermissionDialog();
}
