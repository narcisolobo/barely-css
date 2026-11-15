import { test, expect } from '@playwright/test';
import { DEMO, tabKey } from '../helpers/env.js';
import { tagElements } from '../helpers/tab-order.js';

// Token propagation. Every color token gets a placeholder oklch(0.62 0.13 <h>) with its own hue, set as a plain
// value (not light-dark()). Then every painted color on the demo page must be one of the placeholders or one of the
// derived colors the library computes from them. A literal color in a rule, or a derivation that reads the wrong
// scope, paints something else and shows up here.
//
// Two runs: the placeholders on :root, and on a nested wrapper around the typography, tables and forms sections
// (only elements inside the wrapper are checked). The nested run is what catches a derived token that reads
// :root instead of the element's own scope (Review Focus 3).
//
// Allowed set = the 12 painted placeholders + probes painted inside the scope: the primary-hover derivation in
// both color schemes, the dialog backdrop derivation of the text placeholder, and the color of --barely-shadow
// (a non-color token). --barely-control-background needs no probe: its default is the background placeholder.
//
// Checked per element and state: color, background-color, border-*-color (width > 0), outline-color (style not
// none), text-decoration-color, accent-color and caret-color (when not auto), box-shadow colors, and for
// ::before/::after background-color (content not none), ::placeholder, ::file-selector-button and the progress
// and meter fill pseudo-elements wherever the engine reports them. Fully transparent values are skipped; values
// match within 2 per channel.
//
// Limits: this proves a color comes from SOME token, not that it is the right one (border vs border-strong).
// States driven: default (every element), hover (links and buttons), keyboard focus (every Tab stop), checked and
// indeterminate, user-invalid (typed then Tab), disabled (including disabled + checked and disabled + pressed).
// Not driven: :active, :visited, the open dialog's ::backdrop (only its derivation is probed), native
// date-picker internals and scrollbars (browser-painted, not readable from computed style).

const TOKENS = [
  'background',
  'surface',
  'border',
  'border-strong',
  'text',
  'text-muted',
  'primary',
  'on-primary',
  'mark',
  'success',
  'warning',
  'danger',
];

// Exclusions: elements whose computed color comes from the user agent, not from a library rule. Each entry names
// the element, the property, and why. Nothing is excluded wholesale by property or state.
const EXCLUDED = [
  // <hr>: the UA sets color: gray. The library paints the rule with border-block-start in a token and the hr has no
  // glyphs, so neither color nor its currentColor-derived text-decoration-color is painted.
  / <hr> .*? (?:color|text-decoration-color) painted/,
  // <input type=range>: the UA gives it background-color: Field (Field: white in light, dark gray in dark). The native slider
  // (appearance: auto, tinted by accent-color) never paints the element's own background, only its track and thumb.
  / <input\[type=range\]> .*? background-color painted/,
  // <progress:indeterminate>: interactive.css leaves it to the browser on purpose (appearance: none would remove the
  // native animation), so its track fill and border are UA-painted in Firefox. Determinate progress is not excluded.
  / <progress:indeterminate> .*? (?:background-color|border-(?:top|right|bottom|left)-color) painted/,
];

/** Runs in the page. Installs window.__tp. */
function installHelpers() {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const paint = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const tp = (window.__tp = { allowed: [], count: {}, seen: new Set() });
  const bump = (key) => (tp.count[key] = (tp.count[key] ?? 0) + 1);

  tp.match = (v) => tp.allowed.some((a) => a.rgba.every((c, i) => Math.abs(c - v[i]) <= 2));

  tp.path = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.id) {
        parts.unshift(`#${n.id}`);
        break;
      }
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.localName === n.localName) : [n];
      parts.unshift(same.length > 1 ? `${n.localName}:nth-of-type(${same.indexOf(n) + 1})` : n.localName);
    }
    return parts.join(' > ');
  };

  const COLOR_FN = /(?:rgba?|color|oklch|oklab|lab|lch|hsla?|hwb)\([^)]*\)/g;

  // Returns failure strings for one element (and its pseudo-elements) in the named state.
  tp.measure = (el, state, { descendants = false } = {}) => {
    const out = [];
    const targets = descendants ? [el, ...el.querySelectorAll('*')] : [el];
    for (const target of targets) {
      const kb = target.getAttribute('data-kb-id') ?? `path ${tp.path(target)}`;
      const label = `[${state}] <${target.localName}${target.getAttribute('type') ? `[type=${target.getAttribute('type')}]` : ''}${target.matches('progress:indeterminate') ? ':indeterminate' : ''}> ${target.getAttribute('data-kb-id') ? `data-kb-id=${kb}` : kb}`;
      const test = (prop, css, pseudo = '') => {
        if (!css || css === 'auto') return;
        const v = paint(css);
        if (v[3] === 0) return;
        bump(`${pseudo || 'element'} ${prop}`);
        if (!tp.match(v)) out.push(`${label}${pseudo} ${prop} painted rgba(${v.join(', ')}) [${css}]`);
      };
      const s = getComputedStyle(target);
      test('color', s.color);
      test('background-color', s.backgroundColor);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== 'none')
          test(`border-${side.toLowerCase()}-color`, s[`border${side}Color`]);
      }
      if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) test('outline-color', s.outlineColor);
      test('text-decoration-color', s.textDecorationColor);
      test('accent-color', s.accentColor);
      if (target.matches('input, textarea, [contenteditable]')) test('caret-color', s.caretColor);
      if (s.boxShadow !== 'none') for (const c of s.boxShadow.match(COLOR_FN) ?? []) test('box-shadow', c);

      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(target, pseudo);
        if (p.content !== 'none' && p.content !== 'normal') test('background-color', p.backgroundColor, pseudo);
      }
      const extras = [];
      if (target.matches('input, textarea')) extras.push('::placeholder');
      if (target.matches('input[type=file]')) extras.push('::file-selector-button');
      if (target.matches('progress'))
        extras.push('::-webkit-progress-bar', '::-webkit-progress-value', '::-moz-progress-bar');
      if (target.matches('meter'))
        extras.push(
          '::-webkit-meter-bar',
          '::-webkit-meter-optimum-value',
          '::-webkit-meter-suboptimum-value',
          '::-webkit-meter-even-less-good-value',
          '::-moz-meter-bar',
        );
      for (const pseudo of extras) {
        let p;
        try {
          p = getComputedStyle(target, pseudo);
        } catch {
          continue;
        }
        if (!p.backgroundColor) continue; // the engine does not expose this pseudo-element
        test('background-color', p.backgroundColor, pseudo);
        if (pseudo === '::placeholder' || pseudo === '::file-selector-button') test('color', p.color, pseudo);
      }
    }
    return out;
  };

  // Sets the placeholders on :root or on a wrapper, paints the probes, and fills tp.allowed.
  tp.setup = (nested, tokens) => {
    const rules = tokens.map((t, i) => `--barely-color-${t}: oklch(0.62 0.13 ${i * 28});`).join(' ');
    let scope = document.documentElement;
    if (nested) {
      scope = document.createElement('div');
      scope.id = 'tp-scope';
      // A bare custom-property override does not repaint inherited color or background; a [data-theme] scope does
      // (base.css). A theme name with no color-scheme rule keeps light-dark() on the page's own scheme.
      scope.setAttribute('data-theme', 'custom');
      const first = document.querySelector('main #typography');
      first.before(scope);
      for (const id of ['typography', 'tables', 'forms']) scope.append(document.getElementById(id));
    }
    const style = document.createElement('style');
    style.textContent = `${nested ? '#tp-scope' : ':root'} { ${rules} }`;
    document.head.append(style);

    const host = nested ? scope : document.body;
    const probe = (label, css, scheme = '') => {
      const el = document.createElement('i');
      el.setAttribute('data-tp-probe', '');
      el.style.cssText = `position:absolute;inline-size:1px;block-size:1px;${scheme ? `color-scheme:${scheme};` : ''}${css}`;
      host.append(el);
      const s = getComputedStyle(el);
      let value = s.backgroundColor;
      if (css.startsWith('box-shadow')) value = (s.boxShadow.match(COLOR_FN) ?? [''])[0];
      const rgba = paint(value);
      if (rgba[3] === 0) throw new Error(`probe ${label} resolved to ${value}; the declaration did not apply`);
      tp.allowed.push({ label, rgba });
    };
    for (const t of tokens) probe(`token ${t}`, `background-color: var(--barely-color-${t})`);
    // The probes spell out the derivation without the var(--barely-color-primary-hover, ...) wrapper: a probe that
    // read the same custom properties as the library would also read a bad :root value and hide the bug.
    const hover =
      'light-dark(oklch(from var(--barely-color-primary) calc(l - 0.07) c h), oklch(from var(--barely-color-primary) calc(l + 0.07) c h))';
    probe('primary-hover (light)', `background-color: ${hover}`, 'light');
    probe('primary-hover (dark)', `background-color: ${hover}`, 'dark');
    probe('dialog backdrop', 'background-color: oklch(from var(--barely-color-text) l c h / 0.45)');
    // --barely-control-background has no probe: its default is the background placeholder, already allowed. A probe
    // that read it would pick up a bad :root value (the Review Focus 3 bug) and hide it.
    probe('--barely-shadow color', 'box-shadow: var(--barely-shadow)');
    return tp.allowed.map((a) => `${a.label}: rgba(${a.rgba.join(', ')})`);
  };
}

async function runPropagation(page, browserName, nested) {
  const failures = [];
  const scopeSel = nested ? '#tp-scope' : 'body';
  const stateCounts = {};

  await page.goto(DEMO);
  await tagElements(page);
  await page.evaluate(installHelpers);
  const allowed = await page.evaluate(([n, t]) => window.__tp.setup(n, t), [nested, TOKENS]);
  expect(allowed.length, 'allowed set: 12 tokens + 2 hover + backdrop + shadow').toBe(16);
  // Make one toggle button pressed so its rule is painted.
  await page.evaluate(() => {
    const b = document.querySelector('#demo-form button[type="button"]:not(:disabled)');
    b.setAttribute('aria-pressed', 'true');
  });

  const note = (state, n = 1) => (stateCounts[state] = (stateCounts[state] ?? 0) + n);
  const measure = async (loc, state, pseudo, opts = {}) => {
    const lines = await loc.evaluate(
      (el, [st, ps, o]) => {
        if (ps && !el.matches(ps)) throw new Error(`${st}: <${el.localName}> is not ${ps}`);
        return window.__tp.measure(el, st, o);
      },
      [state, pseudo, opts],
    );
    failures.push(...lines);
    note(state);
  };
  const inScope = (sel) => page.locator(`${scopeSel} ${sel}`);

  // default: every element in the scope
  const defaults = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const els = [root, ...root.querySelectorAll('*')].filter(
      (el) => !el.hasAttribute('data-tp-probe') && !el.closest('head') && !el.matches('script, style, template'),
    );
    const out = [];
    for (const el of els) out.push(...window.__tp.measure(el, 'default'));
    return { out, n: els.length };
  }, scopeSel);
  failures.push(...defaults.out);
  note('default', defaults.n);

  // hover: links and buttons, driven with a real pointer
  const hoverable = inScope(':is(a[href], button, input[type="submit"], input[type="reset"], input[type="button"])');
  for (let i = 0, n = await hoverable.count(); i < n; i++) {
    const loc = hoverable.nth(i);
    if (!(await loc.isVisible())) continue;
    await loc.hover({ timeout: 5000 });
    await measure(loc, 'hover', ':hover', { descendants: true });
  }
  await page.mouse.move(0, 0);

  // focus: every Tab stop, by keyboard
  await page.evaluate(() => document.activeElement?.blur?.());
  let repeats = 0;
  for (let i = 0; i < 300; i++) {
    await page.keyboard.press(tabKey(browserName));
    const read = () =>
      page.evaluate((sel) => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return 'none';
        if (window.__tp.seen.has(el)) return 'seen';
        window.__tp.seen.add(el);
        const root = document.querySelector(sel);
        if (!root.contains(el)) return 'outside';
        // An iframe never matches :focus-visible in the parent document (see keyboard.spec.js); WebKit date fields put
        // :focus-visible on an inner segment, so the host input is held to :focus only.
        if (el.localName !== 'iframe' && !el.matches(el.matches('input[type=date], input[type=time], input[type=datetime-local], input[type=month], input[type=week]') ? ':focus' : ':focus-visible')) throw new Error(`<${el.localName} type=${el.type} id=${el.id}> has focus but not :focus-visible`);
        return window.__tp.measure(el, 'focus');
      }, scopeSel);
    let result = await read();
    for (let waited = 0; result === 'none' && waited < 500; waited += 25) {
      await page.waitForTimeout(25); // WebKit reports body for a moment while focus leaves an iframe
      result = await read();
    }
    if (result === 'none') break;
    // Media controls and iframes keep activeElement on the same element for several Tab presses.
    if (result === 'seen') {
      if (++repeats > 12) break;
      continue;
    }
    repeats = 0;
    if (result === 'outside') continue;
    failures.push(...result);
    note('focus');
  }
  await page.evaluate(() => document.activeElement?.blur?.());

  // checked and indeterminate: real clicks through check()
  const choices = inScope(':is(input[type="checkbox"], input[type="radio"])');
  for (let i = 0, n = await choices.count(); i < n; i++) {
    const loc = choices.nth(i);
    if (await loc.isDisabled()) continue;
    if (await loc.evaluate((el) => el.indeterminate)) await measure(loc, 'indeterminate', ':indeterminate');
    await loc.check();
    await measure(loc, 'checked', ':checked');
  }

  // user-invalid: type a bad value, then Tab away; also come back to it with focus
  for (const [selector, bad] of [
    ['#f-email', 'not-an-email'],
    ['#f-url', 'not a url'],
    ['#f-number', '99'],
  ]) {
    const field = inScope(selector);
    await field.fill(bad);
    await page.keyboard.press(tabKey(browserName));
    await measure(field, 'user-invalid', ':user-invalid');
    await field.evaluate((el) => window.__tp.measure(el.nextElementSibling ?? el, 'user-invalid sibling')).then((l) => failures.push(...l));
    await page.keyboard.press(`Shift+${tabKey(browserName)}`);
    await measure(field, 'user-invalid + focus', ':user-invalid:focus-visible');
  }

  // disabled: the demo's own, then checked / pressed controls made disabled
  const disabled = inScope(':disabled');
  for (let i = 0, n = await disabled.count(); i < n; i++) await measure(disabled.nth(i), 'disabled', ':disabled');
  for (const selector of [
    '#f-cb1',
    '#f-r1',
    '#f-switch',
    '#f-cb3',
    '#demo-form button[aria-pressed="true"]',
  ]) {
    const loc = inScope(selector);
    await loc.evaluate((el) => {
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = true; // the checked phase moved the radio group on
      el.disabled = true;
    });
    const pseudo = selector.includes('aria-pressed') ? ':disabled[aria-pressed="true"]' : ':disabled:checked';
    await measure(loc, `disabled ${selector}`, pseudo);
  }

  const counts = await page.evaluate(() => window.__tp.count);
  test.info().annotations.push({ type: 'coverage', description: JSON.stringify({ stateCounts, counts }) });

  // Coverage floor: a run that measured almost nothing proves nothing.
  expect(stateCounts.default, 'default elements measured').toBeGreaterThan(nested ? 100 : 250);
  expect(stateCounts.hover, 'hover targets measured').toBeGreaterThan(5);
  expect(stateCounts.focus, 'focus stops measured').toBeGreaterThan(nested ? 15 : 30);
  expect(stateCounts.checked, 'checked controls measured').toBeGreaterThan(3);
  expect(stateCounts['user-invalid'], 'user-invalid fields measured').toBe(3);
  expect(counts['::before background-color'], 'pseudo-element fills measured').toBeGreaterThan(0);

  const unexcluded = [...new Set(failures)].filter((line) => !EXCLUDED.some((rx) => rx.test(line)));
  expect(unexcluded.join('\n'), `allowed set:\n${allowed.join('\n')}\n\ncolors that are not tokens`).toBe('');
}

test.use({ reducedMotion: 'reduce' }); // no transitions: painted colors are final on the first read

test('every styled color follows the tokens (overrides on :root)', async ({ page, browserName }) => {
  test.setTimeout(240_000);
  await runPropagation(page, browserName, false);
});

test('every styled color follows the tokens (overrides on a nested section)', async ({ page, browserName }) => {
  test.setTimeout(240_000);
  await runPropagation(page, browserName, true);
});
