import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SOURCES } from '../../scripts/build.js';
import { findBareTransitions } from '../helpers/lint.js';

const USE_SITE = ['--barely-color-primary-hover', '--barely-control-background'];

/** Source with comments removed and url(...) contents emptied. */
function clean(css) {
  return css
    .replace(/\/\*[^]*?\*\//g, ' ')
    .replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'url()');
}
const files = SOURCES.map((path) => ({ path, css: clean(readFileSync(path, 'utf8')) }));
const isTokens = (f) => f.path === 'src/tokens.css';
const others = files.filter((f) => !isTokens(f));
const DECL = /(--barely-[\w-]+)\s*:/g;

test('no token value on :root contains var()', () => {
  const tokens = files.find(isTokens);
  const bad = [];
  for (const m of tokens.css.matchAll(/(--barely-[\w-]+)\s*:([^;{}]*)[;}]/g))
    if (m[2].includes('var(')) bad.push(m[1]);
  expect(bad).toEqual([]);
});

test('--barely-* tokens are declared only in tokens.css', () => {
  const bad = others.flatMap((f) => [...f.css.matchAll(DECL)].map((m) => `${f.path}: ${m[1]}`));
  expect(bad).toEqual([]);
});

test('every var(--barely-*) used resolves to a declared token or a use-site token', () => {
  const declared = new Set([...files.find(isTokens).css.matchAll(DECL)].map((m) => m[1]));
  expect(declared.size).toBeGreaterThan(0);
  const bad = [];
  for (const f of files)
    for (const m of f.css.matchAll(/var\(\s*(--barely-[\w-]+)/g))
      if (!declared.has(m[1]) && !USE_SITE.includes(m[1])) bad.push(`${f.path}: ${m[1]}`);
  expect(bad).toEqual([]);
});

test('no color literals outside tokens.css', () => {
  const bad = [];
  for (const f of others) {
    for (const m of f.css.matchAll(/#[0-9a-f]{3,8}\b/gi)) bad.push(`${f.path}: ${m[0]}`);
    for (const m of f.css.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab)\(/gi)) bad.push(`${f.path}: ${m[0]}`);
    for (const m of f.css.matchAll(/oklch\(\s*(?!from\s+var\(--barely-)/gi)) bad.push(`${f.path}: oklch(`);
  }
  expect(bad).toEqual([]);
});

test('logical properties only', () => {
  const rules = [
    /(^|[;{\s])(min-|max-)?(width|height)\s*:/,
    /\b(margin|padding|border)-(top|right|bottom|left)\b/,
    /(^|[;{\s])(top|right|bottom|left)\s*:/,
    /text-align:\s*(left|right)/,
    /float:\s*(left|right)/,
  ];
  const bad = [];
  for (const f of files)
    for (const re of rules) {
      const m = f.css.match(re);
      if (m) bad.push(`${f.path}: ${m[0].trim()}`);
    }
  expect(bad).toEqual([]);
});

test('transitions only under reduced-motion no-preference', () => {
  const bad = files.flatMap((f) => findBareTransitions(f.css).map((t) => `${f.path}: ${t}`));
  expect(bad).toEqual([]);
});

test('transition check accepts a transition first in a nested no-preference media block', () => {
  const css = 'a { @media (prefers-reduced-motion: no-preference) { transition: color 0.2s; } }';
  expect(findBareTransitions(css)).toEqual([]);
});

test('transition check rejects a transition outside any media query', () => {
  expect(findBareTransitions('a { color: red; transition: color 0.2s; }')).toHaveLength(1);
  expect(findBareTransitions('a { transition: color 0.2s; }')).toHaveLength(1);
});

test('outline is never removed', () => {
  const bad = [];
  for (const f of files)
    for (const re of [/outline:\s*(none|0)\b/, /outline-style:\s*none/]) {
      const m = f.css.match(re);
      if (m) bad.push(`${f.path}: ${m[0]}`);
    }
  expect(bad).toEqual([]);
});
