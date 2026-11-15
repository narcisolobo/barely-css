import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

test('exports, style and files point to existing dist files', () => {
  expect(pkg.private).toBeUndefined();
  expect(pkg.style).toBe('dist/barely.css');
  expect(pkg.exports['.']).toBe('./dist/barely.css');
  expect(pkg.exports['./barely.css']).toBe('./dist/barely.css');
  expect(pkg.exports['./barely.min.css']).toBe('./dist/barely.min.css');
  expect(pkg.exports['./package.json']).toBe('./package.json');
  for (const target of Object.values(pkg.exports)) expect(existsSync(target), target).toBe(true);
  expect(existsSync(pkg.style)).toBe(true);
  expect(pkg.files).toEqual(['dist', 'README.md', 'CHANGELOG.md', 'LICENSE']);
  for (const f of pkg.files) expect(existsSync(f), f).toBe(true);
});

test('repository, homepage and bugs point at the GitHub repository', () => {
  const base = 'github.com/narcisolobo/barely-css';
  expect(JSON.stringify(pkg.repository)).toContain(base);
  expect(pkg.homepage).toContain(base);
  expect(JSON.stringify(pkg.bugs)).toContain(base);
});

test('version is unchanged by this task', () => {
  expect(pkg.version).toBe('0.0.0');
});

test('license file is MIT', () => {
  expect(pkg.license).toBe('MIT');
  const text = readFileSync('LICENSE', 'utf8');
  expect(text).toContain('MIT License');
  expect(text).toContain('Copyright (c) 2026 Narciso Lobo');
});
