import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolveBaseline } from './baseline.js';

export const OUT = 'reports/visual';

export default async function globalSetup() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}/results`, { recursive: true });
  mkdirSync(`${OUT}/img`, { recursive: true });
  const { label, css } = await resolveBaseline();
  writeFileSync(`${OUT}/baseline.css`, css);
  writeFileSync(`${OUT}/baseline.json`, JSON.stringify({ label }));
  console.log(`visual baseline: ${label}`);
}
