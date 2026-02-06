// Shared session store for auth state (file-based so stdio and HTTP servers can share)
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, "..", ".auth-session.json");

export interface AuthSession {
  authenticated: boolean;
  accessToken?: string;
  idToken?: string;
  user?: {
    sub?: string;
    name?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
  };
  expiresAt?: number; // Unix timestamp
}

const DEFAULT_SESSION: AuthSession = { authenticated: false };

// Read current auth session
export async function getSession(): Promise<AuthSession> {
  try {
    const data = await fs.readFile(SESSION_FILE, "utf-8");
    const session = JSON.parse(data) as AuthSession;

    // Check if session has expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      await clearSession();
      return DEFAULT_SESSION;
    }

    return session;
  } catch {
    // File doesn't exist or is invalid
    return DEFAULT_SESSION;
  }
}

// Save auth session
export async function saveSession(session: AuthSession): Promise<void> {
  await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
}

// Clear auth session (logout)
export async function clearSession(): Promise<void> {
  await fs.writeFile(SESSION_FILE, JSON.stringify(DEFAULT_SESSION, null, 2), "utf-8");
}

// Check if authenticated
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.authenticated;
}
