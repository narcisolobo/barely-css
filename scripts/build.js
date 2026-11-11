import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SOURCES = [
  'src/layers.css',
  'src/reset.css',
  'src/tokens.css',
  'src/base.css',
  'src/typography.css',
  'src/layout.css',
  'src/navigation.css',
  'src/tables.css',
  'src/code.css',
  'src/media.css',
  'src/forms.css',
  'src/choices.css',
];

const GROUPING_AT_RULES = /^@(layer|media|supports|container|scope|starting-style)\b/;

async function readVersion() {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  return pkg.version;
}

/** Remove comments, collapse whitespace runs to one space. Strings and url(...) are kept verbatim. */
function stripAndCollapse(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      // a comment separates tokens like whitespace does
      if (!out.endsWith(' ')) out += ' ';
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j + 1;
    } else if (/^url\(\s*[^"'\s)]/i.test(css.slice(i, i + 24))) {
      const end = css.indexOf(')', i);
      const stop = end === -1 ? n : end + 1;
      out += css.slice(i, stop);
      i = stop;
    } else if (/\s/.test(c)) {
      while (i < n && /\s/.test(css[i])) i++;
      if (!out.endsWith(' ')) out += ' ';
    } else {
      out += c;
      i++;
    }
  }
  return out.trim();
}

export function minify(css, banner) {
  const src = stripAndCollapse(css);
  const stack = []; // true = declaration block
  let out = '';
  let preludeStart = 0;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === ' ') {
      const prev = out[out.length - 1];
      const next = src[i + 1];
      const inDecl = stack[stack.length - 1] === true;
      // A custom property value is serialized verbatim by the CSSOM, so its commas keep their spaces.
      const inCustomProp = inDecl && out.slice(preludeStart).trimStart().startsWith('--');
      // The CSSOM serializes any declaration containing var() verbatim, so its comma spaces stay.
      let inVarFallback = false;
      if (inDecl) {
        let end = i;
        while (end < n && !';}'.includes(src[end])) end++;
        inVarFallback = /\bvar\(/.test(out.slice(preludeStart) + src.slice(i, end));
      }
      const drop =
        prev === undefined ||
        '{};'.includes(prev) ||
        (prev === ',' && !inCustomProp && !inVarFallback) ||
        (next !== undefined && '{};'.includes(next)) ||
        (next === ',' && !inCustomProp && !inVarFallback) ||
        (prev === ':' && inDecl);
      if (!drop) out += ' ';
      i++;
    } else {
      if (c === '{') {
        const prelude = out.slice(preludeStart).trim();
        stack.push(!GROUPING_AT_RULES.test(prelude));
      }
      out += c;
      if (c === '{' || c === '}' || c === ';') {
        if (c === '}') stack.pop();
        preludeStart = out.length;
      }
      i++;
    }
  }
  return `${banner}\n${out}\n`;
}

export async function build() {
  const version = await readVersion();
  const header = `/*! barely-css v${version} | MIT License | Customize by overriding the --barely-* custom properties listed in the tokens section below */`;
  let css = header;
  for (const file of SOURCES) {
    const text = (await readFile(resolve(root, file), 'utf8')).trim();
    if (file === 'src/layers.css') {
      css += `\n${text}\n`;
    } else {
      css += `\n/* ==== ${basename(file)} ==== */\n${text}\n`;
    }
  }
  const min = minify(css, `/*! barely-css v${version} | MIT License */`);
  return { css, min };
}

async function main() {
  const check = process.argv.includes('--check');
  const { css, min } = await build();
  const targets = [
    ['dist/barely.css', css],
    ['dist/barely.min.css', min],
  ];
  if (check) {
    const stale = [];
    for (const [file, expected] of targets) {
      let actual = null;
      try {
        actual = await readFile(resolve(root, file), 'utf8');
      } catch {}
      if (actual !== expected) stale.push(file);
    }
    if (stale.length) {
      console.error(`Stale dist file(s): ${stale.join(', ')}. Run pnpm build.`);
      process.exit(1);
    }
    return;
  }
  await mkdir(resolve(root, 'dist'), { recursive: true });
  for (const [file, content] of targets) await writeFile(resolve(root, file), content);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
