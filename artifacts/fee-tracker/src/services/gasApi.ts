/**
 * Google Apps Script API client.
 *
 * VITE_GAS_URL is baked into the build by the app owner (Netlify env var).
 * End users never configure anything — they just sign up and use the app.
 *
 * CORS strategy: POST with no Content-Type header → browser treats body as
 * text/plain (a "simple" CORS request) → no preflight OPTIONS call needed.
 * GAS reads e.postData.contents regardless of Content-Type.
 * The redirect response from script.googleusercontent.com has CORS headers,
 * so fetch can read the JSON back.
 */

const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? "";

export function isGASConfigured(): boolean {
  return GAS_URL.length > 0;
}

// ─── Core fetch helpers ────────────────────────────────────────────────────────

async function gasPost<T>(payload: Record<string, unknown>): Promise<T> {
  // No Content-Type header → text/plain → simple CORS, no preflight
  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  return res.json() as Promise<T>;
}

function gasFire(payload: Record<string, unknown>): void {
  if (!isGASConfigured()) return;
  fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    redirect: "follow",
  }).catch(() => {}); // fire-and-forget — localStorage is primary
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
  try {
    return await gasPost<{ success: boolean; error?: string }>({
      action: "auth",
      payload: { method: "changePassword", userId, currentPassword, newPassword },
    });
  } catch {
    return { success: false, error: "Cannot connect to the server." };
  }
}

// ─── Student mutations (fire-and-forget) ──────────────────────────────────────

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

// ─── Payment mutations (fire-and-forget) ──────────────────────────────────────

export function gasSyncPayment(userId: string, payment: unknown): void {
  gasFire({ action: "payments", payload: { method: "create", userId, payment } });
}

export function gasDeletePayment(userId: string, paymentId: string): void {
  gasFire({ action: "payments", payload: { method: "delete", userId, paymentId } });
}

// ─── Profile sync (fire-and-forget, logo excluded — too large for Sheets) ─────

export function gasSyncProfile(
  userId: string,
  profile: Record<string, unknown>,
): void {
  const { logoBase64: _logo, ...profileWithoutLogo } = profile;
  gasFire({ action: "profile", payload: { method: "update", userId, profile: profileWithoutLogo } });
}
