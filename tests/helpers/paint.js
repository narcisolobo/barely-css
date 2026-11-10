import { paintedRgba } from './page-color.js';

/** Selector-based wrapper over paintedRgba that drops alpha. */
export async function paintedRgb(page, selector, property = 'backgroundColor') {
  return (await paintedRgba(page.locator(selector).first(), property)).slice(0, 3);
}
