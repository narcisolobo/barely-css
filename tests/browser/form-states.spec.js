import { test, expect } from '@playwright/test';
import { paintedRgba } from '../helpers/page-color.js';
import { tabKey } from '../helpers/env.js';

const PAGE = '/tests/pages/form-states.html';

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
});

/** The painted color of a token, resolved through a probe so light-dark() and oklch() are handled. */
async function token(page, name) {
  return page.evaluate((n) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    probe.remove();
    return [...ctx.getImageData(0, 0, 1, 1).data];
  }, name);
}

const borderWidth = (loc) => loc.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));

test('text control focus turns border primary and shows ring', async ({ page }) => {
  const primary = await token(page, '--barely-color-primary');
  for (const id of ['text', 'date', 'ta']) {
    const el = page.locator(`#${id}`);
    await el.focus();
    expect(await paintedRgba(el, 'borderTopColor'), id).toEqual(primary);
    const outline = await el.evaluate((n) => {
      const s = getComputedStyle(n);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style, id).toBe('solid');
    expect(outline.width, id).toBeGreaterThanOrEqual(2);
  }
  await page.locator('#text').focus();
  await page.locator('#date').focus();
  expect(await paintedRgba(page.locator('#text'), 'borderTopColor')).not.toEqual(primary);
});

test('disabled control and its label are muted; cursor not-allowed', async ({ page }) => {
  const muted = await token(page, '--barely-color-text-muted');
  const surface = await token(page, '--barely-color-surface');
  const border = await token(page, '--barely-color-border');
  const input = page.locator('#dis-text');
  expect(await paintedRgba(input, 'color')).toEqual(muted);
  expect(await paintedRgba(input, 'backgroundColor')).toEqual(surface);
  expect(await paintedRgba(input, 'borderTopColor')).toEqual(border);
  expect(await input.evaluate((n) => getComputedStyle(n).cursor)).toBe('not-allowed');
  expect(await paintedRgba(page.locator('#dis-label'), 'color')).toEqual(muted);
  expect(await page.locator('#dis-select').evaluate((n) => getComputedStyle(n).cursor)).toBe('not-allowed');
  expect(await paintedRgba(page.locator('#dis-select'), 'color')).toEqual(muted);
  // Choices: muted fill and not-allowed cursor on the box and its label.
  const cb = page.locator('#dis-cb');
  expect(await paintedRgba(cb, 'backgroundColor')).toEqual(surface);
  expect(await paintedRgba(cb, 'borderTopColor')).toEqual(border);
  expect(await cb.evaluate((n) => getComputedStyle(n).cursor)).toBe('not-allowed');
  expect(await page.locator('#dis-cb-label').evaluate((n) => getComputedStyle(n).cursor)).toBe('not-allowed');
  // Buttons.
  for (const id of ['dis-btn', 'dis-reset']) {
    const b = page.locator(`#${id}`);
    expect(await paintedRgba(b, 'backgroundColor'), id).toEqual(surface);
    expect(await paintedRgba(b, 'color'), id).toEqual(muted);
    expect(await paintedRgba(b, 'borderTopColor'), id).toEqual(border);
    expect(await b.evaluate((n) => getComputedStyle(n).cursor), id).toBe('not-allowed');
  }
  expect(await page.locator('#on-btn').evaluate((n) => getComputedStyle(n).cursor)).toBe('pointer');
  // Disabled buttons do not take the hover color.
  await page.locator('#dis-btn').hover({ force: true });
  expect(await paintedRgba(page.locator('#dis-btn'), 'backgroundColor')).toEqual(surface);
});

test('readonly is dashed with surface fill; checkbox is not matched by readonly rules', async ({ page }) => {
  const surface = await token(page, '--barely-color-surface');
  for (const id of ['ro', 'ro-ta']) {
    const el = page.locator(`#${id}`);
    expect(await el.evaluate((n) => getComputedStyle(n).borderTopStyle), id).toBe('dashed');
    expect(await paintedRgba(el, 'backgroundColor'), id).toEqual(surface);
  }
  // :read-only matches a checkbox; [readonly] must not.
  const cb = page.locator('#cb');
  expect(await cb.evaluate((n) => n.matches(':read-only'))).toBe(true);
  expect(await cb.evaluate((n) => getComputedStyle(n).borderTopStyle)).toBe('solid');
  await cb.evaluate((n) => n.setAttribute('readonly', ''));
  expect(await cb.evaluate((n) => getComputedStyle(n).borderTopStyle)).toBe('solid');
  expect(await page.locator('#text').evaluate((n) => getComputedStyle(n).borderTopStyle)).toBe('solid');
});

test.describe('validation', () => {
  test('user-invalid after typing', async ({ page, browserName }) => {
    const danger = await token(page, '--barely-color-danger');
    const em = page.locator('#em');
    const msg = page.locator('#em-msg');
    // Before interaction nothing applies.
    expect(await borderWidth(em)).toBe(1);
    expect(await paintedRgba(msg, 'color')).not.toEqual(danger);
    expect(await msg.evaluate((n) => getComputedStyle(n, '::before').content)).toBe('none');
    await em.focus();
    await page.keyboard.type('x');
    await page.keyboard.press(tabKey(browserName));
    await expect(em).not.toBeFocused();
    expect(await borderWidth(em)).toBe(2);
    expect(await paintedRgba(em, 'borderTopColor')).toEqual(danger);
    expect(await paintedRgba(msg, 'color')).toEqual(danger);
    const mask = await msg.evaluate((n) => {
      const s = getComputedStyle(n, '::before');
      return { content: s.content, mask: s.maskImage || s.webkitMaskImage };
    });
    expect(mask.content).not.toBe('none');
    expect(mask.mask).toContain('url(');
  });

  test('aria-invalid="true" is invalid on load', async ({ page }) => {
    const danger = await token(page, '--barely-color-danger');
    for (const id of ['inv', 'sel-inv']) {
      const el = page.locator(`#${id}`);
      expect(await borderWidth(el), id).toBe(2);
      expect(await paintedRgba(el, 'borderTopColor'), id).toEqual(danger);
    }
    expect(await paintedRgba(page.locator('#inv-msg'), 'color')).toEqual(danger);
    const mask = await page.locator('#inv-msg').evaluate((n) => {
      const s = getComputedStyle(n, '::before');
      return s.maskImage || s.webkitMaskImage;
    });
    expect(mask).toContain('url(');
    // Choices get the thicker danger border too.
    const cb = page.locator('#cb-inv');
    expect(await borderWidth(cb)).toBe(2);
    expect(await paintedRgba(cb, 'borderTopColor')).toEqual(danger);
  });

  test('aria-invalid="false" is valid with a check icon', async ({ page }) => {
    const success = await token(page, '--barely-color-success');
    const val = page.locator('#val');
    expect(await paintedRgba(val, 'borderTopColor')).toEqual(success);
    expect(await borderWidth(val)).toBe(1);
    expect(await paintedRgba(page.locator('#val-msg'), 'color')).toEqual(success);
    const icons = await page.evaluate(() =>
      ['inv-msg', 'val-msg'].map((id) => {
        const s = getComputedStyle(document.getElementById(id), '::before');
        return s.maskImage || s.webkitMaskImage;
      }),
    );
    expect(icons[1]).toContain('url(');
    expect(icons[1]).not.toBe(icons[0]);
  });

  test(':user-valid is not styled', async ({ page, browserName }) => {
    const normal = await paintedRgba(page.locator('#plain-inv'), 'borderTopColor');
    const em = page.locator('#em-ok');
    await em.focus();
    await page.keyboard.type('ada@example.com');
    await page.keyboard.press(tabKey(browserName));
    expect(await em.evaluate((n) => n.matches(':user-valid'))).toBe(true);
    expect(await paintedRgba(em, 'borderTopColor')).toEqual(normal);
    expect(await borderWidth(em)).toBe(1);
    expect(await page.locator('#em-ok-msg').evaluate((n) => getComputedStyle(n, '::before').content)).toBe('none');
  });

  test('invalid input keeps its text position', async ({ page }) => {
    const startX = (id) =>
      page.locator(`#${id}`).evaluate((el) => {
        const s = getComputedStyle(el);
        return el.getBoundingClientRect().left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
      });
    expect(await startX('inv')).toBeCloseTo(await startX('plain-inv'), 2);
  });

  test('no asterisk on required', async ({ page }) => {
    for (const id of ['req', 'em']) {
      const content = await page.locator(`label[for=${id}]`).evaluate((n) => [
        getComputedStyle(n, '::before').content,
        getComputedStyle(n, '::after').content,
        getComputedStyle(n.querySelector('input'), '::after').content,
      ]);
      expect(content, id).toEqual(['none', 'none', 'none']);
    }
  });
});
