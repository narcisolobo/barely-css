import { test, expect } from '@playwright/test';
import { distinctColorCount } from '../helpers/pixels.js';

const PAGE = '/tests/pages/fieldset.html';

const style = (page, sel, prop) =>
  page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);

const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY, height: r.height };
  }, sel);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PAGE);
});

test('a fieldset draws a top rule only, in the border color', async ({ page }) => {
  for (const sel of ['#first', '#alone']) {
    expect(await style(page, sel, 'borderTopStyle'), sel).toBe('solid');
    expect(await style(page, sel, 'borderTopWidth'), sel).toBe('1px');
    for (const side of ['Right', 'Bottom', 'Left']) {
      expect(await style(page, sel, `border${side}Width`), `${sel} ${side}`).toBe('0px');
    }
  }
  const expected = await page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.borderTop = '1px solid var(--barely-color-border)';
    document.body.append(probe);
    const c = getComputedStyle(probe).borderTopColor;
    probe.remove();
    return c;
  });
  expect(await style(page, '#first', 'borderTopColor')).toBe(expected);
});

test('the rule runs beside the legend at its height, not above it', async ({ page }) => {
  // A pixel column near the far end of the fieldset, as tall as the legend, must hold the rule. When the legend is
  // the fieldset's rendered legend, the browser draws the top border through its vertical middle and leaves a gap
  // for the legend itself. A rule above the legend would leave this column empty.
  for (const sel of ['#first', '#second', '#alone']) {
    const fs = await rect(page, sel);
    const legend = await rect(page, `${sel} > legend`);
    const shot = await page.screenshot({
      fullPage: true,
      clip: { x: fs.right - 24, y: legend.top, width: 12, height: legend.height },
    });
    expect(distinctColorCount(shot), sel).toBeGreaterThanOrEqual(2);
  }
});

test('a legend reads as a group heading: heading weight, larger than a label', async ({ page }) => {
  const heading = await style(page, '#heading', 'fontWeight');
  const label = parseFloat(await style(page, '#plain-label', 'fontSize'));
  for (const sel of ['#first > legend', '#second > legend', '#alone > legend']) {
    expect(await style(page, sel, 'fontWeight'), sel).toBe(heading);
    expect(parseFloat(await style(page, sel, 'fontSize')), sel).toBeGreaterThan(label);
  }
});

test('the rule starts after the legend, with a gap that mirrors in right-to-left text', async ({ page }) => {
  expect(await style(page, '#first > legend', 'paddingLeft')).toBe('0px');
  expect(parseFloat(await style(page, '#first > legend', 'paddingRight'))).toBeGreaterThan(0);
  expect(await style(page, '#rtl > legend', 'paddingRight')).toBe('0px');
  expect(parseFloat(await style(page, '#rtl > legend', 'paddingLeft'))).toBeGreaterThan(0);
});

test('a legend outside a fieldset is left alone', async ({ page }) => {
  const heading = await style(page, '#heading', 'fontWeight');
  expect(await style(page, '#stray-legend', 'fontWeight')).not.toBe(heading);
  expect(await style(page, '#stray-legend', 'paddingRight')).not.toBe(await style(page, '#first > legend', 'paddingRight'));
});

test('a fieldset after other content has space above it; the first in a form does not', async ({ page }) => {
  expect(parseFloat(await style(page, '#first', 'marginTop'))).toBeGreaterThanOrEqual(16);
  expect(parseFloat(await style(page, '#second', 'marginTop'))).toBeGreaterThanOrEqual(16);
  expect(await style(page, '#lead', 'marginTop')).toBe('0px');
});
