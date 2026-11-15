# Coming from Pico

This guide is for pages that use [Pico CSS](https://picocss.com) v2 and are moving to barely-css. Most plain content pages need two changes: swap the stylesheet link and delete the `.container` wrapper. The variable names below were checked against Pico 2.1.1.

## Wrappers can be removed

Pico needs `class="container"` to center the page and give it side padding. barely-css does that for every direct child of `body` (`header`, `main`, `footer`), so the class and the wrapper are not needed. See [Page layout](../../README.md#page-layout).

Before:

```html
<head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
  />
</head>
<body>
  <main class="container">
    <h1>Assignment: Integration Testing with Mocked APIs (Required)</h1>
    <p>
      In this assignment, you'll write <strong>integration tests</strong> for
      the Extract stage of your pipeline.
    </p>
    <ul>
      <li>Use <code>requests-mock</code> to fake HTTP responses.</li>
    </ul>
  </main>
</body>
```

After:

```html
<head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/barely-css@1/dist/barely.min.css"
  />
</head>
<body>
  <main>
    <h1>Assignment: Integration Testing with Mocked APIs (Required)</h1>
    <p>
      In this assignment, you'll write <strong>integration tests</strong> for
      the Extract stage of your pipeline.
    </p>
    <ul>
      <li>Use <code>requests-mock</code> to fake HTTP responses.</li>
    </ul>
  </main>
</body>
```

Only the link and the `<main>` tag change. The content inside is the same, which also means it still reads correctly if you paste it somewhere that applies its own styles, such as a learning management system.

Two other habits from older Pico pages can go, because barely-css doesn't use them:

- `role="grid"` on a `table` (a Pico v1 habit). A plain `table` is styled.
- `class="language-*"` on `code` inside `pre`. barely-css doesn't highlight syntax, so the class does nothing.

## What works the same

- `data-theme="light"` or `data-theme="dark"` on `<html>` forces a theme. On any other element it makes a nested scope.
- A switch is `input[type="checkbox"][role="switch"]`.
- `aria-invalid="true"` marks a field as invalid. A `small` right after the field becomes its error text.
- The masthead `nav` holds one `ul`, or two for a brand on one side and links on the other.
- Native `details` and `summary`, `dialog`, `progress`, `meter` and tables are styled without classes.
- Light and dark themes follow the system setting.

## What differs

- **Only the masthead `nav` is horizontal.** In Pico every `nav > ul` runs in a row. In barely-css only `body > header nav > ul` does. Any other `nav` is an ordinary list.
- **Text and forms stop at a reading width.** Paragraphs, lists, headings, blockquotes and forms are capped at `--barely-reading-width` (`70ch`) and sit at the start edge. Pico stretches them across the container.
- **Page spacing is built in.** The space above the first element and beside the content comes from `--barely-page-padding-block` and `--barely-page-padding-inline`, both fluid. You don't need extra padding or a custom container class.
- **Colors take two values.** Pico declares a color once for light and once for dark under `data-theme`. barely-css sets both in one declaration with `light-dark()`. See [Customizing](../../README.md#customizing).
- **Table stripes are always on.** Every second `tbody` row gets the surface color. Pico only does this with `.striped`, so a table that never used the class will now show stripes. To remove them, set `tbody tr { background-color: transparent; }` in your own CSS.
- **Django `as_div` with help text or errors.** `as_div` puts help text and errors between the label and the input, so those fields keep the full form gap under the label. Wrap the input in the label or use `as_p` for tighter spacing. Fields without help text or errors are spaced correctly.
- **Wide tables don't wrap words.** Cells keep natural word boundaries, so a table with a lot of content can be wider than the page. Wrap it in `<div role="region" tabindex="0" aria-label="...">` to make it scroll inside itself. See [Wide tables](../../README.md#wide-tables).
- **Toggle buttons use `aria-pressed`.** `button[aria-pressed="true"]` is drawn as pressed.
- **Buttons are primary by default.** A `button`, or an `input` of type submit or button, uses the primary color. `input[type="reset"]` is the secondary look.

## Variable mapping

Pico's commonly overridden `--pico-*` custom properties and the `--barely-*` token to set instead. "No equivalent" means barely-css has no token for it.

| Pico variable | barely-css token | Notes |
| ------------- | ---------------- | ----- |
| `--pico-font-family` | `--barely-font-sans` | Pico's default is its sans-serif stack. |
| `--pico-font-family-sans-serif` | `--barely-font-sans` | |
| `--pico-font-family-monospace` | `--barely-font-mono` | |
| `--pico-font-size` | `--barely-font-size` | Pico starts at `100%` and grows at each breakpoint: 106.25% at 576px, 112.5% at 768px, 118.75% at 1024px, 125% at 1280px and 131.25% at 1536px. barely-css is fluid but stops at 1.0625rem, so body text on a desktop is smaller than it was in Pico. See the example below the table. |
| `--pico-line-height` | `--barely-line-height` | Pico `1.5`, barely-css `1.6`. |
| `--pico-font-weight` | no equivalent | Body text keeps the browser weight. Headings have `--barely-font-weight-heading`. |
| `--pico-border-radius` | `--barely-radius` | Controls use `--barely-control-radius`. |
| `--pico-border-width` | `--barely-border-width` | Controls use `--barely-control-border-width`. |
| `--pico-outline-width` | `--barely-focus-ring-width` | The gap is `--barely-focus-ring-offset`. |
| `--pico-spacing` | `--barely-spacing` | Space between blocks. barely-css has no single token for padding inside components. |
| `--pico-typography-spacing-vertical` | `--barely-spacing` | |
| `--pico-block-spacing-vertical` | `--barely-page-padding-block` | Closest match. Top and bottom padding of the page regions. |
| `--pico-block-spacing-horizontal` | `--barely-page-padding-inline` | Closest match. Pico uses it inside cards and dialogs. barely-css uses it for the side padding of the page regions. |
| `--pico-form-element-spacing-vertical` | `--barely-control-padding-block` | Pads fields and buttons. Controls also have a minimum height, `--barely-control-height`, so lowering this alone won't make them shorter. Lower the height token too. |
| `--pico-form-element-spacing-horizontal` | `--barely-control-padding-inline` | Pads fields only. Buttons keep a fixed 1.25rem of side padding, so this token doesn't change them. |
| `--pico-background-color` | `--barely-color-background` | |
| `--pico-color` | `--barely-color-text` | |
| `--pico-muted-color` | `--barely-color-text-muted` | |
| `--pico-muted-border-color` | `--barely-color-border` | Control outlines use `--barely-color-border-strong`. |
| `--pico-primary` | `--barely-color-primary` | |
| `--pico-primary-hover` | `--barely-color-primary-hover` | Derived from the primary color unless you set it. |
| `--pico-primary-inverse` | `--barely-color-on-primary` | Text on primary fills. |
| `--pico-mark-background-color` | `--barely-color-mark` | |
| `--pico-code-background-color` | `--barely-color-surface` | Shared. Surface also fills the masthead and footer bands, disabled and read-only fields, the file button, checkbox and switch parts, table stripes and the reset button. To recolor only code, override it on code: `code, pre { --barely-color-surface: ... }`. |
| `--pico-form-element-background-color` | `--barely-control-background` | Defaults to the page background. |
| `--pico-form-element-border-color` | `--barely-color-border-strong` | Shared. Pico's variable only affects fields. This token also draws the borders of `kbd`, checkboxes, radios, color and file inputs, `progress` and `meter`, the rules under the table head and above the table foot, and the border of pressed and reset buttons. It also fills the switch thumb. |
| `--pico-form-element-invalid-border-color` | `--barely-color-danger` | |
| `--pico-form-element-valid-border-color` | `--barely-color-success` | |

To get Pico's larger desktop text back, set a larger fluid size after the barely-css link:

```css
:root {
  --barely-font-size: clamp(1rem, 0.9rem + 0.45vw, 1.25rem);
}
```

The token sets the root font size, so everything sized in `rem` scales with it, including headings, spacing and controls.

Every color token takes a light and a dark value. Write it as `light-dark(<light>, <dark>)`, and check the contrast of your own colors against the pairs listed in the README under [You are responsible for contrast](../../README.md#you-are-responsible-for-contrast).

## Not supported yet

barely-css v1 is classless. These parts of Pico have no counterpart yet:

- **`.container` and `.container-fluid`**, and **`.grid`**. A class-light layer is planned for v2. Until then, delete `.container`, and build columns with your own CSS.
- **Pico's classes and modifiers**, such as `.secondary`, `.contrast`, `.outline`, `.primary` and `[role="button"]` links styled as buttons.
- **Cards.** `article` is styled as plain page structure, not as a card.
- **Dropdowns** (`details.dropdown`) and **button groups** (`[role="group"]`).
- **Loading state** (`aria-busy="true"`) and **tooltips** (`data-tooltip`).
- **Modals as Pico draws them.** barely-css styles the native `dialog` element, but not Pico's modal markup or its classes.
- **Pico's `--pico-*` variables.** Setting one has no effect. Use the mapping above.

Anything classed that barely-css doesn't know is ignored, so your HTML still renders. It just looks like plain semantic HTML.
