// Content script - Injects dopamine drop sidebar into Canvas's right sidebar

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

function init() {
  // Check if we're on a Canvas page with a right sidebar
  const rightSide = document.querySelector('#right-side')
  if (!rightSide) {
    console.log('[dopamine drop] No right sidebar found - not a compatible Canvas page')
    return
  }

  console.log('[dopamine drop] Injecting sidebar...')

  // Hide Canvas's default To Do and Coming Up widgets
  hideCanvasWidgets()

  // Create and inject our sidebar
  injectSidebar(rightSide)
}

function hideCanvasWidgets() {
  // Hide Canvas's default to-do list
  const canvasTodo = document.querySelector('.to-do-list')
  if (canvasTodo) {
    canvasTodo.style.display = 'none'
    console.log('[dopamine drop] Hid Canvas To Do widget')
  }

  // Hide Coming Up widget
  const comingUp = document.querySelector('.coming_up')
  if (comingUp) {
    comingUp.style.display = 'none'
    console.log('[dopamine drop] Hid Canvas Coming Up widget')
  }
}

function injectSidebar(container) {
  // Create container for our sidebar
  const sidebarContainer = document.createElement('div')
  sidebarContainer.id = 'dd-sidebar-container'
  sidebarContainer.className = 'dd-sidebar-wrapper'

  // Create iframe to isolate styles
  const iframe = document.createElement('iframe')
  iframe.id = 'dd-sidebar-iframe'
  iframe.src = chrome.runtime.getURL('sidebar/sidebar.html')
  iframe.style.width = '100%'
  iframe.style.height = '100vh'
  iframe.style.border = 'none'
  iframe.style.display = 'block'

  sidebarContainer.appendChild(iframe)

  // Insert at the top of Canvas's right sidebar
  container.insertBefore(sidebarContainer, container.firstChild)

  console.log('[dopamine drop] Sidebar injected successfully')

  // Set up communication with iframe
  setupIframeCommunication(iframe)
}

function setupIframeCommunication(iframe) {
  // Listen for messages from sidebar
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return

    const { type, data } = event.data

    switch (type) {
      case 'GET_CANVAS_USER_ID':
        console.log('[dopamine drop] Sidebar requested user ID, attempting detection...')

        // Try to get user ID with retries (async)
        waitForCanvasUserId().then(userId => {
          if (!userId) {
            console.warn('[dopamine drop] Could not detect user ID after retries - extension will work in standalone mode')
          } else {
            console.log('[dopamine drop] Successfully detected user ID:', userId)
          }

          // Check if iframe still exists and is loaded
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'CANVAS_USER_ID', userId }, '*')
          } else {
            console.error('[dopamine drop] iframe not ready for postMessage')
          }
        })
        break

      case 'REFRESH_ASSIGNMENTS':
        // Trigger Canvas data refresh
        refreshCanvasData()
        break

      case 'OPEN_ASSIGNMENT':
        // Open assignment in current tab
        if (data && data.url) {
          window.location.href = data.url
        }
        break
    }
  })
}

function getCanvasUserId() {
  console.log('[dopamine drop] Starting user ID detection...')

  // Method 1: From global account menu (most reliable - always present)
  console.log('[dopamine drop] Looking for #global_nav_profile_link...')
  const accountBtn = document.querySelector('#global_nav_profile_link')
  console.log('[dopamine drop] Found accountBtn:', accountBtn)

  if (accountBtn) {
    const href = accountBtn.getAttribute('href')
    console.log('[dopamine drop] accountBtn href:', href)

    if (href) {
      const match = href.match(/\/users\/(\d+)/)
      console.log('[dopamine drop] Match result:', match)

      if (match) {
        console.log('[dopamine drop] ✓ Found user ID from global nav:', match[1])
        return match[1]
      }
    }
  }

  // Method 2: From ENV (if available)
  console.log('[dopamine drop] Checking window.ENV...')
  console.log('[dopamine drop] window.ENV exists:', typeof window.ENV !== 'undefined')
  if (typeof window.ENV !== 'undefined') {
    console.log('[dopamine drop] ENV.current_user_id:', window.ENV.current_user_id)
    console.log('[dopamine drop] ENV.current_user:', window.ENV.current_user)

    if (window.ENV.current_user_id) {
      console.log('[dopamine drop] ✓ Found user ID from ENV.current_user_id')
      return window.ENV.current_user_id.toString()
    }
    if (window.ENV.current_user && window.ENV.current_user.id) {
      console.log('[dopamine drop] ✓ Found user ID from ENV.current_user')
      return window.ENV.current_user.id.toString()
    }
  }

  // Method 3: From profile settings link
  console.log('[dopamine drop] Checking for profile settings link...')
  const settingsLink = document.querySelector('a[href*="/profile/settings"]')
  console.log('[dopamine drop] Found settingsLink:', settingsLink)

  if (settingsLink) {
    // User ID might be in parent context
    const navItem = settingsLink.closest('[data-user-id]')
    if (navItem) {
      const userId = navItem.getAttribute('data-user-id')
      if (userId) {
        console.log('[dopamine drop] ✓ Found user ID from nav data attr')
        return userId
      }
    }
  }

  // Method 4: From any /users/ link
  console.log('[dopamine drop] Checking for any /users/ links...')
  const userLinks = document.querySelectorAll('a[href*="/users/"]')
  console.log('[dopamine drop] Found', userLinks.length, 'links with /users/')

  if (userLinks.length > 0) {
    console.log('[dopamine drop] First user link:', userLinks[0].href)

    for (const link of userLinks) {
      const match = link.href.match(/\/users\/(\d+)/)
      if (match && match[1]) {
        console.log('[dopamine drop] ✓ Found user ID from user link:', match[1])
        return match[1]
      }
    }
  }

  console.error('[dopamine drop] ✗ Could not find Canvas user ID anywhere')
  console.log('[dopamine drop] Page URL:', window.location.href)
  console.log('[dopamine drop] Document title:', document.title)

  return null
}

// Add retry logic for user ID detection
async function waitForCanvasUserId(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const userId = getCanvasUserId()
    if (userId) return userId

    // Wait 500ms before trying again
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return null
}

function refreshCanvasData() {
  performCanvasSync()
}

// ============================================
// CANVAS SYNC
// ============================================

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_CANVAS') {
    console.log('[Content] Received sync request')
    performCanvasSync()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true // Keep channel open for async response
  }
})

/**
 * Perform Canvas sync using Canvas API
 */
async function performCanvasSync() {
  try {
    console.log('[Content] Starting Canvas sync...')

    // Dynamically import canvas-api.js
    const { syncCanvasAssignments } = await import(
      chrome.runtime.getURL('utils/canvas-api.js')
    )

    const assignments = await syncCanvasAssignments()

    // Notify sidebar to refresh
    const iframe = document.getElementById('dd-sidebar-iframe')
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'REFRESH_DATA' }, '*')
    }

    // Notify background
    chrome.runtime.sendMessage({
      type: 'SYNC_COMPLETE',
      count: assignments.length
    })

    console.log('[Content] Sync complete')
  } catch (error) {
    console.error('[Content] Sync error:', error)
    chrome.runtime.sendMessage({
      type: 'SYNC_ERROR',
      error: error.message
    })
  }
}
