/**
 * SmartPass — Professional, memorable password generator
 * Format: [Adjective][Noun][Symbol][2–4 digits]
 * Example: BoldFalcon#47
 *
 * Word list curation rules
 * ─────────────────────────
 * ADJECTIVES:
 *   - Positive or neutral connotation only
 *   - No body references, illness, violence, or slur-adjacent words
 *   - No words that read badly when concatenated with common nouns
 *   - Max 8 characters for readability
 *   - No word that also appears in NOUNS[]
 *
 * NOUNS:
 *   - Concrete and visualisable; nature / tech / classic archetypes
 *   - No body parts, illness terms, or weapon-primary words
 *   - Max 9 characters
 *   - No word that also appears in ADJECTIVES[]
 *
 * When adding words: run the unit tests — they enforce all constraints above.
 */

export interface SmartPassOptions {
  digitCount: 2 | 3 | 4   // default: 2
  symbolSet: 'safe' | 'none' // default: 'safe'
}

/** Safe symbol set — excludes $, %, ^, & which trip up some password fields */
export const SYMBOLS = ['#', '@', '!', '*', '+', '=', '·', '-'] as const

/** Specific digit strings that must never appear in output */
const RAW_BLOCKED_NUMBERS = ['69', '420', '1337', '000', '13', '666']
const BLOCKED_NUMBERS = new Set(RAW_BLOCKED_NUMBERS)

/** Blocked adjective+noun concatenations (add more as discovered) */
export const BLOCKED_PAIRS = new Set([
  'DampRag',   'FatSlug',    'DeadWeight', 'SlowMold',  'DullAche',
  'WildFever', 'DarkPlague', 'ColdSweat',  'BlindRage', 'LostCause',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function isBlockedNumber(digits: string): boolean {
  if (BLOCKED_NUMBERS.has(digits)) return true
  // Block all-same-digit strings: '11', '22', '333', etc.
  if (new Set(digits).size === 1) return true
  return false
}

function generateDigits(count: 2 | 3 | 4, maxAttempts = 50): string {
  for (let i = 0; i < maxAttempts; i++) {
    const d = Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('')
    if (!isBlockedNumber(d)) return d
  }
  return count === 2 ? '47' : count === 3 ? '472' : '4721' // guaranteed-safe fallback
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateSmartPass(options: SmartPassOptions): string {
  const { digitCount = 2, symbolSet = 'safe' } = options

  let adj: string
  let noun: string
  let attempts = 0

  do {
    adj  = randomFrom(ADJECTIVES)
    noun = randomFrom(NOUNS)
    attempts++
  } while (BLOCKED_PAIRS.has(adj + noun) && attempts < 10)

  const symbol = symbolSet === 'safe' ? randomFrom(SYMBOLS) : ''
  const digits = generateDigits(digitCount)

  return adj + noun + symbol + digits
}

export function generateSmartPassBatch(count: number, options: SmartPassOptions): string[] {
  return Array.from({ length: Math.max(1, count) }, () => generateSmartPass(options))
}

export function calculateSmartPassEntropy(options: SmartPassOptions): number {
  const adjBits    = Math.log2(ADJECTIVES.length)
  const nounBits   = Math.log2(NOUNS.length)
  const symbolBits = options.symbolSet === 'safe' ? Math.log2(SYMBOLS.length) : 0
  const digitBits  = options.digitCount * Math.log2(10)
  return Math.round((adjBits + nounBits + symbolBits + digitBits) * 10) / 10
}

// ─── ADJECTIVES (180) ─────────────────────────────────────────────────────────
// Positive/neutral connotation · max 8 chars · no word also in NOUNS[]

export const ADJECTIVES: readonly string[] = [
  // Vivid / Nature-inspired
  'Amber',   'Arctic',  'Ashen',   'Azure',   'Blaze',   'Bold',    'Breezy',
  'Bright',  'Brisk',   'Calm',    'Cinder',  'Citrus',  'Clear',   'Crisp',
  'Cosmic',  'Crystal', 'Dusk',    'Ember',   'Frost',   'Gilded',  'Glacial',
  'Gold',    'Granite', 'Haze',    'Indigo',  'Jade',    'Lunar',   'Misty',
  'Mossy',   'Navy',    'Noble',   'Ochre',   'Opal',    'Pearl',   'Prism',
  'Quartz',  'Ruby',    'Russet',  'Sage',    'Sand',    'Scarlet', 'Silver',
  'Slate',   'Solar',   'Storm',   'Swift',   'Teal',    'Topaz',   'Velvet',
  'Verdant', 'Violet',  'Zinc',
  // Professional / Energetic
  'Agile',   'Apex',    'Astute',  'Candid',  'Civic',   'Clean',   'Deft',
  'Direct',  'Dynamic', 'Elite',   'Exact',   'Expert',  'Firm',    'Focal',
  'Grand',   'Honed',   'Ideal',   'Iron',    'Keen',    'Laser',   'Lean',
  'Level',   'Lucid',   'Nimble',  'Noted',   'Pilot',   'Prime',   'Pure',
  'Quick',   'Rapid',   'Ready',   'Sharp',   'Sleek',   'Smart',   'Solid',
  'Sonic',   'Steady',  'Stellar', 'Strict',  'Strong',  'Sure',    'Tactful',
  'Trim',    'True',    'Tuned',   'Valid',   'Vibrant', 'Vivid',   'Wise',
  'Zeal',
  // Evocative / Character
  'Brave',   'Classic', 'Cool',    'Daring',  'Dawn',    'Deep',    'Epic',
  'Fearless','Free',    'Galant',  'Hardy',   'Heroic',  'Honor',   'Iconic',
  'Indie',   'Just',    'Known',   'Loyal',   'Major',   'Merit',   'Mighty',
  'Mint',    'Open',    'Proud',   'Quest',   'Rare',    'Real',    'Regal',
  'Rising',  'Rooted',  'Royal',   'Safe',    'Serene',  'Spare',   'Stark',
  'Still',   'Tested',  'Uniq',    'Urban',   'Valiant', 'Vast',    'Vital',
  'Warm',    'Wild',    'Worthy',  'Zen',
  // Additional
  'Aerial',  'Ancient', 'Blazing', 'Cobalt',  'Coastal', 'Cryptic', 'Dense',
  'Frosty',  'Ivory',   'Kinetic', 'Lofty',   'Lucent',  'Mellow',  'Nimbus',
  'Nordic',  'Onyx',    'Orbital', 'Polar',   'Precise', 'Pristine','Radiant',
  'Rocky',   'Rustic',  'Smooth',  'Spectral','Sublime', 'Thermal', 'Tidal',
  'Ultra',   'Vaulted', 'Wintry',  'Zephyr',
] as const

// ─── NOUNS (180) ──────────────────────────────────────────────────────────────
// Concrete · visualisable · max 9 chars · no word also in ADJECTIVES[]

export const NOUNS: readonly string[] = [
  // Nature
  'Anchor',   'Aspen',    'Basin',    'Beacon',   'Birch',    'Brook',
  'Canyon',   'Canopy',   'Cedar',    'Cliff',    'Comet',    'Coral',
  'Creek',    'Crest',    'Dale',     'Delta',    'Dune',     'Fern',
  'Field',    'Fjord',    'Flint',    'Forge',    'Glen',     'Grove',
  'Harbor',   'Heath',    'Highland', 'Hill',     'Hollow',   'Isle',
  'Kelp',     'Lagoon',   'Lake',     'Lark',     'Laurel',   'Loch',
  'Maple',    'Marsh',    'Meadow',   'Mesa',     'Moor',     'Moth',
  'Oak',      'Orbit',    'Peak',     'Pine',     'Plain',    'Prairie',
  'Quarry',   'Reef',     'Ridge',    'River',    'Rock',     'Root',
  'Shore',    'Slope',    'Spring',   'Stone',    'Summit',   'Tide',
  'Timber',   'Trail',    'Vale',     'Valley',   'Vine',     'Wave',
  'Willow',   'Wind',     'Wood',
  // Tech / Modern
  'Array',    'Atlas',    'Bridge',   'Cache',    'Circuit',  'Cipher',
  'Cloud',    'Code',     'Codec',    'Coil',     'Core',     'Crypt',
  'Cursor',   'Data',     'Deck',     'Domain',   'Drive',    'Echo',
  'Edge',     'Engine',   'Fabric',   'Filament', 'Filter',   'Flux',
  'Frame',    'Gateway',  'Grid',     'Hub',      'Index',    'Junction',
  'Kernel',   'Layer',    'Link',     'Logic',    'Matrix',   'Mesh',
  'Module',   'Node',     'Packet',   'Patch',    'Path',     'Pixel',
  'Platform', 'Point',    'Portal',   'Pulse',    'Query',    'Queue',
  'Relay',    'Route',    'Schema',   'Sensor',   'Server',   'Signal',
  'Socket',   'Stack',    'Switch',   'Sync',     'Thread',   'Token',
  'Tunnel',   'Vector',   'Vertex',   'Volt',     'Wire',     'Zone',
  // Strong / Classic
  'Anvil',    'Arrow',    'Axle',     'Badge',    'Bastion',  'Bolt',
  'Bond',     'Bulwark',  'Capstone', 'Charter',  'Citadel',  'Crown',
  'Emblem',   'Ensign',   'Falcon',   'Flare',    'Fleet',    'Guard',
  'Hammer',   'Haven',    'Herald',   'Ironwork', 'Key',      'Lantern',
  'Mantle',   'Marker',   'Medallion','Paragon',  'Pillar',   'Pioneer',
  'Post',     'Ranger',   'Rover',    'Seal',     'Sentinel', 'Shield',
  'Sigil',    'Spar',     'Spire',    'Staff',    'Standard', 'Sword',
  'Talisman', 'Tower',    'Warden',
] as const
