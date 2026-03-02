// ============================================
// STATE MANAGEMENT
// ============================================
let state = {
  synced: false,
  canvasUserId: null,
  currentWeekStart: null,
  currentTab: 'tasks',
  selectedCourse: 'all',
  tasks: [],
  customTasks: [],
  stats: {
    streak: 0,
    points: 0,
    weekCompleted: 0,
    weekTotal: 0
  }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[dopamine drop] Sidebar initializing...')

  // Detect system theme
  detectTheme()

  // Load data from chrome.storage
  await loadStoredData()

  // Request Canvas user ID from parent page
  requestCanvasUserId()

  // Set up event listeners
  setupEventListeners()

  // Initialize week
  setCurrentWeek()

  // Render initial UI
  render()
})

// ============================================
// THEME DETECTION
// ============================================
function detectTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.body.className = prefersDark ? 'dark-mode' : 'light-mode'

  // Listen for theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    document.body.className = e.matches ? 'dark-mode' : 'light-mode'
  })
}

// ============================================
// DATA LOADING
// ============================================
async function loadStoredData() {
  const data = await chrome.storage.local.get([
    'stats',
    'customTasks',
    'canvasAssignments',
    'settings',
    'pointsLedger'
  ])

  state.stats = data.stats || { streak: 0, points: 0, weekCompleted: 0, weekTotal: 0 }
  state.customTasks = data.customTasks || []
  state.tasks = data.canvasAssignments || []
  state.synced = data.settings?.syncEnabled || false

  console.log('[dopamine drop] Loaded data:', state)
}

function requestCanvasUserId() {
  // Ask parent page for Canvas user ID
  window.parent.postMessage({ type: 'GET_CANVAS_USER_ID' }, '*')

  // Listen for response
  window.addEventListener('message', async (event) => {
    const { type, userId } = event.data

    if (type === 'CANVAS_USER_ID') {
      state.canvasUserId = userId
      console.log('[Sidebar] Canvas user ID:', userId)

      // Fetch Canvas assignments
      fetchCanvasAssignments()
    }

    // Handle refresh request from content script
    if (type === 'REFRESH_DATA') {
      console.log('[Sidebar] Refreshing data...')
      await loadStoredData()
      render()
    }
  })
}

async function fetchCanvasAssignments() {
  console.log('[Sidebar] Requesting Canvas sync...')

  // Send sync request to content script
  window.parent.postMessage({ type: 'REFRESH_ASSIGNMENTS' }, '*')
}

// ============================================
// WEEK MANAGEMENT
// ============================================
function setCurrentWeek() {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const monday = new Date(today)
  monday.setDate(today.getDate() - daysToMonday)
  monday.setHours(0, 0, 0, 0)

  state.currentWeekStart = monday
  updateWeekLabel()
}

function updateWeekLabel() {
  const monday = state.currentWeekStart
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const format = (date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const day = date.getDate()
    return `${month} ${day}`
  }

  document.getElementById('week-label').textContent = `${format(monday)} - ${format(sunday)}`
}

function changeWeek(direction) {
  const newWeek = new Date(state.currentWeekStart)
  newWeek.setDate(newWeek.getDate() + (direction * 7))
  state.currentWeekStart = newWeek

  updateWeekLabel()
  calculateWeekProgress()
  renderTasks()
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Week navigation
  document.getElementById('prev-week').addEventListener('click', () => changeWeek(-1))
  document.getElementById('next-week').addEventListener('click', () => changeWeek(1))

  // Tabs
  document.querySelectorAll('.dd-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  })

  // Course filter
  document.getElementById('course-filter').addEventListener('change', (e) => {
    state.selectedCourse = e.target.value
    renderTasks()
  })

  // Add task button
  document.getElementById('add-task-btn').addEventListener('click', openAddTaskModal)

  // Settings button
  document.getElementById('settings-btn').addEventListener('click', openSettings)
}

function switchTab(tabName) {
  state.currentTab = tabName

  // Update tab buttons
  document.querySelectorAll('.dd-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName)
  })

  // Show/hide lists
  document.getElementById('tasks-list').style.display = tabName === 'tasks' ? 'block' : 'none'
  document.getElementById('graded-list').style.display = tabName === 'graded' ? 'block' : 'none'

  if (tabName === 'tasks') renderTasks()
  else renderGraded()
}

// ============================================
// RENDERING
// ============================================
function render() {
  renderStats()
  renderProgress()
  renderCourseFilter()
  renderTasks()
}

function renderStats() {
  // Streak
  document.getElementById('streak-value').textContent = `${state.stats.streak} days`

  // Points (only if synced)
  const pointsChip = document.getElementById('points-chip')
  if (state.synced) {
    pointsChip.style.display = 'flex'
    document.getElementById('points-value').textContent = `${state.stats.points} pts`
  } else {
    pointsChip.style.display = 'none'
  }
}

function renderProgress() {
  calculateWeekProgress()

  const percentage = state.stats.weekTotal > 0
    ? Math.round((state.stats.weekCompleted / state.stats.weekTotal) * 100)
    : 0

  document.getElementById('progress-fill').style.width = `${percentage}%`
  document.getElementById('progress-percentage').textContent = `${percentage}%`
  document.getElementById('progress-text').textContent =
    `${state.stats.weekCompleted}/${state.stats.weekTotal} tasks complete`
}

function calculateWeekProgress() {
  const weekStart = state.currentWeekStart
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const allTasks = [...state.tasks, ...state.customTasks]
  const weekTasks = allTasks.filter(task => {
    if (!task.dueAt) return false
    const dueDate = new Date(task.dueAt)
    return dueDate >= weekStart && dueDate < weekEnd
  })

  state.stats.weekTotal = weekTasks.length
  state.stats.weekCompleted = weekTasks.filter(t => t.completed).length
}

function renderCourseFilter() {
  const select = document.getElementById('course-filter')

  // Get unique courses
  const courses = new Set()
  state.tasks.forEach(task => {
    if (task.courseName) courses.add(task.courseName)
  })

  // Build options
  let html = '<option value="all">All Courses</option>'
  courses.forEach(course => {
    html += `<option value="${course}">${course}</option>`
  })

  select.innerHTML = html
  select.value = state.selectedCourse
}

function renderTasks() {
  const container = document.getElementById('tasks-list')
  const loading = document.getElementById('loading')
  const empty = document.getElementById('empty')

  // Filter tasks
  let filteredTasks = [...state.tasks, ...state.customTasks]

  if (state.selectedCourse !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.courseName === state.selectedCourse)
  }

  // Filter by current week
  const weekStart = state.currentWeekStart
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  filteredTasks = filteredTasks.filter(task => {
    if (!task.dueAt) return false
    const dueDate = new Date(task.dueAt)
    return dueDate >= weekStart && dueDate < weekEnd
  })

  // Separate pending and completed
  const pending = filteredTasks.filter(t => !t.completed)
  const completed = filteredTasks.filter(t => t.completed)

  // Separate urgent
  const urgent = pending.filter(t => t.isUrgent)
  const regular = pending.filter(t => !t.isUrgent)

  // Sort
  urgent.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
  regular.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
  completed.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))

  // Hide loading
  loading.style.display = 'none'

  // Show empty state if no tasks
  if (filteredTasks.length === 0) {
    empty.style.display = 'block'
    return
  }

  empty.style.display = 'none'

  // Render
  let html = ''

  if (urgent.length > 0) {
    html += '<div class="urgent-section-header" style="font-size: 11px; font-weight: 600; color: #F97316; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">🔥 URGENT</div>'
    urgent.forEach(task => {
      html += createTaskCard(task, true)
    })
  }

  regular.forEach(task => {
    html += createTaskCard(task, false)
  })

  completed.forEach(task => {
    html += createTaskCard(task, false)
  })

  // Remove loading/empty from container
  const cards = container.querySelectorAll('.dd-task-card')
  cards.forEach(card => card.remove())

  // Insert new cards
  container.insertAdjacentHTML('beforeend', html)

  // Attach event listeners to cards
  attachTaskEventListeners()
}

function createTaskCard(task, isUrgent) {
  const isCompleted = task.completed
  const isCustom = task.isCustom || !task.canvasId

  const dueDate = task.dueAt ? new Date(task.dueAt) : null
  const dueDateText = dueDate ? formatDueDate(dueDate) : 'No due date'
  const isDueSoon = dueDate && isDueDateSoon(dueDate)
  const isOverdue = dueDate && dueDate < new Date() && !isCompleted

  return `
    <div class="dd-task-card ${isUrgent ? 'urgent' : ''} ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
      <div class="task-checkbox ${isCompleted ? 'checked' : ''}" data-task-id="${task.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="task-content">
        <div class="task-header">
          <div class="task-title-row">
            ${task.courseName ? `<div class="task-course">${task.courseName}</div>` : ''}
            <div class="task-title">${task.title}</div>
          </div>
          <div class="task-badges">
            ${isCustom ? '<span class="task-badge custom">✨ CUSTOM</span>' : ''}
            ${isUrgent ? '<span class="task-badge urgent-badge">🔥 P1</span>' : ''}
          </div>
        </div>
        <div class="task-meta">
          <span class="task-due ${isOverdue ? 'overdue' : ''} ${isDueSoon ? 'soon' : ''}">${dueDateText}</span>
          <span class="task-points">${task.points || 0}pts</span>
        </div>
      </div>
      ${!isCompleted ? `<button class="task-urgent-btn ${isUrgent ? 'active' : ''}" data-task-id="${task.id}">🔥</button>` : ''}
    </div>
  `
}

function formatDueDate(date) {
  const now = new Date()
  const diff = date - now
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (diff < 0) return 'Overdue'
  if (hours < 1) return 'Due in < 1 hour'
  if (hours < 24) return `Due in ${hours} hours`
  if (days === 1) return 'Due tomorrow'
  if (days < 7) return `Due in ${days} days`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isDueDateSoon(date) {
  const diff = date - new Date()
  const hours = diff / (1000 * 60 * 60)
  return hours < 72 && hours > 0
}

function attachTaskEventListeners() {
  // Checkboxes
  document.querySelectorAll('.task-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation()
      const taskId = checkbox.dataset.taskId
      toggleTaskCompletion(taskId)
    })
  })

  // Urgent buttons
  document.querySelectorAll('.task-urgent-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const taskId = btn.dataset.taskId
      toggleTaskUrgent(taskId)
    })
  })
}

function renderGraded() {
  const container = document.getElementById('graded-list')

  const graded = state.tasks.filter(t => t.gradeReceived !== null)
  graded.sort((a, b) => new Date(b.gradedAt) - new Date(a.gradedAt))

  if (graded.length === 0) {
    container.innerHTML = '<div class="dd-empty"><div class="empty-title">No graded assignments yet</div></div>'
    return
  }

  let html = ''
  graded.forEach(task => {
    const timeAgo = getTimeAgo(new Date(task.gradedAt))
    html += `
      <div class="graded-item">
        <div class="graded-course">${task.courseName}</div>
        <div class="graded-title">${task.title}</div>
        <div class="graded-meta">
          <span class="graded-score">${task.gradeReceived}/${task.pointsPossible} points</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    `
  })

  container.innerHTML = html
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`
  return 'just now'
}

// ============================================
// TASK ACTIONS
// ============================================
async function toggleTaskCompletion(taskId) {
  const task = findTaskById(taskId)
  if (!task) return

  task.completed = !task.completed
  task.completedAt = task.completed ? new Date().toISOString() : null

  // Update streak and points
  if (task.completed) {
    updateStreakOnCompletion()
    awardPoints(task)
  }

  await saveToStorage()
  render()
}

async function toggleTaskUrgent(taskId) {
  const task = findTaskById(taskId)
  if (!task) return

  task.isUrgent = !task.isUrgent

  await saveToStorage()
  renderTasks()
}

function findTaskById(id) {
  return state.tasks.find(t => t.id === id) || state.customTasks.find(t => t.id === id)
}

function updateStreakOnCompletion() {
  const today = new Date().toISOString().split('T')[0]
  const lastActivity = state.stats.lastActivityDate

  if (lastActivity === today) {
    // Already counted today
    return
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (lastActivity === yesterdayStr || !lastActivity) {
    // Continue streak
    state.stats.streak += 1
  } else {
    // Reset streak
    state.stats.streak = 1
  }

  state.stats.lastActivityDate = today
}

function awardPoints(task) {
  const dueDate = task.dueAt ? new Date(task.dueAt) : null
  const now = new Date()

  let points = 0

  if (!dueDate) {
    points = task.points || 10
  } else if (now < dueDate) {
    // Calculate hours until due
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60)
    if (hoursUntilDue > 24) {
      points = 20 // Early
    } else {
      points = 10 // On time
    }
  } else {
    points = 2 // Late
  }

  state.stats.points += points
}

async function saveToStorage() {
  await chrome.storage.local.set({
    stats: state.stats,
    customTasks: state.customTasks,
    canvasAssignments: state.tasks
  })
}

// ============================================
// MODALS (Placeholders for future implementation)
// ============================================
function openAddTaskModal() {
  alert('Add Task modal - to be implemented')
  // TODO: Create modal UI for adding custom tasks
}

function openSettings() {
  alert('Settings modal - to be implemented')
  // TODO: Create settings modal with sync option
}
