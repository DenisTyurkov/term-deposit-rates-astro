import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {},
  },
  // Highlight/gradient classes are assembled in TS/markup branches; safelist the
  // dynamic ones so the JIT never drops them.
  safelist: [
    'bg-gradient-to-r', 'bg-gradient-to-b',
    'from-yellow-50', 'to-yellow-100', 'from-yellow-50', 'to-amber-100',
    'from-green-50', 'to-green-100', 'to-emerald-100',
    'from-blue-50', 'to-cyan-100',
    'from-purple-50', 'to-indigo-100',
    'border-yellow-500', 'border-green-500', 'border-green-400',
    'border-yellow-300', 'border-blue-300', 'border-green-300', 'border-purple-300',
    'border-l-4', 'border-l-2',
    'from-yellow-400', 'to-amber-500', 'from-blue-400', 'to-cyan-500',
    'from-green-400', 'to-emerald-500', 'from-purple-400', 'to-indigo-500',
    'text-yellow-800', 'text-blue-800', 'text-green-800', 'text-purple-800',
    'text-yellow-700', 'text-green-700', 'text-yellow-600', 'text-green-600',
  ],
  plugins: [typography],
};
