import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  type Configuration,
} from "openid-client";

// Pending authorization request from VS Code, keyed by the OIDC state parameter
interface PendingAuthRequest {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  oidcCodeVerifier: string;
  timestamp: number;
}

// Issued authorization code, keyed by the code string
interface IssuedAuthCode {
  codeChallenge: string;
  clientId: string;
  oidcAccessToken: string;
  oidcIdToken?: string;
  user?: Record<string, unknown>;
  timestamp: number;
}

// Stored access token info
interface StoredToken {
  clientId: string;
  scopes: string[];
  expiresAt: number; // ms since epoch
}

// Array subclass whose includes() always returns true.
// Used so the SDK's authorize handler accepts any redirect_uri for auto-created clients.
class PermissiveUriList extends Array<string> {
  includes(_uri: unknown): boolean {
    return true;
  }
}

export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const stored = this.clients.get(clientId);
    if (stored) return stored;

    // Auto-create a permissive client for unknown client IDs.
    // This handles MCP clients (like VS Code) that may not do dynamic registration.
    console.log("MCP OAuth: auto-creating client for unknown client_id:", clientId);
    const client = {
      client_id: clientId,
      redirect_uris: new PermissiveUriList(),
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    } as OAuthClientInformationFull;
    this.clients.set(clientId, client);
    return client;
  }

  async registerClient(
    client: OAuthClientInformationFull
  ): Promise<OAuthClientInformationFull> {
    console.log("MCP OAuth: registering client:", client.client_id);
    this.clients.set(client.client_id, client);
    return client;
  }
}

export class MCPOAuthProvider implements OAuthServerProvider {
  private _clientsStore = new InMemoryClientsStore();
  private pendingAuthRequests = new Map<string, PendingAuthRequest>();
  private authCodes = new Map<string, IssuedAuthCode>();
  private accessTokens = new Map<string, StoredToken>();

  constructor(
    private oidcConfig: Configuration,
    private oidcRedirectUri: string,
    private oidcScopes: string[] = ["openid", "profile", "email"]
  ) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  /**
   * Called by mcpAuthRouter's /authorize handler.
   * Stores VS Code's auth params, then redirects user to the upstream OIDC IdP.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    // Generate PKCE for upstream OIDC
    const oidcCodeVerifier = randomPKCECodeVerifier();
    const oidcCodeChallenge = await calculatePKCECodeChallenge(oidcCodeVerifier);
    const oidcState = randomUUID();

    // Store pending request so we can complete the flow in the OIDC callback
    this.pendingAuthRequests.set(oidcState, {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      state: params.state,
      codeChallenge: params.codeChallenge,
      oidcCodeVerifier,
      timestamp: Date.now(),
    });

    // Clean up stale pending requests (older than 10 min)
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of this.pendingAuthRequests) {
      if (val.timestamp < cutoff) this.pendingAuthRequests.delete(key);
    }

    // Redirect user to the upstream OIDC provider
    const authUrl = buildAuthorizationUrl(this.oidcConfig, {
      scope: this.oidcScopes.join(" "),
      code_challenge: oidcCodeChallenge,
      code_challenge_method: "S256",
      state: oidcState,
      redirect_uri: this.oidcRedirectUri,
    });

    console.log("MCP OAuth: redirecting to OIDC IdP for state:", oidcState);
    res.redirect(authUrl.toString());
  }

  /**
   * Called from the /auth/callback Express route (NOT by mcpAuthRouter).
   * Exchanges the OIDC code for tokens, generates our own auth code,
   * and returns the redirect info so the route can redirect back to VS Code.
   */
  async handleOIDCCallback(
    code: string,
    state: string
  ): Promise<{ authCode: string; redirectUri: string; state?: string }> {
    const pending = this.pendingAuthRequests.get(state);
    if (!pending) {
      throw new Error("Invalid or expired OIDC state parameter");
    }
    this.pendingAuthRequests.delete(state);

    // Exchange the OIDC authorization code for tokens with the upstream IdP
    const callbackUrl = new URL(
      `${this.oidcRedirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
    );
    const tokenSet = await authorizationCodeGrant(
      this.oidcConfig,
      callbackUrl,
      {
        pkceCodeVerifier: pending.oidcCodeVerifier,
        expectedState: state,
      }
    );

    // Extract user info from ID token claims
    let user: Record<string, unknown> | undefined;
    if (tokenSet.claims) {
      const claims = tokenSet.claims();
      if (claims) {
        user = {
          sub: claims.sub,
          name: claims.name,
          email: claims.email,
          given_name: claims.given_name,
          family_name: claims.family_name,
        };
      }
    }

    // Generate our own authorization code for VS Code
    const authCode = randomUUID();
    this.authCodes.set(authCode, {
      codeChallenge: pending.codeChallenge,
      clientId: pending.clientId,
      oidcAccessToken: tokenSet.access_token,
      oidcIdToken: tokenSet.id_token,
      user,
      timestamp: Date.now(),
    });

    console.log(
      "MCP OAuth: OIDC login successful, issuing auth code for client:",
      pending.clientId
    );

    return {
      authCode,
      redirectUri: pending.redirectUri,
      state: pending.state,
    };
  }

  /**
   * Returns the PKCE code_challenge for a given authorization code.
   * Used by the token handler to validate PKCE locally.
   */
  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const data = this.authCodes.get(authorizationCode);
    if (!data) {
      throw new Error("Invalid authorization code");
    }
    return data.codeChallenge;
  }

  /**
   * Exchanges our authorization code for an access token.
   * Called by mcpAuthRouter's /token handler after PKCE validation.
   */
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<OAuthTokens> {
    const data = this.authCodes.get(authorizationCode);
    if (!data) {
      throw new Error("Invalid authorization code");
    }
    if (data.clientId !== client.client_id) {
      throw new Error("Authorization code was not issued to this client");
    }

    // One-time use
    this.authCodes.delete(authorizationCode);

    // Issue our own access token
    const accessToken = randomUUID();
    const expiresInSeconds = 3600; // 1 hour
    this.accessTokens.set(accessToken, {
      clientId: client.client_id,
      scopes: [],
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresInSeconds,
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new Error("Refresh tokens not supported");
  }

  /**
   * Verifies a bearer token from incoming MCP requests.
   * Used by requireBearerAuth middleware.
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const data = this.accessTokens.get(token);
    if (!data) {
      throw new Error("Invalid or unknown token");
    }
    if (data.expiresAt < Date.now()) {
      this.accessTokens.delete(token);
      throw new Error("Token has expired");
    }

    return {
      token,
      clientId: data.clientId,
      scopes: data.scopes,
      expiresAt: Math.floor(data.expiresAt / 1000), // seconds since epoch
    };
  }
}
