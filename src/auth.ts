// src/auth.ts - PKCE Authentication Module for PingOne OIDC

const AUTH_CONFIG = {
  clientId: "6a74a87c-54fb-49d5-9c44-1c24c6648c09",
  authorizationEndpoint:
    "https://auth.pingone.com/5ba551c1-a8e9-45c7-a75e-2893f8761cee/as/authorize",
  tokenEndpoint:
    "https://auth.pingone.com/5ba551c1-a8e9-45c7-a75e-2893f8761cee/as/token",
  endSessionEndpoint:
    "https://auth.pingone.com/5ba551c1-a8e9-45c7-a75e-2893f8761cee/as/signoff",
  redirectUri: "http://127.0.0.1:3001",
  scope: "openid profile email",
};

const STORAGE_KEYS = {
  accessToken: "auth_access_token",
  idToken: "auth_id_token",
  refreshToken: "auth_refresh_token",
  codeVerifier: "auth_code_verifier",
  state: "auth_state",
  user: "auth_user",
};

export interface UserInfo {
  sub: string;
  name?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
}

// Generate a random string for code verifier (43-128 chars)
function generateRandomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

// Generate code verifier for PKCE
export function generateCodeVerifier(): string {
  return generateRandomString(64);
}

// Generate code challenge from verifier using SHA-256
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  // Base64url encode the digest
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Generate state parameter for CSRF protection
export function generateState(): string {
  return generateRandomString(32);
}

// Initiate PKCE login flow
export async function login(): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store verifier and state for callback validation
  sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
  sessionStorage.setItem(STORAGE_KEYS.state, state);

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: "code",
    client_id: AUTH_CONFIG.clientId,
    redirect_uri: AUTH_CONFIG.redirectUri,
    scope: AUTH_CONFIG.scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: state,
  });

  // Redirect to authorization endpoint
  window.location.href = `${AUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;
}

// Handle the OAuth callback
export async function handleCallback(): Promise<boolean> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");
  const error = urlParams.get("error");

  // Check for errors
  if (error) {
    console.error("Auth error:", error, urlParams.get("error_description"));
    clearAuthData();
    return false;
  }

  // Validate we have a code
  if (!code) {
    return false;
  }

  // Validate state
  const storedState = sessionStorage.getItem(STORAGE_KEYS.state);
  if (state !== storedState) {
    console.error("State mismatch - possible CSRF attack");
    clearAuthData();
    return false;
  }

  // Get stored code verifier
  const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);
  if (!codeVerifier) {
    console.error("Code verifier not found");
    clearAuthData();
    return false;
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(AUTH_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: AUTH_CONFIG.redirectUri,
        client_id: AUTH_CONFIG.clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange failed:", errorData);
      clearAuthData();
      return false;
    }

    const tokens = await tokenResponse.json();

    // Store tokens
    sessionStorage.setItem(STORAGE_KEYS.accessToken, tokens.access_token);
    if (tokens.id_token) {
      sessionStorage.setItem(STORAGE_KEYS.idToken, tokens.id_token);
      // Parse user info from ID token
      const userInfo = parseIdToken(tokens.id_token);
      if (userInfo) {
        sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userInfo));
      }
    }
    if (tokens.refresh_token) {
      sessionStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh_token);
    }

    // Clean up PKCE data
    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
    sessionStorage.removeItem(STORAGE_KEYS.state);

    // Clear URL params
    window.history.replaceState({}, document.title, window.location.pathname);

    return true;
  } catch (err) {
    console.error("Token exchange error:", err);
    clearAuthData();
    return false;
  }
}

// Parse ID token to extract user info (JWT decode, no verification needed for display)
function parseIdToken(idToken: string): UserInfo | null {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return {
      sub: payload.sub,
      name: payload.name,
      email: payload.email,
      given_name: payload.given_name,
      family_name: payload.family_name,
    };
  } catch {
    return null;
  }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem(STORAGE_KEYS.accessToken);
}

// Get access token
export function getAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.accessToken);
}

// Get user info
export function getUser(): UserInfo | null {
  const userJson = sessionStorage.getItem(STORAGE_KEYS.user);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

// Clear all auth data
function clearAuthData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    sessionStorage.removeItem(key);
  });
}

// Logout
export function logout(): void {
  const idToken = sessionStorage.getItem(STORAGE_KEYS.idToken);
  clearAuthData();

  // Redirect to end session endpoint
  const params = new URLSearchParams({
    id_token_hint: idToken || "",
    post_logout_redirect_uri: AUTH_CONFIG.redirectUri,
  });

  window.location.href = `${AUTH_CONFIG.endSessionEndpoint}?${params.toString()}`;
}

// Check if current URL has auth callback params
export function hasAuthCallback(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has("code") || urlParams.has("error");
}
