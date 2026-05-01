"use node"

import { internalAction, action } from './_generated/server'
import { internal, api } from './_generated/api'
import { v } from 'convex/values'
import webpush from 'web-push'
import { Resend } from 'resend'

// ─── Push helper ──────────────────────────────────────────────────────────────

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } }
type PushPayload = { title: string; body: string; url: string }

async function sendPushToUser(
  subscriptions: Sub[],
  payload: PushPayload
): Promise<{ expiredEndpoints: string[] }> {
  // Defer VAPID setup to invocation time so env vars are available
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const expiredEndpoints: string[] = []
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        )
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint)
        } else {
          console.error(`[push] Failed for …${sub.endpoint.slice(-20)}:`, err?.message ?? String(err))
        }
      }
    })
  )
  return { expiredEndpoints }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEDUP_WINDOW_MS = 20 * 60 * 60 * 1000 // 20 hours

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function sendAndLog(
  ctx: any,
  tasks: { taskId: string; title: string; clerkId: string; subscriptions: { endpoint: string; keys: { p256dh: string; auth: string } }[] }[],
  type: '24hr' | '2hr',
  makePayload: (title: string) => { title: string; body: string; url: string }
) {
  const nowMs = Date.now()

  for (const task of tasks) {
    // Double-fire guard
    const logEntry = await ctx.runQuery(internal.notifications.getNotificationLogEntry, {
      clerkId: task.clerkId,
      taskId: task.taskId,
      type,
    })
    if (logEntry && nowMs - logEntry.sentAt < DEDUP_WINDOW_MS) continue

    const { expiredEndpoints } = await sendPushToUser(task.subscriptions, makePayload(task.title))

    await ctx.runMutation(internal.notifications.upsertNotificationLog, {
      clerkId: task.clerkId,
      taskId: task.taskId,
      type,
      sentAt: nowMs,
    })

    for (const endpoint of expiredEndpoints) {
      await ctx.runMutation(api.notifications.deletePushSubscription, {
        clerkId: task.clerkId,
        endpoint,
      })
    }
  }
}

// ─── CHECK_24HR_REMINDERS (every hour) ───────────────────────────────────────

export const check24HrReminders = internalAction({
  handler: async (ctx) => {
    const nowMs = Date.now()
    const tasks = await ctx.runQuery(internal.notifications.getRemindableTasks, {
      windowStartMs: nowMs + 23 * 3600 * 1000,
      windowEndMs: nowMs + 25 * 3600 * 1000,
    })

    await sendAndLog(ctx, tasks, '24hr', (title) => ({
      title: '📚 Due in 24 hours',
      body: `${title} is due tomorrow`,
      url: '/dashboard',
    }))
  },
})

// ─── CHECK_2HR_REMINDERS (every 15 minutes) ──────────────────────────────────

export const check2HrReminders = internalAction({
  handler: async (ctx) => {
    const nowMs = Date.now()
    const tasks = await ctx.runQuery(internal.notifications.getRemindableTasks, {
      windowStartMs: nowMs + 105 * 60 * 1000, // 1h 45m
      windowEndMs: nowMs + 135 * 60 * 1000,   // 2h 15m
    })

    await sendAndLog(ctx, tasks, '2hr', (title) => ({
      title: '⏰ Due in 2 hours',
      body: `${title} is due very soon`,
      url: '/dashboard',
    }))
  },
})

// ─── CHECK_STREAK_REMINDERS (every hour) ─────────────────────────────────────

export const checkStreakReminders = internalAction({
  handler: async (ctx) => {
    const nowMs = Date.now()
    const usersAtRisk = await ctx.runQuery(internal.notifications.getStreakAtRiskUsers)

    for (const user of usersAtRisk) {
      const logEntry = await ctx.runQuery(internal.notifications.getNotificationLogEntry, {
        clerkId: user.clerkId,
        taskId: 'streak',
        type: 'streak',
      })
      if (logEntry && nowMs - logEntry.sentAt < DEDUP_WINDOW_MS) continue

      const { expiredEndpoints } = await sendPushToUser(user.subscriptions, {
        title: '🔥 Your streak is at risk!',
        body: 'Log in to keep your streak alive',
        url: '/dashboard',
      })

      await ctx.runMutation(internal.notifications.upsertNotificationLog, {
        clerkId: user.clerkId,
        taskId: 'streak',
        type: 'streak',
        sentAt: nowMs,
      })

      for (const endpoint of expiredEndpoints) {
        await ctx.runMutation(api.notifications.deletePushSubscription, {
          clerkId: user.clerkId,
          endpoint,
        })
      }
    }
  },
})

// ─── WEEKLY_DIGEST (9am UTC every Monday) ────────────────────────────────────

function buildDigestEmail(data: {
  displayName: string
  streakCount: number
  leaderboardRank: number | null
  upcoming: { title: string; courseName: string; dueAt: string }[]
  onTimeCount: number
  totalCount: number
}): string {
  const { displayName, streakCount, leaderboardRank, upcoming, onTimeCount, totalCount } = data

  const rankDisplay = leaderboardRank !== null ? `#${leaderboardRank}` : 'N/A'

  const onTimeRate = totalCount > 0 ? onTimeCount / totalCount : null
  let insightLine: string
  if (onTimeRate === null) {
    insightLine = "No tasks submitted last week. This week is a great time to build momentum. 🚀"
  } else if (onTimeRate >= 0.8) {
    insightLine = `You submitted ${onTimeCount}/${totalCount} tasks on time last week — great consistency 🔥`
  } else if (onTimeRate >= 0.5) {
    insightLine = `You got ${onTimeCount}/${totalCount} in on time last week. A little more discipline this week and you'll be in the green 💪`
  } else {
    insightLine = `Rough week — only ${onTimeCount}/${totalCount} on time. This week is a fresh start 🌱`
  }

  const upcomingRows = upcoming.length > 0
    ? upcoming.map((task) => {
        const date = new Date(task.dueAt)
        const formatted = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #2a2a2a;">
            <div>
              <div style="color:#ffffff;font-size:14px;font-weight:500;line-height:1.4;">${task.title}</div>
              <div style="color:#9ca3af;font-size:12px;margin-top:3px;">${task.courseName}</div>
            </div>
            <div style="color:#7c3aed;font-size:12px;font-weight:600;white-space:nowrap;margin-left:16px;">${formatted}</div>
          </div>`
      }).join('')
    : `<p style="color:#9ca3af;font-size:14px;margin:0;">Nothing due — enjoy the break! 🎉</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your week ahead — Dopamine Drop</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;padding:0 0 32px;">
      <h1 style="margin:0;font-size:26px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px;">dopamine drop</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Weekly Digest</p>
    </div>

    <!-- Greeting -->
    <p style="color:#d1d5db;font-size:15px;margin:0 0 24px;">Hey ${displayName}, here's your week ahead.</p>

    <!-- Stats strip -->
    <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="text-align:center;padding:8px 12px;border-right:1px solid #2a2a2a;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;">🔥 ${streakCount}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">day streak</div>
          </td>
          <td style="text-align:center;padding:8px 12px;border-right:1px solid #2a2a2a;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;">⚡ ${rankDisplay}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">leaderboard rank</div>
          </td>
          <td style="text-align:center;padding:8px 12px;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;">✅ ${onTimeCount}/${totalCount}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">on time this week</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Upcoming -->
    <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h2 style="color:#ffffff;font-size:15px;font-weight:600;margin:0 0 16px;letter-spacing:-0.2px;">Coming up this week</h2>
      ${upcomingRows}
    </div>

    <!-- Insight -->
    <div style="background:#1a1230;border:1px solid #3b2a6e;border-radius:12px;padding:20px;margin-bottom:32px;">
      <p style="color:#c4b5fd;font-size:14px;margin:0;line-height:1.7;">${insightLine}</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="color:#4b5563;font-size:12px;line-height:1.7;margin:0;">
        You're receiving this because you have email notifications enabled.<br>
        <a href="https://dopamine-drop.vercel.app/dashboard/profile" style="color:#7c3aed;text-decoration:none;">Manage preferences</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

export const sendWeeklyDigest = internalAction({
  handler: async (ctx) => {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const users = await ctx.runQuery(internal.notifications.getWeeklyDigestData)

    for (const user of users) {
      try {
        await resend.emails.send({
          // onboarding@resend.dev works without domain verification (Resend testing domain)
          // Switch to your own verified domain (e.g. notifications@yourdomain.com) for production
          from: 'Dopamine Drop <onboarding@resend.dev>',
          to: user.email,
          subject: 'Your week ahead 📚 — Dopamine Drop',
          html: buildDigestEmail(user),
        })
      } catch (err) {
        console.error(`[digest] Failed to send to ${user.email}:`, err)
      }
    }
  },
})

// ─── Test action (run from Convex dashboard to verify push end-to-end) ────────

export const sendTestPush = action({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const subs = await ctx.runQuery(internal.notifications.getSubscriptionsForUser, { clerkId: args.clerkId })
    if (subs.length === 0) return { sent: 0, error: 'No subscriptions found for this clerkId' }

    let sent = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: '🎉 Test notification', body: 'Push notifications are working!', url: '/dashboard' })
        )
        sent++
      } catch (err: any) {
        console.error('[test-push] error:', err?.message)
      }
    }
    return { sent }
  },
})
