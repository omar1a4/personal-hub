import { cp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'docs');
await rm(target, { recursive:true, force:true });
await mkdir(target, {recursive:true});
// An explicit allowlist prevents private databases, uploads, credentials and backend code
// from entering the public website. This script never reads the app's userData directory.
for (const file of ['app.js','navigation.js','workflow.js','journals.js','demo.js','style.css','journals.css']) {
  const source=await readFile(join(root,'web',file),'utf8');
  await writeFile(join(target,file), file.endsWith('.css') ? source.replaceAll("url('/", "url('./") : source);
}
let index=await readFile(join(root,'web/index.html'),'utf8');
index=index.replace('<html lang="en">','<html lang="en" data-demo="true">').replaceAll('src="/','src="./').replaceAll('href="/style','href="./style').replaceAll('href="/katex','href="./katex').replaceAll('href="/journals','href="./journals');
await writeFile(join(target,'index.html'),index);
await cp(join(root,'shared/journal-model.mjs'),join(target,'journal-model.mjs'));
await cp(join(root,'web/generated/rich.js'),join(target,'rich.js'));
await cp(join(root,'node_modules/lucide/dist/umd/lucide.min.js'),join(target,'icons.js'));
const mathCss=(await readFile(join(root,'node_modules/katex/dist/katex.min.css'),'utf8'))
  .replace(/,url\(fonts\/[^)]+\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g,'');
await writeFile(join(target,'katex.css'),mathCss);
await mkdir(join(target,'fonts'));
for (const font of await readdir(join(root,'node_modules/katex/dist/fonts'))) {
  if (font.endsWith('.woff2')) await cp(join(root,'node_modules/katex/dist/fonts',font),join(target,'fonts',font));
}
await cp(join(root,'node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2'),join(target,'sans.woff2'));
await cp(join(root,'node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2'),join(target,'serif.woff2'));
await mkdir(join(target,'licenses'), {recursive:true});
for (const [source, name] of [
  ['lucide/LICENSE','lucide.txt'], ['katex/LICENSE','katex.txt'],
  ['marked/LICENSE','marked.txt'], ['marked-katex-extension/LICENSE','marked-katex-extension.txt'],
  ['dompurify/LICENSE','dompurify.txt'], ['dompurify/LICENSE-MPL','dompurify-MPL.txt'],
  ['@fontsource/dm-sans/LICENSE','dm-sans.txt'], ['@fontsource/source-serif-4/LICENSE','source-serif-4.txt'],
]) await cp(join(root,'node_modules',source),join(target,'licenses',name));
await writeFile(join(target,'.nojekyll'),'');
await writeFile(join(target,'404.html'),index);
console.log('Public demo built in docs/ (fictional seed data only).');
