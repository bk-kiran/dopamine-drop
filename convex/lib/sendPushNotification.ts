// Types only — no Node.js imports here.
// The actual sendPushToUser implementation lives in convex/notificationJobs.ts
// (which carries "use node" so the bundler uses Node.js platform settings).

export type PushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type PushPayload = {
  title: string
  body: string
  url: string
}
