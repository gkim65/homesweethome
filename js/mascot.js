// Bun, the pink dust bunny: hops around, cheers when you finish chores, and celebrates level-ups.
//
// Bun is drawn as 16x16 pixel art. Each pixel's colour comes from CSS by its class (body `mb`,
// inner ears `mp`, cheeks `mc`, eye shine `mw`, outline `ink`).

import { calm, el } from './dom.js';

const GRID = [
  '................',
  '...kk......kk...',
  '..kbbk....kbbk..',
  '..kbpk....kpbk..',
  '..kbpk....kpbk..',
  '...kbkkkkkkbk...',
  '..kbbbbbbbbbbk..',
  '.kbwbbbbbbbbbbk.',
  '.kbbbkbbbbkbbbk.',
  '.kbbbkbbbbkbbbk.',
  '.kbccbbkkbbccbk.',
  '.kbbbbbbbbbbbbk.',
  '..kbbbbbbbbbbk..',
  '...kkkkkkkkkk...',
  '...kbk....kbk...',
  '...kk......kk...',
];
const CLASS = { k: 'ink', b: 'mb', p: 'mp', c: 'mc', w: 'mw' };

/** Bun as an SVG element, `size` CSS pixels square. */
export function bunSvg(size = 72) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('bun');
  GRID.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!CLASS[ch]) return;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', 1.02);
    r.setAttribute('height', 1.02);
    r.setAttribute('class', CLASS[ch]);
    svg.appendChild(r);
  }));
  return svg;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const OPENERS = ['omg great job!!', 'yaaay!!', 'wowie!!', 'you did it!!', 'sparkle time!!', 'look at you go!!'];
/** Encouragement written for this app (not quotes from anyone). */
const YOU_SHOULD = [
  'You should be so proud of yourself. A tidy corner is a happy corner!',
  'You should take a sip of water and a big stretch!',
  'You should treat yourself to a cozy snack, you earned it!',
  'You should remember: small steps still get you all the way home.',
  'You should give yourself a high five! ✋',
  'You should put on your favourite song for the next one!',
  'You should know that done is better than perfect!',
  'You should rest a little. Your home says thank you!',
  'You should feel sparkly, because you are!',
  'You should light a candle and enjoy the fresh space.',
  'You should be gentle with yourself today. You\'re doing great.',
  'You should do a little victory dance. Nobody\'s watching! 💃',
  'You should know future-you is cheering right now!',
  'You should count this as a win. Every one counts!',
  'You should go admire your work for a sec. ✨',
];

/**
 * cheerLines({ doneToday, allClean }) -> [title, line, quote]
 *
 * What Bun says after a chore is done.
 */
export function cheerLines({ doneToday, allClean }) {
  const count = doneToday === 1 ? 'You finished your first chore today!' : `You finished ${doneToday} chores today!`;
  const extra = allClean ? 'Everything is sparkly clean! Your home is sooo happy!' : pick(YOU_SHOULD);
  return [pick(OPENERS), count, extra];
}

/**
 * createBun(spot, popupHost) -> { jump, say, celebrate, setIdleLine }
 *
 * Put Bun in `spot` (the scene), plus a pop-up copy that hops in from the corner whenever the
 * scene Bun is scrolled out of view.
 *
 *   - `spot`      — element Bun stands in
 *   - `popupHost` — element to hold the pop-up (usually document.body)
 */
export function createBun(spot, popupHost) {
  const make = (size) => {
    const body = el('div', { class: 'bun-body' }, bunSvg(size));
    const wrap = el('div', { class: 'bun-wrap' }, el('div', { class: 'bubble', hidden: true }), el('button', {
      class: 'bun-btn', type: 'button', 'aria-label': 'Bun, your cleaning buddy. Tap to say hi.',
    }, body, el('span', { class: 'bun-shadow' })));
    return { wrap, body, bubble: wrap.querySelector('.bubble'), btn: wrap.querySelector('.bun-btn') };
  };
  const main = make(76);
  spot.append(main.wrap);
  const pop = make(64);
  const popBox = el('div', { class: 'bun-pop', hidden: true, role: 'status', 'aria-live': 'polite' }, pop.wrap);
  popupHost.append(popBox);

  let idleLine = () => ['hi hi!', 'Tap ✓ on a chore when it\'s done and I\'ll cheer!'];
  const timers = new WeakMap();

  function animate(b, cls) {
    b.body.classList.remove('jump', 'spin');
    void b.body.offsetWidth; // restart the animation
    b.body.classList.add(cls);
  }
  function fill(b, lines, ms) {
    b.bubble.replaceChildren(
      el('strong', { text: lines[0] }),
      ...lines.slice(1).filter(Boolean).map((t, i) => el('p', { class: i === 1 ? 'quote' : '', text: t })),
    );
    b.bubble.hidden = false;
    clearTimeout(timers.get(b));
    timers.set(b, setTimeout(() => { b.bubble.hidden = true; if (b === pop) popBox.hidden = true; }, ms));
  }
  const offscreen = () => {
    const r = main.wrap.getBoundingClientRect();
    return r.bottom < 40 || r.top > window.innerHeight - 40 || !r.width;
  };

  /** Say something; `big` makes Bun spin-jump. Uses the pop-up when the scene Bun is out of view. */
  function say(lines, { big = false, ms = 5200 } = {}) {
    const b = offscreen() ? pop : main;
    const other = b === pop ? main : pop;
    other.bubble.hidden = true; // only the newest message shows
    popBox.hidden = b !== pop;
    fill(b, lines, ms);
    animate(b, big ? 'spin' : 'jump');
  }

  [main, pop].forEach((b) => b.btn.addEventListener('click', () => { fill(b, idleLine(), 4200); animate(b, 'jump'); }));

  // Every so often, a little idle hop.
  (function hop() {
    setTimeout(() => { if (!calm() && !document.hidden) animate(main, 'jump'); hop(); }, 7000 + Math.random() * 6000);
  })();

  return {
    say,
    jump: () => animate(main, 'jump'),
    setIdleLine(fn) { idleLine = fn; },
  };
}

/**
 * floatText(from, text, cls) -> void
 *
 * A game-style number ("+10 EXP") that floats up from an element and fades.
 */
export function floatText(from, text, cls = '') {
  if (!from) return;
  const r = from.getBoundingClientRect();
  const t = el('span', { class: `float-text ${cls}`, text, style: { left: `${r.left + r.width / 2}px`, top: `${r.top}px` } });
  document.body.append(t);
  t.addEventListener('animationend', () => t.remove());
  setTimeout(() => t.remove(), 3000);
}

/** A big "LEVEL UP!" across the screen. */
export function levelUpBanner(level, title) {
  const b = el('div', { class: 'levelup', role: 'status' },
    el('strong', { text: 'LEVEL UP!' }), el('span', { text: `Lv. ${level} · ${title}` }));
  document.body.append(b);
  setTimeout(() => b.remove(), 3200);
}
