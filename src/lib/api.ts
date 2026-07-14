import { authClient } from "../auth";

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sessionResult = authClient ? await authClient.getSession() : null;
  const token = (sessionResult?.data?.session as { token?: string } | undefined)?.token;
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
