import { tabKey } from '../helpers/env.js';

/** Presses real Tab until the element matching `selector` has focus, so :focus-visible applies. */
async function tabTo(page, selector) {
  const key = tabKey(page.context().browser().browserType().name());
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press(key);
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return;
  }
  throw new Error(`Tab never reached ${selector}`);
}

const FIRST_LINK = 'main a[href]';
const BUTTON = 'button[type="submit"]';

export const STATES = [
  {
    fixture: '01-typography.html',
    name: 'link focus',
    run: (page) => tabTo(page, FIRST_LINK),
  },
  {
    fixture: '01-typography.html',
    name: 'link hover',
    run: (page) => page.locator(FIRST_LINK).first().hover(),
  },
  {
    fixture: '04-form.html',
    name: 'button focus',
    run: (page) => tabTo(page, BUTTON),
  },
  {
    fixture: '04-form.html',
    name: 'button hover',
    run: (page) => page.locator(BUTTON).hover(),
  },
  {
    fixture: '04-form.html',
    name: 'field focus',
    run: (page) => tabTo(page, '#name'),
  },
  {
    fixture: '04-form.html',
    name: 'field user-invalid',
    run: async (page) => {
      await tabTo(page, '#site');
      await page.keyboard.type('not a url');
      await page.keyboard.press('Tab');
    },
  },
  {
    fixture: '03-docs.html',
    name: 'details open',
    run: async (page) => {
      await page.locator('details:not([open]) > summary').first().click();
      await page.mouse.move(0, 0);
    },
  },
];
