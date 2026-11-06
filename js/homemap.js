// The studio floorplan: a bird's-eye pixel drawing of a little studio apartment.
//
// Each room you use is placed in its spot in the studio (kitchenette, desk nook, living area, bed
// corner, bathroom, laundry nook, entryway, balcony) by keywords in its name. A spot glows soft pink
// with dust puffs when chores there are due, twinkles when everything there is done, and filters
// the chore list when tapped. Rooms that have no spot ("Linen closet", chores with no room) are
// listed under the plan instead.

import { el } from './dom.js';
import { roomIcon } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
/** The plan is drawn on a grid of W x H tiles. */
const W = 32;
const H = 24.5;

/** Each spot in the studio: its area on the grid, and the name shown when no room is there yet. */
const ZONES = {
  kitchen: { x: 1, y: 1, w: 11, h: 7, label: 'Kitchen' },
  office: { x: 12, y: 1, w: 9, h: 7, label: 'Desk' },
  bathroom: { x: 22, y: 1, w: 9, h: 7, label: 'Bathroom' },
  laundryroom: { x: 1, y: 8, w: 6, h: 5, label: 'Laundry' },
  living: { x: 7, y: 8, w: 14, h: 12, label: 'Living room' },
  bedroom: { x: 22, y: 9, w: 9, h: 11, label: 'Bedroom' },
  hallway: { x: 1, y: 13, w: 6, h: 7, label: 'Entry' },
  plant: { x: 18, y: 21, w: 13, h: 3.5, label: 'Balcony' },
};

const C = {
  wall: '#5b4a6b', wallTop: '#7d6a8f',
  wood: '#f3dcb8', woodLine: '#e4c79b',
  tileA: '#f4f1fb', tileB: '#e6e0f3',
  bathA: '#e6f4f7', bathB: '#d3eaf0',
  deck: '#d9b48a', deckLine: '#c49b6c',
  white: '#ffffff', line: '#cfc4dc', dark: '#4a3d58',
  pink: '#ffc4dc', pinkDark: '#f39abd', lav: '#d9c8ff', lavDark: '#b9a1f2',
  woodDark: '#c99a6b', green: '#8fd6a4', greenDark: '#5fb37c', water: '#bfe6f5', yellow: '#ffe7a3',
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
  // Wooden floor everywhere inside, with plank lines.
  rect(floor, 1, 1, 30, 19, C.wood);
  for (let y = 2; y < 20; y += 1.5) rect(floor, 1, y, 30, 0.08, C.woodLine);
  // Tiled floors: kitchen + laundry (lavender checks), bathroom (blue checks).
  const checks = (x0, y0, w, h, a, b) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rect(floor, x, y, 1, 1, (x + y) % 2 ? a : b);
  };
  checks(1, 1, 11, 7, C.tileA, C.tileB);
  checks(1, 8, 6, 5, C.tileA, C.tileB);
  checks(22, 1, 9, 7, C.bathA, C.bathB);
  // Balcony deck outside the bottom wall.
  rect(floor, 18, 21, 13, 3.5, C.deck);
  for (let x = 18.8; x < 31; x += 1.2) rect(floor, x, 21, 0.08, 3.5, C.deckLine);

  const f = group(svg, 'furniture');
  // Kitchen: counter along the top wall with stove and sink, fridge, a little table.
  thing(f, 3, 1, 9, 1.8, C.white, C.line);
  thing(f, 1, 1, 2, 2.8, C.white);
  rect(f, 1.3, 2.3, 1.4, 0.12, C.line);
  thing(f, 5, 1.2, 2, 1.4, '#e9e4ef');
  [[5.5, 1.6], [6.5, 1.6], [5.5, 2.2], [6.5, 2.2]].forEach(([x, y]) => circle(f, x, y, 0.22, C.dark));
  thing(f, 8.5, 1.2, 2, 1.4, C.water);
  circle(f, 9.5, 1.9, 0.18, C.dark);
  thing(f, 5, 4.6, 3, 2, C.woodDark);
  thing(f, 4, 5.1, 0.8, 1, C.pink);
  thing(f, 8.2, 5.1, 0.8, 1, C.pink);
  circle(f, 6.5, 5.6, 0.35, C.green);
  // Desk nook: desk, laptop, chair, lamp, a plant, a bookshelf.
  thing(f, 14, 1, 5, 1.9, C.woodDark);
  thing(f, 15.4, 1.25, 2.2, 1.2, '#cfd3e6');
  rect(f, 15.6, 1.45, 1.8, 0.8, '#8fa6e8');
  circle(f, 16.5, 3.8, 0.75, C.lav, { stroke: C.dark, 'stroke-width': 0.18 });
  circle(f, 18.4, 1.7, 0.4, C.yellow, { stroke: C.dark, 'stroke-width': 0.15 });
  thing(f, 12.2, 1, 1.3, 4, '#e7c9a2');
  [1.8, 2.8, 3.8].forEach((y) => rect(f, 12.3, y, 1.1, 0.12, C.woodDark));
  thing(f, 19.6, 6.2, 1, 1, '#d69a7a');
  circle(f, 20.1, 6.3, 0.6, C.green);
  // Bathroom: toilet, sink, tub, bath mat.
  thing(f, 22.4, 1.2, 1.5, 1.9, C.white);
  circle(f, 23.15, 2.6, 0.55, C.white, { stroke: C.dark, 'stroke-width': 0.15 });
  thing(f, 24.6, 1.2, 2, 1.2, C.white);
  circle(f, 25.6, 1.8, 0.35, C.water);
  thing(f, 27.2, 1.2, 3.6, 3, C.white);
  rect(f, 27.6, 1.6, 2.8, 2.2, C.water, { rx: 0.5 });
  thing(f, 27.5, 5, 2.8, 1.2, C.pink, C.pinkDark);
  // Laundry nook: washer, dryer, basket.
  thing(f, 1.2, 8.3, 2.2, 2.2, C.white);
  circle(f, 2.3, 9.45, 0.7, C.water, { stroke: C.dark, 'stroke-width': 0.15 });
  thing(f, 3.7, 8.3, 2.2, 2.2, C.white);
  circle(f, 4.8, 9.45, 0.7, '#ece7f4', { stroke: C.dark, 'stroke-width': 0.15 });
  thing(f, 1.6, 11, 1.8, 1.4, '#e8c28e');
  rect(f, 1.8, 11.2, 1.4, 0.5, C.lav);
  // Living area: TV, rug, coffee table, couch, floor plant.
  thing(f, 11, 8.3, 6, 1, C.woodDark);
  rect(f, 12, 8.15, 4, 0.5, C.dark);
  rect(f, 10, 12, 8, 4.6, C.pink, { rx: 0.4 });
  rect(f, 10.5, 12.5, 7, 3.6, 'none', { stroke: C.white, 'stroke-width': 0.2, 'stroke-dasharray': '0.4 0.3', rx: 0.3 });
  thing(f, 12.5, 13.3, 3, 2, C.woodDark);
  circle(f, 14, 14.3, 0.35, C.yellow);
  thing(f, 9.6, 17.2, 8.8, 2.4, C.lav, C.dark);
  thing(f, 10.2, 17.5, 2.4, 1.4, '#e6dbff');
  thing(f, 13, 17.5, 2.4, 1.4, '#e6dbff');
  thing(f, 15.8, 17.5, 2.4, 1.4, '#e6dbff');
  thing(f, 7.8, 9, 1.1, 1.1, '#d69a7a');
  circle(f, 8.35, 9.1, 0.8, C.green);
  // Bed corner: bookshelf divider, bed, nightstand, wardrobe.
  thing(f, 21.1, 11, 0.8, 6, '#e7c9a2');
  [12.5, 14, 15.5].forEach((y) => rect(f, 21.2, y, 0.6, 0.12, C.woodDark));
  thing(f, 23.5, 9.3, 5, 7, C.white);
  thing(f, 23.8, 9.6, 2, 1.3, C.white, C.line);
  thing(f, 26.2, 9.6, 2, 1.3, C.white, C.line);
  thing(f, 23.5, 11.3, 5, 5, C.lav, C.dark);
  rect(f, 23.5, 12.2, 5, 0.25, C.lavDark);
  thing(f, 29, 9.5, 1.6, 1.6, C.woodDark);
  circle(f, 29.8, 10.3, 0.4, C.yellow);
  thing(f, 29, 14, 1.8, 5, '#e7c9a2');
  rect(f, 29.85, 14.3, 0.1, 4.4, C.woodDark);
  // Entry: shoe rack, coat hooks, welcome mat.
  thing(f, 1.2, 14, 1, 3.4, '#e7c9a2');
  [14.8, 15.9, 17].forEach((y) => rect(f, 1.3, y, 0.8, 0.35, C.pinkDark));
  [14, 15.3].forEach((x) => circle(f, 6.6, x, 0.2, C.dark));
  rect(f, 2.2, 18.4, 3, 1.5, C.pink, { rx: 0.3 });
  // Balcony: plants and a chair, behind a railing.
  [[18.6, 21.4], [20.2, 21.4], [29.6, 21.4]].forEach(([x, y]) => { thing(f, x, y, 1.1, 1.1, '#d69a7a'); circle(f, x + 0.55, y + 0.4, 0.7, C.green); });
  circle(f, 26.5, 22.6, 0.7, C.pink, { stroke: C.dark, 'stroke-width': 0.18 });
  rect(f, 18, 24, 13, 0.4, C.dark);
  for (let x = 18; x <= 31; x += 1.3) rect(f, x, 23.7, 0.25, 0.7, C.dark);

  // Walls, with gaps for the front door, the bathroom door and the balcony door.
  const walls = group(svg, 'walls');
  const wall = (x, y, w, h) => { rect(walls, x, y, w, h, C.wall); rect(walls, x, y, w, Math.min(h, 0.25), C.wallTop); };
  wall(0, 0, 32, 1);
  wall(0, 0, 1, 21);
  wall(31, 0, 1, 21);
  wall(0, 20, 2, 1);
  wall(5.3, 20, 17.5, 1);
  wall(27, 20, 5, 1);
  wall(21, 1, 1, 8);
  wall(21, 8, 2.5, 1);
  wall(26, 8, 5, 1);
  rect(walls, 22.8, 20.35, 4.2, 0.3, C.water);           // sliding glass to the balcony
  rect(walls, 2, 20.2, 3.3, 0.6, '#c99a6b');              // front door
  rect(walls, 23.5, 8.2, 2.5, 0.6, '#e7c9a2');            // bathroom door
}

/**
 * renderHomeMap(box, rooms, selected, onPick)
 *
 * Draw the studio and light up the spots that hold your rooms.
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
    const key = roomIcon(r.iconKey);
    if (!ZONES[key]) { elsewhere.push(r); return; }
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
