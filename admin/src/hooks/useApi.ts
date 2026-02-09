import { useCallback } from "react";
import { resolveApiUrl } from "../api";

export function useApi(token: string | null) {
  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers ?? {});
      headers.set("content-type", "application/json");
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      const response = await fetch(resolveApiUrl(path), { ...options, headers });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const detail =
          (data && typeof data === "object" && "error" in data && data.error) ||
          `Request failed (${response.status} ${response.statusText})`;
        throw new Error(String(detail));
      }
      return response.json();
    },
    [token]
  );

  return { apiFetch };
}
