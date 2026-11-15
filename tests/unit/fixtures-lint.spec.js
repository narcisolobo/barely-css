import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { badInlineStyles, externalResources, parseTags, randomInScripts } from '../helpers/fixture-checks.js';

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
const EXPECTED = ALL_FIXTURES;
const OPENS_ON_LOAD = '07-dialog-popover.html';

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.html'))
  .sort()
  .map((name) => ({ name, html: readFileSync(`${DIR}/${name}`, 'utf8') }));


test('fixture list is complete', () => {
  expect(files.map((f) => f.name)).toEqual(EXPECTED);
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
    const withClass = parseTags(html).filter(({ attrs }) => 'class' in attrs).map((t) => t.tag);
    expect(withClass, name).toEqual([]);
  }
});

test('fixtures use no inline style except token overrides', () => {
  for (const { name, html } of files) expect(badInlineStyles(html), name).toEqual([]);
});

test('fixtures load no external resources', () => {
  for (const { name, html } of files) expect(externalResources(html), name).toEqual([]);
});

test('external-resource check is scoped to loading attributes', () => {
  // Text and links may mention URLs.
  expect(externalResources('<p>Call <code>https://api.example.com/v1</code></p><pre>fetch("https://x.org")</pre>')).toEqual([]);
  expect(externalResources('<a href="https://example.org">docs</a><form action="/local"></form>')).toEqual([]);
  expect(externalResources('<img src="assets/a.svg" srcset="assets/a.svg 1x, assets/b.svg 2x">')).toEqual([]);
  // Loading attributes may not, in any quoting.
  expect(externalResources('<img srcset="https://x/y.png 2x">')).toHaveLength(1);
  expect(externalResources('<img srcset="assets/a.png 1x, https://x/y.png 2x">')).toHaveLength(1);
  expect(externalResources("<img src='https://x/y.png'>")).toHaveLength(1);
  expect(externalResources('<img src=//x/y.png>')).toHaveLength(1);
  expect(externalResources('<link rel="stylesheet" href="https://x/y.css">')).toHaveLength(1);
  expect(externalResources('<video poster="https://x/p.png"></video>')).toHaveLength(1);
  expect(externalResources('<iframe src="https://x"></iframe>')).toHaveLength(1);
  expect(externalResources('<object data="https://x/y.pdf"></object>')).toHaveLength(1);
  expect(externalResources('<div style="background:url(https://x/y.png)"></div>')).toHaveLength(1);
  expect(externalResources('<style>p{background:url(a.png)}</style>')).toHaveLength(1);
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
    expect(randomInScripts(html), name).toEqual([]);
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

test('date and random check only looks inside scripts', () => {
  expect(randomInScripts('<p>We use Date.now and Math.random in the examples, dated 3 May 2026.</p>')).toEqual([]);
  expect(randomInScripts('<script>const t = Date.now();</script>')).toHaveLength(1);
});
