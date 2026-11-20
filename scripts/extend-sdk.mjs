import { readFile, writeFile } from 'node:fs/promises';
const path = new URL('../.tools/sign-in-with-chatgpt-devkit-0a36fefeb913055c8c7a1a29b63d82b96b2e841a/packages/local/dist/responses.js', import.meta.url);
const original = 'typeof message.content !== "string"';
const replacement = '!(typeof message.content === "string" || (message.role === "user" && Array.isArray(message.content)))';
const source = await readFile(path, 'utf8');
if (!source.includes(replacement)) {
  if (source.split(original).length !== 2) throw new Error('Pinned SDK content validator changed; review the extension before proceeding.');
  await writeFile(path, source.replace(original, replacement));
}
console.log('Applied local multimodal input extension; official OAuth, storage, refresh and completion checks unchanged.');