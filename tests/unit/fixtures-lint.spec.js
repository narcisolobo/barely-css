import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const DIR = 'tests/fixtures';
const ALL_FIXTURES = [
  '01-typography.html',
  '02-article.html',
  '03-docs.html',
  '04-form.html',
  '05-table.html',
  '06-page-structure.html',
  '07-dialog-popover.html',
  '08-nested-themes.html',
  '09-rtl.html',
  '10-course-page.html',
];
// Fixture 10 is a sanitized owner page that has not been supplied yet. Remove this
// filter, and the fixme below, when the file lands.
const PENDING = ['10-course-page.html'];
const EXPECTED = ALL_FIXTURES.filter((name) => !PENDING.includes(name));
const OPENS_ON_LOAD = '07-dialog-popover.html';

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.html'))
  .sort()
  .map((name) => ({ name, html: readFileSync(`${DIR}/${name}`, 'utf8') }));

/** The text of every opening tag, so attribute checks ignore prose. */
const tags = (html) => html.match(/<[a-zA-Z][^>]*>/g) ?? [];

test('fixture list is complete', () => {
  expect(files.map((f) => f.name)).toEqual(EXPECTED);
});

test.fixme('fixture 10 (owner course page) exists', () => {
  expect(existsSync(`${DIR}/10-course-page.html`)).toBe(true);
});

test('fixtures link the stylesheet the runner intercepts', () => {
  for (const { name, html } of files) {
    expect(html, name).toContain('<link rel="stylesheet" href="../../dist/barely.css">');
  }
});

test('fixtures use no class attributes', () => {
  // The scroll wrapper is div[role="region"][tabindex][aria-label]; it carries no class either,
  // so the rule has no exception.
  for (const { name, html } of files) {
    const withClass = tags(html).filter((tag) => /\sclass\s*=/i.test(tag));
    expect(withClass, name).toEqual([]);
  }
});

test('fixtures use no inline style except token overrides', () => {
  for (const { name, html } of files) {
    for (const tag of tags(html)) {
      const style = tag.match(/\sstyle\s*=\s*"([^"]*)"/i);
      if (!style) continue;
      const declarations = style[1].split(';').map((d) => d.trim()).filter(Boolean);
      for (const declaration of declarations) {
        expect(declaration, `${name}: ${tag}`).toMatch(/^--barely-[\w-]+\s*:/);
      }
    }
    expect(html, name).not.toMatch(/<style[\s>]/i);
  }
});

test('fixtures load no external resources', () => {
  for (const { name, html } of files) {
    expect(html, name).not.toMatch(/https?:\/\//i);
    expect(html, name).not.toMatch(/(?:src|href|srcset|poster)\s*=\s*["']?\s*\/\//i);
    expect(html, name).not.toMatch(/url\(/i);
    for (const tag of tags(html)) {
      const ref = tag.match(/\s(?:src|href)\s*=\s*"([^"]*)"/i);
      if (ref && /^<(link|script|img|iframe|source|video|audio|track)\b/i.test(tag)) {
        expect(ref[1], `${name}: ${tag}`).toMatch(/^(\.\.\/\.\.\/dist\/|assets\/)/);
      }
    }
  }
});

test('local assets referenced by fixtures exist', () => {
  for (const { name, html } of files) {
    for (const [, path] of html.matchAll(/\ssrc\s*=\s*"(assets\/[^"]+)"/g)) {
      expect(existsSync(`${DIR}/${path}`), `${name}: ${path}`).toBe(true);
    }
  }
});

test('fixtures contain no dates or random values', () => {
  for (const { name, html } of files) {
    expect(html, name).not.toMatch(/new Date|Date\.now|Math\.random|crypto\.|performance\.now/);
    const scripts = [...html.matchAll(/<script\b[^>]*>([^]*?)<\/script>/gi)];
    if (name !== OPENS_ON_LOAD) {
      expect(scripts.length, `${name} has a script`).toBe(0);
      expect(html, name).not.toMatch(/<script/i);
      continue;
    }
    // Fixture 7 may hold one single-line script, and it may only open the dialog and popover.
    expect(scripts.length, name).toBe(1);
    const body = scripts[0][1];
    expect(body.trim().split('\n').length, 'one line').toBe(1);
    const statements = body.split(';').map((s) => s.trim()).filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(/^document\.querySelector\('[^']+'\)\.(showModal|showPopover)\(\)$/);
    }
    expect(body).toContain('showModal()');
    expect(body).toContain('showPopover()');
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
  }
});

test('fixtures have a language, a title and a viewport', () => {
  for (const { name, html } of files) {
    expect(html, name).toMatch(/<html[^>]*\slang="[a-z-]+"/);
    expect(html, name).toMatch(/<title>[^<]+<\/title>/);
    expect(html, name).toContain('name="viewport"');
  }
  const rtl = files.find((f) => f.name === '09-rtl.html');
  if (rtl) expect(rtl.html).toMatch(/<html[^>]*\sdir="rtl"[^>]*\slang="ar"|<html[^>]*\slang="ar"[^>]*\sdir="rtl"/);
});
