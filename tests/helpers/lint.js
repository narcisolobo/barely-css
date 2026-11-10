/** Returns the transition declarations in `css` (already comment-stripped) that sit outside
 *  an @media (prefers-reduced-motion: no-preference) block, nested or not. */
export function findBareTransitions(css) {
  const bad = [];
  for (const m of css.matchAll(/(^|[;{\s])transition(-[a-z-]+)?\s*:/g)) {
    const end = m.index + m[1].length; // m[1] may be the "{" that opens the enclosing block
    const stack = [];
    for (let i = 0; i < end; i++) {
      if (css[i] === '{') {
        const start = Math.max(css.lastIndexOf('}', i - 1), css.lastIndexOf('{', i - 1), css.lastIndexOf(';', i - 1)) + 1;
        stack.push(css.slice(start, i));
      } else if (css[i] === '}') stack.pop();
    }
    if (!stack.some((p) => /@media[^{]*prefers-reduced-motion:\s*no-preference/.test(p)))
      bad.push(m[0].trim());
  }
  return bad;
}
