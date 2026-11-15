export const DEMO = '/demo/';

export function forcedMode(testInfo) {
  if (!testInfo.project.name.endsWith('-forced')) return 'off';
  return testInfo.project.name.startsWith('webkit') ? 'media-only' : 'active';
}

export function tabKey(browserName) {
  return browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
}

export async function setTheme(page, theme) {
  await page.evaluate((value) => {
    if (value) document.documentElement.setAttribute('data-theme', value);
    else document.documentElement.removeAttribute('data-theme');
  }, theme);
}
