// A tiny helper for building page elements safely.

/**
 * el(tag, props, ...children) -> HTMLElement
 *
 * Build an element. Text always goes in as text (never HTML), so nothing typed can run as code.
 *
 *   - `props` — `class`, `text`, `dataset`, `style` (CSS properties), `on<Event>` handlers, or any
 *               attribute (false/null skips it, true sets it empty)
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') Object.entries(v).forEach(([p, val]) => node.style.setProperty(p, val));
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  });
  children.flat().forEach((c) => { if (c != null && c !== false) node.append(c); });
  return node;
}

/** Whether the viewer asked for less motion. */
export const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
