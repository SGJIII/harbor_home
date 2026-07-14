// The seeded demo is strictly a local-development convenience. Production
// builds always use server-issued, HTTP-only email-code sessions.
export const isDemoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== "false";
