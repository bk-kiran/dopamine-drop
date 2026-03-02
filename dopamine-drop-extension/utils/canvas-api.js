// ============================================
// CANVAS API INTEGRATION
// ============================================
// Fetches courses and assignments from Canvas using session cookies
// No API token required - uses user's existing Canvas session

import { updateCanvasAssignments } from './storage.js'

/**
 * Get Canvas base URL from current page
 */
function getCanvasBaseUrl() {
  const match = window.location.href.match(/(https:\/\/[^\/]+\.instructure\.com)/)
  return match ? match[1] : null
}

/**
 * Fetch active courses from Canvas API
 */
export async function fetchCourses() {
  const baseUrl = getCanvasBaseUrl()
  if (!baseUrl) {
    throw new Error('Not on Canvas - cannot fetch courses')
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/courses?enrollment_state=active&per_page=100`,
      {
        credentials: 'include', // Use session cookies
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status}`)
    }

    const courses = await response.json()

    // Filter to only student enrollments
    return courses.filter(course => {
      const studentEnrollment = course.enrollments?.find(e => e.type === 'student')
      return studentEnrollment !== undefined
    })
  } catch (error) {
    console.error('[Canvas API] Error fetching courses:', error)
    throw error
  }
}

/**
 * Fetch assignments for a specific course
 */
export async function fetchCourseAssignments(courseId) {
  const baseUrl = getCanvasBaseUrl()
  if (!baseUrl) {
    throw new Error('Not on Canvas - cannot fetch assignments')
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/courses/${courseId}/assignments?include[]=submission&per_page=100`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`[Canvas API] Error fetching assignments for course ${courseId}:`, error)
    return []
  }
}

/**
 * Fetch all assignments across all active courses
 */
export async function fetchAllAssignments() {
  try {
    const courses = await fetchCourses()
    const allAssignments = []

    for (const course of courses) {
      const assignments = await fetchCourseAssignments(course.id)

      assignments.forEach(assignment => {
        allAssignments.push(formatAssignment(assignment, course))
      })
    }

    return allAssignments
  } catch (error) {
    console.error('[Canvas API] Error fetching all assignments:', error)
    return []
  }
}

/**
 * Format Canvas assignment to extension schema
 */
function formatAssignment(assignment, course) {
  const submission = assignment.submission

  // Determine status
  let status = 'pending'
  let submittedAt = null

  if (submission) {
    if (submission.workflow_state === 'submitted' || submission.submitted_at) {
      status = 'submitted'
      submittedAt = submission.submitted_at
    } else if (submission.missing) {
      status = 'missing'
    }
  }

  return {
    id: `canvas_${course.id}_${assignment.id}`,
    canvasId: assignment.id.toString(),
    courseId: course.id.toString(),
    courseName: cleanCourseName(course.name),
    title: assignment.name,
    dueAt: assignment.due_at,
    pointsPossible: assignment.points_possible || 0,
    submittedAt,
    gradeReceived: null, // Not available in this API call
    gradedAt: null,
    completed: status === 'submitted',
    completedAt: submittedAt,
    isUrgent: false, // Will be calculated on frontend
    isCustom: false,
  }
}

/**
 * Clean course name - remove Canvas IDs, semester codes, abbreviate departments
 */
function cleanCourseName(name) {
  let cleaned = name

  // Remove patterns like "[12345]" or "(S2025)" or "-001"
  cleaned = cleaned.replace(/\[.*?\]/g, '')
  cleaned = cleaned.replace(/\(.*?\)/g, '')
  cleaned = cleaned.replace(/-\d{3,}/g, '')
  cleaned = cleaned.replace(/\s+-\s+\d+/g, '')

  // Abbreviate common department names
  const abbreviations = {
    'COMPSCI': 'CS',
    'COMPUTER SCIENCE': 'CS',
    'MATHEMATICS': 'MATH',
    'ELECTRICAL ENGINEERING': 'EE',
    'MECHANICAL ENGINEERING': 'ME',
    'CHEMISTRY': 'CHEM',
    'PHYSICS': 'PHYS',
    'BIOLOGY': 'BIO',
    'PSYCHOLOGY': 'PSYCH',
    'POLITICAL SCIENCE': 'POLI SCI',
    'ECONOMICS': 'ECON',
  }

  for (const [full, abbr] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${full}\\b`, 'gi')
    cleaned = cleaned.replace(regex, abbr)
  }

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * Sync Canvas assignments to storage
 * Merges with existing assignments while preserving manual flags
 */
export async function syncCanvasAssignments() {
  try {
    console.log('[Canvas API] Starting sync...')

    const freshAssignments = await fetchAllAssignments()

    // Get existing assignments from storage
    const { canvasAssignments: existingAssignments = [] } =
      await chrome.storage.local.get('canvasAssignments')

    // Create map of existing assignments by Canvas ID
    const existingMap = new Map()
    existingAssignments.forEach(a => {
      existingMap.set(a.id, a)
    })

    // Merge: preserve manual flags (isUrgent, manual completions)
    const merged = freshAssignments.map(fresh => {
      const existing = existingMap.get(fresh.id)

      if (existing) {
        return {
          ...fresh,
          // Preserve manual flags
          isUrgent: existing.isUrgent,
          // If user manually completed but Canvas doesn't show submitted, keep manual completion
          completed: fresh.completed || existing.completed,
          completedAt: fresh.completedAt || existing.completedAt,
        }
      }

      return fresh
    })

    // Save to storage
    await updateCanvasAssignments(merged)

    // Update last sync timestamp
    const { settings = {} } = await chrome.storage.local.get('settings')
    await chrome.storage.local.set({
      settings: {
        ...settings,
        lastSyncTimestamp: new Date().toISOString(),
      },
    })

    console.log(`[Canvas API] Sync complete - ${merged.length} assignments`)
    return merged
  } catch (error) {
    console.error('[Canvas API] Sync failed:', error)
    throw error
  }
}

/**
 * Get Canvas user ID from API
 */
export async function fetchCanvasUserId() {
  const baseUrl = getCanvasBaseUrl()
  if (!baseUrl) return null

  try {
    const response = await fetch(`${baseUrl}/api/v1/users/self`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) return null

    const userData = await response.json()
    return userData.id?.toString() || null
  } catch (error) {
    console.error('[Canvas API] Error fetching user ID:', error)
    return null
  }
}
