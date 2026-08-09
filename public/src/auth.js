// src/auth.js
// Mock-Auth für Phase 1 — Vanessa Müller ist immer eingeloggt.
// In Phase 3 wird dieser Wrapper durch echtes MSAL.js ersetzt.
// Die Signatur der exportierten Funktionen bleibt identisch.

import { getCurrentUser } from "./data/api.js";

/** @type {{ id:string, displayName:string, email:string, group:string, role:string } | null} */
let _currentUser = null;

/**
 * Initialisiert Auth. In Phase 1 immer Erfolg.
 * In Phase 3: MSAL PublicClientApplication initialisieren und
 * vorhandenes Token aus sessionStorage prüfen.
 * @returns {Promise<boolean>} true wenn eingeloggt
 */
export async function initAuth() {
  _currentUser = await getCurrentUser();
  return true;
}

/**
 * Gibt die aktuell angemeldete Nutzerin zurück.
 * @returns {{ id:string, displayName:string, email:string, group:string, role:string } | null}
 */
export function getUser() {
  return _currentUser;
}

/**
 * Gibt an ob ein Login besteht.
 * @returns {boolean}
 */
export function isLoggedIn() {
  return _currentUser !== null;
}

/**
 * Login anstoßen.
 * Phase 1: No-op — Nutzer ist immer angemeldet.
 * Phase 3: MSAL loginRedirect / loginPopup aufrufen.
 * @returns {Promise<void>}
 */
export async function login() {
  if (!_currentUser) {
    _currentUser = await getCurrentUser();
  }
}

/**
 * Logout.
 * Phase 1: No-op.
 * Phase 3: MSAL logout aufrufen, Token aus sessionStorage löschen.
 * @returns {Promise<void>}
 */
export async function logout() {
  _currentUser = null;
  // Phase 3: await msalInstance.logoutRedirect();
}
