// PostgREST answers at most `max_rows` rows per request (1000 on Supabase,
// see `supabase/config.toml`), whatever `.limit()` asks for: the metrics,
// customers and coupon-use queries asked for 5000 or 20000 rows and silently
// got the first 1000, so every total past that point was short.
//
// This reads a query page by page with `.range()`. The caller must give the
// query a stable order (a unique column last), or rows can repeat or go
// missing between pages. Pure: no Next.js or server imports.

/** Must not exceed the server's `max_rows`, or a full page looks like the last. */
export const FETCH_ALL_PAGE_SIZE = 1000

/** Upper bound on rows read into memory for one screen. */
export const FETCH_ALL_MAX_ROWS = 50_000

export interface PageResponse<T> {
  data: T[] | null
  error: unknown
}

export interface FetchAllResult<T> {
  data: T[]
  /** The first error; rows read before it are still returned. */
  error: unknown
  /** True when `maxRows` stopped the read before the last page. */
  truncated: boolean
}

/**
 * Reads every row of a query. `page(from, to)` must return the query with
 * `.range(from, to)` applied (both inclusive), built fresh on every call.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResponse<T>>,
  {
    pageSize = FETCH_ALL_PAGE_SIZE,
    maxRows = FETCH_ALL_MAX_ROWS,
  }: { pageSize?: number; maxRows?: number } = {},
): Promise<FetchAllResult<T>> {
  const rows: T[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize, maxRows) - 1
    const { data, error } = await page(from, to)
    if (error) return { data: rows, error, truncated: false }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < to - from + 1) {
      return { data: rows, error: null, truncated: false }
    }
  }
  return { data: rows, error: null, truncated: true }
}
