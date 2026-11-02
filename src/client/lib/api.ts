let activeCsrfToken = '';

export function setApiCsrfToken(token: string) {
  activeCsrfToken = token;
}

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (
    options.body &&
    !(typeof FormData !== 'undefined' && options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  if (activeCsrfToken && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', activeCsrfToken);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
