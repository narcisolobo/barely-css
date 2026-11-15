import { test, expect } from '@playwright/test';

const PAGE = '/tests/pages/real-forms.html';
const TEXT_GAP = 6; // 0.375rem
const WIDTHS = [375, 1280];

/**
 * Runs in the page. Reads one form and returns its fields as { first, last } vertical extents (the first box
 * and the last box of each field), plus the label-to-control gap of every field that has one and the resolved
 * --barely-form-gap. A field is a wrapped label, a fieldset, a div or p (with a preceding error list merged in),
 * a sibling label with its control and small, or a lone button.
 */
function readForm(id) {
  const form = document.getElementById(id);
  const probe = document.createElement('div');
  probe.style.blockSize = 'var(--barely-form-gap)';
  form.append(probe);
  const formGap = probe.getBoundingClientRect().height;
  probe.remove();

  const visible = (el) => getComputedStyle(el).display !== 'none';
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  };
  const kids = [...form.children].filter(visible);
  const fields = [];
  const textGaps = [];
  const wrappedGap = (label, control) => {
    const line = parseFloat(getComputedStyle(label).lineHeight);
    return control.getBoundingClientRect().top - (label.getBoundingClientRect().top + line);
  };
  const siblingGap = (label, control) => control.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
  const pair = (scope) => {
    const label = scope.querySelector(':scope > label[for]');
    const control = label?.nextElementSibling;
    if (control) textGaps.push(siblingGap(label, control));
  };

  let pendingError = null;
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i];
    const tag = el.localName;
    if (tag === 'ul') {
      pendingError = el;
      continue;
    }
    let first;
    let last;
    if (tag === 'p' || tag === 'div') {
      const inner = [...el.children].filter(visible);
      first = box(pendingError ?? inner[0]);
      last = box(inner[inner.length - 1]);
      pair(el);
    } else if (tag === 'label' && el.hasAttribute('for')) {
      const control = kids[i + 1];
      const small = kids[i + 2]?.localName === 'small' ? kids[i + 2] : null;
      first = box(el);
      last = box(small ?? control);
      textGaps.push(siblingGap(el, control));
      if (small) textGaps.push({ small: small.getBoundingClientRect().top - control.getBoundingClientRect().bottom });
      i += small ? 2 : 1;
    } else if (tag === 'label') {
      first = box(el);
      last = box(el);
      const control = el.querySelector(':scope > input:not([type="checkbox"]), :scope > textarea, :scope > select');
      if (control) textGaps.push(wrappedGap(el, control));
    } else {
      first = box(el);
      last = box(el);
    }
    pendingError = null;
    fields.push({ first, last, tag, type: el.getAttribute('type') });
  }
  const formBox = form.getBoundingClientRect();
  return { fields, textGaps, formGap, formBottom: formBox.bottom, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth };
}

for (const width of WIDTHS) {
  test.describe(`real-world form markup at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const id of ['django-p', 'django-div', 'flask-login', 'plain', 'sibling-small']) {
      test(`${id}: label-to-control gap is 0.375rem`, async ({ page }) => {
        await page.goto(PAGE);
        const r = await page.evaluate(readForm, id);
        expect(r.textGaps.length).toBeGreaterThan(0);
        for (const g of r.textGaps) {
          const v = typeof g === 'number' ? g : g.small;
          expect(Math.abs(v - TEXT_GAP), JSON.stringify(g)).toBeLessThanOrEqual(1);
        }
      });

      test(`${id}: the gap between fields is --barely-form-gap, and the last field adds none`, async ({ page }) => {
        await page.goto(PAGE);
        const r = await page.evaluate(readForm, id);
        expect(r.fields.length).toBeGreaterThan(1);
        for (let i = 0; i + 1 < r.fields.length; i++) {
          const gap = r.fields[i + 1].first.top - r.fields[i].last.bottom;
          expect(Math.abs(gap - r.formGap), `field ${i} to ${i + 1}`).toBeLessThanOrEqual(1);
        }
        const last = r.fields[r.fields.length - 1];
        expect(r.formBottom - last.last.bottom).toBeLessThanOrEqual(1);
      });
    }

    test('a hidden input changes nothing, between fields or at the end', async ({ page }) => {
      await page.goto(PAGE);
      for (const id of ['django-p', 'flask-login', 'plain', 'sibling-small']) {
        const before = await page.evaluate(readForm, id);
        const after = await page.evaluate(
          ([formId]) => {
            const form = document.getElementById(formId);
            const hide = () => Object.assign(document.createElement('input'), { type: 'hidden', name: 'h' });
            // Between fields: before every label, paragraph, div and submit (never inside a label-control pair).
            for (const child of [...form.querySelectorAll(':scope > :is(label, p, div, fieldset, input[type="submit"])')]) child.before(hide());
            form.append(hide());
            return null;
          },
          [id],
        );
        expect(after).toBeNull();
        const changed = await page.evaluate(readForm, id);
        // Hidden inputs before every field and at the end of the form: same gaps, same height.
        const gaps = (r) => r.fields.map((f, i) => (i ? f.first.top - r.fields[i - 1].last.bottom : 0));
        expect(gaps(changed).map(Math.round), id).toEqual(gaps(before).map(Math.round));
        expect(changed.formBottom - changed.fields.at(-1).last.bottom, id).toBeLessThanOrEqual(1);
        await page.reload();
      }
    });

    test('the checkbox label keeps its form gap before the submit, and the submit is not block', async ({ page }) => {
      await page.goto(PAGE);
      const r = await page.evaluate(() => {
        const form = document.getElementById('flask-login');
        const label = form.querySelector('label:has(> input[type="checkbox"])');
        const submit = form.querySelector('input[type="submit"]');
        const gap = parseFloat(getComputedStyle(form).getPropertyValue('--barely-form-gap'));
        return {
          gap: submit.getBoundingClientRect().top - label.getBoundingClientRect().bottom,
          display: getComputedStyle(submit).display,
          formGapPx: gap,
        };
      });
      expect(r.display).not.toBe('block');
      expect(r.gap).toBeGreaterThan(14);
    });

    test('bare choices in a fieldset share a line with their label, in evenly spaced rows', async ({ page }) => {
      await page.goto(PAGE);
      for (const id of ['bare-radios', 'bare-checks']) {
        const rows = await page.evaluate((fid) => {
          const fs = document.getElementById(fid);
          return [...fs.querySelectorAll(':scope > input')].map((input) => {
            const a = input.getBoundingClientRect();
            const b = input.nextElementSibling.getBoundingClientRect();
            return { centerA: a.top + a.height / 2, centerB: b.top + b.height / 2, top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
          });
        }, id);
        expect(rows).toHaveLength(3);
        for (const row of rows) expect(Math.abs(row.centerA - row.centerB), id).toBeLessThanOrEqual(4);
        const steps = [rows[1].top - rows[0].top, rows[2].top - rows[1].top];
        expect(Math.abs(steps[0] - steps[1]), id).toBeLessThanOrEqual(1);
        // Rows are separate lines, not one run.
        expect(steps[0]).toBeGreaterThan(rows[0].bottom - rows[0].top);
      }
    });

    test('in a fieldset, a small after a control sits 0.375rem below it and carries the form gap', async ({ page }) => {
      await page.goto(PAGE);
      const r = await page.evaluate(() => {
        const form = document.getElementById('sibling-small');
        const fs = document.createElement('fieldset');
        fs.innerHTML =
          '<label for="fs-a">A</label><input id="fs-a" type="text"><small>One</small>' +
          '<label for="fs-b">B</label><input id="fs-b" type="text"><small>Two</small>';
        form.append(fs);
        const probe = document.createElement('div');
        probe.style.blockSize = 'var(--barely-form-gap)';
        fs.append(probe);
        const gap = probe.getBoundingClientRect().height;
        probe.remove();
        const q = (sel) => fs.querySelector(sel).getBoundingClientRect();
        return {
          gap,
          smallBelow: q('#fs-a + small').top - q('#fs-a').bottom,
          toNext: q('label[for="fs-b"]').top - q('#fs-a + small').bottom,
          trailing: fs.getBoundingClientRect().bottom - q('#fs-b + small').bottom,
        };
      });
      expect(Math.abs(r.smallBelow - TEXT_GAP)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.toNext - r.gap)).toBeLessThanOrEqual(1);
      expect(r.trailing).toBeLessThanOrEqual(1);
    });

    test('the page never scrolls sideways', async ({ page }) => {
      await page.goto(PAGE);
      const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
      expect(r.s).toBeLessThanOrEqual(r.w);
    });
  });
}
