import { isGASConfigured, gasSignup, gasLogin, gasChangePassword } from "./gasApi";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  coachingId: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  username: string;
  coachingId: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  session?: Session;
  /** Cloud data returned on login — caller should merge into localStorage */
  cloudData?: {
    students: unknown[];
    payments: unknown[];
    profile: unknown;
  };
}

const USERS_KEY = "feetracker_users";
const SESSION_KEY = "feetracker_session";

// Weak hash kept only for localStorage-only fallback mode.
// GAS uses SHA-256 server-side; plaintext password is sent over HTTPS to GAS.
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0") + password.length.toString(16);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

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
  // Client-side validation (applies in both modes)
  if (username.trim().length < 3) return { success: false, error: "Username must be at least 3 characters." };
  if (password.length < 6)        return { success: false, error: "Password must be at least 6 characters." };

  if (isGASConfigured()) {
    // ── GAS mode ──────────────────────────────────────────────────────────────
    const result = await gasSignup(username.trim(), password, coachingName);
    if (!result.success || !result.user) {
      return { success: false, error: result.error || "Signup failed. Please try again." };
    }

    const { id, username: uname, coachingId } = result.user;

    // Seed a local profile so the app shows coaching name immediately
    localStorage.setItem(
      `feetracker_profile_${id}`,
      JSON.stringify({
        id: coachingId,
        userId: id,
        name: coachingName || "My Coaching",
        ownerName: "",
        mobile: "",
        address: "",
        logoBase64: "",
      }),
    );

    const session: Session = { userId: id, username: uname, coachingId };
    saveSession(session);
    return { success: true, session };
  }

  // ── LocalStorage fallback mode ─────────────────────────────────────────────
  const users = getUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: "Username already taken. Please choose another." };
  }

  const id        = generateId();
  const coachingId = generateId();
  const newUser: User = {
    id,
    username: username.trim(),
    passwordHash: hashPassword(password),
    coachingId,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);

  localStorage.setItem(
    `feetracker_profile_${id}`,
    JSON.stringify({
      id: coachingId,
      userId: id,
      name: coachingName || "My Coaching",
      ownerName: "",
      mobile: "",
      address: "",
      logoBase64: "",
    }),
  );

  const session: Session = { userId: id, username: newUser.username, coachingId };
  saveSession(session);
  return { success: true, session };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthResult> {
  if (isGASConfigured()) {
    // ── GAS mode ──────────────────────────────────────────────────────────────
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
        profile: result.profile ?? null,
      },
    };
  }

  // ── LocalStorage fallback mode ─────────────────────────────────────────────
  const users  = getUsers();
  const hash   = hashPassword(password);
  const user   = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash,
  );
  if (!user) return { success: false, error: "Invalid username or password." };

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
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 6) return { success: false, error: "New password must be at least 6 characters." };

  if (isGASConfigured()) {
    return gasChangePassword(userId, currentPassword, newPassword);
  }

  // LocalStorage fallback
  const users = getUsers();
  const idx   = users.findIndex(
    (u) => u.id === userId && u.passwordHash === hashPassword(currentPassword),
  );
  if (idx === -1) return { success: false, error: "Current password is incorrect." };
  users[idx].passwordHash = hashPassword(newPassword);
  saveUsers(users);
  return { success: true };
}
