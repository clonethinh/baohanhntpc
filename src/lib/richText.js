import DOMPurify from 'dompurify';

export const RICH_TEXT_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

export const RICH_TEXT_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'list',
  'bullet',
  'link',
];

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'span'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRichTextInput(html) {
  const value = String(html || '').replace(/\r\n/g, '\n');
  if (/[<][a-z][\s\S]*[>]/i.test(value)) return value;
  return value
    .split('\n')
    .map((line) => line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>')
    .join('');
}

export function sanitizeRichText(html) {
  return DOMPurify.sanitize(normalizeRichTextInput(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
  }).replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

export function richTextPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeRichText(html);
  return (div.textContent || '').replace(/ /g, ' ').trim();
}

export function isRichTextEmpty(html) {
  return !richTextPlainText(html);
}
