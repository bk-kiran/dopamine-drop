'use strict'

// ── Config ────────────────────────────────────────────────────────────────────
// TODO: replace with your actual Convex deployment URL.
// Both values are stored in chrome.storage so the user can override them
// without rebuilding the extension (see saveConfig / loadConfig below).
const DEFAULT_CONVEX_URL = 'https://your-deployment.convex.cloud'
const DEFAULT_APP_URL    = 'https://your-app.vercel.app'

// ── State ─────────────────────────────────────────────────────────────────────
let convex          = null   // ConvexHttpClient instance
let canvasUserId    = null   // extracted from window.ENV by content.js
let ddUserId        = null   // Convex _id of the matched user document
let ddUser          = null   // full user document
let currentAssigns  = []     // visible assignments after hidden-course filter
let selectedDay     = null   // { year, month, day } — calendar day filter
let calendarDate    = new Date()

// ── postMessage from content.js ───────────────────────────────────────────────
// content.js sends { type: 'DD_CANVAS_USER_ID', canvasUserId } after the
// iframe loads, using the extension's own origin as the target so only our
// sidebar page receives it.
window.addEventListener('message', async (event) => {
  if (event.data?.type !== 'DD_CANVAS_USER_ID') return
  if (!event.data.canvasUserId) return
  canvasUserId = String(event.data.canvasUserId)
  await initializeSidebar()
})

// ── Initialization ────────────────────────────────────────────────────────────

async function boot() {
  const cfg = await loadConfig()

  // ConvexHttpClient is exposed on window by the bridge script in sidebar.html
  // eslint-disable-next-line no-undef
  convex = new window.ConvexHttpClient(cfg.convexUrl)

  // Set "View All" link
  document.getElementById('dd-view-all').href = `${cfg.appUrl}/dashboard`

  // Show skeletons until data arrives
  setLoading(true)

  // The Canvas user ID arrives asynchronously via postMessage.
  // If it never arrives (non-Canvas page, content script not injected),
  // the sidebar stays in loading state — that's acceptable.
}

async function initializeSidebar() {
  setLoading(true)
  try {
    // Query Convex for the dopamine drop user whose canvasUserId matches
    const user = await convex.query('users:getUserByCanvasId', { canvasUserId })
    if (!user) {
      showState('NOT_REGISTERED')
      return
    }
    if (!user.canvasTokenEncrypted) {
      showState('NO_TOKEN')
      return
    }
    ddUserId = user._id
    ddUser   = user
    await loadData()
  } catch (err) {
    console.error('[dopamine drop] initializeSidebar:', err)
    showState('ERROR')
  }
}

// ── Data loading (HTTP, one-time) ─────────────────────────────────────────────

async function loadData() {
  try {
    // Fetch assignments with course info
    const assignments = await convex.query(
      'assignments:getAssignmentsWithCourseInfo',
      { userId: ddUserId }
    )

    // Update header stats from cached ddUser
    document.getElementById('streak').textContent = ddUser.streakCount ?? 0
    document.getElementById('points').textContent  = fmtNum(ddUser.totalPoints ?? 0)

    const hidden  = ddUser?.hiddenCourses ?? []
    const visible = (assignments ?? []).filter(
      (a) => !hidden.includes(a.canvasCourseId)
    )

    currentAssigns = visible
    updateHiddenCount((assignments?.length ?? 0) - visible.length)
    renderAssignmentList(visible)
    renderCalendar(visible)
    setLoading(false)
  } catch (err) {
    console.error('[dopamine drop] loadData:', err)
    setLoading(false)
  }
}

// Re-fetch assignments after a mutation (checkbox / urgent toggle)
async function refetchAssignments() {
  try {
    const assignments = await convex.query(
      'assignments:getAssignmentsWithCourseInfo',
      { userId: ddUserId }
    )
    const hidden  = ddUser?.hiddenCourses ?? []
    const visible = (assignments ?? []).filter(
      (a) => !hidden.includes(a.canvasCourseId)
    )
    currentAssigns = visible
    updateHiddenCount((assignments?.length ?? 0) - visible.length)
    renderAssignmentList(visible)
    renderCalendar(visible)
  } catch (err) {
    console.error('[dopamine drop] refetch:', err)
  }
}

// ── Render: assignment list ───────────────────────────────────────────────────

function renderAssignmentList(assignments) {
  const now     = new Date()
  const pending = assignments.filter((a) => a.status === 'pending' && !a.manuallyCompleted && a.canvasAssignmentId != null)

  // Apply calendar-day filter when the user has clicked a day
  const filtered = selectedDay
    ? pending.filter((a) => {
        if (!a.dueAt) return false
        const d = new Date(a.dueAt)
        return (
          d.getFullYear() === selectedDay.year  &&
          d.getMonth()    === selectedDay.month &&
          d.getDate()     === selectedDay.day
        )
      })
    : pending

  // Classify urgent: overdue, <24 h, or user-flagged
  const isUrgent = (a) => {
    if (a.isUrgent) return true
    if (!a.dueAt)   return false
    return (new Date(a.dueAt) - now) < 24 * 3600 * 1000
  }

  const urgentRows  = filtered
    .filter(isUrgent)
    .sort((a, b) =>
      (a.urgentOrder ?? 0) - (b.urgentOrder ?? 0) ||
      new Date(a.dueAt ?? 0) - new Date(b.dueAt ?? 0)
    )

  const regularRows = filtered
    .filter((a) => !isUrgent(a))
    .sort((a, b) => new Date(a.dueAt ?? '9999') - new Date(b.dueAt ?? '9999'))

  const urgentEl  = document.getElementById('urgent-list')
  const regularEl = document.getElementById('assignments-list')
  const emptyEl   = document.getElementById('dd-empty')

  if (!filtered.length) {
    urgentEl.innerHTML  = ''
    regularEl.innerHTML = ''
    emptyEl.style.display = 'flex'
    return
  }

  emptyEl.style.display = 'none'

  urgentEl.innerHTML = urgentRows.length
    ? `<span class="dd-urgent-label">🔥 Urgent</span>` +
      urgentRows.map((a) => assignmentRowHTML(a, true)).join('')
    : ''

  // Cap regular list at 8 to keep the sidebar from being overwhelming
  regularEl.innerHTML = regularRows.slice(0, 8).map((a) => assignmentRowHTML(a, false)).join('')
}

function assignmentRowHTML(a, isUrgent) {
  const submitted    = a.status === 'submitted' || a.manuallyCompleted === true
  const { label, cls } = relativeDate(a.dueAt)
  const pts            = a.pointsPossible ? `${a.pointsPossible} pts` : ''

  return `
    <div class="dd-assignment-row ${isUrgent ? 'urgent' : ''} ${submitted ? 'completed' : ''}"
         data-id="${esc(a._id)}">
      <div class="dd-checkbox ${submitted ? 'checked' : ''}"
           role="checkbox" aria-checked="${submitted}" tabindex="0"
           data-action="toggle" data-id="${esc(a._id)}"></div>

      <div class="dd-assignment-content">
        <span class="dd-assignment-title" title="${esc(a.title)}">${esc(a.title)}</span>
        <div class="dd-assignment-meta">
          <span class="dd-course-label">${esc(a.courseCode || a.courseName || '')}</span>
          ${a.courseCode || a.courseName ? `<span class="dd-meta-sep">·</span>` : ''}
          <span class="dd-due-label ${cls}">${esc(label)}</span>
          ${pts ? `<span class="dd-meta-sep">·</span><span>${esc(pts)}</span>` : ''}
        </div>
      </div>

      <button class="dd-urgent-icon" data-action="urgent" data-id="${esc(a._id)}"
              title="${a.isUrgent ? 'Remove urgent flag' : 'Mark urgent'}"
              style="opacity:${a.isUrgent ? '1' : '0.28'}">🔥</button>
    </div>`
}

// ── Render: mini calendar ─────────────────────────────────────────────────────

function renderCalendar(assignments) {
  const year  = calendarDate.getFullYear()
  const month = calendarDate.getMonth()

  document.getElementById('current-month').textContent =
    calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Build set of "Y-M-D" keys that have pending assignments
  const dueDays = new Set(
    assignments
      .filter((a) => a.status === 'pending' && a.dueAt)
      .map((a) => {
        const d = new Date(a.dueAt)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
  )

  const today      = new Date()
  const firstDow   = new Date(year, month, 1).getDay()        // 0 = Sun
  const daysInMon  = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  let html = DOW.map((d) => `<div class="dd-dow-header">${d}</div>`).join('')

  // Trailing days from previous month
  for (let i = firstDow - 1; i >= 0; i--) {
    html += `<div class="dd-day other-month"><span class="dd-day-num">${daysInPrev - i}</span></div>`
  }

  // Current-month days
  for (let day = 1; day <= daysInMon; day++) {
    const isToday = (
      today.getFullYear() === year &&
      today.getMonth()    === month &&
      today.getDate()     === day
    )
    const hasDue = dueDays.has(`${year}-${month}-${day}`)
    const isSel  = selectedDay?.year === year && selectedDay?.month === month && selectedDay?.day === day

    const cls = ['dd-day', isToday && 'today', hasDue && 'has-due', isSel && 'selected']
      .filter(Boolean).join(' ')

    html += `
      <div class="${cls}" data-action="day"
           data-year="${year}" data-month="${month}" data-day="${day}">
        <span class="dd-day-num">${day}</span>
        ${hasDue ? '<span class="dd-day-dot"></span>' : ''}
      </div>`
  }

  // Leading days for next month (fill last row)
  const totalCells = firstDow + daysInMon
  const trailing   = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
  for (let day = 1; day <= trailing; day++) {
    html += `<div class="dd-day other-month"><span class="dd-day-num">${day}</span></div>`
  }

  document.getElementById('calendar-grid').innerHTML = html
}

// ── Event delegation ──────────────────────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]')
  if (!el) return

  const { action, id, year, month, day } = el.dataset

  // ── Checkbox toggle ──────────────────────────────────────────────
  if (action === 'toggle') {
    const a = currentAssigns.find((x) => x._id === id)
    if (!a || !ddUserId) return
    try {
      if (a.status === 'pending' && !a.manuallyCompleted) {
        await convex.mutation('assignments:manuallyCompleteAssignment', {
          assignmentId: id,
          userId: ddUserId,
        })
      } else if (a.manuallyCompleted) {
        await convex.mutation('assignments:unCompleteAssignment', {
          assignmentId: id,
          userId: ddUserId,
        })
      }
      await refetchAssignments()
    } catch (err) {
      console.error('[dopamine drop] toggle:', err)
    }
  }

  // ── Flame / urgent toggle ────────────────────────────────────────
  if (action === 'urgent') {
    if (!ddUserId) return
    try {
      await convex.mutation('assignments:toggleUrgent', {
        assignmentId: id,
        userId: ddUserId,
      })
      await refetchAssignments()
    } catch (err) {
      console.error('[dopamine drop] urgent:', err)
    }
  }

  // ── Calendar day click (filter) ──────────────────────────────────
  if (action === 'day') {
    const y = Number(year), m = Number(month), d = Number(day)
    if (selectedDay?.year === y && selectedDay?.month === m && selectedDay?.day === d) {
      selectedDay = null  // deselect — click same day again
    } else {
      selectedDay = { year: y, month: m, day: d }
    }
    renderAssignmentList(currentAssigns)
    renderCalendar(currentAssigns)
  }
})

// Month navigation
document.getElementById('prev-month').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1)
  renderCalendar(currentAssigns)
})

document.getElementById('next-month').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1)
  renderCalendar(currentAssigns)
})

// Keyboard support for checkboxes (Enter / Space)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return
  const el = e.target.closest('[data-action="toggle"]')
  if (el) { e.preventDefault(); el.click() }
})

// ── UI helpers ────────────────────────────────────────────────────────────────

function setLoading(show) {
  document.getElementById('dd-loading').style.display = show ? 'flex' : 'none'
}

function updateHiddenCount(n) {
  document.getElementById('hidden-count').textContent =
    n > 0 ? `${n} course${n === 1 ? '' : 's'} hidden` : ''
}

function showState(state) {
  setLoading(false)
  const configs = {
    NOT_REGISTERED: {
      emoji: '🔗',
      title: 'Account not connected',
      body: 'Sign up for dopamine drop and sync Canvas to track your assignments here.',
      cta: { label: 'Sign up →', href: `${DEFAULT_APP_URL}/signup` },
    },
    NO_TOKEN: {
      emoji: '🔑',
      title: 'Canvas not linked',
      body: 'Connect your Canvas account from the dopamine drop dashboard.',
      cta: { label: 'Connect Canvas →', href: `${DEFAULT_APP_URL}/dashboard/setup` },
    },
    NO_DATA: {
      emoji: '📭',
      title: 'No assignments yet',
      body: 'Run a Canvas sync from your dashboard to load your assignments.',
      cta: { label: 'Open dashboard →', href: `${DEFAULT_APP_URL}/dashboard` },
    },
    ERROR: {
      emoji: '⚠️',
      title: 'Something went wrong',
      body: 'Could not load your data. Try refreshing the page.',
      cta: { label: 'Open dashboard →', href: `${DEFAULT_APP_URL}/dashboard` },
    },
  }
  const cfg = configs[state] || configs.ERROR
  document.querySelector('.dd-assignments').innerHTML = `
    <div class="dd-empty-state">
      <div class="dd-es-icon">${cfg.emoji}</div>
      <h3>${cfg.title}</h3>
      <p>${cfg.body}</p>
      <a href="${cfg.cta.href}" target="_blank" rel="noopener" class="dd-cta-button">
        ${cfg.cta.label}
      </a>
    </div>`
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div')
  d.appendChild(document.createTextNode(str ?? ''))
  return d.innerHTML
}

function fmtNum(n) {
  n = Number(n) || 0
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/**
 * Returns { label: string, cls: 'overdue' | 'due-soon' | '' }
 */
function relativeDate(iso) {
  if (!iso) return { label: 'No due date', cls: '' }
  const due    = new Date(iso)
  const now    = new Date()
  const diffMs = due - now
  const diffH  = diffMs / 36e5

  if (diffMs < 0)    return { label: 'Overdue',       cls: 'overdue' }
  if (diffH  < 1)    return { label: 'Due now',        cls: 'due-soon' }
  if (diffH  < 24)   return { label: `${Math.round(diffH)}h left`, cls: 'due-soon' }
  if (diffH  < 48)   return { label: 'Tomorrow',      cls: 'due-soon' }
  if (diffH  < 7*24) return {
    label: due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    cls: '',
  }
  return {
    label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cls: '',
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['dd_convex_url', 'dd_app_url'], (r) => {
      resolve({
        convexUrl: (r.dd_convex_url || DEFAULT_CONVEX_URL).trim(),
        appUrl:    (r.dd_app_url    || DEFAULT_APP_URL).trim().replace(/\/$/, ''),
      })
    })
  })
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', boot)
