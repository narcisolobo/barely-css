// Pure checkers for tests/unit/fixtures-lint.spec.js. Each takes an HTML (or CSS) string
// and returns a list of problems, so they can be tested with small inline strings.

const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** Every opening tag as { tag, name, attrs }, where attrs maps lowercase names to values. */
export function parseTags(html) {
  const out = [];
  for (const [tag, name, rest] of html.matchAll(TAG)) {
    const attrs = {};
    for (const [, key, dq, sq, bare] of rest.matchAll(ATTR)) {
      attrs[key.toLowerCase()] = dq ?? sq ?? bare ?? '';
    }
    out.push({ tag, name: name.toLowerCase(), attrs });
  }
  return out;
}

/** Anything with a scheme (http:, data:, ...) or a protocol-relative start loads from elsewhere. */
const isExternal = (value) => /^\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);

/** Resource-loading values that point outside the fixture, plus any url( in CSS. */
export function externalResources(html) {
  const found = [];
  for (const { tag, name, attrs } of parseTags(html)) {
    const urls = [];
    for (const key of ['src', 'poster', 'data', 'action', 'formaction']) {
      if (key in attrs) urls.push(attrs[key]);
    }
    if (name === 'link' && 'href' in attrs) urls.push(attrs.href);
    if ('srcset' in attrs) {
      for (const candidate of attrs.srcset.split(',')) urls.push(candidate.trim().split(/\s+/)[0] ?? '');
    }
    for (const url of urls) if (isExternal(url)) found.push(`${tag} loads ${url}`);
    if (attrs.style && /url\(/i.test(attrs.style)) found.push(`${tag} has url( in style`);
  }
  for (const [, css] of html.matchAll(/<style\b[^>]*>([^]*?)<\/style>/gi)) {
    if (/url\(/i.test(css)) found.push('<style> block has url(');
  }
  return found;
}

/** Date or random APIs inside script bodies. Dates written in content are fine. */
export function randomInScripts(html) {
  const found = [];
  for (const [, body] of html.matchAll(/<script\b[^>]*>([^]*?)<\/script>/gi)) {
    const hit = body.match(/new Date|Date\.now|Math\.random|crypto\.|performance\.now/);
    if (hit) found.push(hit[0]);
  }
  return found;
}

/**
 * Inline styles that are not allowed: only --barely-* token overrides, except that a
 * [popover] may set inset and margin to take its UA-centered box out of a dialog's way.
 */
export function badInlineStyles(html) {
  const found = [];
  for (const { tag, attrs } of parseTags(html)) {
    if (!('style' in attrs)) continue;
    const popover = 'popover' in attrs;
    for (const declaration of attrs.style.split(';').map((d) => d.trim()).filter(Boolean)) {
      const ok = /^--barely-[\w-]+\s*:/.test(declaration) || (popover && /^(inset|margin)\s*:/.test(declaration));
      if (!ok) found.push(`${tag}: ${declaration}`);
    }
  }
  if (/<style[\s>]/i.test(html)) found.push('<style> block');
  return found;
}
