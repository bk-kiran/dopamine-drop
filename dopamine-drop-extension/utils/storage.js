// ============================================
// STORAGE SCHEMA
// ============================================
/*
chrome.storage.local structure:
{
  stats: {
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    weekCompleted: 0,
    weekTotal: 0
  },

  customTasks: [
    {
      id: "ct_timestamp",
      title: "Study for midterm",
      dueAt: "2026-03-05T14:00:00",
      points: 30,
      courseName: null,
      completed: false,
      completedAt: null,
      isUrgent: false,
      isCustom: true
    }
  ],

  canvasAssignments: [
    {
      id: "canvas_12345_456",
      canvasId: "456",
      courseId: "12345",
      courseName: "COMPSCI 446",
      title: "P1",
      dueAt: "2026-02-24T17:00:00",
      pointsPossible: 100,
      submittedAt: null,
      gradeReceived: null,
      gradedAt: null,
      completed: false,
      completedAt: null,
      isUrgent: false,
      isCustom: false
    }
  ],

  pointsLedger: [
    {
      timestamp: "2026-03-01T10:30:00",
      points: 20,
      reason: "Completed P1 early",
      taskId: "canvas_12345_456"
    }
  ],

  settings: {
    selectedCourseFilter: null,
    selectedWeekStart: "2026-02-23",
    syncEnabled: false,
    syncToken: null,
    lastSyncTimestamp: null
  }
}
*/

// ============================================
// STORAGE FUNCTIONS
// ============================================

/**
 * Initialize storage with default values if empty
 */
export async function initializeStorage() {
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
      }
    })
  }

  if (!data.customTasks) {
    await chrome.storage.local.set({ customTasks: [] })
  }

  if (!data.canvasAssignments) {
    await chrome.storage.local.set({ canvasAssignments: [] })
  }

  if (!data.pointsLedger) {
    await chrome.storage.local.set({ pointsLedger: [] })
  }

  if (!data.settings) {
    await chrome.storage.local.set({
      settings: {
        selectedCourseFilter: null,
        selectedWeekStart: getCurrentWeekStart(),
        syncEnabled: false,
        syncToken: null,
        lastSyncTimestamp: null
      }
    })
  }

  console.log('[Storage] Initialized')
}

/**
 * Get all stored data
 */
export async function getAllData() {
  return await chrome.storage.local.get(null)
}

/**
 * Update stats
 */
export async function updateStats(updates) {
  const { stats } = await chrome.storage.local.get('stats')
  const updatedStats = { ...stats, ...updates }
  await chrome.storage.local.set({ stats: updatedStats })
  return updatedStats
}

/**
 * Add custom task
 */
export async function addCustomTask(task) {
  const { customTasks } = await chrome.storage.local.get('customTasks')
  const newTask = {
    id: `ct_${Date.now()}`,
    ...task,
    completed: false,
    completedAt: null,
    isUrgent: false,
    isCustom: true
  }
  customTasks.push(newTask)
  await chrome.storage.local.set({ customTasks })
  return newTask
}

/**
 * Update custom task
 */
export async function updateCustomTask(taskId, updates) {
  const { customTasks } = await chrome.storage.local.get('customTasks')
  const index = customTasks.findIndex(t => t.id === taskId)
  if (index === -1) return null

  customTasks[index] = { ...customTasks[index], ...updates }
  await chrome.storage.local.set({ customTasks })
  return customTasks[index]
}

/**
 * Delete custom task
 */
export async function deleteCustomTask(taskId) {
  const { customTasks } = await chrome.storage.local.get('customTasks')
  const filtered = customTasks.filter(t => t.id !== taskId)
  await chrome.storage.local.set({ customTasks: filtered })
}

/**
 * Update Canvas assignment
 */
export async function updateCanvasAssignment(assignmentId, updates) {
  const { canvasAssignments } = await chrome.storage.local.get('canvasAssignments')
  const index = canvasAssignments.findIndex(a => a.id === assignmentId)
  if (index === -1) return null

  canvasAssignments[index] = { ...canvasAssignments[index], ...updates }
  await chrome.storage.local.set({ canvasAssignments })
  return canvasAssignments[index]
}

/**
 * Bulk update Canvas assignments (used during sync)
 */
export async function updateCanvasAssignments(assignments) {
  await chrome.storage.local.set({ canvasAssignments: assignments })
}

/**
 * Add points to ledger
 */
export async function addToPointsLedger(entry) {
  const { pointsLedger } = await chrome.storage.local.get('pointsLedger')
  pointsLedger.push({
    timestamp: new Date().toISOString(),
    ...entry
  })
  await chrome.storage.local.set({ pointsLedger })
}

/**
 * Update settings
 */
export async function updateSettings(updates) {
  const { settings } = await chrome.storage.local.get('settings')
  const updatedSettings = { ...settings, ...updates }
  await chrome.storage.local.set({ settings: updatedSettings })
  return updatedSettings
}

/**
 * Clear all data (for reset)
 */
export async function clearAllData() {
  await chrome.storage.local.clear()
  await initializeStorage()
}

/**
 * Helper: Get current week start (Monday)
 */
function getCurrentWeekStart() {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const monday = new Date(today)
  monday.setDate(today.getDate() - daysToMonday)
  monday.setHours(0, 0, 0, 0)

  return monday.toISOString().split('T')[0]
}
