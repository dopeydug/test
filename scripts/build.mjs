/**
 * Bundle the ES-module app into a single IIFE for the Shopify theme
 * (theme assets can't rely on relative module imports).
 *
 *   npm run build   →  dist/sleep-assessment.min.js
 */
import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['sleep-assessment/assets/js/app.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'dist/sleep-assessment.min.js',
  legalComments: 'none',
  banner: { js: '/* Muscle Mat Sleep Assessment — built bundle. Source: sleep-assessment/assets/js */' },
});
copyFileSync('sleep-assessment/assets/css/sleep-assessment.css', 'dist/sleep-assessment.css');
console.log('Built dist/sleep-assessment.min.js and dist/sleep-assessment.css');
