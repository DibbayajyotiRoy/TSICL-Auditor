// Statistical sample size: Cochran's formula with finite-population correction.
// Self-check: node --experimental-strip-types src/features/field/sampling.ts
export type Confidence = 90 | 95 | 99
export const Z: Record<Confidence, number> = { 90: 1.645, 95: 1.96, 99: 2.576 }

/** margin and errorRate are fractions (0.05 = 5%). errorRate 0.5 is the safest (largest-sample) assumption. */
export function sampleSize(population: number, confidence: Confidence, margin: number, errorRate = 0.5): number {
  if (population <= 0) return 0
  const p = Math.min(0.99, Math.max(0.01, errorRate))
  const n0 = (Z[confidence] ** 2 * p * (1 - p)) / (margin * margin)
  return Math.min(Math.floor(population), Math.max(1, Math.ceil(n0 / (1 + (n0 - 1) / population))))
}

const g = globalThis as { process?: { argv: string[] } }
if (g.process?.argv[1]?.endsWith('sampling.ts')) {
  const eq = (a: number, b: number) => { if (a !== b) throw new Error(`expected ${b}, got ${a}`) }
  eq(sampleSize(70, 95, 0.05, 0.5), 60) // 384.16 / (1 + 383.16/70) = 59.3 -> 60
  eq(sampleSize(1_000_000, 95, 0.05, 0.5), 385) // the textbook "385"
  eq(sampleSize(1_000_000, 99, 0.05, 0.5), 664)
  eq(sampleSize(10, 99, 0.03, 0.5), 10) // never more than the population
  eq(sampleSize(1, 95, 0.05, 0.5), 1)
  eq(sampleSize(0, 95, 0.05, 0.5), 0)
  if (!(sampleSize(500, 95, 0.05, 0.1) < sampleSize(500, 95, 0.05, 0.5))) throw new Error('lower error rate must need fewer')
  console.log('sampling.ts: all checks passed')
}
