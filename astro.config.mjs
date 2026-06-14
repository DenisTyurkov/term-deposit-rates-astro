// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

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
  ],
});
