/**
 * config.js — Configuration centrale de l'expérience.
 * Palette, options du configurateur, tarifs.
 */

export const PAINTS = [
  { id: 'race-red',  name: 'Rouge Race',      hex: '#9e0d18', price: 0    },
  { id: 'shadow',    name: 'Noir Ombre',      hex: '#0b0b0d', price: 500  },
  { id: 'magnetic',  name: 'Gris Magnétique', hex: '#55575c', price: 900  },
  { id: 'ivory',     name: 'Blanc Ivoire',    hex: '#d9d5cb', price: 900  },
  { id: 'grabber',   name: 'Bleu Grabber',    hex: '#123f9e', price: 1200 },
];

export const CALIPERS = [
  { id: 'red',    name: 'Rouge',  hex: '#c41320', price: 0   },
  { id: 'yellow', name: 'Jaune',  hex: '#e8b90c', price: 450 },
  { id: 'black',  name: 'Noir',   hex: '#141414', price: 0   },
  { id: 'blue',   name: 'Bleu',   hex: '#1d55d4', price: 450 },
];

export const WHEELS = {
  sport: { name: 'Sport 19″',         price: 0    },
  track: { name: 'Track forgées 19″', price: 1500 },
};

export const SPOILER_PRICE = 1200;
export const BASE_PRICE = 94900;   // Shelby GT500

/** Qualité graphique — seuils d'adaptation automatique. */
export const QUALITY = {
  maxPixelRatio: 1.5,
  fpsDropBloom: 42,   // sous ce FPS moyen : bloom désactivé
  fpsDropPost: 28,    // sous ce FPS moyen : post-processing coupé
};
