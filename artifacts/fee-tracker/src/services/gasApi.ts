/**
 * Google Apps Script API client.
 *
 * VITE_GAS_URL must be set by the app owner as a Netlify environment variable.
 * End users never configure anything — they just sign up and use the app.
 *
 * CORS strategy: POST with no Content-Type header → browser treats body as
 * text/plain (a "simple" CORS request) → no OPTIONS preflight needed.
 * GAS reads e.postData.contents regardless of Content-Type.
 * The redirect to script.googleusercontent.com carries the CORS headers so
 * fetch() can read the JSON response.
 */

const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? "";

/** True when the app owner has configured the Google Apps Script endpoint. */
export function isGASConfigured(): boolean {
  return GAS_URL.length > 0;
}

// ─── Core fetch helpers ────────────────────────────────────────────────────────

/** Awaitable POST — used for auth and reads (we need the response). */
async function gasPost<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  return res.json() as Promise<T>;
}

/** Fire-and-forget POST — used for mutations (localStorage already updated). */
function gasFire(payload: Record<string, unknown>): void {
  if (!GAS_URL) return;
  fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    redirect: "follow",
  }).catch(() => {});
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface GASUser {
  id: string;
  username: string;
  coachingId: string;
}

export interface GASAuthResult {
  success: boolean;
  user?: GASUser;
  students?: unknown[];
  payments?: unknown[];
  profile?: unknown;
  error?: string;
}

export async function gasSignup(
  username: string,
  password: string,
  coachingName: string,
): Promise<GASAuthResult> {
  if (!GAS_URL) return { success: false, error: "App is not configured. Please contact the administrator." };
  try {
    return await gasPost<GASAuthResult>({
      action: "auth",
      payload: { method: "signup", username, password, coachingName },
    });
  } catch {
    return { success: false, error: "Cannot connect to the server. Please check your internet connection." };
  }
}

export async function gasLogin(
  username: string,
  password: string,
): Promise<GASAuthResult> {
  if (!GAS_URL) return { success: false, error: "App is not configured. Please contact the administrator." };
  try {
    return await gasPost<GASAuthResult>({
      action: "auth",
      payload: { method: "login", username, password },
    });
  } catch {
    return { success: false, error: "Cannot connect to the server. Please check your internet connection." };
  }
}

export async function gasChangePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!GAS_URL) return { success: false, error: "App is not configured." };
  try {
    return await gasPost<{ success: boolean; error?: string }>({
      action: "auth",
      payload: { method: "changePassword", userId, currentPassword, newPassword },
    });
  } catch {
    return { success: false, error: "Cannot connect to the server." };
  }
}

// ─── Per-mutation sync (fire-and-forget) ──────────────────────────────────────

export function gasSyncStudent(
  userId: string,
  method: "create" | "update",
  student: unknown,
): void {
  gasFire({ action: "students", payload: { method, userId, student } });
}

export function gasDeleteStudent(userId: string, studentId: string): void {
  gasFire({ action: "students", payload: { method: "delete", userId, studentId } });
}

export function gasSyncPayment(userId: string, payment: unknown): void {
  gasFire({ action: "payments", payload: { method: "create", userId, payment } });
}

export function gasDeletePayment(userId: string, paymentId: string): void {
  gasFire({ action: "payments", payload: { method: "delete", userId, paymentId } });
}

export function gasSyncProfile(
  userId: string,
  profile: Record<string, unknown>,
): void {
  const { logoBase64: _logo, ...profileWithoutLogo } = profile;
  gasFire({ action: "profile", payload: { method: "update", userId, profile: profileWithoutLogo } });
}

// ─── Bulk sync (fire-and-forget) — called on logout to flush any pending changes ──

/**
 * Sends the complete current state for a user to GAS in one request.
 * GAS will replace all existing rows for this userId with the provided data.
 * Logos are excluded (too large for Sheets; they stay device-local).
 */
export function gasSyncAll(
  userId: string,
  students: unknown[],
  payments: unknown[],
  profile: (Record<string, unknown> & { logoBase64?: string }) | null,
): void {
  if (!GAS_URL || !userId) return;
  const profileForGAS = profile
    ? (({ logoBase64: _logo, ...rest }) => rest)(profile)
    : null;
  fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "syncBulk",
      payload: { userId, students, payments, profile: profileForGAS },
    }),
    redirect: "follow",
  }).catch(() => {});
}
