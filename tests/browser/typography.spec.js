import { test, expect } from '@playwright/test';
import { DEMO, setTheme } from '../helpers/env.js';
import { paintedRgba, effectiveBackground } from '../helpers/page-color.js';
import { srgb8ToLinear, contrast } from '../helpers/color.js';

const HOVER =
  'var(--barely-color-primary-hover, light-dark(oklch(from var(--barely-color-primary) calc(l - 0.07) c h), oklch(from var(--barely-color-primary) calc(l + 0.07) c h)))';

test('heading sizes come from tokens', async ({ page }) => {
  await page.goto(DEMO);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--barely-font-size-h1', '48px');
    const article = document.createElement('article');
    article.id = 'probe-article';
    article.style.setProperty('--barely-font-size-h1', '48px');
    article.innerHTML = '<h1>Nested</h1>';
    document.body.append(article);
  });
  const sizes = await page.evaluate(() => [
    getComputedStyle(document.querySelector('main h1')).fontSize,
    getComputedStyle(document.querySelector('#probe-article h1')).fontSize,
  ]);
  expect(sizes).toEqual(['48px', '48px']);
});

test.describe('wide heading scale', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('heading steps are at least 1.2x on wide screens', async ({ page }) => {
    await page.goto(DEMO);
    const sizes = await page.evaluate(() =>
      ['h1', 'h2', 'h3', 'h4', 'h5'].map((t) => parseFloat(getComputedStyle(document.querySelector(`main ${t}`)).fontSize)),
    );
    for (let i = 0; i < 4; i++) expect(sizes[i] / sizes[i + 1], `h${i + 1}/h${i + 2} (${sizes})`).toBeGreaterThanOrEqual(1.2);
  });
});

test('body line height is 1.6 and headings 1.2', async ({ page }) => {
  await page.goto(DEMO);
  const r = await page.evaluate(() => {
    const ratio = (el) => {
      const s = getComputedStyle(el);
      return parseFloat(s.lineHeight) / parseFloat(s.fontSize);
    };
    return [ratio(document.querySelector('#typography p')), ratio(document.querySelector('#typography h2'))];
  });
  expect(r[0]).toBeCloseTo(1.6, 2);
  expect(r[1]).toBeCloseTo(1.2, 2);
});

test('links are underlined and use primary', async ({ page }) => {
  await page.goto(DEMO);
  const link = page.locator('#typography p a').first();
  expect(await link.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('underline');
  await page.evaluate(() => {
    const el = document.createElement('span');
    el.id = 'probe-primary';
    el.style.color = 'var(--barely-color-primary)';
    document.body.append(el);
  });
  expect(await paintedRgba(link, 'color')).toEqual(await paintedRgba(page.locator('#probe-primary'), 'color'));
});

for (const theme of ['light', 'dark']) {
  test(`link hover uses derived hover (${theme})`, async ({ page }) => {
    await page.goto(DEMO);
    await setTheme(page, theme);
    await page.evaluate((hover) => {
      const el = document.createElement('span');
      el.id = 'probe-hover';
      el.style.color = hover;
      document.body.append(el);
    }, HOVER);
    const link = page.locator('#typography p a').first();
    const before = await paintedRgba(link, 'color');
    await link.hover();
    const after = await paintedRgba(link, 'color');
    expect(after).toEqual(await paintedRgba(page.locator('#probe-hover'), 'color'));
    expect(after).not.toEqual(before);
  });

  test(`mark text meets 4.5:1 (${theme})`, async ({ page }) => {
    await page.goto(DEMO);
    await setTheme(page, theme);
    const mark = page.locator('#typography mark').first();
    const [r, g, b] = await paintedRgba(mark, 'color');
    const bg = await effectiveBackground(mark);
    expect(contrast(srgb8ToLinear([r, g, b]), srgb8ToLinear(bg))).toBeGreaterThanOrEqual(4.5);
  });
}

test('no Times, Arial or Helvetica in any text element font-family', async ({ page }) => {
  await page.goto(DEMO);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.matches('script, style')) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const ff = getComputedStyle(el).fontFamily;
      if (hasText && /times|arial|helvetica/i.test(ff)) out.push(`${el.localName}: ${ff}`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test('first heading in a region has no top margin', async ({ page }) => {
  await page.goto(DEMO);
  const m = await page.evaluate(() => {
    const first = document.querySelector('#typography > h2');
    const later = document.querySelector('#typography h3');
    return [getComputedStyle(first).marginBlockStart, getComputedStyle(later).marginBlockStart];
  });
  expect(m[0]).toBe('0px');
  expect(parseFloat(m[1])).toBeGreaterThan(0);
});
