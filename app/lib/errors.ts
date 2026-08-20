/**
 * Error helpers.
 *
 * Supabase rejects with a plain object ({message, details, hint, code}), not an
 * Error. Passing one through String() yields the useless "[object Object]",
 * which is how a real database error reached the UI as unreadable noise. These
 * helpers keep the actual message intact from the query all the way to the
 * screen.
 */

interface SupabaseLikeError {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

/** Best available human-readable text for anything that was thrown. */
export function errMessage(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;

  if (e && typeof e === 'object') {
    const o = e as SupabaseLikeError;
    const parts: string[] = [];
    if (typeof o.message === 'string' && o.message) parts.push(o.message);
    if (typeof o.details === 'string' && o.details) parts.push(o.details);
    if (typeof o.hint === 'string' && o.hint) parts.push(`Hint: ${o.hint}`);
    if (typeof o.code === 'string' && o.code) parts.push(`(code ${o.code})`);
    if (parts.length) return parts.join(' · ');

    try {
      const json = JSON.stringify(e);
      if (json && json !== '{}') return json;
    } catch {
      // fall through — circular or otherwise unserialisable
    }

    // An object with nothing usable on it. String() would give the useless
    // "[object Object]", so name the shape instead.
    const ctor = (e as object).constructor?.name;
    return ctor && ctor !== 'Object'
      ? `Unreadable ${ctor} error (no message)`
      : 'Unreadable error object (no message)';
  }

  return e === undefined ? 'Unknown error' : String(e);
}

/**
 * Turn anything thrown into a real Error, prefixed with what we were doing.
 * `throw dbError('load orders', error)` gives "Could not load orders: <why>".
 */
export function dbError(action: string, e: unknown): Error {
  return new Error(`Could not ${action}: ${errMessage(e)}`);
}
