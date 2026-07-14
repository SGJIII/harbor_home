import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();

export const authClient = authUrl ? createAuthClient(authUrl) : null;
export const isDemoMode = import.meta.env.VITE_DEMO_MODE !== "false" || !authClient;
