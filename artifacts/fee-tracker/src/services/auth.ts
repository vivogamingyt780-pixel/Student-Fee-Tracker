/**
 * Authentication service.
 *
 * Local-first: accounts are stored in localStorage so the app works with no
 * backend at all. Every teacher gets their own isolated account; data is keyed
 * by userId so multiple accounts on the same browser are fully separated.
 *
 * GAS (Google Apps Script) is optional. When VITE_GAS_URL is set:
 *   - signup/login try GAS first; on success the account is also mirrored
 *     locally so future logins work even if GAS is temporarily unreachable.
 *   - When GAS is unreachable or not configured, auth silently falls back to
 *     the local registry — no error is shown to the user.
 *
 * Passwords are hashed with SHA-256 (crypto.subtle) before storage.
 * Sessions stored in localStorage contain only userId / username / coachingId
 * — never the password or hash.
 */

import { gasSignup, gasLogin, gasChangePassword, isGASConfigured } from "./gasApi";

export interface Session {
  userId:     string;
  username:   string;
  coachingId: string;
}

export interface AuthResult {
  success: boolean;
  error?:  string;
  session?: Session;
  /** Cloud data returned on GAS login — caller merges into localStorage cache. */
  cloudData?: {
    students: unknown[];
    payments: unknown[];
    profile:  unknown;
  };
}

// ─── Local user registry ──────────────────────────────────────────────────────

interface LocalUser {
  id:           string;
  username:     string;   // always lowercase
  coachingId:   string;
  passwordHash: string;   // hex SHA-256
}

const USERS_KEY   = "feetracker_users";
const SESSION_KEY = "feetracker_session";

function getLocalUsers(): LocalUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}

function saveLocalUsers(users: LocalUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Password hashing ─────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const data   = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Session ──────────────────────────────────────────────────────────────────

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ─── Profile seed ─────────────────────────────────────────────────────────────

function seedLocalProfile(userId: string, coachingId: string, coachingName: string): void {
  const key = `feetracker_profile_${userId}`;
  if (localStorage.getItem(key)) return; // don't overwrite existing profile
  localStorage.setItem(
    key,
    JSON.stringify({
      id:         coachingId,
      userId,
      name:       coachingName || "My Coaching",
      ownerName:  "",
      mobile:     "",
      address:    "",
      logoBase64: "",
    }),
  );
}

// ─── Signup ───────────────────────────────────────────────────────────────────

export async function signup(
  username:     string,
  password:     string,
  coachingName: string,
): Promise<AuthResult> {
  if (username.trim().length < 3)
    return { success: false, error: "Username must be at least 3 characters." };
  if (password.length < 6)
    return { success: false, error: "Password must be at least 6 characters." };

  const uname = username.trim().toLowerCase();

  // ── Try GAS first when configured ─────────────────────────────────────────
  if (isGASConfigured()) {
    const gasResult = await gasSignup(uname, password, coachingName);

    if (!gasResult.gasNotConfigured && gasResult.success && gasResult.user) {
      const { id, username: gasUname, coachingId } = gasResult.user;
      // Mirror into local registry so offline login works
      const hash  = await hashPassword(password);
      const users = getLocalUsers().filter((u) => u.username !== gasUname.toLowerCase());
      users.push({ id, username: gasUname.toLowerCase(), coachingId, passwordHash: hash });
      saveLocalUsers(users);
      seedLocalProfile(id, coachingId, coachingName);
      const session: Session = { userId: id, username: gasUname, coachingId };
      saveSession(session);
      return { success: true, session };
    }

    // GAS returned a real app-level error (e.g. "username already taken in Sheets")
    if (!gasResult.gasNotConfigured && gasResult.error) {
      return { success: false, error: gasResult.error };
    }
    // gasNotConfigured or network error → fall through to local
  }

  // ── Local signup ───────────────────────────────────────────────────────────
  const users = getLocalUsers();
  if (users.some((u) => u.username === uname)) {
    return { success: false, error: "Username already taken. Please choose another." };
  }

  const id         = generateId();
  const coachingId = generateId();
  const hash       = await hashPassword(password);
  users.push({ id, username: uname, coachingId, passwordHash: hash });
  saveLocalUsers(users);
  seedLocalProfile(id, coachingId, coachingName);

  const session: Session = { userId: id, username: uname, coachingId };
  saveSession(session);
  return { success: true, session };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthResult> {
  const uname = username.trim().toLowerCase();

  // ── Try GAS first when configured ─────────────────────────────────────────
  if (isGASConfigured()) {
    const gasResult = await gasLogin(uname, password);

    if (!gasResult.gasNotConfigured && gasResult.success && gasResult.user) {
      const { id, username: gasUname, coachingId } = gasResult.user;
      // Mirror into local registry for offline fallback
      const hash  = await hashPassword(password);
      const users = getLocalUsers().filter((u) => u.username !== gasUname.toLowerCase());
      users.push({ id, username: gasUname.toLowerCase(), coachingId, passwordHash: hash });
      saveLocalUsers(users);
      const session: Session = { userId: id, username: gasUname, coachingId };
      saveSession(session);
      return {
        success: true,
        session,
        cloudData: {
          students: Array.isArray(gasResult.students) ? gasResult.students : [],
          payments: Array.isArray(gasResult.payments) ? gasResult.payments : [],
          profile:  gasResult.profile ?? null,
        },
      };
    }

    // Real auth error from GAS (wrong password, user not found, etc.)
    // Still try local so a teacher who signed up locally can log in.
    // We only skip local fallback for non-config errors that aren't gasNotConfigured.
    if (!gasResult.gasNotConfigured && gasResult.error) {
      // Try local too; if local succeeds, use it. Otherwise return GAS error.
      const localResult = await localLogin(uname, password);
      if (localResult.success) return localResult;
      return { success: false, error: gasResult.error };
    }
    // gasNotConfigured or network error → fall through to local
  }

  // ── Local login ────────────────────────────────────────────────────────────
  return localLogin(uname, password);
}

async function localLogin(uname: string, password: string): Promise<AuthResult> {
  const users = getLocalUsers();
  const user  = users.find((u) => u.username === uname);
  if (!user) {
    return { success: false, error: "Invalid username or password." };
  }
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) {
    return { success: false, error: "Invalid username or password." };
  }
  const session: Session = { userId: user.id, username: user.username, coachingId: user.coachingId };
  saveSession(session);
  return { success: true, session };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changePassword(
  userId:          string,
  currentPassword: string,
  newPassword:     string,
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 6)
    return { success: false, error: "New password must be at least 6 characters." };

  // Verify and update locally first
  const users = getLocalUsers();
  const idx   = users.findIndex((u) => u.id === userId);

  if (idx !== -1) {
    const currentHash = await hashPassword(currentPassword);
    if (users[idx].passwordHash !== currentHash) {
      return { success: false, error: "Current password is incorrect." };
    }
    users[idx].passwordHash = await hashPassword(newPassword);
    saveLocalUsers(users);
  }

  // Also push to GAS if configured — failure is non-fatal (local already updated)
  if (isGASConfigured()) {
    gasChangePassword(userId, currentPassword, newPassword).catch(() => {});
  }

  return { success: true };
}
