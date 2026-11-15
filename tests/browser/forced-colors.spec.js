import { test, expect } from '@playwright/test';
import { DEMO, forcedMode, tabKey } from '../helpers/env.js';
import { paintedRgba } from '../helpers/page-color.js';
import { distinctColorCount, dominantColor, near } from '../helpers/pixels.js';

test('forced-colors media query applies', async ({ page }) => {
  await page.goto(DEMO);
  const matches = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  expect(matches).toBe(true);
});

test('focus outline is visible in forced colors', async ({ page, browserName }, testInfo) => {
  test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
  await page.goto(DEMO);
  for (const selector of ['a[href]', 'button']) {
    // Tab from the top of the page until the first matching element has focus.
    await page.evaluate(() => document.activeElement?.blur());
    const target = page.locator(selector).first();
    for (let i = 0; i < 50 && !(await target.evaluate((n) => n === document.activeElement)); i++) {
      await page.keyboard.press(tabKey(browserName));
    }
    await expect(target).toBeFocused();
    const outline = await target.evaluate((n) => {
      const s = getComputedStyle(n);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style, selector).not.toBe('none');
    expect(outline.width, selector).toBeGreaterThanOrEqual(2);
  }
});

test('select chevron is visible', async ({ page }, testInfo) => {
  test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
  await page.goto('/tests/pages/forms.html');
  const box = await page.locator('#ltr-select').boundingBox();
  // The chevron sits one padding inline from the end edge; a strip there must hold more than the fill alone.
  const scrollY = await page.evaluate(() => scrollY);
  const png = await page.screenshot({
    fullPage: true,
    clip: { x: box.x + box.width - 40, y: box.y + scrollY + 8, width: 24, height: box.height - 16 },
  });
  expect(distinctColorCount(png)).toBeGreaterThanOrEqual(2);
});

test('text control border differs from background', async ({ page }, testInfo) => {
  test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
  await page.goto('/tests/pages/forms.html');
  const [border, bg] = await page.locator('#plain').evaluate((el) => {
    const c = getComputedStyle(el);
    return [c.borderTopColor, c.backgroundColor];
  });
  expect(border).not.toBe(bg);
});

test.describe('choices', () => {
  const PAGE = '/tests/pages/choices.html';

  test('checked states render in forced colors', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(PAGE);
    for (const id of ['cb-on', 'cb-indet', 'rd-on', 'sw-on', 'cb-dis']) {
      const png = await page.locator(`#${id}`).screenshot();
      // inset 5 samples only the interior, not the corners and antialiased edge.
      expect(distinctColorCount(png, { inset: 5 }), id).toBeGreaterThanOrEqual(2);
    }
  });

  test('disabled checked differs from enabled checked', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(PAGE);
    const paint = (id) =>
      page.locator(`#${id}`).evaluate((el) => {
        const c = getComputedStyle(el);
        return [c.backgroundColor, c.borderTopColor];
      });
    expect(await paint('cb-dis')).not.toEqual(await paint('cb-on'));
  });

  test('unchecked border differs from background', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(PAGE);
    for (const id of ['cb-off', 'rd-off', 'sw-off']) {
      const [border, bg] = await page.locator(`#${id}`).evaluate((el) => {
        const c = getComputedStyle(el);
        return [c.borderTopColor, c.backgroundColor];
      });
      expect(border, id).not.toBe(bg);
    }
  });
});

test.describe('form states', () => {
  const PAGE = '/tests/pages/form-states.html';

  test('status icons are visible', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(PAGE);
    for (const id of ['inv-msg', 'val-msg']) {
      const box = await page.locator(`#${id}`).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el, '::before');
        const size = parseFloat(s.width);
        return { x: r.left + scrollX, y: r.top + scrollY + parseFloat(s.marginTop), size };
      });
      const png = await page.screenshot({
        fullPage: true,
        clip: { x: box.x, y: box.y, width: box.size, height: box.size },
      });
      expect(distinctColorCount(png, { inset: 3 }), id).toBeGreaterThanOrEqual(2);
    }
  });

  test('invalid border is 2px', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(PAGE);
    const w = await page.locator('#inv').evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(w).toBe(2);
  });

  test('pressed toggle button is distinguishable from unpressed', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(PAGE);
    const on = await paintedRgba(page.locator('#tg-on'), 'backgroundColor');
    const off = await paintedRgba(page.locator('#tg-off'), 'backgroundColor');
    expect(on).not.toEqual(off);
  });

  test('disabled select uses GrayText', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(PAGE);
    const r = await page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.color = 'GrayText';
      document.body.append(probe);
      const gray = getComputedStyle(probe).color;
      probe.remove();
      const s = getComputedStyle(document.getElementById('dis-select'));
      return { gray, color: s.color, border: s.borderTopColor };
    });
    expect(r.color).toBe(r.gray);
    expect(r.border).toBe(r.gray);
  });
});

test.describe('indeterminate and invalid choices', () => {
  test('disabled indeterminate matches disabled checked', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto('/tests/pages/form-states.html');
    const paint = (id) =>
      page.locator(`#${id}`).evaluate((el) => {
        const c = getComputedStyle(el);
        return [c.backgroundColor, c.borderTopColor];
      });
    expect(await paint('dis-cb-ind')).toEqual(await paint('dis-cb-on'));
  });

  test('invalid checkbox and radio keep the ButtonText border', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto('/tests/pages/form-states.html');
    const r = await page.evaluate(() => {
      const resolve = (c) => {
        const probe = document.createElement('i');
        probe.style.color = c;
        document.body.append(probe);
        const v = getComputedStyle(probe).color;
        probe.remove();
        return v;
      };
      const border = (id) => getComputedStyle(document.getElementById(id)).borderTopColor;
      return { want: resolve('ButtonText'), cb: border('cb-inv'), rd: border('rd-inv') };
    });
    expect(r.cb).toBe(r.want);
    expect(r.rd).toBe(r.want);
  });
});

test('list-box selects have no chevron', async ({ page }, testInfo) => {
  test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
  await page.goto('/tests/pages/forms.html');
  const r = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML =
      '<select id="lb-multi" multiple><option>A</option><option>B</option></select>' +
      '<select id="lb-size" size="3"><option>A</option><option>B</option></select>';
    document.querySelector('main').append(host);
    const bg = (s) => getComputedStyle(document.querySelector(s)).backgroundImage;
    return { multi: bg('#lb-multi'), size: bg('#lb-size'), drop: bg('#ltr-select') };
  });
  expect(r.multi).toBe('none');
  expect(r.size).toBe('none');
  expect(r.drop).not.toBe('none');
});

test.describe('disabled choices', () => {
  test('disabled choices use GrayText and Canvas', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto('/tests/pages/form-states.html');
    const r = await page.evaluate(() => {
      const resolve = (c) => {
        const probe = document.createElement('i');
        probe.style.color = c;
        document.body.append(probe);
        const v = getComputedStyle(probe).color;
        probe.remove();
        return v;
      };
      const paint = (id) => {
        const s = getComputedStyle(document.getElementById(id));
        return { bg: s.backgroundColor, border: s.borderTopColor };
      };
      return { gray: resolve('GrayText'), canvas: resolve('Canvas'), on: paint('dis-cb-on'), off: paint('dis-sw-off') };
    });
    expect(r.on.bg).toBe(r.gray);
    expect(r.on.border).toBe(r.gray);
    expect(r.off.bg).toBe(r.canvas);
    expect(r.off.border).toBe(r.gray);
  });
});

test.describe('progress and meter', () => {
  test('progress and meter fills are visible', async ({ page }, testInfo) => {
    test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
    await page.goto(DEMO);
    // Highlight computes with alpha in Chromium, so paint a swatch over Canvas and read the pixels instead of the computed value.
    await page.evaluate(() => {
      const swatch = document.createElement('div');
      swatch.id = 'highlight-swatch';
      swatch.style.cssText = 'block-size:20px;inline-size:20px;forced-color-adjust:none;background:Highlight';
      document.body.append(swatch);
    });
    const highlight = dominantColor(await page.locator('#highlight-swatch').screenshot(), { from: 0, to: 1 });
    await page.evaluate(() => document.getElementById('highlight-swatch').remove());
    for (const id of ['demo-progress', 'meter-optimum', 'meter-suboptimum', 'meter-even-less-good']) {
      const png = await page.locator(`#${id}`).screenshot();
      // Strips that are always filled (10-40% across; the even-less-good meter is only 10% full, so 3-8%) and never filled (90-95%).
      const [from, to] = id === 'meter-even-less-good' ? [0.03, 0.08] : [0.1, 0.4];
      const filled = dominantColor(png, { from, to, inset: 3 });
      const empty = dominantColor(png, { from: 0.9, to: 0.95, inset: 3 });
      expect(near(filled, highlight), `${id} fill ${filled} vs Highlight ${highlight}`).toBe(true);
      expect(near(empty, highlight), `${id} track ${empty} must differ from Highlight`).toBe(false);
    }
  });
});
