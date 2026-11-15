import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBaseline } from '../visual/baseline.js';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
const noFetch = async () => {
  throw new Error('network must not be used');
};

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'barely-baseline-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'config', 'tag.gpgsign', 'false');
  mkdirSync(join(dir, 'dist'));
  const commit = (css, msg) => {
    writeFileSync(join(dir, 'dist/barely.css'), css);
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', msg);
  };
  commit('/* one */', 'one');
  commit('/* two */', 'two');
  return { dir, commit };
}

let repo;
test.afterEach(() => {
  if (repo) rmSync(repo.dir, { recursive: true, force: true });
  repo = undefined;
});

test('uses HEAD~1 when dist is unchanged', async () => {
  repo = makeRepo();
  const r = await resolveBaseline({ cwd: repo.dir, env: {}, fetchTarball: noFetch });
  expect(r).toEqual({ label: 'git HEAD~1', css: '/* one */' });
});

test('uses HEAD when dist differs', async () => {
  repo = makeRepo();
  writeFileSync(join(repo.dir, 'dist/barely.css'), '/* working copy */');
  const r = await resolveBaseline({ cwd: repo.dir, env: {}, fetchTarball: noFetch });
  expect(r).toEqual({ label: 'git HEAD', css: '/* two */' });
});

test('env ref wins', async () => {
  repo = makeRepo();
  git(repo.dir, 'tag', 'v1.0.0');
  const first = git(repo.dir, 'rev-parse', 'HEAD~1').trim();
  const r = await resolveBaseline({
    cwd: repo.dir,
    ref: 'HEAD',
    env: { BARELY_BASELINE_REF: first },
    fetchTarball: noFetch,
  });
  expect(r).toEqual({ label: `git ${first}`, css: '/* one */' });
});

test('opts.ref wins over a tag', async () => {
  repo = makeRepo();
  git(repo.dir, 'tag', 'v1.0.0');
  const r = await resolveBaseline({ cwd: repo.dir, ref: 'HEAD', env: {}, fetchTarball: noFetch });
  expect(r).toEqual({ label: 'git HEAD', css: '/* two */' });
});

test('newest v* tag fetches the npm tarball through the injected fetcher', async () => {
  repo = makeRepo();
  git(repo.dir, 'tag', 'v1.2.0');
  git(repo.dir, 'tag', 'v1.10.0');
  git(repo.dir, 'tag', 'v1.9.0');
  const pack = mkdtempSync(join(tmpdir(), 'barely-tgz-'));
  try {
    mkdirSync(join(pack, 'package/dist'), { recursive: true });
    writeFileSync(join(pack, 'package/dist/barely.css'), '/* from npm */');
    execFileSync('tar', ['-czf', join(pack, 'x.tgz'), '-C', pack, 'package']);
    const tgz = readFileSync(join(pack, 'x.tgz'));
    const urls = [];
    const r = await resolveBaseline({
      cwd: repo.dir,
      env: {},
      fetchTarball: async (url) => {
        urls.push(url);
        return tgz;
      },
    });
    expect(urls).toEqual(['https://registry.npmjs.org/barely-css/-/barely-css-1.10.0.tgz']);
    expect(r).toEqual({ label: 'npm 1.10.0', css: '/* from npm */' });
  } finally {
    rmSync(pack, { recursive: true, force: true });
  }
});

test('on a branch, diffs against the merge-base with main', async () => {
  repo = makeRepo();
  git(repo.dir, 'checkout', '-q', '-b', 'feature');
  repo.commit('/* feature one */', 'f1');
  repo.commit('/* feature two */', 'f2');
  const base = git(repo.dir, 'rev-parse', 'main').trim();
  const r = await resolveBaseline({ cwd: repo.dir, env: {}, fetchTarball: noFetch });
  expect(r).toEqual({ label: `git merge-base main (${base.slice(0, 7)})`, css: '/* two */' });
});

test('on main, keeps the HEAD or HEAD~1 rule', async () => {
  repo = makeRepo();
  const r = await resolveBaseline({ cwd: repo.dir, env: {}, fetchTarball: noFetch });
  expect(r.label).toBe('git HEAD~1');
});
