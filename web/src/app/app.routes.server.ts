import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Server-side render on each request so the company data is fetched live
    // (via the server-side proxy) instead of being prerendered at build time.
    path: '**',
    renderMode: RenderMode.Server
  }
];
