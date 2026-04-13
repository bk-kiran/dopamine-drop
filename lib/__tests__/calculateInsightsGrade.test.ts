import { describe, it, expect } from 'vitest'
import { calculateInsightsGrade } from '../calculateInsightsGrade'

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_1H  = 1 * 60 * 60 * 1000
const MS_24H = 24 * 60 * 60 * 1000
const MS_48H = 48 * 60 * 60 * 1000

// Arbitrary reference point — the absolute value doesn't matter, only deltas do
const T = 1_000_000_000_000

// Full-credit defaults used as a stable baseline so individual tests only vary one axis
const FULL_EFFICIENCY = { pointsEarned: 100, maxPossiblePoints: 100 }
const ZERO_PUSHBACKS: Array<{ date: number; changedAt: number }> = []
const RATING_5 = 5

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a pushback history array of a given length. Contents don't matter for scoring. */
function pushbacks(n: number) {
  return Array.from({ length: n }, (_, i) => ({ date: T + i, changedAt: T + i + 1 }))
}

// ─── TIMELINESS (0–40) ────────────────────────────────────────────────────────

describe('timeliness', () => {
  it('submitted exactly on time → 40', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(40)
  })

  it('submitted 24 hrs early → 40', () => {
    const r = calculateInsightsGrade(T - MS_24H, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(40)
  })

  it('submitted 24 hrs late → 20 (midpoint linear decay)', () => {
    // msLate = 24h, MS_48H = 48h → timeliness = 40 * (1 - 0.5) = 20
    const r = calculateInsightsGrade(T + MS_24H, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(20)
  })

  it('submitted exactly 48 hrs late → 0 (decay floor)', () => {
    const r = calculateInsightsGrade(T + MS_48H, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(0)
  })

  it('submitted 72 hrs late → 0 (no negative timeliness)', () => {
    const r = calculateInsightsGrade(T + 72 * MS_1H, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(0)
  })

  it('originalDueDate undefined → 40 (no due date = full credit)', () => {
    const r = calculateInsightsGrade(T, undefined, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(40)
  })

  it('submittedAt undefined → 40 (unknown submission = full credit)', () => {
    const r = calculateInsightsGrade(undefined, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(40)
  })

  it('both submittedAt and originalDueDate undefined → 40', () => {
    const r = calculateInsightsGrade(undefined, undefined, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.timeliness).toBe(40)
  })
})

// ─── EFFICIENCY (0–30) ────────────────────────────────────────────────────────

describe('efficiency', () => {
  it('pointsEarned === maxPossiblePoints → 30', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, 100, 100, RATING_5)
    expect(r.breakdown.efficiency).toBe(30)
  })

  it('pointsEarned is half of maxPossiblePoints → 15', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, 50, 100, RATING_5)
    expect(r.breakdown.efficiency).toBe(15)
  })

  it('pointsEarned is 0, maxPossiblePoints > 0 → 0', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, 0, 100, RATING_5)
    expect(r.breakdown.efficiency).toBe(0)
  })

  it('maxPossiblePoints is 0 → 30 (full credit, cannot penalize untracked)', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, 0, 0, RATING_5)
    expect(r.breakdown.efficiency).toBe(30)
  })

  it('maxPossiblePoints is undefined → 30 (full credit)', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, 0, undefined, RATING_5)
    expect(r.breakdown.efficiency).toBe(30)
  })
})

// ─── CONSISTENCY (0–15) ───────────────────────────────────────────────────────

describe('consistency', () => {
  it('0 pushbacks → 15', () => {
    const r = calculateInsightsGrade(T, T, pushbacks(0), ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.consistency).toBe(15)
  })

  it('1 pushback → 12', () => {
    const r = calculateInsightsGrade(T, T, pushbacks(1), ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.consistency).toBe(12)
  })

  it('3 pushbacks → 6', () => {
    const r = calculateInsightsGrade(T, T, pushbacks(3), ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.consistency).toBe(6)
  })

  it('5 pushbacks → 0 (floor)', () => {
    const r = calculateInsightsGrade(T, T, pushbacks(5), ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.consistency).toBe(0)
  })

  it('10 pushbacks → 0 (no negative consistency)', () => {
    const r = calculateInsightsGrade(T, T, pushbacks(10), ...Object.values(FULL_EFFICIENCY) as [number, number], RATING_5)
    expect(r.breakdown.consistency).toBe(0)
  })
})

// ─── SELF-SCORE (0–15) ────────────────────────────────────────────────────────

describe('selfScore', () => {
  it('rating 5 → 15', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], 5)
    expect(r.breakdown.selfScore).toBe(15)
  })

  it('rating 3 → 9', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], 3)
    expect(r.breakdown.selfScore).toBe(9)
  })

  it('rating 1 → 3', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, ...Object.values(FULL_EFFICIENCY) as [number, number], 1)
    expect(r.breakdown.selfScore).toBe(3)
  })
})

// ─── GRADE THRESHOLDS ────────────────────────────────────────────────────────
//
// Inputs are constructed to produce exact target scores.
// Formula: score = Math.round(timeliness + efficiency + consistency + selfScore)
// With: efficiency=30 (full pts), consistency=15 (0 pushbacks), selfScore=9 (rating 3)
// timeliness = 40 * (1 - msLate / MS_48H), so msLate = MS_48H * (1 - timeliness/40)
//
// Targets:
//   score 95 → timeliness = 41 (on time + offset)… easier: timeliness=38 (2.4h late), selfScore=12 (rating4) → 38+30+15+12=95
//   score 90 → timeliness=36 (4.8h late), selfScore=9 (rating3) → 36+30+15+9=90
//   score 89 → timeliness=35 (6h late)  → 35+30+15+9=89
//   score 80 → timeliness=26 (16.8h late) → 26+30+15+9=80
//   score 79 → timeliness=25 (18h late)  → 25+30+15+9=79
//   score 70 → timeliness=16 (28.8h late) → 16+30+15+9=70
//   score 69 → timeliness=15 (30h late)   → 15+30+15+9=69
//   score 60 → timeliness=6  (40.8h late) → 6+30+15+9=60
//   score 59 → timeliness=5  (42h late)   → 5+30+15+9=59
//   score ~3 → timeliness=0, efficiency=0, consistency=0, selfScore=3 (rating1) → 3

describe('grade thresholds', () => {
  // score 95 → "A"
  it('score 95 → "A"', () => {
    // timeliness=38 (2.4h late), efficiency=30, consistency=15, selfScore=12 (rating 4)
    const r = calculateInsightsGrade(T + 2.4 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 4)
    expect(r.score).toBe(95)
    expect(r.grade).toBe('A')
  })

  it('score 90 → "A" (lower boundary)', () => {
    // timeliness=36 (4.8h late), efficiency=30, consistency=15, selfScore=9 (rating 3)
    const r = calculateInsightsGrade(T + 4.8 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(90)
    expect(r.grade).toBe('A')
  })

  it('score 89 → "B"', () => {
    // timeliness=35 (6h late), efficiency=30, consistency=15, selfScore=9
    const r = calculateInsightsGrade(T + 6 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(89)
    expect(r.grade).toBe('B')
  })

  it('score 80 → "B" (lower boundary)', () => {
    // timeliness=26 (16.8h late), efficiency=30, consistency=15, selfScore=9
    const r = calculateInsightsGrade(T + 16.8 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(80)
    expect(r.grade).toBe('B')
  })

  it('score 79 → "C"', () => {
    // timeliness=25 (18h late), efficiency=30, consistency=15, selfScore=9
    const r = calculateInsightsGrade(T + 18 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(79)
    expect(r.grade).toBe('C')
  })

  it('score 70 → "C" (lower boundary)', () => {
    // timeliness=16 (28.8h late), efficiency=30, consistency=15, selfScore=9
    const r = calculateInsightsGrade(T + 28.8 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(70)
    expect(r.grade).toBe('C')
  })

  it('score 69 → "D"', () => {
    // timeliness=15 (30h late), efficiency=30, consistency=15, selfScore=9
    const r = calculateInsightsGrade(T + 30 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(69)
    expect(r.grade).toBe('D')
  })

  it('score 60 → "D" (lower boundary)', () => {
    // timeliness=6 (40.8h late), efficiency=30, consistency=15, selfScore=9
    const r = calculateInsightsGrade(T + 40.8 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(60)
    expect(r.grade).toBe('D')
  })

  it('score 59 → "F"', () => {
    // timeliness=5 (42h late), efficiency=30, consistency=15, selfScore=9
    const r = calculateInsightsGrade(T + 42 * MS_1H, T, ZERO_PUSHBACKS, 100, 100, 3)
    expect(r.score).toBe(59)
    expect(r.grade).toBe('F')
  })

  it('score ~3 → "F" (all-zero except minimum self-score)', () => {
    // timeliness=0 (>48h), efficiency=0 (0/100 pts), consistency=0 (5 pushbacks), selfScore=3 (rating 1)
    const r = calculateInsightsGrade(T + MS_48H, T, pushbacks(5), 0, 100, 1)
    expect(r.score).toBe(3)
    expect(r.grade).toBe('F')
  })
})

// ─── FULL SCENARIOS ───────────────────────────────────────────────────────────

describe('full scenarios', () => {
  it('perfect submission: on time, full points, 0 pushbacks, rating 5 → score 100, grade A', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, 100, 100, 5)
    expect(r.score).toBe(100)
    expect(r.grade).toBe('A')
    expect(r.breakdown).toEqual({ timeliness: 40, efficiency: 30, consistency: 15, selfScore: 15 })
  })

  it('late procrastinator: 48h late, 50% points, 3 pushbacks, rating 2 → score 27, grade F', () => {
    // timeliness = 0 (exactly 48h → floor), efficiency = Math.round(30 * 0.5) = 15
    // consistency = Math.max(0, 15 - 9) = 6, selfScore = Math.round(15 * 2/5) = 6
    // score = Math.round(0 + 15 + 6 + 6) = 27
    const r = calculateInsightsGrade(T + MS_48H, T, pushbacks(3), 50, 100, 2)
    expect(r.score).toBe(27)
    expect(r.grade).toBe('F')
    expect(r.breakdown.timeliness).toBe(0)
    expect(r.breakdown.efficiency).toBe(15)
    expect(r.breakdown.consistency).toBe(6)
    expect(r.breakdown.selfScore).toBe(6)
  })

  it('no due date task: undefined originalDueDate + submittedAt, full points, 0 pushbacks, rating 4 → timeliness 40, grade A', () => {
    // timeliness = 40, efficiency = 30, consistency = 15, selfScore = Math.round(15 * 4/5) = 12
    // score = 97 → grade A
    const r = calculateInsightsGrade(undefined, undefined, ZERO_PUSHBACKS, 100, 100, 4)
    expect(r.breakdown.timeliness).toBe(40)
    expect(r.score).toBe(97)
    expect(['A', 'B']).toContain(r.grade) // spec says A or B; will be A at 97
    expect(r.grade).toBe('A')
  })

  it('return shape is complete', () => {
    const r = calculateInsightsGrade(T, T, ZERO_PUSHBACKS, 100, 100, 5)
    expect(r).toHaveProperty('score')
    expect(r).toHaveProperty('grade')
    expect(r).toHaveProperty('breakdown.timeliness')
    expect(r).toHaveProperty('breakdown.efficiency')
    expect(r).toHaveProperty('breakdown.consistency')
    expect(r).toHaveProperty('breakdown.selfScore')
  })

  it('breakdown values sum to within 1 of score (single-rounding tolerance)', () => {
    // The raw sum is rounded once for score; breakdown values are each independently rounded.
    // They may diverge by at most 1 due to double-rounding.
    const r = calculateInsightsGrade(T + 7 * MS_1H, T, pushbacks(2), 80, 100, 3)
    const breakdownSum = r.breakdown.timeliness + r.breakdown.efficiency + r.breakdown.consistency + r.breakdown.selfScore
    expect(Math.abs(r.score - breakdownSum)).toBeLessThanOrEqual(1)
  })
})
