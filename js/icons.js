// Little pixel-art icons, drawn as SVG squares from 10x10 text grids.
//
// Each letter in a grid is one pixel; '.' is see-through. Rooms and chore types are matched to an
// icon by keywords in their names, so anything you type ("Mudroom", "Fold clothes") still gets one.

const PALETTE = {
  k: '#3b2a4d', // outline
  w: '#ffffff',
  l: '#d9dcef', // light grey
  s: '#9aa0bf', // grey
  r: '#ff5d8f', // pink-red
  p: '#ffa6c9', // pink
  o: '#ff9f43', // orange
  y: '#ffd93d', // yellow
  g: '#4cd97b', // green
  c: '#6fd6ff', // cyan
  b: '#4d7cff', // blue
  v: '#b06cff', // violet
  n: '#c27c4e', // brown
};

const ICONS = {
  house: [
    '....kk....',
    '...kppk...',
    '..kppppk..',
    '.kppppppk.',
    'kkkkkkkkkk',
    '.kyyyyyyk.',
    '.kycnncyk.',
    '.kyynnyyk.',
    '.kyynnyyk.',
    '.kkkkkkkk.',
  ],
  kitchen: [
    '...c..c...',
    '..c..c....',
    '...c..c...',
    '.kkkkkkkk.',
    'kkrrrrrrkk',
    '.krrrrrrk.',
    '.krwrrrrk.',
    '.krrrrrrk.',
    '..kkkkkk..',
    '..........',
  ],
  bedroom: [
    '..........',
    'k.........',
    'k.........',
    'kww.......',
    'kwwvvvvvvk',
    'kvvvvvvvvk',
    'kkkkkkkkkk',
    'k........k',
    '..........',
    '..........',
  ],
  bathroom: [
    '.....c.c..',
    '..c.....c.',
    '....c.....',
    'k.........',
    'kkkkkkkkkk',
    'kwwwwwwwwk',
    '.kwwwwwwk.',
    '..kkkkkk..',
    '..k....k..',
    '..........',
  ],
  hallway: [
    '..kkkkkk..',
    '..knnnnk..',
    '..knkknk..',
    '..knnnnk..',
    '..knnnyk..',
    '..knnnnk..',
    '..knkknk..',
    '..knnnnk..',
    '.kkkkkkkk.',
    '..........',
  ],
  living: [
    '..........',
    '..........',
    '..vvvvvv..',
    '.vvvvvvvv.',
    'vvvvvvvvvv',
    'vppppppppv',
    'vppppppppv',
    'vvvvvvvvvv',
    '.k......k.',
    '..........',
  ],
  laundryroom: [
    '.kkkkkkkk.',
    '.klllrgyk.',
    '.kkkkkkkk.',
    '.kllccllk.',
    '.klcccclk.',
    '.klcwcclk.',
    '.klcccclk.',
    '.kllccllk.',
    '.kkkkkkkk.',
    '.k......k.',
  ],
  office: [
    '..........',
    '.kkkkkkkk.',
    '.kbbbbbbk.',
    '.kbcbbbbk.',
    '.kbbbbbbk.',
    '.kkkkkkkk.',
    '....kk....',
    '..kkkkkk..',
    '..........',
    '..........',
  ],
  plant: [
    '...g..g...',
    '..ggg.gg..',
    '...gggg...',
    '....gg....',
    '....g.....',
    '.nnnnnnnn.',
    '..nnnnnn..',
    '..nnnnnn..',
    '...nnnn...',
    '..........',
  ],
  broom: [
    '........n.',
    '.......n..',
    '......n...',
    '.....n....',
    '....kk....',
    '...yyyy...',
    '..yyyyyy..',
    '.yyyyyyyy.',
    '.y.y.y.y..',
    '..........',
  ],
  mop: [
    '....n.....',
    '....n.....',
    '....n.....',
    '....n.....',
    '....n.....',
    '..kkkkk...',
    '..ccccc...',
    '.cc.c.cc..',
    'c..c.c..c.',
    '.bbbbbbbb.',
  ],
  vacuum: [
    '....kkk...',
    '....k.....',
    '....k.....',
    '....k.....',
    '..vvvvv...',
    '.vvvvvvv..',
    '.vvwwvvv..',
    '.vvvvvvv..',
    '..k...k...',
    '..........',
  ],
  window: [
    'kkkkkkkkkk',
    'kccwkcccck',
    'kcwckcccck',
    'kccckccwck',
    'kkkkkkkkkk',
    'kccckcccck',
    'kccckcwcck',
    'kccckwccck',
    'kkkkkkkkkk',
    '..........',
  ],
  shirt: [
    '.kkk..kkk.',
    'kpppkkpppk',
    'kppppppppk',
    'kkkppppkkk',
    '..kppppk..',
    '..kppppk..',
    '..kppppk..',
    '..kppppk..',
    '..kkkkkk..',
    '..........',
  ],
  dishes: [
    '........y.',
    '.......yyy',
    '..kkkk..y.',
    '.kwwwwk...',
    'kwwlllwk..',
    'kwlllllwk.',
    'kwlllllwk.',
    '.kwlllwk..',
    '..kkkkk...',
    '..........',
  ],
  sparkle: [
    '....y.....',
    '....y.....',
    '...yyy....',
    'yyyywyyyy.',
    '...yyy....',
    '....y...p.',
    '....y..ppp',
    '........p.',
    '.c........',
    'ccc.......',
  ],
  trash: [
    '...kkkk...',
    'kkkkkkkkkk',
    '.kggggggk.',
    '.kgkggkgk.',
    '.kgkggkgk.',
    '.kgkggkgk.',
    '.kgkggkgk.',
    '.kggggggk.',
    '..kkkkkk..',
    '..........',
  ],
  sponge: [
    '......c...',
    '..c.....c.',
    '.....c....',
    '..c.......',
    '.kkkkkkkk.',
    '.kyyyyyyk.',
    '.kyyyyyyk.',
    '.kggggggk.',
    '.kkkkkkkk.',
    '..........',
  ],
  spray: [
    '..kkkk....',
    '..kbbkkc..',
    '...kk..c.c',
    '..kbbk..c.',
    '.kbbbbk...',
    '.kbwwbk...',
    '.kbwwbk...',
    '.kbbbbk...',
    '.kkkkkk...',
    '..........',
  ],
  pillow: [
    '..........',
    '.kkkkkkkk.',
    'kwwwwwwwwk',
    'kwwrrwrrwk',
    'kwwrrrrrwk',
    'kwwwrrrwwk',
    'kwwwwrwwwk',
    '.kkkkkkkk.',
    '..........',
    '..........',
  ],
  box: [
    'k.k....k.k',
    '.kkkkkkkk.',
    '.knnnnnnk.',
    '.knnyynnk.',
    '.knnnnnnk.',
    '.knnnnnnk.',
    '.kkkkkkkk.',
    '..........',
    '..........',
    '..........',
  ],
  heart: [
    '..........',
    '.kk...kk..',
    'krrk.krrk.',
    'krwrkrrrk.',
    'krrrrrrrk.',
    '.krrrrrk..',
    '..krrrk...',
    '...krk....',
    '....k.....',
    '..........',
  ],
  check: [
    '..........',
    '........k.',
    '.......kgk',
    '......kgk.',
    'k....kgk..',
    'kgk.kgk...',
    '.kgkgk....',
    '..kgk.....',
    '...k......',
    '..........',
  ],
};

/** Keyword → icon, checked in order; the first keyword found in the (lower-cased) name wins. */
const ROOM_RULES = [
  [['kitchen', 'pantry', 'dining'], 'kitchen'],
  [['bath', 'toilet', 'shower', 'powder', 'restroom', 'wc'], 'bathroom'],
  [['laundry', 'utility', 'mud'], 'laundryroom'],
  [['bed', 'nursery', 'guest'], 'bedroom'],
  [['hall', 'entry', 'stair', 'foyer', 'corridor', 'door'], 'hallway'],
  [['living', 'lounge', 'family', 'den', 'sitting'], 'living'],
  [['office', 'study', 'desk', 'work'], 'office'],
  [['garden', 'yard', 'outdoor', 'balcony', 'patio', 'porch', 'deck', 'plant'], 'plant'],
];

const TYPE_RULES = [
  [['mop'], 'mop'],
  [['vacuum', 'hoover'], 'vacuum'],
  [['sweep', 'floor', 'broom'], 'broom'],
  [['window', 'mirror', 'glass'], 'window'],
  [['laundry', 'clothes', 'fold', 'iron', 'wash cloth'], 'shirt'],
  [['dish', 'cook', 'oven', 'fridge', 'microwave'], 'dishes'],
  [['dust'], 'sparkle'],
  [['trash', 'garbage', 'rubbish', 'bin', 'recycl', 'compost'], 'trash'],
  [['scrub', 'toilet', 'tub', 'shower', 'sink', 'grout'], 'sponge'],
  [['wipe', 'disinfect', 'spray', 'counter', 'surface'], 'spray'],
  [['bed', 'sheet', 'linen', 'pillow', 'towel'], 'pillow'],
  [['plant', 'water', 'garden', 'weed', 'lawn'], 'plant'],
  [['tidy', 'declutter', 'organi', 'put away', 'clutter'], 'box'],
];

/**
 * pixelSvg(name, size) -> SVGElement
 *
 * A pixel-art icon as an SVG element, crisp at any size.
 *
 *   - `name` — key in ICONS (unknown names draw the sparkle)
 *   - `size` — width and height in CSS pixels
 */
export function pixelSvg(name, size = 24) {
  const grid = ICONS[name] || ICONS.sparkle;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('pix');
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!PALETTE[ch]) return;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x);
      r.setAttribute('y', y);
      r.setAttribute('width', 1.02);
      r.setAttribute('height', 1.02);
      r.setAttribute('fill', PALETTE[ch]);
      if (ch === 'k') r.setAttribute('class', 'ink');
      svg.appendChild(r);
    });
  });
  return svg;
}

function match(text, rules, fallback) {
  const t = String(text || '').toLowerCase();
  for (const [keys, icon] of rules) if (keys.some((k) => t.includes(k))) return icon;
  return fallback;
}

/** Icon name for a room (falls back to the little house). */
export const roomIcon = (room) => match(room, ROOM_RULES, 'house');
/** Icon name for a chore type, looking at the chore's name too when the type says nothing. */
export const typeIcon = (type, choreName = '') => match(type, TYPE_RULES, null) || match(choreName, TYPE_RULES, 'sparkle');

/** Every icon name, for tests and the about box. */
export const ICON_NAMES = Object.keys(ICONS);
export { ICONS };

/**
 * hueFor(text) -> number
 *
 * A stable rainbow hue (0–359) for a room or type name, so each one keeps its own colour.
 */
export function hueFor(text) {
  const t = String(text || '').toLowerCase();
  let h = 7;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 3600;
  return Math.round(h / 10);
}
