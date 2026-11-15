# barely-css

A classless CSS stylesheet. Link one file, write plain semantic HTML, and the page looks designed in light and dark themes. No classes, no build step, no JavaScript.

## Installation

Add this one line to the `<head>` of your page. It needs no npm, no build step and no JavaScript:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/barely-css@1/dist/barely.min.css"
/>
```

Or download [`barely.css`](https://cdn.jsdelivr.net/npm/barely-css@1.0.0/dist/barely.css) (the unminified file for version 1.0.0), save it next to your pages and link it from disk. It works over `file://`, so you can open the page straight from a folder:

```html
<link rel="stylesheet" href="barely.css" />
```

`barely.css` keeps its comments, which describe every token. Read it to learn the options, or edit your own copy.

With npm, for a bundler or a build step:

```sh
pnpm add barely-css
# or: npm install barely-css
```

Then import it. `barely-css` resolves to the unminified `dist/barely.css`, and `barely-css/barely.min.css` is the minified copy:

```css
@import "barely-css";
```

## CDN versions and integrity

The CDN is [jsDelivr](https://www.jsdelivr.com/), which serves the npm package. Pick one of two links.

**Major version.** For most people. You get fixes automatically, and nothing changes in a way that breaks your markup within version 1:

```
https://cdn.jsdelivr.net/npm/barely-css@1/dist/barely.min.css
```

jsDelivr caches version-range links for a while, so a new release can take some time to appear.

**Exact version.** Locks the file down. Subresource integrity only works with an exact version, so this is the link to use with an `integrity` attribute:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/barely-css@1.0.0/dist/barely.min.css"
  integrity="sha384-/AkVHMRiZdTZwkXoxw/p6CmfVTiv/26fpn8tmrjOoDqnLPZULOYc2rbtGrKeS9S7"
  crossorigin="anonymous"
/>
```

The hash belongs to one exact file. If a link and its hash ever disagree, the browser refuses to load the stylesheet.

Don't link to `main`, and don't use jsDelivr's GitHub-branch URLs. `main` is the development version and can change at any time. Only published releases are safe to link: the npm package, the jsDelivr links above, or the files attached to a release.

## What gets styled

No classes are needed. Write the HTML that fits the content.

| Category | Elements |
| -------- | -------- |
| Typography | `h1` to `h6`, `p`, `ul`, `ol`, `dl`, `blockquote`, `hr`, `a`, `strong`, `em`, `small`, `mark`, `abbr`, `sub`, `sup`, `del`, `ins` |
| Code | `pre`, `code`, `kbd`, `samp` |
| Structure | `header`, `main`, `footer`, `section`, `article`, `aside` |
| Navigation | `nav` in the page header, and breadcrumbs with `nav[aria-label="breadcrumb"]` |
| Tables | `table`, `caption`, `thead`, `tbody`, `tfoot`, `th`, `td` |
| Media | `img`, `figure`, `figcaption`, `video`, `audio`, `iframe` |
| Forms | `label`, `input`, `select`, `textarea`, `fieldset`, `legend`, `button` |
| Interactive | `details` and `summary`, `dialog`, `progress`, `meter`, `[popover]` |

Details worth knowing:

- Only `body > header nav > ul` runs horizontally. Put one list there, or two for a brand at the start edge and links at the end edge. Rows wrap at narrow widths. Every other `nav` is an ordinary list.
- `body > header` and `body > footer` are the page masthead and footer. A `header` or `footer` inside an `article` or `section` gets restrained styling instead.
- A checkbox, radio or switch works with its label either way: wrapped by it (`<label><input> Text</label>`) or followed by a `label for` (`<input id="a"><label for="a">Text</label>`). A `label for` placed before a text field, `select` or `textarea` is spaced like a wrapping label too.
- A switch is `input[type="checkbox"][role="switch"]`.
- A toggle button is `button[aria-pressed="true"]`. It is drawn as pressed, with a different fill, a strong border and an inset top edge, so the state is not shown by color alone.
- Invalid fields are styled from `:user-invalid` (after the person interacts) or `aria-invalid="true"` (for errors your server renders). A `small` right after the field becomes its error text.
- Long words, URLs and inline `code` wrap at the edge of the line instead of widening the page. `pre` blocks scroll inside themselves.
- An `iframe` is responsive and never overflows. The content inside it draws its own focus indicator, and barely-css can't style focus inside another document.
- Focus is always visible, targets are at least 24 by 24 CSS pixels, motion is reduced when the system asks for it, and controls stay visible in forced-colors mode.

## Page layout

Every direct child of `body` is a page region: `header`, `main`, `footer`, or content you place straight in `body`. Each region spans the full width, so its background reaches both edges. Its content is centered at `--barely-content-width` and never closer to the edge than `--barely-page-padding-inline`. You don't need a `.container`.

Paragraphs, lists, headings, blockquotes and forms stop at `--barely-reading-width` and sit at the start edge. Tables, `pre`, figures and media use the full content width.

### Wide tables

Tables keep their native `display: table`, and cells keep natural word boundaries. Words and URLs are never broken in the middle, so a table with a lot of content can be wider than the page. Table readability takes precedence over viewport containment.

To contain a table that is too wide, wrap it in a scrollable region:

```html
<div role="region" tabindex="0" aria-label="Grades by week">
  <table>…</table>
</div>
```

barely-css styles the wrapper if it is there: it scrolls sideways and shows a focus outline, so keyboard users can scroll it. The `aria-label` names the region for screen readers. The wrapper is optional, and the markup still reads fine under any other stylesheet.

Only a wide table without the wrapper can make the page scroll sideways. Long text, URLs and inline code wrap at the edge of the line, and `pre` blocks and the table wrapper scroll inside themselves.

## Theming

- The light and dark themes follow the visitor's system setting (`prefers-color-scheme`).
- `data-theme="light"` or `data-theme="dark"` on `<html>` forces a theme for the whole page.
- On any other element, `data-theme` makes a nested scope, such as a light panel inside a dark page. The scope sets `color` and `background-color` as well as the theme, so its text and background repaint. Any value of `data-theme` sets them, so `data-theme="custom"` works as a hook for your own token overrides.
- Every theme sets `color-scheme`, so native controls and scrollbars match.

Color tokens hold two values, one for light and one for dark, written with `light-dark()`. The page needs no script to switch.

## Tokens

Every public custom property starts with `--barely-`. Override any of them. `--_barely-*` properties are private and can change in any release.

### Colors

Each color has a light and a dark value, in `oklch()`.

| Token | Used for | Light | Dark |
| ----- | -------- | ----- | ---- |
| `--barely-color-background` | Page background | `oklch(0.985 0.004 250)` | `oklch(0.19 0.012 250)` |
| `--barely-color-surface` | Code blocks, table stripes, secondary buttons | `oklch(0.955 0.008 250)` | `oklch(0.23 0.014 250)` |
| `--barely-color-border` | Rules, `hr`, decorative edges. May be low contrast. | `oklch(0.89 0.012 250)` | `oklch(0.33 0.016 250)` |
| `--barely-color-border-strong` | Form control outlines. Reaches 3:1 on background and surface. | `oklch(0.6 0.02 250)` | `oklch(0.58 0.02 250)` |
| `--barely-color-text` | Body text and headings | `oklch(0.25 0.02 250)` | `oklch(0.93 0.008 250)` |
| `--barely-color-text-muted` | Captions, `small`, `blockquote` | `oklch(0.48 0.02 250)` | `oklch(0.74 0.015 250)` |
| `--barely-color-primary` | Links, buttons, focus ring | `oklch(0.5 0.16 255)` | `oklch(0.75 0.12 250)` |
| `--barely-color-primary-hover` | Hover and active states. Derived from primary unless you set it. | primary lightness minus 0.07 | primary lightness plus 0.07 |
| `--barely-color-on-primary` | Text on primary fills | `oklch(0.985 0.004 250)` | `oklch(0.19 0.012 250)` |
| `--barely-color-mark` | Background of `mark` | `oklch(0.93 0.11 95)` | `oklch(0.45 0.09 95)` |
| `--barely-color-success` | Valid state, confirmations | `oklch(0.5 0.12 150)` | `oklch(0.76 0.14 150)` |
| `--barely-color-warning` | Cautions | `oklch(0.53 0.12 65)` | `oklch(0.8 0.13 75)` |
| `--barely-color-danger` | Invalid state, errors | `oklch(0.52 0.18 27)` | `oklch(0.73 0.15 25)` |
| `--barely-control-background` | Fill of text-like controls. Defaults to the page background. | `--barely-color-background` | `--barely-color-background` |

`--barely-color-primary-hover` and `--barely-control-background` are not declared on `:root`. Their defaults are worked out where each rule uses them, which is why an override of `--barely-color-primary` on any element carries through to hover states inside it. Set either one to replace the default.

### Typography

| Token | Used for | Default |
| ----- | -------- | ------- |
| `--barely-font-sans` | Body and heading typeface. System fonts, nothing downloads. | `system-ui` stack |
| `--barely-font-mono` | `code`, `pre`, `kbd`, `samp` | `ui-monospace` stack |
| `--barely-font-size` | Base font size. Fluid. | `clamp(1rem, 0.95rem + 0.2vw, 1.0625rem)` |
| `--barely-line-height` | Line height of body copy | `1.6` |
| `--barely-line-height-heading` | Line height of headings | `1.2` |
| `--barely-font-weight-heading` | Weight of headings | `700` |
| `--barely-font-size-h1` | Size of `h1`. Fluid. | `clamp(2.25rem, 1.5rem + 3.2vw, 3.05rem)` |
| `--barely-font-size-h2` | Size of `h2`. Fluid. | `clamp(1.875rem, 1.35rem + 2.2vw, 2.44rem)` |
| `--barely-font-size-h3` | Size of `h3`. Fluid. | `clamp(1.5625rem, 1.2rem + 1.4vw, 1.95rem)` |
| `--barely-font-size-h4` | Size of `h4`. Fluid. | `clamp(1.3125rem, 1.15rem + 0.7vw, 1.5625rem)` |
| `--barely-font-size-h5` | Size of `h5`. Fluid. | `clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem)` |
| `--barely-font-size-h6` | Size of `h6` | `1rem` |

### Spacing and shape

| Token | Used for | Default |
| ----- | -------- | ------- |
| `--barely-spacing` | Vertical space between blocks | `1rem` |
| `--barely-radius` | Corner radius of code, `pre`, `mark`, `dialog`, popovers | `0.375rem` |
| `--barely-border-width` | Width of rules and borders | `1px` |
| `--barely-shadow` | Shadow under `dialog` and popovers | `0 0.5rem 2rem oklch(0 0 0 / 0.18)` |

### Page

| Token | Used for | Default |
| ----- | -------- | ------- |
| `--barely-content-width` | Maximum width of the content in each page region | `72rem` |
| `--barely-reading-width` | Maximum width of running text and forms | `70ch` |
| `--barely-page-padding-inline` | Smallest space between content and the viewport edge. Fluid. | `clamp(1rem, 0.5rem + 2.5vw, 2rem)` |
| `--barely-page-padding-block` | Top and bottom padding of the page. Fluid. | `clamp(2rem, 1rem + 4vw, 4rem)` |

### Forms

| Token | Used for | Default |
| ----- | -------- | ------- |
| `--barely-control-height` | Minimum height of text-like controls and buttons. Never a fixed height. | `2.75rem` |
| `--barely-control-padding-block` | Vertical padding inside controls | `0.5rem` |
| `--barely-control-padding-inline` | Horizontal padding inside controls | `0.875rem` |
| `--barely-control-radius` | Corner radius of controls and buttons | `0.375rem` |
| `--barely-control-border-width` | Normal control border width | `1px` |
| `--barely-control-border-width-invalid` | Control border width when invalid | `2px` |
| `--barely-check-size` | Checkbox and radio size. A switch is 1.9 times as wide. | `1.25rem` |
| `--barely-focus-ring-width` | Focus outline width | `2px` |
| `--barely-focus-ring-offset` | Focus outline offset | `2px` |
| `--barely-form-gap` | Space between form fields | `1.125rem` |

## Customizing

Override tokens in your own stylesheet, after the barely-css link. Your CSS needs no layer to win.

```css
:root {
  /* Color tokens take a light and a dark value. */
  --barely-color-primary: light-dark(oklch(0.5 0.15 150), oklch(0.75 0.15 150));
  --barely-page-padding-inline: 2rem;
  /* barely-css loads no web fonts. Load Inter yourself, or the stack falls back to system-ui. */
  --barely-font-sans: "Inter", system-ui, sans-serif;
}
```

You don't need a line for the hover color. It is derived from `--barely-color-primary`: 0.07 darker in the light theme and 0.07 lighter in the dark theme, with the same chroma and hue. If you want a hover color that isn't derived, set it the same way:

```css
:root {
  --barely-color-primary-hover: light-dark(oklch(0.42 0.15 150), oklch(0.82 0.15 150));
}
```

**Overrides work on any element.** Setting a token on an element changes the controls, borders, links and hover states inside it. It doesn't repaint that element's own inherited text and background. For that, also put `data-theme` on the element, with any value, for example `data-theme="custom"`. The theme scope sets `color` and `background-color`.

```html
<section data-theme="custom" style="--barely-color-primary: light-dark(oklch(0.5 0.15 150), oklch(0.75 0.15 150))">
  …
</section>
```

### You are responsible for contrast

barely-css's own colors pass WCAG 2.2 AA in both themes. When you override a color token, the contrast of your new value is up to you. These pairs must keep passing in both themes:

| Foreground | Background | Minimum |
| ---------- | ---------- | ------- |
| `text` | `background`, `surface`, `mark` | 4.5:1 |
| `text-muted` | `background`, `surface` | 4.5:1 |
| `primary` | `background`, `surface` | 4.5:1 |
| `primary-hover` | `background`, `surface` | 4.5:1 |
| `on-primary` | `primary`, `primary-hover` | 4.5:1 |
| `success`, `warning`, `danger` | `background`, `surface` | 4.5:1 |
| `border-strong` | `background`, `surface` | 3:1 |

`primary-hover` is checked as text as well as a button fill, because a hovered link uses it as its text color.

### Why a color takes two values

A single value can't suit both themes. For example, `oklch(0.55 0.16 150)` as the primary fails AA in both: 4.29:1 on the light background and 4.12:1 on the dark one. A color that is dark enough for a light page is too dark for a dark page, so give the light and dark values separately with `light-dark()`.

## Browser support

barely-css supports the current and previous major versions of Chrome, Edge, Firefox, and Safari, on desktop and mobile. It is written for browsers from 2024 onward and uses modern CSS directly: cascade layers, `:has()`, `light-dark()`, `oklch()` colors with relative color syntax, and `:user-invalid`. It includes no fallbacks or polyfills.

In older browsers, your HTML still works, because barely-css adds no JavaScript and never hides content. It may look unstyled or partly styled. Bugs that only appear in unsupported browsers aren't fixed.

## Coming from Pico

See [Coming from Pico](docs/migrating/from-pico.md). Most of the markup carries over, and you can usually remove the `.container` wrappers.

## Changelog and versioning

[CHANGELOG.md](CHANGELOG.md) lists every change. Anything that makes existing markup look different is listed under **Changed defaults**, with the token that restores the old look.

barely-css follows [semantic versioning](https://semver.org/):

- **Major:** a public token is renamed or removed, an element is no longer styled, the layer order changes, or markup that worked before needs to change.
- **Minor:** new tokens, newly styled elements, or deliberate changes to default values. Overriding the token restores the old look.
- **Patch:** bug fixes that restore the intended look.

## Contributing

Use pnpm.

```sh
pnpm install
pnpm build          # rebuild dist/ from src/
pnpm test           # the full suite, in Chromium, Firefox and WebKit
pnpm exec playwright test tests/unit/readme.spec.js   # one file
pnpm visual         # the visual regression report
```

`pnpm test -- <name>` ignores filters and runs everything. Use `pnpm exec playwright test <file>` to run part of the suite.

Before a release, regenerate the `integrity` hash in this README for the exact version being published. It must be the sha384 of that release's `dist/barely.min.css`:

```sh
openssl dgst -sha384 -binary dist/barely.min.css | openssl base64 -A
```

The hash and version in the exact-version link above are placeholders until `1.0.0` is published.

The full release checklist is in [docs/releasing.md](docs/releasing.md).

## License

[MIT](LICENSE). Copyright (c) 2026 Narciso Lobo.
