"use client";

import { useCallback, useEffect, useState } from "react";

import type { LinkedInConnectionStatus } from "@/types/linkedin";

type ConnectionState = {
  status: LinkedInConnectionStatus;
  connected_at: string | null;
  linkedin_name: string | null;
  linkedin_email: string | null;
};

const STATUS_LABELS: Record<LinkedInConnectionStatus, string> = {
  connected: "Connected",
  expired: "Token expired",
  disconnected: "Not connected",
};

const STATUS_COLORS: Record<LinkedInConnectionStatus, string> = {
  connected:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expired:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  disconnected:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "LinkedIn account connected successfully.",
  reauthorized: "LinkedIn permissions updated. You can now publish posts.",
  denied: "LinkedIn authorization was denied.",
  invalid_state: "Invalid authorization state. Please try again.",
  session_mismatch: "Session mismatch. Please try again.",
  db_error: "Failed to save connection. Please try again.",
  callback_error: "An error occurred during connection. Please try again.",
  missing_params: "Missing authorization parameters. Please try again.",
};

function readCallbackMessage(): string | null {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("linkedin");
  if (!result) return null;
  return CALLBACK_MESSAGES[result] ?? "Unknown result.";
}

export function LinkedInConnectionCard() {
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(() => readCallbackMessage());

  // Strip the transient ?linkedin=... query param after reading it. Must run
  // in an effect (not during render) because history.replaceState triggers a
  // Next.js Router update — doing it while rendering would warn "Cannot
  // update a component (`Router`) while rendering a different component".
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("linkedin")) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("linkedin");
    window.history.replaceState({}, "", url.toString());
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/linkedin/status");
        if (response.ok && !cancelled) {
          const data = (await response.json()) as ConnectionState;
          setConnection(data);
        }
      } catch {
        // Status fetch failed silently
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch after a successful callback redirect
  useEffect(() => {
    if (
      message !== CALLBACK_MESSAGES.connected &&
      message !== CALLBACK_MESSAGES.reauthorized
    )
      return;

    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/linkedin/status");
        if (response.ok && !cancelled) {
          const data = (await response.json()) as ConnectionState;
          setConnection(data);
        }
      } catch {
        // Silently ignore refresh errors
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [message]);

  const handleConnect = useCallback(() => {
    setActionLoading(true);
    // Full navigation required for external OAuth redirect to LinkedIn
    window.location.href = "/api/linkedin/auth"; // eslint-disable-line @next/next/no-location-assign-relative-destination
  }, []);

  const handleDisconnect = useCallback(async () => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/linkedin/disconnect", {
        method: "POST",
      });
      if (response.ok) {
        setConnection({
          status: "disconnected",
          connected_at: null,
          linkedin_name: null,
          linkedin_email: null,
        });
        setMessage("LinkedIn account disconnected.");
      } else {
        setMessage("Failed to disconnect. Please try again.");
      }
    } catch {
      setMessage("Failed to disconnect. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleDismissMessage = useCallback(() => {
    setMessage(null);
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="animate-pulse">
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="mt-2 h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    );
  }

  const status = connection?.status ?? "disconnected";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {message ? (
        <div className="mb-4 flex items-center justify-between rounded-md bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <span>{message}</span>
          <button
            type="button"
            onClick={handleDismissMessage}
            className="ml-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ) : null}

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
            LinkedIn Account
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Connect your LinkedIn account to enable post publishing.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {connection?.linkedin_name || connection?.linkedin_email ? (
        <div className="mt-4 rounded-md bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
          {connection.linkedin_name ? (
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {connection.linkedin_name}
            </p>
          ) : null}
          {connection.linkedin_email ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {connection.linkedin_email}
            </p>
          ) : null}
          {connection.connected_at ? (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Connected {new Date(connection.connected_at).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        {status === "disconnected" || status === "expired" ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-md bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#004182] disabled:opacity-50"
          >
            {actionLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            )}
            {status === "expired" ? "Reconnect" : "Connect LinkedIn"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {actionLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-300" />
            ) : null}
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
