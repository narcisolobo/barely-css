import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
const guide = read('docs/migrating/from-pico.md');
const releasing = read('docs/releasing.md');
const readme = readFileSync('README.md', 'utf8');
const spec = readFileSync('docs/superpowers/specs/2026-11-09-barely-css-design.md', 'utf8');
const tokensCss = readFileSync('src/tokens.css', 'utf8');

// Tokens that are not declared on :root, on purpose. README documents them.
const USE_SITE_TOKENS = ['--barely-color-primary-hover', '--barely-control-background'];

function headings(md) {
  return [...md.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim());
}

function sectionOf(md, heading) {
  const m = md.match(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (!m) return '';
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

test('Pico guide has the five sections', () => {
  expect(guide, 'docs/migrating/from-pico.md exists').not.toBe('');
  const found = headings(guide);
  for (const h of [
    'Wrappers can be removed',
    'What works the same',
    'What differs',
    'Variable mapping',
    'Not supported yet',
  ]) {
    expect(found, h).toContain(h);
  }
});

test('every barely token in the mapping exists', () => {
  const mapping = sectionOf(guide, 'Variable mapping');
  expect(mapping).not.toBe('');
  const named = new Set(mapping.match(/--barely-[a-z0-9-]+/g) ?? []);
  expect(named.size).toBeGreaterThan(10);
  for (const token of named) {
    const declared = new RegExp(`^\\s*${token}:`, 'm').test(tokensCss);
    expect(declared || USE_SITE_TOKENS.includes(token), token).toBe(true);
  }
});

test('every Pico variable is mapped or marked "no equivalent"', () => {
  const mapping = sectionOf(guide, 'Variable mapping');
  const rows = mapping.split('\n').filter((l) => /^\|\s*`--pico-/.test(l));
  expect(rows.length).toBe(28);
  for (const row of rows) {
    expect(row, row).toMatch(/--barely-[a-z0-9-]+|no equivalent/i);
  }
});

test('README links the guide and the changelog', () => {
  expect(readme).toContain('(docs/migrating/from-pico.md)');
  expect(readme).toContain('(CHANGELOG.md)');
  expect(readme).toContain('(docs/releasing.md)');
});

test('README says plainly what scrolls sideways', () => {
  expect(readme).not.toMatch(/only place the page may scroll sideways/);
  expect(readme).toMatch(/Nothing else makes the page scroll sideways/);
  expect(readme).toMatch(/`pre` blocks and the table wrapper scroll inside themselves/);
  expect(readme).toContain('Table readability takes precedence over viewport containment.');
});

test('releasing.md lists every release criterion', () => {
  const m = spec.match(/^## Release criteria\s*$([\s\S]*?)^## /m);
  expect(m, 'spec has a Release criteria section').not.toBeNull();
  const bullets = m[1].split('\n').filter((l) => l.startsWith('- '));
  expect(bullets.length).toBe(8);

  const block = sectionOf(releasing, 'Release criteria');
  expect(block, 'releasing.md has a "Release criteria" section').not.toBe('');
  const boxes = block.split('\n').filter((l) => /^- \[ \] /.test(l));
  expect(boxes.length).toBe(8);
});

test('releasing.md covers the manual checks and the extra steps', () => {
  expect(releasing).toMatch(/Option\+Tab/);
  expect(releasing).toMatch(/Contrast theme/i);
  expect(releasing).toMatch(/Firefox on macOS/);
  expect(releasing).toMatch(/course page/i);
  expect(releasing).toMatch(/10-course-page/);
  expect(releasing).toMatch(/integrity/);
  expect(releasing).toMatch(/pnpm visual/);
  expect(releasing).toMatch(/375/);
  expect(releasing).toMatch(/chore\(release\): x\.y\.z/);
});
