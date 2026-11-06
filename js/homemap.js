// Our place: a bird's-eye pixel floorplan of the apartment, drawn from the sketch of it.
//
// Laid out long-ways: along the top are the bed nook, living room, kitchen and bathroom; along the
// bottom are the desk, the closet (with the laundry inside it) and the hallway to the front door.
// Each room you use is placed in its spot by keywords in its name. A spot glows soft pink with
// dust puffs when chores there are due, twinkles when everything there is done, and filters the
// chore list when tapped. Rooms that have no spot are listed under the plan instead.

import { el } from './dom.js';
import { roomIcon } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
/** The plan is drawn on a grid of W x H tiles. */
const W = 36;
const H = 14;

/** Each spot: its area on the grid, and the name shown when no room is there yet. */
const ZONES = {
  bedroom: { x: 0.6, y: 0.6, w: 5.6, h: 6.4, label: 'Bed' },
  living: { x: 7, y: 0.6, w: 9.4, h: 7.6, label: 'Living room' },
  kitchen: { x: 17.6, y: 0.6, w: 7.2, h: 7.6, label: 'Kitchen' },
  bathroom: { x: 25.4, y: 0.6, w: 10, h: 7, label: 'Bathroom' },
  office: { x: 7.4, y: 10.4, w: 5.4, h: 3 , label: 'Desk' },
  laundryroom: { x: 16, y: 10.95, w: 6.9, h: 2.45, label: 'Closet & laundry' },
  hallway: { x: 25, y: 8.2, w: 10.4, h: 5.2, label: 'Hallway' },
};

/**
 * zoneFor(roomText) -> string|null
 *
 * Which spot a room goes in. Closets share the laundry spot (the washer is in the closet), and
 * entries/doorways go in the hallway. Returns null for rooms with no spot (e.g. a garden).
 */
function zoneFor(roomText) {
  const t = String(roomText || '').toLowerCase();
  if (/closet|wardrobe|linen|storage/.test(t)) return 'laundryroom';
  const key = roomIcon(roomText);
  return ZONES[key] ? key : null;
}

const C = {
  wall: '#5b4a6b', wallTop: '#7d6a8f',
  wood: '#f3dcb8', woodLine: '#e4c79b',
  tileA: '#f4f1fb', tileB: '#e6e0f3',
  bathA: '#e6f4f7', bathB: '#d3eaf0',
  white: '#ffffff', line: '#cfc4dc', dark: '#4a3d58',
  pink: '#ffc4dc', pinkDark: '#f39abd', lav: '#d9c8ff', lavDark: '#b9a1f2',
  woodDark: '#c99a6b', woodLight: '#e7c9a2', green: '#8fd6a4', water: '#bfe6f5', yellow: '#ffe7a3', pot: '#d69a7a',
};

function rect(parent, x, y, w, h, fill, extra = {}) {
  const r = document.createElementNS(NS, 'rect');
  Object.entries({ x, y, width: w, height: h, fill, ...extra }).forEach(([k, v]) => r.setAttribute(k, v));
  parent.appendChild(r);
  return r;
}
function circle(parent, cx, cy, r, fill, extra = {}) {
  const c = document.createElementNS(NS, 'circle');
  Object.entries({ cx, cy, r, fill, ...extra }).forEach(([k, v]) => c.setAttribute(k, v));
  parent.appendChild(c);
  return c;
}
function group(parent, cls) {
  const g = document.createElementNS(NS, 'g');
  if (cls) g.setAttribute('class', cls);
  parent.appendChild(g);
  return g;
}
/** A piece of furniture: a filled block with a darker outline, like top-down pixel sprites. */
const thing = (g, x, y, w, h, fill, stroke = C.dark) => rect(g, x, y, w, h, fill, { stroke, 'stroke-width': 0.18, rx: 0.2 });

/** Floors, walls and furniture: the part of the plan that never changes. */
function drawStudio(svg) {
  const floor = group(svg, 'floors');
  rect(floor, 0.6, 0.6, 34.8, 12.8, C.wood);
  for (let y = 1.6; y < 13.4; y += 1.5) rect(floor, 0.6, y, 34.8, 0.08, C.woodLine);
  const checks = (x0, y0, w, h, a, b) => {
    for (let y = y0; y < y0 + h - 0.01; y++) for (let x = x0; x < x0 + w - 0.01; x++) {
      rect(floor, x, y, Math.min(1, x0 + w - x), Math.min(1, y0 + h - y), (Math.floor(x) + Math.floor(y)) % 2 ? a : b);
    }
  };
  checks(17.6, 0.6, 7.2, 7.6, C.tileA, C.tileB);   // kitchen
  checks(25.4, 0.6, 10, 7, C.bathA, C.bathB);       // bathroom
  const f = group(svg, 'furniture');
  const plant = (x, y) => { thing(f, x, y, 1, 1, C.pot); circle(f, x + 0.5, y + 0.35, 0.65, C.green); };

  // Bed nook: bed with its head against the left wall, nightstand, and a curtain at the opening.
  thing(f, 0.9, 0.9, 4.6, 4.4, C.white);
  thing(f, 1.1, 1.2, 1.1, 1.7, C.white, C.line);
  thing(f, 1.1, 3.2, 1.1, 1.7, C.white, C.line);
  thing(f, 2.5, 0.9, 3, 4.4, C.lav);
  rect(f, 2.9, 0.9, 0.25, 4.4, C.lavDark);
  thing(f, 0.9, 5.6, 1.2, 1.1, C.woodDark);
  circle(f, 1.5, 6.15, 0.35, C.yellow);
  for (let y = 4.6; y < 7; y += 0.5) rect(f, 6.2, y, 0.3, 0.35, C.pinkDark);
  // Open floor under the bed nook: a round rug and a plant.
  circle(f, 3.4, 10.2, 2, C.pink, { stroke: C.white, 'stroke-width': 0.2, 'stroke-dasharray': '0.4 0.3' });
  plant(0.9, 12.1);

  // Living room: couch on the top wall, rug, coffee table, TV facing the couch, a plant.
  thing(f, 8.6, 0.9, 6.4, 2, C.lav);
  [8.9, 11, 13.1].forEach((x) => thing(f, x, 1.15, 1.8, 1.2, '#e6dbff'));
  rect(f, 8.4, 3.3, 7, 3.6, C.pink, { rx: 0.4 });
  rect(f, 8.8, 3.7, 6.2, 2.8, 'none', { stroke: C.white, 'stroke-width': 0.2, 'stroke-dasharray': '0.4 0.3', rx: 0.3 });
  thing(f, 10.4, 4.2, 3, 1.8, C.woodDark);
  circle(f, 11.9, 5.1, 0.35, C.yellow);
  thing(f, 9.6, 7.2, 4.6, 0.8, C.woodDark);
  rect(f, 10.4, 7.35, 3, 0.45, C.dark);
  plant(7.3, 0.9);

  // Kitchen: a peninsula counter between it and the living room, counter with stove and sink,
  // fridge in the corner.
  thing(f, 16.6, 0.6, 1, 6.2, C.white, C.line);
  thing(f, 17.6, 0.8, 5.4, 1.8, C.white, C.line);
  thing(f, 18.1, 1, 2, 1.4, '#e9e4ef');
  [[18.6, 1.4], [19.6, 1.4], [18.6, 2], [19.6, 2]].forEach(([x, y]) => circle(f, x, y, 0.22, C.dark));
  thing(f, 20.8, 1, 1.8, 1.4, C.water);
  circle(f, 21.7, 1.7, 0.18, C.dark);
  thing(f, 23.2, 0.8, 1.5, 2.6, C.white);
  rect(f, 23.4, 2.3, 1.1, 0.12, C.line);
  thing(f, 16.75, 2.6, 0.7, 0.7, C.pink);                // a stool at the peninsula
  thing(f, 16.75, 4.4, 0.7, 0.7, C.pink);

  // Bathroom: toilet, sink, tub along the top wall, bath mat.
  thing(f, 26, 0.9, 1.5, 1.9, C.white);
  circle(f, 26.75, 2.4, 0.55, C.white, { stroke: C.dark, 'stroke-width': 0.15 });
  thing(f, 28.3, 0.9, 2, 1.2, C.white);
  circle(f, 29.3, 1.5, 0.35, C.water);
  thing(f, 31, 0.9, 4.2, 3, C.white);
  rect(f, 31.4, 1.3, 3.4, 2.2, C.water, { rx: 0.5 });
  thing(f, 31.6, 4.5, 2.8, 1.2, C.pink, C.pinkDark);

  // Desk against the bottom wall: desk, laptop, lamp, chair.
  thing(f, 7.8, 12, 4.6, 1.3, C.woodDark);
  thing(f, 9.2, 12.15, 1.8, 0.95, '#cfd3e6');
  rect(f, 9.35, 12.3, 1.5, 0.65, '#8fa6e8');
  circle(f, 11.8, 12.6, 0.35, C.yellow, { stroke: C.dark, 'stroke-width': 0.15 });
  circle(f, 10.1, 11.1, 0.7, C.lav, { stroke: C.dark, 'stroke-width': 0.18 });
  plant(13.6, 12.2);

  // Closet with the laundry inside: washer, dryer, and a rail of hangers; sliding doors on top.
  thing(f, 16.3, 11.2, 1.8, 1.9, C.white);
  circle(f, 17.2, 12.15, 0.6, C.water, { stroke: C.dark, 'stroke-width': 0.15 });
  thing(f, 18.3, 11.2, 1.8, 1.9, C.white);
  circle(f, 19.2, 12.15, 0.6, '#ece7f4', { stroke: C.dark, 'stroke-width': 0.15 });
  rect(f, 20.4, 12.1, 2.3, 0.12, C.dark);
  [20.6, 21.2, 21.8, 22.3].forEach((x, i) => rect(f, x, 11.5, 0.35, 1.3, [C.pink, C.lav, C.yellow, C.pink][i]));

  // Hallway: a runner rug, shoe rack and mat by the front door, coat hooks.
  rect(f, 26, 10.4, 7, 1.4, C.pink, { rx: 0.3 });
  rect(f, 26.3, 10.7, 6.4, 0.8, 'none', { stroke: C.white, 'stroke-width': 0.15, 'stroke-dasharray': '0.4 0.3' });
  thing(f, 33.8, 11.6, 1.4, 1.6, C.woodLight);
  [12, 12.6].forEach((y) => rect(f, 33.9, y, 1.2, 0.3, C.pinkDark));
  rect(f, 33.9, 8.8, 1.3, 1.8, C.pink, { rx: 0.3 });
  [27, 28.4, 29.8].forEach((x) => circle(f, x, 13.1, 0.2, C.dark));

  // Walls, with gaps for the front door, the bathroom door and the bed nook opening.
  const walls = group(svg, 'walls');
  const wall = (x, y, w, h) => { rect(walls, x, y, w, h, C.wall); rect(walls, x, y, w, Math.min(h, 0.2), C.wallTop); };
  wall(0, 0, 36, 0.6);
  wall(0, 13.4, 36, 0.6);
  wall(0, 0, 0.6, 14);
  wall(35.4, 0, 0.6, 8.6);
  wall(35.4, 10.8, 0.6, 3.2);
  wall(6.1, 0.6, 0.5, 4);         // bed nook: side wall, then a curtain
  wall(0.6, 7, 4, 0.5);           // bed nook: front wall, open at the corner
  wall(24.8, 0.6, 0.6, 7.6);      // bathroom
  wall(24.8, 7.6, 3.4, 0.6);
  wall(31, 7.6, 4.4, 0.6);
  wall(15.7, 10.7, 0.35, 2.7);    // closet sides
  wall(22.9, 10.7, 0.35, 2.7);
  rect(walls, 16.05, 10.7, 6.85, 0.3, C.woodLight);       // closet sliding doors
  rect(walls, 19.4, 10.7, 0.08, 0.3, C.woodDark);
  rect(walls, 35.45, 8.6, 0.5, 2.2, C.woodDark);          // front door
  rect(walls, 28.2, 7.7, 2.8, 0.4, C.woodLight);          // bathroom door
}

/**
 * renderHomeMap(box, rooms, selected, onPick)
 *
 * Draw our place and light up the spots that hold your rooms.
 *
 *   - `box`      — element to draw into
 *   - `rooms`    — `[{ name, iconKey, total, due, soon }]`; `iconKey` is the text used to pick the
 *                  room's spot ('' for chores with no room)
 *   - `selected` — Set of room names currently picked
 *   - `onPick`   — called with the list of room names in a spot when it is tapped
 */
export function renderHomeMap(box, rooms, selected, onPick) {
  // Gather rooms into their spots; rooms with no spot go in "elsewhere".
  const spots = new Map();
  const elsewhere = [];
  rooms.forEach((r) => {
    const key = zoneFor(r.iconKey);
    if (!key) { elsewhere.push(r); return; }
    if (!spots.has(key)) spots.set(key, []);
    spots.get(key).push(r);
  });

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('plan-svg');
  drawStudio(svg);

  const marks = group(svg, 'marks');
  const labels = [];
  Object.entries(ZONES).forEach(([key, z]) => {
    const list = spots.get(key) || [];
    const used = list.length > 0;
    const due = list.reduce((n, r) => n + r.due, 0);
    const soon = list.reduce((n, r) => n + r.soon, 0);
    const names = list.map((r) => r.name);
    const picked = used && names.every((n) => selected.has(n)) && selected.size === names.length;
    const state = !used ? 'unused' : due ? 'due' : soon ? 'soon' : 'clean';

    if (used) {
      const g = group(marks, `zone state-${state}${picked ? ' picked' : ''}`);
      rect(g, z.x + 0.15, z.y + 0.15, z.w - 0.3, z.h - 0.3, 'transparent', { class: 'zone-area', rx: 0.4 });
      // Dust puffs for due spots, twinkles for clean ones.
      [[0.25, 0.3], [0.7, 0.55], [0.4, 0.8]].forEach(([fx, fy], i) => {
        const cx = z.x + z.w * fx;
        const cy = z.y + z.h * fy;
        const p = group(g, `fx fx${i + 1}`);
        if (state === 'due') { rect(p, cx, cy, 0.5, 0.5, '#b9a9a0'); rect(p, cx + 0.5, cy - 0.3, 0.35, 0.35, '#cbbdb4'); rect(p, cx - 0.35, cy + 0.2, 0.3, 0.3, '#a89990'); }
        else { rect(p, cx, cy - 0.4, 0.2, 1, C.white); rect(p, cx - 0.4, cy, 1, 0.2, C.white); }
      });
      g.addEventListener('click', () => onPick(names));
    }

    const title = used ? (names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`) : z.label;
    labels.push(el('button', {
      type: 'button',
      class: `plan-label state-${state}${picked ? ' picked' : ''}`,
      style: { left: `${((z.x + z.w / 2) / W) * 100}%`, top: `${((z.y + z.h / 2) / H) * 100}%` },
      disabled: !used,
      'aria-pressed': used ? String(picked) : null,
      'aria-label': used ? `${names.join(', ')}: ${due ? `${due} to do` : 'all clean'}. Show its chores.` : `${z.label} (no chores here yet)`,
      onclick: used ? () => onPick(names) : null,
    },
    el('span', { class: 'plan-name', text: title }),
    used ? el('span', { class: 'plan-badge', text: due ? `${due} to do` : soon ? `${soon} soon` : '✨ clean' }) : null,
    picked ? el('span', { class: 'here', text: '▼' }) : null));
  });

  const extra = elsewhere.length ? el('div', { class: 'elsewhere' },
    el('span', { class: 'muted', text: 'elsewhere:' }),
    elsewhere.map((r) => {
      const picked = selected.size === 1 && selected.has(r.name);
      return el('button', {
        type: 'button',
        class: `chip elsewhere-chip${r.due ? ' needs-love' : ''}`,
        'aria-pressed': String(picked),
        onclick: () => onPick([r.name]),
      }, el('span', { text: r.name }), el('span', { class: 'count', text: r.due ? `${r.due} to do` : '✨' }));
    })) : null;

  box.replaceChildren(...[el('div', { class: 'plan' }, svg, ...labels), extra].filter(Boolean));
}
