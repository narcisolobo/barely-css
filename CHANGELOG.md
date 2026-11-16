# Changelog

All notable changes to barely-css are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

Any change to a default value (a token, a spacing step, a color) is listed under a **Changed defaults** heading in the release that makes it, so you can see what will look different before you upgrade.

## [Unreleased]

### Added

- npm package setup (`exports`, `style`, `files`, MIT `LICENSE`) and a README with installation, CDN links with integrity, the token reference, customizing, theming and browser support.
- Color, typography, spacing, page, and form tokens; light and dark themes with `data-theme` scopes.
- Reset, base typography defaults, focus ring, and theme scopes.
- Typography styles: headings, paragraphs, links, lists, blockquote, rules, and inline text elements.
- Page layout without classes: full-width page regions, centered content, masthead header and footer, reading width, and article, section, and aside structure.
- A `table`, `pre` or `details` placed directly in `body` (a page with no `main`) lines up with the page's text instead of running edge to edge.
- Masthead navigation (one or two lists, wrapping) and breadcrumbs, with no classes.
- Table styles and an optional scroll wrapper (`div[role="region"][tabindex]` around a `table`), with no classes.
- Code and media styles: `code`, `kbd`, `samp`, scrolling `pre`, responsive `img`, `video`, `audio`, `iframe` (16:9 when it has no height), and `figure` with `figcaption`.
- Long words and URLs in prose, links and headings wrap at the edge of the line instead of making the page scroll sideways. Table cells still break only at natural word boundaries.
- Long inline `code`, `kbd` and `samp` break at the edge of the line instead of widening the page; `pre` still scrolls inside itself.
- Form controls and buttons: block labels that wrap their controls, text-like inputs (including unknown types), `select`, `textarea`, range, file, color, `fieldset` and `legend`, and primary and reset buttons, with no classes.
- Checkboxes, radios and switches (`input[type="checkbox"][role="switch"]`) drawn with tokens, with the label beside the control, a 24px minimum row, and a mirrored switch in right-to-left text.
- A checkbox, radio or switch placed before its `label for` (not wrapped by it) stays inside the page edge, and a `label for` placed before its text field, `select` or `textarea` is spaced like a wrapping label.
- A wrapping label's control (and the control after a `label for`) sits 0.375rem below the label text, as the design calls for. Before, the margin was overridden and the gap was 0.
- A `div` or `p` that holds a control and sits directly in a `form` or `fieldset` is spaced like a field: it takes the form gap after it unless it is the last child. This covers Django `as_p` and `as_div` and Flask-WTF field wrappers. A `div` or `p` with no control keeps its normal spacing.
- Sibling-label fields: a `small` right after the control sits 0.375rem below it and carries the form gap, in a form and in a fieldset. A button, a submit or a hidden input after a label no longer counts as a labelled field, and a hidden input never changes the spacing between fields.
- Bare radios and checkboxes placed directly in a fieldset (an `input`, then its `label for`) share a line with their label, one pair per row.
- In a Django `as_p` field (and other `div` or `p` fields), help text in a `span` or `small` after the input sits 0.375rem under it, and the field carries the form gap once. Any `span` directly after a control that follows a `label for` is styled as help text.
- Form states and native validation styling: focus border, read-only, disabled controls and buttons, `:user-invalid` and `aria-invalid` with an icon and a thicker border, and forced-colors support.
- A disabled indeterminate checkbox is filled and visible, like a disabled checked one; an invalid checkbox or radio keeps the system border color in forced-colors mode; and a `select` with `multiple` or a `size` above 1 no longer gets the drop-down chevron.
- Toggle button pressed state: `button[aria-pressed="true"]` gets the secondary fill, a strong border and an inset top edge.
- Native interactive elements: `details` and `summary`, `dialog` with its backdrop, `[popover]`, `progress` and `meter` (with optimum, suboptimum and even-less-good colors), with forced-colors support.
- A "Coming from Pico" guide with a variable mapping, linked from the README.
- A block-level `data-theme` scope (`div`, `section`, `article`, `aside`, `form`) is inset by 1.5 times `--barely-spacing` so its content doesn't touch the painted edge, and a labelled text field outside a form, fieldset or `p` now has the form gap before the next block. A scope directly in `body`, on an inline element or on a control gets no extra padding.
- Headings in an `aside` step down two levels, to `h6` at the smallest, so a table of contents or footnotes don't compete with the page's sections.
- A breadcrumb with a label in another language is styled: a `nav` whose `ol` ends in an `li` with `aria-current="page"` counts as a breadcrumb, as well as `nav[aria-label="breadcrumb"]`.

[Unreleased]: https://github.com/narcisolobo/barely-css/commits/main
