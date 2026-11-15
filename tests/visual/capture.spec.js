import { test } from '@playwright/test';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { STATES } from './states.js';

const OUT = 'reports/visual';
const WIDTHS = [375, 768, 1280];
const STATE_WIDTH = 1280;
const HEIGHT = 800;
const FIXTURES = readdirSync('tests/fixtures').filter((n) => n.endsWith('.html')).sort();

const FREEZE = `*, *::before, *::after {
  animation: none !important; transition: none !important; caret-color: transparent !important; scroll-behavior: auto !important;
}`;

const baselineCss = readFileSync(`${OUT}/baseline.css`, 'utf8');
const baselineLabel = JSON.parse(readFileSync(`${OUT}/baseline.json`, 'utf8')).label;

const cases = [
  ...FIXTURES.flatMap((fixture) =>
    WIDTHS.map((width) => ({ fixture, width, state: 'default', run: null, check: null })),
  ),
  ...STATES.map((s) => ({ fixture: s.fixture, width: STATE_WIDTH, state: s.name, run: s.run, check: s.check })),
];

async function render(page, fixture, run, check, state) {
  await page.goto(`/tests/fixtures/${fixture}`);
  await page.addStyleTag({ content: FREEZE });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  // A fullPage capture resizes the viewport in Chromium, which drops :hover. Size the viewport to the whole
  // page first so the pointer position holds and nothing needs to scroll.
  const viewport = page.viewportSize();
  if (run) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height });
    await run(page);
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (check && !(await check(page))) throw new Error(`state "${state}" was lost before the screenshot`);
  const shot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  if (run) await page.setViewportSize(viewport);
  return shot;
}

function pad(png, width, height) {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function compare(baseBuf, curBuf) {
  const a = PNG.sync.read(baseBuf);
  const b = PNG.sync.read(curBuf);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pa = pad(a, width, height);
  const pb = pad(b, width, height);
  const diff = new PNG({ width, height });
  const count = pixelmatch(pa.data, pb.data, diff.data, width, height, { threshold: 0.1 });
  const sameSize = a.width === b.width && a.height === b.height;
  const percent = sameSize ? (count / (width * height)) * 100 : 100;
  return { diff: PNG.sync.write(diff), changed: !sameSize || count > 0, percent, sameSize };
}

for (const c of cases) {
  const title = `${c.fixture} @${c.width} ${c.state}`;
  test(title, async ({ page, browserName }, testInfo) => {
    const project = testInfo.project.name;
    const id = `${project}__${c.fixture.replace('.html', '')}__${c.width}__${c.state.replace(/[^a-z0-9]+/gi, '-')}`;
    await page.setViewportSize({ width: c.width, height: HEIGHT });

    // Browsers occasionally antialias a frame differently between loads. Re-render a differing pair up to
    // twice more; a real CSS difference reproduces every time, rendering noise does not.
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.route('**/dist/barely.css', (route) =>
        route.fulfill({ status: 200, contentType: 'text/css', body: baselineCss }),
      );
      const baseBuf = await render(page, c.fixture, c.run, c.check, c.state);
      await page.unroute('**/dist/barely.css');
      const curBuf = await render(page, c.fixture, c.run, c.check, c.state);
      result = { baseBuf, curBuf, ...compare(baseBuf, curBuf) };
      if (!result.changed) break;
    }
    const { baseBuf, curBuf, diff, changed, percent, sameSize } = result;
    writeFileSync(`${OUT}/img/${id}-baseline.png`, baseBuf);
    writeFileSync(`${OUT}/img/${id}-current.png`, curBuf);
    writeFileSync(`${OUT}/img/${id}-diff.png`, diff);
    writeFileSync(
      `${OUT}/results/${id}.json`,
      JSON.stringify({
        id,
        fixture: c.fixture,
        engine: browserName,
        theme: project.includes('dark') ? 'dark' : 'light',
        forced: project.endsWith('-forced'),
        width: c.width,
        state: c.state,
        changed,
        percent,
        sameSize,
        baseline: baselineLabel,
      }),
    );
  });
}
