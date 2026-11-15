import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseColorTokens, deriveHover, oklchToLinearSrgb, contrast } from '../helpers/color.js';

const readme = readFileSync('README.md', 'utf8');
const dist = readFileSync('dist/barely.css', 'utf8');
const tokensCss = readFileSync('src/tokens.css', 'utf8');

const SNIPPET = `<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/barely-css@1/dist/barely.min.css"
/>`;

function section(heading) {
  const m = readme.match(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (!m) throw new Error(`no "## ${heading}" heading`);
  const rest = readme.slice(m.index + m[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

test('installation opens with the CDN link tag', () => {
  const block = section('Installation').match(/```html\n([\s\S]*?)```/);
  expect(block, 'first html block in Installation').not.toBeNull();
  expect(block[1].trim()).toBe(SNIPPET);
  // It is the first code block of any kind.
  expect(section('Installation').indexOf('```')).toBe(section('Installation').indexOf('```html'));
});

test('CDN section shows major and exact-version links', () => {
  const cdn = section('CDN versions and integrity');
  expect(cdn).toContain('https://cdn.jsdelivr.net/npm/barely-css@1/dist/barely.min.css');
  expect(cdn).toMatch(/https:\/\/cdn\.jsdelivr\.net\/npm\/barely-css@\d+\.\d+\.\d+\/dist\/barely\.min\.css/);
});

test('exact-version link has an integrity attribute', () => {
  const cdn = section('CDN versions and integrity');
  expect(cdn).toMatch(/integrity="sha384-[A-Za-z0-9+/]{64}"/);
  expect(cdn).toMatch(/crossorigin="anonymous"/);
});

test('documents every token', () => {
  const declared = new Set(tokensCss.match(/--barely-[\w-]+/g));
  declared.add('--barely-color-primary-hover');
  declared.add('--barely-control-background');
  const reference = section('Tokens');
  for (const name of declared) expect(reference, name).toContain(`\`${name}\``);
});

test('support statement matches features used', () => {
  const features = [
    { name: 'cascade layers', readme: /cascade layers/, src: /@layer/ },
    { name: 'nesting', readme: /nesting/, src: /&/ },
    { name: ':has()', readme: /:has\(\)/, src: /:has\(/ },
    { name: 'light-dark()', readme: /light-dark\(\)/, src: /light-dark\(/ },
    { name: 'relative color', readme: /relative color/, src: /oklch\(from/ },
    { name: ':user-invalid', readme: /:user-invalid/, src: /:user-invalid/ },
  ];
  const support = section('Browser support');
  for (const f of features) {
    expect(f.readme.test(support), f.name).toBe(f.src.test(dist));
  }
});

test('customization example passes the contrast matrix', () => {
  const custom = section('Customizing');
  const block = custom.match(/```css\n([\s\S]*?)```/)[1];
  const tokens = parseColorTokens(readFileSync('src/tokens.css', 'utf8'));
  const own = parseColorTokens(block);
  expect(own.has('primary')).toBe(true);
  const primary = own.get('primary');
  const lin = (lch) => oklchToLinearSrgb(lch);
  for (const theme of ['light', 'dark']) {
    const hover = deriveHover(primary[theme], theme);
    for (const bg of ['background', 'surface']) {
      const bgLin = lin(tokens.get(bg)[theme]);
      expect(contrast(lin(primary[theme]), bgLin), `primary on ${bg} ${theme}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(lin(hover), bgLin), `hover on ${bg} ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
    const onPrimary = lin(tokens.get('on-primary')[theme]);
    expect(contrast(onPrimary, lin(primary[theme])), `on-primary on primary ${theme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(onPrimary, lin(hover)), `on-primary on hover ${theme}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('warns against linking main', () => {
  expect(readme).toMatch(/Don't link to `main`/);
  expect(readme).not.toContain('cdn.jsdelivr.net/gh/');
});

test('exact-version integrity matches dist/barely.min.css once the version is released', () => {
  const cdn = section('CDN versions and integrity');
  const version = cdn.match(/barely-css@(\d+\.\d+\.\d+(?:-[\w.]+)?)\/dist\/barely\.min\.css"\n\s+integrity="sha384-([A-Za-z0-9+/=]+)"/);
  expect(version, 'exact-version snippet with integrity').not.toBeNull();
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (version[1] === pkg.version) {
    const digest = createHash('sha384').update(readFileSync('dist/barely.min.css')).digest('base64');
    expect(version[2]).toBe(digest);
  } else {
    expect(readme).toMatch(/The hash and version in the exact-version link above are placeholders until/);
  }
});

test('covers the settled behaviors', () => {
  expect(readme).toContain('<div role="region" tabindex="0"');
  expect(readme).toMatch(/Only a wide table without the wrapper can make the page scroll sideways/);
  expect(readme).toContain('aria-pressed="true"');
  expect(readme).toMatch(/iframe/);
  expect(readme).toContain('data-theme="custom"');
  expect(readme).toContain('docs/migrating/from-pico.md');
  expect(readme).not.toMatch(/\bnpm (publish|run|test)\b/);
});
