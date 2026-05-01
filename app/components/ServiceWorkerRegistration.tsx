'use client'

import { useEffect } from 'react'

// Registers the service worker so it's ready when the user grants permission.
// The actual push subscription (which requires a user gesture) is triggered
// from the Notifications section on the profile page.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(console.error)
  }, [])

  return null
}

// ─── Shared subscription helper (called on button click) ─────────────────────

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
