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

// Push: 24-hour due-date reminders — runs every hour
crons.interval(
  'check-24hr-reminders',
  { hours: 1 },
  internal.notificationJobs.check24HrReminders
)

// Push: 2-hour due-date reminders — runs every 15 minutes
crons.interval(
  'check-2hr-reminders',
  { minutes: 15 },
  internal.notificationJobs.check2HrReminders
)

// Push: streak-at-risk reminders — runs every hour
crons.interval(
  'check-streak-reminders',
  { hours: 1 },
  internal.notificationJobs.checkStreakReminders
)

// Email: weekly digest — 9am UTC every Monday
crons.cron(
  'weekly-digest',
  '0 9 * * 1',
  internal.notificationJobs.sendWeeklyDigest
)

export default crons
