import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';
import { paintedRgba } from '../helpers/page-color.js';

const PAGE = '/tests/pages/forms.html';

/** Resolved --barely-control-height in px, so nothing here assumes 1rem = 16px. */
const controlHeight = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.blockSize = 'var(--barely-control-height)';
    document.body.append(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  });

test.describe('labels', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('labels are display block', async ({ page }) => {
    await page.goto(DEMO);
    const displays = await page.locator('#forms label').evaluateAll((els) => els.map((el) => getComputedStyle(el).display));
    expect(displays.length).toBeGreaterThan(10);
    for (const d of displays) expect(d).toBe('block');
  });

  test('label with inline abbr stays on one line', async ({ page }) => {
    await page.goto(PAGE);
    const r = await page.locator('#abbr-label').evaluate((el) => {
      const range = document.createRange();
      range.setStart(el.firstChild, 0);
      range.setEnd(el.querySelector('abbr').nextSibling, el.querySelector('abbr').nextSibling.length);
      const rects = [...range.getClientRects()];
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      return { height: range.getBoundingClientRect().height, lineHeight, tops: new Set(rects.map((x) => Math.round(x.top))).size };
    });
    expect(r.tops).toBe(1);
    expect(r.height).toBeLessThanOrEqual(r.lineHeight + 1);
  });

  test('control in a stretched label keeps its height', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto(PAGE);
    const r = await page.evaluate(() => ({
      tall: document.querySelector('#tall').getBoundingClientRect().height,
      short: document.querySelector('#short').getBoundingClientRect().height,
      input: document.querySelector('#short-input').getBoundingClientRect().height,
    }));
    // The short label really is stretched past its own content, yet its input stays at control height.
    const natural = await page.evaluate(() => {
      const el = document.querySelector('#short');
      el.style.alignSelf = 'flex-start';
      const h = el.getBoundingClientRect().height;
      el.style.alignSelf = '';
      return h;
    });
    expect(r.short).toBeGreaterThan(natural + 5);
    expect(r.input).toBeCloseTo(await controlHeight(page), 0);
  });
});

test.describe('controls', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('unknown input type gets text styling', async ({ page }) => {
    await page.goto(PAGE);
    const [future, plain] = await Promise.all(
      ['#future', '#plain'].map((s) =>
        page.locator(s).evaluate((el) => {
          const c = getComputedStyle(el);
          return { border: c.borderTopWidth + c.borderTopStyle + c.borderTopColor, min: c.minBlockSize, h: el.getBoundingClientRect().height };
        }),
      ),
    );
    expect(future).toEqual(plain);
    expect(future.border).toMatch(/^1pxsolid/);
    expect(future.h).toBeCloseTo(await controlHeight(page), 0);
  });

  test('controls grow at 200% zoom', async ({ page }) => {
    await page.goto(PAGE);
    const base = await controlHeight(page);
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    const sizes = await page.evaluate(() => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const one = (s) => {
        const el = document.querySelector(s);
        return { h: el.getBoundingClientRect().height, clipped: el.scrollHeight > el.clientHeight };
      };
      return { rem, plain: one('#plain'), future: one('#future'), button: one('#row-button') };
    });
    const resolved = await controlHeight(page);
    // 2.75rem at the doubled root size; compare with the resolved token, not with 88px.
    expect(resolved).toBeCloseTo(2.75 * sizes.rem, 0);
    expect(resolved).toBeGreaterThan(base);
    for (const k of ['plain', 'future', 'button']) {
      expect(sizes[k].h, k).toBeGreaterThanOrEqual(resolved - 0.5);
      expect(sizes[k].clipped, k).toBe(false);
    }
  });

  test('buttons line up with inputs', async ({ page }) => {
    await page.goto(PAGE);
    const h = await page.evaluate(() => ['#row-input', '#row-button', '#row-reset'].map((s) => document.querySelector(s).getBoundingClientRect().height));
    expect(h[1]).toBeCloseTo(h[0], 0);
    expect(h[2]).toBeCloseTo(h[0], 0);
    expect(h[0]).toBeCloseTo(await controlHeight(page), 0);
  });

  test('reset is secondary', async ({ page }) => {
    await page.goto(PAGE);
    const reset = await paintedRgba(page.locator('#row-reset'), 'backgroundColor');
    const button = await paintedRgba(page.locator('#row-button'), 'backgroundColor');
    const surface = await page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.backgroundColor = 'var(--barely-color-surface)';
      document.body.append(probe);
      const css = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    });
    expect(reset).toEqual(surface);
    expect(button).not.toEqual(surface);
  });

  test('primary button hover derives from the nearest primary', async ({ page }) => {
    await page.goto(PAGE);
    const button = page.locator('#row-button');
    const rest = await paintedRgba(button, 'backgroundColor');
    await button.hover();
    const hover = await paintedRgba(button, 'backgroundColor');
    expect(hover).not.toEqual(rest);
    await page.evaluate(() => document.querySelector('#row').style.setProperty('--barely-color-primary', 'rgb(200, 0, 0)'));
    await button.hover();
    const custom = await paintedRgba(button, 'backgroundColor');
    expect(custom[0]).toBeGreaterThan(custom[2]);
  });

  test('file selector button and placeholder take the library styles', async ({ page }) => {
    await page.goto('/demo/');
    const file = await page.locator('#f-file').evaluate((el) => getComputedStyle(el, '::file-selector-button').borderTopLeftRadius);
    const plain = await page.locator('#f-file').evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    // The button's radius is the control radius minus 0.125rem, the input's is the control radius.
    expect(parseFloat(file)).toBeLessThan(parseFloat(plain));
    const opacity = await page.locator('#f-email').evaluate((el) => getComputedStyle(el, '::placeholder').opacity);
    expect(opacity).toBe('1');
  });

  test('text labels in a fieldset are spaced like text labels outside one', async ({ page }) => {
    await page.goto(PAGE);
    const gaps = await page.evaluate(() => {
      const box = (id) => document.querySelector(id).getBoundingClientRect();
      return { outside: box('#out-b').top - box('#out-a').bottom, inside: box('#in-b').top - box('#in-a').bottom };
    });
    expect(gaps.outside).toBeGreaterThan(1);
    expect(gaps.inside).toBeCloseTo(gaps.outside, 1);
  });

  test('a label linked with for is spaced like a wrapping label, in a form and in a fieldset', async ({ page }) => {
    await page.goto(PAGE);
    const r = await page.evaluate(() => {
      const mk = (id, inner) => {
        const f = document.createElement('form');
        f.id = id;
        f.innerHTML = inner;
        document.querySelector('main').append(f);
        return f;
      };
      const wrapped = '<label>One<input type="text"></label><label>Two<input type="text"></label><label>Three<input type="text"></label>';
      const id0 = 'sib';
      const sibling = ['a', 'b', 'c'].map((k, i) => `<label for="${id0}-${k}">${['One', 'Two', 'Three'][i]}</label><input id="${id0}-${k}" type="text">`).join('');
      const measure = (form, sel) => {
        const labels = [...form.querySelectorAll(sel.label)];
        const inputs = [...form.querySelectorAll('input')];
        const lt = labels.map((l) => l.getBoundingClientRect().top);
        const it = inputs.map((i) => i.getBoundingClientRect());
        return {
          labelToField: it[0].top - lt[0],
          fieldToNext: lt[1] - it[0].bottom,
          fieldToNext2: lt[2] - it[1].bottom,
        };
      };
      const w = measure(mk('t-wrapped', wrapped), { label: 'label' });
      const sb = measure(mk('t-sibling', sibling), { label: 'label' });
      const wf = measure(mk('t-wrapped-fs', `<fieldset>${wrapped}</fieldset>`), { label: 'label' });
      const sf = measure(mk('t-sibling-fs', `<fieldset>${sibling.replaceAll('sib-', 'sibfs-')}</fieldset>`), { label: 'label' });
      // Django as_p: each label and control pair sits in its own paragraph.
      const dj = (k, wrap) => (wrap ? `<p><label>${k}<input type="text"></label></p>` : `<p><label for="dj-${k}">${k}</label><input id="dj-${k}" type="text"></p>`);
      const pm = (form) => {
        const ps = [...form.querySelectorAll('p')];
        const label = ps.map((p) => p.querySelector('label').getBoundingClientRect().top);
        const input = ps.map((p) => p.querySelector('input').getBoundingClientRect());
        return { labelToField: input[0].top - label[0], fieldToNext: label[1] - input[0].bottom };
      };
      const pw = pm(mk('t-p-wrapped', dj('One', true) + dj('Two', true)));
      const ps = pm(mk('t-p-sibling', dj('One', false) + dj('Two', false)));
      return { w, sb, wf, sf, pw, ps };
    });
    for (const k of ['labelToField', 'fieldToNext', 'fieldToNext2']) {
      expect(r.sb[k], `form ${k}`).toBeCloseTo(r.w[k], 0);
      expect(r.sf[k], `fieldset ${k}`).toBeCloseTo(r.wf[k], 0);
    }
    for (const k of ['labelToField', 'fieldToNext']) expect(r.ps[k], `p ${k}`).toBeCloseTo(r.pw[k], 0);
    expect(r.w.labelToField).toBeGreaterThan(10);
    expect(r.w.fieldToNext).toBeGreaterThan(1);
  });

  test('select chevron flips in RTL', async ({ page }) => {
    await page.goto(PAGE);
    const pos = (s) => page.locator(s).evaluate((el) => getComputedStyle(el).backgroundPositionX);
    const [ltr, rtl] = [await pos('#ltr-select'), await pos('#rtl-select')];
    expect(rtl).not.toBe(ltr);
  });

  test('textarea resizes vertically only, min 6.5rem', async ({ page }) => {
    await page.goto(PAGE);
    const r = await page.locator('#area').evaluate((el) => ({
      resize: getComputedStyle(el).resize,
      min: parseFloat(getComputedStyle(el).minBlockSize),
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
    }));
    expect(r.resize).toBe('vertical');
    expect(r.min).toBeCloseTo(6.5 * r.rem, 0);
  });

  test('control background follows --barely-control-background and --barely-color-background', async ({ page }) => {
    await page.goto(PAGE);
    const input = page.locator('#plain');
    const bg = () => paintedRgba(input, 'backgroundColor');
    const before = await bg();
    await page.evaluate(() => document.querySelector('form').style.setProperty('--barely-color-background', 'rgb(10, 200, 30)'));
    expect(await bg()).toEqual([10, 200, 30, 255]);
    await page.evaluate(() => document.querySelector('form').style.setProperty('--barely-control-background', 'rgb(1, 2, 3)'));
    expect(await bg()).toEqual([1, 2, 3, 255]);
    expect(before).not.toEqual([10, 200, 30, 255]);
  });
});

test('demo form has no horizontal page scroll at 375', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(DEMO);
  // The two schedule tables overflow on purpose; compare the forms section on its own.
  const r = await page.locator('#forms').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(r.scroll).toBeLessThanOrEqual(r.client);
});
