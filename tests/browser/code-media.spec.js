import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';
import { paintedRgba, effectiveBackground } from '../helpers/page-color.js';
import { srgb8ToLinear, contrast } from '../helpers/color.js';

test.describe('narrow', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('wide img, video and iframe never overflow at 375', async ({ page }) => {
    await page.goto('/tests/pages/code-media.html');
    const r = await page.evaluate(() => {
      const root = document.documentElement;
      const main = document.querySelector('main').getBoundingClientRect();
      const boxes = ['#wide-img', '#wide-video', '#wide-iframe'].map((s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { s, left: b.left, right: b.right, width: b.width };
      });
      return { scroll: root.scrollWidth, client: root.clientWidth, main: { left: main.left, right: main.right }, boxes };
    });
    expect(r.scroll).toBeLessThanOrEqual(r.client);
    for (const b of r.boxes) {
      expect(b.width, b.s).toBeGreaterThan(0);
      expect(b.left, b.s).toBeGreaterThanOrEqual(r.main.left - 0.5);
      expect(b.right, b.s).toBeLessThanOrEqual(r.main.right + 0.5);
    }
  });

  test('long pre scrolls inside itself', async ({ page }) => {
    await page.goto('/tests/pages/code-media.html');
    const r = await page.evaluate(() => {
      const pre = document.querySelector('#long-pre');
      const root = document.documentElement;
      return {
        inner: pre.scrollWidth > pre.clientWidth,
        overflowX: getComputedStyle(pre).overflowX,
        page: root.scrollWidth <= root.clientWidth,
      };
    });
    expect(r.inner).toBe(true);
    expect(r.overflowX).toBe('auto');
    expect(r.page).toBe(true);
  });

  test('long inline code wraps instead of widening the page; pre still scrolls', async ({ page }) => {
    await page.goto('/tests/pages/code-media.html');
    const r = await page.evaluate(() => {
      const token = 'a.b.c(x)'.repeat(15);
      const host = document.createElement('div');
      host.innerHTML =
        `<p id="t17-p">See <code id="t17-pc">${token}</code> here.</p>` +
        `<ul><li id="t17-li"><code id="t17-lc">${token}</code></li></ul>` +
        `<pre id="t17-pre"><code id="t17-prec">${token}</code></pre>`;
      document.querySelector('main').append(host);
      const root = document.documentElement;
      const within = (codeId, parentId) => {
        const c = document.getElementById(codeId).getBoundingClientRect();
        const p = document.getElementById(parentId);
        const pr = p.getBoundingClientRect();
        const cs = getComputedStyle(p);
        return c.right <= pr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) + 0.5;
      };
      const pre = document.getElementById('t17-pre');
      return {
        page: root.scrollWidth <= window.innerWidth,
        p: within('t17-pc', 't17-p'),
        li: within('t17-lc', 't17-li'),
        preScrolls: pre.scrollWidth > pre.clientWidth,
        preWrap: getComputedStyle(document.getElementById('t17-prec')).overflowWrap,
      };
    });
    expect(r.page).toBe(true);
    expect(r.p).toBe(true);
    expect(r.li).toBe(true);
    expect(r.preScrolls).toBe(true);
    expect(r.preWrap).toBe('normal');
  });
});

test('iframe with a height attribute keeps it', async ({ page }) => {
  await page.goto('/tests/pages/code-media.html');
  const h = await page.locator('#with-height').evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeCloseTo(240, 0);
});

test('iframe without one is 16:9', async ({ page }) => {
  await page.goto('/tests/pages/code-media.html');
  const r = await page.locator('#no-height').evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { w: b.width, h: b.height };
  });
  expect(r.w / r.h).toBeCloseTo(16 / 9, 1);
});

for (const theme of ['light', 'dark']) {
  test(`code text meets 4.5:1 on surface (${theme})`, async ({ page }) => {
    await page.goto(DEMO);
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    for (const sel of ['#code p code', '#code pre code', '#code kbd', '#code samp']) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      const host = sel === '#code pre code' ? page.locator('#code pre').first() : el;
      const bg = await effectiveBackground(host);
      const bodyBg = await effectiveBackground(page.locator('#code h2'));
      expect(bg, `${sel} paints a surface`).not.toEqual(bodyBg);
      const fg = await paintedRgba(el, 'color');
      expect(contrast(srgb8ToLinear(fg.slice(0, 3)), srgb8ToLinear(bg)), sel).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test('code uses the mono stack at 0.875em, pre keeps its tab size', async ({ page }) => {
  await page.goto(DEMO);
  const r = await page.evaluate(() => {
    const p = document.querySelector('#code p');
    const c = p.querySelector('code');
    return {
      ratio: parseFloat(getComputedStyle(c).fontSize) / parseFloat(getComputedStyle(p).fontSize),
      family: /ui-monospace/.test(getComputedStyle(c).fontFamily) && /monospace$/.test(getComputedStyle(c).fontFamily),
      tab: getComputedStyle(document.querySelector('#code pre')).tabSize,
    };
  });
  expect(r.ratio).toBeCloseTo(0.875, 2);
  expect(r.family).toBe(true);
  expect(r.tab).toBe('4');
});

test('demo audio fills its container and video has one caption track', async ({ page }) => {
  await page.goto(DEMO);
  const r = await page.evaluate(() => {
    const audio = document.querySelector('#media audio');
    const parent = audio.parentElement;
    const ps = getComputedStyle(parent);
    const content = parent.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight);
    return { audio: audio.getBoundingClientRect().width, content, tracks: document.querySelectorAll('#media video track').length };
  });
  expect(Math.abs(r.audio - r.content)).toBeLessThanOrEqual(1);
  expect(r.tracks).toBe(1);
});
