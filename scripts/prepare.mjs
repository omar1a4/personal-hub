import './extend-sdk.mjs';
import { build } from 'esbuild';
await build({ entryPoints: ['web/rich-entry.mjs'], bundle: true, platform: 'browser', format: 'iife', outfile: 'web/generated/rich.js', minify: true });