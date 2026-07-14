import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();

export const authClient = authUrl ? createAuthClient(authUrl) : null;
// The seeded demo is strictly a local-development convenience. A production
// build without auth configuration must fail closed instead of exposing it.
export const isDemoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== "false";
