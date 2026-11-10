# barely-css v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build barely-css v1, a single classless stylesheet driven by tokens, plus its demo page, Playwright checks, visual regression suite, packaging, README, CHANGELOG, and "Coming from Pico" guide, up to the point where `1.0.0-beta.1` could be cut.

**Architecture:** Plain CSS source files in `src/`, one per area, are concatenated by a maintainer-only Node script into `dist/barely.css` (with comments) and `dist/barely.min.css` (banner only). Every rule sits in one of three cascade layers (`reset`, `tokens`, `base`). A demo page and fixture pages link `dist/barely.css` and are driven by Playwright in Chromium, Firefox, and WebKit, in light, dark, and forced colors.

**Tech Stack:** CSS (evergreen only), Node ≥ 22 ESM scripts with no runtime dependencies, pnpm, `@playwright/test` 1.65, `@axe-core/playwright`, `pngjs` and `pixelmatch` (visual suite only).

**Spec:** [docs/superpowers/specs/2026-11-09-barely-css-design.md](../specs/2026-11-09-barely-css-design.md). Read it before starting any task. This plan pins decisions; the spec explains them.

**Reference CSS:** the approved forms preview (https://claude.ai/artifact/UEC92afWaKez4QYLtMtGpV) holds measured CSS for every form control, scoped to `.bx`. Tasks 10–12 port it. When porting, drop the `.bx` scope, wrap selectors in `:where()`, and **do not copy** its `:root` declarations of `--barely-color-primary-hover` or `--barely-control-background` (see Global Constraints). The colors preview (https://claude.ai/artifact/JBAEH5SphUfhG7Eh6fk3oT) holds the OKLCH-to-sRGB contrast math that Task 2 ports.

## Global Constraints

- Package manager is pnpm (`pnpm@12.18.0`). Never use npm or yarn commands in scripts or docs, except where the README shows npm install as one user option alongside pnpm.
- Users need nothing but the CSS file: no classes, no JavaScript, no build step. Dev dependencies are maintainer-only.
- Every public custom property starts with `--barely-`. Private helpers start with `--_barely-`.
- Layer statement, exactly, once, at the top of the output: `@layer reset, tokens, base, layout, components, utilities, overrides;`. v1 writes only to `reset`, `tokens`, `base`.
- Element selectors are wrapped in `:where()` wherever possible.
- Logical properties only. No `width`, `height`, `margin-left`, `padding-top`, `left`, `text-align: left`, and so on in declarations.
- **No token value on `:root` may contain `var()`.** A token whose default comes from another token is written as a `var()` fallback at each use site. This applies to `--barely-color-primary-hover` (spec rule) and, by the same reasoning, to `--barely-control-background`, whose default is `var(--barely-color-background)`. Use sites write `var(--barely-control-background, var(--barely-color-background))`.
- `primary-hover` derivation, verbatim at each use site:
  `var(--barely-color-primary-hover, light-dark(oklch(from var(--barely-color-primary) calc(l - 0.07) c h), oklch(from var(--barely-color-primary) calc(l + 0.07) c h)))`
- Colors appear as literals only in `src/tokens.css`. Elsewhere colors are `var(--barely-color-*)`, `currentColor`, `transparent`, relative colors derived from a token, or system colors inside `@media (forced-colors: active)`.
- Transitions are declared only inside `@media (prefers-reduced-motion: no-preference)`.
- Focus: `:focus-visible` outline `var(--barely-focus-ring-width) solid var(--barely-color-primary)` at `var(--barely-focus-ring-offset)`. Never `outline: none`.
- Fonts: `--barely-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, sans-serif;` and `--barely-font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace;`. No web fonts.
- `package.json` `version` stays `0.0.0` until a release. Only a release changes it.
- `CHANGELOG.md` has `## [Unreleased]` from Task 1. Any change a user could notice adds its line in the same commit. Before 1.0 everything new goes under **Added**.
- Commits use Conventional Commits. The owner drafts messages with the `/commit-message` skill; the messages in this plan are suggestions.
- Run `pnpm build` after every `src/` edit. The dist-freshness test fails otherwise, by design.

## Review Focus

Inputs and conditions the spec implies but no obvious test covers. Each one has its test in the owning task.

1. **A long URL or unbroken word in a table cell at 375px.** Expect the table to fit without page scroll. `overflow-wrap: break-word` (the spec's literal value) does not shrink a cell's min-content width in an auto-layout table, so the URL would force overflow. Task 8 uses `overflow-wrap: anywhere` on cells and tests it. Flag this one-word deviation to the owner when Task 8 lands.
2. **`select` and `progress`/`meter` in forced colors.** Forced colors removes gradient backgrounds and author fills, so the select chevron and the progress bar vanish. Expect both to stay visible. Tasks 10 and 13 paint them with system colors under `forced-color-adjust: none` and test them with pixel counts.
3. **Overrides on a nested element for derived tokens.** Setting `--barely-color-background` on a `section` must change the fill of controls inside it, and setting `--barely-color-primary` there must change the hover color. Task 15's nested run covers both; Task 2's source lint forbids `var()` in `:root` token values so the bug can't be reintroduced.
4. **Scroll containers that become tab stops.** Chromium and Firefox make an overflowing `pre` (or the unwrapped wide table's region) focusable when it has no focusable children; WebKit doesn't. Expect these stops to be allowed but not required, and to show the focus ring. Task 4's tab-order test treats them, and `video`, `audio`, and `iframe`, as optional stops; the global focus rule covers them.
5. **A page with no `main`, and content placed directly in `body`.** Expect body padding and region padding to apply, with no doubled padding and no horizontal scroll. Task 6 tests a `no-main.html` page.

---

## File Structure

```
src/
  layers.css        layer order statement only
  reset.css         @layer reset: box sizing, margins, media defaults
  tokens.css        @layer tokens: every public token and theme color-scheme
  base.css          @layer base: body, theme scopes, focus ring, reduced motion
  typography.css    @layer base: headings, prose, inline elements
  layout.css        @layer base: page regions, reading width, structure
  navigation.css    @layer base: masthead nav, breadcrumbs
  tables.css        @layer base: tables, scroll wrapper
  code.css          @layer base: pre, code, kbd, samp
  media.css         @layer base: img, figure, video, audio, iframe
  forms.css         @layer base: labels, controls, buttons
  choices.css       @layer base: checkbox, radio, switch
  form-states.css   @layer base: focus, disabled, readonly, invalid, valid
  interactive.css   @layer base: details, dialog, popover, progress, meter
scripts/
  build.js          concatenate + minify; --check mode
  serve.js          static server for tests
dist/
  barely.css, barely.min.css   committed build output
demo/
  index.html        every baseline element; theme toggle; nested scope; RTL
tests/
  unit/             node-only tests (no browser)
  browser/          demo-page tests across engines and themes
  helpers/          shared test helpers
  pages/            small single-purpose pages for layout tests
  fixtures/         10 realistic pages for the visual suite
  visual/           visual regression config, capture, baseline, report
docs/migrating/from-pico.md
docs/releasing.md
README.md, CHANGELOG.md, LICENSE
playwright.config.js
```

The build order is the `SOURCES` array in `scripts/build.js`, which is exactly the order of `src/` above.

---

## Milestone 1: Foundation

### Task 1: Build pipeline, layers, changelog

**Files:**
- Create: `scripts/build.js`, `src/layers.css`, `src/reset.css`, `src/tokens.css`, `src/base.css` (the last three as `@layer x {}` stubs), `CHANGELOG.md`, `tests/unit/build.spec.js`, `dist/barely.css`, `dist/barely.min.css`, `playwright.config.js` (unit project only for now)
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Produces: `export const SOURCES: string[]` (paths relative to repo root, in build order); `export async function build(): Promise<{ css: string, min: string }>`; `export function minify(css: string, banner: string): string`. CLI: `node scripts/build.js` writes both dist files; `node scripts/build.js --check` exits 1 and names the stale file if either differs.
- Produces: `pnpm build`, `pnpm check:dist`, `pnpm test` (= `playwright test`).

- [ ] **Step 1: Write the failing tests** in `tests/unit/build.spec.js`:

```js
test('unminified output starts with header comment then the layer statement', async () => {
  const { css } = await build();
  expect(css).toMatch(/^\/\*![^]*?\*\/\s*@layer reset, tokens, base, layout, components, utilities, overrides;/);
});
test('minified output keeps exactly one comment, the banner', async () => {
  const { min } = await build();
  expect(min.match(/\/\*/g)).toHaveLength(1);
  expect(min.startsWith(`/*! barely-css v${pkg.version} | MIT License */`)).toBe(true);
});
test('every source file except layers.css wraps its rules in its layer', async () => {
  // reset.css -> @layer reset {, tokens.css -> @layer tokens {, all others -> @layer base {
});
test('build is deterministic', async () => { expect((await build()).css).toBe((await build()).css); });
test('dist files are current with src', async () => {
  const { css, min } = await build();
  expect(readFileSync('dist/barely.css', 'utf8')).toBe(css);
  expect(readFileSync('dist/barely.min.css', 'utf8')).toBe(min);
});
test('minify keeps strings and data URIs intact', () => {
  const input = `a { background: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16'%3E%3C/svg%3E"); }`;
  expect(minify(input, '/*! b */')).toContain(`viewBox='0 0 16 16'`);
});
```

- [ ] **Step 2: Run** `pnpm exec playwright test --project=unit` — Expected: FAIL, `build` not found.

- [ ] **Step 3: Implement `scripts/build.js`.** Header comment for `barely.css`: `/*! barely-css v<version> | MIT License | <one line pointing readers to the token section> */`. Each file is joined with a `/* ==== <file name> ==== */` divider so readers can navigate. `minify` is hand-written with no dependencies: remove comments (skipping string contents), collapse whitespace runs to one space (outside strings), and remove spaces next to `{`, `}`, `;`, `,` and after `:` only inside declaration blocks. Then prepend the banner. Leave everything else alone; Task 3 proves equivalence in a browser.

- [ ] **Step 4: Add `playwright.config.js`** with one project `{ name: 'unit', testDir: 'tests/unit' }` (browser projects arrive in Task 3), and `package.json` scripts `build`, `check:dist`, `test`. Add `reports/` and `test-results/` and `playwright-report/` to `.gitignore`.

- [ ] **Step 5: Create `CHANGELOG.md`** in Keep a Changelog format with the "Changed defaults" heading documented in a short preamble and an empty `## [Unreleased]`.

- [ ] **Step 6: Run** `pnpm build && pnpm exec playwright test --project=unit` — Expected: PASS.

- [ ] **Step 7: Commit** — `build: add source concatenation and minified dist`

### Task 2: Tokens, theme scopes, token-pair contrast, source lint

**Files:**
- Modify: `src/tokens.css`
- Create: `tests/helpers/color.js`, `tests/unit/contrast-tokens.spec.js`, `tests/unit/source-lint.spec.js`

**Interfaces:**
- Produces (`tests/helpers/color.js`, pure functions):
  - `parseColorTokens(css: string): Map<string, { light: [number, number, number], dark: [number, number, number] }>` — key is the name after `--barely-color-`.
  - `deriveHover(lch: number[], theme: 'light' | 'dark'): number[]` — `l ∓ 0.07`, `c` and `h` unchanged.
  - `oklchToLinearSrgb(lch: number[]): [number, number, number]` — Ottosson OKLab matrices, each channel clamped to `[0, 1]` (this matches the colors preview).
  - `srgb8ToLinear(rgb: number[]): [number, number, number]` — for 0–255 channels.
  - `luminance(linear: number[]): number` and `contrast(linearA: number[], linearB: number[]): number`.
- Produces (tokens, for every later task): all names below.

Token defaults (the color values are the spec table verbatim; everything else is a builder's call pinned here):

| Token | Default |
| --- | --- |
| 12 `--barely-color-*` tokens (all except `primary-hover`) | `light-dark(<light>, <dark>)` from the spec's Color tokens table |
| `--barely-font-sans`, `--barely-font-mono` | see Global Constraints |
| `--barely-font-size` | `clamp(1rem, 0.95rem + 0.2vw, 1.0625rem)` |
| `--barely-line-height` | `1.6` |
| `--barely-line-height-heading` | `1.2` |
| `--barely-font-weight-heading` | `700` |
| `--barely-font-size-h1` … `-h6` | `clamp(2rem, 1.6rem + 1.8vw, 2.75rem)`, `clamp(1.625rem, 1.4rem + 1vw, 2.125rem)`, `clamp(1.375rem, 1.25rem + 0.6vw, 1.625rem)`, `1.25rem`, `1.0625rem`, `1rem` |
| `--barely-spacing` | `1rem` (vertical rhythm between flow blocks; Pico-like density) |
| `--barely-radius` | `0.375rem` (code, pre, mark, dialog, popover) |
| `--barely-border-width` | `1px` |
| `--barely-shadow` | `0 0.5rem 2rem oklch(0 0 0 / 0.18)` — the only color literal outside the color tokens; it lives in `tokens.css`, so the lint allows it |
| `--barely-content-width` | `72rem` |
| `--barely-reading-width` | `70ch` |
| `--barely-page-padding-inline` | `clamp(1rem, 0.5rem + 2.5vw, 2rem)` |
| `--barely-page-padding-block` | `clamp(2rem, 1rem + 4vw, 4rem)` |
| The 10 form tokens from the spec table, except `--barely-control-background` | the "Preview default" column |
| `--barely-control-background` | **not declared**; documented as defaulting to `--barely-color-background` at use sites |

Theme rules in `tokens.css`: `:root { color-scheme: light dark; }`, `:where([data-theme="light"]) { color-scheme: light; }`, `:where([data-theme="dark"]) { color-scheme: dark; }`.

- [ ] **Step 1: Write the failing token-pair test** in `tests/unit/contrast-tokens.spec.js`. Build the pair list from the spec's contrast matrix (13 rows expand to 22 pairs) and run each in both themes, deriving `primary-hover` with `deriveHover`:

```js
for (const theme of ['light', 'dark'])
  for (const [fg, bg, min] of PAIRS)
    test(`${theme}: ${fg} on ${bg} >= ${min}`, () => {
      expect(contrast(lin(fg, theme), lin(bg, theme))).toBeGreaterThanOrEqual(min);
    });
test('pins the spec\'s reported ratios', () => {
  expect(ratio('border-strong', 'surface', 'light')).toBeCloseTo(3.46, 2);
  expect(ratio('warning', 'surface', 'light')).toBeCloseTo(4.78, 2);
  expect(ratio('primary-hover', 'background', 'light')).toBeCloseTo(7.82, 2);
  expect(ratio('primary-hover', 'background', 'dark')).toBeCloseTo(10.45, 2);
});
test('tokens.css declares the 12 base color tokens and not primary-hover', () => { /* names */ });
```

If a pinned ratio is off by more than 0.01, stop and report it; do not adjust the token values.

- [ ] **Step 2: Write the failing source lint** in `tests/unit/source-lint.spec.js`, reading every file in `SOURCES`:
  - `no token value on :root contains var()` (in `tokens.css`, every `--barely-*:` declaration value lacks `var(`).
  - `--barely-* tokens are declared only in tokens.css`.
  - `every var(--barely-*) used resolves to a declared token or a use-site token` — the use-site allowlist is exactly `['--barely-color-primary-hover', '--barely-control-background']`.
  - `no color literals outside tokens.css` — outside `tokens.css`, forbid `#[0-9a-f]{3,8}\b`, `\b(rgba?|hsla?|hwb|lab|lch|oklab)\(`, and any `oklch(` not immediately followed by `from var(--barely-`. Skip contents of `url(...)`.
  - `logical properties only` — forbid declarations matching `(^|[;{\s])(min-|max-)?(width|height)\s*:`, `\b(margin|padding|border)-(top|right|bottom|left)\b`, `(^|[;{\s])(top|right|bottom|left)\s*:`, `text-align:\s*(left|right)`, `float:\s*(left|right)`.
  - `transitions only under reduced-motion no-preference`.
  - `outline is never removed` — forbid `outline:\s*(none|0)\b` and `outline-style:\s*none`.

- [ ] **Step 3: Run** `pnpm exec playwright test --project=unit` — Expected: FAIL on missing tokens.

- [ ] **Step 4: Fill `src/tokens.css`** with the table above inside `@layer tokens { :root { … } }`, each token preceded by a one-line comment saying what it controls (these comments become the readable token API in `dist/barely.css`). Implement `tests/helpers/color.js`.

- [ ] **Step 5: Run** `pnpm build && pnpm exec playwright test --project=unit` — Expected: PASS.

- [ ] **Step 6: Changelog** — Added: color, typography, spacing, page, and form tokens; light and dark themes with `data-theme` scopes.

- [ ] **Step 7: Commit** — `feat(tokens): add color, type, page and form tokens`

### Task 3: Reset, base, demo skeleton, browser harness

**Files:**
- Modify: `src/reset.css`, `src/base.css`, `playwright.config.js`
- Create: `scripts/serve.js`, `demo/index.html`, `tests/helpers/env.js`, `tests/browser/smoke.spec.js`, `tests/browser/axe.spec.js`, `tests/browser/theme.spec.js`, `tests/browser/dist.spec.js`, `tests/browser/file-protocol.spec.js`

**Interfaces:**
- Produces (`tests/helpers/env.js`):
  - `forcedMode(testInfo): 'off' | 'active' | 'media-only'` — `active` for Chromium/Firefox forced projects, `media-only` for WebKit forced.
  - `tabKey(browserName: string): 'Tab' | 'Alt+Tab'` — WebKit uses Option+Tab so links are included.
  - `setTheme(page, theme: 'light' | 'dark' | null): Promise<void>` — sets or removes `data-theme` on `<html>`.
  - `DEMO = '/demo/'`.
- Produces: `scripts/serve.js` serves the repo root on port `4173` with correct `Content-Type` for `.html`, `.css`, `.js`, `.png`, `.svg`, `.json`, `.vtt`, `.webm`, `.mp4`, `.mp3`.
- Produces: Playwright projects. `testDir: 'tests/browser'` for all browser projects; `webServer` runs `node scripts/serve.js`; `baseURL: 'http://localhost:4173'`.

```js
// projects, in playwright.config.js
unit
chromium-light, chromium-dark, firefox-light, firefox-dark, webkit-light, webkit-dark   // colorScheme
chromium-light-forced, chromium-dark-forced, firefox-light-forced, firefox-dark-forced // forcedColors: 'active'
webkit-light-forced                                                                    // media-only
// forced projects: testMatch: /(keyboard|forced-colors)\.spec\.js/
```

- [ ] **Step 1: Write failing browser tests:**
  - `smoke.spec.js` › `body uses tokens and not pure black or white`: computed `font-family` starts with `system-ui`; `line-height` / `font-size` ≈ 1.6; body background is not `rgb(255, 255, 255)` or `rgb(0, 0, 0)`; text color likewise.
  - `theme.spec.js` › `data-theme on html forces the theme`, `nested data-theme scope repaints its subtree` (a `section[data-theme="dark"]` in a light page has the dark background token's rendered color, and the reverse), `native controls follow color-scheme` (computed `color-scheme` on an input inside the nested scope is `dark`).
  - `axe.spec.js` › `demo has no axe violations` using `AxeBuilder` with default rules, run in every non-forced project (both themes via projects, plus `data-theme` toggled to the opposite theme).
  - `dist.spec.js` › `minified CSS produces the same CSSOM` (Chromium-light only): load the demo, serialize every rule's `cssText`; reload with `page.route('**/dist/barely.css', …)` fulfilling `dist/barely.min.css`; serializations are equal.
  - `file-protocol.spec.js` › `demo renders over file://`: open `pathToFileURL('demo/index.html')`; the stylesheet loaded (`document.styleSheets[0].cssRules.length > 0`) and body font is `system-ui`.

- [ ] **Step 2: Run** `pnpm test` — Expected: FAIL.

- [ ] **Step 3: Implement `src/reset.css`** — box sizing exactly as in the spec; `body { margin: 0 }`; `img, video, svg, canvas { display: block }`; `button, input, select, textarea { font: inherit; color: inherit }`; `:where([hidden]:not([hidden="until-found" i])) { display: none }`.

- [ ] **Step 4: Implement `src/base.css`** — `html` gets font family, size, line height, `-webkit-text-size-adjust: 100%`, `text-size-adjust: 100%`; `html, :where([data-theme])` get `background-color: var(--barely-color-background); color: var(--barely-color-text)`; global `:where(:focus-visible)` ring per Global Constraints; `@media (forced-colors: active) { :where(:focus-visible) { outline-color: Highlight } }`.

- [ ] **Step 5: Write `demo/index.html`** — a skeleton that later tasks fill. Structure: `body > header` (masthead with site name link and a theme toggle of three `button`s with `aria-pressed`: System, Light, Dark), `body > main` with one `section` per baseline category (empty headings for now, each with an `id`), `body > footer` with a link. A nested theme section (`section[data-theme="dark"]` and inside it `div[data-theme="light"]`), and an RTL section (`section[dir="rtl"][lang="ar"]`). The toggle uses fewer than 15 lines of inline script that only sets `data-theme` on `<html>`. Link `../dist/barely.css` with a relative URL so `file://` works.

- [ ] **Step 6: Run** `pnpm build && pnpm test` — Expected: PASS in all projects.

- [ ] **Step 7: Changelog** — Added: reset, base typography defaults, focus ring, theme scopes.

- [ ] **Step 8: Commit** — `feat: add reset, base layer and demo skeleton`

### Task 4: Keyboard and forced-colors harness

**Files:**
- Create: `tests/helpers/tab-order.js`, `tests/helpers/page-color.js`, `tests/helpers/pixels.js`, `tests/browser/keyboard.spec.js`, `tests/browser/forced-colors.spec.js`
- Modify: `package.json` (add dev deps `pngjs`, `pixelmatch`)

**Interfaces:**
- Produces (`tests/helpers/tab-order.js`):
  - `tagElements(page): Promise<void>` — sets `data-kb-id="<n>"` on every element in document order.
  - `expectedStops(page): Promise<{ required: string[], optional: string[] }>` — ids in source order. Required: `a[href]`, `button`, `input:not([type=hidden])`, `select`, `textarea`, `summary`, `[tabindex]:not([tabindex="-1"])`, excluding `:disabled`, anything inside a closed `details` (other than its `summary`), a closed `dialog`, or a hidden `[popover]`. Radio groups count once (checked radio, or the first when none is checked). Optional: `video[controls]`, `audio[controls]`, `iframe`, and any element whose `scrollWidth > clientWidth` or `scrollHeight > clientHeight` with `overflow` `auto`/`scroll` and no focusable descendants.
  - `walkTabStops(page, key: string, opts?: { reverse?: boolean, max?: number }): Promise<string[]>` — presses the key from the top (or bottom) and records `document.activeElement`'s `data-kb-id`, collapsing consecutive duplicates (date inputs have inner segments), until focus returns to `body` or `max` (default 400) is hit.
  - `assertOrder(actual, expected): void` — removes optional ids from `actual`, then `expect(actual).toEqual(expected.required)`.
- Produces (`tests/helpers/page-color.js`, all run through `page.evaluate`):
  - `paintedRgba(locator, property: string, pseudo?: string): Promise<[number, number, number, number]>` — reads the computed value and paints it on a 1×1 canvas to get sRGB (engines may report `oklch()`).
  - `effectiveBackground(locator): Promise<[number, number, number]>` — composites background colors up the ancestor chain onto the root background.
  - `focusRingReport(page): Promise<{ id, style, width, contrast, inViewport, covered }>` for the active element.
- Produces (`tests/helpers/pixels.js`): `distinctColorCount(png: Buffer, opts?: { inset?: number }): number`.

- [ ] **Step 1: Write the failing tests** in `keyboard.spec.js`:
  - `every interactive element is reachable in source order` — `assertOrder(await walkTabStops(page, tabKey(browserName)), await expectedStops(page))`.
  - `shift+tab visits the same stops in reverse`.
  - `tabbing past the last element leaves the page` — after the last stop, one more key press leaves `document.activeElement === document.body`.
  - `focus is visible and unobscured at every stop` — for every stop: style not `none`, width ≥ 2, contrast ≥ 3 (skip the contrast check when `forcedMode` is `active`; assert style and width instead), element center inside the viewport, and `document.elementFromPoint(center)` is the element or inside it.

  In `forced-colors.spec.js`:
  - `forced-colors media query applies` (all forced projects, including WebKit).
  - `focus outline is visible in forced colors` (skip unless `active`): Tab to the first link and the first button; outline style not `none`, width ≥ 2.

- [ ] **Step 2: Run** `pnpm test` — Expected: FAIL (helpers missing).

- [ ] **Step 3: Implement the three helpers** to the signatures above.

- [ ] **Step 4: Run** `pnpm test` — Expected: PASS, including the forced projects. These two spec files now cover every element later tasks add to the demo, so later tasks only add element-specific assertions.

- [ ] **Step 5: Commit** — `test: add keyboard and forced-colors harness`

---

## Milestone 2: Typography and page layout

### Task 5: Typography

**Files:**
- Create: `src/typography.css`, `tests/browser/typography.spec.js`
- Modify: `scripts/build.js` (`SOURCES`), `demo/index.html` (typography section)

**Interfaces:**
- Consumes: tokens from Task 2.

Pinned decisions: headings use `--barely-font-size-h1…h6`, `--barely-line-height-heading`, `--barely-font-weight-heading`, `text-wrap: balance`; heading margins `margin-block: calc(var(--barely-spacing) * 2) var(--barely-spacing)`, and a heading that is the first child of its parent gets `margin-block-start: 0`. Flow blocks (`p, ul, ol, dl, blockquote, figure, pre, table, hr, details, form, fieldset`) get `margin-block: 0 var(--barely-spacing)`. Paragraphs `text-wrap: pretty`. `a`: `color: var(--barely-color-primary)`, `text-decoration-thickness: 0.08em`, `text-underline-offset: 0.18em`; `a:hover` uses the hover derivation verbatim; links are underlined always (color isn't the only cue). `blockquote`: `border-inline-start: 0.25rem solid var(--barely-color-border)`, `padding-inline-start: var(--barely-spacing)`, muted text. `hr`: `border: 0; border-block-start: var(--barely-border-width) solid var(--barely-color-border); margin-block: calc(var(--barely-spacing) * 2)`. `mark`: `background-color: var(--barely-color-mark); color: var(--barely-color-text); padding-inline: 0.15em; border-radius: 0.125rem`. `abbr[title]`: dotted underline, `cursor: help`. `small`: `0.875em`. `sub, sup`: `line-height: 0` with `vertical-align`. `del`, `ins`: keep native line-through and underline; text color unchanged. `dt`: bold; `dd`: `margin-inline-start: 1.5rem`.

- [ ] **Step 1: Write the failing tests** in `typography.spec.js`:
  - `heading sizes come from tokens` — set `--barely-font-size-h1: 3rem` on `:root` and on a nested `article`; `h1` font size is 48px in both places.
  - `body line height is 1.6 and headings 1.2`.
  - `links are underlined and use primary`; `link hover uses derived hover` — after `page.hover()`, painted color equals the painted color of a probe element styled with the hover derivation.
  - `mark text meets 4.5:1` (painted).
  - `no Times, Arial or Helvetica in computed font-family of any text element`.
  - `first heading in a region has no top margin`.

- [ ] **Step 2: Run** `pnpm test -- typography` — Expected: FAIL.
- [ ] **Step 3: Implement `src/typography.css`** and add it to `SOURCES`.
- [ ] **Step 4: Fill the demo's typography section** with every element in the spec's Typography row, including nested lists, a `dl`, a `blockquote` with a `cite`, and an `abbr` with `title`.
- [ ] **Step 5: Run** `pnpm build && pnpm test` — Expected: PASS (all projects, keyboard and axe included).
- [ ] **Step 6: Changelog** — Added: typography styles. **Commit** — `feat(typography): style headings, prose and inline elements`

### Task 6: Page layout and structure

**Files:**
- Create: `src/layout.css`, `tests/browser/layout.spec.js`, `tests/pages/no-main.html`, `tests/pages/rtl.html`, `tests/pages/regions.html`
- Modify: `SOURCES`, `demo/index.html`

Pinned decisions: page regions are `body > :where(:not(script, style, template, dialog))` with the spec's `padding-inline: max(…)` formula, verbatim. `body > main` gets `padding-block: var(--barely-page-padding-block)`; `body:not(:has(> main))` gets it on `body`. Masthead `body > header` and `body > footer`: `padding-block: calc(var(--barely-page-padding-block) * 0.4)`, `background-color: var(--barely-color-surface)`; header has a `border-block-end`, footer a `border-block-start`, both `var(--barely-border-width) solid var(--barely-color-border)`; footer text is muted and `0.875rem`. Reading width applies to `:where(p, ul, ol, dl, blockquote, h1, h2, h3, h4, h5, h6, figcaption, form)`. `header`/`footer` inside `article` or `section`: no background, no region padding; header `margin-block-end: var(--barely-spacing)`; footer `margin-block-start: var(--barely-spacing)`, muted, `0.875rem`. `article`, `section` and `aside` get `margin-block-end: calc(var(--barely-spacing) * 2)`; `aside` gets `border-inline-start: 0.25rem solid var(--barely-color-border)` and `padding-inline-start: var(--barely-spacing)`.

- [ ] **Step 1: Write the failing tests** in `layout.spec.js`, at viewport widths 375 and 1280 (`test.use({ viewport })` per describe):
  - `region padding equals the edge token on narrow screens` — at 375, `main`'s `padding-inline-start` equals the resolved `--barely-page-padding-inline`.
  - `content is centered at content-width on wide screens` — at 1600, the content box of `main` is `72rem` (1152px) wide and `header`, `main`, `footer` content boxes share the same start edge.
  - `masthead background reaches both viewport edges` — header's border box spans `0…innerWidth`.
  - `prose is start-aligned` — at 1600, a `p` starts at the content start edge and is ≤ `70ch`; in `tests/pages/rtl.html` it starts at the content's right edge.
  - `page without main pads body` (`no-main.html`): body `padding-block` equals the token; no element has region padding doubled; no horizontal scroll.
  - `script, style, template, dialog are not regions` (`regions.html`): they get no padding.
  - `nested header and footer are not mastheads` — no background, no region padding.
  - `no horizontal scroll at 375 and 1280 on the demo` — `scrollWidth <= clientWidth` on `documentElement`, with the wide unwrapped table temporarily removed (Task 8 re-checks it).
  - `overriding page tokens works` — set `--barely-page-padding-inline: 3rem` on `:root`; main's padding at 375 is 48px.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `src/layout.css`**, add to `SOURCES`, write the three test pages (semantic HTML only, linking `../../dist/barely.css`).
- [ ] **Step 4: Update the demo** with `article` (own `header`/`footer`), `section`, and `aside`, and a link in every region.
- [ ] **Step 5: Run** `pnpm build && pnpm test` — Expected: PASS.
- [ ] **Step 6: Changelog** — Added: page layout without classes. **Commit** — `feat(layout): add page regions, reading width and structure`

### Task 7: Navigation and breadcrumbs

**Files:**
- Create: `src/navigation.css`, `tests/browser/navigation.spec.js`, `tests/pages/nav.html`
- Modify: `SOURCES`, `demo/index.html`

Pinned decisions: `body > header nav` is `display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem var(--barely-spacing)`. `body > header nav > ul` is `display: flex; flex-wrap: wrap; gap: 0.25rem var(--barely-spacing); list-style: none; margin: 0; padding: 0; max-inline-size: none`. Masthead nav links: `padding-block: 0.25rem` so targets are at least 24px tall. Breadcrumbs: `nav[aria-label="breadcrumb" i] > :is(ol, ul)` is `display: flex; flex-wrap: wrap; list-style: none; padding: 0`; separators `li + li::before { content: "/" / ""; margin-inline: 0.5rem; color: var(--barely-color-text-muted) }` (alt text empty so screen readers skip it); `[aria-current="page"]` gets text color and no underline.

- [ ] **Step 1: Write the failing tests** (`nav.html` holds every case):
  - `two-list nav puts lists at start and end edges` (1280).
  - `single list starts at the start edge`.
  - `nav wrapped in a div inside the masthead is still horizontal`.
  - `nested submenu ul stays vertical` — its `display` is not `flex`.
  - `footer, aside, main and article navs are ordinary lists` — `list-style-type` is not `none`, `display` is `block`.
  - `masthead nav wraps at 375 without horizontal scroll`.
  - `breadcrumb matches case-insensitively` — `aria-label="Breadcrumb"` gets the flex layout.
  - `breadcrumb separator is hidden from the accessibility tree` — `locator.ariaSnapshot()` of the breadcrumb contains no `/`.
  - `masthead nav link targets are at least 24px tall`.
- [ ] **Step 2: Run** — FAIL. **Step 3:** Implement and add to `SOURCES`. **Step 4:** Add a two-list masthead nav and a breadcrumb to the demo.
- [ ] **Step 5: Run** `pnpm build && pnpm test` — PASS.
- [ ] **Step 6: Changelog** — Added: masthead navigation and breadcrumbs. **Commit** — `feat(nav): add masthead navigation and breadcrumbs`

---

## Milestone 3: Tables, code, media

### Task 8: Tables and the scroll wrapper

**Files:**
- Create: `src/tables.css`, `tests/browser/tables.spec.js`, `tests/pages/tables.html`
- Modify: `SOURCES`, `demo/index.html`, `tests/browser/keyboard.spec.js`, `tests/browser/layout.spec.js`

Pinned decisions: the spec's "Smaller defaults" list verbatim, plus: `table { inline-size: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums }`; cells `padding: 0.5rem 0.75rem; text-align: start; vertical-align: top; overflow-wrap: anywhere` (Review Focus 1); `tbody tr:nth-child(even)` gets `background-color: var(--barely-color-surface)`; `caption { caption-side: top; text-align: start; padding-block-end: 0.5rem; color: var(--barely-color-text-muted) }`. Wrapper `:where(div[role="region"][tabindex]:has(> table))`: `overflow-x: auto; margin-block-end: var(--barely-spacing)`; its table drops its own bottom margin. `table` never gets a `display` declaration.

- [ ] **Step 1: Write the failing tests:**
  - `table keeps display: table`.
  - `table with a long URL fits at 375` (Review Focus 1) — no horizontal scroll on `documentElement`, cell box inside the table box.
  - `wrapped wide table scrolls inside its wrapper, not the page` at 375.
  - `unwrapped wide table is the only allowed page overflow` — update `layout.spec.js`'s no-scroll test to keep the demo's unwrapped wide table and accept overflow only when removing that one table removes it.
  - `wrapper shows the focus ring`.
  - Add to `keyboard.spec.js`: `table scroll wrapper scrolls with arrow keys` — focus it, press `ArrowRight` three times, `scrollLeft > 0`.
  - `stripe rows have 4.5:1 text contrast` (painted).
- [ ] **Step 2: Run** — FAIL. **Step 3:** Implement. **Step 4:** Demo gets a normal table with `caption`/`thead`/`tbody`/`tfoot`, a wide table with the wrapper, and the same wide table without it.
- [ ] **Step 5: Run** `pnpm build && pnpm test` — PASS.
- [ ] **Step 6: Changelog** — Added: tables and the optional scroll wrapper. **Commit** — `feat(tables): style content tables and the scroll wrapper`

### Task 9: Code and media

**Files:**
- Create: `src/code.css`, `src/media.css`, `tests/browser/code-media.spec.js`, `demo/assets/` (one small PNG, one short WebM with a `.vtt` track, one short audio file; all under 200 KB, all created locally, no external URLs)
- Modify: `SOURCES`, `demo/index.html`

Pinned decisions: `code, kbd, samp, pre` use `--barely-font-mono` at `0.875em`. Inline `code`, `samp`: `background-color: var(--barely-color-surface); padding: 0.1em 0.3em; border-radius: calc(var(--barely-radius) * 0.66)`. `kbd`: same, plus `border: var(--barely-border-width) solid var(--barely-color-border-strong); border-block-end-width: 2px`. `pre`: `background-color: var(--barely-color-surface); padding: var(--barely-spacing); border-radius: var(--barely-radius); overflow-x: auto; line-height: 1.5; tab-size: 4`; `pre code` resets background and padding and uses `font-size: inherit`. Media: `img, video` get `max-inline-size: 100%; block-size: auto`; `audio` gets `display: block; inline-size: 100%`; `iframe` gets `max-inline-size: 100%; border: var(--barely-border-width) solid var(--barely-color-border)`, and `iframe:not([height])` gets `inline-size: 100%; aspect-ratio: 16 / 9; block-size: auto`. `figure { margin-inline: 0 }`; `figcaption` muted, `0.875rem`, `margin-block-start: 0.5rem`.

- [ ] **Step 1: Write the failing tests:**
  - `wide img, video and iframe never overflow at 375`.
  - `iframe with a height attribute keeps it`; `iframe without one is 16:9`.
  - `long pre scrolls inside itself` — `pre.scrollWidth > pre.clientWidth` and no page overflow.
  - `code text meets 4.5:1 on surface` (painted).
- [ ] **Step 2: Run** — FAIL. **Step 3:** Implement. **Step 4:** Add the code and media sections to the demo (`iframe` uses `srcdoc` with plain text so the keyboard walk stays deterministic).
- [ ] **Step 5: Run** `pnpm build && pnpm test` — PASS.
- [ ] **Step 6: Changelog** — Added: code and media. **Commit** — `feat: style code blocks and responsive media`

---

## Milestone 4: Forms

Port the forms preview (see Reference CSS) across Tasks 10–12. Measurements already done there are decisions, not suggestions: block labels, the exclusion list, the hanging indent, `vertical-align: middle`, `[readonly]` not `:read-only`, the invalid padding compensation.

### Task 10: Labels, text-like controls, buttons, range, file, color, fieldset

**Files:**
- Create: `src/forms.css`, `tests/browser/forms.spec.js`
- Modify: `SOURCES`, `demo/index.html`, `tests/browser/forced-colors.spec.js`

**Interfaces:**
- Produces: `TEXT_LIKE` selector, used by Tasks 11 and 12, written as the preview's `:is(input:not([type="checkbox"], [type="radio"], [type="range"], [type="file"], [type="color"], [type="submit"], [type="reset"], [type="button"], [type="image"], [type="hidden"]), select, textarea)` wrapped in `:where()`.

Additions to the preview: `form { max-inline-size: var(--barely-reading-width) }` (already from Task 6); fields inside a form are separated with `margin-block-end: var(--barely-form-gap)` on `label`, `fieldset`; control backgrounds use `var(--barely-control-background, var(--barely-color-background))`. Button hover uses the hover derivation verbatim. In forced colors, `select` gets `forced-color-adjust: none; color: CanvasText; background-color: Canvas; border-color: ButtonText`, so the `currentColor` chevron stays visible (Review Focus 2).

- [ ] **Step 1: Write the failing tests:**
  - `labels are display block` — for every `label` in the demo's form section.
  - `label with inline abbr stays on one line` — at 1280, label text height equals one line height.
  - `control in a stretched label keeps its height` — put two labels in a `display: flex` row (test page markup) where one has two-line text; the other's input is still `--barely-control-height` (44px), not stretched.
  - `unknown input type gets text styling` — `input[type="futuretype"]` has the text-like border and min height.
  - `controls grow at 200% zoom` — set root `font-size: 200%`; an input's height is ≥ 88px, nothing clipped (`scrollHeight <= clientHeight`).
  - `buttons line up with inputs` — `button` and adjacent text input have equal heights.
  - `reset is secondary` — background is the painted `surface`.
  - `select chevron flips in RTL` — `background-position` x differs in a `dir="rtl"` scope.
  - `textarea resizes vertically only, min 6.5rem`.
  - Add to `keyboard.spec.js`: `range steps with arrow keys` — focus the range, `ArrowRight`, its value goes up by its `step`.
  - Forced colors (`active` only): `select chevron is visible` — element screenshot has `distinctColorCount ≥ 2` in the chevron region; `text control border differs from background`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement `src/forms.css`** from the preview, minus checkbox/radio/switch and states.
- [ ] **Step 4: Demo form section** — every input type from the spec's Forms row, using the preview's markup (labels wrapping controls, helper `small` with `aria-describedby`).
- [ ] **Step 5: Run** `pnpm build && pnpm test` — PASS.
- [ ] **Step 6: Changelog** — Added: form controls and buttons. **Commit** — `feat(forms): style labels, text controls and buttons`

### Task 11: Checkbox, radio, switch

**Files:**
- Create: `src/choices.css`, `tests/browser/choices.spec.js`
- Modify: `SOURCES`, `demo/index.html`, `tests/browser/forced-colors.spec.js`, `tests/browser/keyboard.spec.js`

Port the preview's checkbox, radio, switch, and their forced-colors block. The switch knob transition goes inside `prefers-reduced-motion: no-preference`. The demo sets one checkbox `indeterminate` with one line of inline script (indeterminate can only be set from script).

- [ ] **Step 1: Write the failing tests:**
  - `each choice row is at least 24px tall` (2.5.8).
  - `wrapped label text aligns with text, not under the control` — second line's left edge equals the first line's text start.
  - `checked state does not shift the line` — label box top and height equal before and after `check()`.
  - `switch knob mirrors in RTL` — knob `::before` translate sign flips.
  - `check mark, dash and dot render` — element screenshot `distinctColorCount ≥ 2` for checked checkbox, indeterminate checkbox, checked radio, on switch.
  - Forced colors (`active`): the same four plus `disabled checked` render ≥ 2 distinct colors; unchecked border differs from background.
  - Add to `keyboard.spec.js`: `radio buttons move with arrow keys` — focus the checked radio, `ArrowDown`, the next radio is checked and focused.
- [ ] **Step 2: Run** — FAIL. **Step 3:** Implement. **Step 4:** Demo gets checkbox, indeterminate, disabled, radio group, switch, all inside `fieldset`s.
- [ ] **Step 5: Run** `pnpm build && pnpm test` — PASS.
- [ ] **Step 6: Changelog** — Added: checkboxes, radios and switches. **Commit** — `feat(forms): draw checkbox, radio and switch`

### Task 12: Form states and validation

**Files:**
- Create: `src/form-states.css`, `tests/browser/form-states.spec.js`
- Modify: `SOURCES`, `demo/index.html`, `tests/browser/forced-colors.spec.js`

Port the preview's focus, read-only, disabled, invalid, valid, and status-icon rules, and the forced-colors icon rule. The invalid and valid icons stay data-URI masks with `background: currentColor`.

- [ ] **Step 1: Write the failing tests:**
  - `text control focus turns border primary and shows ring`.
  - `disabled control and its label are muted; cursor not-allowed`.
  - `readonly is dashed with surface fill; checkbox is not matched by readonly rules`.
  - `user-invalid after typing` — type `x` in the `type="email" required` field, Tab away; border width 2px, border color is painted `danger`, following `small` is `danger` and its `::before` has a mask. Before interaction, none of this applies.
  - `aria-invalid="true" is invalid on load`; `aria-invalid="false" is valid with a check icon`; `:user-valid is not styled` — a valid typed email keeps the normal border.
  - `invalid input keeps its text position` — the text start x is unchanged between normal and invalid.
  - `no asterisk on required` — `::before`/`::after` content of required inputs' labels is `none`.
  - Forced colors (`active`): `status icons are visible` (`distinctColorCount ≥ 2` on the icon box); `invalid border is 2px`.
- [ ] **Step 2: Run** — FAIL. **Step 3:** Implement. **Step 4:** Demo gets a "Server-rendered errors" group (`aria-invalid` true/false) and a required email field.
- [ ] **Step 5: Run** `pnpm build && pnpm test` — PASS.
- [ ] **Step 6: Changelog** — Added: form states and native validation styling. **Commit** — `feat(forms): add focus, disabled, readonly and validation states`

---

## Milestone 5: Interactive elements

### Task 13: details, dialog, popover, progress, meter

**Files:**
- Create: `src/interactive.css`, `tests/browser/interactive.spec.js`
- Modify: `SOURCES`, `demo/index.html`, `tests/browser/keyboard.spec.js`, `tests/browser/forced-colors.spec.js`

Pinned decisions:
- `details`: `border-block: var(--barely-border-width) solid var(--barely-color-border)`; adjacent `details` share a border (`details + details { border-block-start: 0 }`); `summary { cursor: pointer; padding-block: 0.5rem; font-weight: 600 }`, native marker kept; open content `padding-block-end: var(--barely-spacing)`.
- `dialog` and `[popover]`: `background-color: var(--barely-color-background); color: var(--barely-color-text); border: var(--barely-border-width) solid var(--barely-color-border); border-radius: var(--barely-radius); box-shadow: var(--barely-shadow); padding: calc(var(--barely-spacing) * 1.5); max-inline-size: min(var(--barely-reading-width), 100% - 2 * var(--barely-page-padding-inline))`. `dialog::backdrop { background-color: oklch(from var(--barely-color-text) l c h / 0.45) }`.
- `progress` and `meter`: `appearance: none; inline-size: 100%; block-size: 0.75rem; border-radius: 999px; background-color: var(--barely-color-surface); border: var(--barely-border-width) solid var(--barely-color-border-strong)`. Fill: progress value `primary`; meter optimum `success`, suboptimum `warning`, even-less-good `danger`, via `::-webkit-progress-value`, `::-moz-progress-bar`, `::-webkit-meter-optimum-value` (and `-suboptimum-`, `-even-less-good-`), and `::-moz-meter-bar` with `:-moz-meter-optimum`/`-sub-optimum`/`-sub-sub-optimum`. Each engine's pseudo-elements go in their own rule (an unknown pseudo-element invalidates the whole selector list). Indeterminate `progress` keeps its native animation.
- Forced colors: `progress, meter { forced-color-adjust: none; background-color: Canvas; border-color: ButtonText }` and their value pseudo-elements `background-color: Highlight`.
- Dialog opener: `<button commandfor="demo-dialog" command="show-modal">`; close button `command="close"`. If any engine in Playwright 1.65 lacks invoker commands, replace both with a three-line inline script and note it in the demo source.

- [ ] **Step 1: Write the failing tests:**
  - `details opens and closes with Enter and Space` (keyboard.spec).
  - `content inside closed details cannot receive focus` (keyboard.spec; also enforced by `expectedStops`).
  - `popover opens from its button and closes with Esc` (keyboard.spec).
  - `dialog closes with Esc and returns focus to the opener` (keyboard.spec).
  - `dialog fits at 375` — dialog box inside the viewport with page padding on both sides.
  - `meter shows optimum, suboptimum and even-less-good in the status colors` — element screenshot's dominant fill differs between the three meters.
  - Forced colors (`active`): `progress and meter fills are visible` — `distinctColorCount ≥ 2`.
- [ ] **Step 2: Run** — FAIL. **Step 3:** Implement. **Step 4:** Demo gets two `details`, a dialog with opener and close button, a popover with its `popovertarget` button, a determinate and an indeterminate `progress`, and three `meter`s (`low`/`high`/`optimum` set to hit each state).
- [ ] **Step 5: Run** `pnpm build && pnpm test` — PASS.
- [ ] **Step 6: Changelog** — Added: details, dialog, popover, progress and meter. **Commit** — `feat: style native interactive elements`

---

## Milestone 6: Contrast layers, fixtures, visual regression

### Task 14: Rendered-state contrast

**Files:**
- Create: `tests/browser/contrast-states.spec.js`

**Interfaces:**
- Consumes: `paintedRgba`, `effectiveBackground` (Task 4), `contrast`, `srgb8ToLinear` (Task 2).

Cases, each in every non-forced project and with `data-theme` both unset and set to the opposite theme. Minimum 4.5:1 for text, 3:1 for control borders and focus rings:

| State | How it is driven | Measured |
| --- | --- | --- |
| default | load | body text, muted text (`small`, `figcaption`, `caption`), links, code, mark, stripe rows, each status message |
| hover | `page.hover()` on a link, a submit button, a reset button | link text; button label on fill |
| focus | Tab to a link, a button, a text field | ring vs background (3:1); field border (3:1) |
| user-invalid | type invalid value, Tab away | border (3:1), message text |
| disabled | load | not measured for text contrast (WCAG exempts disabled controls); measure that the border is present |
| read-only | load | text on surface |
| checked | `check()` | control fill vs background (3:1) |

- [ ] **Step 1: Write the tests** from the table, one `test()` per row and target, named `<state>: <element>`.
- [ ] **Step 2: Run** `pnpm test -- contrast-states` — Expected: PASS. A failure here is a real CSS bug: find the rule using the wrong token and fix it in `src/` in this task. Before 1.0 no changelog line is needed, because the element's Added line already covers it.
- [ ] **Step 3: Commit** — `test: measure contrast of rendered states`

### Task 15: Token propagation

**Files:**
- Create: `tests/browser/token-propagation.spec.js`

**Interfaces:**
- Consumes: `paintedRgba` (Task 4).

Method: placeholders are `oklch(0.62 0.13 <h>)` with `h` = `0, 28, 56, …` (one hue per color token, 12 tokens), set as plain values (not `light-dark()`). Allowed colors = the painted placeholders, plus derived colors painted from probe elements: the hover derivation of the placeholder primary (both themes), and the backdrop derivation of the placeholder text. Match within ±2 per channel. Skip fully transparent values.

- [ ] **Step 1: Write the tests:**
  - `every styled color follows the tokens (overrides on :root)`.
  - `every styled color follows the tokens (overrides on a nested section)` — wrap the demo `main` content's form, table, and typography sections in the override scope; check only elements inside it. Covers Review Focus 3.
  
  For each element in scope, in default, hover (links, buttons), focus (link, button, field), checked, user-invalid, and disabled states, check `color`, `background-color`, `border-*-color` (only where the border width > 0), `outline-color` (only when outline style isn't `none`), `text-decoration-color`, and `::before`/`::after` `background-color` where `content` isn't `none`. Every value must be in the allowed set. On failure, print the element's tag, `data-kb-id`, property, and painted value.
- [ ] **Step 2: Run** — Expected: PASS. A failure is a hard-coded or wrongly derived color; fix it in `src/`.
- [ ] **Step 3: Commit** — `test: prove every color follows the tokens`

### Task 16: Visual regression fixtures

**Files:**
- Create: `tests/fixtures/01-typography.html` … `09-rtl.html`, `tests/fixtures/10-course-page.html`, `tests/fixtures/assets/` (local images only), `tests/unit/fixtures-lint.spec.js`

- [ ] **Step 1: Write the failing lint** `fixtures-lint.spec.js`:
  - `fixtures use no class attributes` — the only `role="region"` wrapper exception is allowed.
  - `fixtures load no external resources` — no `http(s)://` in `src`, `href` of `link`/`script`/`img`/`iframe`, or `url(`.
  - `fixtures contain no dates or random values` — no `<script>` in any fixture except fixture 7, which may hold one line calling `showModal()` and `showPopover()`.
  - `fixture list is complete` — exactly the ten file names.
- [ ] **Step 2: Write fixtures 1–9** per the spec's list, with realistic content at realistic length (no lorem ipsum). Fixture 7 opens its dialog and popover on load. Fixture 9 uses Arabic content with `dir="rtl" lang="ar"` on `<html>` and includes a form and a table.
- [ ] **Step 3: Fixture 10 needs the owner.** Ask the owner for one real course page, then remove names, emails, and student data, keeping the structure. Until it arrives, the lint test lists it as `test.fixme`. Do not invent a stand-in course page.
- [ ] **Step 4: Run** `pnpm exec playwright test --project=unit` — PASS (fixture 10 `fixme`).
- [ ] **Step 5: Commit** — `test: add visual regression fixtures`

### Task 17: Visual regression runner and report

**Files:**
- Create: `tests/visual/visual.config.js`, `tests/visual/baseline.js`, `tests/visual/capture.spec.js`, `tests/visual/states.js`, `tests/visual/report.js`, `tests/unit/baseline.spec.js`
- Modify: `package.json` (script `visual`)

**Interfaces:**
- Produces (`baseline.js`): `resolveBaseline(opts?: { ref?: string }): Promise<{ label: string, css: string }>`. Order: `BARELY_BASELINE_REF` env or `opts.ref` (a git ref) wins; else, if a `v*` tag exists, fetch `https://registry.npmjs.org/barely-css/-/barely-css-<version>.tgz` for the newest tag and extract `package/dist/barely.css` with the system `tar`; else `git show <ref>:dist/barely.css`, where `ref` is `HEAD` if the working-tree `dist/barely.css` differs from `HEAD`'s, otherwise `HEAD~1`. `label` names the source (`npm 1.0.0`, `git HEAD~1`).
- Produces (`states.js`): `export const STATES: { fixture: string, name: string, run: (page) => Promise<void> }[]` — link focus and hover (fixture 1), button focus and hover and field focus and `:user-invalid` after typing (fixture 4), open `details` (fixture 3).
- Produces (`report.js`, the config's `globalTeardown`): reads `reports/visual/results/*.json` and writes `reports/visual/index.html` with summary counts, then one section per fixture listing only changed screenshots, each with baseline, current, and diff images side by side, and labels for engine, theme, width, state, and changed-pixel percentage.

Matrix in `visual.config.js`: projects for Chromium, Firefox, WebKit × light, dark; plus Chromium and Firefox × light, dark with `forcedColors: 'active'`. `capture.spec.js` generates one test per fixture × width (`375`, `768`, `1280`) and one per `STATES` entry. Each test: render with the baseline CSS by fulfilling `**/dist/barely.css` through `page.route`, screenshot (`fullPage: true, animations: 'disabled', caret: 'hide'`), render with the current file, screenshot, compare with `pixelmatch` (`threshold: 0.1`), write PNGs and a result JSON. Tests never fail on a difference; they fail only on errors.

- [ ] **Step 1: Write the failing unit test** `baseline.spec.js`: `uses HEAD~1 when dist is unchanged` and `uses HEAD when dist differs` (temporarily write a changed `dist/barely.css` copy in a temp git repo created in the test, not the real one); `env ref wins`.
- [ ] **Step 2: Run** — FAIL. **Step 3:** Implement `baseline.js`. **Step 4:** Run — PASS.
- [ ] **Step 5: Implement** config, capture, states, report. Add `"visual": "playwright test -c tests/visual/visual.config.js"`.
- [ ] **Step 6: Run** `pnpm visual` with `BARELY_BASELINE_REF=HEAD` and an unchanged build — Expected: the report shows 0 changed screenshots. Then change `--barely-spacing` locally to `1.5rem`, `pnpm build && pnpm visual` — Expected: report lists changes in every fixture. Revert.
- [ ] **Step 7: Commit** — `test: add visual regression suite and report`

---

## Milestone 7: Packaging and documentation

### Task 18: Package, README, license

**Files:**
- Modify: `package.json`
- Create: `README.md`, `LICENSE`, `tests/unit/package.spec.js`, `tests/unit/readme.spec.js`

`package.json` changes: remove `"private": true`; add `"files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"]`, `"style": "dist/barely.css"`, `"exports": { ".": "./dist/barely.css", "./barely.css": "./dist/barely.css", "./barely.min.css": "./dist/barely.min.css", "./package.json": "./package.json" }`, `"repository"`, `"homepage"`, `"bugs"` pointing at `github.com/narcisolobo/barely-css`. Keep `"version": "0.0.0"`. Check that `barely-css` is free on npm (`pnpm view barely-css` returns 404) and report the result; do not publish.

`LICENSE`: MIT. Ask the owner for the copyright holder's name before writing it.

- [ ] **Step 1: Write the failing tests:**
  - `package.spec.js`: `exports, style and files point to existing dist files`; `version is unchanged by this task` (equals `0.0.0`).
  - `readme.spec.js`:
    - `installation opens with the CDN link tag` — the first code block after the "Installation" heading is the spec's `<link>` snippet verbatim.
    - `CDN section shows major and exact-version links` and `exact-version link has an integrity attribute`.
    - `documents every token` — every `--barely-*` declared in `tokens.css`, plus the two use-site tokens, appears in the token reference.
    - `support statement matches features used` — for each `{ name, readme, src }` in `[{ 'cascade layers', /cascade layers/, /@layer/ }, { 'nesting', /nesting/, /&/ }, { ':has()', /:has\(\)/, /:has\(/ }, { 'light-dark()', /light-dark\(\)/, /light-dark\(/ }, { 'relative color', /relative color/, /oklch\(from/ }, { ':user-invalid', /:user-invalid/, /:user-invalid/ }]`, the README mentions it if and only if `dist/barely.css` uses it. (If the source doesn't use nesting, drop "nesting" from the statement.)
    - `customization example passes the contrast matrix` — parse the README's example primary `light-dark()` and run the spec's `primary` pairs with `tests/helpers/color.js`.
    - `warns against linking main` — README contains "Don't link to `main`" or equivalent and no `cdn.jsdelivr.net/gh/` URL.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Write `README.md`** covering every item in the spec's Deliverable 4, in this order: one-line intent, Installation (CDN link, then download `barely.css`, then `pnpm add barely-css`/`npm install barely-css`), CDN versions and SRI, What gets styled, Page layout and the optional table wrapper (with the "only place the page may scroll sideways" note), Theming, Tokens (full reference table generated by hand from `tokens.css` comments), Customizing (the spec's example verbatim, the contrast responsibility note with the pairs list, why one color value fails both themes, how to set a non-derived hover), Browser support (the spec's wording), Coming from Pico (link), Changelog and versioning, License.
- [ ] **Step 4: Run** `pnpm test` — PASS.
- [ ] **Step 5: Changelog** — Added: npm package and README. **Commit** — `docs: add README and prepare package for publishing`

### Task 19: Coming from Pico guide and release runbook

**Files:**
- Create: `docs/migrating/from-pico.md`, `docs/releasing.md`, `tests/unit/docs.spec.js`
- Modify: `README.md` (links)

Pico variable mapping rows (verify each name against Pico v2's source before writing; mark "no equivalent" where none exists): `--pico-font-family`, `--pico-font-family-sans-serif`, `--pico-font-family-monospace`, `--pico-font-size`, `--pico-line-height`, `--pico-font-weight`, `--pico-border-radius`, `--pico-border-width`, `--pico-outline-width`, `--pico-spacing`, `--pico-typography-spacing-vertical`, `--pico-block-spacing-vertical`, `--pico-block-spacing-horizontal`, `--pico-form-element-spacing-vertical`, `--pico-form-element-spacing-horizontal`, `--pico-background-color`, `--pico-color`, `--pico-muted-color`, `--pico-muted-border-color`, `--pico-primary`, `--pico-primary-hover`, `--pico-primary-inverse`, `--pico-mark-background-color`, `--pico-code-background-color`, `--pico-form-element-background-color`, `--pico-form-element-border-color`, `--pico-form-element-invalid-border-color`, `--pico-form-element-valid-border-color`.

`docs/releasing.md` turns the spec's "Cutting a release" steps and every Release criteria item into a checklist, including the manual checks (keyboard-only in Chrome, Firefox, Safari with Option+Tab; forced colors on Windows Contrast themes and Firefox on macOS; the owner's course page).

- [ ] **Step 1: Write the failing tests** in `docs.spec.js`:
  - `Pico guide has the five sections` — "Wrappers can be removed", "What works the same", "What differs", "Variable mapping", "Not supported yet".
  - `every barely token in the mapping exists` — each `--barely-*` named in the mapping table is declared in `tokens.css` or is a use-site token.
  - `README links the guide and the changelog`.
  - `releasing.md lists every release criterion` — one checkbox per bullet in the spec's Release criteria (count = 8).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Write both documents.** The guide's before-and-after example removes a `<main class="container">` wrapper. Check its examples against fixture 10 once it exists.
- [ ] **Step 4: Run** `pnpm test` — PASS.
- [ ] **Step 5: Changelog** — Added: "Coming from Pico" guide. **Commit** — `docs: add Coming from Pico guide and release runbook`

---

## After Task 19

The automated work is done. What remains is the owner's: fixture 10 (if not supplied earlier), the LICENSE name, the manual release checks in `docs/releasing.md`, the visual report review at 375, 768, and 1280px, and the decision to cut `1.0.0-beta.1`.
