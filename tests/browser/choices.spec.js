import { test, expect } from '@playwright/test';
import { distinctColorCount } from '../helpers/pixels.js';

const PAGE = '/tests/pages/choices.html';

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
});

/** Resolves a length expression to px, so nothing assumes 1rem = 16px. */
const px = (page, expr) =>
  page.evaluate((e) => {
    const probe = document.createElement('div');
    probe.style.blockSize = e;
    document.body.append(probe);
    const v = probe.getBoundingClientRect().height;
    probe.remove();
    return v;
  }, expr);

test('each choice row is at least 24px tall', async ({ page }) => {
  const heights = await page.locator('label:has(> input:is([type=checkbox], [type=radio]))').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height),
  );
  expect(heights.length).toBeGreaterThan(10);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(24);
});

test('wrapped label text aligns with text, not under the control', async ({ page }) => {
  const r = await page.locator('#wrap').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el.lastChild);
    const lefts = new Map();
    for (const rect of range.getClientRects()) lefts.set(Math.round(rect.top), Math.round(rect.left));
    const lines = [...lefts.entries()].sort((a, b) => a[0] - b[0]).map(([, left]) => left);
    return { lines, box: Math.round(el.querySelector('input').getBoundingClientRect().left) };
  });
  expect(r.lines.length).toBeGreaterThanOrEqual(2);
  expect(new Set(r.lines).size).toBe(1);
  expect(r.lines[0]).toBeGreaterThan(r.box + 10);
});

test('checked state does not shift the line', async ({ page }) => {
  const label = page.locator('#cb-unchecked');
  // Page coordinates: check() scrolls the element into view, which moves viewport coordinates.
  const box = () =>
    label.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, height: r.height };
    });
  const before = await box();
  await page.locator('#cb-off').check();
  const after = await box();
  // Firefox's scrollY rounding adds sub-pixel noise to top.
  expect(Math.abs(after.top - before.top)).toBeLessThan(0.1);
  expect(after.height).toBeCloseTo(before.height, 2);
});

test('switch knob mirrors in RTL', async ({ page }) => {
  const sign = (sel) =>
    page.locator(sel).evaluate((el) => {
      const t = getComputedStyle(el, '::before').translate;
      return Math.sign(parseFloat(t));
    });
  const ltr = await sign('#sw-on');
  const rtl = await sign('#rtl-sw');
  expect(ltr).toBe(1);
  expect(rtl).toBe(-1);
});

test('check mark, dash and dot render', async ({ page }) => {
  for (const id of ['cb-on', 'cb-indet', 'rd-on', 'sw-on']) {
    const png = await page.locator(`#${id}`).screenshot();
    // inset 5 samples only the interior: the corners and antialiased edge show the page behind the control.
    expect(distinctColorCount(png, { inset: 5 }), id).toBeGreaterThanOrEqual(2);
  }
});

test('switch knob transition only runs when motion is allowed', async ({ page }) => {
  const knob = () => page.locator('#sw-off').evaluate((el) => getComputedStyle(el, '::before').transitionDuration);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await knob()).not.toBe('0s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await knob()).toBe('0s');
});

test.describe('spacing', () => {
  test('choice label directly in a form gets the form gap below', async ({ page }) => {
    const gap = await px(page, 'var(--barely-form-gap)');
    const a = await page.locator('#loose-a').boundingBox();
    const b = await page.locator('#loose-b').boundingBox();
    expect(b.y - (a.y + a.height)).toBeCloseTo(gap, 0);
  });

  test('inside a fieldset, choice rows sit 0.5rem apart', async ({ page }) => {
    const half = await px(page, '0.5rem');
    const a = await page.locator('#oc-a').boundingBox();
    const b = await page.locator('#oc-b').boundingBox();
    expect(b.y - (a.y + a.height)).toBeCloseTo(half, 0);
  });

  test('a text field after a choice row is a full form gap away', async ({ page }) => {
    const gap = await px(page, 'var(--barely-form-gap)');
    const b = await page.locator('#mx-b').boundingBox();
    const t = await page.locator('#mx-text').boundingBox();
    expect(t.y - (b.y + b.height)).toBeCloseTo(gap, 0);
    // Text field to text field is unchanged: the same total gap.
    const t1 = await page.locator('#mx-text').boundingBox();
    const t2 = await page.locator('#mx-text2').boundingBox();
    expect(t2.y - (t1.y + t1.height)).toBeCloseTo(gap, 0);
  });
});

test.describe('unwrapped choices', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  for (const dir of ['ltr', 'rtl']) {
    test(`checkbox, radio and switch sit inside the content edge with their label on the same line (${dir})`, async ({ page }) => {
      const r = await page.evaluate((d) => {
        document.documentElement.dir = d;
        const host = document.createElement('div');
        host.id = 'unwrapped-host';
        host.innerHTML =
          '<input type="checkbox" id="u-cb"><label for="u-cb" id="u-cb-l">Checkbox</label>' +
          '<input type="radio" id="u-rd" name="u"><label for="u-rd" id="u-rd-l">Radio</label>' +
          '<input type="checkbox" role="switch" id="u-sw"><label for="u-sw" id="u-sw-l">Switch</label>';
        document.querySelector('main').append(host);
        const hostBox = host.getBoundingClientRect();
        const out = { start: d === 'ltr' ? hostBox.left : hostBox.right, items: [] };
        for (const id of ['u-cb', 'u-rd', 'u-sw']) {
          const i = document.getElementById(id).getBoundingClientRect();
          const l = document.getElementById(`${id}-l`).getBoundingClientRect();
          out.items.push({ id, inputStart: d === 'ltr' ? i.left : i.right, inputTop: i.top, inputBottom: i.bottom, labelTop: l.top, labelBottom: l.bottom });
        }
        return out;
      }, dir);
      for (const it of r.items) {
        if (dir === 'ltr') expect(it.inputStart, it.id).toBeGreaterThanOrEqual(r.start - 0.5);
        else expect(it.inputStart, it.id).toBeLessThanOrEqual(r.start + 0.5);
        // Same line: the label's box overlaps the control's box vertically.
        expect(Math.min(it.inputBottom, it.labelBottom) - Math.max(it.inputTop, it.labelTop), it.id).toBeGreaterThan(0);
      }
    });
  }
});
