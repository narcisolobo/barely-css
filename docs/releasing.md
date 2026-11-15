# Releasing barely-css

This runbook is for the maintainer. It turns the release criteria and the "Cutting a release" steps in the [design spec](superpowers/specs/2026-11-09-barely-css-design.md) into checklists.

Until every box under "Release criteria" is ticked, publish `1.0.0-beta.N` pre-releases instead of `1.0.0`. jsDelivr's `@1` link does not pick up pre-releases.

## Release criteria

`1.0.0` is published only when all of these are true.

- [ ] Every element in the baseline table is styled and appears on the demo page in both themes. The demo also includes the nested theme scope and the RTL section.
- [ ] The axe scan reports no violations on the demo page, and all three contrast layers pass in both themes: token pairs, rendered states, and token propagation.
- [ ] Both dist files are current with `src/` (`pnpm check:dist`), and the README covers everything listed under Deliverables in the spec.
- [ ] The visual regression report for every fixture, engine, theme, and width has been reviewed, and every screenshot looks deliberately designed at 375px, 768px, and 1280px. For 1.0 there is no earlier release, so this review judges the screenshots on their own.
- [ ] The Playwright suite passes in Chromium, Firefox, and WebKit, including the `file://` check. The demo page has also been checked by hand in current Chrome, Firefox, and Safari.
- [ ] The demo page has been operated by hand with the keyboard only, without a mouse, in current Chrome, Firefox, and Safari. In Safari this uses Option+Tab. Every control can be reached and used, and focus is always visible.
- [ ] The demo page has been checked by hand in forced colors: Edge or Chrome with at least one dark and one light Windows Contrast theme, and Firefox on macOS with its colors set to override the page's colors.
- [ ] At least one of the owner's real course pages renders correctly with only the stylesheet changed from Pico to barely-css, with no classes or wrappers added to the markup.

## Manual checks

Do these by hand. The automated suite can't.

- [ ] **Keyboard only, in Chrome, Firefox and Safari.** Tab through the whole demo page with no mouse. In Safari, turn on "Press Tab to highlight each item on a webpage" in Settings, or use Option+Tab. Check that every control is reachable, focus is always visible, `details` opens with Enter and Space, a `popover` closes with Esc, and a `dialog` closes with Esc and returns focus to its button.
- [ ] **Forced colors on Windows.** In Edge or Chrome, turn on at least one dark and one light Contrast theme (Settings, Accessibility, Contrast themes). Check controls, focus rings, borders, checked and invalid states.
- [ ] **Forced colors in Firefox on macOS.** Settings, General, Colors, then set "Override the colors specified by the page" to always. Check the same things.
- [ ] **The course page.** Confirm that `tests/fixtures/10-course-page.html` still matches the owner's current course page. Open the real page with only the stylesheet link changed from Pico to barely-css, and check that it looks right with no classes or wrappers added.

## Before cutting the release

1. [ ] Run `pnpm build && pnpm test`. All projects pass.
2. [ ] Run `pnpm visual` against the previous release and open the report. Review every fixture at 375, 768 and 1280px. Every difference must match an entry under `[Unreleased]` in `CHANGELOG.md`. Add missing entries, or fix the CSS if a difference wasn't intended.
3. [ ] Choose the version from the headings under `[Unreleased]`:
   - Removed, or anything listed as breaking under Major in the spec: major.
   - Added or Changed defaults: at least minor.
   - Only Fixed: patch.
4. [ ] Rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD` and add a new, empty `[Unreleased]` above it. Update the comparison links at the bottom of the file.
5. [ ] Set the version in `package.json` and run `pnpm build` so `dist/` carries it.
6. [ ] Regenerate the exact-version integrity hash from the released `dist/barely.min.css`:

   ```sh
   openssl dgst -sha384 -binary dist/barely.min.css | openssl base64 -A
   ```

   In `README.md`, put the result after `sha384-` in the exact-version snippet, and change the version in that snippet's URL to `x.y.z`.
7. [ ] Remove this sentence from `README.md`: "The hash and version in the exact-version link above are placeholders until `1.0.0` is published."
8. [ ] Run `pnpm test` again. The README tests check the snippet and the hash.
9. [ ] Commit with the message `chore(release): x.y.z`.

## Publishing

1. [ ] Tag the commit `vx.y.z`.
2. [ ] Publish to npm.
3. [ ] Check that `https://cdn.jsdelivr.net/npm/barely-css@x.y.z/dist/barely.min.css` loads, and that its sha384 matches the README hash. Version-range links such as `@1` can take a while to update.

A major release also ships its migration guide, `docs/migrating/vN-to-vN+1.md`, written during the beta period and linked from the changelog entry and the README.
