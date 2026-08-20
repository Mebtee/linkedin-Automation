// ─── LinkedIn Connection Row ────────────────────────────────────────────────

export type LinkedInConnectionStatus = "connected" | "expired" | "disconnected";

export type LinkedInConnectionRow = {
  readonly id: string;
  readonly profile_id: string;
  readonly linkedin_sub: string;
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_at: string | null;
  readonly scope: string;
  readonly linkedin_name: string | null;
  readonly linkedin_email: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

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

// ─── Publishing ─────────────────────────────────────────────────────────────

export type LinkedInPublishResult = {
  readonly success: boolean;
  readonly linkedinPostId?: string;
  readonly error?: string;
};
