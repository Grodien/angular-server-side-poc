import { inject, PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { CompanyService } from './company.service';
import { Company } from './company.model';

/**
 * Normalizes the search term coming from the "q" query parameter.
 */
function normalizeQuery(value: unknown): string {
  return (typeof value === 'string' ? value : '').trim().toLowerCase();
}

/**
 * TransferState key per search term, so hydration reads the value that matches
 * the current query instead of a stale cached list.
 */
function stateKey(query: string) {
  return makeStateKey<Company[]>(`companies:${query}`);
}

/**
 * Loads the company list, optionally filtered by name (server-side).
 *
 * The filter runs on the server: all rows are fetched with the API key, matched
 * against the search term, and only the matching rows are placed in
 * TransferState. Non-matching data is therefore never sent to the browser.
 *
 * During hydration the browser reads the transferred (already filtered) value
 * and never calls the API itself.
 */
export const companiesResolver: ResolveFn<Company[]> = async (
  route: ActivatedRouteSnapshot,
) => {
  const platformId = inject(PLATFORM_ID);
  const transferState = inject(TransferState);
  const query = normalizeQuery(route.queryParamMap.get('q'));
  const key = stateKey(query);

  // Browser: use the state transferred from the server, never hit the API.
  if (!isPlatformServer(platformId)) {
    return transferState.get(key, []);
  }

  // Server: fetch, filter by name, and transfer only the matches.
  const service = inject(CompanyService);
  try {
    const all = await service.getAll();
    const filtered = query
      ? all.filter((company) => {
          const shortName = (company.short_name ?? '').toLowerCase();
          const code = (company.code ?? '').toLowerCase();
          return shortName.includes(query) || code.includes(query);
        })
      : all;

    transferState.set(key, filtered);
    return filtered;
  } catch {
    transferState.set(key, []);
    return [];
  }
};
