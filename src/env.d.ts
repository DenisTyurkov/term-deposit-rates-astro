/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Optional override for the nz-leads lead intake endpoint (inlined into the
   * quiz island at build time). The production URL is committed in
   * src/scripts/quiz.ts — set this only to point a dev build elsewhere.
   */
  readonly PUBLIC_LEAD_INTAKE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
