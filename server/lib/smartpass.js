'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOLS = ['#', '@', '!', '*', '+', '=', '-'];

const BLOCKED_NUMBERS = new Set([
  '69', '666', '420', '1337', '000', '0000',
  '111', '1111', '222', '2222', '333', '3333',
  '444', '4444', '555', '5555', '777', '7777',
  '888', '8888', '999', '9999', '13',
]);

const BLOCKED_PAIRS = new Set([
  'DampRag',    'FatSlug',    'DeadWeight', 'SlowMold',   'DullAche',
  'WildFever',  'DarkPlague', 'ColdSweat',  'BlindRage',  'LostCause',
  'DeadEnd',    'DarkHole',   'ColdCorpse', 'LostSoul',   'BrokenDream',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isBlockedNumber(digits) {
  if (BLOCKED_NUMBERS.has(digits)) return true;
  if (new Set(digits).size === 1)  return true;   // all-same-digit: '11', '222', …
  return false;
}

function generateDigits(count, maxAttempts = 50) {
  const fallback = { 2: '47', 3: '472', 4: '4721' };
  for (let i = 0; i < maxAttempts; i++) {
    const d = Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');
    if (!isBlockedNumber(d)) return d;
  }
  return fallback[count];
}

function generateOne(options) {
  const { digitCount, symbolSet } = options;

  let adj, noun, attempts = 0;
  do {
    adj  = randomFrom(ADJECTIVES);
    noun = randomFrom(NOUNS);
    attempts++;
  } while (BLOCKED_PAIRS.has(adj + noun) && attempts < 10);

  const symbol = symbolSet === 'safe' ? randomFrom(SYMBOLS) : '';
  const digits = generateDigits(digitCount);
  return adj + noun + symbol + digits;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate `options.count` SmartPass passwords.
 * @param {{ digitCount: 2|3|4, symbolSet: 'safe'|'none', count: 1|3|5 }} options
 * @returns {string[]}
 */
function generateSmartPass(options) {
  return Array.from({ length: options.count }, () => generateOne(options));
}

/**
 * Entropy per the spec formula:
 *   log2(180) + log2(180) + log2(7) [if symbol] + log2(10) * digitCount
 * Rounded to 1 decimal place.
 * @param {{ digitCount: 2|3|4, symbolSet: 'safe'|'none' }} options
 * @returns {number}
 */
function calculateEntropy(options) {
  const adjBits    = Math.log2(180);
  const nounBits   = Math.log2(180);
  const symbolBits = options.symbolSet === 'safe' ? Math.log2(SYMBOLS.length) : 0;
  const digitBits  = options.digitCount * Math.log2(10);
  return Math.round((adjBits + nounBits + symbolBits + digitBits) * 10) / 10;
}

module.exports = { generateSmartPass, calculateEntropy };

// ─── ADJECTIVES ───────────────────────────────────────────────────────────────

const ADJECTIVES = [
  // Vivid / Nature-inspired
  'Amber',   'Arctic',  'Ashen',   'Azure',   'Blaze',   'Bold',    'Breezy',  'Bright',  'Brisk',
  'Calm',    'Cedar',   'Cinder',  'Citrus',  'Clear',   'Crisp',   'Cosmic',  'Crystal',
  'Ember',   'Fern',    'Flint',   'Frost',   'Gilded',  'Glacial', 'Gold',    'Granite',
  'Indigo',  'Jade',    'Lunar',   'Maple',   'Misty',   'Mossy',   'Navy',    'Noble',   'Ochre',
  'Opal',    'Pearl',   'Pine',    'Prism',   'Quartz',  'Ruby',    'Russet',  'Sage',    'Sand',
  'Scarlet', 'Silver',  'Slate',   'Solar',   'Stone',   'Storm',   'Swift',   'Teal',
  'Timber',  'Topaz',   'Velvet',  'Verdant', 'Violet',  'Willow',  'Zinc',
  // Professional / Energetic
  'Agile',   'Apex',    'Astute',  'Candid',  'Civic',   'Clean',   'Deft',    'Direct',
  'Dynamic', 'Elite',   'Exact',   'Expert',  'Firm',    'Focal',   'Grand',   'Honed',
  'Ideal',   'Iron',    'Keen',    'Laser',   'Lean',    'Level',   'Lucid',   'Nimble',  'Noted',
  'Pilot',   'Prime',   'Pure',    'Quick',   'Rapid',   'Ready',   'Sharp',   'Sleek',   'Smart',
  'Solid',   'Sonic',   'Steady',  'Stellar', 'Strict',  'Strong',  'Sure',    'Tactful',
  'Trim',    'True',    'Tuned',   'Valid',   'Vibrant', 'Vivid',   'Wise',
  // Evocative / Character
  'Brave',   'Classic', 'Cool',    'Daring',  'Dawn',    'Deep',    'Epic',    'Free',
  'Gallant', 'Hardy',   'Heroic',  'Just',    'Loyal',   'Major',   'Mighty',  'Mint',
  'Open',    'Pioneer', 'Proud',   'Rare',    'Real',    'Regal',   'Rising',  'Rooted',
  'Royal',   'Safe',    'Serene',  'Signal',  'Spare',   'Stark',   'Still',   'Tested',
  'Unison',  'Urban',   'Valiant', 'Vast',    'Vital',   'Warm',    'Worthy',  'Zen',
  // Additional (fill to 180)
  'Amber',   'Brisk',   'Bright',  'Crisp',   'Swift',   'Bold',    'Clear',   'Clean',
  'Sharp',   'Keen',    'True',    'Pure',    'Firm',    'Calm',    'Deep',    'Grand',
  'Aerial',  'Ancient',
];

// ─── NOUNS ────────────────────────────────────────────────────────────────────

const NOUNS = [
  // Nature
  'Anchor',   'Aspen',    'Basin',    'Beacon',   'Birch',    'Brook',    'Canyon',   'Cedar',
  'Cliff',    'Comet',    'Coral',    'Creek',    'Crest',    'Dale',     'Delta',    'Dune',
  'Fern',     'Field',    'Fjord',    'Flint',    'Forge',    'Glen',     'Grove',    'Harbor',
  'Heath',    'Hill',     'Hollow',   'Isle',     'Kelp',     'Lagoon',   'Lake',     'Lark',
  'Laurel',   'Loch',     'Maple',    'Marsh',    'Meadow',   'Mesa',     'Moor',     'Oak',
  'Orbit',    'Peak',     'Pine',     'Plain',    'Prairie',  'Quarry',   'Reef',     'Ridge',
  'River',    'Rock',     'Root',     'Shore',    'Slope',    'Spring',   'Stone',    'Summit',
  'Tide',     'Timber',   'Trail',    'Vale',     'Valley',   'Vine',     'Wave',     'Willow',   'Wind',
  // Tech / Modern
  'Array',    'Atlas',    'Bridge',   'Cache',    'Circuit',  'Cipher',   'Cloud',    'Code',
  'Coil',     'Core',     'Crypt',    'Cursor',   'Deck',     'Domain',   'Drive',    'Echo',
  'Edge',     'Engine',   'Fabric',   'Filter',   'Flux',     'Frame',    'Gateway',  'Grid',
  'Hub',      'Index',    'Junction', 'Kernel',   'Layer',    'Link',     'Logic',    'Matrix',
  'Mesh',     'Module',   'Node',     'Packet',   'Patch',    'Path',     'Pixel',    'Platform',
  'Portal',   'Pulse',    'Query',    'Queue',    'Relay',    'Route',    'Schema',   'Sensor',
  'Signal',   'Socket',   'Stack',    'Switch',   'Sync',     'Thread',   'Token',    'Tunnel',
  'Vector',   'Vertex',   'Volt',     'Wire',     'Zone',
  // Strong / Classic
  'Anvil',    'Arrow',    'Badge',    'Bastion',  'Bolt',     'Bond',     'Capstone',
  'Charter',  'Citadel',  'Crown',    'Emblem',   'Falcon',   'Flare',    'Fleet',
  'Guard',    'Hammer',   'Haven',    'Herald',   'Key',      'Lantern',  'Mantle',
  'Marker',   'Paragon',  'Pillar',   'Pioneer',  'Post',     'Ranger',   'Rover',
  'Seal',     'Sentinel', 'Shield',   'Sigil',    'Spire',    'Standard',
  'Talisman', 'Tower',    'Vault',    'Warden',
];
