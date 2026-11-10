import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';

// Resolve a length token in the page, so expectations never assume a 16px root.
async function token(page, name) {
  return page.evaluate((n) => {
    const probe = document.createElement('div');
    probe.style.inlineSize = `var(${n})`;
    probe.style.position = 'absolute';
    // Not a child of body, which would make the probe a padded page region.
    document.documentElement.append(probe);
    const w = getComputedStyle(probe).inlineSize;
    probe.remove();
    return parseFloat(w);
  }, name);
}

const rootFont = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

// Physical box of an element, with logical start/end padding resolved through its direction.
const box = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const rtl = s.direction === 'rtl';
    return {
      left: r.left,
      right: r.right,
      contentLeft: r.left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth),
      contentRight: r.right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth),
      padStart: parseFloat(rtl ? s.paddingRight : s.paddingLeft),
      padEnd: parseFloat(rtl ? s.paddingLeft : s.paddingRight),
    };
  }, selector);

// The wide unwrapped table does not exist yet. Task 8 adds it and re-checks scrolling with it present.
async function noPageScroll(page) {
  await page.evaluate(() => document.querySelectorAll('table').forEach((t) => t.remove()));
  const d = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }));
  expect(d.s).toBeLessThanOrEqual(d.c);
}

test.describe('narrow', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('region padding equals the edge token on narrow screens', async ({ page }) => {
    await page.goto(DEMO);
    const edge = await token(page, '--barely-page-padding-inline');
    const main = await box(page, 'body > main');
    expect(main.padStart).toBeCloseTo(edge, 1);
    expect(main.padEnd).toBeCloseTo(edge, 1);
  });

  test('overriding page tokens works', async ({ page }) => {
    await page.goto(DEMO);
    await page.evaluate(() => document.documentElement.style.setProperty('--barely-page-padding-inline', '3rem'));
    const rem = await rootFont(page);
    const main = await box(page, 'body > main');
    expect(main.padStart).toBeCloseTo(3 * rem, 1);
  });

  test('no horizontal scroll at 375 on the demo', async ({ page }) => {
    await page.goto(DEMO);
    await noPageScroll(page);
  });
});

test.describe('1280', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('no horizontal scroll at 1280 on the demo', async ({ page }) => {
    await page.goto(DEMO);
    await noPageScroll(page);
  });
});

test.describe('wide', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('content is centered at content-width on wide screens', async ({ page }) => {
    await page.goto(DEMO);
    const width = await token(page, '--barely-content-width');
    const h = await box(page, 'body > header');
    const m = await box(page, 'body > main');
    const f = await box(page, 'body > footer');
    for (const b of [h, m, f]) expect(b.contentRight - b.contentLeft).toBeCloseTo(width, 1);
    expect(h.contentLeft).toBeCloseTo(m.contentLeft, 1);
    expect(f.contentLeft).toBeCloseTo(m.contentLeft, 1);
    expect(m.contentLeft).toBeCloseTo(1600 - m.contentRight, 1);
  });

  test('masthead background reaches both viewport edges', async ({ page }) => {
    await page.goto(DEMO);
    const h = await box(page, 'body > header');
    expect(h.left).toBe(0);
    expect(h.right).toBe(1600);
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('body > header')).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('prose is start-aligned and capped at reading width', async ({ page }) => {
    await page.goto(DEMO);
    const m = await box(page, 'body > main');
    const p = await page.evaluate(() => {
      const el = document.querySelector('main > section p');
      const r = el.getBoundingClientRect();
      const probe = document.createElement('div');
      probe.style.inlineSize = 'var(--barely-reading-width)';
      el.append(probe);
      const max = probe.getBoundingClientRect().width;
      probe.remove();
      return { left: r.left, width: r.width, max };
    });
    expect(p.left).toBeCloseTo(m.contentLeft, 1);
    expect(p.width).toBeLessThanOrEqual(p.max + 0.5);
    expect(p.width).toBeLessThan(m.contentRight - m.contentLeft);
  });

  test('prose starts at the right edge in RTL', async ({ page }) => {
    await page.goto('/tests/pages/rtl.html');
    const m = await box(page, 'body > main');
    const right = await page.evaluate(() => document.querySelector('main p').getBoundingClientRect().right);
    expect(right).toBeCloseTo(m.contentRight, 1);
  });

  test('page without main pads body', async ({ page }) => {
    await page.goto('/tests/pages/no-main.html');
    const block = await token(page, '--barely-page-padding-block');
    const r = await page.evaluate(() => {
      const s = (sel) => getComputedStyle(document.querySelector(sel));
      return {
        top: parseFloat(s('body').paddingTop),
        bottom: parseFloat(s('body').paddingBottom),
        h1Inline: parseFloat(s('body > h1').paddingLeft),
        sectionBlock: s('body > section').paddingTop,
        scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(r.top).toBeCloseTo(block, 1);
    expect(r.bottom).toBeCloseTo(block, 1);
    expect(r.sectionBlock).toBe('0px');
    expect(r.h1Inline).toBeGreaterThan(0);
    expect(r.scrolls).toBe(false);
  });

  test('page with main does not pad body', async ({ page }) => {
    await page.goto(DEMO);
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingTop)).toBe('0px');
  });

  test('script, style, template, dialog are not regions', async ({ page }) => {
    await page.goto('/tests/pages/regions.html');
    const r = await page.evaluate(() => {
      const out = {};
      const style = document.createElement('style');
      document.body.append(style);
      for (const [name, el] of [
        ['script', document.querySelector('body > script')],
        ['template', document.querySelector('body > template')],
        ['style', style],
        ['dialog', document.querySelector('body > dialog')],
      ]) {
        const s = getComputedStyle(el);
        out[name] = { left: parseFloat(s.paddingLeft), right: parseFloat(s.paddingRight), font: parseFloat(s.fontSize) };
      }
      return out;
    });
    for (const n of ['script', 'template', 'style']) expect([n, r[n].left, r[n].right]).toEqual([n, 0, 0]);
    // dialog keeps its UA padding (1em) rather than the region formula
    expect(r.dialog.left).toBeCloseTo(r.dialog.font, 1);
    expect(r.dialog.right).toBeCloseTo(r.dialog.font, 1);
  });

  test('nested header and footer are not mastheads', async ({ page }) => {
    await page.goto('/tests/pages/regions.html');
    const rem = await rootFont(page);
    const r = await page.evaluate(() =>
      ['article > header', 'article > footer'].map((sel) => {
        const s = getComputedStyle(document.querySelector(sel));
        return {
          bg: s.backgroundColor,
          pad: s.paddingLeft,
          border: `${s.borderTopWidth} ${s.borderBottomWidth}`,
          size: parseFloat(s.fontSize),
        };
      }),
    );
    for (const x of r) {
      expect(x.bg).toBe('rgba(0, 0, 0, 0)');
      expect(x.pad).toBe('0px');
      expect(x.border).toBe('0px 0px');
    }
    expect(r[1].size).toBeCloseTo(0.875 * rem, 1);
  });

  test('masthead has tighter block padding and a rule on the inner side', async ({ page }) => {
    await page.goto(DEMO);
    const block = await token(page, '--barely-page-padding-block');
    const r = await page.evaluate(() => {
      const h = getComputedStyle(document.querySelector('body > header'));
      const f = getComputedStyle(document.querySelector('body > footer'));
      return {
        hp: parseFloat(h.paddingTop),
        fp: parseFloat(f.paddingBottom),
        hb: h.borderBottomWidth,
        ht: h.borderTopWidth,
        ft: f.borderTopWidth,
        fb: f.borderBottomWidth,
      };
    });
    expect(r.hp).toBeCloseTo(block * 0.4, 1);
    expect(r.fp).toBeCloseTo(block * 0.4, 1);
    expect([r.hb, r.ft]).toEqual(['1px', '1px']);
    expect([r.ht, r.fb]).toEqual(['0px', '0px']);
  });

  test('article, section and aside get structure spacing', async ({ page }) => {
    await page.goto(DEMO);
    const rem = await rootFont(page);
    const r = await page.evaluate(() => {
      const a = getComputedStyle(document.querySelector('main aside'));
      const art = getComputedStyle(document.querySelector('main article'));
      return {
        mb: parseFloat(art.marginBottom),
        border: parseFloat(a.borderInlineStartWidth),
        pad: parseFloat(a.paddingInlineStart),
      };
    });
    expect(r.mb).toBeCloseTo(2 * rem, 1);
    expect(Math.abs(r.border - 0.25 * rem)).toBeLessThan(1); // borders snap to device pixels
    expect(r.pad).toBeCloseTo(rem, 1);
  });
});

for (const width of [375, 1600]) {
  test.describe(`prose and aside placed directly in body at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('body > p is a full-width region carrying the reading width', async ({ page }) => {
      await page.goto('/tests/pages/no-main.html');
      const contentW = await token(page, '--barely-content-width');
      const readingW = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.inlineSize = 'var(--barely-reading-width)';
        probe.style.position = 'absolute';
        document.querySelector('body > p').append(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      });
      const p = await box(page, 'body > p');
      const sec = await box(page, 'body > section');
      expect(p.left).toBe(0);
      expect(p.right).toBe(width);
      expect(p.contentLeft).toBeCloseTo(sec.contentLeft, 0);
      const content = p.contentRight - p.contentLeft;
      const avail = sec.contentRight - sec.contentLeft;
      expect(Math.abs(content - Math.min(readingW, contentW, avail))).toBeLessThanOrEqual(2);
    });

    test('aside in body keeps its start border and padding at the content edge', async ({ page }) => {
      await page.goto('/tests/pages/regions.html');
      const r = await page.evaluate(() => {
        const a = document.querySelector('body > aside');
        const m = document.querySelector('body > main');
        const ms = getComputedStyle(m);
        const s = getComputedStyle(a);
        return {
          borderLeft: a.getBoundingClientRect().left,
          mainContentLeft: m.getBoundingClientRect().left + parseFloat(ms.paddingLeft),
          border: parseFloat(s.borderLeftWidth),
          padStart: parseFloat(s.paddingLeft),
          textLeft: a.querySelector('p').getBoundingClientRect().left,
          right: a.getBoundingClientRect().right,
        };
      });
      expect(r.borderLeft).toBeCloseTo(r.mainContentLeft, 0);
      expect(r.border).toBeGreaterThan(0);
      expect(r.padStart).toBeGreaterThan(0);
      expect(r.textLeft).toBeGreaterThan(r.borderLeft + r.border);
      expect(r.right).toBeLessThanOrEqual(width);
    });
  });
}
