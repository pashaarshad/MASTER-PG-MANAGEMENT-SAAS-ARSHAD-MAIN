/**
 * Safe Browser Storage Utility
 * Handles quota limits, base64 payload stripping for local cache, and corrupted JSON recovery.
 */

export function safeGetItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[SafeStorage] Failed to read or parse key "${key}", using fallback:`, err);
    return fallback;
  }
}

/**
 * Strips huge base64 image strings from objects when caching to localStorage
 * so that localStorage stays well below the browser's 5MB origin limit.
 * (Full base64 documents remain safely in MongoDB and active React memory).
 */
function sanitizeForLocalCache(data: any): any {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLocalCache(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && v.startsWith('data:') && v.length > 2000) {
        // Truncate / replace large base64 data URLs for local storage cache
        sanitized[k] = undefined;
      } else if (
        typeof v === 'string' &&
        (k.toLowerCase().includes('base64') ||
          k.toLowerCase().includes('dataurl') ||
          k.toLowerCase().includes('documentimage')) &&
        v.length > 2000
      ) {
        sanitized[k] = undefined;
      } else if (typeof v === 'object' && v !== null) {
        sanitized[k] = sanitizeForLocalCache(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  return data;
}

export function safeSetItem(key: string, data: any, stripLargeBlobs: boolean = false): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const preparedData = stripLargeBlobs ? sanitizeForLocalCache(data) : data;
    const serialized = JSON.stringify(preparedData);
    window.localStorage.setItem(key, serialized);
  } catch (err: any) {
    // Check if QuotaExceededError
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;

    if (isQuotaError) {
      console.warn(`[SafeStorage] Quota exceeded on key "${key}". Cleaning non-essential local cache...`);
      try {
        // Clear heavy non-essential local storage items to free up space
        const nonEssentialKeys = [
          'abcdef_pg_storage_files',
          'abcdef_pg_audit_logs',
          'abcdef_pg_notifications',
        ];
        nonEssentialKeys.forEach((k) => {
          if (k !== key) {
            window.localStorage.removeItem(k);
          }
        });

        // Retry saving with aggressive sanitization
        const heavilySanitized = sanitizeForLocalCache(data);
        window.localStorage.setItem(key, JSON.stringify(heavilySanitized));
      } catch (retryErr) {
        // Gracefully ignore local storage failure; data is in MongoDB & active state
        console.warn(`[SafeStorage] Local cache write bypassed for "${key}" (safely saved in MongoDB).`);
      }
    } else {
      console.warn(`[SafeStorage] Write error on key "${key}":`, err);
    }
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[SafeStorage] Remove error for key "${key}":`, err);
  }
}
