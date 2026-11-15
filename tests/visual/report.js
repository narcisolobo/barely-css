import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'reports/visual';

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function buildReport(results, baselineLabel) {
  const changed = results.filter((r) => r.changed);
  const fixtures = [...new Set(results.map((r) => r.fixture))].sort();
  const sections = fixtures
    .map((fixture) => {
      const list = changed
        .filter((r) => r.fixture === fixture)
        .sort((a, b) => b.percent - a.percent);
      const total = results.filter((r) => r.fixture === fixture).length;
      const body = list.length
        ? list
            .map(
              (r) => `<article>
  <h3>${esc(r.engine)} · ${esc(r.theme)}${r.forced ? ' · forced colors' : ''} · ${r.width}px · ${esc(r.state)} · ${r.percent.toFixed(2)}% changed${r.sameSize ? '' : ' (size differs)'}</h3>
  <div class="trio">
    <figure><figcaption>Baseline</figcaption><img loading="lazy" src="img/${esc(r.id)}-baseline.png" alt=""></figure>
    <figure><figcaption>Current</figcaption><img loading="lazy" src="img/${esc(r.id)}-current.png" alt=""></figure>
    <figure><figcaption>Diff</figcaption><img loading="lazy" src="img/${esc(r.id)}-diff.png" alt=""></figure>
  </div>
</article>`,
            )
            .join('\n')
        : '<p>No changes.</p>';
      return `<section><h2>${esc(fixture)} <small>${list.length} of ${total} changed</small></h2>\n${body}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual regression report</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:2rem;color:#1a1a1a;background:#fff}
h2 small{font-weight:400;color:#555}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;align-items:start}
figure{margin:0}figcaption{font-weight:600}img{max-width:100%;border:1px solid #ccc}
article{margin-block:1.5rem}
</style></head><body>
<h1>Visual regression report</h1>
<p>Baseline: ${esc(baselineLabel)}. A difference is a question: is it intended?</p>
<p id="summary"><strong>${changed.length}</strong> of ${results.length} screenshots changed.</p>
${sections}
</body></html>
`;
}

export default async function globalTeardown() {
  const dir = `${OUT}/results`;
  if (!existsSync(dir)) return;
  const results = readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => JSON.parse(readFileSync(`${dir}/${n}`, 'utf8')));
  let label = 'unknown';
  try {
    label = JSON.parse(readFileSync(`${OUT}/baseline.json`, 'utf8')).label;
  } catch {}
  writeFileSync(`${OUT}/index.html`, buildReport(results, label));
  const changed = results.filter((r) => r.changed).length;
  console.log(`visual report: ${changed} of ${results.length} screenshots changed -> ${OUT}/index.html`);
}
