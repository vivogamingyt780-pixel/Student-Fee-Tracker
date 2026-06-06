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

const USERS_KEY = "feetracker_users";
const SESSION_KEY = "feetracker_session";

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

export function getUsers(): User[] {
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

export function signup(username: string, password: string, coachingName: string): { success: boolean; error?: string; session?: Session } {
  const users = getUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: "Username already taken. Please choose another." };
  }
  if (username.length < 3) return { success: false, error: "Username must be at least 3 characters." };
  if (password.length < 6) return { success: false, error: "Password must be at least 6 characters." };

  const id = generateId();
  const coachingId = generateId();
  const newUser: User = {
    id,
    username,
    passwordHash: hashPassword(password),
    coachingId,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);

  // Create default coaching profile
  const profileKey = `feetracker_profile_${id}`;
  localStorage.setItem(profileKey, JSON.stringify({
    id: coachingId,
    userId: id,
    name: coachingName || "My Coaching",
    ownerName: "",
    mobile: "",
    address: "",
    logoBase64: "",
  }));

  const session: Session = { userId: id, username, coachingId };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, session };
}

export function login(username: string, password: string): { success: boolean; error?: string; session?: Session } {
  const users = getUsers();
  const hash = hashPassword(password);
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash);
  if (!user) {
    return { success: false, error: "Invalid username or password." };
  }
  const session: Session = { userId: user.id, username: user.username, coachingId: user.coachingId };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, session };
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function changePassword(userId: string, currentPassword: string, newPassword: string): { success: boolean; error?: string } {
  const users = getUsers();
  const userIndex = users.findIndex((u) => u.id === userId && u.passwordHash === hashPassword(currentPassword));
  if (userIndex === -1) return { success: false, error: "Current password is incorrect." };
  if (newPassword.length < 6) return { success: false, error: "New password must be at least 6 characters." };
  users[userIndex].passwordHash = hashPassword(newPassword);
  saveUsers(users);
  return { success: true };
}
