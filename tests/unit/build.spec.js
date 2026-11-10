import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { build, minify, SOURCES } from '../../scripts/build.js';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

test('unminified output starts with header comment then the layer statement', async () => {
  const { css } = await build();
  expect(css).toMatch(/^\/\*![^]*?\*\/\s*@layer reset, tokens, base, layout, components, utilities, overrides;/);
});

test('minified output keeps exactly one comment, the banner', async () => {
  const { min } = await build();
  expect(min.match(/\/\*/g)).toHaveLength(1);
  expect(min.startsWith(`/*! barely-css v${pkg.version} | MIT License */`)).toBe(true);
});

test('every source file except layers.css wraps its rules in its layer', async () => {
  for (const file of SOURCES) {
    if (file === 'src/layers.css') continue;
    const name = file.split('/').pop();
    const layer = name === 'reset.css' ? 'reset' : name === 'tokens.css' ? 'tokens' : 'base';
    expect(readFileSync(file, 'utf8'), file).toContain(`@layer ${layer} {`);
  }
});

test('build is deterministic', async () => {
  expect((await build()).css).toBe((await build()).css);
});

test('dist files are current with src', async () => {
  const { css, min } = await build();
  expect(readFileSync('dist/barely.css', 'utf8')).toBe(css);
  expect(readFileSync('dist/barely.min.css', 'utf8')).toBe(min);
});

test('minify keeps strings and data URIs intact', () => {
  const input = `a { background: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16'%3E%3C/svg%3E"); }`;
  expect(minify(input, '/*! b */')).toContain(`viewBox='0 0 16 16'`);
});
