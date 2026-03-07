import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Ensure the challenge pool stays seeded — runs daily at midnight UTC.
crons.daily(
  'seed-challenge-pool',
  { hourUTC: 0, minuteUTC: 0 },
  internal.challenges.autoSeedChallengePool
)

// Ensure the achievements pool stays seeded — runs daily at midnight UTC.
crons.daily(
  'seed-achievements-pool',
  { hourUTC: 0, minuteUTC: 1 },
  internal.achievements.autoSeedAchievementsPool
)

export default crons
