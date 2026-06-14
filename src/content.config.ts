import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Markdown content has no frontmatter (it's pure body), so the schemas are
// empty. Entry `id` is the filename without extension, e.g. "anz" or
// "short-term-deposit-rates".
const providers = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/providers' }),
  schema: z.object({}).passthrough(),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({}).passthrough(),
});

export const collections = { providers, pages };
