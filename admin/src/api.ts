const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const normalizedApiBase = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '';

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedApiBase ? `${normalizedApiBase}${normalizedPath}` : normalizedPath;
}

