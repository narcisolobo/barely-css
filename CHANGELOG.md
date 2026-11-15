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
- Masthead navigation (one or two lists, wrapping) and breadcrumbs, with no classes.
- Table styles and an optional scroll wrapper (`div[role="region"][tabindex]` around a `table`), with no classes.
- Code and media styles: `code`, `kbd`, `samp`, scrolling `pre`, responsive `img`, `video`, `audio`, `iframe` (16:9 when it has no height), and `figure` with `figcaption`.
- Long words and URLs in prose, links and headings wrap at the edge of the line instead of making the page scroll sideways. Table cells still break only at natural word boundaries.
- Long inline `code`, `kbd` and `samp` break at the edge of the line instead of widening the page; `pre` still scrolls inside itself.
- Form controls and buttons: block labels that wrap their controls, text-like inputs (including unknown types), `select`, `textarea`, range, file, color, `fieldset` and `legend`, and primary and reset buttons, with no classes.
- Checkboxes, radios and switches (`input[type="checkbox"][role="switch"]`) drawn with tokens, with the label beside the control, a 24px minimum row, and a mirrored switch in right-to-left text.
- Form states and native validation styling: focus border, read-only, disabled controls and buttons, `:user-invalid` and `aria-invalid` with an icon and a thicker border, and forced-colors support.
- Toggle button pressed state: `button[aria-pressed="true"]` gets the secondary fill, a strong border and an inset top edge.
- Native interactive elements: `details` and `summary`, `dialog` with its backdrop, `[popover]`, `progress` and `meter` (with optimum, suboptimum and even-less-good colors), with forced-colors support.
- A "Coming from Pico" guide with a variable mapping, linked from the README.
