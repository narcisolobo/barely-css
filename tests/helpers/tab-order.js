import { expect } from '@playwright/test';

/** Sets data-kb-id="<n>" on every element in document order. */
export async function tagElements(page) {
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el, i) => el.setAttribute('data-kb-id', String(i)));
  });
}

/**
 * Ids (as strings, source order) of the elements Tab should reach.
 * required: always a stop. optional: engines differ (media controls, scroll containers).
 */
export async function expectedStops(page) {
  return page.evaluate(() => {
    const FOCUSABLE =
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const id = (el) => el.getAttribute('data-kb-id');

    const rendered = (el) => el.checkVisibility({ visibilityProperty: true });

    const blocked = (el) => {
      if (el.matches(':disabled') || el.closest('[inert]')) return true;
      const closedDetails = el.closest('details:not([open])');
      if (closedDetails) {
        const ownSummary = [...closedDetails.children].find((c) => c.localName === 'summary');
        if (el !== ownSummary) return true;
      }
      if (el.closest('dialog:not([open])')) return true;
      const popover = el.closest('[popover]');
      if (popover && !popover.matches(':popover-open')) return true;
      return false;
    };

    const candidates = [...document.querySelectorAll(FOCUSABLE)].filter((el) => !blocked(el) && rendered(el));

    // Radio groups count once: the checked radio, or the first when none is checked.
    const groups = new Map();
    const stops = [];
    for (const el of candidates) {
      if (el.matches('input[type=radio][name]')) {
        const key = `${el.form ? [...document.forms].indexOf(el.form) : 'none'}|${el.name}`;
        const members = groups.get(key) ?? [];
        members.push(el);
        groups.set(key, members);
        continue;
      }
      stops.push(el);
    }
    for (const members of groups.values()) {
      stops.push(members.find((r) => r.checked) ?? members[0]);
    }
    // Radios without a name are each their own stop.
    for (const el of candidates) {
      if (el.matches('input[type=radio]:not([name])')) stops.push(el);
    }

    const optional = [];
    for (const el of document.querySelectorAll('video[controls], audio[controls], iframe')) {
      if (!blocked(el) && rendered(el)) optional.push(el);
    }
    for (const el of document.querySelectorAll('*')) {
      if (stops.includes(el) || optional.includes(el)) continue;
      const { overflowX, overflowY } = getComputedStyle(el);
      const scrollsX = /auto|scroll/.test(overflowX) && el.scrollWidth > el.clientWidth;
      const scrollsY = /auto|scroll/.test(overflowY) && el.scrollHeight > el.clientHeight;
      if (!(scrollsX || scrollsY) || el === document.documentElement || el === document.body) continue;
      if (blocked(el) || !rendered(el)) continue;
      if (el.querySelector(FOCUSABLE)) continue;
      optional.push(el);
    }

    const order = (list) => list.map(id).sort((a, b) => Number(a) - Number(b));
    return { required: order(stops), optional: order(optional) };
  });
}

/**
 * Presses `key` from the top (or bottom, with reverse) and records the data-kb-id of the
 * focused element, collapsing consecutive duplicates (date inputs have inner segments).
 * Stops when focus returns to body/null, when focus wraps to an id already seen, or at max.
 * The returned array carries `end`: 'body' | 'wrapped' | 'max', how the walk ended.
 */
export async function walkTabStops(page, key, { max = 400 } = {}) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const ids = [];
  const seen = new Set();
  let end = 'max';
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    const id = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      return el.closest('[data-kb-id]')?.getAttribute('data-kb-id') ?? null;
    });
    if (id === null) {
      end = 'body';
      break;
    }
    if (ids.at(-1) === id) continue;
    if (seen.has(id)) {
      end = 'wrapped';
      break;
    }
    seen.add(id);
    ids.push(id);
  }
  ids.end = end;
  return ids;
}

/** Drops optional ids from `actual`, then compares with the required ids. */
export function assertOrder(actual, expected) {
  const optional = new Set(expected.optional);
  expect([...actual].filter((id) => !optional.has(id))).toEqual(expected.required);
}
