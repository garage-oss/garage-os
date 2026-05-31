/**
 * Mock supplier data for the Parts Recommendation Engine.
 * No real supplier integrations — all data is deterministically generated
 * from a seeded LCG so the same part always yields the same supplier options.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PartType     = 'OEM' | 'AFTERMARKET' | 'REMANUFACTURED'
export type Availability = 'IN_STOCK' | 'ORDER_2_DAYS' | 'ORDER_5_DAYS' | 'UNAVAILABLE'

export interface SupplierOption {
  supplierId:   string
  supplierName: string
  partNumber:   string
  type:         PartType
  pricePerUnit: number
  availability: Availability
  deliveryDays: number   // effective days (includes lead-time)
  warranty:     string
}

export interface PartQuote {
  partName:       string
  category:       string
  quantity:       number
  isOptional:     boolean
  notes?:         string
  suppliers:      SupplierOption[]
  cheapestIdx:    number  // index into suppliers[]
  recommendedIdx: number  // index into suppliers[]
}

// ─── 5 mock Israeli auto-parts suppliers ─────────────────────────────────────

type Profile = 'premium' | 'balanced' | 'local' | 'budget' | 'online'

const SUPPLIERS: Array<{ id: string; name: string; profile: Profile }> = [
  { id: 's1', name: 'קינג גרופ',  profile: 'balanced' },
  { id: 's2', name: 'אקסל פארטס', profile: 'budget'   },
  { id: 's3', name: 'מוטו סנטר',  profile: 'premium'  },
  { id: 's4', name: 'א.ב. חלפים', profile: 'local'    },
  { id: 's5', name: 'ישיר אוטו',  profile: 'online'   },
]

interface ProfileConfig {
  /** Probability [0–1] that the part type is AFTERMARKET (vs OEM) */
  typeBias:     number
  /** Base price multiplier vs AI estimate */
  priceMin:     number
  priceRange:   number
  /** Probability of IN_STOCK */
  stockChance:  number
  /** Base delivery days when in stock */
  deliveryBase: number
  warranty:     string
}

const PROFILE_CFG: Record<Profile, ProfileConfig> = {
  premium:  { typeBias: 0.05, priceMin: 1.20, priceRange: 0.30, stockChance: 0.70, deliveryBase: 1, warranty: '12 חודשים' },
  balanced: { typeBias: 0.40, priceMin: 0.85, priceRange: 0.30, stockChance: 0.60, deliveryBase: 2, warranty: '6 חודשים'  },
  local:    { typeBias: 0.50, priceMin: 0.90, priceRange: 0.20, stockChance: 0.80, deliveryBase: 1, warranty: '6 חודשים'  },
  budget:   { typeBias: 0.85, priceMin: 0.60, priceRange: 0.20, stockChance: 0.50, deliveryBase: 3, warranty: '3 חודשים'  },
  online:   { typeBias: 0.90, priceMin: 0.55, priceRange: 0.20, stockChance: 0.35, deliveryBase: 4, warranty: '3 חודשים'  },
}

// ─── Deterministic helpers ────────────────────────────────────────────────────

function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  }
  return h || 1
}

/** Knuth multiplicative LCG — fast, deterministic, always positive output [0, 1) */
function lcg(seed: number) {
  let s = (seed >>> 0) || 1
  return (): number => {
    s = ((s * 1664525 + 1013904223) >>> 0)
    return s / 4294967296
  }
}

/** Fisher-Yates shuffle using provided RNG */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Part quote generator ─────────────────────────────────────────────────────

export function generatePartQuote(
  partName:   string,
  category:   string,
  quantity:   number,
  basePrice:  number,
  isOptional: boolean,
  notes?:     string,
): PartQuote {
  const seed   = djb2(`${partName}|${category}`)
  const rng    = lcg(seed)

  // Pick 2–4 suppliers deterministically
  const count   = 2 + (seed % 3)          // 2, 3, or 4
  const picked  = shuffle(SUPPLIERS, rng).slice(0, count)

  const suppliers: SupplierOption[] = picked.map((sup, idx) => {
    const cfg  = PROFILE_CFG[sup.profile]

    const type: PartType = rng() < cfg.typeBias ? 'AFTERMARKET' : 'OEM'

    const price = Math.max(10, Math.round(basePrice * (cfg.priceMin + rng() * cfg.priceRange)))

    const roll  = rng()
    const availability: Availability =
      roll < cfg.stockChance              ? 'IN_STOCK'     :
      roll < cfg.stockChance + 0.25       ? 'ORDER_2_DAYS' :
      roll < cfg.stockChance + 0.45       ? 'ORDER_5_DAYS' :
                                            'UNAVAILABLE'

    const deliveryDays =
      availability === 'IN_STOCK'     ? cfg.deliveryBase :
      availability === 'ORDER_2_DAYS' ? Math.max(cfg.deliveryBase, 2) :
      availability === 'ORDER_5_DAYS' ? Math.max(cfg.deliveryBase, 5) :
                                        99

    return {
      supplierId:   sup.id,
      supplierName: sup.name,
      partNumber:   `${sup.id.toUpperCase()}-${1000 + (seed % 8999)}-${idx + 1}`,
      type,
      pricePerUnit: price,
      availability,
      deliveryDays,
      warranty:     cfg.warranty,
    }
  })

  // ── Score suppliers ──────────────────────────────────────────────────────────

  const available = suppliers
    .map((s, i) => ({ ...s, i }))
    .filter(s => s.availability !== 'UNAVAILABLE')

  // Cheapest = lowest unit price among available
  const cheapestIdx = available.length
    ? available.reduce((a, b) => a.pricePerUnit < b.pricePerUnit ? a : b).i
    : 0

  const cheapestPrice = suppliers[cheapestIdx]?.pricePerUnit ?? Infinity

  // Recommended = highest composite score (quality + price + availability + speed + warranty)
  const scored = available.map(s => ({
    i: s.i,
    score:
      (s.pricePerUnit <= cheapestPrice * 1.3 ? 30 : 0) +
      (s.type === 'OEM' ? 25 : s.type === 'REMANUFACTURED' ? 10 : 0) +
      (s.availability === 'IN_STOCK' ? 20 : s.availability === 'ORDER_2_DAYS' ? 10 : 0) +
      (s.deliveryDays <= 1 ? 15 : s.deliveryDays <= 3 ? 8 : 0) +
      (s.warranty === '12 חודשים' ? 10 : s.warranty === '6 חודשים' ? 5 : 0),
  }))

  const recommendedIdx = scored.length
    ? scored.reduce((a, b) => a.score > b.score ? a : b).i
    : 0

  return { partName, category, quantity, isOptional, notes, suppliers, cheapestIdx, recommendedIdx }
}

// ─── Batch builder ────────────────────────────────────────────────────────────

export function buildPartQuotes(
  parts: Array<{
    name:              string
    category:          string
    quantity:          number
    estimatedPriceILS: number
    isOptional:        boolean
    notes?:            string
  }>,
): PartQuote[] {
  return parts.map(p =>
    generatePartQuote(p.name, p.category, p.quantity, p.estimatedPriceILS, p.isOptional, p.notes)
  )
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

/** Total cost using the current selections (falls back to recommended) */
export function selectionTotal(
  quotes:     PartQuote[],
  selections: Record<number, string>,
): number {
  return quotes.reduce((sum, pq, i) => {
    const sup = pq.suppliers.find(s => s.supplierId === selections[i])
            ?? pq.suppliers[pq.recommendedIdx]
    return sum + (sup ? sup.pricePerUnit * pq.quantity : 0)
  }, 0)
}

/** Total if cheapest available supplier is picked for every part */
export function cheapestBundleTotal(quotes: PartQuote[]): number {
  return quotes.reduce((sum, pq) => {
    const sup = pq.suppliers[pq.cheapestIdx]
    return sum + (sup ? sup.pricePerUnit * pq.quantity : 0)
  }, 0)
}

/** Total if recommended supplier is picked for every part */
export function recommendedBundleTotal(quotes: PartQuote[]): number {
  return quotes.reduce((sum, pq) => {
    const sup = pq.suppliers[pq.recommendedIdx]
    return sum + (sup ? sup.pricePerUnit * pq.quantity : 0)
  }, 0)
}
