/**
 * Authentication service — Google Apps Script is the sole backend.
 *
 * Sessions are stored in localStorage for fast page loads; the session
 * contains NO password hash — only userId, username, coachingId.
 * Password verification always happens server-side in GAS (SHA-256).
 */

import { gasSignup, gasLogin, gasChangePassword } from "./gasApi";

export interface Session {
  userId:     string;
  username:   string;
  coachingId: string;
}

export interface AuthResult {
  success: boolean;
  error?:  string;
  session?: Session;
  /** Cloud data returned on login — caller should merge into localStorage cache. */
  cloudData?: {
    students: unknown[];
    payments: unknown[];
    profile:  unknown;
  };
}

const SESSION_KEY = "feetracker_session";

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ─── Signup ───────────────────────────────────────────────────────────────────

export async function signup(
  username: string,
  password: string,
  coachingName: string,
): Promise<AuthResult> {
  if (username.trim().length < 3)
    return { success: false, error: "Username must be at least 3 characters." };
  if (password.length < 6)
    return { success: false, error: "Password must be at least 6 characters." };

  const result = await gasSignup(username.trim(), password, coachingName);
  if (!result.success || !result.user) {
    return { success: false, error: result.error || "Signup failed. Please try again." };
  }

  const { id, username: uname, coachingId } = result.user;

  // Seed a local profile cache so the UI shows the coaching name immediately.
  localStorage.setItem(
    `feetracker_profile_${id}`,
    JSON.stringify({
      id:         coachingId,
      userId:     id,
      name:       coachingName || "My Coaching",
      ownerName:  "",
      mobile:     "",
      address:    "",
      logoBase64: "",
    }),
  );

  const session: Session = { userId: id, username: uname, coachingId };
  saveSession(session);
  return { success: true, session };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthResult> {
  const result = await gasLogin(username.trim(), password);
  if (!result.success || !result.user) {
    return { success: false, error: result.error || "Invalid username or password." };
  }

  const { id, username: uname, coachingId } = result.user;
  const session: Session = { userId: id, username: uname, coachingId };
  saveSession(session);

  return {
    success: true,
    session,
    cloudData: {
      students: Array.isArray(result.students) ? result.students : [],
      payments: Array.isArray(result.payments) ? result.payments : [],
      profile:  result.profile ?? null,
    },
  };
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
  return gasChangePassword(userId, currentPassword, newPassword);
}
