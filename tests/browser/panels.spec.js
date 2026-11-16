import { test, expect } from '@playwright/test';

const PAGE = '/tests/pages/panels.html';

const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }, sel);

const style = (page, sel, prop) =>
  page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(PAGE);
});

test.describe('nested theme scope', () => {
  test('a block scope insets its content from its painted edge', async ({ page }) => {
    for (const sel of ['#dark-panel', '#custom-panel']) {
      const panel = await rect(page, sel);
      const first = await rect(page, `${sel} > :first-child`);
      const last = await rect(page, `${sel} > :last-child`);
      expect(first.left - panel.left, `${sel} start`).toBeGreaterThanOrEqual(16);
      expect(first.top - panel.top, `${sel} top`).toBeGreaterThanOrEqual(16);
      expect(panel.bottom - last.bottom, `${sel} bottom`).toBeGreaterThanOrEqual(16);
    }
  });

  test('a scope on an inline element or a button gets no padding', async ({ page }) => {
    expect(await style(page, '#inline-scope', 'paddingLeft')).toBe('0px');
    expect(await style(page, '#scoped-button', 'paddingLeft')).toBe(await style(page, '#plain-button', 'paddingLeft'));
  });

  test('a scope directly in body keeps the same region padding as a plain section', async ({ page }) => {
    for (const prop of ['paddingLeft', 'paddingTop']) {
      expect(await style(page, '#region-panel', prop), prop).toBe(await style(page, '#region-plain', prop));
    }
  });

  test('a button after a bare labelled field does not touch the field', async ({ page }) => {
    const input = await rect(page, '#panel-name');
    const button = await rect(page, '#panel-button-row button');
    expect(button.top - input.bottom).toBeGreaterThanOrEqual(8);
  });
});

test.describe('aside headings', () => {
  const size = async (page, sel) => parseFloat(await style(page, sel, 'fontSize'));

  test('an aside heading steps down two levels, to h6 at the smallest', async ({ page }) => {
    const expected = { h1: 'h3', h2: 'h4', h3: 'h5', h4: 'h6', h5: 'h6', h6: 'h6' };
    for (const [level, as] of Object.entries(expected)) {
      expect(await size(page, `#aside-levels ${level}`), level).toBe(await size(page, `#levels ${as}`));
    }
  });

  test('an aside heading is smaller than the same heading in the page', async ({ page }) => {
    expect(await size(page, '#toc h2')).toBeLessThan(await size(page, '#levels h2'));
  });

  test('an aside directly in body steps down too', async ({ page }) => {
    expect(await size(page, '#region-aside h2')).toBe(await size(page, '#levels h4'));
  });

  test('the first heading in an aside has no top margin', async ({ page }) => {
    expect(await style(page, '#toc h2', 'marginTop')).toBe('0px');
  });
});
