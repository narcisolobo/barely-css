# Changelog

All notable changes to barely-css are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

Any change to a default value (a token, a spacing step, a color) is listed under a **Changed defaults** heading in the release that makes it, so you can see what will look different before you upgrade.

## [Unreleased]

### Added

- Color, typography, spacing, page, and form tokens; light and dark themes with `data-theme` scopes.
- Reset, base typography defaults, focus ring, and theme scopes.
- Typography styles: headings, paragraphs, links, lists, blockquote, rules, and inline text elements.
- Page layout without classes: full-width page regions, centered content, masthead header and footer, reading width, and article, section, and aside structure.
- Masthead navigation (one or two lists, wrapping) and breadcrumbs, with no classes.
- Table styles and an optional scroll wrapper (`div[role="region"][tabindex]` around a `table`), with no classes.
- Code and media styles: `code`, `kbd`, `samp`, scrolling `pre`, responsive `img`, `video`, `audio`, `iframe` (16:9 when it has no height), and `figure` with `figcaption`.
