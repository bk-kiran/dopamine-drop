// ============================================
// BACKGROUND SERVICE WORKER
// ============================================

console.log('[Background] Service worker started')

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed')

  // Initialize storage with defaults
  const data = await chrome.storage.local.get(null)

  if (!data.stats) {
    await chrome.storage.local.set({
      stats: {
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        weekCompleted: 0,
        weekTotal: 0
      },
      customTasks: [],
      canvasAssignments: [],
      pointsLedger: [],
      settings: {
        selectedCourseFilter: null,
        selectedWeekStart: getCurrentWeekStart(),
        syncEnabled: false,
        syncToken: null,
        lastSyncTimestamp: null
      }
    })
  }
})

// Set up periodic Canvas sync alarm (every 30 minutes)
chrome.alarms.create('syncCanvas', { periodInMinutes: 30 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncCanvas') {
    console.log('[Background] Running scheduled Canvas sync...')
    triggerCanvasSync()
  }
})

/**
 * Trigger Canvas sync by sending message to content script
 */
async function triggerCanvasSync() {
  // Get all Canvas tabs
  const tabs = await chrome.tabs.query({ url: 'https://*.instructure.com/*' })

  if (tabs.length === 0) {
    console.log('[Background] No Canvas tabs open, skipping sync')
    return
  }

  // Send sync message to first Canvas tab
  chrome.tabs.sendMessage(tabs[0].id, { type: 'SYNC_CANVAS' })
}

/**
 * Listen for messages from content script or sidebar
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message)

  switch (message.type) {
    case 'SYNC_COMPLETE':
      console.log('[Background] Sync completed with', message.count, 'assignments')
      sendResponse({ success: true })
      break

    case 'SYNC_ERROR':
      console.error('[Background] Sync error:', message.error)
      sendResponse({ success: false })
      break

    default:
      sendResponse({ success: false, error: 'Unknown message type' })
  }

  return true // Keep message channel open for async response
})

/**
 * Helper: Get current week start (Monday)
 */
function getCurrentWeekStart() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const monday = new Date(today)
  monday.setDate(today.getDate() - daysToMonday)
  monday.setHours(0, 0, 0, 0)

  return monday.toISOString().split('T')[0]
}
