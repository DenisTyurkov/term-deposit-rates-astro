// @ts-check
import { defineConfig } from 'astro/config';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import sitemap from '@astrojs/sitemap';

/**
 * Emit a Cloudflare `_redirects` file giving every directory-format page a
 * `301 Permanent` redirect from its no-slash form to its canonical trailing-slash
 * form (e.g. `/heartland-bank` → `/heartland-bank/`).
 *
 * Why this exists: the legacy Rails site was indexed at no-slash URLs, while this
 * Astro build serves trailing-slash URLs (canonical tags + sitemap already agree).
 * Cloudflare's static-asset `html_handling` normalises slashes but only with a
 * *307 Temporary* redirect, which leaves the old URLs duplicated in Search Console.
 * An explicit 301 tells Google the move is permanent and consolidates ranking signal.
 *
 * Generated (not hand-written) so it tracks banks coming/going, and per-route
 * (not a `/* /:splat/ 301` splat) to avoid a redirect loop on the already-slashed URL.
 *
 * Build-time only — this runs in the Node `astro build`, never in a runtime bundle,
 * matching the same invariant as the better-sqlite3 data layer.
 */
function trailingSlashRedirects() {
  return {
    name: 'trailing-slash-301-redirects',
    hooks: {
      'astro:build:done': ({ pages, dir }) => {
        const rules = pages
          .map((p) => p.pathname)
          .filter((pathname) => pathname.endsWith('/') && pathname !== '/' && pathname !== '')
          .map((pathname) => {
            const withSlash = `/${pathname}`;
            const noSlash = withSlash.slice(0, -1);
            return `${noSlash} ${withSlash} 301`;
          });
        const outPath = path.join(fileURLToPath(dir), '_redirects');
        writeFileSync(outPath, rules.join('\n') + '\n');
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  // Canonical production host — kept identical to the live Rails site.
  site: 'https://www.termdepositrates.co.nz',
  output: 'static',
  integrations: [
    sitemap({
      // Mirror the priorities/changefreq the old Rails seo#sitemap builder used.
      serialize(item) {
        const path = new URL(item.url).pathname;
        if (path === '/') {
          item.priority = 1.0;
          item.changefreq = 'daily';
        } else if (path === '/term-deposit-calculator/') {
          item.priority = 0.9;
          item.changefreq = 'weekly';
        } else if (
          path === '/short-term-deposit-rates/' ||
          path === '/long-term-deposit-rates/'
        ) {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        } else {
          // Provider pages + pie
          item.priority = 0.8;
          item.changefreq = 'daily';
        }
        return item;
      },
    }),
    trailingSlashRedirects(),
  ],
});
