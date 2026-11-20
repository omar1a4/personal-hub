import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import DOMPurify from 'dompurify';

marked.use(markedKatex({ throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000 }));
globalThis.renderRich = text => DOMPurify.sanitize(marked.parse(text), {
  FORBID_TAGS: ['img', 'video', 'audio', 'iframe', 'object', 'embed', 'style', 'form', 'input', 'button'],
  FORBID_ATTR: ['src', 'srcset'],
});