// ─── LinkedIn Connection Status ──────────────────────────────────────────────

export type LinkedInConnectionStatus = "connected" | "expired" | "disconnected";

// ─── OAuth State ────────────────────────────────────────────────────────────

export type OAuthStateMode = "connect" | "reauth";

export type OAuthStatePayload = {
  readonly uid: string;
  readonly ts: number;
  readonly mode: OAuthStateMode;
};

// ─── LinkedIn API Response Types ────────────────────────────────────────────

export type LinkedInTokenResponse = {
  readonly access_token: string;
  readonly expires_in: number;
  readonly token_type: string;
  readonly scope: string;
};

export type LinkedInUserInfo = {
  readonly sub: string;
  readonly name?: string;
  readonly email?: string;
};
