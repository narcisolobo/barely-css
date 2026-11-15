import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REGISTRY = 'https://registry.npmjs.org/barely-css/-/barely-css-';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

async function defaultFetchTarball(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function newestVersionTag(cwd) {
  const tags = git(cwd, ['tag', '--list', 'v*', '--sort=-v:refname']).split('\n').filter(Boolean);
  return tags[0] ?? null;
}

function distDiffersFromHead(cwd) {
  let head;
  try {
    head = git(cwd, ['show', 'HEAD:dist/barely.css']);
  } catch {
    return true;
  }
  try {
    return readFileSync(join(cwd, 'dist/barely.css'), 'utf8') !== head;
  } catch {
    return false;
  }
}

/** On a branch other than main (or detached) with a local main, the merge-base with main; otherwise null. */
function branchPointFromMain(cwd) {
  const branch = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch === 'main') return null;
  try {
    git(cwd, ['rev-parse', '--verify', '--quiet', 'refs/heads/main']);
    return git(cwd, ['merge-base', 'HEAD', 'main']).trim();
  } catch {
    return null;
  }
}

function hasDist(cwd, ref) {
  try {
    git(cwd, ['cat-file', '-e', `${ref}:dist/barely.css`]);
    return true;
  } catch {
    return false;
  }
}

/** The oldest commit that added dist/barely.css, if it is an ancestor of HEAD; otherwise null. */
function firstDistCommit(cwd) {
  const added = git(cwd, ['log', '--diff-filter=A', '--format=%H', '--', 'dist/barely.css']).split('\n').filter(Boolean);
  const first = added[added.length - 1];
  if (!first) return null;
  try {
    git(cwd, ['merge-base', '--is-ancestor', first, 'HEAD']);
    return first;
  } catch {
    return null;
  }
}

function fromGit(cwd, ref) {
  return { label: `git ${ref}`, css: git(cwd, ['show', `${ref}:dist/barely.css`]) };
}

/**
 * Finds the CSS to compare against. An explicit ref (BARELY_BASELINE_REF, then opts.ref) wins; otherwise the newest
 * `v*` tag's published npm tarball; otherwise, on a branch with a local main, the merge-base with main (or, when main has no dist/barely.css yet, the first commit on this branch that added it); otherwise git history (HEAD when dist has uncommitted changes, else HEAD~1).
 * `cwd`, `env` and `fetchTarball` can be injected so tests never touch the network or the real repository.
 */
export async function resolveBaseline({
  ref,
  cwd = process.cwd(),
  env = process.env,
  fetchTarball = defaultFetchTarball,
} = {}) {
  const explicit = env.BARELY_BASELINE_REF || ref;
  if (explicit) return fromGit(cwd, explicit);

  const tag = newestVersionTag(cwd);
  if (tag) {
    const version = tag.slice(1);
    const tgz = await fetchTarball(`${REGISTRY}${version}.tgz`);
    const dir = mkdtempSync(join(tmpdir(), 'barely-npm-'));
    try {
      const file = join(dir, 'pkg.tgz');
      writeFileSync(file, tgz);
      const css = execFileSync('tar', ['-xzOf', file, 'package/dist/barely.css'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      return { label: `npm ${version}`, css };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const base = branchPointFromMain(cwd);
  if (base) {
    if (hasDist(cwd, base)) {
      return { label: `git merge-base main (${base.slice(0, 7)})`, css: git(cwd, ['show', `${base}:dist/barely.css`]) };
    }
    // main has no dist yet (the first release is still being built on this branch): compare against the first
    // commit that added it, when that commit is part of this branch.
    const first = firstDistCommit(cwd);
    if (first) {
      return { label: `git first dist commit (${first.slice(0, 7)}; merge-base main has no dist)`, css: git(cwd, ['show', `${first}:dist/barely.css`]) };
    }
  }

  return fromGit(cwd, distDiffersFromHead(cwd) ? 'HEAD' : 'HEAD~1');
}
