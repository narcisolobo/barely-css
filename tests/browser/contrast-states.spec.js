import { test, expect } from '@playwright/test';
import { appendFileSync } from 'node:fs';
import { DEMO, setTheme, tabKey } from '../helpers/env.js';
import { srgb8ToLinear, contrast } from '../helpers/color.js';
import { paintedRgba, effectiveBackground, focusRingReport } from '../helpers/page-color.js';

// Rendered-state contrast, measured on the demo page from painted colors. Text needs 4.5:1; control borders,
// focus rings and fills need 3:1. Each case runs with data-theme unset and with the opposite of the project's
// color scheme. Forced-colors projects do not run this file (see playwright.config.js).
// Set CONTRAST_LOG to a file path to append every measured ratio as a tab-separated line.

const TEXT = 4.5;
const NON_TEXT = 3;

const ratio = (fg, bg) => contrast(srgb8ToLinear(fg.slice(0, 3)), srgb8ToLinear(bg.slice(0, 3)));

/** Runs `body(page, check)` once per theme, with a fresh page load each time. */
function contrastTest(name, body) {
  test(name, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const scheme = testInfo.project.use.colorScheme;
    const opposite = scheme === 'dark' ? 'light' : 'dark';
    for (const theme of [null, opposite]) {
      await page.goto(DEMO);
      await setTheme(page, theme);
      const themeLabel = theme ?? 'unset';
      const check = (label, value, min) => {
        if (process.env.CONTRAST_LOG) {
          appendFileSync(
            process.env.CONTRAST_LOG,
            [name, testInfo.project.name, themeLabel, label, value.toFixed(2), min].join('\t') + '\n',
          );
        }
        expect(value, `${name} [${themeLabel}] ${label}`).toBeGreaterThanOrEqual(min);
      };
      await body(page, check);
    }
  });
}

/** Text color against the background painted behind it (the element's own fill included). */
async function textRatio(loc) {
  const fg = await paintedRgba(loc, 'color');
  expect(fg[3], 'text color is opaque').toBe(255);
  return ratio(fg, await effectiveBackground(loc));
}

/** A border against both neighbors: the backdrop outside it and the control's own fill inside it. */
async function borderRatio(loc) {
  const border = await paintedRgba(loc, 'borderTopColor');
  expect(border[3], 'border color is opaque').toBe(255);
  return Math.min(
    ratio(border, await effectiveBackground(loc, { fromParent: true })),
    ratio(border, await effectiveBackground(loc)),
  );
}

/** Presses Tab until the element matching `selector` has focus. */
async function tabTo(page, browserName, selector) {
  for (let i = 0; i < 300; i++) {
    await page.keyboard.press(tabKey(browserName));
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return;
  }
  throw new Error(`Tab never reached ${selector}`);
}

test.use({ reducedMotion: 'reduce' }); // no transitions: painted colors are final on the first read

// default

const TEXT_TARGETS = [
  ['body text', 'main p'],
  ['link', 'main p a'],
  ['code', 'p code'],
  ['pre code', 'pre code'],
  ['kbd', 'kbd'],
  ['samp', 'samp'],
  ['mark', 'mark'],
  ['small', 'p small'],
  ['muted text figcaption', 'figcaption'],
  ['muted text caption', 'caption'],
  ['stripe row cell, even', '#grades tbody tr:nth-child(even) td'],
  ['stripe row header, even', '#grades tbody tr:nth-child(even) th'],
  ['plain row cell, odd', '#grades tbody tr:nth-child(odd) td'],
  ['help message', '#f-email-msg'],
  ['invalid message, aria-invalid', '#f-sv-bad-msg'],
  ['valid message, aria-invalid=false', '#f-sv-ok-msg'],
];
for (const [label, selector] of TEXT_TARGETS)
  contrastTest(`default: ${label}`, async (page, check) => {
    check('text', await textRatio(page.locator(selector).first()), TEXT);
  });

// hover

contrastTest('hover: link', async (page, check) => {
  const link = page.locator('main p a').first();
  await link.hover();
  expect(await link.evaluate((el) => el.matches(':hover'))).toBe(true);
  check('text', await textRatio(link), TEXT);
});

contrastTest('hover: submit button', async (page, check) => {
  const button = page.locator('input[type="submit"]');
  await button.hover();
  expect(await button.evaluate((el) => el.matches(':hover'))).toBe(true);
  check('label on fill', await textRatio(button), TEXT);
});

contrastTest('hover: reset button', async (page, check) => {
  const button = page.locator('input[type="reset"]');
  await button.hover();
  expect(await button.evaluate((el) => el.matches(':hover'))).toBe(true);
  check('label on fill', await textRatio(button), TEXT);
  check('border', await borderRatio(button), NON_TEXT);
});

// focus

for (const [label, selector, field] of [
  ['link', 'header nav a[href="#typography"]', false],
  ['button', '#demo-form button:not(:disabled)', false],
  ['text field', '#f-text', true],
])
  contrastTest(`focus: ${label}`, async (page, check) => {
    await tabTo(page, test.info().project.use.browserName, selector);
    const ring = await focusRingReport(page);
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThan(0);
    check('ring vs backdrop', ring.contrast, NON_TEXT);
    if (field) check('border', await borderRatio(page.locator(selector)), NON_TEXT);
  });

// user-invalid

contrastTest('user-invalid: email field', async (page, check) => {
  const field = page.locator('#f-email');
  await field.fill('not-an-email');
  await page.keyboard.press(tabKey(test.info().project.use.browserName));
  expect(await field.evaluate((el) => el.matches(':user-invalid'))).toBe(true);
  check('border', await borderRatio(field), NON_TEXT);
  check('message text', await textRatio(page.locator('#f-email-msg')), TEXT);
});

contrastTest('invalid: aria-invalid field', async (page, check) => {
  check('border', await borderRatio(page.locator('#f-sv-bad')), NON_TEXT);
});

// valid state (aria-invalid="false"): success border and success message

contrastTest('valid: aria-invalid=false field', async (page, check) => {
  check('border', await borderRatio(page.locator('#f-sv-ok')), NON_TEXT);
  check('message text', await textRatio(page.locator('#f-sv-ok-msg')), TEXT);
});

// disabled: WCAG exempts the text, so only check that a border is painted

for (const [label, selector] of [
  ['text field', '#f-dis'],
  ['button', 'button:disabled'],
  ['checkbox', '#f-cb4'],
])
  contrastTest(`disabled: ${label}`, async (page) => {
    const control = page.locator(selector);
    const style = await control.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.borderTopStyle, width: parseFloat(s.borderTopWidth) };
    });
    expect(style.style).not.toBe('none');
    expect(style.width).toBeGreaterThan(0);
    expect((await paintedRgba(control, 'borderTopColor'))[3]).toBeGreaterThan(0);
  });

// read-only

contrastTest('read-only: text field', async (page, check) => {
  const field = page.locator('#f-ro');
  check('text on surface', await textRatio(field), TEXT);
  check('border', await borderRatio(field), NON_TEXT);
});

// checked: the filled control against what is behind it

for (const [label, selector] of [
  ['checkbox', '#f-cb2'],
  ['radio', '#f-r2'],
  ['switch', '#f-switch'],
])
  contrastTest(`checked: ${label}`, async (page, check) => {
    const control = page.locator(selector);
    await control.uncheck({ force: true }).catch(() => {}); // radios cannot be unchecked; ignore
    await control.check();
    expect(await control.isChecked()).toBe(true);
    const fill = await paintedRgba(control, 'backgroundColor');
    check('fill vs backdrop', ratio(fill, await effectiveBackground(control, { fromParent: true })), NON_TEXT);
  });

// toggle buttons: button[aria-pressed="true"] uses a surface fill and an inset top edge

contrastTest('pressed: toggle button', async (page, check) => {
  const button = page.locator('header button[aria-pressed="true"]');
  check('label on pressed fill', await textRatio(button), TEXT);
  check('border', await borderRatio(button), NON_TEXT);
  // The inset edge is painted over the pressed fill.
  const edge = await button.evaluate((el) => {
    const shadow = getComputedStyle(el).boxShadow;
    if (!shadow || shadow === 'none') return null;
    const color = shadow.replace(/-?\d*\.?\d+px/g, '').replace('inset', '').trim();
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  });
  expect(edge, 'pressed button has an inset edge').not.toBeNull();
  check('inset edge vs pressed fill', ratio(edge, await effectiveBackground(button)), NON_TEXT);
});
